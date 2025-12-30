import type { KaboomCtx } from 'kaboom';
import { playSelectSound, playStartSound } from '../systems/sound';
import { isTouchDevice, getVirtualJoystick, clearVirtualJoystick, type VirtualJoystick } from '../ui/VirtualJoystick';
import { contentPanel } from '../ui/ContentPanel';
import type { SiteInfo } from '../data/siteLoader';

// 方向に対応するベクトル
const DIRECTION_VECTORS: Record<string, { x: number; y: number }> = {
  'up': { x: 0, y: -1 },
  'down': { x: 0, y: 1 },
  'left': { x: -1, y: 0 },
  'right': { x: 1, y: 0 },
  'up-left': { x: -0.707, y: -0.707 },
  'up-right': { x: 0.707, y: -0.707 },
  'down-left': { x: -0.707, y: 0.707 },
  'down-right': { x: 0.707, y: 0.707 },
};

const DIRECTIONS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];

export type GameMode = 'easy' | 'normal';
type SelectionPhase = 'site' | 'mode';

export function titleScene(
  k: KaboomCtx,
  sites: SiteInfo[],
  onStart: (sitePath: string, mode: GameMode) => void
) {
  // 選択状態
  let phase: SelectionPhase = 'site';
  let selectedSiteIndex = 0;
  let selectedMode: GameMode = 'normal';
  let isStarting = false;

  // サイトが1つしかない場合は直接モード選択へ
  if (sites.length === 1) {
    phase = 'mode';
    selectedSiteIndex = 0;
  }

  // コンテンツパネルにストーリー画面を表示（サイト選択中も常にストーリー）
  function updateContentPanel() {
    contentPanel.showTitleScreen(sites[selectedSiteIndex].name);
  }
  updateContentPanel();

  // 背景（ベース）
  k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(20, 20, 30),
    k.z(-100),
  ]);

  // グリッドパターン（ゲームと同じ）
  const gridSize = 50;
  for (let x = 0; x < k.width(); x += gridSize) {
    k.add([
      k.rect(1, k.height()),
      k.pos(x, 0),
      k.color(60, 80, 120),
      k.opacity(0.3),
      k.z(-99),
    ]);
  }
  for (let y = 0; y < k.height(); y += gridSize) {
    k.add([
      k.rect(k.width(), 1),
      k.pos(0, y),
      k.color(60, 80, 120),
      k.opacity(0.3),
      k.z(-99),
    ]);
  }

  // --- デモ用ハンター（AI操作）---
  const demoShip = k.add([
    k.polygon([
      k.vec2(16, 0),
      k.vec2(-12, 10),
      k.vec2(-6, 0),
      k.vec2(-12, -10),
    ]),
    k.pos(k.width() / 2, k.height() / 2 + 100),
    k.anchor('center'),
    k.color(100, 200, 255),
    k.rotate(0),
    k.opacity(0.6),
    k.z(-50),
  ]);

  // スラスター
  const demoThruster = k.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(-12, 5),
      k.vec2(-12, -5),
    ]),
    k.pos(demoShip.pos.x - 6, demoShip.pos.y),
    k.anchor('center'),
    k.color(255, 150, 50),
    k.rotate(0),
    k.opacity(0.4),
    k.z(-51),
  ]);

  // AI状態
  let aiDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  let aiSpeed = 0;
  let aiTargetSpeed = 80 + Math.random() * 60;
  let aiChangeTimer = 2 + Math.random() * 2;
  let aiFireTimer = 0.5 + Math.random() * 1;

  demoShip.onUpdate(() => {
    const dt = k.dt();

    // 方向変更タイマー
    aiChangeTimer -= dt;
    if (aiChangeTimer <= 0) {
      aiDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      aiTargetSpeed = 60 + Math.random() * 80;
      aiChangeTimer = 1.5 + Math.random() * 2;
    }

    // 速度を目標に近づける
    if (aiSpeed < aiTargetSpeed) {
      aiSpeed = Math.min(aiSpeed + 100 * dt, aiTargetSpeed);
    } else {
      aiSpeed = Math.max(aiSpeed - 50 * dt, aiTargetSpeed);
    }

    // 移動
    const dir = DIRECTION_VECTORS[aiDirection];
    demoShip.pos.x += dir.x * aiSpeed * dt;
    demoShip.pos.y += dir.y * aiSpeed * dt;

    // 画面端で反射
    const margin = 50;
    if (demoShip.pos.x < margin) {
      demoShip.pos.x = margin;
      if (dir.x < 0) {
        aiDirection = aiDirection.replace('left', 'right') as typeof aiDirection;
      }
    }
    if (demoShip.pos.x > k.width() - margin) {
      demoShip.pos.x = k.width() - margin;
      if (dir.x > 0) {
        aiDirection = aiDirection.replace('right', 'left') as typeof aiDirection;
      }
    }
    if (demoShip.pos.y < margin + 180) {
      demoShip.pos.y = margin + 180;
      if (dir.y < 0) {
        aiDirection = aiDirection.replace('up', 'down') as typeof aiDirection;
      }
    }
    if (demoShip.pos.y > k.height() - margin) {
      demoShip.pos.y = k.height() - margin;
      if (dir.y > 0) {
        aiDirection = aiDirection.replace('down', 'up') as typeof aiDirection;
      }
    }

    // 回転
    const targetAngle = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    let angleDiff = targetAngle - demoShip.angle;
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;
    demoShip.angle += angleDiff * 5 * dt;

    // スラスター位置更新
    const angleRad = demoShip.angle * (Math.PI / 180);
    demoThruster.pos.x = demoShip.pos.x - Math.cos(angleRad) * 10;
    demoThruster.pos.y = demoShip.pos.y - Math.sin(angleRad) * 10;
    demoThruster.angle = demoShip.angle;

    // スラスターの明滅
    const speedRatio = aiSpeed / 140;
    demoThruster.opacity = 0.3 + speedRatio * 0.4 + Math.sin(k.time() * 15) * 0.1;

    // レーザー発射
    aiFireTimer -= dt;
    if (aiFireTimer <= 0 && aiSpeed > 40) {
      fireDemoLaser(k, demoShip.pos.x, demoShip.pos.y, demoShip.angle, speedRatio);
      aiFireTimer = 0.3 + Math.random() * 0.5;
    }
  });

  // タイトルロゴ
  k.add([
    k.text('E L E M E N T', { size: 48 }),
    k.pos(k.width() / 2, 80),
    k.anchor('center'),
    k.color(0, 200, 255),
  ]);

  k.add([
    k.text('H U N T E R', { size: 48 }),
    k.pos(k.width() / 2, 140),
    k.anchor('center'),
    k.color(255, 200, 100),
  ]);

  const isTouch = isTouchDevice();
  const centerX = k.width() / 2;

  // === サイト選択UI ===
  const siteSelectContainer: ReturnType<typeof k.add>[] = [];

  function createSiteSelectUI() {
    // クリア
    siteSelectContainer.forEach(obj => k.destroy(obj));
    siteSelectContainer.length = 0;

    let yOffset = 190;

    // ヘッダー
    siteSelectContainer.push(k.add([
      k.text('── SELECT STAGE ──', { size: 14 }),
      k.pos(centerX, yOffset),
      k.anchor('center'),
      k.color(100, 200, 255),
    ]));
    yOffset += 35;

    // サイト一覧
    sites.forEach((site, index) => {
      const isSelected = index === selectedSiteIndex;
      const yPos = yOffset + index * 45;

      // サイト名を全文表示
      const displayName = site.name;

      // 選択中の背景
      if (isSelected) {
        siteSelectContainer.push(k.add([
          k.rect(700, 36, { radius: 4 }),
          k.pos(centerX, yPos),
          k.anchor('center'),
          k.color(40, 50, 70),
          k.outline(1, k.rgb(100, 150, 255)),
          k.opacity(0.8),
        ]));
      }

      // サイト名（中央寄せ）
      siteSelectContainer.push(k.add([
        k.text(displayName, { size: 12 }),
        k.pos(centerX, yPos - 5),
        k.anchor('center'),
        k.color(isSelected ? 255 : 150, isSelected ? 200 : 150, isSelected ? 100 : 150),
        k.opacity(isSelected ? 1 : 0.5),
      ]));

      // ページ数（中央寄せ）
      siteSelectContainer.push(k.add([
        k.text(`${site.pageCount} pages`, { size: 9 }),
        k.pos(centerX, yPos + 10),
        k.anchor('center'),
        k.color(100, 150, 200),
        k.opacity(isSelected ? 0.8 : 0.4),
      ]));
    });

    // 操作説明
    const helpY = yOffset + sites.length * 45 + 20;
    siteSelectContainer.push(k.add([
      k.text(isTouch ? '[↑↓: SELECT]  [FIRE: OK]' : '[↑↓: SELECT]  [SPACE: OK]', { size: 12 }),
      k.pos(centerX, helpY),
      k.anchor('center'),
      k.color(100, 100, 100),
    ]));
  }

  // === モード選択UI ===
  const modeSelectContainer: ReturnType<typeof k.add>[] = [];

  function createModeSelectUI() {
    // クリア
    modeSelectContainer.forEach(obj => k.destroy(obj));
    modeSelectContainer.length = 0;

    let yOffset = 190;

    // 選択されたサイト表示（全文）
    const siteName = sites[selectedSiteIndex].name;
    modeSelectContainer.push(k.add([
      k.text(`STAGE: ${siteName}`, { size: 11 }),
      k.pos(centerX, yOffset),
      k.anchor('center'),
      k.color(100, 200, 255),
    ]));
    yOffset += 30;

    // マニュアルパネル背景
    const panelWidth = 340;
    const panelHeight = 120;
    modeSelectContainer.push(k.add([
      k.rect(panelWidth, panelHeight, { radius: 8 }),
      k.pos(centerX, yOffset + panelHeight / 2),
      k.anchor('center'),
      k.color(30, 30, 45),
      k.opacity(0.8),
      k.outline(2, k.rgb(60, 80, 120)),
    ]));

    // ヘッダー
    modeSelectContainer.push(k.add([
      k.text("HUNTER'S MANUAL", { size: 12 }),
      k.pos(centerX, yOffset + 12),
      k.anchor('center'),
      k.color(100, 200, 255),
    ]));

    // 区切り線
    modeSelectContainer.push(k.add([
      k.rect(panelWidth - 40, 1),
      k.pos(centerX, yOffset + 28),
      k.anchor('center'),
      k.color(60, 80, 120),
      k.opacity(0.5),
    ]));

    // 操作説明（2列レイアウト）
    const col1X = centerX - 80;
    const col2X = centerX + 80;
    let rowY = yOffset + 48;

    // MOVE
    modeSelectContainer.push(k.add([
      k.text('MOVE', { size: 14 }),
      k.pos(col1X, rowY),
      k.anchor('center'),
      k.color(255, 200, 100),
    ]));
    modeSelectContainer.push(k.add([
      k.text(isTouch ? 'STICK' : 'ARROW KEYS', { size: 10 }),
      k.pos(col1X, rowY + 16),
      k.anchor('center'),
      k.color(150, 150, 150),
    ]));

    // FIRE
    modeSelectContainer.push(k.add([
      k.text('FIRE', { size: 14 }),
      k.pos(col2X, rowY),
      k.anchor('center'),
      k.color(255, 100, 100),
    ]));
    modeSelectContainer.push(k.add([
      k.text(isTouch ? 'BUTTON' : 'SPACE KEY', { size: 10 }),
      k.pos(col2X, rowY + 16),
      k.anchor('center'),
      k.color(150, 150, 150),
    ]));

    // HINTS セクション
    rowY += 40;
    modeSelectContainer.push(k.add([
      k.rect(panelWidth - 40, 1),
      k.pos(centerX, rowY - 8),
      k.anchor('center'),
      k.color(60, 80, 120),
      k.opacity(0.3),
    ]));

    // HINT
    modeSelectContainer.push(k.add([
      k.text('SHOOT PORTALS TO WARP  /  SPEED = POWER!', { size: 9 }),
      k.pos(centerX, rowY + 4),
      k.anchor('center'),
      k.color(150, 150, 150),
    ]));

    yOffset += panelHeight + 15;

    // --- モード選択UI ---
    modeSelectContainer.push(k.add([
      k.text('SELECT MODE TO START', { size: 14 }),
      k.pos(centerX, yOffset),
      k.anchor('center'),
      k.color(150, 150, 150),
    ]));
    yOffset += 25;

    // モード選択肢
    const modeSpacing = 140;
    const easyButtonX = centerX - modeSpacing / 2;
    const easyLabel = k.add([
      k.text('EASY', { size: 18 }),
      k.pos(easyButtonX, yOffset),
      k.anchor('center'),
      k.color(100, 200, 100),
      k.opacity(selectedMode === 'easy' ? 1 : 0.5),
    ]);
    modeSelectContainer.push(easyLabel);

    const easyDesc = k.add([
      k.text('3 PAGES', { size: 10 }),
      k.pos(easyButtonX, yOffset + 18),
      k.anchor('center'),
      k.color(100, 200, 100),
      k.opacity(selectedMode === 'easy' ? 0.7 : 0.4),
    ]);
    modeSelectContainer.push(easyDesc);

    const normalButtonX = centerX + modeSpacing / 2;
    const normalLabel = k.add([
      k.text('NORMAL', { size: 18 }),
      k.pos(normalButtonX, yOffset),
      k.anchor('center'),
      k.color(255, 200, 100),
      k.opacity(selectedMode === 'normal' ? 1 : 0.5),
    ]);
    modeSelectContainer.push(normalLabel);

    const normalDesc = k.add([
      k.text('5 PAGES', { size: 10 }),
      k.pos(normalButtonX, yOffset + 18),
      k.anchor('center'),
      k.color(255, 200, 100),
      k.opacity(selectedMode === 'normal' ? 0.7 : 0.4),
    ]);
    modeSelectContainer.push(normalDesc);

    // 選択カーソル（矢印）
    const cursorX = selectedMode === 'easy' ? easyButtonX : normalButtonX;
    const cursorOffset = selectedMode === 'easy' ? 40 : 50;
    const cursorLeft = k.add([
      k.text('>', { size: 20 }),
      k.pos(cursorX - cursorOffset, yOffset),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.opacity(1),
      'mode-cursor-left',
    ]);
    modeSelectContainer.push(cursorLeft);

    const cursorRight = k.add([
      k.text('<', { size: 20 }),
      k.pos(cursorX + cursorOffset, yOffset),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.opacity(1),
      'mode-cursor-right',
    ]);
    modeSelectContainer.push(cursorRight);

    yOffset += 50;

    // "PRESS SPACE TO START"
    const startLabelText = isTouch ? '' : '[ PRESS SPACE TO START ]';
    const startLabel = k.add([
      k.text(startLabelText, { size: 18 }),
      k.pos(centerX, yOffset),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.opacity(isTouch ? 0 : 1),
    ]);
    modeSelectContainer.push(startLabel);

    // 点滅アニメーション（PC用）
    if (!isTouch) {
      let blinkTime = 0;
      startLabel.onUpdate(() => {
        blinkTime += k.dt();
        startLabel.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(blinkTime * 4));
      });
    }
  }

  // 初期UI作成
  if (phase === 'site') {
    createSiteSelectUI();
  } else {
    createModeSelectUI();
  }

  // カーソル点滅処理
  k.onUpdate(() => {
    const cursors = k.get('mode-cursor-left').concat(k.get('mode-cursor-right'));
    const opacity = 0.5 + 0.5 * Math.sin(k.time() * 6);
    cursors.forEach(c => c.opacity = opacity);
  });

  // タッチ操作: 仮想ジョイスティック
  let titleJoystick: VirtualJoystick | null = null;
  if (isTouch) {
    clearVirtualJoystick();
    titleJoystick = getVirtualJoystick(k);
    titleJoystick.create();
  }

  // フェーズ遷移
  function switchToModeSelect() {
    phase = 'mode';
    siteSelectContainer.forEach(obj => k.destroy(obj));
    siteSelectContainer.length = 0;
    createModeSelectUI();
    updateContentPanel();
    playSelectSound();
  }

  // サイト選択更新
  function updateSiteSelection(delta: number) {
    const newIndex = selectedSiteIndex + delta;
    if (newIndex >= 0 && newIndex < sites.length) {
      selectedSiteIndex = newIndex;
      createSiteSelectUI();
      updateContentPanel();
      playSelectSound();
    }
  }

  // モード選択更新
  function updateModeSelection(mode: GameMode) {
    if (selectedMode !== mode) {
      selectedMode = mode;
      createModeSelectUI();
      playSelectSound();
    }
  }

  // ゲーム開始処理
  function startGame() {
    if (isStarting) return;
    isStarting = true;
    playStartSound();

    // タイトル画面の仮想ジョイスティックを削除
    if (titleJoystick) {
      titleJoystick.destroy();
      clearVirtualJoystick();
    }

    // フェードアウト演出
    const overlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.z(100),
    ]);

    k.tween(
      0,
      1,
      0.3,
      (val) => {
        overlay.opacity = val;
      },
      k.easings.easeOutQuad
    ).onEnd(() => {
      onStart(sites[selectedSiteIndex].path, selectedMode);
    });
  }

  // キーボード入力
  k.onKeyPress('up', () => {
    if (isStarting) return;
    if (phase === 'site') {
      updateSiteSelection(-1);
    }
  });

  k.onKeyPress('down', () => {
    if (isStarting) return;
    if (phase === 'site') {
      updateSiteSelection(1);
    }
  });

  k.onKeyPress('left', () => {
    if (isStarting) return;
    if (phase === 'mode') {
      updateModeSelection('easy');
    }
  });

  k.onKeyPress('right', () => {
    if (isStarting) return;
    if (phase === 'mode') {
      updateModeSelection('normal');
    }
  });

  k.onKeyPress('space', () => {
    if (isStarting) return;
    if (phase === 'site') {
      switchToModeSelect();
    } else {
      startGame();
    }
  });

  k.onKeyPress('escape', () => {
    if (isStarting) return;
    if (phase === 'mode' && sites.length > 1) {
      // サイト選択に戻る
      phase = 'site';
      modeSelectContainer.forEach(obj => k.destroy(obj));
      modeSelectContainer.length = 0;
      createSiteSelectUI();
      updateContentPanel();
      playSelectSound();
    }
  });

  // タッチ入力監視
  if (isTouch && titleJoystick) {
    let lastMoveX = 0;
    let lastMoveY = 0;

    k.onUpdate(() => {
      if (isStarting || !titleJoystick) return;

      const touchInput = titleJoystick.getState();

      if (phase === 'site') {
        // 上下入力でサイト切り替え
        if (touchInput.moveY < -0.3 && lastMoveY >= -0.3) {
          updateSiteSelection(-1);
        } else if (touchInput.moveY > 0.3 && lastMoveY <= 0.3) {
          updateSiteSelection(1);
        }
      } else {
        // 左右入力でモード切り替え
        if (touchInput.moveX < -0.3 && lastMoveX >= -0.3) {
          updateModeSelection('easy');
        } else if (touchInput.moveX > 0.3 && lastMoveX <= 0.3) {
          updateModeSelection('normal');
        }
      }

      lastMoveX = touchInput.moveX;
      lastMoveY = touchInput.moveY;

      // FIREボタン
      if (touchInput.firePressed) {
        titleJoystick.clearFirePressed();
        if (phase === 'site') {
          switchToModeSelect();
        } else {
          startGame();
        }
      }
    });
  }

  // デモ用レーザー発射
  function fireDemoLaser(k: KaboomCtx, x: number, y: number, angle: number, speedRatio: number) {
    const shipSize = 16;
    const angleRad = angle * (Math.PI / 180);
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);

    // 速度に応じたレーザー設定
    const laserLength = 50 + speedRatio * 80;
    const laserWidth = 6 + speedRatio * 6;
    const isPiercing = speedRatio >= 0.5;

    // 色（黄色→オレンジ）
    const laserR = 255;
    const laserG = Math.floor(255 - speedRatio * 100);
    const laserB = Math.floor(100 - speedRatio * 80);

    // レーザー開始位置
    const startX = x + dirX * shipSize;
    const startY = y + dirY * shipSize;
    const laserX = startX + dirX * (laserLength / 2);
    const laserY = startY + dirY * (laserLength / 2);

    // レーザービーム
    const laser = k.add([
      k.rect(laserLength, laserWidth),
      k.pos(laserX, laserY),
      k.anchor('center'),
      k.color(laserR, laserG, laserB),
      k.rotate(angle),
      k.opacity(0.8),
      k.outline(isPiercing ? 2 : 1, k.rgb(255, 200, 50)),
      k.z(-40),
    ]);

    // グロー
    const glow = k.add([
      k.rect(laserLength + 6, laserWidth + 6),
      k.pos(laserX, laserY),
      k.anchor('center'),
      k.color(laserR, laserG, Math.min(200, laserB + 80)),
      k.rotate(angle),
      k.opacity(0.3),
      k.z(-41),
    ]);

    // マズルフラッシュ
    const flash = k.add([
      k.circle(6 + speedRatio * 4),
      k.pos(startX, startY),
      k.anchor('center'),
      k.color(laserR, laserG, Math.min(200, laserB + 80)),
      k.opacity(0.6),
      k.z(-39),
    ]);

    // フラッシュをすぐ消す
    k.wait(0.05, () => {
      k.destroy(flash);
    });

    // レーザーを消す
    k.wait(0.12, () => {
      k.destroy(laser);
      k.destroy(glow);
    });
  }
}
