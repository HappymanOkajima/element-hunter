// クロールオプション
export interface CrawlOptions {
  url: string;
  output: string;
  maxDepth: number;
  maxPages: number;
  delay: number;
  timeout: number;
  siteId?: string;
  siteName?: string;
  commonThreshold: number;
  verbose: boolean;
}

// 要素カウント
export interface ElementCount {
  tag: string;
  count: number;
}

// ページデータ（クロール中）
export interface PageData {
  path: string;
  depth: number;
  title: string;
  elements: ElementCount[];
  totalElementCount: number;
  links: string[];
  allLinks: string[];  // 共通リンク含む全リンク
  contentLength: number;
  parentPath: string | null;
}

// クロール出力JSON
export interface CrawlOutput {
  siteId: string;
  siteName: string;
  baseUrl: string;
  metadata: {
    crawledAt: string;
    crawlerVersion: string;
    totalPages: number;
    totalElements: number;
    maxDepth: number;
    crawlDuration: number;
  };
  pages: PageOutput[];
  deepestPages: string[];
  rareElements: string[];
  commonLinks: string[];
  elementStats: Record<string, ElementStat>;
}

// ページ出力データ
export interface PageOutput {
  path: string;
  depth: number;
  title: string;
  elements: ElementCount[];
  totalElementCount: number;
  links: string[];
  parentLink: string | null;
  contentLength: number;
  estimatedWidth: number;
}

// 要素統計
export interface ElementStat {
  totalCount: number;
  pageCount: number;
  rarity: number;
}

// クロールコンテキスト
export interface CrawlContext {
  options: CrawlOptions;
  baseUrl: URL;
  visited: Set<string>;
  pages: PageData[];
  linkOccurrence: Map<string, number>;
  startTime: number;
}
