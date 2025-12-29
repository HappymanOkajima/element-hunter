import kaboom from 'kaboom';
import { gameScene, setStage, setCrawlData, setCurrentPageIndex } from './scenes/game';
import { titleScene, type GameMode } from './scenes/title';
import { loadStageFromCrawl } from './systems/stageLoader';
import { gameState } from './systems/gameState';
import { contentPanel } from './ui/ContentPanel';
import { playGameOverSound } from './systems/sound';
import { isTouchDevice } from './ui/VirtualJoystick';
import type { CrawlOutput } from './types';

// JSONデータをインポート
import agileStudioData from '../data/sites/agile-studio.json';

// Kaboom.js 初期化（game-area要素に描画）
const gameArea = document.getElementById('game-area');
const k = kaboom({
  width: 800,
  height: 600,
  background: [20, 20, 30],
  debug: false,
  global: false,
  root: gameArea || undefined,
});

// クロールデータを設定
const crawlData = agileStudioData as CrawlOutput;
setCrawlData(crawlData);

// コンテンツパネルに全ページデータを設定
contentPanel.setAllPages(crawlData.pages);

// ゲーム初期化処理
function initGame(mode: GameMode) {
  // ゲームモードを保存
  gameState.setGameMode(mode);

  // モードに応じてターゲットページを選択
  if (mode === 'easy') {
    gameState.selectEasyTargetPages(crawlData.pages, crawlData.commonLinks);
  } else {
    gameState.selectTargetPages(crawlData.pages, 5, crawlData.commonLinks);
  }

  // コンテンツパネルをゲーム用レイアウトに切り替え
  contentPanel.showGameLayout();

  // コンテンツパネルの初期表示
  contentPanel.updateTargetList();
  contentPanel.updateProgress();
  contentPanel.startTimer();

  // トップページをステージとして読み込み
  const stage = loadStageFromCrawl(crawlData, 0);
  setStage(stage);
  setCurrentPageIndex(0);
  gameState.pushPage('/');

  // 初期コンテンツを表示
  const topPage = crawlData.pages[0];
  if (topPage) {
    contentPanel.updateContent(topPage, false);
  }

  k.go('game');
}

// タイトルシーン登録
k.scene('title', () => titleScene(k, crawlData.siteName, initGame));

// ゲームシーン登録
k.scene('game', () => gameScene(k));

// ゲームオーバーシーン
k.scene('gameover', () => {
  playGameOverSound();

  k.add([
    k.text('GAME OVER', { size: 48 }),
    k.pos(k.width() / 2, k.height() / 2 - 50),
    k.anchor('center'),
    k.color(255, 0, 0),
  ]);

  const isTouch = isTouchDevice();
  if (!isTouch) {
    k.add([
      k.text('PRESS SPACE TO RETURN TO TITLE', { size: 20 }),
      k.pos(k.width() / 2, k.height() / 2 + 50),
      k.anchor('center'),
      k.color(200, 200, 200),
    ]);
  }

  const returnToTitle = () => {
    k.go('title');
  };

  k.onKeyPress('space', returnToTitle);

  if (isTouch) {
    k.onTouchStart(returnToTitle);
  }
});

// ゲーム完了シーン
k.scene('complete', () => {
  const finalTimeMs = gameState.getElapsedTime();
  const finalTime = gameState.getFormattedTime();
  const mode = gameState.getGameMode();

  // ベストタイムを保存し、新記録かどうか判定
  const isNewRecord = gameState.saveBestTime(crawlData.siteName, mode, finalTimeMs);

  // コンテンツパネルに結果を表示
  contentPanel.showGameComplete(crawlData.siteName, mode, isNewRecord);

  k.add([
    k.text('COMPLETE!', { size: 48 }),
    k.pos(k.width() / 2, k.height() / 2 - 80),
    k.anchor('center'),
    k.color(76, 175, 80),
  ]);

  k.add([
    k.text(`TIME: ${finalTime}`, { size: 32 }),
    k.pos(k.width() / 2, k.height() / 2 - 20),
    k.anchor('center'),
    k.color(255, 204, 0),
  ]);

  // 新記録表示
  if (isNewRecord) {
    const recordLabel = k.add([
      k.text('NEW RECORD!', { size: 24 }),
      k.pos(k.width() / 2, k.height() / 2 + 30),
      k.anchor('center'),
      k.color(255, 100, 100),
      k.opacity(1),
    ]);

    // 点滅エフェクト
    recordLabel.onUpdate(() => {
      recordLabel.opacity = 0.6 + Math.sin(k.time() * 8) * 0.4;
    });
  } else {
    // ベストタイムとの差を表示
    const bestTime = gameState.formatBestTime(crawlData.siteName, mode);
    if (bestTime) {
      k.add([
        k.text(`BEST: ${bestTime}`, { size: 18 }),
        k.pos(k.width() / 2, k.height() / 2 + 30),
        k.anchor('center'),
        k.color(150, 150, 150),
      ]);
    }
  }

  const isTouch = isTouchDevice();
  if (!isTouch) {
    k.add([
      k.text('PRESS SPACE TO PLAY AGAIN', { size: 20 }),
      k.pos(k.width() / 2, k.height() / 2 + 80),
      k.anchor('center'),
      k.color(200, 200, 200),
    ]);
  }

  const returnToTitle = () => {
    k.go('title');
  };

  k.onKeyPress('space', returnToTitle);

  if (isTouch) {
    k.onTouchStart(returnToTitle);
  }
});

// タイトル画面から開始
k.go('title');
