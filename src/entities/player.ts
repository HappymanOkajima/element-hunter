import type { GameObj, KaboomCtx, PosComp, AreaComp, AnchorComp, ColorComp, RotateComp, OpacityComp } from 'kaboom';
import type { Direction, PlayerState } from '../types';
import { contentPanel } from '../ui/ContentPanel';

// プレイヤー設定
const PLAYER_CONFIG = {
  speed: 200,
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

// 入力から方向を判定
function getDirection(x: number, y: number): Direction {
  if (x === 0 && y < 0) return 'up';
  if (x === 0 && y > 0) return 'down';
  if (x < 0 && y === 0) return 'left';
  if (x > 0 && y === 0) return 'right';
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

export function createPlayer(k: KaboomCtx, stageWidth: number = 800, initialHp: number = 5): PlayerObject {
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
    k.area({ shape: new k.Rect(k.vec2(-8, -8), 16, 16) }),
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
    const dir = k.vec2(0, 0);

    // 8方向入力チェック
    if (k.isKeyDown('left') || k.isKeyDown('a')) dir.x -= 1;
    if (k.isKeyDown('right') || k.isKeyDown('d')) dir.x += 1;
    if (k.isKeyDown('up') || k.isKeyDown('w')) dir.y -= 1;
    if (k.isKeyDown('down') || k.isKeyDown('s')) dir.y += 1;

    // 移動がある場合
    if (dir.x !== 0 || dir.y !== 0) {
      isMoving = true;
      // 正規化（斜め移動の速度補正）
      const normalized = dir.unit();
      player.move(normalized.scale(PLAYER_CONFIG.speed));

      // 方向更新
      state.direction = getDirection(dir.x, dir.y);

      // 宇宙船の向きを更新
      player.angle = DIRECTION_ANGLES[state.direction];
    } else {
      isMoving = false;
    }

    // エンジン噴射の更新
    const dirVec = DIRECTION_VECTORS[state.direction];
    thruster.pos.x = player.pos.x - dirVec.x * shipSize;
    thruster.pos.y = player.pos.y - dirVec.y * shipSize;
    thruster.angle = DIRECTION_ANGLES[state.direction];

    // 移動中のみ噴射を表示（ちらつき効果）
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

    // ステージ内に制限
    player.pos.x = Math.max(20, Math.min(stageWidth - 20, player.pos.x));
    player.pos.y = Math.max(50, Math.min(550, player.pos.y));
  });

  // レーザー攻撃処理
  function attack() {
    if (state.isAttacking) return;

    state.isAttacking = true;

    const dirVec = DIRECTION_VECTORS[state.direction];
    const laserLength = 35;
    const laserWidth = 4;

    // レーザーの開始位置（宇宙船の先端）
    const startX = player.pos.x + dirVec.x * shipSize;
    const startY = player.pos.y + dirVec.y * shipSize;

    // レーザーの中心位置
    const laserX = startX + dirVec.x * (laserLength / 2);
    const laserY = startY + dirVec.y * (laserLength / 2);

    // レーザービーム生成
    const laser = k.add([
      k.rect(laserLength, laserWidth),
      k.pos(laserX, laserY),
      k.area(),
      k.anchor('center'),
      k.color(255, 255, 100),
      k.rotate(DIRECTION_ANGLES[state.direction]),
      k.opacity(1),
      k.outline(1, k.rgb(255, 200, 50)),
      'sword',  // 既存の衝突判定を維持
    ]);

    // レーザーのグロー効果
    const glow = k.add([
      k.rect(laserLength + 4, laserWidth + 4),
      k.pos(laserX, laserY),
      k.anchor('center'),
      k.color(255, 255, 200),
      k.rotate(DIRECTION_ANGLES[state.direction]),
      k.opacity(0.4),
      k.z(-1),
    ]);

    // 発射時のマズルフラッシュ
    const flash = k.add([
      k.circle(8),
      k.pos(startX, startY),
      k.anchor('center'),
      k.color(255, 255, 200),
      k.opacity(0.8),
    ]);

    // フラッシュを即座に消す
    k.wait(0.05, () => {
      k.destroy(flash);
    });

    // 一定時間後に消える
    k.wait(PLAYER_CONFIG.attackDuration, () => {
      k.destroy(laser);
      k.destroy(glow);
      state.isAttacking = false;
    });
  }

  // 攻撃入力
  k.onKeyPress('space', attack);
  k.onKeyPress('z', attack);

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
