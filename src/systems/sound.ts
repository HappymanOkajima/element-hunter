// Web Audio API を使った効果音システム
// 外部ファイル不要でチップチューン風SEを生成

let audioContext: AudioContext | null = null;

// AudioContextを取得（遅延初期化）
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// 音量設定
let masterVolume = 0.3;
let sfxEnabled = true;

// 音量設定
export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
}

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

// 基本的な音を生成するヘルパー
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  volume: number = 1,
  attack: number = 0.01,
  decay: number = 0.1
): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // ADSR エンベロープ（簡易版）
  const finalVolume = volume * masterVolume;
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(finalVolume, ctx.currentTime + attack);
  gainNode.gain.linearRampToValueAtTime(finalVolume * 0.7, ctx.currentTime + attack + decay);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// 周波数スイープ音を生成
function playFrequencySweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume: number = 1
): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

  const finalVolume = volume * masterVolume;
  gainNode.gain.setValueAtTime(finalVolume, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// ノイズを生成（爆発音等に使用）
function playNoise(duration: number, volume: number = 1): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // ホワイトノイズ生成
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + duration);

  const finalVolume = volume * masterVolume;
  gainNode.gain.setValueAtTime(finalVolume, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(ctx.currentTime);
  source.stop(ctx.currentTime + duration);
}

// =====================
// ゲーム用効果音
// =====================

// レーザー発射音（速度に応じて変化）
export function playLaserSound(isPiercing: boolean = false): void {
  if (isPiercing) {
    // 貫通レーザー: より強力な音
    playFrequencySweep(800, 200, 0.15, 'sawtooth', 0.4);
    setTimeout(() => playFrequencySweep(600, 150, 0.1, 'square', 0.3), 20);
  } else {
    // 通常レーザー
    playFrequencySweep(600, 300, 0.1, 'square', 0.3);
  }
}

// 敵ハント（倒した）音
export function playHuntSound(): void {
  // 上昇音 + ノイズ
  playFrequencySweep(200, 600, 0.15, 'square', 0.3);
  setTimeout(() => playNoise(0.1, 0.2), 50);
}

// ダメージ音
export function playDamageSound(): void {
  // 低い下降音
  playFrequencySweep(300, 100, 0.2, 'sawtooth', 0.4);
  playNoise(0.15, 0.3);
}

// ワープ音
export function playWarpSound(): void {
  // シュワーッという感じの音
  const ctx = getAudioContext();
  if (!sfxEnabled) return;

  // 上昇スイープ
  playFrequencySweep(100, 800, 0.3, 'sine', 0.3);

  // フィルター付きノイズ
  setTimeout(() => {
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.4);
    filter.Q.setValueAtTime(5, ctx.currentTime);

    const finalVolume = 0.2 * masterVolume;
    gainNode.gain.setValueAtTime(finalVolume, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.4);
  }, 100);
}

// コンボ音（コンボ数に応じてピッチ上昇）
export function playComboSound(comboCount: number): void {
  // 基本周波数 + コンボ数でピッチアップ
  const baseFreq = 400 + (comboCount - 2) * 100;

  // アルペジオ風の音
  playTone(baseFreq, 0.1, 'square', 0.3);
  setTimeout(() => playTone(baseFreq * 1.25, 0.1, 'square', 0.3), 50);
  setTimeout(() => playTone(baseFreq * 1.5, 0.15, 'square', 0.4), 100);
}

// ページクリア音
export function playPageClearSound(): void {
  // ファンファーレ風
  playTone(523, 0.15, 'square', 0.3);  // C5
  setTimeout(() => playTone(659, 0.15, 'square', 0.3), 100);  // E5
  setTimeout(() => playTone(784, 0.15, 'square', 0.3), 200);  // G5
  setTimeout(() => playTone(1047, 0.3, 'square', 0.4), 300);  // C6
}

// ゲームオーバー音
export function playGameOverSound(): void {
  // 下降音
  playTone(400, 0.2, 'sawtooth', 0.4);
  setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.4), 200);
  setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.5), 400);
}

// ゲームクリア音
export function playGameClearSound(): void {
  // 壮大なファンファーレ
  playTone(523, 0.15, 'square', 0.3);  // C5
  setTimeout(() => playTone(659, 0.15, 'square', 0.3), 120);  // E5
  setTimeout(() => playTone(784, 0.15, 'square', 0.3), 240);  // G5
  setTimeout(() => playTone(1047, 0.2, 'square', 0.4), 360);  // C6

  setTimeout(() => {
    playTone(587, 0.15, 'square', 0.3);  // D5
    setTimeout(() => playTone(740, 0.15, 'square', 0.3), 100);  // F#5
    setTimeout(() => playTone(880, 0.15, 'square', 0.3), 200);  // A5
    setTimeout(() => playTone(1175, 0.3, 'square', 0.5), 300);  // D6
  }, 500);
}

// モード選択音
export function playSelectSound(): void {
  playTone(600, 0.08, 'square', 0.2);
}

// ゲーム開始音
export function playStartSound(): void {
  playTone(400, 0.1, 'square', 0.3);
  setTimeout(() => playTone(600, 0.1, 'square', 0.3), 80);
  setTimeout(() => playTone(800, 0.15, 'square', 0.4), 160);
}

// メニュー移動音
export function playMenuMoveSound(): void {
  playTone(500, 0.05, 'square', 0.2);
}
