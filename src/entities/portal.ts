import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp, OpacityComp } from 'kaboom';
import { isGamePaused } from '../scenes/game';

type PortalBaseObj = GameObj<TextComp | PosComp | AreaComp | AnchorComp | ColorComp | OpacityComp>;

export interface PortalObject extends PortalBaseObj {
  getLink: () => string;
  getTargetPageIndex: () => number | null;
  isAccessible: () => boolean;
}

// ポータルの色
const PORTAL_COLOR_UNVISITED: [number, number, number] = [0, 200, 255];  // 水色（未訪問）
const PORTAL_COLOR_VISITED: [number, number, number] = [180, 100, 255];  // 紫（訪問済み）
const PORTAL_COLOR_INACCESSIBLE: [number, number, number] = [100, 100, 100];  // グレー（遷移不可）
const PORTAL_COLOR_TARGET: [number, number, number] = [255, 215, 0];  // 金色（ターゲット）
const PORTAL_COLOR_LEADS_TO_TARGET: [number, number, number] = [100, 255, 100];  // 黄緑（ターゲットへ導く）

// ポータルの速度
const PORTAL_SPEED = 40;

export function createPortal(
  k: KaboomCtx,
  link: string,
  targetPageIndex: number | null,
  startX: number,
  startY: number,
  stageWidth: number = 800,
  isVisited: boolean = false,
  pageTitle: string = '',
  isTarget: boolean = false,
  leadsToTarget: boolean = false
): PortalObject {
  const accessible = targetPageIndex !== null;
  // タイトルがあればタイトルを表示、なければURLを表示
  // 空文字やundefined、ゼロ幅スペース等を防ぐ
  const rawText = (pageTitle || link || '???')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // ゼロ幅文字を除去
    .trim() || '?';
  const truncated = rawText.slice(0, 24) || '?';

  // ターゲットまたは導くページには★マークを付ける
  const prefix = isTarget ? '★' : (leadsToTarget ? '☆' : '');
  const displayText = `${prefix}[${truncated}${rawText.length > 24 ? '..' : ''}]`;

  // 色を決定:
  // - 訪問済み → 紫（マーク付きでも紫にする）
  // - 未訪問 + ターゲット → 金
  // - 未訪問 + 導く → 黄緑
  // - 未訪問 → 水色
  // - アクセス不可 → グレー
  const color = !accessible
    ? PORTAL_COLOR_INACCESSIBLE
    : isVisited
      ? PORTAL_COLOR_VISITED  // 訪問済みは紫（マークは別途表示）
      : isTarget
        ? PORTAL_COLOR_TARGET
        : leadsToTarget
          ? PORTAL_COLOR_LEADS_TO_TARGET
          : PORTAL_COLOR_UNVISITED;

  const fontSize = 14;
  const textWidth = displayText.length * (fontSize * 0.6);

  const portal = k.add([
    k.text(displayText, { size: fontSize }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(0, 0), textWidth, fontSize) }),
    k.anchor('center'),
    k.color(...color),
    k.opacity(1),
    'portal',
    accessible ? 'portal-accessible' : 'portal-inaccessible',
  ]) as unknown as PortalObject;

  // カスタムメソッド
  portal.getLink = () => link;
  portal.getTargetPageIndex = () => targetPageIndex;
  portal.isAccessible = () => accessible;

  // 移動パターン用の状態
  let direction = Math.random() > 0.5 ? 1 : -1;  // ランダムな初期方向
  let time = Math.random() * Math.PI * 2;  // ランダムな初期位相
  const originY = startY;
  const minX = 50;
  const maxX = stageWidth - 50;

  portal.onUpdate(() => {
    // ポーズ中は処理しない
    if (isGamePaused()) return;

    time += k.dt() * 3;

    // 横方向に往復移動
    portal.pos.x += PORTAL_SPEED * direction * k.dt();

    // 壁で反転
    if (portal.pos.x < minX + 30 || portal.pos.x > maxX - 30) {
      direction *= -1;
    }

    // 縦方向にゆらゆら
    portal.pos.y = originY + Math.sin(time) * 30;

    // 画面内に制限
    portal.pos.x = Math.max(minX, Math.min(maxX, portal.pos.x));
    portal.pos.y = Math.max(60, Math.min(540, portal.pos.y));

    // アクセス可能なポータルは点滅
    if (accessible) {
      portal.opacity = 0.7 + Math.sin(time * 1.5) * 0.3;
    }
  });

  return portal;
}
