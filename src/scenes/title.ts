import type { KaboomCtx } from 'kaboom';

export function titleScene(k: KaboomCtx, siteName: string, onStart: () => void) {
  // 背景
  k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(20, 20, 30),
  ]);

  // タイトルロゴ
  k.add([
    k.text('E L E M E N T', { size: 48 }),
    k.pos(k.width() / 2, 100),
    k.anchor('center'),
    k.color(0, 200, 255),
  ]);

  k.add([
    k.text('H U N T E R', { size: 48 }),
    k.pos(k.width() / 2, 160),
    k.anchor('center'),
    k.color(255, 200, 100),
  ]);

  // ストーリーテキスト（80年代風：英語大文字）
  const storyLines = [
    'I AM THE ELEMENT HUNTER.',
    'MY JOB IS TO HUNT ESCAPED HTML ELEMENTS.',
    '',
    `TODAY'S STAGE: ${siteName.toUpperCase()}`,
    "LET'S CATCH THEM ALL",
    'AND RECLAIM THE CONTENTS!',
  ];

  let yOffset = 240;
  for (const line of storyLines) {
    if (line === '') {
      yOffset += 10;
      continue;
    }
    k.add([
      k.text(line, { size: 16 }),
      k.pos(k.width() / 2, yOffset),
      k.anchor('center'),
      k.color(200, 200, 200),
    ]);
    yOffset += 28;
  }

  // "PRESS SPACE TO START" 点滅
  const startLabel = k.add([
    k.text('[ PRESS SPACE TO START ]', { size: 20 }),
    k.pos(k.width() / 2, 500),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.opacity(1),
  ]);

  // 点滅アニメーション
  let blinkTime = 0;
  startLabel.onUpdate(() => {
    blinkTime += k.dt();
    // sin波で0.3〜1.0の間を往復
    startLabel.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(blinkTime * 4));
  });

  // SPACEキーでゲーム開始
  k.onKeyPress('space', () => {
    // フェードアウト演出
    const overlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.z(100),
    ]);

    k.tween(
      0,
      1,
      0.3,
      (val) => {
        overlay.opacity = val;
      },
      k.easings.easeOutQuad
    ).onEnd(() => {
      onStart();
    });
  });
}
