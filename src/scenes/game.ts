import type { KaboomCtx } from 'kaboom';
import { createPlayer, type PlayerObject } from '../entities/player';
import { createEnemy, type EnemyObject } from '../entities/enemy';
import type { EnemyType, StageConfig } from '../types';

// チュートリアルステージ設定
const TUTORIAL_STAGE: StageConfig = {
  enemies: [
    { type: 'p', x: 300, y: 200 },
    { type: 'p', x: 400, y: 400 },
    { type: 'div', x: 500, y: 300 },
    { type: 'h1', x: 650, y: 300 },
  ],
  goalX: 770,
};

export function gameScene(k: KaboomCtx) {
  // ゲーム状態
  let isPaused = false;
  let player: PlayerObject | null = null;

  // --- UI描画 ---

  // HP表示ラベル
  const hpLabel = k.add([
    k.text('HP: *****', { size: 20 }),
    k.pos(20, 20),
    k.color(255, 100, 100),
    k.fixed(),
  ]);

  // ステージ名表示
  k.add([
    k.text('TUTORIAL', { size: 16 }),
    k.pos(k.width() - 20, 20),
    k.anchor('topright'),
    k.color(150, 150, 150),
    k.fixed(),
  ]);

  // HP表示更新
  function updateHpDisplay() {
    if (!player) return;
    const state = player.getState();
    const hearts = '*'.repeat(state.hp) + '-'.repeat(state.maxHp - state.hp);
    hpLabel.text = `HP: ${hearts}`;
  }

  // 毎フレームHP更新
  k.onUpdate(() => {
    if (!isPaused) {
      updateHpDisplay();
    }
  });

  // --- プレイヤー生成 ---
  player = createPlayer(k);

  // --- 敵生成 ---
  TUTORIAL_STAGE.enemies.forEach((enemyData) => {
    createEnemy(
      k,
      enemyData.type as EnemyType,
      enemyData.x,
      enemyData.y,
      () => player
    );
  });

  // --- ゴール生成 ---
  k.add([
    k.text('[GOAL]', { size: 24 }),
    k.pos(TUTORIAL_STAGE.goalX, k.height() / 2),
    k.area({ shape: new k.Rect(k.vec2(-30, -50), 60, 100) }),
    k.anchor('center'),
    k.color(0, 255, 100),
    'goal',
  ]);

  // --- 衝突判定 ---

  // プレイヤー vs 敵
  k.onCollide('player', 'enemy', (_p, e) => {
    if (player) {
      const config = (e as EnemyObject).getConfig();
      player.takeDamage(config.damage);
    }
  });

  // 剣 vs 敵
  k.onCollide('sword', 'enemy', (_s, e) => {
    (e as EnemyObject).takeDamage(1);
  });

  // プレイヤー vs ゴール
  k.onCollide('player', 'goal', () => {
    k.go('clear');
  });

  // --- ポーズ機能 ---
  k.onKeyPress('escape', () => {
    isPaused = !isPaused;

    if (isPaused) {
      // ポーズオーバーレイ表示
      k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.7),
        k.fixed(),
        'pauseOverlay',
      ]);

      k.add([
        k.text('PAUSED', { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.fixed(),
        'pauseOverlay',
      ]);

      k.add([
        k.text('Press ESC to resume', { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 60),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.fixed(),
        'pauseOverlay',
      ]);

    } else {
      // ポーズオーバーレイ削除
      k.get('pauseOverlay').forEach((obj) => k.destroy(obj));
    }
  });
}
