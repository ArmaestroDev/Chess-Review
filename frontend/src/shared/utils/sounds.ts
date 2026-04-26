// Synthesised chess sounds via WebAudio — no audio files to bundle.
// Each function builds a tiny graph (oscillators / noise → filter → gain → out)
// with a short envelope.  The sounds are intentionally subtle.

export type SoundKind = 'move' | 'capture' | 'check' | 'checkmate' | 'castle' | 'error';

const MUTE_KEY = 'chess-engine-muted';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function envelope(g: GainNode, t0: number, attack: number, decay: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function noiseBuffer(c: AudioContext, durSec: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * durSec));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function bell(c: AudioContext, t0: number, freq: number, decay: number, peak: number) {
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = c.createGain();
  envelope(g, t0, 0.005, decay, peak);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + decay + 0.05);
}

function thunk(c: AudioContext, t0: number, gain = 0.45) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.09);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  lp.Q.value = 1.4;
  const g = c.createGain();
  envelope(g, t0, 0.001, 0.08, gain);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.12);
}

function click(c: AudioContext, t0: number, gain = 0.55) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.13);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 1.0;
  const g = c.createGain();
  envelope(g, t0, 0.001, 0.13, gain);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.16);
  // mix in a tiny low thud for body
  thunk(c, t0, 0.25);
}

function buzz(c: AudioContext, t0: number) {
  // Two descending dissonant tones — short and unmistakable.
  const make = (freq: number, dt: number, peak: number, decay: number) => {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = c.createGain();
    envelope(g, t0 + dt, 0.005, decay, peak);
    o.connect(lp).connect(g).connect(c.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + decay + 0.05);
  };
  make(220, 0, 0.18, 0.12);
  make(165, 0.09, 0.18, 0.18);
}

export function play(kind: SoundKind): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + 0.001;
  try {
    switch (kind) {
      case 'move':
        thunk(c, t0);
        break;
      case 'capture':
        click(c, t0);
        break;
      case 'check':
        bell(c, t0, 880, 0.18, 0.28);
        bell(c, t0 + 0.06, 1318.5, 0.2, 0.22);
        break;
      case 'checkmate':
        // Three descending notes: C5 → A4 → F4
        bell(c, t0, 523.25, 0.18, 0.3);
        bell(c, t0 + 0.16, 440, 0.18, 0.3);
        bell(c, t0 + 0.32, 349.23, 0.45, 0.3);
        break;
      case 'castle':
        thunk(c, t0);
        thunk(c, t0 + 0.09);
        break;
      case 'error':
        buzz(c, t0);
        break;
    }
  } catch {
    /* ignore audio errors */
  }
}

/** Pick the right sound from a SAN string. Order matters: mate > castle > check > capture. */
export function classifySound(san: string): SoundKind {
  if (san.includes('#')) return 'checkmate';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('+')) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}
