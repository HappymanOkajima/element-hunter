import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp, OpacityComp } from 'kaboom';
import type { EnemyConfig } from '../types';
import { getEnemyConfig } from '../data/elements';
import type { PlayerObject } from './player';
import { isGamePaused } from '../scenes/game';
import { playHuntSound } from '../systems/sound';

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
  getSampleText: () => string | undefined;
  getSampleImageUrl: () => string | undefined;
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
  stageWidth: number = 800,
  sampleText?: string,
  sampleImageUrl?: string
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

  // 当たり判定はサイズに比例（テキスト幅を考慮して横長に）
  const hitboxHeight = Math.max(20, config.size);
  const hitboxWidth = Math.max(40, config.size * 2.5);  // テキストは横に長い

  // 敵オブジェクト（レアリティに応じたサイズ）
  const enemy = k.add([
    k.text(config.displayName, { size: config.size }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-hitboxWidth / 2, -hitboxHeight / 2), hitboxWidth, hitboxHeight) }),
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
  enemy.getSampleText = () => sampleText;
  enemy.getSampleImageUrl = () => sampleImageUrl;

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

      // ハント音
      playHuntSound();

      // 停止エフェクト（サンプルテキスト/画像があれば表示）
      spawnStopEffect(k, enemy.pos.x, enemy.pos.y, sampleText, sampleImageUrl);
    }
  };

  // 移動範囲の制限
  const minX = 50;
  const maxX = stageWidth - 50;

  // 毎フレーム更新
  enemy.onUpdate(() => {
    // ポーズ中は処理しない
    if (isGamePaused()) return;

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

// ハントエフェクト（サンプルテキスト/画像があれば表示）
function spawnStopEffect(k: KaboomCtx, x: number, y: number, sampleText?: string, sampleImageUrl?: string) {
  // HUNT!ラベル
  const huntLabel = k.add([
    k.text('HUNT!', { size: 14 }),
    k.pos(x, y - 20),
    k.anchor('center'),
    k.color(255, 200, 100),
    k.opacity(1),
  ]);

  // 上に浮かんでフェードアウト
  huntLabel.onUpdate(() => {
    huntLabel.pos.y -= 30 * k.dt();
    huntLabel.opacity -= 1.5 * k.dt();
    if (huntLabel.opacity <= 0) {
      k.destroy(huntLabel);
    }
  });

  // 画像があれば表示（imgタグ用）
  if (sampleImageUrl) {
    // カメラ位置を考慮してスクリーン座標を計算
    const cam = k.camPos();
    const screenX = x - cam.x + k.width() / 2;
    const screenY = y - cam.y + k.height() / 2;
    showHuntedImage(sampleImageUrl, screenX, screenY);
  }
  // サンプルテキストがあれば表示（空文字列は除外）
  else if (sampleText && sampleText.trim().length > 0) {
    // 表示用テキストを準備（制御文字を除去）
    const displayText = sampleText.trim().replace(/[\x00-\x1F\x7F]/g, '');
    if (displayText.length === 0) return;  // 制御文字のみだった場合はスキップ

    try {
      const textEffect = k.add([
        k.text(`"${displayText}"`, { size: 12 }),
        k.pos(x, y - 40),
        k.anchor('center'),
        k.color(200, 220, 255),
        k.opacity(0),
      ]);

      // ふわっと表示してフェードアウト
      let time = 0;
      textEffect.onUpdate(() => {
        time += k.dt();

        // 最初の0.3秒でフェードイン
        if (time < 0.3) {
          textEffect.opacity = time / 0.3;
        }
        // 0.3〜1.5秒は表示
        else if (time < 1.5) {
          textEffect.opacity = 1;
          textEffect.pos.y -= 10 * k.dt();  // ゆっくり上昇
        }
        // 1.5秒以降でフェードアウト
        else {
          textEffect.opacity -= 1.5 * k.dt();
          textEffect.pos.y -= 20 * k.dt();
          if (textEffect.opacity <= 0) {
            k.destroy(textEffect);
          }
        }
      });
    } catch {
      // テキスト描画に失敗した場合は無視
    }
  }
}

// ハントした画像をDOM上に表示（Kaboomではなく実際の画像）
function showHuntedImage(imageUrl: string, gameX: number, gameY: number) {
  // ゲームエリアの位置を取得
  const gameArea = document.getElementById('game-area');
  if (!gameArea) return;

  const rect = gameArea.getBoundingClientRect();

  // キャンバスのスケール計算（800x600が実際の表示サイズに縮小されている）
  const scaleX = rect.width / 800;
  const scaleY = rect.height / 600;

  // 画像要素を作成
  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.position = 'fixed';
  // スケールに応じて画像サイズも調整
  const maxImgWidth = Math.min(150 * scaleX, 150);
  const maxImgHeight = Math.min(100 * scaleY, 100);
  img.style.maxWidth = `${maxImgWidth}px`;
  img.style.maxHeight = `${maxImgHeight}px`;
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0 4px 12px rgba(0, 200, 255, 0.5)';
  img.style.border = '2px solid rgba(0, 200, 255, 0.8)';
  img.style.zIndex = '1000';
  img.style.pointerEvents = 'none';
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-out';
  img.style.transform = 'scale(0.8)';

  // ゲーム座標をスクリーン座標に変換（スケールを考慮）
  const screenX = rect.left + gameX * scaleX;
  const screenY = rect.top + gameY * scaleY;
  const offsetY = 60 * scaleY;
  img.style.left = `${screenX}px`;
  img.style.top = `${screenY - offsetY}px`;

  document.body.appendChild(img);

  // 画像読み込み後にアニメーション開始
  img.onload = () => {
    // 位置を中央揃え
    img.style.left = `${screenX - img.offsetWidth / 2}px`;
    img.style.top = `${screenY - offsetY - img.offsetHeight / 2}px`;

    // フェードイン
    requestAnimationFrame(() => {
      img.style.opacity = '1';
      img.style.transform = 'scale(1)';
    });

    // 2秒後にフェードアウト
    setTimeout(() => {
      img.style.opacity = '0';
      img.style.transform = 'scale(0.8) translateY(-20px)';

      // 完全に消えたら削除
      setTimeout(() => {
        img.remove();
      }, 300);
    }, 2000);
  };

  // 読み込みエラー時は削除
  img.onerror = () => {
    img.remove();
  };
}
