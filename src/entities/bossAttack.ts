import type { GameObj, KaboomCtx } from 'kaboom';
import type { PlayerObject } from './player';
import { isGamePaused } from '../scenes/game';
import { playHrWarningSound, playHrFireSound, playBrDropSound } from '../systems/sound';

// ボス攻撃の基本インターフェース
export interface BossAttack {
  update: () => void;
  destroy: () => void;
  isActive: () => boolean;
}

// <hr> 攻撃: 画面を横断するレーザー
export function createHrAttack(
  k: KaboomCtx,
  _bossX: number,  // 未使用（全画面横断のため）
  bossY: number,
  getPlayer: () => PlayerObject | null,
  stageWidth: number = 800
): BossAttack {
  let active = true;
  const objects: GameObj[] = [];

  // 警告ライン（点滅）
  const warningY = bossY;
  const warning = k.add([
    k.rect(stageWidth, 4),
    k.pos(stageWidth / 2, warningY),
    k.anchor('center'),
    k.color(255, 100, 100),
    k.opacity(0.5),
    'bossAttackWarning',
  ]);
  objects.push(warning);

  // 警告テキスト
  const warningLabel = k.add([
    k.text('<hr>', { size: 12 }),
    k.pos(stageWidth / 2, warningY - 20),
    k.anchor('center'),
    k.color(255, 150, 150),
    k.opacity(0.8),
  ]);
  objects.push(warningLabel);

  // 警告SE再生
  playHrWarningSound();

  let warningTime = 0;
  const CHARGE_TIME = 1.0;  // 警告時間
  let fired = false;

  // レーザー本体
  let laser: GameObj | null = null;
  let laserGlow: GameObj | null = null;
  let laserTime = 0;
  const LASER_DURATION = 0.5;  // レーザー持続時間

  const update = () => {
    if (!active || isGamePaused()) return;

    const player = getPlayer();

    if (!fired) {
      // 警告フェーズ
      warningTime += k.dt();
      warning.opacity = 0.3 + Math.sin(warningTime * 15) * 0.3;
      warningLabel.opacity = 0.5 + Math.sin(warningTime * 15) * 0.3;

      if (warningTime >= CHARGE_TIME) {
        // レーザー発射
        fired = true;
        warning.opacity = 0;
        warningLabel.opacity = 0;

        // 発射SE
        playHrFireSound();

        // レーザー生成
        laser = k.add([
          k.rect(stageWidth, 20),
          k.pos(stageWidth / 2, warningY),
          k.area(),
          k.anchor('center'),
          k.color(255, 50, 50),
          k.opacity(1),
          'bossAttack',
        ]);
        objects.push(laser);

        // グロー効果
        laserGlow = k.add([
          k.rect(stageWidth, 40),
          k.pos(stageWidth / 2, warningY),
          k.anchor('center'),
          k.color(255, 100, 100),
          k.opacity(0.5),
          k.z(-1),
        ]);
        objects.push(laserGlow);

        // 当たり判定
        if (laser) {
          laser.onCollide('player', () => {
            if (player) {
              player.takeDamage(1);
            }
          });
        }
      }
    } else {
      // レーザーフェーズ
      laserTime += k.dt();

      if (laser && laserGlow) {
        // フェードアウト
        const fadeProgress = laserTime / LASER_DURATION;
        laser.opacity = 1 - fadeProgress;
        laserGlow.opacity = 0.5 * (1 - fadeProgress);

        if (laserTime >= LASER_DURATION) {
          active = false;
        }
      }
    }
  };

  const destroy = () => {
    active = false;
    objects.forEach(obj => {
      if (obj.exists()) {
        k.destroy(obj);
      }
    });
  };

  const isActive = () => active;

  return { update, destroy, isActive };
}

// <br> 攻撃: 上から降ってくる改行弾
export function createBrAttack(
  k: KaboomCtx,
  bossX: number,
  bossY: number,
  getPlayer: () => PlayerObject | null,
  stageWidth: number = 800
): BossAttack {
  let active = true;
  const objects: GameObj[] = [];
  const bullets: Array<{ obj: GameObj; vy: number }> = [];

  // 弾の数と配置
  const BULLET_COUNT = 5;
  const FALL_SPEED = 200;
  const SPREAD = 150;

  // 発射位置を決定（ボス位置を中心に広がる）
  for (let i = 0; i < BULLET_COUNT; i++) {
    const offsetX = (i - (BULLET_COUNT - 1) / 2) * (SPREAD / (BULLET_COUNT - 1) * 2);
    const bulletX = Math.max(50, Math.min(stageWidth - 50, bossX + offsetX));
    const bulletY = bossY - 30;

    // 警告マーカー
    const marker = k.add([
      k.text('↓', { size: 16 }),
      k.pos(bulletX, 30),
      k.anchor('center'),
      k.color(255, 200, 100),
      k.opacity(0.8),
    ]);
    objects.push(marker);

    // 少し遅延して弾を生成
    k.wait(0.3 + i * 0.1, () => {
      if (!active) return;

      // マーカー削除
      if (marker.exists()) {
        k.destroy(marker);
      }

      // 落下SE
      playBrDropSound();

      // 弾生成
      const bullet = k.add([
        k.text('<br>', { size: 14 }),
        k.pos(bulletX, bulletY),
        k.area(),
        k.anchor('center'),
        k.color(255, 180, 100),
        k.opacity(1),
        'bossAttack',
      ]);
      objects.push(bullet);
      bullets.push({ obj: bullet, vy: FALL_SPEED });

      // 当たり判定
      const player = getPlayer();
      bullet.onCollide('player', () => {
        if (player) {
          player.takeDamage(1);
        }
        // 当たったら消える
        if (bullet.exists()) {
          k.destroy(bullet);
        }
      });
    });
  }

  const update = () => {
    if (!active || isGamePaused()) return;

    // 弾を落下させる
    bullets.forEach(({ obj, vy }) => {
      if (obj.exists()) {
        obj.pos.y += vy * k.dt();

        // 画面外に出たら削除
        if (obj.pos.y > 650) {
          k.destroy(obj);
        }
      }
    });

    // 全ての弾が消えたら終了
    const remainingBullets = bullets.filter(b => b.obj.exists());
    if (remainingBullets.length === 0 && bullets.length > 0) {
      // 発射待ちの弾がなくなったら非アクティブに
      k.wait(0.5, () => {
        active = false;
      });
    }
  };

  const destroy = () => {
    active = false;
    objects.forEach(obj => {
      if (obj.exists()) {
        k.destroy(obj);
      }
    });
  };

  const isActive = () => active;

  return { update, destroy, isActive };
}
