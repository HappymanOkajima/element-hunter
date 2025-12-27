import type { GameObj, KaboomCtx, TextComp, PosComp, AreaComp, AnchorComp, ColorComp, OpacityComp } from 'kaboom';

type PortalBaseObj = GameObj<TextComp | PosComp | AreaComp | AnchorComp | ColorComp | OpacityComp>;

export interface PortalObject extends PortalBaseObj {
  getLink: () => string;
  getTargetPageIndex: () => number | null;
  isAccessible: () => boolean;
}

// ポータルの色
const PORTAL_COLOR_ACCESSIBLE: [number, number, number] = [0, 200, 255];  // 水色（遷移可能）
const PORTAL_COLOR_INACCESSIBLE: [number, number, number] = [100, 100, 100];  // グレー（遷移不可）

// ポータルの速度
const PORTAL_SPEED = 40;

export function createPortal(
  k: KaboomCtx,
  link: string,
  targetPageIndex: number | null,
  startX: number,
  startY: number,
  stageWidth: number = 800
): PortalObject {
  const accessible = targetPageIndex !== null;
  const displayText = `<a>${link.slice(0, 15)}${link.length > 15 ? '...' : ''}>`;
  const textWidth = displayText.length * 10;

  const color = accessible ? PORTAL_COLOR_ACCESSIBLE : PORTAL_COLOR_INACCESSIBLE;

  const portal = k.add([
    k.text(displayText, { size: 14 }),
    k.pos(startX, startY),
    k.area({ shape: new k.Rect(k.vec2(-textWidth / 2, -10), textWidth, 20) }),
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
      const alpha = 0.7 + Math.sin(time * 1.5) * 0.3;
      portal.opacity = alpha;
    }
  });

  return portal;
}
