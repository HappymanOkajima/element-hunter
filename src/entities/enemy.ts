import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp } from 'kaboom';
import type { EnemyType, EnemyConfig } from '../types';
import { ENEMY_CONFIGS } from '../data/elements';
import type { PlayerObject } from './player';

// 敵の巡回ルート（div用）
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
  type: EnemyType,
  startX: number,
  startY: number,
  getPlayer: () => PlayerObject | null
): EnemyObject {
  const config = ENEMY_CONFIGS[type];
  let hp = config.hp;

  // 行動パターン用の状態
  let patrolDirection = 1;
  let orbitIndex = 0;
  const originPos = { x: startX, y: startY };

  const textWidth = config.displayName.length * 12;

  // 敵オブジェクト
  const enemy = k.add([
    k.text(config.displayName, { size: 20 }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-textWidth / 2, -12), textWidth, 24) }),
    k.anchor('center'),
    k.color(...hexToRgb(config.color)),
    'enemy',
    type,
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
      spawnDestroyEffect(k, enemy.pos.x, enemy.pos.y);
      k.destroy(enemy);
    }
  };

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
    enemy.pos.x = Math.max(50, Math.min(750, enemy.pos.x));
    enemy.pos.y = Math.max(50, Math.min(550, enemy.pos.y));
  });

  // 往復移動（<p>用）
  function updatePatrol() {
    enemy.pos.x += config.speed * patrolDirection * k.dt();

    // 壁で反転
    if (enemy.pos.x < 100 || enemy.pos.x > 700) {
      patrolDirection *= -1;
    }
  }

  // 巡回移動（<div>用）
  function updateOrbit() {
    const target = {
      x: originPos.x + ORBIT_POINTS[orbitIndex].x,
      y: originPos.y + ORBIT_POINTS[orbitIndex].y,
    };

    const diff = k.vec2(target.x - enemy.pos.x, target.y - enemy.pos.y);
    const dist = diff.len();

    if (dist < 5) {
      // 次の巡回点へ
      orbitIndex = (orbitIndex + 1) % ORBIT_POINTS.length;
    } else {
      // 目標に向かって移動
      const dir = diff.unit();
      enemy.move(dir.scale(config.speed));
    }
  }

  // 追尾移動（<h1>用）
  function updateChase(player: PlayerObject) {
    const diff = k.vec2(
      player.pos.x - enemy.pos.x,
      player.pos.y - enemy.pos.y
    );
    const dir = diff.unit();
    enemy.move(dir.scale(config.speed));
  }

  return enemy;
}

// 撃破エフェクト
function spawnDestroyEffect(k: KaboomCtx, x: number, y: number) {
  const effect = k.add([
    k.text('*', { size: 32 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(255, 255, 0),
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
