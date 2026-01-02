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

// ボス警告音（WARNING!表示時）
// 甲高くねじれた警告アラーム
export function playBossWarningSound(): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();

  // ねじれた警告音を生成
  const playTwistedWarning = (delay: number) => {
    setTimeout(() => {
      // メインオシレーター（高音）
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      // 周波数を上下にうねらせる（ねじり効果）
      osc1.frequency.setValueAtTime(1000, ctx.currentTime);
      osc1.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.15);
      osc1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);

      // 2つ目はわずかにずらして不協和音
      osc2.frequency.setValueAtTime(1050, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(1350, ctx.currentTime + 0.15);
      osc2.frequency.linearRampToValueAtTime(850, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.35 * masterVolume, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    }, delay);
  };

  // 6回繰り返し（約2秒間、より密に）
  playTwistedWarning(0);
  playTwistedWarning(300);
  playTwistedWarning(600);
  playTwistedWarning(900);
  playTwistedWarning(1200);
  playTwistedWarning(1500);
}

// ボス存在中のドローン音（ループ）
// アンドアジェネシス風の不穏なドローン
let bossLoopOscillators: OscillatorNode[] = [];
let bossLoopGainNode: GainNode | null = null;

export function startBossLoopSound(): void {
  if (!sfxEnabled) return;

  // 既に再生中なら何もしない
  if (bossLoopOscillators.length > 0) return;

  const ctx = getAudioContext();

  // マスターゲイン
  bossLoopGainNode = ctx.createGain();
  bossLoopGainNode.gain.setValueAtTime(0, ctx.currentTime);
  bossLoopGainNode.gain.linearRampToValueAtTime(0.15 * masterVolume, ctx.currentTime + 0.5);
  bossLoopGainNode.connect(ctx.destination);

  // 低音ドローン（複数のオシレーターで厚みを出す）
  const frequencies = [55, 82.5, 110];  // A1, E2, A2 (不協和音的に)
  const detunes = [0, 5, -3];  // わずかにデチューンして不穏さを演出

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(detunes[i], ctx.currentTime);

    // LFOで周波数を微妙に揺らす
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.3 + i * 0.1, ctx.currentTime);  // ゆっくり揺らす
    lfoGain.gain.setValueAtTime(2, ctx.currentTime);  // 揺れ幅
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    osc.connect(bossLoopGainNode!);
    osc.start();

    bossLoopOscillators.push(osc);
    bossLoopOscillators.push(lfo);
  });

  // パルス的なアクセント音（周期的に鳴る）
  const pulseLoop = () => {
    if (bossLoopOscillators.length === 0) return;

    const pulseOsc = ctx.createOscillator();
    const pulseGain = ctx.createGain();

    pulseOsc.type = 'square';
    pulseOsc.frequency.setValueAtTime(80, ctx.currentTime);
    pulseOsc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.3);

    pulseGain.gain.setValueAtTime(0.08 * masterVolume, ctx.currentTime);
    pulseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    pulseOsc.connect(pulseGain);
    pulseGain.connect(ctx.destination);

    pulseOsc.start();
    pulseOsc.stop(ctx.currentTime + 0.3);

    // 次のパルス（ボスループが続いている間）
    setTimeout(pulseLoop, 800);
  };

  // 少し遅れてパルス開始
  setTimeout(pulseLoop, 500);
}

export function stopBossLoopSound(): void {
  if (bossLoopGainNode) {
    const ctx = getAudioContext();
    // フェードアウト
    bossLoopGainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  }

  // 少し待ってからオシレーターを停止
  setTimeout(() => {
    bossLoopOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // 既に停止している場合は無視
      }
    });
    bossLoopOscillators = [];
    bossLoopGainNode = null;
  }, 350);
}

// =====================
// ボス攻撃SE
// =====================

// <hr> 攻撃: 警告音（チャージ中）
export function playHrWarningSound(): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();

  // ピリピリした警告音
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  // 高速で周波数を上下させて緊迫感
  osc.frequency.setValueAtTime(800, ctx.currentTime);

  gain.gain.setValueAtTime(0.15 * masterVolume, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2 * masterVolume, ctx.currentTime + 0.5);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.0);

  // トレモロ効果を追加
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(20, ctx.currentTime);  // 高速振動
  lfoGain.gain.setValueAtTime(100, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start(ctx.currentTime);
  lfo.stop(ctx.currentTime + 1.0);
}

// <hr> 攻撃: レーザー発射音
export function playHrFireSound(): void {
  if (!sfxEnabled) return;

  // 横一線のビーム音（低→高で威圧感）
  playFrequencySweep(100, 400, 0.3, 'sawtooth', 0.5);

  // ノイズを重ねる
  setTimeout(() => playNoise(0.2, 0.3), 50);
}

// <br> 攻撃: 落下弾SE
export function playBrDropSound(): void {
  if (!sfxEnabled) return;

  // ひゅーんと落ちる音
  playFrequencySweep(600, 200, 0.3, 'triangle', 0.25);
}

// <table> 攻撃: グリッド警告音（複数レーザーのチャージ）
export function playTableWarningSound(): void {
  if (!sfxEnabled) return;

  const ctx = getAudioContext();

  // 複数のレーザーが同時にチャージする感じ
  // 低音と高音を組み合わせた警告音
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'square';
  osc2.type = 'sawtooth';

  // 低音のうなり
  osc1.frequency.setValueAtTime(100, ctx.currentTime);
  osc1.frequency.linearRampToValueAtTime(150, ctx.currentTime + 1.2);

  // 高音の警告トーン
  osc2.frequency.setValueAtTime(600, ctx.currentTime);

  gain.gain.setValueAtTime(0.12 * masterVolume, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25 * masterVolume, ctx.currentTime + 1.0);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 1.2);
  osc2.stop(ctx.currentTime + 1.2);

  // 高速トレモロ（格子をイメージ）
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(15, ctx.currentTime);  // グリッド感
  lfoGain.gain.setValueAtTime(80, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(osc2.frequency);
  lfo.start(ctx.currentTime);
  lfo.stop(ctx.currentTime + 1.2);
}

// <table> 攻撃: グリッドレーザー発射音
export function playTableFireSound(): void {
  if (!sfxEnabled) return;

  // 縦横同時発射の重厚な音
  // 横レーザー音
  playFrequencySweep(80, 300, 0.4, 'sawtooth', 0.4);

  // 縦レーザー音（少しずらして）
  setTimeout(() => {
    playFrequencySweep(120, 350, 0.35, 'square', 0.35);
  }, 30);

  // ノイズで迫力追加
  setTimeout(() => playNoise(0.25, 0.35), 50);
}
