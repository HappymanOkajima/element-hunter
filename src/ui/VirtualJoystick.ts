import type { KaboomCtx, GameObj } from 'kaboom';

// タッチ入力の状態
export interface TouchInputState {
  // 移動入力（-1 〜 1）
  moveX: number;
  moveY: number;
  // 攻撃ボタンが押されたか
  firePressed: boolean;
  // ポーズボタンが押されたか
  pausePressed: boolean;
}

// タッチデバイス判定
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// 仮想ジョイスティッククラス
export class VirtualJoystick {
  private k: KaboomCtx;
  private state: TouchInputState;

  // ジョイスティック
  private joystickKnob: GameObj | null = null;
  private joystickTouchId: number | null = null;
  private joystickCenter: { x: number; y: number } = { x: 0, y: 0 };

  // ボタン
  private fireButton: GameObj | null = null;
  private fireTouchId: number | null = null;
  private pauseButton: GameObj | null = null;

  // 設定
  private readonly JOYSTICK_SIZE = 100;
  private readonly KNOB_SIZE = 40;
  private readonly BUTTON_SIZE = 80;
  private readonly DEAD_ZONE = 10;

  constructor(k: KaboomCtx) {
    this.k = k;
    this.state = {
      moveX: 0,
      moveY: 0,
      firePressed: false,
      pausePressed: false,
    };
  }

  // UIを作成
  create(): void {
    const k = this.k;
    const padding = 15;  // 画面端に近づける

    // ジョイスティックベース（左下）
    const baseX = padding + this.JOYSTICK_SIZE / 2;
    const baseY = k.height() - padding - this.JOYSTICK_SIZE / 2;

    k.add([
      k.circle(this.JOYSTICK_SIZE / 2),
      k.pos(baseX, baseY),
      k.anchor('center'),
      k.color(100, 100, 100),
      k.opacity(0.3),
      k.fixed(),
      k.z(1000),
      'virtual-joystick-base',
    ]);

    this.joystickKnob = k.add([
      k.circle(this.KNOB_SIZE / 2),
      k.pos(baseX, baseY),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.opacity(0.6),
      k.fixed(),
      k.z(1001),
      'virtual-joystick-knob',
    ]);

    this.joystickCenter = { x: baseX, y: baseY };

    // 攻撃ボタン（右下）
    const fireX = k.width() - padding - this.BUTTON_SIZE / 2;
    const fireY = k.height() - padding - this.BUTTON_SIZE / 2;

    this.fireButton = k.add([
      k.circle(this.BUTTON_SIZE / 2),
      k.pos(fireX, fireY),
      k.anchor('center'),
      k.color(255, 100, 100),
      k.opacity(0.5),
      k.fixed(),
      k.z(1000),
      'virtual-fire-button',
    ]);

    // FIREラベル
    k.add([
      k.text('FIRE', { size: 18 }),
      k.pos(fireX, fireY),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.opacity(0.8),
      k.fixed(),
      k.z(1002),
      'virtual-fire-label',
    ]);

    // ポーズボタン（右上）
    const pauseX = k.width() - padding - 20;
    const pauseY = padding + 20;

    this.pauseButton = k.add([
      k.rect(40, 30, { radius: 4 }),
      k.pos(pauseX, pauseY),
      k.anchor('center'),
      k.color(80, 80, 80),
      k.opacity(0.5),
      k.fixed(),
      k.z(1000),
      'virtual-pause-button',
    ]);

    k.add([
      k.text('||', { size: 16 }),
      k.pos(pauseX, pauseY),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.opacity(0.8),
      k.fixed(),
      k.z(1002),
      'virtual-pause-label',
    ]);

    // タッチイベントを設定
    this.setupTouchEvents();
  }

  // タッチイベント設定（ネイティブDOM イベント使用）
  private setupTouchEvents(): void {
    const canvas = this.k.canvas;

    // キャンバス座標に変換
    const getCanvasPos = (touch: Touch): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = this.k.width() / rect.width;
      const scaleY = this.k.height() / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    };

    // タッチ開始
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const pos = getCanvasPos(touch);
        const touchId = touch.identifier;

        // ジョイスティック領域チェック
        if (this.isInJoystickArea(pos) && this.joystickTouchId === null) {
          this.joystickTouchId = touchId;
          this.updateJoystick(pos);
          continue;
        }

        // 攻撃ボタンチェック
        if (this.isInFireButton(pos) && this.fireTouchId === null) {
          this.fireTouchId = touchId;
          this.state.firePressed = true;
          if (this.fireButton) {
            this.fireButton.opacity = 0.8;
          }
          continue;
        }

