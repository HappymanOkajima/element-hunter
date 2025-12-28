import type { KaboomCtx } from 'kaboom';
import { createPlayer, type PlayerObject } from '../entities/player';
import { createEnemy, type EnemyObject } from '../entities/enemy';
import { createPortal, type PortalObject } from '../entities/portal';
import type { StageConfig, CrawlOutput, EnemySnapshot } from '../types';
import { loadStageFromCrawl } from '../systems/stageLoader';
import { gameState } from '../systems/gameState';
import { contentPanel } from '../ui/ContentPanel';

// 現在のステージ設定（外部から設定可能）
let currentStage: StageConfig | null = null;
let crawlData: CrawlOutput | null = null;
let currentPageIndex: number = 0;

// ステージを設定
export function setStage(stage: StageConfig) {
  currentStage = stage;
}

// クロールデータを設定（ポータル遷移用）
export function setCrawlData(data: CrawlOutput) {
  crawlData = data;
}

// 現在のページインデックスを設定
export function setCurrentPageIndex(index: number) {
  currentPageIndex = index;
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
  let isWarping = false;  // ワープ中フラグ
  let player: PlayerObject | null = null;

  // カメラのオフセット（横スクロール用）
  let cameraX = 0;

  // ワープ演出を実行してからシーン遷移
  function warpToPage(targetIndex: number, targetPath: string) {
    if (isWarping) return;
    isWarping = true;

    // 現在のページの状態を保存
    saveCurrentPageStates();

    // 履歴にプッシュ
    gameState.pushPage(targetPath);

    // フェードオーバーレイ
    const overlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.fixed(),
      k.z(100),
    ]);

    // ワープテキスト
    const warpText = k.add([
      k.text('WARP', { size: 32 }),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor('center'),
      k.color(0, 200, 255),
      k.opacity(0),
      k.fixed(),
      k.z(101),
    ]);

    // フェードアウト（0.3秒）
    k.tween(
      0,
      1,
      0.3,
      (val) => {
        overlay.opacity = val;
        warpText.opacity = val;
      },
      k.easings.easeOutQuad
    ).onEnd(() => {
      // ステージ遷移
      if (crawlData) {
        const newStage = loadStageFromCrawl(crawlData, targetIndex);
        setStage(newStage);
        setCurrentPageIndex(targetIndex);
        k.go('game');
      }
    });
  }

  // --- 背景描画 ---

  // サイトスタイルから背景色を取得
  function getSiteBackgroundColors(): { bg: [number, number, number]; grid: [number, number, number] } {
    const defaultBg: [number, number, number] = [20, 20, 30];
    const defaultGrid: [number, number, number] = [60, 80, 120];

    if (!crawlData?.siteStyle) {
      return { bg: defaultBg, grid: defaultGrid };
    }

    const style = crawlData.siteStyle;

    // 16進数をRGBに変換
    function hexToRgb(hex: string): [number, number, number] | null {
      const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!match) return null;
      return [
        parseInt(match[1], 16),
        parseInt(match[2], 16),
        parseInt(match[3], 16),
      ];
    }

    // プライマリカラーをベースに暗い背景を作成
    const primary = hexToRgb(style.primaryColor) || defaultGrid;

    // 背景: プライマリカラーを非常に暗くして青みを加える
    const bg: [number, number, number] = [
      Math.floor(primary[0] * 0.08) + 10,
      Math.floor(primary[1] * 0.08) + 10,
      Math.floor(primary[2] * 0.15) + 20,  // 青みを強調
    ];

    // グリッド: プライマリカラーを暗めに
    const grid: [number, number, number] = [
      Math.floor(primary[0] * 0.4),
      Math.floor(primary[1] * 0.4),
      Math.floor(primary[2] * 0.6),
    ];

    return { bg, grid };
  }

  const { bg, grid } = getSiteBackgroundColors();

  // ベース背景
  k.add([
    k.rect(stage.width, k.height()),
    k.pos(0, 0),
    k.color(...bg),
    k.z(-100),
  ]);

  // グリッドパターン（サイトの雰囲気を出す）
  const gridSize = 50;
  for (let x = 0; x < stage.width; x += gridSize) {
    k.add([
      k.rect(1, k.height()),
      k.pos(x, 0),
      k.color(...grid),
      k.opacity(0.5),
      k.z(-99),
    ]);
  }
  for (let y = 0; y < k.height(); y += gridSize) {
    k.add([
      k.rect(stage.width, 1),
      k.pos(0, y),
      k.color(...grid),
      k.opacity(0.5),
      k.z(-99),
    ]);
  }

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

  // 敵カウント更新（ハント数/全数）
  function updateEnemyCount() {
    const enemies = k.get('enemy') as EnemyObject[];
    const huntedCount = enemies.filter(e => e.isStopped()).length;
    const totalCount = enemies.length;
    enemyCountLabel.text = `Hunted: ${huntedCount}/${totalCount}`;
  }

  // ページクリア判定
  let pageCleared = false;
  function checkPageClear() {
    if (pageCleared) return;

    const enemies = k.get('enemy') as EnemyObject[];
    if (enemies.length === 0) return;

    const allStopped = enemies.every(e => e.isStopped());
    if (!allStopped) return;

    // ページクリア！
    pageCleared = true;
    const currentPath = crawlData?.pages[currentPageIndex]?.path || '/';

    // ターゲットページならクリア登録
    if (gameState.isTargetPage(currentPath)) {
      gameState.markPageCleared(currentPath);
    }

    // コンテンツパネルを更新（アンロック状態）
    const currentPage = crawlData?.pages[currentPageIndex];
    if (currentPage) {
      contentPanel.updateContent(currentPage, true);
      contentPanel.showPageClearEffect();
    }

    // ゲーム完了判定
    if (gameState.isGameComplete()) {
      setTimeout(() => {
        k.go('complete');
      }, 1000);
    }
  }

  // 現在のページの状態を保存（敵 + プレイヤーHP）
  function saveCurrentPageStates() {
    const currentPath = crawlData?.pages[currentPageIndex]?.path || '/';

    // 敵の状態
    const enemies = k.get('enemy') as EnemyObject[];
    const enemySnapshots: EnemySnapshot[] = enemies.map(e => ({
      id: e.getId(),
      type: e.getConfig().tag,
      x: e.pos.x,
      y: e.pos.y,
      hp: e.getHp(),
      stopped: e.isStopped(),
    }));

    gameState.savePageState(currentPath, enemySnapshots, pageCleared);

    // プレイヤーHPを保存
    if (player) {
      gameState.setPlayerHp(player.getState().hp);
    }
  }

  // 毎フレーム更新
  k.onUpdate(() => {
    if (!isPaused) {
      updateHpDisplay();
      updateEnemyCount();
      checkPageClear();

      // カメラの横スクロール（プレイヤー追従）
      if (player && stage.width > k.width()) {
        const targetX = Math.max(0, Math.min(player.pos.x - k.width() / 2, stage.width - k.width()));
        cameraX = targetX;
        k.camPos(k.width() / 2 + cameraX, k.height() / 2);
      }
    }
  });

  // --- プレイヤー生成（HPを復元）---
  const savedHp = gameState.getPlayerHp();
  player = createPlayer(k, stage.width, savedHp);

  // --- 敵生成（保存状態があれば復元）---
  const currentPath = crawlData?.pages[currentPageIndex]?.path || '/';
  const savedState = gameState.loadPageState(currentPath);

  if (savedState && savedState.enemies.length > 0) {
    // 保存された敵状態を復元
    pageCleared = savedState.cleared;
    savedState.enemies.forEach((snapshot) => {
      const enemy = createEnemy(
        k,
        snapshot.type,
        snapshot.x,
        snapshot.y,
        () => player,
        stage.width
      );
      if (enemy) {
        enemy.setInitialState(snapshot.hp, snapshot.stopped, snapshot.x, snapshot.y);
      }
    });
  } else {
    // 新規生成
    stage.enemies.forEach((enemyData) => {
      createEnemy(
        k,
        enemyData.type,
        enemyData.x,
        enemyData.y,
        () => player,
        stage.width,
        enemyData.sampleText,
        enemyData.sampleImageUrl
      );
    });
  }

  // --- コンテンツパネル初期更新 ---
  const currentPage = crawlData?.pages[currentPageIndex];
  if (currentPage) {
    contentPanel.updateContent(currentPage, pageCleared);
  }

  // --- ポータル生成 ---
  stage.portals.forEach((portalData) => {
    // 訪問済みかどうかを判定（ページ状態が保存されていれば訪問済み）
    const isVisited = gameState.hasPageState(portalData.link);
    createPortal(
      k,
      portalData.link,
      portalData.targetPageIndex,
      portalData.x,
      portalData.y,
      stage.width,
      isVisited,
      portalData.pageTitle
    );
  });

  // --- トップに戻るポータル生成 ---
  k.add([
    k.text('[TOP]', { size: 24 }),
    k.pos(stage.goalX, k.height() / 2),
    k.area({ shape: new k.Rect(k.vec2(-30, -50), 60, 100) }),
    k.anchor('center'),
    k.color(255, 200, 100),
    'top-portal',
  ]);

  // --- 衝突判定 ---

  // プレイヤー vs 敵（停止した敵は無害）
  k.onCollide('player', 'enemy', (_p, e) => {
    const enemy = e as EnemyObject;
    if (player && !enemy.isStopped()) {
      const config = enemy.getConfig();
      player.takeDamage(config.damage);
    }
  });

  // 剣 vs 敵
  k.onCollide('sword', 'enemy', (_s, e) => {
    (e as EnemyObject).takeDamage(1);
  });

  // 剣 vs ポータル（アクセス可能）→ ページ遷移
  k.onCollide('sword', 'portal-accessible', (_s, portal) => {
    const portalObj = portal as PortalObject;
    const targetIndex = portalObj.getTargetPageIndex();

    if (targetIndex !== null && crawlData) {
      const targetPath = crawlData.pages[targetIndex]?.path || '/';
      warpToPage(targetIndex, targetPath);
    }
  });

  // プレイヤー vs トップポータル（常にトップページに戻る）
  k.onCollide('player', 'top-portal', () => {
    // 既にトップページにいる場合は何もしない
    if (currentPageIndex === 0) {
      messageLabel.text = 'Already at top page';
      messageLabel.opacity = 1;
      if (messageTimeout) clearTimeout(messageTimeout);
      messageTimeout = setTimeout(() => {
        messageLabel.opacity = 0;
      }, 2000);
      return;
    }

    // ワープ演出付きで遷移
    warpToPage(0, '/');
  });

  // プレイヤー vs ポータル - 何も起きない（剣で叩く必要あり）

  // メッセージ表示用
  let messageTimeout: ReturnType<typeof setTimeout> | null = null;
  const messageLabel = k.add([
    k.text(' ', { size: 16 }),  // 空文字だとエラーになるのでスペース
    k.pos(k.width() / 2, k.height() - 40),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(0),  // 初期は非表示
    k.fixed(),
  ]);

  k.onCollide('player', 'portal-inaccessible', (_p, portal) => {
    const portalObj = portal as PortalObject;
    const link = portalObj.getLink();

    messageLabel.text = `${link} is not crawled`;
    messageLabel.opacity = 1;

    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      messageLabel.opacity = 0;
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
