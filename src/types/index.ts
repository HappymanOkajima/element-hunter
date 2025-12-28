// ゲーム全体で使用する型定義

export type Direction = 'up' | 'down' | 'left' | 'right' |
                        'up-left' | 'up-right' | 'down-left' | 'down-right';

export type EnemyBehavior = 'patrol' | 'orbit' | 'chase';

export interface EnemyConfig {
  tag: string;
  displayName: string;
  rarity: number;
  color: string;
  hp: number;
  damage: number;
  speed: number;
  behavior: EnemyBehavior;
}

export interface EnemySpawn {
  type: string;
  x: number;
  y: number;
  sampleText?: string;  // この敵が持つテキスト
  sampleImageUrl?: string;  // imgタグ用: 画像URL
}

export interface PortalSpawn {
  link: string;
  targetPageIndex: number | null;  // null = クロール済みでない
  pageTitle: string;  // リンク先ページのタイトル
  x: number;
  y: number;
}

export interface StageConfig {
  name: string;
  width: number;
  enemies: EnemySpawn[];
  portals: PortalSpawn[];
  goalX: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  isAttacking: boolean;
  direction: Direction;
}

// クロールJSONの型定義
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
  pages: CrawlPage[];
  deepestPages: string[];
  rareElements: string[];
  commonLinks: string[];
  elementStats: Record<string, ElementStat>;
}

export interface CrawlPage {
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
  textContent: string;
  imageUrls: string[];
  ogImage: string | null;
}

export interface ElementCount {
  tag: string;
  count: number;
  sampleTexts: string[];  // サンプルテキスト（最大5個、各30文字まで）
  sampleImageUrls?: string[];  // imgタグ用: 画像URL（最大5個）
}

export interface ElementStat {
  totalCount: number;
  pageCount: number;
  rarity: number;
}

// ゲーム状態管理
export interface EnemySnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  stopped: boolean;
}

export interface PageState {
  path: string;
  enemies: EnemySnapshot[];
  cleared: boolean;
}
