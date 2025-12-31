import type { GameObj, KaboomCtx, PosComp, AreaComp, AnchorComp, ColorComp, RotateComp, OpacityComp } from 'kaboom';
import type { Direction, PlayerState } from '../types';
import { contentPanel } from '../ui/ContentPanel';
import { isGamePaused } from '../scenes/game';
import { gameState } from '../systems/gameState';
import { playLaserSound, playDamageSound, playComboSound } from '../systems/sound';
import type { TouchInputState } from '../ui/VirtualJoystick';

// プレイヤー設定
const PLAYER_CONFIG = {
  maxSpeed: 250,        // 最高速度
  acceleration: 400,    // 加速度
  friction: 0.98,       // 摩擦（1に近いほど滑る）
  attackDuration: 0.15,
  attackRange: 50,
  invincibleTime: 1.0,
};

// 方向に対応する角度（度）
const DIRECTION_ANGLES: Record<Direction, number> = {
  'up': -90,
  'down': 90,
  'left': 180,
  'right': 0,
  'up-left': -135,
  'up-right': -45,
  'down-left': 135,
  'down-right': 45,
};

// 方向に対応するベクトル
const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  'up': { x: 0, y: -1 },
  'down': { x: 0, y: 1 },
  'left': { x: -1, y: 0 },
  'right': { x: 1, y: 0 },
  'up-left': { x: -0.707, y: -0.707 },
  'up-right': { x: 0.707, y: -0.707 },
  'down-left': { x: -0.707, y: 0.707 },
  'down-right': { x: 0.707, y: 0.707 },
};

// 入力から方向を判定（浮動小数点誤差を考慮）
function getDirection(x: number, y: number): Direction {
  const EPSILON = 0.1; // 閾値（0に近い値を0として扱う）
  const isZeroX = Math.abs(x) < EPSILON;
  const isZeroY = Math.abs(y) < EPSILON;

  if (isZeroX && y < 0) return 'up';
  if (isZeroX && y > 0) return 'down';
  if (x < 0 && isZeroY) return 'left';
  if (x > 0 && isZeroY) return 'right';
  if (x < 0 && y < 0) return 'up-left';
  if (x > 0 && y < 0) return 'up-right';
  if (x < 0 && y > 0) return 'down-left';
  if (x > 0 && y > 0) return 'down-right';
  return 'right';
}

type PlayerBaseObj = GameObj<PosComp | AreaComp | AnchorComp | ColorComp | RotateComp | OpacityComp>;

export interface PlayerObject extends PlayerBaseObj {
  getState: () => PlayerState;
  takeDamage: (amount: number) => void;
}

