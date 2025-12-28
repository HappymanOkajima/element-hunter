import type { KaboomCtx } from 'kaboom';
import { playSelectSound, playStartSound } from '../systems/sound';

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

  // --- AIハンター（デモ用宇宙船） ---
  const shipSize = 16;
  const shipPoints = [
    k.vec2(shipSize, 0),
    k.vec2(-shipSize, -shipSize * 0.7),
    k.vec2(-shipSize * 0.5, 0),
    k.vec2(-shipSize, shipSize * 0.7),
  ];

  const demoShip = k.add([
    k.polygon(shipPoints),
    k.pos(150, 400),
    k.anchor('center'),
    k.color(100, 200, 255),
    k.rotate(0),
    k.opacity(0.7),
    k.outline(2, k.rgb(200, 230, 255)),
    k.z(-50),
  ]);

  // エンジン噴射
  const demoThruster = k.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(-12, -5),
      k.vec2(-12, 5),
    ]),
    k.pos(demoShip.pos.x, demoShip.pos.y),
    k.anchor('center'),
    k.color(255, 150, 50),
    k.rotate(0),
    k.opacity(0.6),
    k.z(-51),
  ]);

  // AI状態
  let aiVelocityX = 80;
  let aiVelocityY = 0;
  let aiDirection = 'right';
  let aiChangeTime = 0;
  let aiFireTime = 0;

  // AI更新
  demoShip.onUpdate(() => {
    const dt = k.dt();

    // ランダムに方向変更（2-4秒ごと）
    aiChangeTime += dt;
    if (aiChangeTime > 2 + Math.random() * 2) {
      aiChangeTime = 0;
      aiDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    }

    // 目標方向に加速
    const targetVec = DIRECTION_VECTORS[aiDirection];
    const speed = 120;
    const targetVx = targetVec.x * speed;
    const targetVy = targetVec.y * speed;

    // 緩やかに目標速度に近づく
    aiVelocityX += (targetVx - aiVelocityX) * 2 * dt;
    aiVelocityY += (targetVy - aiVelocityY) * 2 * dt;

    // 位置更新
    demoShip.pos.x += aiVelocityX * dt;
    demoShip.pos.y += aiVelocityY * dt;

    // 画面端で跳ね返り
    if (demoShip.pos.x < 50) {
      demoShip.pos.x = 50;
      aiVelocityX = Math.abs(aiVelocityX);
      aiDirection = 'right';
    }
    if (demoShip.pos.x > k.width() - 50) {
      demoShip.pos.x = k.width() - 50;
      aiVelocityX = -Math.abs(aiVelocityX);
      aiDirection = 'left';
    }
    if (demoShip.pos.y < 50) {
      demoShip.pos.y = 50;
      aiVelocityY = Math.abs(aiVelocityY);
      aiDirection = 'down';
    }
    if (demoShip.pos.y > k.height() - 50) {
      demoShip.pos.y = k.height() - 50;
      aiVelocityY = -Math.abs(aiVelocityY);
      aiDirection = 'up';
    }

    // 向きを速度方向に合わせる
    const currentSpeed = Math.sqrt(aiVelocityX * aiVelocityX + aiVelocityY * aiVelocityY);
    if (currentSpeed > 10) {
      demoShip.angle = Math.atan2(aiVelocityY, aiVelocityX) * (180 / Math.PI);
    }

    // エンジン噴射更新
    const angleRad = demoShip.angle * (Math.PI / 180);
    demoThruster.pos.x = demoShip.pos.x - Math.cos(angleRad) * shipSize;
    demoThruster.pos.y = demoShip.pos.y - Math.sin(angleRad) * shipSize;
    demoThruster.angle = demoShip.angle;
    demoThruster.opacity = 0.4 + Math.random() * 0.3;

    const thrustLength = 8 + Math.random() * 6;
    demoThruster.pts = [
      k.vec2(0, 0),
      k.vec2(-thrustLength, -4),
      k.vec2(-thrustLength, 4),
    ];

    // たまにレーザーを撃つ（1-3秒ごと）
    aiFireTime += dt;
    if (aiFireTime > 1 + Math.random() * 2) {
      aiFireTime = 0;
      fireDemoLaser(k, demoShip.pos.x, demoShip.pos.y, demoShip.angle, currentSpeed / speed);
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

  // ストーリーテキスト（80年代風：英語大文字）
  const storyLines = [
    'I AM THE ELEMENT HUNTER.',
    'MY JOB IS TO HUNT ESCAPED HTML ELEMENTS.',
    '',
    "LET'S CATCH THEM ALL",
    'AND RECLAIM THE CONTENTS!',
    '',
    `TODAY'S STAGE: ${siteName.toUpperCase()}`,
  ];

  let yOffset = 240;
  for (const line of storyLines) {
    if (line === '') {
      yOffset += 10;
      continue;
    }
    k.add([
      k.text(line, { size: 16 }),
      k.pos(k.width() / 2, yOffset),
      k.anchor('center'),
      k.color(200, 200, 200),
    ]);
    yOffset += 28;
  }

  // 操作説明（80's風マニュアル）
  yOffset += 15;
  k.add([
    k.text("---- HUNTER'S MANUAL ----", { size: 14 }),
    k.pos(k.width() / 2, yOffset),
    k.anchor('center'),
    k.color(100, 200, 255),
  ]);
  yOffset += 22;

  const manualLines = [
    'MOVE ........ ARROW KEYS',
    'FIRE ........ SPACE KEY',
    'BOOST ....... SPEED = POWER!',
  ];
  for (const line of manualLines) {
    k.add([
      k.text(line, { size: 11 }),
      k.pos(k.width() / 2, yOffset),
      k.anchor('center'),
      k.color(150, 150, 150),
    ]);
    yOffset += 18;
  }

  // HINTは[PORTALS]部分だけ別色＆点滅
  yOffset += 8;
  k.add([
    k.text('HINT: SHOOT ', { size: 11 }),
    k.pos(k.width() / 2 - 70, yOffset),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);
  const portalLabel = k.add([
    k.text('[PORTALS]', { size: 11 }),
    k.pos(k.width() / 2 + 10, yOffset),
    k.anchor('center'),
    k.color(0, 200, 255),  // ポータルと同じ水色
    k.opacity(1),
  ]);
  k.add([
    k.text(' TO WARP', { size: 11 }),
    k.pos(k.width() / 2 + 75, yOffset),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);
  yOffset += 18;

  // ポータルラベル点滅（実際のポータルと同じ動き）
  let portalTime = 0;
  portalLabel.onUpdate(() => {
    portalTime += k.dt() * 3;
    portalLabel.opacity = 0.7 + Math.sin(portalTime * 1.5) * 0.3;
  });

  // --- モード選択UI ---
  yOffset += 25;

  // 選択状態
  let selectedMode: GameMode = 'normal';
  let isStarting = false;

  // 選択ラベル説明
  k.add([
    k.text('CHOOSE MODE, THEN PRESS SPACE', { size: 14 }),
    k.pos(k.width() / 2, yOffset),
    k.anchor('center'),
    k.color(150, 150, 150),
  ]);
  yOffset += 25;

  // モード選択肢
  const modeSpacing = 140;
  const easyLabel = k.add([
    k.text('EASY', { size: 18 }),
    k.pos(k.width() / 2 - modeSpacing / 2, yOffset),
    k.anchor('center'),
    k.color(100, 200, 100),
    k.opacity(0.5),
  ]);
  const easyDesc = k.add([
    k.text('2 PAGES', { size: 10 }),
    k.pos(k.width() / 2 - modeSpacing / 2, yOffset + 18),
    k.anchor('center'),
    k.color(100, 200, 100),
    k.opacity(0.4),
  ]);

  const normalLabel = k.add([
    k.text('NORMAL', { size: 18 }),
    k.pos(k.width() / 2 + modeSpacing / 2, yOffset),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(1),
  ]);
  const normalDesc = k.add([
    k.text('5 PAGES', { size: 10 }),
    k.pos(k.width() / 2 + modeSpacing / 2, yOffset + 18),
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

  // "PRESS SPACE TO START" 点滅
  const startLabel = k.add([
    k.text('[ PRESS SPACE TO START ]', { size: 20 }),
    k.pos(k.width() / 2, yOffset),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.opacity(1),
  ]);

  // 点滅アニメーション
  let blinkTime = 0;
  startLabel.onUpdate(() => {
    blinkTime += k.dt();
    // sin波で0.3〜1.0の間を往復
    startLabel.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(blinkTime * 4));
  });

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

  // SPACEキーでゲーム開始
  k.onKeyPress('space', () => {
    if (isStarting) return;
    isStarting = true;
    playStartSound();

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
  });

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
