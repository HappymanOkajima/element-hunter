import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlOptions, CrawlContext, PageData, CrawlOutput, PageOutput, SiteStyle } from './types.js';
import { parsePage, parseSiteStyle } from './parser.js';
import {
  detectCommonLinks,
  filterCommonLinks,
  findDeepestPages,
  findRareElements,
  calculateElementStats,
  calculateRoomWidth,
} from './analyzer.js';

// デフォルトスタイル
const DEFAULT_SITE_STYLE: SiteStyle = {
  backgroundColor: '#ffffff',
  primaryColor: '#0088ff',
  accentColor: '#0088ff',
  textColor: '#333333',
  themeColor: null,
};

const CRAWLER_VERSION = '0.1.0';

// メインクロール関数
export async function crawl(options: CrawlOptions): Promise<CrawlOutput> {
  const baseUrl = new URL(options.url);

  const context: CrawlContext = {
    options,
    baseUrl,
    visited: new Set(),
    pages: [],
    linkOccurrence: new Map(),
    startTime: Date.now(),
  };

  let browser: Browser | null = null;
  let siteStyle: SiteStyle = DEFAULT_SITE_STYLE;

  try {
    // ブラウザ起動
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // タイムアウト設定
    page.setDefaultTimeout(options.timeout);

    // トップページを読み込んでスタイルを取得
    const fullUrl = new URL('/', baseUrl.origin).toString();
    await page.goto(fullUrl, { waitUntil: 'networkidle' });

    try {
      siteStyle = await parseSiteStyle(page);
      if (options.verbose) {
        console.log(`Site style: bg=${siteStyle.backgroundColor}, primary=${siteStyle.primaryColor}`);
      }
    } catch (e) {
      console.log('Failed to parse site style, using defaults');
      console.log('Error:', e);
    }

    // クロール開始（トップページは既に読み込み済みなので特別処理）
    await crawlPage(page, '/', 0, context, true);

    // 結果を生成
    return generateOutput(context, options, siteStyle);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ページをクロール
async function crawlPage(
  page: Page,
  path: string,
  depth: number,
  context: CrawlContext,
  alreadyLoaded: boolean = false
): Promise<void> {
  const { options, baseUrl, visited, pages } = context;

  // 正規化されたパス
  const normalizedPath = normalizePath(path);

  // 既に訪問済み
  if (visited.has(normalizedPath)) {
    return;
  }

  // 深度制限チェック
  if (depth > options.maxDepth) {
    return;
  }

  // ページ数制限チェック
  if (pages.length >= options.maxPages) {
    return;
  }

  // 訪問済みに追加
  visited.add(normalizedPath);

  // URLを構築
  const fullUrl = new URL(normalizedPath, baseUrl.origin).toString();

  if (options.verbose) {
    console.log(`[${pages.length + 1}/${options.maxPages}] Crawling: ${normalizedPath} (depth: ${depth})`);
  }

  try {
    // ページ読み込み（既に読み込み済みの場合はスキップ）
    if (!alreadyLoaded) {
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
    }

    // 遅延
    if (options.delay > 0) {
      await sleep(options.delay);
    }

    // DOM解析
    const parseResult = await parsePage(page, baseUrl);

    // ページデータを保存
    const pageData: PageData = {
      path: normalizedPath,
      depth,
      title: parseResult.title,
      elements: parseResult.elements,
      totalElementCount: parseResult.totalElementCount,
      links: parseResult.links,
      allLinks: parseResult.links,  // 後で共通リンク除外用
      contentLength: parseResult.contentLength,
      parentPath: depth > 0 ? findParentPath(normalizedPath, pages) : null,
      // コンテンツ表示用
      textContent: parseResult.textContent,
      imageUrls: parseResult.imageUrls,
      ogImage: parseResult.ogImage,
    };

    pages.push(pageData);

    if (options.verbose) {
      console.log(`       Elements: ${pageData.totalElementCount} | Links: ${pageData.links.length} | Content: ${formatBytes(pageData.contentLength)}`);
    }

    // 再帰的にリンク先をクロール
    for (const link of parseResult.links) {
      await crawlPage(page, link, depth + 1, context);
    }
  } catch (error) {
    if (options.verbose) {
      console.error(`       Error: ${(error as Error).message}`);
    }
  }
}

// 出力データを生成
function generateOutput(context: CrawlContext, options: CrawlOptions, siteStyle: SiteStyle): CrawlOutput {
  const { pages, baseUrl, startTime } = context;

  // 共通リンクを検出
  const commonLinks = detectCommonLinks(pages, options.commonThreshold);

  // 各ページのリンクから共通リンクを除外
  const pagesWithFilteredLinks: PageOutput[] = pages.map(p => ({
    path: p.path,
    depth: p.depth,
    title: p.title,
    elements: p.elements,
    totalElementCount: p.totalElementCount,
    links: filterCommonLinks(p.links, commonLinks),
    parentLink: p.parentPath,
    contentLength: p.contentLength,
    estimatedWidth: calculateRoomWidth(p.totalElementCount, p.contentLength),
    // コンテンツ表示用
    textContent: p.textContent,
    imageUrls: p.imageUrls,
    ogImage: p.ogImage,
  }));

  // サイトIDを生成
  const siteId = options.siteId || generateSiteId(baseUrl.hostname);

  // サイト名を取得
  const siteName = options.siteName || pages[0]?.title || baseUrl.hostname;

  // 統計情報
  const elementStats = calculateElementStats(pages);
  const totalElements = pages.reduce((sum, p) => sum + p.totalElementCount, 0);

  return {
    siteId,
    siteName,
    baseUrl: baseUrl.origin,
    metadata: {
      crawledAt: new Date().toISOString(),
      crawlerVersion: CRAWLER_VERSION,
      totalPages: pages.length,
      totalElements,
      maxDepth: Math.max(...pages.map(p => p.depth), 0),
      crawlDuration: Date.now() - startTime,
    },
    siteStyle,
    pages: pagesWithFilteredLinks,
    deepestPages: findDeepestPages(pages),
    rareElements: findRareElements(pages),
    commonLinks: Array.from(commonLinks),
    elementStats,
  };
}

// パスを正規化
function normalizePath(path: string): string {
  // 末尾のスラッシュを除去（ルート以外）
  let normalized = path.replace(/\/+$/, '') || '/';

  // 先頭にスラッシュを追加
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  return normalized;
}

// 親ページのパスを探す
function findParentPath(path: string, pages: PageData[]): string | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  // 親パスの候補を生成
  segments.pop();
  const parentPath = segments.length === 0 ? '/' : '/' + segments.join('/');

  // 訪問済みページから探す
  const parent = pages.find(p => p.path === parentPath);
  return parent ? parent.path : null;
}

// サイトIDを生成
function generateSiteId(hostname: string): string {
  return hostname
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
}

// スリープ
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// バイト数をフォーマット
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}
