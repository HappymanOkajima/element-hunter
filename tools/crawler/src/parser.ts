import type { Page } from 'playwright';
import type { ElementCount } from './types.js';

// DOM解析結果
export interface ParseResult {
  elements: ElementCount[];
  totalElementCount: number;
  links: string[];
  contentLength: number;
  title: string;
}

// ページのDOMを解析
export async function parsePage(page: Page, baseUrl: URL): Promise<ParseResult> {
  const result = await page.evaluate(() => {
    // 全要素を取得してタグをカウント
    const allElements = document.querySelectorAll('*');
    const tagCount = new Map<string, number>();

    allElements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      // script, style, meta等は除外
      if (!['script', 'style', 'meta', 'link', 'noscript'].includes(tag)) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      }
    });

    // 要素カウントを配列に変換
    const elements = Array.from(tagCount.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const totalElementCount = elements.reduce((sum, e) => sum + e.count, 0);

    // 全リンクを取得
    const anchors = document.querySelectorAll('a[href]');
    const links: string[] = [];
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        links.push(href);
      }
    });

    // テキストコンテンツの長さ
    const contentLength = document.body?.textContent?.length || 0;

    // タイトル
    const title = document.title || '';

    return { elements, totalElementCount, links, contentLength, title };
  });

  // リンクを正規化（内部リンクのみ抽出）
  const normalizedLinks = normalizeLinks(result.links, baseUrl);

  return {
    ...result,
    links: normalizedLinks,
  };
}

// リンクを正規化し、内部リンクのみ抽出
function normalizeLinks(links: string[], baseUrl: URL): string[] {
  const internalLinks = new Set<string>();

  for (const href of links) {
    try {
      // 空やJavaScript等は除外
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }

      // 絶対URLに変換
      const url = new URL(href, baseUrl.origin);

      // 同一ホストのみ
      if (url.hostname !== baseUrl.hostname) {
        continue;
      }

      // フラグメントを除去してパスのみ取得
      const path = url.pathname;

      // 重複除去
      internalLinks.add(path);
    } catch {
      // 無効なURLは無視
    }
  }

  return Array.from(internalLinks);
}
