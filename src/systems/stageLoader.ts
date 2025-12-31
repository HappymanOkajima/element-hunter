import type { CrawlOutput, CrawlPage, StageConfig, EnemySpawn, PortalSpawn, BossSpawn } from '../types';
import { isValidEnemyTag } from '../data/elements';
import { gameState } from './gameState';

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
  const gameMode = gameState.getGameMode();

  // モード別の敵数設定
  // EASY: 3-4体（1分クリア想定、展示会向け）
  // NORMAL: 12-20体（やりごたえ重視）
  const baseEnemies = gameMode === 'easy' ? 4 : 12;
  const maxEnemiesLimit = gameMode === 'easy' ? 6 : 20;
  const MAX_ENEMIES = Math.min(Math.floor(baseEnemies * widthMultiplier), maxEnemiesLimit);

  // タグごとの最大出現数
  // img: 上限なし（できるだけ多く）
  // div: 最小限（他で埋まらない場合のみ）
  // その他: 通常上限
  const getMaxPerTag = (tag: string): number => {
    if (tag === 'img') return MAX_ENEMIES;  // 上限なし（全体上限まで）
    if (tag === 'div') return 1;  // 最小限
    return gameMode === 'easy' ? 2 : 3;  // 通常
  };

  const MAX_PORTALS = Math.min(Math.floor(5 * widthMultiplier), 8);  // 最大8個

  // 要素を敵として配置（aタグはポータルなので除外）
  // 元のJSON順序（DOM出現順）を維持しつつ、タグごとの上限で制御
  let enemyCount = 0;
  let xOffset = 0;
  const usedImageUrls = new Set<string>();  // 使用済み画像URLを追跡
  const tagCounts = new Map<string, number>();  // タグごとの配置数を追跡

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

    // タグごとの上限チェック
    const currentTagCount = tagCounts.get(element.tag) || 0;
    const maxForThisTag = getMaxPerTag(element.tag);
    if (currentTagCount >= maxForThisTag) continue;

    // imgタグ: ユニークな画像URLごとに1体ずつ配置
    // その他タグ: 従来通りspawnCount体配置
    if (isImg) {
      for (const imageUrl of validImageUrls) {
        if (enemyCount >= MAX_ENEMIES) break;
        const imgCount = tagCounts.get('img') || 0;
        if (imgCount >= getMaxPerTag('img')) break;
        if (usedImageUrls.has(imageUrl)) continue;  // 既に使用済みの画像はスキップ

        usedImageUrls.add(imageUrl);

        const x = MARGIN_LEFT + (xOffset % playAreaWidth);
        xOffset += playAreaWidth / MAX_ENEMIES;
        const y = MARGIN_TOP + Math.random() * playAreaHeight;

        enemies.push({
          type: element.tag,
          x: Math.round(x),
          y: Math.round(y),
          sampleImageUrl: imageUrl,
        });

        tagCounts.set('img', imgCount + 1);
        enemyCount++;
      }
    } else {
      // このタグの配置数（実際のcount数まで、ただしタグ毎上限あり）
      const remainingForTag = maxForThisTag - currentTagCount;
      const spawnCount = Math.min(element.count, remainingForTag);

      for (let i = 0; i < spawnCount; i++) {
        if (enemyCount >= MAX_ENEMIES) break;

        const x = MARGIN_LEFT + (xOffset % playAreaWidth);
        xOffset += playAreaWidth / MAX_ENEMIES;
        const y = MARGIN_TOP + Math.random() * playAreaHeight;

        const sampleText = validTexts.length > 0
          ? validTexts[Math.floor(Math.random() * validTexts.length)]
          : undefined;

        enemies.push({
          type: element.tag,
          x: Math.round(x),
          y: Math.round(y),
          sampleText,
        });

        tagCounts.set(element.tag, (tagCounts.get(element.tag) || 0) + 1);
        enemyCount++;
      }
    }
  }

  // ポータル（aタグ）を配置 - クロール済みリンクのみ表示
  // 通常リンク + 共通リンク（ナビメニュー）を結合
  const allLinksForPortal = [...page.links, ...commonLinks];
  const uniqueLinks = [...new Set(allLinksForPortal)];  // 重複除去

  // クロール済みリンクのみ抽出（アクセス不可なリンクは表示しない）
  // 現在のページ自身へのリンクは除外
  let accessibleLinks = uniqueLinks.filter(link =>
    link !== page.path && findPageIndex(allPages, link) !== null
  );

  // ターゲットページへのリンクを優先
  const targetPages = gameState.getTargetPages();

  // EASYモードの場合、ターゲットページへのリンクのみ表示
  if (targetPages.length === 2) {  // EASYモード判定（2ページのみ）
    accessibleLinks = accessibleLinks.filter(link => targetPages.includes(link));
  } else {
    // NORMALモード: ターゲットページを先頭に配置（優先表示）
    const targetLinks = accessibleLinks.filter(link => targetPages.includes(link));
    const otherLinks = accessibleLinks.filter(link => !targetPages.includes(link));
    accessibleLinks = [...targetLinks, ...otherLinks];
  }

  // ターゲットページのセット（未クリア分のみ）
  const targetSet = new Set(
    targetPages.filter(t => !gameState.isPageCleared(t))
  );

  // 各ページがターゲットへ導くかどうかを判定するヘルパー
  // commonLinksは全ページから到達可能なので、ページ固有のリンクのみでチェック
  const pageLeadsToTarget = (pagePath: string): boolean => {
    const linkPage = allPages.find(p => p.path === pagePath);
    if (!linkPage) return false;

    // ページ固有のリンクにターゲットが含まれるか（commonLinksは除外）
    const pageLinks = new Set(linkPage.links);
    for (const target of targetSet) {
      if (pageLinks.has(target)) return true;
    }
    return false;
  };

  let portalCount = 0;

  for (const link of accessibleLinks) {
    if (portalCount >= MAX_PORTALS) break;

    // リンク先のページインデックスを検索
    const targetPageIndex = findPageIndex(allPages, link);

    // リンク先ページのタイトルを取得
    const targetPage = targetPageIndex !== null ? allPages[targetPageIndex] : null;
    const pageTitle = targetPage?.title || link;

    // ターゲット判定
    const isTarget = targetSet.has(link);
    const leadsToTarget = !isTarget && pageLeadsToTarget(link);

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
      isTarget,
      leadsToTarget,
    });

    portalCount++;
  }

  // ボス出現判定: sampleTextsが空の要素（img, div除く）をカウント
  const bossElements = page.elements.filter(e =>
    (!e.sampleTexts || e.sampleTexts.length === 0) &&
    e.tag !== 'img' &&
    e.tag !== 'div' &&
    e.tag !== 'a'  // aタグはポータルとして使用
  );
  const totalBossCount = bossElements.reduce((sum, e) => sum + e.count, 0);

  // 10以上ならボス生成（EASYはHP軽め）
  let boss: BossSpawn | null = null;
  if (totalBossCount >= 10) {
    const bossHpMultiplier = gameMode === 'easy' ? 1 : 2;  // EASY: ×1, NORMAL: ×2
    boss = {
      parts: bossElements.map(e => e.tag),
      x: stageWidth / 2,
      y: 300,
      hp: bossElements.length * bossHpMultiplier,
    };
  }

  return {
    name: `${siteName} - ${page.path}`,
    width: stageWidth,
    enemies,
    portals,
    boss,
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
