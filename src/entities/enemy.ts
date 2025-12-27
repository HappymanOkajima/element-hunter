import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp } from 'kaboom';
import type { EnemyConfig } from '../types';
import { getEnemyConfig } from '../data/elements';
import type { PlayerObject } from './player';

// 敵の巡回ルート
const ORBIT_POINTS = [
  { x: 0, y: -50 },
  { x: 50, y: 0 },
  { x: 0, y: 50 },
  { x: -50, y: 0 },
];

// 16進数カラーをRGBに変換
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [255, 255, 255];
}

type EnemyBaseObj = GameObj<TextComp | PosComp | AreaComp | AnchorComp | ColorComp>;

export interface EnemyObject extends EnemyBaseObj {
  takeDamage: (amount: number) => void;
  getConfig: () => EnemyConfig;
}

export function createEnemy(
  k: KaboomCtx,
  tag: string,
  startX: number,
  startY: number,
  getPlayer: () => PlayerObject | null,
  stageWidth: number = 800
): EnemyObject | null {
  // タグから設定を取得
  const config = getEnemyConfig(tag);
  if (!config) {
    return null;  // 無効なタグ
  }

  let hp = config.hp;

  // 行動パターン用の状態
  let patrolDirection = Math.random() > 0.5 ? 1 : -1;  // ランダムな初期方向
  let orbitIndex = Math.floor(Math.random() * ORBIT_POINTS.length);  // ランダムな初期位置
  const originPos = { x: startX, y: startY };

  const textWidth = config.displayName.length * 12;

  // 敵オブジェクト
  const enemy = k.add([
    k.text(config.displayName, { size: 16 }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-textWidth / 2, -10), textWidth, 20) }),
    k.anchor('center'),
    k.color(...hexToRgb(config.color)),
    'enemy',
    tag,
  ]) as unknown as EnemyObject;

  // カスタムメソッドを追加
  enemy.getConfig = () => config;

  enemy.takeDamage = (amount: number) => {
    hp -= amount;

    // ダメージエフェクト（一瞬赤くなる）
    enemy.color = k.rgb(255, 0, 0);
    k.wait(0.1, () => {
      if (enemy.exists()) {
        enemy.color = k.rgb(...hexToRgb(config.color));
      }
    });

    if (hp <= 0) {
      // 撃破エフェクト
      spawnDestroyEffect(k, enemy.pos.x, enemy.pos.y, config.color);
      k.destroy(enemy);
    }
  };

  // 移動範囲の制限
  const minX = 50;
  const maxX = stageWidth - 50;

  // 毎フレーム更新
  enemy.onUpdate(() => {
    const player = getPlayer();
    if (!player) return;

    switch (config.behavior) {
      case 'patrol':
        updatePatrol();
        break;
      case 'orbit':
        updateOrbit();
        break;
      case 'chase':
        updateChase(player);
        break;
    }

    // 画面内に制限
    enemy.pos.x = Math.max(minX, Math.min(maxX, enemy.pos.x));
    enemy.pos.y = Math.max(50, Math.min(550, enemy.pos.y));
  });

  // 往復移動
  function updatePatrol() {
    enemy.pos.x += config!.speed * patrolDirection * k.dt();

    // 壁で反転
    if (enemy.pos.x < minX + 50 || enemy.pos.x > maxX - 50) {
      patrolDirection *= -1;
    }
  }

  // 巡回移動
  function updateOrbit() {
    const target = {
      x: originPos.x + ORBIT_POINTS[orbitIndex].x,
      y: originPos.y + ORBIT_POINTS[orbitIndex].y,
    };

    const diff = k.vec2(target.x - enemy.pos.x, target.y - enemy.pos.y);
    const dist = diff.len();

    if (dist < 5) {
      orbitIndex = (orbitIndex + 1) % ORBIT_POINTS.length;
    } else {
      const dir = diff.unit();
      enemy.move(dir.scale(config!.speed));
    }
  }

  // 追尾移動
  function updateChase(player: PlayerObject) {
    const diff = k.vec2(
      player.pos.x - enemy.pos.x,
      player.pos.y - enemy.pos.y
    );
    const dir = diff.unit();
    enemy.move(dir.scale(config!.speed));
  }

  return enemy;
}

// 撃破エフェクト
function spawnDestroyEffect(k: KaboomCtx, x: number, y: number, color: string) {
  const effect = k.add([
    k.text('*', { size: 32 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(...hexToRgb(color)),
    k.opacity(1),
    k.scale(1),
  ]);

  // フェードアウト
  effect.onUpdate(() => {
    effect.opacity -= 2 * k.dt();
    effect.scale = k.vec2(effect.scale.x + 3 * k.dt());
    if (effect.opacity <= 0) {
      k.destroy(effect);
    }
  });
}
