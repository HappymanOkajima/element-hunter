import type { GameObj, KaboomCtx, PosComp, AreaComp, AnchorComp, ColorComp, OpacityComp } from 'kaboom';
import type { BossSpawn } from '../types';
import type { PlayerObject } from './player';
import { isGamePaused } from '../scenes/game';
import { playHuntSound, stopBossLoopSound } from '../systems/sound';

// ボスパーツの型
interface BossPart {
  obj: GameObj;
  tag: string;
  angle: number;  // 中心からの角度
}

export interface BossObject extends GameObj<PosComp | AreaComp | AnchorComp | ColorComp | OpacityComp> {
  takeDamage: (amount: number) => void;
  isStopped: () => boolean;
  getHp: () => number;
  getMaxHp: () => number;
  getParts: () => BossPart[];
}

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

// ボス用のカラー（タグごとに色分け）
const BOSS_COLORS: Record<string, string> = {
  section: '#ff6b6b',
  article: '#ffa502',
  aside: '#ff7f50',
  header: '#70a1ff',
  footer: '#5352ed',
  nav: '#2ed573',
  main: '#ff4757',
  figure: '#eccc68',
  figcaption: '#dfe6e9',
  ul: '#a29bfe',
  ol: '#fd79a8',
  table: '#00cec9',
  form: '#e17055',
  default: '#b2bec3',
};

function getColorForTag(tag: string): string {
  return BOSS_COLORS[tag] || BOSS_COLORS.default;
}

export function createBoss(
  k: KaboomCtx,
  bossSpawn: BossSpawn,
  getPlayer: () => PlayerObject | null,
  stageWidth: number = 800
): BossObject | null {
  if (!bossSpawn.parts || bossSpawn.parts.length === 0) {
    return null;
  }

  const { parts, x: startX, y: startY, hp: maxHp } = bossSpawn;

  let hp = maxHp;
  let stopped = false;

  // 回転・移動用の状態
  let rotationAngle = 0;
  const rotationSpeed = 0.8;  // 回転速度（ラジアン/秒）
  const moveSpeed = 40;  // 移動速度
  let moveDirection = { x: 1, y: 0.5 };  // 移動方向

  // 円の半径（パーツ数に応じて調整）
  const radius = Math.min(60 + parts.length * 8, 120);

  // 中心のダミーオブジェクト（当たり判定用）
  const boss = k.add([
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-radius, -radius), radius * 2, radius * 2) }),
    k.anchor('center'),
    k.color(0, 0, 0),
    k.opacity(0),  // 中心は見えない
    'boss',
  ]) as unknown as BossObject;

  // パーツを円形に配置
  const angleStep = (2 * Math.PI) / parts.length;
  const bossParts: BossPart[] = parts.map((tag, i) => {
    const angle = i * angleStep;
    const partX = startX + radius * Math.cos(angle);
    const partY = startY + radius * Math.sin(angle);

    const color = getColorForTag(tag);
    const displayName = `<${tag}>`;

    const partObj = k.add([
      k.text(displayName, { size: 14 }),
      k.pos(partX, partY),
      k.area({ shape: new k.Rect(k.vec2(-30, -10), 60, 20) }),
      k.anchor('center'),
      k.color(...hexToRgb(color)),
      k.opacity(1),
      'bossPart',
      tag,
    ]);

    // パーツにプレイヤーとの当たり判定を追加
    partObj.onCollide('player', () => {
      // ボス本体の当たり判定でダメージ処理
    });

    return {
      obj: partObj,
      tag,
      angle,
    };
  });

  // カスタムメソッド
  boss.isStopped = () => stopped;
  boss.getHp = () => hp;
  boss.getMaxHp = () => maxHp;
  boss.getParts = () => bossParts;

  boss.takeDamage = (amount: number) => {
    if (stopped) return;

    hp -= amount;

    // ダメージエフェクト（全パーツが一瞬赤くなる）
    bossParts.forEach(part => {
      part.obj.color = k.rgb(255, 0, 0);
    });

    k.wait(0.1, () => {
      bossParts.forEach(part => {
        if (part.obj.exists()) {
          if (stopped) {
            part.obj.color = k.rgb(100, 100, 100);
          } else {
            part.obj.color = k.rgb(...hexToRgb(getColorForTag(part.tag)));
          }
        }
      });
    });

    if (hp <= 0) {
      // 停止状態にする
      stopped = true;
      hp = 0;

      // 全パーツをグレー化
      bossParts.forEach(part => {
        part.obj.color = k.rgb(100, 100, 100);
        part.obj.opacity = 0.5;
      });

      // ボスループSE停止
      stopBossLoopSound();

      // ハント音
      playHuntSound();

      // 撃破エフェクト
      spawnBossDefeatEffect(k, boss.pos.x, boss.pos.y);
    }
  };

  // 移動範囲の制限
  const minX = radius + 50;
  const maxX = stageWidth - radius - 50;
  const minY = radius + 50;
  const maxY = 600 - radius - 50;

  // 毎フレーム更新
  boss.onUpdate(() => {
    if (isGamePaused()) return;
    if (stopped) return;

    const player = getPlayer();
    if (!player) return;

    // 回転
    rotationAngle += rotationSpeed * k.dt();

    // 移動
    boss.pos.x += moveDirection.x * moveSpeed * k.dt();
    boss.pos.y += moveDirection.y * moveSpeed * k.dt();

    // 壁で反射
    if (boss.pos.x < minX || boss.pos.x > maxX) {
      moveDirection.x *= -1;
      boss.pos.x = Math.max(minX, Math.min(maxX, boss.pos.x));
    }
    if (boss.pos.y < minY || boss.pos.y > maxY) {
      moveDirection.y *= -1;
      boss.pos.y = Math.max(minY, Math.min(maxY, boss.pos.y));
    }

    // パーツの位置を更新（回転を反映）
    bossParts.forEach((part, i) => {
      const baseAngle = i * angleStep;
      const currentAngle = baseAngle + rotationAngle;
      part.obj.pos.x = boss.pos.x + radius * Math.cos(currentAngle);
      part.obj.pos.y = boss.pos.y + radius * Math.sin(currentAngle);
      part.angle = currentAngle;
    });
  });

  return boss;
}

