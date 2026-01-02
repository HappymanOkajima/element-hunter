import type { GameObj, KaboomCtx } from 'kaboom';
import type { PlayerObject } from './player';
import { isGamePaused } from '../scenes/game';
import { playHrWarningSound, playHrFireSound, playBrDropSound, playTableWarningSound, playTableFireSound } from '../systems/sound';

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
  stageWidth: number = 800,
  stageHeight: number = 600
): BossAttack {
  let active = true;
  const objects: GameObj[] = [];

  // 警告ライン（点滅）- 画面内に収める
  const warningY = Math.max(80, Math.min(stageHeight - 80, bossY));
  const warning = k.add([
    k.rect(stageWidth, 4),
    k.pos(stageWidth / 2, warningY),
    k.anchor('center'),
    k.color(255, 100, 100),
    k.opacity(0.5),
    'bossAttackWarning',
  ]);
  objects.push(warning);

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
      warning.opacity = 0.4 + Math.sin(warningTime * 10) * 0.3;

      if (warningTime >= CHARGE_TIME) {
        // レーザー発射
        fired = true;
        warning.opacity = 0;

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
  let bulletsSpawned = 0;  // 生成された弾の数
  let endingStarted = false;  // 終了処理開始フラグ
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

    // 警告マーカー（↓）
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
      bulletsSpawned++;

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

    // 全ての弾が生成され、かつ消えたら終了（一度だけ）
    if (bulletsSpawned === BULLET_COUNT && !endingStarted) {
      const remainingBullets = bullets.filter(b => b.obj.exists());
      if (remainingBullets.length === 0) {
        endingStarted = true;
        active = false;
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

// <table> 攻撃: 縦横のグリッドレーザー
export function createTableAttack(
  k: KaboomCtx,
  _bossX: number,
  _bossY: number,
  getPlayer: () => PlayerObject | null,
  stageWidth: number = 800,
  stageHeight: number = 600
): BossAttack {
  let active = true;
  const objects: GameObj[] = [];

  const player = getPlayer();
  const playerX = player?.pos.x ?? stageWidth / 2;
  const playerY = player?.pos.y ?? stageHeight / 2;

  // グリッド設定（横2本、縦2本で3x3の格子）
  const CHARGE_TIME = 1.2;  // 警告時間（少し長め）
  const LASER_DURATION = 0.6;  // レーザー持続時間

  // プレイヤー位置を基準にレーザー配置（挟み込むように）
  // 横レーザー: プレイヤーの上下に配置
  const LASER_OFFSET = 80;  // プレイヤーからのオフセット
  const horizontalYPositions: number[] = [
    Math.max(60, Math.min(stageHeight - 60, playerY - LASER_OFFSET)),
    Math.max(60, Math.min(stageHeight - 60, playerY + LASER_OFFSET)),
  ];

  // 縦レーザー: プレイヤーの左右に配置
  const verticalXPositions: number[] = [
    Math.max(60, Math.min(stageWidth - 60, playerX - LASER_OFFSET)),
    Math.max(60, Math.min(stageWidth - 60, playerX + LASER_OFFSET)),
  ];

  // 警告SE再生
  playTableWarningSound();

  // 横レーザーの警告ライン
  const horizontalWarnings: GameObj[] = [];
  horizontalYPositions.forEach(y => {
    const warning = k.add([
      k.rect(stageWidth, 4),
      k.pos(stageWidth / 2, y),
      k.anchor('center'),
      k.color(255, 150, 50),  // オレンジ系で区別
      k.opacity(0.5),
      'bossAttackWarning',
    ]);
    objects.push(warning);
    horizontalWarnings.push(warning);
  });

  // 縦レーザーの警告ライン
  const verticalWarnings: GameObj[] = [];
  verticalXPositions.forEach(x => {
    const warning = k.add([
      k.rect(4, stageHeight),
      k.pos(x, stageHeight / 2),
      k.anchor('center'),
      k.color(255, 150, 50),
      k.opacity(0.5),
      'bossAttackWarning',
    ]);
    objects.push(warning);
    verticalWarnings.push(warning);
  });

  let warningTime = 0;
  let fired = false;
  let laserTime = 0;

  // レーザー本体の配列
  const horizontalLasers: Array<{ laser: GameObj; glow: GameObj }> = [];
  const verticalLasers: Array<{ laser: GameObj; glow: GameObj }> = [];

  const update = () => {
    if (!active || isGamePaused()) return;

    const player = getPlayer();

    if (!fired) {
      // 警告フェーズ
      warningTime += k.dt();
      const blinkSpeed = 8 + warningTime * 3;  // 加速を抑えた点滅
      const opacity = 0.4 + Math.sin(warningTime * blinkSpeed) * 0.3;

      // 全警告ラインを点滅
      horizontalWarnings.forEach(w => { w.opacity = opacity; });
      verticalWarnings.forEach(w => { w.opacity = opacity; });

      if (warningTime >= CHARGE_TIME) {
        // レーザー発射
        fired = true;

        // 警告を非表示
        horizontalWarnings.forEach(w => { w.opacity = 0; });
        verticalWarnings.forEach(w => { w.opacity = 0; });

        // 発射SE
        playTableFireSound();

        // 横レーザー生成
        horizontalYPositions.forEach(y => {
          const laser = k.add([
            k.rect(stageWidth, 20),
            k.pos(stageWidth / 2, y),
            k.area(),
            k.anchor('center'),
            k.color(255, 100, 50),
            k.opacity(1),
            'bossAttack',
          ]);
          objects.push(laser);

          const glow = k.add([
            k.rect(stageWidth, 40),
            k.pos(stageWidth / 2, y),
            k.anchor('center'),
            k.color(255, 150, 100),
            k.opacity(0.5),
            k.z(-1),
          ]);
          objects.push(glow);

          horizontalLasers.push({ laser, glow });

          // 当たり判定
          laser.onCollide('player', () => {
            if (player) {
              player.takeDamage(1);
            }
          });
        });

        // 縦レーザー生成
        verticalXPositions.forEach(x => {
          const laser = k.add([
            k.rect(20, stageHeight),
            k.pos(x, stageHeight / 2),
            k.area(),
            k.anchor('center'),
            k.color(255, 100, 50),
            k.opacity(1),
            'bossAttack',
          ]);
          objects.push(laser);

          const glow = k.add([
            k.rect(40, stageHeight),
            k.pos(x, stageHeight / 2),
            k.anchor('center'),
            k.color(255, 150, 100),
            k.opacity(0.5),
            k.z(-1),
          ]);
          objects.push(glow);

          verticalLasers.push({ laser, glow });

          // 当たり判定
          laser.onCollide('player', () => {
            if (player) {
              player.takeDamage(1);
            }
          });
        });
      }
    } else {
      // レーザーフェーズ
      laserTime += k.dt();
      const fadeProgress = laserTime / LASER_DURATION;

      // 全レーザーをフェードアウト
      horizontalLasers.forEach(({ laser, glow }) => {
        laser.opacity = 1 - fadeProgress;
        glow.opacity = 0.5 * (1 - fadeProgress);
      });

      verticalLasers.forEach(({ laser, glow }) => {
        laser.opacity = 1 - fadeProgress;
        glow.opacity = 0.5 * (1 - fadeProgress);
      });

      if (laserTime >= LASER_DURATION) {
        active = false;
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
