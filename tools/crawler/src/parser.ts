import type { Page } from 'playwright';
import type { ElementCount, SiteStyle } from './types.js';

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

// サイトスタイル解析結果
export interface StyleParseResult {
  siteStyle: SiteStyle;
}

// ページのDOMを解析
export async function parsePage(page: Page, baseUrl: URL): Promise<ParseResult> {
  const result = await page.evaluate(() => {
    // 全要素を取得してタグをカウント + サンプルテキスト/画像URL収集
    const allElements = document.querySelectorAll('*');
    const tagCount = new Map<string, number>();
    const tagTexts = new Map<string, string[]>();
    const tagImageUrls = new Map<string, string[]>();  // imgタグ用

    // サンプル収集の設定
    const MAX_SAMPLES = 30;      // タグごとの最大サンプル数
    const MAX_TEXT_LENGTH = 50;  // 各テキストの最大文字数

    allElements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      // script, style, meta等は除外
      if (!['script', 'style', 'meta', 'link', 'noscript'].includes(tag)) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);

        // imgタグの場合はsrc属性を収集
        if (tag === 'img') {
          const imgUrls = tagImageUrls.get(tag) || [];
          if (imgUrls.length < MAX_SAMPLES) {
            const src = el.getAttribute('src');
            const imgEl = el as HTMLImageElement;

            // 除外パターン
            const excludePatterns = [
              'icon', 'logo', 'favicon', 'button', 'arrow', 'close',
              'chevron', 'caret', 'spinner', 'loading', 'spacer',
              'placeholder', 'blank', 'pixel', 'transparent', 'badge'
            ];
            const srcLower = (src || '').toLowerCase();
            const isExcluded = excludePatterns.some(p => srcLower.includes(p));

            // data:URI（スペーサーSVG等）は除外
            const isDataUri = srcLower.startsWith('data:');

            // SVGは装飾用が多いので除外（写真系のみ対象）
            const isSvg = srcLower.endsWith('.svg') || srcLower.includes('.svg?');

            // サイズチェック（属性 or 実際のサイズ）
            const width = imgEl.naturalWidth || parseInt(el.getAttribute('width') || '0');
            const height = imgEl.naturalHeight || parseInt(el.getAttribute('height') || '0');
            const isTooSmall = (width > 0 && width < 100) || (height > 0 && height < 100);

            // アスペクト比チェック（極端に細長いものは除外）
            const aspectRatio = width > 0 && height > 0 ? Math.max(width, height) / Math.min(width, height) : 1;
            const isTooNarrow = aspectRatio > 5;

            if (src && !isExcluded && !isDataUri && !isSvg && !isTooSmall && !isTooNarrow) {
              // 重複チェック（ユニークなURLのみ収集）
              if (!imgUrls.includes(src)) {
                imgUrls.push(src);
                tagImageUrls.set(tag, imgUrls);
              }
            }
          }
        } else {
          // テキストコンテンツを取得（直接の子テキストのみ、最大20サンプル）
          const texts = tagTexts.get(tag) || [];
          if (texts.length < MAX_SAMPLES) {
            // 直接のテキストノードのみ取得（子要素のテキストは含まない）
            let directText = '';
            el.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) {
                directText += node.textContent || '';
              }
            });
            directText = directText.trim().replace(/\s+/g, ' ');
            // 意味のあるテキストのみ（3文字以上）
            if (directText.length >= 3) {
              const truncated = directText.length > MAX_TEXT_LENGTH
                ? directText.slice(0, MAX_TEXT_LENGTH) + '…'
                : directText;
              // 重複チェック（ユニークなテキストのみ収集）
              if (!texts.includes(truncated)) {
                texts.push(truncated);
                tagTexts.set(tag, texts);
              }
            }
          }
        }
      }
    });

    // 要素カウントを配列に変換（サンプルテキスト/画像URL付き）
    // 収集した全サンプルをそのまま保持（ゲーム側でランダム選択）
    const elements = Array.from(tagCount.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        sampleTexts: tagTexts.get(tag) || [],
        sampleImageUrls: tagImageUrls.get(tag) || undefined
      }))
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

  // 要素内のsampleImageUrlsを絶対URLに変換
  const elementsWithAbsoluteUrls = result.elements.map(el => ({
    ...el,
    sampleImageUrls: el.sampleImageUrls?.map(src => {
      try {
        return new URL(src, baseUrl.origin).href;
      } catch {
        return src;
      }
    })
  }));

  return {
    ...result,
    elements: elementsWithAbsoluteUrls,
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

// サイトスタイル情報を取得（トップページから）
// Note: page.evaluate内の関数はブラウザコンテキストで実行されるため、
// esbuild/tsxの__name変換を避けるために文字列で評価する
export async function parseSiteStyle(page: Page): Promise<SiteStyle> {
  const result = await page.evaluate(`(() => {
    // ヘルパー関数
    const rgbToHex = (rgb) => {
      const match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return '#' + r + g + b;
      }
      return rgb;
    };

    const getSaturation = (hex) => {
      const match = hex.match(/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i);
      if (!match) return 0;
      const r = parseInt(match[1], 16) / 255;
      const g = parseInt(match[2], 16) / 255;
      const b = parseInt(match[3], 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === 0) return 0;
      return (max - min) / max;
    };

    const isNeutralColor = (hex) => {
      const match = hex.match(/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i);
      if (!match) return true;
      const r = parseInt(match[1], 16);
      const g = parseInt(match[2], 16);
      const b = parseInt(match[3], 16);
      const diff = Math.max(r, g, b) - Math.min(r, g, b);
      return diff < 30;
    };

    // body/htmlの背景色を取得
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    let backgroundColor = bodyStyle.backgroundColor;
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      backgroundColor = htmlStyle.backgroundColor;
    }
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      backgroundColor = '#ffffff';  // デフォルト白
    }
    backgroundColor = rgbToHex(backgroundColor);

    // テキスト色
    let textColor = bodyStyle.color;
    textColor = rgbToHex(textColor);

    // theme-colorメタタグ
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const themeColor = themeColorMeta?.getAttribute('content') || null;

    // 鮮やかな色を収集（彩度でスコアリング）
    const colorScores = new Map();

    // 1. ボタン、CTA、アクセント要素から背景色を優先的に収集
    const accentSelectors = [
      'button', '.btn', '[class*="btn"]', '[class*="button"]',
      '[class*="cta"]', '[class*="primary"]', '[class*="accent"]',
      '[class*="hero"]', '[class*="banner"]', '[class*="highlight"]',
      'a[class*="btn"]', 'a[class*="button"]'
    ];
    const accentElements = document.querySelectorAll(accentSelectors.join(', '));
    for (let i = 0; i < accentElements.length; i++) {
      const el = accentElements[i];
      const style = getComputedStyle(el);
      const bg = rgbToHex(style.backgroundColor);
      if (!isNeutralColor(bg) && getSaturation(bg) > 0.3) {
        // ボタン/CTAの色は高スコア
        colorScores.set(bg, (colorScores.get(bg) || 0) + 10);
      }
    }

    // 2. ヘッダー、ナビゲーションから背景色を収集
    const headerElements = document.querySelectorAll('header, nav, [class*="header"], [class*="nav"]');
    for (let i = 0; i < headerElements.length; i++) {
      const el = headerElements[i];
      const style = getComputedStyle(el);
      const bg = rgbToHex(style.backgroundColor);
      if (!isNeutralColor(bg) && getSaturation(bg) > 0.3) {
        colorScores.set(bg, (colorScores.get(bg) || 0) + 5);
      }
    }

    // 3. リンク色も収集（スコア低め）
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      const style = getComputedStyle(link);
      const color = rgbToHex(style.color);
      if (!isNeutralColor(color) && getSaturation(color) > 0.3) {
        colorScores.set(color, (colorScores.get(color) || 0) + 1);
      }
    });

    // 4. 見出しや強調要素の色も収集
    const headings = document.querySelectorAll('h1, h2, h3, strong, em, [class*="title"]');
    for (let i = 0; i < headings.length; i++) {
      const el = headings[i];
      const style = getComputedStyle(el);
      const color = rgbToHex(style.color);
      if (!isNeutralColor(color) && getSaturation(color) > 0.3) {
        colorScores.set(color, (colorScores.get(color) || 0) + 2);
      }
    }

    // 最も高スコアの色をプライマリカラーに（彩度も考慮）
    let primaryColor = '#ff8800';  // デフォルトオレンジ
    let maxScore = 0;
    colorScores.forEach((score, color) => {
      // 彩度によるボーナス
      const saturationBonus = getSaturation(color) * 5;
      const totalScore = score + saturationBonus;
      if (totalScore > maxScore) {
        maxScore = totalScore;
        primaryColor = color;
      }
    });

    // アクセントカラー（プライマリと異なる2番目に高スコアの色）
    let accentColor = primaryColor;
    let secondMaxScore = 0;
    colorScores.forEach((score, color) => {
      if (color !== primaryColor) {
        const saturationBonus = getSaturation(color) * 5;
        const totalScore = score + saturationBonus;
        if (totalScore > secondMaxScore) {
          secondMaxScore = totalScore;
          accentColor = color;
        }
      }
    });

    // themeColorがあればそれを優先
    if (themeColor && themeColor.startsWith('#')) {
      primaryColor = themeColor;
    }

    return {
      backgroundColor,
      primaryColor,
      accentColor,
      textColor,
      themeColor
    };
  })()`);

  return result as SiteStyle;
}
