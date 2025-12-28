import type { CrawlOutput, CrawlPage, StageConfig, EnemySpawn, PortalSpawn } from '../types';
import { isValidEnemyTag } from '../data/elements';

// パスからページインデックスを検索
function findPageIndex(pages: CrawlPage[], path: string): number | null {
  const index = pages.findIndex(p => p.path === path);
  return index >= 0 ? index : null;
}

// JSONからページを選択してステージ設定を生成
export function loadStageFromCrawl(
  crawlData: CrawlOutput,
  pageIndex: number = 0
): StageConfig {
  const page = crawlData.pages[pageIndex];
  if (!page) {
    throw new Error(`Page index ${pageIndex} not found`);
  }

  return convertPageToStage(page, crawlData.siteName, crawlData.pages, crawlData.commonLinks);
}

// ページデータをステージ設定に変換
export function convertPageToStage(
  page: CrawlPage,
  siteName: string,
  allPages: CrawlPage[] = [],
  commonLinks: string[] = []
): StageConfig {
  const stageWidth = Math.max(800, page.estimatedWidth);
  const enemies: EnemySpawn[] = [];
  const portals: PortalSpawn[] = [];

  // 敵の配置可能エリア
  const MARGIN_LEFT = 150;
  const MARGIN_RIGHT = 100;
  const MARGIN_TOP = 80;
  const MARGIN_BOTTOM = 80;

  const playAreaWidth = stageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  const playAreaHeight = 600 - MARGIN_TOP - MARGIN_BOTTOM;

  // 最大数を設定（ステージ幅が広くても上限あり）
  const widthMultiplier = Math.min(stageWidth / 800, 2);  // 最大2倍まで
  const MAX_ENEMIES = Math.min(Math.floor(12 * widthMultiplier), 20);  // 最大20体
  const MAX_ENEMIES_PER_TAG = 3;  // 1タグあたり最大3体
  const MAX_PORTALS = Math.min(Math.floor(5 * widthMultiplier), 8);  // 最大8個

  // 要素を敵として配置（aタグはポータルなので除外）
  let enemyCount = 0;
  let xOffset = 0;

  for (const element of page.elements) {
    if (!isValidEnemyTag(element.tag)) continue;
    if (element.tag === 'a') continue;  // aタグはポータルとして別処理

    // imgタグは画像URLを持つ場合のみ、それ以外はテキストを持つ場合のみ
    // 空文字列は除外してフィルタリング
    const isImg = element.tag === 'img';
    const validImageUrls = element.sampleImageUrls?.filter(url => url && url.trim().length > 0) || [];
    const validTexts = element.sampleTexts?.filter(text => text && text.trim().length > 0) || [];

    if (isImg) {
      if (validImageUrls.length === 0) continue;
    } else {
      if (validTexts.length === 0) continue;
    }

    if (enemyCount >= MAX_ENEMIES) break;

    // このタグの配置数（実際のcount数まで、ただしタグ毎上限あり）
    const spawnCount = Math.min(element.count, MAX_ENEMIES_PER_TAG);

    for (let i = 0; i < spawnCount; i++) {
      if (enemyCount >= MAX_ENEMIES) break;

      // X座標: 左から右へ順番に配置
      const x = MARGIN_LEFT + (xOffset % playAreaWidth);
      xOffset += playAreaWidth / MAX_ENEMIES;

      // Y座標: ランダム
      const y = MARGIN_TOP + Math.random() * playAreaHeight;

      // サンプルテキスト/画像URLを取得（ランダムに1つ選択、フィルタリング済み配列を使用）
      let sampleText: string | undefined;
      let sampleImageUrl: string | undefined;

      if (isImg) {
        sampleImageUrl = validImageUrls.length > 0
          ? validImageUrls[Math.floor(Math.random() * validImageUrls.length)]
          : undefined;
      } else {
        sampleText = validTexts.length > 0
          ? validTexts[Math.floor(Math.random() * validTexts.length)]
          : undefined;
      }

      enemies.push({
        type: element.tag,
        x: Math.round(x),
        y: Math.round(y),
        sampleText,
        sampleImageUrl,
      });

      enemyCount++;
    }
  }

  // ポータル（aタグ）を配置 - クロール済みリンクのみ表示
  // 通常リンク + 共通リンク（ナビメニュー）を結合
  const allLinksForPortal = [...page.links, ...commonLinks];
  const uniqueLinks = [...new Set(allLinksForPortal)];  // 重複除去

  // クロール済みリンクのみ抽出（アクセス不可なリンクは表示しない）
  // 現在のページ自身へのリンクは除外
  const accessibleLinks = uniqueLinks.filter(link =>
    link !== page.path && findPageIndex(allPages, link) !== null
  );

  let portalCount = 0;

  for (const link of accessibleLinks) {
    if (portalCount >= MAX_PORTALS) break;

    // リンク先のページインデックスを検索
    const targetPageIndex = findPageIndex(allPages, link);

    // リンク先ページのタイトルを取得
    const targetPage = targetPageIndex !== null ? allPages[targetPageIndex] : null;
    const pageTitle = targetPage?.title || link;

    // X座標: ステージ全体に分散
    const x = MARGIN_LEFT + (portalCount / MAX_PORTALS) * playAreaWidth;
    // Y座標: 上下にばらつかせる
    const y = MARGIN_TOP + (portalCount % 2 === 0 ? 0.3 : 0.7) * playAreaHeight;

    portals.push({
      link,
      targetPageIndex,
      pageTitle,
      x: Math.round(x),
      y: Math.round(y),
    });

    portalCount++;
  }

  return {
    name: `${siteName} - ${page.path}`,
    width: stageWidth,
    enemies,
    portals,
    goalX: stageWidth - 30,
  };
}

// 全ページの一覧を取得
export function getPageList(crawlData: CrawlOutput): Array<{ index: number; path: string; title: string; depth: number }> {
  return crawlData.pages.map((page, index) => ({
    index,
    path: page.path,
    title: page.title,
    depth: page.depth,
  }));
}
