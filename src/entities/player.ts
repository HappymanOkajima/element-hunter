import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp } from 'kaboom';
import type { Direction, PlayerState } from '../types';
import { contentPanel } from '../ui/ContentPanel';

// プレイヤー設定
const PLAYER_CONFIG = {
  speed: 200,
  attackDuration: 0.2,
  attackRange: 40,
  invincibleTime: 1.0,
};

// 方向に対応する表示文字
const DIRECTION_CHARS: Record<Direction, string> = {
  'up': '^',
  'down': 'v',
  'left': '<',
  'right': '>',
  'up-left': '<',
  'up-right': '>',
  'down-left': '<',
  'down-right': '>',
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

type PlayerBaseObj = GameObj<TextComp | PosComp | AreaComp | AnchorComp | ColorComp>;

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

  // プレイヤーオブジェクト
  const player = k.add([
    k.text('>', { size: 32 }),
    k.pos(100, 300),
    k.area({ shape: new k.Rect(k.vec2(-12, -12), 24, 24) }),
    k.anchor('center'),
    k.color(255, 255, 255),
    'player',
  ]) as unknown as PlayerObject;

  // カスタムメソッドを追加
  player.getState = () => state;

  player.takeDamage = (amount: number) => {
    if (isInvincible) return;

    state.hp -= amount;
    k.shake(5);

    if (state.hp <= 0) {
      if (blinkTimer) clearInterval(blinkTimer);
      contentPanel.stopTimer();
      k.go('gameover');
      return;
    }

    // 無敵時間開始
    isInvincible = true;

    // 点滅エフェクト
    let blinkCount = 0;
    blinkTimer = setInterval(() => {
      player.hidden = !player.hidden;
      blinkCount++;
      if (blinkCount > 10) {
        if (blinkTimer) clearInterval(blinkTimer);
        blinkTimer = null;
        player.hidden = false;
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
      // 正規化（斜め移動の速度補正）
      const normalized = dir.unit();
      player.move(normalized.scale(PLAYER_CONFIG.speed));

      // 方向更新
      state.direction = getDirection(dir.x, dir.y);

      // 表示文字更新（攻撃中でなければ）
      if (!state.isAttacking) {
        player.text = DIRECTION_CHARS[state.direction];
      }
    }

    // ステージ内に制限
    player.pos.x = Math.max(20, Math.min(stageWidth - 20, player.pos.x));
    player.pos.y = Math.max(50, Math.min(550, player.pos.y));
  });

  // 攻撃処理
  function attack() {
    if (state.isAttacking) return;

    state.isAttacking = true;

    const dirVec = DIRECTION_VECTORS[state.direction];
    const swordX = player.pos.x + dirVec.x * PLAYER_CONFIG.attackRange;
    const swordY = player.pos.y + dirVec.y * PLAYER_CONFIG.attackRange;

    // 剣オブジェクト生成
    const sword = k.add([
      k.text('+', { size: 24 }),
      k.pos(swordX, swordY),
      k.area({ shape: new k.Rect(k.vec2(-15, -15), 30, 30) }),
      k.anchor('center'),
      k.color(255, 255, 100),
      'sword',
    ]);

    // 一定時間後に消える
    k.wait(PLAYER_CONFIG.attackDuration, () => {
      k.destroy(sword);
      state.isAttacking = false;
    });
  }

  // 攻撃入力
  k.onKeyPress('space', attack);
  k.onKeyPress('z', attack);

  return player;
}
