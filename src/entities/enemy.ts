import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp, OpacityComp } from 'kaboom';
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

type EnemyBaseObj = GameObj<TextComp | PosComp | AreaComp | AnchorComp | ColorComp | OpacityComp>;

export interface EnemyObject extends EnemyBaseObj {
  takeDamage: (amount: number) => void;
  getConfig: () => EnemyConfig;
  isStopped: () => boolean;
  getHp: () => number;
  getId: () => string;
  setInitialState: (hp: number, stopped: boolean, x: number, y: number) => void;
}

// ユニークID生成用カウンター
let enemyIdCounter = 0;

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

  // ユニークID
  const enemyId = `enemy_${tag}_${enemyIdCounter++}`;

  let hp = config.hp;
  let stopped = false;  // 停止状態

  // 行動パターン用の状態
  let patrolDirection = Math.random() > 0.5 ? 1 : -1;  // ランダムな初期方向
  let orbitIndex = Math.floor(Math.random() * ORBIT_POINTS.length);  // ランダムな初期位置
  const originPos = { x: startX, y: startY };

  // 当たり判定は固定サイズ（見た目より小さめ）
  const hitboxSize = 20;

  // 敵オブジェクト
  const enemy = k.add([
    k.text(config.displayName, { size: 16 }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-hitboxSize / 2, -hitboxSize / 2), hitboxSize, hitboxSize) }),
    k.anchor('center'),
    k.color(...hexToRgb(config.color)),
    k.opacity(1),
    'enemy',
    tag,
  ]) as unknown as EnemyObject;

  // カスタムメソッドを追加
  enemy.getConfig = () => config;
  enemy.isStopped = () => stopped;
  enemy.getHp = () => hp;
  enemy.getId = () => enemyId;

  // 初期状態を設定（ページ再訪問時に使用）
  enemy.setInitialState = (initialHp: number, initialStopped: boolean, x: number, y: number) => {
    hp = initialHp;
    stopped = initialStopped;
    enemy.pos.x = x;
    enemy.pos.y = y;
    if (stopped) {
      enemy.color = k.rgb(100, 100, 100);  // グレー化
      enemy.opacity = 0.5;
    }
  };

  enemy.takeDamage = (amount: number) => {
    if (stopped) return;  // 既に停止している場合は無視

    hp -= amount;

    // ダメージエフェクト（一瞬赤くなる）
    enemy.color = k.rgb(255, 0, 0);
    k.wait(0.1, () => {
      if (enemy.exists()) {
        if (stopped) {
          enemy.color = k.rgb(100, 100, 100);  // 停止中はグレー
        } else {
          enemy.color = k.rgb(...hexToRgb(config.color));
        }
      }
    });

    if (hp <= 0) {
      // 停止状態にする（消えない）
      stopped = true;
      hp = 0;
      enemy.color = k.rgb(100, 100, 100);  // グレー化
      enemy.opacity = 0.5;

      // 停止エフェクト
      spawnStopEffect(k, enemy.pos.x, enemy.pos.y);
    }
  };

  // 移動範囲の制限
  const minX = 50;
  const maxX = stageWidth - 50;

  // 毎フレーム更新
  enemy.onUpdate(() => {
    // 停止中は動かない
    if (stopped) return;

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

// 停止エフェクト
function spawnStopEffect(k: KaboomCtx, x: number, y: number) {
  const effect = k.add([
    k.text('STOP', { size: 16 }),
    k.pos(x, y - 20),
    k.anchor('center'),
    k.color(150, 150, 150),
    k.opacity(1),
  ]);

  // 上に浮かんでフェードアウト
  effect.onUpdate(() => {
    effect.pos.y -= 30 * k.dt();
    effect.opacity -= 1.5 * k.dt();
    if (effect.opacity <= 0) {
      k.destroy(effect);
    }
  });
}
