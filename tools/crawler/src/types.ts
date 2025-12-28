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
  sampleTexts: string[];  // サンプルテキスト（最大5個、各30文字まで）
  sampleImageUrls?: string[];  // imgタグ用: 画像URL（最大5個）
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
  // コンテンツ表示用
  textContent: string;      // ページ要約テキスト（500文字程度）
  imageUrls: string[];      // 主要画像URL（最大5枚）
  ogImage: string | null;   // OGP画像
}

// サイトスタイル情報
export interface SiteStyle {
  backgroundColor: string;      // 背景色 (hex)
  primaryColor: string;         // メインカラー (hex)
  accentColor: string;          // アクセントカラー (hex)
  textColor: string;            // テキスト色 (hex)
  themeColor: string | null;    // meta theme-color
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
  siteStyle: SiteStyle;         // サイトスタイル情報
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
  // コンテンツ表示用
  textContent: string;      // ページ要約テキスト（500文字程度）
  imageUrls: string[];      // 主要画像URL（最大5枚）
  ogImage: string | null;   // OGP画像
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
