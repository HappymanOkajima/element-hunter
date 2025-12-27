import kaboom from 'kaboom';
import { gameScene } from './scenes/game';

// Kaboom.js 初期化
const k = kaboom({
  width: 800,
  height: 600,
  background: [20, 20, 30],
  font: 'monospace',
  crisp: true,
  debug: false,
  global: false,
});

// ゲームシーン登録
k.scene('game', () => gameScene(k));

// ゲームオーバーシーン
k.scene('gameover', () => {
  k.add([
    k.text('GAME OVER', { size: 48 }),
    k.pos(k.width() / 2, k.height() / 2 - 50),
    k.anchor('center'),
    k.color(255, 0, 0),
  ]);

  k.add([
    k.text('Press SPACE to retry', { size: 24 }),
    k.pos(k.width() / 2, k.height() / 2 + 50),
    k.anchor('center'),
  ]);

  k.onKeyPress('space', () => k.go('game'));
});

// クリアシーン
k.scene('clear', () => {
  k.add([
    k.text('STAGE CLEAR!', { size: 48 }),
    k.pos(k.width() / 2, k.height() / 2 - 50),
    k.anchor('center'),
    k.color(0, 255, 100),
  ]);

  k.add([
    k.text('Press SPACE to continue', { size: 24 }),
    k.pos(k.width() / 2, k.height() / 2 + 50),
    k.anchor('center'),
  ]);

  k.onKeyPress('space', () => k.go('game'));
});

// ゲーム開始
k.go('game');
