import type { KaboomCtx } from 'kaboom';
import { playSelectSound, playStartSound } from '../systems/sound';
import { isTouchDevice, getVirtualJoystick, clearVirtualJoystick, type VirtualJoystick } from '../ui/VirtualJoystick';
import { contentPanel } from '../ui/ContentPanel';

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

export function titleScene(k: KaboomCtx, siteName: string, onStart: (mode: GameMode) => void) {
  // コンテンツパネルにタイトル画面用の表示
  contentPanel.showTitleScreen(siteName);

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
    k.pos(k.width() / 2, 100),
    k.anchor('center'),
    k.color(0, 200, 255),
  ]);

  k.add([
    k.text('H U N T E R', { size: 48 }),
    k.pos(k.width() / 2, 160),
    k.anchor('center'),
    k.color(255, 200, 100),
  ]);

  // 操作説明（カード風デザイン）
  let yOffset = 215;
  const isTouch = isTouchDevice();
  const centerX = k.width() / 2;

  // マニュアルパネル背景
  const panelWidth = 340;
  const panelHeight = 140;
  k.add([
    k.rect(panelWidth, panelHeight, { radius: 8 }),
    k.pos(centerX, yOffset + panelHeight / 2),
    k.anchor('center'),
    k.color(30, 30, 45),
    k.opacity(0.8),
    k.outline(2, k.rgb(60, 80, 120)),
  ]);

  // ヘッダー
  k.add([
    k.text("HUNTER'S MANUAL", { size: 12 }),
    k.pos(centerX, yOffset + 12),
    k.anchor('center'),
    k.color(100, 200, 255),
  ]);

  // 区切り線
  k.add([
    k.rect(panelWidth - 40, 1),
    k.pos(centerX, yOffset + 28),
    k.anchor('center'),
    k.color(60, 80, 120),
    k.opacity(0.5),
  ]);

  // 操作説明（2列レイアウト）
  const col1X = centerX - 80;
  const col2X = centerX + 80;
  let rowY = yOffset + 48;

  // MOVE
  k.add([
    k.text('MOVE', { size: 14 }),
    k.pos(col1X, rowY),
    k.anchor('center'),
    k.color(255, 200, 100),
  ]);
  k.add([
    k.text(isTouch ? 'STICK' : 'ARROW KEYS', { size: 10 }),
    k.pos(col1X, rowY + 16),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);

  // FIRE
  k.add([
    k.text('FIRE', { size: 14 }),
    k.pos(col2X, rowY),
    k.anchor('center'),
    k.color(255, 100, 100),
  ]);
  k.add([
    k.text(isTouch ? 'BUTTON' : 'SPACE KEY', { size: 10 }),
    k.pos(col2X, rowY + 16),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);

  // HINTS セクション
  rowY += 45;
  k.add([
    k.rect(panelWidth - 40, 1),
    k.pos(centerX, rowY - 8),
    k.anchor('center'),
    k.color(60, 80, 120),
    k.opacity(0.3),
  ]);

  // HINT 1: ポータル
  k.add([
    k.text('SHOOT', { size: 10 }),
    k.pos(centerX - 60, rowY),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);
  const portalLabel = k.add([
    k.text('PORTALS', { size: 10 }),
    k.pos(centerX, rowY),
    k.anchor('center'),
    k.color(0, 200, 255),
    k.opacity(1),
  ]);
  k.add([
    k.text('TO WARP', { size: 10 }),
    k.pos(centerX + 60, rowY),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);

  // HINT 2: 速度
  rowY += 18;
  k.add([
    k.text('SPEED = POWER!', { size: 10 }),
    k.pos(centerX, rowY),
    k.anchor('center'),
    k.color(255, 150, 50),
  ]);

  // ポータルラベル点滅
  let portalTime = 0;
  portalLabel.onUpdate(() => {
    portalTime += k.dt() * 3;
    portalLabel.opacity = 0.7 + Math.sin(portalTime * 1.5) * 0.3;
  });

  yOffset += panelHeight + 15;

  // --- モード選択UI ---

  // 選択状態
  let selectedMode: GameMode = 'normal';
  let isStarting = false;

  // 選択ラベル説明
  k.add([
    k.text('SELECT MODE TO START', { size: 14 }),
    k.pos(k.width() / 2, yOffset),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);
  yOffset += 25;

  // モード選択肢
  const modeSpacing = 140;
  const easyButtonX = k.width() / 2 - modeSpacing / 2;
  const easyLabel = k.add([
    k.text('EASY', { size: 18 }),
    k.pos(easyButtonX, yOffset),
    k.area({ shape: new k.Rect(k.vec2(-40, -15), 80, 50) }),
    k.anchor('center'),
    k.color(100, 200, 100),
    k.opacity(0.5),
    'mode-easy',
  ]);
  const easyDesc = k.add([
    k.text('2 PAGES', { size: 10 }),
    k.pos(easyButtonX, yOffset + 18),
    k.anchor('center'),
    k.color(100, 200, 100),
    k.opacity(0.4),
  ]);

  const normalButtonX = k.width() / 2 + modeSpacing / 2;
  const normalLabel = k.add([
    k.text('NORMAL', { size: 18 }),
    k.pos(normalButtonX, yOffset),
    k.area({ shape: new k.Rect(k.vec2(-45, -15), 90, 50) }),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(1),
    'mode-normal',
  ]);
  const normalDesc = k.add([
    k.text('5 PAGES', { size: 10 }),
    k.pos(normalButtonX, yOffset + 18),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(0.7),
  ]);

  // 選択カーソル（矢印）
  const cursorLeft = k.add([
    k.text('>', { size: 20 }),
    k.pos(k.width() / 2 + modeSpacing / 2 - 50, yOffset),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.opacity(1),
  ]);
  const cursorRight = k.add([
    k.text('<', { size: 20 }),
    k.pos(k.width() / 2 + modeSpacing / 2 + 50, yOffset),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.opacity(1),
  ]);

  // 選択更新関数
  function updateModeSelection() {
    if (selectedMode === 'easy') {
      easyLabel.opacity = 1;
      easyDesc.opacity = 0.7;
      normalLabel.opacity = 0.5;
      normalDesc.opacity = 0.4;
      cursorLeft.pos.x = k.width() / 2 - modeSpacing / 2 - 40;
      cursorRight.pos.x = k.width() / 2 - modeSpacing / 2 + 40;
    } else {
      easyLabel.opacity = 0.5;
      easyDesc.opacity = 0.4;
      normalLabel.opacity = 1;
      normalDesc.opacity = 0.7;
      cursorLeft.pos.x = k.width() / 2 + modeSpacing / 2 - 50;
      cursorRight.pos.x = k.width() / 2 + modeSpacing / 2 + 50;
    }
  }

  // カーソル点滅
  let cursorTime = 0;
  cursorLeft.onUpdate(() => {
    cursorTime += k.dt();
    const opacity = 0.5 + 0.5 * Math.sin(cursorTime * 6);
    cursorLeft.opacity = opacity;
    cursorRight.opacity = opacity;
  });

  yOffset += 50;

  // "PRESS SPACE TO START" 点滅（タッチデバイスでは非表示）
  const startLabelText = isTouch ? '' : '[ PRESS SPACE TO START ]';
  const startLabel = k.add([
    k.text(startLabelText, { size: 20 }),
    k.pos(k.width() / 2, yOffset),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.opacity(isTouch ? 0 : 1),
  ]);

  // 点滅アニメーション（PC用）
  let blinkTime = 0;
  if (!isTouch) {
    startLabel.onUpdate(() => {
      blinkTime += k.dt();
      // sin波で0.3〜1.0の間を往復
      startLabel.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(blinkTime * 4));
    });
  }

  // 左右キーでモード選択
  k.onKeyPress('left', () => {
    if (isStarting) return;
    if (selectedMode !== 'easy') {
      selectedMode = 'easy';
      playSelectSound();
      updateModeSelection();
    }
  });
  k.onKeyPress('right', () => {
    if (isStarting) return;
    if (selectedMode !== 'normal') {
      selectedMode = 'normal';
      playSelectSound();
      updateModeSelection();
    }
  });

  // タッチ操作: 仮想ジョイスティックでモード選択、FIREでスタート
  let titleJoystick: VirtualJoystick | null = null;
  if (isTouch) {
    // 前回のインスタンスをクリア
    clearVirtualJoystick();
    titleJoystick = getVirtualJoystick(k);
    titleJoystick.create();
  }

  // ゲーム開始処理（共通）
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
      onStart(selectedMode);
    });
  }

  // SPACEキーでゲーム開始
  k.onKeyPress('space', startGame);

  // タッチ入力監視
  if (isTouch && titleJoystick) {
    let lastMoveX = 0;

    k.onUpdate(() => {
      if (isStarting || !titleJoystick) return;

      const touchInput = titleJoystick.getState();

      // 左右入力でモード切り替え（入力が変化した時のみ）
      if (touchInput.moveX < -0.3 && lastMoveX >= -0.3) {
        if (selectedMode !== 'easy') {
          selectedMode = 'easy';
          playSelectSound();
          updateModeSelection();
        }
      } else if (touchInput.moveX > 0.3 && lastMoveX <= 0.3) {
        if (selectedMode !== 'normal') {
          selectedMode = 'normal';
          playSelectSound();
          updateModeSelection();
        }
      }
      lastMoveX = touchInput.moveX;

      // FIREボタンでゲーム開始
      if (touchInput.firePressed) {
        titleJoystick.clearFirePressed();
        startGame();
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
