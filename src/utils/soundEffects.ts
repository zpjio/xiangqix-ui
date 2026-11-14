let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playWoodClackSound(
  isCapture = false,
  row = 4.5,
  col = 4,
  soundEnabled = true
): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const distFromCenter = Math.hypot(row - 4.5, col - 4);
    const normDist = Math.min(1, distFromCenter / 6.02);
    const baseFreq = Math.round(135 + normDist * 75);
    const decaySec = Number((0.105 - normDist * 0.042).toFixed(3));

    const triggerWoodStrike = (
      startTime: number,
      freq: number,
      duration: number,
      gainPeak: number
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(38, freq * 0.36), startTime + duration);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    };

    if (isCapture) {
      triggerWoodStrike(now, baseFreq * 1.48, 0.048, 0.24);
      triggerWoodStrike(now + 0.018, baseFreq, decaySec, 0.34);
    } else {
      triggerWoodStrike(now, baseFreq, decaySec, 0.26);
    }
  } catch {
    // Ignore audio context errors
  }
}

// 警示哑木音效（未应将或尝试送将时的克制提示）
export function playInvalidWarningSound(soundEnabled = true): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.075].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 108 : 88, now + offset);
      osc.frequency.exponentialRampToValueAtTime(52, now + offset + 0.055);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.14, now + offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
  } catch {
    // Ignore audio context errors
  }
}

// 中式清越编钟/铜磬「将军」提示音
export function playCheckChimeSound(soundEnabled = true): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + 0.025;
    // 双声叠韵铜磬（D5 + A5 五声音阶清鸣 + 高次泛音瞬态）
    const strikeChime = (t: number, baseHz: number, dur: number, peak: number) => {
      const partials = [
        { ratio: 1, amp: peak, type: 'sine' as OscillatorType, dec: dur },
        { ratio: 2.0, amp: peak * 0.34, type: 'triangle' as OscillatorType, dec: dur * 0.72 },
        { ratio: 2.98, amp: peak * 0.16, type: 'sine' as OscillatorType, dec: dur * 0.42 },
      ];
      for (const p of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = p.type;
        osc.frequency.setValueAtTime(baseHz * p.ratio, t);
        gain.gain.setValueAtTime(0.0008, t);
        gain.gain.linearRampToValueAtTime(p.amp, t + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0006, t + p.dec);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + p.dec + 0.02);
      }
    };

    strikeChime(start, 587.33, 0.36, 0.16);
    strikeChime(start + 0.09, 880.0, 0.46, 0.14);
  } catch {
    // Ignore audio context errors
  }
}

// 中式大锣余韵 + 金磬收煞「绝杀 / 困毙」终局音效
export function playCheckmateGongSound(soundEnabled = true): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + 0.035;
    // 1. 低沉铜锣主体泛音群（微非谐波打造传统响铜颤音）
    const gongPartials = [
      { freq: 116, endFreq: 109, dur: 1.35, gain: 0.24, type: 'triangle' as OscillatorType },
      { freq: 174, endFreq: 171, dur: 1.12, gain: 0.14, type: 'sine' as OscillatorType },
      { freq: 242, endFreq: 238, dur: 0.92, gain: 0.11, type: 'sine' as OscillatorType },
      { freq: 356, endFreq: 350, dur: 0.65, gain: 0.07, type: 'triangle' as OscillatorType },
    ];
    for (const gp of gongPartials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = gp.type;
      osc.frequency.setValueAtTime(gp.freq, start);
      osc.frequency.exponentialRampToValueAtTime(gp.endFreq, start + gp.dur);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(gp.gain, start + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0006, start + gp.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + gp.dur + 0.03);
    }

    // 2. 轻微响铜击锤沙响（滤波白噪）
    const noiseLen = Math.floor(ctx.sampleRate * 0.22);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(720, start);
    filter.Q.setValueAtTime(1.8, start);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.11, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start(start);

    // 3. 高音金磬收煞清响（D5 -> A5 微延后定音）
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(587.33, start + 0.06);
    chimeGain.gain.setValueAtTime(0.0008, start + 0.06);
    chimeGain.gain.linearRampToValueAtTime(0.12, start + 0.075);
    chimeGain.gain.exponentialRampToValueAtTime(0.0006, start + 0.95);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(start + 0.06);
    chimeOsc.stop(start + 0.98);
  } catch {
    // Ignore audio context errors
  }
}

// 棋钟最后 10 秒逐秒低时提醒叩击音（最后 3 秒音高略微上扬提示读秒）
export function playClockWarningTickSound(
  remainingSeconds: number,
  soundEnabled = true
): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const isUrgent = remainingSeconds <= 3;
    const baseHz = isUrgent ? 1040 : 780;

    const triggerPulse = (t: number, freq: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.042);

      gain.gain.setValueAtTime(0.0008, t);
      gain.gain.linearRampToValueAtTime(peakGain, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.048);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    };

    triggerPulse(now, baseHz, isUrgent ? 0.14 : 0.1);
    if (isUrgent) {
      triggerPulse(now + 0.055, baseHz * 1.18, 0.08);
    }
  } catch {
    // Ignore audio context errors
  }
}