// ボス撃破エフェクト
function spawnBossDefeatEffect(k: KaboomCtx, x: number, y: number) {
  // BOSS HUNTED! ラベル
  const huntLabel = k.add([
    k.text('BOSS HUNTED!', { size: 24 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(1),
  ]);

  // 上に浮かんでフェードアウト
  huntLabel.onUpdate(() => {
    huntLabel.pos.y -= 40 * k.dt();
    huntLabel.opacity -= 1.0 * k.dt();
    if (huntLabel.opacity <= 0) {
      k.destroy(huntLabel);
    }
  });

  // パーティクル風のエフェクト
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const speed = 100 + Math.random() * 50;

    const particle = k.add([
      k.text('*', { size: 16 }),
      k.pos(x, y),
      k.anchor('center'),
      k.color(255, 220, 100),
      k.opacity(1),
    ]);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    particle.onUpdate(() => {
      particle.pos.x += vx * k.dt();
      particle.pos.y += vy * k.dt();
      particle.opacity -= 1.5 * k.dt();
      if (particle.opacity <= 0) {
        k.destroy(particle);
      }
    });
  }
}

// ボスを破棄（シーン切り替え時用）
export function destroyBoss(boss: BossObject | null) {
  if (!boss) return;

  // パーツを破棄
  const parts = boss.getParts();
  parts.forEach(part => {
    if (part.obj.exists()) {
      part.obj.destroy();
    }
  });

  // 中心を破棄
  if (boss.exists()) {
    boss.destroy();
  }
}
