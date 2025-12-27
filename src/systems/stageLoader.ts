import type { CrawlOutput, CrawlPage, StageConfig, EnemySpawn } from '../types';
import { isValidEnemyTag } from '../data/elements';

// JSONからページを選択してステージ設定を生成
export function loadStageFromCrawl(
  crawlData: CrawlOutput,
  pageIndex: number = 0
): StageConfig {
  const page = crawlData.pages[pageIndex];
  if (!page) {
    throw new Error(`Page index ${pageIndex} not found`);
  }

  return convertPageToStage(page, crawlData.siteName);
}

// ページデータをステージ設定に変換
export function convertPageToStage(
  page: CrawlPage,
  siteName: string
): StageConfig {
  const stageWidth = Math.max(800, page.estimatedWidth);
  const enemies: EnemySpawn[] = [];

  // 敵の配置可能エリア
  const MARGIN_LEFT = 150;
  const MARGIN_RIGHT = 100;
  const MARGIN_TOP = 80;
  const MARGIN_BOTTOM = 80;

  const playAreaWidth = stageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  const playAreaHeight = 600 - MARGIN_TOP - MARGIN_BOTTOM;

  // 最大敵数（ゲームバランス用）
  const MAX_ENEMIES = 30;

  // 要素を敵として配置
  let enemyCount = 0;
  let xOffset = 0;

  for (const element of page.elements) {
    if (!isValidEnemyTag(element.tag)) continue;
    if (enemyCount >= MAX_ENEMIES) break;

    // このタグの配置数（最大5個まで）
    const spawnCount = Math.min(element.count, 5);

    for (let i = 0; i < spawnCount; i++) {
      if (enemyCount >= MAX_ENEMIES) break;

      // X座標: 左から右へ順番に配置
      const x = MARGIN_LEFT + (xOffset % playAreaWidth);
      xOffset += playAreaWidth / MAX_ENEMIES;

      // Y座標: ランダム
      const y = MARGIN_TOP + Math.random() * playAreaHeight;

      enemies.push({
        type: element.tag,
        x: Math.round(x),
        y: Math.round(y),
      });

      enemyCount++;
    }
  }

  return {
    name: `${siteName} - ${page.path}`,
    width: stageWidth,
    enemies,
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
