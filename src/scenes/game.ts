import type { KaboomCtx } from 'kaboom';
import { createPlayer, type PlayerObject } from '../entities/player';
import { createEnemy, type EnemyObject } from '../entities/enemy';
import { createBoss, destroyBoss, type BossObject } from '../entities/boss';
import { createPortal, type PortalObject } from '../entities/portal';
import type { StageConfig, CrawlOutput, EnemySnapshot } from '../types';
import { loadStageFromCrawl } from '../systems/stageLoader';
import { gameState } from '../systems/gameState';
import { contentPanel } from '../ui/ContentPanel';
import { playWarpSound, playPageClearSound, playGameClearSound, playBossWarningSound, startBossLoopSound, stopBossLoopSound } from '../systems/sound';
import { isTouchDevice, getVirtualJoystick, type VirtualJoystick } from '../ui/VirtualJoystick';

// 現在のステージ設定（外部から設定可能）
let currentStage: StageConfig | null = null;
let crawlData: CrawlOutput | null = null;
let currentPageIndex: number = 0;

// ゲームのポーズ状態（各エンティティから参照可能）
let gamePaused = false;

export function isGamePaused(): boolean {
  return gamePaused;
}

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
  boss: null,
  goalX: 770,
};

export function gameScene(k: KaboomCtx) {
  // ステージ設定を取得（設定されていなければデフォルト）
  const stage = currentStage || DEFAULT_STAGE;

  // ゲーム状態（グローバル変数を初期化）
  gamePaused = false;
  let isWarping = false;  // ワープ中フラグ
  let player: PlayerObject | null = null;
  let boss: BossObject | null = null;  // ボスオブジェクト
  let bossSpawned = false;  // ボスが出現済みか

  // カメラのオフセット（横スクロール用）
  let cameraX = 0;

  // タッチデバイス用仮想ジョイスティック
  let virtualJoystick: VirtualJoystick | null = null;
  if (isTouchDevice()) {
    virtualJoystick = getVirtualJoystick(k);
    virtualJoystick.create();
  }

  // ワープ演出を実行してからシーン遷移
  function warpToPage(targetIndex: number, targetPath: string) {
    if (isWarping) return;
    isWarping = true;

    // ワープ音
    playWarpSound();

    // ボスループSE停止
    stopBossLoopSound();

    // 現在のページの状態を保存
    saveCurrentPageStates();

    // ボスを破棄
    destroyBoss(boss);
    boss = null;

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

    // 背景: プライマリカラーを非常に暗くする（色味を維持）
    const bg: [number, number, number] = [
      Math.floor(primary[0] * 0.12) + 10,
      Math.floor(primary[1] * 0.10) + 10,
      Math.floor(primary[2] * 0.10) + 15,
    ];

    // グリッド: プライマリカラーを暗めに（色味を維持）
    const grid: [number, number, number] = [
      Math.floor(primary[0] * 0.5),
      Math.floor(primary[1] * 0.4),
      Math.floor(primary[2] * 0.4),
    ];

    return { bg, grid };
  }

  const { bg, grid } = getSiteBackgroundColors();

  // 明るい背景色（クリア時用）
  const brightBg: [number, number, number] = [
    Math.min(255, bg[0] + 60),
    Math.min(255, bg[1] + 60),
    Math.min(255, bg[2] + 40),
  ];
  const brightGrid: [number, number, number] = [
    Math.min(255, grid[0] + 80),
    Math.min(255, grid[1] + 80),
    Math.min(255, grid[2] + 60),
  ];

  // ベース背景
  const bgRect = k.add([
    k.rect(stage.width, k.height()),
    k.pos(0, 0),
    k.color(...bg),
    k.z(-100),
    'background',
  ]);

  // グリッドパターン（サイトの雰囲気を出す）
  const gridSize = 50;
  type GridLine = ReturnType<typeof k.add> & { color: ReturnType<typeof k.rgb>; opacity: number };
  const gridLines: GridLine[] = [];
  for (let x = 0; x < stage.width; x += gridSize) {
    const line = k.add([
      k.rect(1, k.height()),
      k.pos(x, 0),
      k.color(...grid),
      k.opacity(0.5),
      k.z(-99),
      'grid-line',
    ]) as GridLine;
    gridLines.push(line);
  }
  for (let y = 0; y < k.height(); y += gridSize) {
    const line = k.add([
      k.rect(stage.width, 1),
      k.pos(0, y),
      k.color(...grid),
      k.opacity(0.5),
      k.z(-99),
      'grid-line',
    ]) as GridLine;
    gridLines.push(line);
  }

  // 背景を明るくする演出
  function brightenBackground() {
    // 背景色をアニメーション
    k.tween(
      0, 1, 0.5,
      (t) => {
        bgRect.color = k.rgb(
          bg[0] + (brightBg[0] - bg[0]) * t,
          bg[1] + (brightBg[1] - bg[1]) * t,
          bg[2] + (brightBg[2] - bg[2]) * t
        );
      },
      k.easings.easeOutQuad
    );

    // グリッド色もアニメーション
    gridLines.forEach(line => {
      k.tween(
        0, 1, 0.5,
        (t) => {
          line.color = k.rgb(
            grid[0] + (brightGrid[0] - grid[0]) * t,
            grid[1] + (brightGrid[1] - grid[1]) * t,
            grid[2] + (brightGrid[2] - grid[2]) * t
          );
          line.opacity = 0.5 + 0.3 * t;  // グリッドも明るく
        },
        k.easings.easeOutQuad
      );
    });
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

  // 現在のページURL表示（下部に配置）
  const currentPagePath = crawlData?.pages[currentPageIndex]?.path || '/';
  const fullUrl = crawlData ? `${crawlData.baseUrl}${currentPagePath}` : stage.name;
  // 長すぎるURLは末尾を省略
  const maxUrlLen = 70;
  const displayUrl = fullUrl.length > maxUrlLen ? fullUrl.slice(0, maxUrlLen) + '...' : fullUrl;
  k.add([
    k.text(displayUrl, { size: 10 }),
    k.pos(k.width() / 2, k.height() - 10),
    k.anchor('bot'),
    k.color(100, 180, 220),
    k.fixed(),
  ]);

  // HP表示更新
  function updateHpDisplay() {
    if (!player) return;
    const state = player.getState();
    const hp = Math.max(0, state.hp);
    const hearts = '*'.repeat(hp) + '-'.repeat(state.maxHp - hp);
    hpLabel.text = `HP: ${hearts}`;
  }

  // 敵カウント更新（ハント数/全数）- ボス出現後のみボスを含める
  function updateEnemyCount() {
    const enemies = k.get('enemy') as EnemyObject[];
    const huntedCount = enemies.filter(e => e.isStopped()).length;
    const totalCount = enemies.length;

    // ボスが出現済みの場合のみカウントに含める
    if (bossSpawned && boss) {
      const bossHunted = boss.isStopped() ? 1 : 0;
      enemyCountLabel.text = `HUNTED: ${huntedCount + bossHunted}/${totalCount + 1}`;
    } else {
      enemyCountLabel.text = `HUNTED: ${huntedCount}/${totalCount}`;
    }
  }

  // ページクリア判定（2段階制: 通常敵 → ボス）
  let pageCleared = false;
  let bossWarningShown = false;  // WARNING演出中フラグ

  function checkPageClear() {
    if (pageCleared) return;

    const enemies = k.get('enemy') as EnemyObject[];

    // 通常敵が全て停止しているか
    const allEnemiesStopped = enemies.length === 0 || enemies.every(e => e.isStopped());

    // フェーズ1: 通常敵を全て倒したらボス出現
    if (allEnemiesStopped && !bossSpawned && stage.boss && !bossWarningShown) {
      bossWarningShown = true;
      showBossWarning(() => {
        bossSpawned = true;
        boss = createBoss(k, stage.boss!, () => player, stage.width);
      });
      return;
    }

    // ボス出現条件を満たさないページ、または既にボスを倒した場合
    // ボスがいないページは通常敵だけでクリア
    const hasBoss = stage.boss !== null;
    const bossDefeated = !hasBoss || (bossSpawned && boss && boss.isStopped());

    // 敵もボスもいない場合はスキップ
    if (enemies.length === 0 && !hasBoss) return;

    if (!allEnemiesStopped || !bossDefeated) return;

    // ページクリア！
    pageCleared = true;
    const currentPath = crawlData?.pages[currentPageIndex]?.path || '/';

    // ページクリア音
    playPageClearSound();

    // 背景を明るくする演出
    brightenBackground();

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
      playGameClearSound();
      setTimeout(() => {
        k.go('complete');
      }, 1000);
    }
  }

  // ボス出現WARNING演出
  function showBossWarning(onComplete: () => void) {
    // 一時停止
    gamePaused = true;

    // 警告SE開始
    playBossWarningSound();

    // 暗いオーバーレイ
    const overlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.fixed(),
      k.z(50),
      'bossWarning',
    ]);

    // WARNING!テキスト
    const warning = k.add([
      k.text('WARNING!', { size: 48 }),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor('center'),
      k.color(255, 50, 50),
      k.opacity(0),
      k.fixed(),
      k.z(51),
      'bossWarning',
    ]);

    // フェードイン
    k.tween(0, 0.7, 0.3, (val) => {
      overlay.opacity = val;
    });
    k.tween(0, 1, 0.3, (val) => {
      warning.opacity = val;
    });

    // 点滅アニメーション
    let blinkTime = 0;
    const blinkHandler = warning.onUpdate(() => {
      blinkTime += k.dt() * 8;
      warning.opacity = 0.5 + Math.sin(blinkTime) * 0.5;
    });

    // 2秒後にボス出現
    k.wait(2.0, () => {
      blinkHandler.cancel();

      // フェードアウト
      k.tween(overlay.opacity, 0, 0.3, (val) => {
        overlay.opacity = val;
      });
      k.tween(warning.opacity, 0, 0.3, (val) => {
        warning.opacity = val;
      }).onEnd(() => {
        k.get('bossWarning').forEach(obj => k.destroy(obj));
        gamePaused = false;

        // ボスループSE開始
        startBossLoopSound();

        onComplete();
      });
    });
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
      sampleText: e.getSampleText(),
      sampleImageUrl: e.getSampleImageUrl(),
    }));

    gameState.savePageState(currentPath, enemySnapshots, pageCleared);

    // プレイヤーHPを保存
    if (player) {
      gameState.setPlayerHp(player.getState().hp);
    }
  }

  // 毎フレーム更新
  k.onUpdate(() => {
    if (!gamePaused) {
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

  // タッチ入力取得関数
  const getTouchInput = virtualJoystick
    ? () => virtualJoystick!.getState()
    : undefined;

  player = createPlayer(k, stage.width, savedHp, getTouchInput);

  // --- 敵生成（保存状態があれば復元）---
  const currentPath = crawlData?.pages[currentPageIndex]?.path || '/';
  const savedState = gameState.loadPageState(currentPath);

  if (savedState && savedState.enemies.length > 0) {
    // 保存された敵状態を復元
    pageCleared = savedState.cleared;

    // クリア済みの場合は背景を即座に明るくする
    if (pageCleared) {
      bgRect.color = k.rgb(...brightBg);
      gridLines.forEach(line => {
        line.color = k.rgb(...brightGrid);
        line.opacity = 0.8;
      });
    }

    savedState.enemies.forEach((snapshot) => {
      const enemy = createEnemy(
        k,
        snapshot.type,
        snapshot.x,
        snapshot.y,
        () => player,
        stage.width,
        snapshot.sampleText,
        snapshot.sampleImageUrl
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

  // --- ボス生成は通常敵を全て倒した後 ---
  // (checkPageClear内で行う)

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
      portalData.pageTitle,
      portalData.isTarget,
      portalData.leadsToTarget
    );
  });

  // --- トップに戻るポータル生成（トップページ以外で表示） ---
  if (currentPageIndex !== 0) {
    const topPortal = k.add([
      k.text('[TOP]', { size: 16 }),
      k.pos(stage.width - 40, k.height() / 2),
      k.area({ shape: new k.Rect(k.vec2(-25, -15), 50, 30) }),
      k.anchor('center'),
      k.color(0, 200, 255),  // 水色（ポータルと同じ）
      k.opacity(1),
      'top-portal',
    ]);

    // 点滅アニメーション（ポータルと同じ）
    let topPortalTime = 0;
    topPortal.onUpdate(() => {
      if (gamePaused) return;
      topPortalTime += k.dt() * 3;
      topPortal.opacity = 0.7 + Math.sin(topPortalTime * 1.5) * 0.3;
    });
  }

  // --- 衝突判定 ---

  // プレイヤー vs 敵（停止した敵は無害）
  k.onCollide('player', 'enemy', (_p, e) => {
    const enemy = e as EnemyObject;
    if (player && !enemy.isStopped()) {
      const config = enemy.getConfig();
      player.takeDamage(config.damage);
    }
  });

  // プレイヤー vs ボスパーツ
  k.onCollide('player', 'bossPart', () => {
    if (player && boss && !boss.isStopped()) {
      player.takeDamage(2);  // ボスは2ダメージ
    }
  });

  // 剣 vs 敵（通常レーザー）
  k.onCollide('sword', 'enemy', (s, e) => {
    const enemy = e as EnemyObject;
    const laserData = s as unknown as { damage?: number };
    const damage = laserData.damage || 1;
    enemy.takeDamage(damage);
  });

  // 剣 vs ボスパーツ（通常レーザー）
  k.onCollide('sword', 'bossPart', (s) => {
    if (boss && !boss.isStopped()) {
      const laserData = s as unknown as { damage?: number };
      const damage = laserData.damage || 1;
      boss.takeDamage(damage);
    }
  });

  // 貫通レーザー vs 敵（同じ敵には1回だけダメージ）
  k.onCollide('sword-piercing', 'enemy', (s, e) => {
    const enemy = e as EnemyObject;
    const enemyId = enemy.getId();
    const laserData = s as unknown as { hitEnemies: Set<string>; damage: number; killedEnemies: Set<string> };

    // 既にこの敵にヒットしていたらスキップ
    if (laserData.hitEnemies.has(enemyId)) return;

    // ヒット記録
    laserData.hitEnemies.add(enemyId);

    // 倒す前のHP
    const beforeHp = enemy.getHp();
    enemy.takeDamage(laserData.damage);
    const afterHp = enemy.getHp();

    // 倒したらキルセットに追加
    if (beforeHp > 0 && afterHp <= 0) {
      laserData.killedEnemies.add(enemyId);
    }
  });

  // 貫通レーザー vs ボスパーツ（1回だけダメージ）
  k.onCollide('sword-piercing', 'bossPart', (s) => {
    if (!boss || boss.isStopped()) return;

    const laserData = s as unknown as { hitEnemies: Set<string>; damage: number };

    // ボス用のヒット判定（ボスは1つなので固定ID）
    const bossId = 'boss';
    if (laserData.hitEnemies.has(bossId)) return;

    laserData.hitEnemies.add(bossId);
    boss.takeDamage(laserData.damage);
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

  // 貫通レーザー vs ポータル（アクセス可能）→ ページ遷移
  k.onCollide('sword-piercing', 'portal-accessible', (_s, portal) => {
    const portalObj = portal as PortalObject;
    const targetIndex = portalObj.getTargetPageIndex();

    if (targetIndex !== null && crawlData) {
      const targetPath = crawlData.pages[targetIndex]?.path || '/';
      warpToPage(targetIndex, targetPath);
    }
  });

  // 剣 vs トップポータル（レーザーでトップページに戻る）
  k.onCollide('sword', 'top-portal', () => {
    warpToPage(0, '/');
  });

  // 貫通レーザー vs トップポータル
  k.onCollide('sword-piercing', 'top-portal', () => {
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
  function togglePause() {
    gamePaused = !gamePaused;

    if (gamePaused) {
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

      const resumeText = isTouchDevice() ? 'Tap pause button to resume' : 'Press ESC to resume';
      k.add([
        k.text(resumeText, { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 60),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.fixed(),
        'pauseOverlay',
      ]);
    } else {
      k.get('pauseOverlay').forEach((obj) => k.destroy(obj));
    }
  }

  k.onKeyPress('escape', togglePause);

  // タッチ: ポーズボタン監視
  if (virtualJoystick) {
    k.onUpdate(() => {
      const touchInput = virtualJoystick!.getState();
      if (touchInput.pausePressed) {
        virtualJoystick!.clearPausePressed();
        togglePause();
      }
      // firePressed をクリア（使用後）
      if (touchInput.firePressed) {
        virtualJoystick!.clearFirePressed();
      }
    });
  }
}
