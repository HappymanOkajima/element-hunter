import kaboom from 'kaboom';
import { gameScene, setStage, setCrawlData, setCurrentPageIndex } from './scenes/game';
import { loadStageFromCrawl } from './systems/stageLoader';
import { gameState } from './systems/gameState';
import { contentPanel } from './ui/ContentPanel';
import type { CrawlOutput } from './types';

// JSONデータをインポート
import agileStudioData from '../data/sites/agile-studio.json';

// Kaboom.js 初期化（game-area要素に描画）
const gameArea = document.getElementById('game-area');
const k = kaboom({
  width: 800,
  height: 600,
  background: [20, 20, 30],
  font: 'monospace',
  crisp: true,
  debug: false,
  global: false,
  root: gameArea || undefined,
});

// クロールデータを設定
const crawlData = agileStudioData as CrawlOutput;
setCrawlData(crawlData);

// コンテンツパネルに全ページデータを設定
contentPanel.setAllPages(crawlData.pages);

// ターゲットページをランダム選択（5ページ）
// 共通リンク（ナビメニュー）も経路として考慮
gameState.selectTargetPages(crawlData.pages, 5, crawlData.commonLinks);

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

  k.onKeyPress('space', () => {
    // ゲームリセット
    gameState.selectTargetPages(crawlData.pages, 5, crawlData.commonLinks);
    contentPanel.updateTargetList();
    contentPanel.updateProgress();
    contentPanel.startTimer();

    const stage = loadStageFromCrawl(crawlData, 0);
    setStage(stage);
    setCurrentPageIndex(0);
    gameState.pushPage('/');

    k.go('game');
  });
});

// ゲーム完了シーン
k.scene('complete', () => {
  contentPanel.showGameComplete();

  const finalTime = gameState.getFormattedTime();

  k.add([
    k.text('COMPLETE!', { size: 48 }),
    k.pos(k.width() / 2, k.height() / 2 - 80),
    k.anchor('center'),
    k.color(76, 175, 80),
  ]);

  k.add([
    k.text(`Time: ${finalTime}`, { size: 32 }),
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor('center'),
    k.color(255, 204, 0),
  ]);

  k.add([
    k.text('Press SPACE to play again', { size: 20 }),
    k.pos(k.width() / 2, k.height() / 2 + 80),
    k.anchor('center'),
    k.color(200, 200, 200),
  ]);

  k.onKeyPress('space', () => {
    // ゲームリセット
    gameState.selectTargetPages(crawlData.pages, 5, crawlData.commonLinks);
    contentPanel.updateTargetList();
    contentPanel.updateProgress();
    contentPanel.startTimer();

    const stage = loadStageFromCrawl(crawlData, 0);
    setStage(stage);
    setCurrentPageIndex(0);
    gameState.pushPage('/');

    const topPage = crawlData.pages[0];
    if (topPage) {
      contentPanel.updateContent(topPage, false);
    }

    k.go('game');
  });
});

// ゲーム開始
k.go('game');