        // ポーズボタンチェック
        if (this.isInPauseButton(pos)) {
          this.state.pausePressed = true;
          continue;
        }
      }
    }, { passive: false });

    // タッチ移動
    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          const pos = getCanvasPos(touch);
          this.updateJoystick(pos);
        }
      }
    }, { passive: false });

    // タッチ終了
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // ジョイスティック解除
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.state.moveX = 0;
          this.state.moveY = 0;
          this.resetKnobPosition();
        }

        // 攻撃ボタン解除
        if (touch.identifier === this.fireTouchId) {
          this.fireTouchId = null;
          if (this.fireButton) {
            this.fireButton.opacity = 0.5;
          }
        }
      }
    };

    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  // ジョイスティック領域判定
  private isInJoystickArea(pos: { x: number; y: number }): boolean {
    const dx = pos.x - this.joystickCenter.x;
    const dy = pos.y - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.JOYSTICK_SIZE;
  }

  // 攻撃ボタン領域判定
  private isInFireButton(pos: { x: number; y: number }): boolean {
    if (!this.fireButton) return false;
    const dx = pos.x - this.fireButton.pos.x;
    const dy = pos.y - this.fireButton.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.BUTTON_SIZE;
  }

  // ポーズボタン領域判定
  private isInPauseButton(pos: { x: number; y: number }): boolean {
    if (!this.pauseButton) return false;
    const dx = Math.abs(pos.x - this.pauseButton.pos.x);
    const dy = Math.abs(pos.y - this.pauseButton.pos.y);
    return dx < 30 && dy < 25;
  }

  // ジョイスティック更新
  private updateJoystick(pos: { x: number; y: number }): void {
    const dx = pos.x - this.joystickCenter.x;
    const dy = pos.y - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // デッドゾーン内は無視
    if (dist < this.DEAD_ZONE) {
      this.state.moveX = 0;
      this.state.moveY = 0;
      this.resetKnobPosition();
      return;
    }

    // 最大距離を制限
    const maxDist = this.JOYSTICK_SIZE / 2 - this.KNOB_SIZE / 2;
    const clampedDist = Math.min(dist, maxDist);
    let angle = Math.atan2(dy, dx);

    // 8方向スナップ: 上下左右＋斜め4方向
    // 角度を度数に変換（0〜360度）
    let deg = angle * (180 / Math.PI);
    if (deg < 0) deg += 360;

    // 各方向の中心角度（22.5度ずつの範囲でスナップ）
    // 右: 0度、右下: 45度、下: 90度、左下: 135度
    // 左: 180度、左上: 225度、上: 270度、右上: 315度
    if (deg >= 337.5 || deg < 22.5) {
      angle = 0; // 右
    } else if (deg >= 22.5 && deg < 67.5) {
      angle = Math.PI / 4; // 右下
    } else if (deg >= 67.5 && deg < 112.5) {
      angle = Math.PI / 2; // 下
    } else if (deg >= 112.5 && deg < 157.5) {
      angle = 3 * Math.PI / 4; // 左下
    } else if (deg >= 157.5 && deg < 202.5) {
      angle = Math.PI; // 左
    } else if (deg >= 202.5 && deg < 247.5) {
      angle = -3 * Math.PI / 4; // 左上
    } else if (deg >= 247.5 && deg < 292.5) {
      angle = -Math.PI / 2; // 上
    } else {
      angle = -Math.PI / 4; // 右上
    }

    // ノブ位置更新
    if (this.joystickKnob) {
      this.joystickKnob.pos.x = this.joystickCenter.x + Math.cos(angle) * clampedDist;
      this.joystickKnob.pos.y = this.joystickCenter.y + Math.sin(angle) * clampedDist;
    }

    // 入力値を計算（-1 〜 1）
    const normalizedDist = clampedDist / maxDist;
    this.state.moveX = Math.cos(angle) * normalizedDist;
    this.state.moveY = Math.sin(angle) * normalizedDist;
  }

  // ノブ位置をリセット
  private resetKnobPosition(): void {
    if (this.joystickKnob) {
      this.joystickKnob.pos.x = this.joystickCenter.x;
      this.joystickKnob.pos.y = this.joystickCenter.y;
    }
  }

  // 入力状態を取得
  getState(): TouchInputState {
    return this.state;
  }

  // firePressed をリセット（使用後に呼ぶ）
  clearFirePressed(): void {
    this.state.firePressed = false;
  }

  // pausePressed をリセット（使用後に呼ぶ）
  clearPausePressed(): void {
    this.state.pausePressed = false;
  }

  // UIを削除
  destroy(): void {
    const k = this.k;
    k.get('virtual-joystick-base').forEach(o => k.destroy(o));
    k.get('virtual-joystick-knob').forEach(o => k.destroy(o));
    k.get('virtual-fire-button').forEach(o => k.destroy(o));
    k.get('virtual-fire-label').forEach(o => k.destroy(o));
    k.get('virtual-pause-button').forEach(o => k.destroy(o));
    k.get('virtual-pause-label').forEach(o => k.destroy(o));
  }
}

// シングルトンインスタンス（シーン間で共有）
let virtualJoystickInstance: VirtualJoystick | null = null;

export function getVirtualJoystick(k: KaboomCtx): VirtualJoystick {
  if (!virtualJoystickInstance) {
    virtualJoystickInstance = new VirtualJoystick(k);
  }
  return virtualJoystickInstance;
}

export function clearVirtualJoystick(): void {
  virtualJoystickInstance = null;
}
