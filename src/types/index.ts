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
}

export interface PortalSpawn {
  link: string;
  targetPageIndex: number | null;  // null = クロール済みでない
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
}

export interface ElementCount {
  tag: string;
  count: number;
}

export interface ElementStat {
  totalCount: number;
  pageCount: number;
  rarity: number;
}
