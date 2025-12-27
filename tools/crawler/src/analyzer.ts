import type { PageData, ElementStat } from './types.js';

// 共通リンクを検出
export function detectCommonLinks(
  pages: PageData[],
  threshold: number = 0.8
): Set<string> {
  const linkOccurrence = new Map<string, number>();
  const totalPages = pages.length;

  // 各リンクの出現ページ数をカウント
  for (const page of pages) {
    const uniqueLinks = new Set(page.allLinks);
    for (const link of uniqueLinks) {
      linkOccurrence.set(link, (linkOccurrence.get(link) || 0) + 1);
    }
  }

  // 閾値以上の出現率のリンクを共通リンクとして判定
  const commonLinks = new Set<string>();
  for (const [link, count] of linkOccurrence) {
    const rate = count / totalPages;
    if (rate >= threshold) {
      commonLinks.add(link);
    }
  }

  return commonLinks;
}

// ページから共通リンクを除外したリンクを取得
export function filterCommonLinks(
  links: string[],
  commonLinks: Set<string>
): string[] {
  return links.filter(link => !commonLinks.has(link));
}

// 最深ページを抽出
export function findDeepestPages(pages: PageData[]): string[] {
  if (pages.length === 0) return [];

  const maxDepth = Math.max(...pages.map(p => p.depth));
  return pages
    .filter(p => p.depth === maxDepth)
    .map(p => p.path);
}

// レア要素を抽出（全体で5回以下出現）
export function findRareElements(
  pages: PageData[],
  threshold: number = 5
): string[] {
  const elementCount = new Map<string, number>();

  for (const page of pages) {
    for (const element of page.elements) {
      elementCount.set(
        element.tag,
        (elementCount.get(element.tag) || 0) + element.count
      );
    }
  }

  return Array.from(elementCount.entries())
    .filter(([_, count]) => count <= threshold)
    .map(([tag]) => tag)
    .sort();
}

// 要素統計を計算
export function calculateElementStats(pages: PageData[]): Record<string, ElementStat> {
  const stats: Record<string, ElementStat> = {};
  const totalPages = pages.length;

  // 各要素の総カウントとページ数を集計
  for (const page of pages) {
    for (const element of page.elements) {
      if (!stats[element.tag]) {
        stats[element.tag] = { totalCount: 0, pageCount: 0, rarity: 1 };
      }
      stats[element.tag].totalCount += element.count;
    }
  }

  // ページ出現数をカウント
  for (const page of pages) {
    const tags = new Set(page.elements.map(e => e.tag));
    for (const tag of tags) {
      if (stats[tag]) {
        stats[tag].pageCount++;
      }
    }
  }

  // レアリティを計算
  for (const tag in stats) {
    stats[tag].rarity = calculateRarity(tag, stats[tag], totalPages);
  }

  return stats;
}

// レアリティ計算
function calculateRarity(tag: string, stat: ElementStat, totalPages: number): number {
  const pageRate = stat.pageCount / totalPages;

  // 基本レアリティ（ゲーム仕様に基づく）
  const baseRarity = getBaseRarity(tag);

  // 出現頻度による調整
  if (pageRate < 0.1) return Math.max(baseRarity, 4);  // 非常に希少
  if (pageRate < 0.3) return Math.max(baseRarity, 3);  // 希少
  if (pageRate < 0.5) return Math.max(baseRarity, 2);  // やや希少

  return baseRarity;
}

// タグの基本レアリティ（ゲーム仕様より）
function getBaseRarity(tag: string): number {
  const rarityMap: Record<string, number> = {
    // ★1 (白)
    'p': 1, 'span': 1, 'div': 1, 'a': 1, 'li': 1, 'img': 1,
    'ul': 1, 'ol': 1, 'br': 1, 'hr': 1, 'em': 1, 'strong': 1,

    // ★2 (緑)
    'h6': 2, 'h5': 2, 'h4': 2, 'table': 2, 'form': 2, 'button': 2,
    'input': 2, 'select': 2, 'textarea': 2, 'label': 2, 'tr': 2, 'td': 2,

    // ★3 (青)
    'h3': 3, 'h2': 3, 'h1': 3, 'article': 3, 'section': 3,
    'video': 3, 'audio': 3, 'canvas': 3, 'iframe': 3, 'nav': 3, 'aside': 3,

    // ★4 (紫)
    'dialog': 4, 'template': 4, 'details': 4, 'meter': 4,
    'progress': 4, 'svg': 4, 'picture': 4, 'mark': 4, 'summary': 4,

    // ★5 (金)
    'ruby': 5, 'bdo': 5, 'wbr': 5, 'data': 5, 'slot': 5, 'output': 5,
    'math': 5, 'object': 5, 'embed': 5,
  };

  return rarityMap[tag] || 1;
}

// 部屋幅を計算
export function calculateRoomWidth(
  totalElementCount: number,
  contentLength: number
): number {
  const BASE_WIDTH = 800;
  const ELEMENT_FACTOR = 5;
  const CONTENT_FACTOR = 0.1;
  const MIN_WIDTH = 800;
  const MAX_WIDTH = 4000;

  const width = BASE_WIDTH
    + (totalElementCount * ELEMENT_FACTOR)
    + (contentLength * CONTENT_FACTOR);

  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