export function createPlayer(
  k: KaboomCtx,
  stageWidth: number = 800,
  initialHp: number = 5,
  getTouchInput?: () => TouchInputState | null
): PlayerObject {
  // プレイヤー状態
  const state: PlayerState = {
    hp: initialHp,
    maxHp: 5,
    isAttacking: false,
    direction: 'right',
  };

  let isInvincible = false;
  let blinkTimer: ReturnType<typeof setInterval> | null = null;
  let isMoving = false;

  // 慣性用の速度ベクトル
  let velocityX = 0;
  let velocityY = 0;

  // 宇宙船の形状（三角形ベース）
  // 右向き（0度）がデフォルト
  const shipSize = 16;
  const shipPoints = [
    k.vec2(shipSize, 0),         // 機首（右端）
    k.vec2(-shipSize, -shipSize * 0.7),  // 左上翼
    k.vec2(-shipSize * 0.5, 0),  // 中央くぼみ
    k.vec2(-shipSize, shipSize * 0.7),   // 左下翼
  ];

  // プレイヤーオブジェクト（ポリゴンで宇宙船を描画）
  const player = k.add([
    k.polygon(shipPoints),
    k.pos(100, 300),
    k.area(),
    k.anchor('center'),
    k.color(100, 200, 255),
    k.rotate(0),
    k.opacity(1),
    k.outline(2, k.rgb(200, 230, 255)),
    'player',
  ]) as unknown as PlayerObject;

  // エンジン噴射エフェクト（宇宙船の後ろに配置）
  const thruster = k.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(-12, -5),
      k.vec2(-12, 5),
    ]),
    k.pos(player.pos.x, player.pos.y),
    k.anchor('center'),
    k.color(255, 150, 50),
    k.rotate(0),
    k.opacity(0.8),
    k.z(-1),
    'thruster',
  ]);

  // カスタムメソッドを追加
  player.getState = () => state;

  player.takeDamage = (amount: number) => {
    if (isInvincible) return;

    state.hp -= amount;
    k.shake(5);
    playDamageSound();

    if (state.hp <= 0) {
      if (blinkTimer) clearInterval(blinkTimer);
      contentPanel.stopTimer();
      // 爆発エフェクト
      spawnExplosion(k, player.pos.x, player.pos.y);
      k.wait(0.5, () => {
        k.go('gameover');
      });
      return;
    }

    // 無敵時間開始
    isInvincible = true;

    // 点滅エフェクト
    let blinkCount = 0;
    blinkTimer = setInterval(() => {
      player.opacity = player.opacity === 1 ? 0.3 : 1;
      blinkCount++;
      if (blinkCount > 10) {
        if (blinkTimer) clearInterval(blinkTimer);
        blinkTimer = null;
        player.opacity = 1;
        isInvincible = false;
      }
    }, 100);
  };

  // 移動処理（毎フレーム）
  player.onUpdate(() => {
    // ポーズ中は処理しない
    if (isGamePaused()) return;

    const dt = k.dt();
    const inputDir = k.vec2(0, 0);

    // タッチ入力またはキーボード入力
    const touchInput = getTouchInput?.();
    if (touchInput && (touchInput.moveX !== 0 || touchInput.moveY !== 0)) {
      // タッチ入力を使用
      inputDir.x = touchInput.moveX;
      inputDir.y = touchInput.moveY;
    } else {
      // 8方向キーボード入力チェック（矢印キーのみ）
      if (k.isKeyDown('left')) inputDir.x -= 1;
      if (k.isKeyDown('right')) inputDir.x += 1;
      if (k.isKeyDown('up')) inputDir.y -= 1;
      if (k.isKeyDown('down')) inputDir.y += 1;
    }

    // 入力がある場合は加速
    if (inputDir.x !== 0 || inputDir.y !== 0) {
      isMoving = true;
      // 正規化（斜め移動の速度補正）
      const normalized = inputDir.unit();

      // 加速
      velocityX += normalized.x * PLAYER_CONFIG.acceleration * dt;
      velocityY += normalized.y * PLAYER_CONFIG.acceleration * dt;

      // 方向更新（入力方向に向く）
      state.direction = getDirection(inputDir.x, inputDir.y);
      player.angle = DIRECTION_ANGLES[state.direction];
    } else {
      isMoving = false;
    }

    // 摩擦を適用（徐々に減速）
    velocityX *= PLAYER_CONFIG.friction;
    velocityY *= PLAYER_CONFIG.friction;

    // 速度制限
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed > PLAYER_CONFIG.maxSpeed) {
      const scale = PLAYER_CONFIG.maxSpeed / speed;
      velocityX *= scale;
      velocityY *= scale;
    }

    // 微小な速度は0にする（完全停止）
    if (Math.abs(velocityX) < 1) velocityX = 0;
    if (Math.abs(velocityY) < 1) velocityY = 0;

    // 位置更新
    player.pos.x += velocityX * dt;
    player.pos.y += velocityY * dt;

    // ステージ端での跳ね返り（壁にぶつかったら速度反転）
    if (player.pos.x < 20) {
      player.pos.x = 20;
      velocityX = -velocityX * 0.5;  // 反発係数0.5
    }
    if (player.pos.x > stageWidth - 20) {
      player.pos.x = stageWidth - 20;
      velocityX = -velocityX * 0.5;
    }
    if (player.pos.y < 50) {
      player.pos.y = 50;
      velocityY = -velocityY * 0.5;
    }
    if (player.pos.y > 550) {
      player.pos.y = 550;
      velocityY = -velocityY * 0.5;
    }

    // エンジン噴射の更新
    const dirVec = DIRECTION_VECTORS[state.direction];
    thruster.pos.x = player.pos.x - dirVec.x * shipSize;
    thruster.pos.y = player.pos.y - dirVec.y * shipSize;
    thruster.angle = DIRECTION_ANGLES[state.direction];

    // 入力中のみ噴射を表示（ちらつき効果）
    if (isMoving) {
      thruster.opacity = 0.6 + Math.random() * 0.4;
      // 噴射の長さを変動
      const thrustLength = 10 + Math.random() * 8;
      thruster.pts = [
        k.vec2(0, 0),
        k.vec2(-thrustLength, -4),
        k.vec2(-thrustLength, 4),
      ];
    } else {
      thruster.opacity = 0;
    }
  });

  // レーザー攻撃処理
  function attack() {
    if (isGamePaused()) return;
    if (state.isAttacking) return;

    state.isAttacking = true;

    // 現在の速度を計算
    const currentSpeed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    const speedRatio = currentSpeed / PLAYER_CONFIG.maxSpeed;  // 0〜1

    // 速度に応じてレーザーのパラメータを変化
    const baseLaserLength = 50;
    const baseLaserWidth = 8;

    // 高速時: レーザーが長く、太くなる
    const laserLength = baseLaserLength + speedRatio * 100;  // 50〜150
    const laserWidth = baseLaserWidth + speedRatio * 8;       // 8〜16

    // 貫通フラグ（速度50%以上で貫通）
    const isPiercing = speedRatio >= 0.5;

    // ダメージ量（速度に応じて増加）
    // 通常: 1、50%: 2、100%: 3
    const damage = isPiercing ? Math.floor(1 + speedRatio * 2) : 1;

    // 色も変化（黄色→オレンジ→赤）
    const laserR = 255;
    const laserG = Math.floor(255 - speedRatio * 155);  // 255→100
    const laserB = Math.floor(100 - speedRatio * 100);  // 100→0

    const dirVec = DIRECTION_VECTORS[state.direction];

    // レーザーの開始位置（宇宙船の先端）
    const startX = player.pos.x + dirVec.x * shipSize;
    const startY = player.pos.y + dirVec.y * shipSize;

    // レーザーの中心位置
    const laserX = startX + dirVec.x * (laserLength / 2);
    const laserY = startY + dirVec.y * (laserLength / 2);

    // 貫通レーザー用: ヒット済み敵を追跡
    const hitEnemies = new Set<string>();
    // コンボ用: このレーザーで倒した敵を追跡
    const killedEnemies = new Set<string>();

    // レーザー発射音
    playLaserSound(isPiercing);

    // レーザービーム生成
    // 方向に応じてレーザーの向きを変更（矩形自体を回転させる代わりに描画サイズを変更）
    const isVertical = state.direction === 'up' || state.direction === 'down';
    const isDiagonal = state.direction.includes('-');  // 斜め方向

    // 描画サイズ（視覚的な向き）
    let drawWidth: number;
    let drawHeight: number;

    if (isDiagonal) {
      // 斜め: 横長の矩形を回転させる
      drawWidth = laserLength;
      drawHeight = laserWidth;
    } else if (isVertical) {
      // 上下: 幅と高さを入れ替え
      drawWidth = laserWidth;
      drawHeight = laserLength;
    } else {
      // 左右: そのまま
      drawWidth = laserLength;
      drawHeight = laserWidth;
    }

    const laser = k.add([
      k.rect(drawWidth, drawHeight),
      k.pos(laserX, laserY),
      k.area(),
      k.anchor('center'),
      k.color(laserR, laserG, laserB),
      k.rotate(isDiagonal ? DIRECTION_ANGLES[state.direction] : 0),
      k.opacity(1),
      k.outline(isPiercing ? 2 : 1, k.rgb(255, 200, 50)),
      isPiercing ? 'sword-piercing' : 'sword',
      { hitEnemies, isPiercing, damage, killedEnemies },
    ]);

    // レーザーのグロー効果
    const glow = k.add([
      k.rect(drawWidth + 8, drawHeight + 8),
      k.pos(laserX, laserY),
      k.anchor('center'),
      k.color(laserR, laserG, Math.min(200, laserB + 100)),
      k.rotate(isDiagonal ? DIRECTION_ANGLES[state.direction] : 0),
      k.opacity(isPiercing ? 0.6 : 0.4),
      k.z(-1),
    ]);

    // 発射時のマズルフラッシュ（高速時は大きく）
    const flashSize = 8 + speedRatio * 8;
    const flash = k.add([
      k.circle(flashSize),
      k.pos(startX, startY),
      k.anchor('center'),
      k.color(laserR, laserG, Math.min(200, laserB + 100)),
      k.opacity(0.8),
    ]);

    // 高速時は「BOOST!」エフェクト表示
    if (isPiercing) {
      const boostLabel = k.add([
        k.text('BOOST!', { size: 12 }),
        k.pos(player.pos.x, player.pos.y - 30),
        k.anchor('center'),
        k.color(255, 150, 50),
        k.opacity(1),
      ]);
      k.wait(0.3, () => {
        k.destroy(boostLabel);
      });
    }

    // フラッシュを即座に消す
    k.wait(0.05, () => {
      k.destroy(flash);
    });

    // 一定時間後に消える（高速時は少し長め）
    const duration = PLAYER_CONFIG.attackDuration + speedRatio * 0.05;
    k.wait(duration, () => {
      // コンボボーナス処理（レーザー消滅前に）
      if (killedEnemies.size >= 2) {
        const bonusSeconds = gameState.applyComboBonus(killedEnemies.size);
        playComboSound(killedEnemies.size);
        showComboEffect(k, killedEnemies.size, bonusSeconds);
      }

      k.destroy(laser);
      k.destroy(glow);
      state.isAttacking = false;
    });
  }

  // コンボエフェクト表示
  function showComboEffect(k: KaboomCtx, comboCount: number, bonusSeconds: number) {
    // コンボテキスト
    const comboText = k.add([
      k.text(`${comboCount} COMBO!`, { size: 28 }),
      k.pos(k.width() / 2, k.height() / 2 - 60),
      k.anchor('center'),
      k.color(255, 200, 50),
      k.opacity(1),
      k.fixed(),
      k.z(50),
    ]);

    // タイムボーナステキスト
    const bonusText = k.add([
      k.text(`-${bonusSeconds.toFixed(1)}s`, { size: 20 }),
      k.pos(k.width() / 2, k.height() / 2 - 30),
      k.anchor('center'),
      k.color(100, 255, 100),
      k.opacity(1),
      k.fixed(),
      k.z(50),
    ]);

    // アニメーション: 上に浮かびながらフェードアウト
    k.tween(
      0, 1, 1.0,
      (t) => {
        comboText.pos.y = k.height() / 2 - 60 - t * 40;
        comboText.opacity = 1 - t;
        bonusText.pos.y = k.height() / 2 - 30 - t * 40;
        bonusText.opacity = 1 - t;
      },
      k.easings.easeOutQuad
    ).onEnd(() => {
      k.destroy(comboText);
      k.destroy(bonusText);
    });
  }

  // 攻撃入力（Zキーのみ：キーボードゴースト回避のためスペース無効）
  k.onKeyPress('z', attack);

  // タッチ攻撃入力をチェック（毎フレーム）
  if (getTouchInput) {
    player.onUpdate(() => {
      const touchInput = getTouchInput();
      if (touchInput?.firePressed) {
        attack();
      }
    });
  }

  return player;
}

// 爆発エフェクト
function spawnExplosion(k: KaboomCtx, x: number, y: number) {
  const particleCount = 12;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 80 + Math.random() * 60;
    const particle = k.add([
      k.circle(4 + Math.random() * 4),
      k.pos(x, y),
      k.anchor('center'),
      k.color(255, 150 + Math.random() * 100, 50),
      k.opacity(1),
    ]);

    particle.onUpdate(() => {
      particle.pos.x += Math.cos(angle) * speed * k.dt();
      particle.pos.y += Math.sin(angle) * speed * k.dt();
      particle.opacity -= 2 * k.dt();
      if (particle.opacity <= 0) {
        k.destroy(particle);
      }
    });
  }
}
