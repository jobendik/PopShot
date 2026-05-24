import { Storage } from './storage';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// ============================ AUDIO =================================
/** Procedural sound effects via Web Audio API. No external files.
 *  Audio context is created lazily on first user interaction (browser policy). */
export const AudioSys = {
  ctx: null,
  master: null,
  muted: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  },
  toggle() {
    this.muted = !this.muted;
    Storage.data.muted = this.muted;
    Storage.save();
  },
  /** Generic envelope tone */
  beep(freq, dur, type = 'square', vol = 0.4, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  },
  /** Noise burst for explosions, etc. */
  noise(dur, freq, vol = 0.3) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  },
  shoot()      { this.beep(880, 0.06, 'square', 0.18, -400); },
  pop()        { this.beep(520, 0.08, 'triangle', 0.3, -200); this.beep(740, 0.05, 'sine', 0.15, 0); },
  split()      { this.beep(380, 0.1, 'sawtooth', 0.2, 120); },
  pickup()     { this.beep(660, 0.08, 'sine', 0.4, 300); this.beep(990, 0.1, 'sine', 0.3, 200); },
  shieldBreak(){ this.beep(220, 0.2, 'sawtooth', 0.4, -100); },
  hurt()       { this.beep(160, 0.35, 'sawtooth', 0.45, -120); },
  explode()    { this.noise(0.3, 600, 0.6); this.beep(120, 0.3, 'sawtooth', 0.4, -60); },
  bossHit()    { this.beep(280, 0.1, 'square', 0.3, -100); this.beep(440, 0.08, 'square', 0.2, 0); },
  levelClear() { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.beep(f,0.18,'triangle',0.4),i*80)); },
  warning()    { this.beep(880, 0.07, 'square', 0.25); },
  menu()       { this.beep(660, 0.06, 'square', 0.2); },
};
