import type { Page } from 'playwright';
import type { ElementCount } from './types.js';

// DOM解析結果
export interface ParseResult {
  elements: ElementCount[];
  totalElementCount: number;
  links: string[];
  contentLength: number;
  title: string;
  // コンテンツ表示用
  textContent: string;      // ページ要約テキスト（500文字程度）
  imageUrls: string[];      // 主要画像URL（最大5枚）
  ogImage: string | null;   // OGP画像
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

    // メインコンテンツをHTML構造を保持したまま抽出
    // style/script要素を除外してクローン
    const mainElement = document.querySelector('main, article, .content, #main, #content, .main-content');
    const targetElement = mainElement || document.body;
    const clone = targetElement?.cloneNode(true) as HTMLElement;
    if (clone) {
      // 不要な要素を除去
      clone.querySelectorAll('style, script, noscript, svg, iframe, img, video, audio, canvas, form, input, button, nav, header, footer, aside').forEach(el => el.remove());
      // 属性をすべて削除（クラス、スタイル等）
      clone.querySelectorAll('*').forEach(el => {
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
      });
    }
    // 許可するタグのみ残す
    const allowedTags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br'];
    let htmlContent = clone?.innerHTML || '';
    // 許可されていないタグを除去（中身は残す）
    htmlContent = htmlContent.replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tag) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        // 属性を除去したシンプルなタグに置換
        if (match.startsWith('</')) {
          return `</${tag.toLowerCase()}>`;
        }
        return `<${tag.toLowerCase()}>`;
      }
      return '';
    });
    // 連続する空白を整理
    htmlContent = htmlContent.replace(/\s+/g, ' ').trim();
    // 空のタグを除去
    htmlContent = htmlContent.replace(/<(\w+)>\s*<\/\1>/g, '');
    // 2000文字に制限
    const textContent = htmlContent.slice(0, 2000);

    // 画像URLを抽出（icon/logo除外、最大5枚）
    const imgElements = document.querySelectorAll('img[src]');
    const imageUrls: string[] = [];
    imgElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('favicon')) {
        // サイズが小さすぎる画像は除外（width/height属性チェック）
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        if (width && parseInt(width) < 50) return;
        if (height && parseInt(height) < 50) return;
        if (imageUrls.length < 5) {
          imageUrls.push(src);
        }
      }
    });

    // OGP画像
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

    return { elements, totalElementCount, links, contentLength, title, textContent, imageUrls, ogImage };
  });

  // リンクを正規化（内部リンクのみ抽出）
  const normalizedLinks = normalizeLinks(result.links, baseUrl);

  // 画像URLを絶対URLに変換
  const absoluteImageUrls = result.imageUrls.map(src => {
    try {
      return new URL(src, baseUrl.origin).href;
    } catch {
      return src;
    }
  });

  // OGP画像も絶対URLに変換
  let absoluteOgImage = result.ogImage;
  if (absoluteOgImage) {
    try {
      absoluteOgImage = new URL(absoluteOgImage, baseUrl.origin).href;
    } catch {
      // そのまま
    }
  }

  return {
    ...result,
    links: normalizedLinks,
    imageUrls: absoluteImageUrls,
    ogImage: absoluteOgImage,
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
