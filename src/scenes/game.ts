import type { KaboomCtx } from 'kaboom';
import { createPlayer, type PlayerObject } from '../entities/player';
import { createEnemy, type EnemyObject } from '../entities/enemy';
import { createPortal, type PortalObject } from '../entities/portal';
import type { StageConfig, CrawlOutput } from '../types';
import { loadStageFromCrawl } from '../systems/stageLoader';

// 現在のステージ設定（外部から設定可能）
let currentStage: StageConfig | null = null;
let crawlData: CrawlOutput | null = null;

// ステージを設定
export function setStage(stage: StageConfig) {
  currentStage = stage;
}

// クロールデータを設定（ポータル遷移用）
export function setCrawlData(data: CrawlOutput) {
  crawlData = data;
}

// デフォルトステージ
const DEFAULT_STAGE: StageConfig = {
  name: 'Tutorial',
  width: 800,
  enemies: [
    { type: 'p', x: 300, y: 200 },
    { type: 'p', x: 400, y: 400 },
    { type: 'div', x: 500, y: 300 },
    { type: 'h1', x: 650, y: 300 },
  ],
  portals: [],
  goalX: 770,
};

export function gameScene(k: KaboomCtx) {
  // ステージ設定を取得（設定されていなければデフォルト）
  const stage = currentStage || DEFAULT_STAGE;

  // ゲーム状態
  let isPaused = false;
  let player: PlayerObject | null = null;

  // カメラのオフセット（横スクロール用）
  let cameraX = 0;

  // --- UI描画 ---

  // HP表示ラベル
  const hpLabel = k.add([
    k.text('HP: *****', { size: 14 }),
    k.pos(10, 8),
    k.color(255, 100, 100),
    k.fixed(),
  ]);

  // 敵カウント表示
  const enemyCountLabel = k.add([
    k.text('', { size: 12 }),
    k.pos(k.width() - 10, 8),
    k.anchor('topright'),
    k.color(100, 200, 100),
    k.fixed(),
  ]);

  // 現在のページパス表示（下部に配置）
  k.add([
    k.text(stage.name, { size: 12 }),
    k.pos(k.width() / 2, k.height() - 10),
    k.anchor('bot'),
    k.color(100, 180, 220),
    k.fixed(),
  ]);

  // HP表示更新
  function updateHpDisplay() {
    if (!player) return;
    const state = player.getState();
    const hearts = '*'.repeat(state.hp) + '-'.repeat(state.maxHp - state.hp);
    hpLabel.text = `HP: ${hearts}`;
  }

  // 敵カウント更新
  function updateEnemyCount() {
    const enemies = k.get('enemy');
    enemyCountLabel.text = `Enemies: ${enemies.length}`;
  }

  // 毎フレーム更新
  k.onUpdate(() => {
    if (!isPaused) {
      updateHpDisplay();
      updateEnemyCount();

      // カメラの横スクロール（プレイヤー追従）
      if (player && stage.width > k.width()) {
        const targetX = Math.max(0, Math.min(player.pos.x - k.width() / 2, stage.width - k.width()));
        cameraX = targetX;
        k.camPos(k.width() / 2 + cameraX, k.height() / 2);
      }
    }
  });

  // --- プレイヤー生成 ---
  player = createPlayer(k, stage.width);

  // --- 敵生成 ---
  stage.enemies.forEach((enemyData) => {
    createEnemy(
      k,
      enemyData.type,
      enemyData.x,
      enemyData.y,
      () => player,
      stage.width
    );
  });

  // --- ポータル生成 ---
  stage.portals.forEach((portalData) => {
    createPortal(
      k,
      portalData.link,
      portalData.targetPageIndex,
      portalData.x,
      portalData.y,
      stage.width
    );
  });

  // --- ゴール生成 ---
  k.add([
    k.text('[GOAL]', { size: 24 }),
    k.pos(stage.goalX, k.height() / 2),
    k.area({ shape: new k.Rect(k.vec2(-30, -50), 60, 100) }),
    k.anchor('center'),
    k.color(0, 255, 100),
    'goal',
  ]);

  // --- 衝突判定 ---

  // プレイヤー vs 敵
  k.onCollide('player', 'enemy', (_p, e) => {
    if (player) {
      const config = (e as EnemyObject).getConfig();
      player.takeDamage(config.damage);
    }
  });

  // 剣 vs 敵
  k.onCollide('sword', 'enemy', (_s, e) => {
    (e as EnemyObject).takeDamage(1);
  });

  // プレイヤー vs ゴール
  k.onCollide('player', 'goal', () => {
    k.go('clear');
  });

  // プレイヤー vs ポータル（アクセス可能）
  k.onCollide('player', 'portal-accessible', (_p, portal) => {
    const portalObj = portal as PortalObject;
    const targetIndex = portalObj.getTargetPageIndex();

    if (targetIndex !== null && crawlData) {
      // ステージ遷移
      const newStage = loadStageFromCrawl(crawlData, targetIndex);
      setStage(newStage);
      k.go('game');
    }
  });

  // プレイヤー vs ポータル（アクセス不可）- メッセージ表示
  let messageTimeout: ReturnType<typeof setTimeout> | null = null;
  const messageLabel = k.add([
    k.text('', { size: 16 }),
    k.pos(k.width() / 2, k.height() - 40),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.fixed(),
  ]);

  k.onCollide('player', 'portal-inaccessible', (_p, portal) => {
    const portalObj = portal as PortalObject;
    const link = portalObj.getLink();

    messageLabel.text = `${link} is not crawled`;

    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      messageLabel.text = '';
    }, 2000);
  });

  // --- ポーズ機能 ---
  k.onKeyPress('escape', () => {
    isPaused = !isPaused;

    if (isPaused) {
      k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.7),
        k.fixed(),
        'pauseOverlay',
      ]);

      k.add([
        k.text('PAUSED', { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.fixed(),
        'pauseOverlay',
      ]);

      k.add([
        k.text('Press ESC to resume', { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 60),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.fixed(),
        'pauseOverlay',
      ]);
    } else {
      k.get('pauseOverlay').forEach((obj) => k.destroy(obj));
    }
  });
}
