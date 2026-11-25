import { State, type GameState } from '../constants';
import { Storage } from './storage';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// ============================================================================
// Asset loader
// ============================================================================
// Asset IDs are file paths under `public/sfx/` without extension. The loader
// probes .ogg → .mp3 → .wav and caches the first decoded buffer. Procedural
// fallback fires whenever the asset isn't loaded yet (first call always — the
// asset starts downloading and is ready for next time).

const SFX_EXTS = ['ogg', 'mp3', 'wav'] as const;
const SFX_BASE = `${import.meta.env.BASE_URL}sfx/`;

// Safari/iOS can't decode Ogg Vorbis. Detect once so those browsers don't waste
// a round-trip fetching an .ogg that fails decode before falling back to .mp3.
// Inconclusive detection keeps ogg (mp3 still wins via decode-fail fallback).
function _oggSupported(): boolean {
  try {
    return typeof Audio !== 'undefined'
      && !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
  } catch { return false; }
}
// Probe order, narrowed at init() to drop ogg where it can't be decoded. The
// .wav fallback stays in place for any environment missing both compressed forms.
let _sfxExts: readonly string[] = SFX_EXTS;

// Tier-S: preloaded on init(). Other IDs lazy-load on first use.
const TIER_S_PRELOAD: string[] = [
  // Base pops × 5 sizes × 3 variants — the core arcade feel
  'pop/base_size0_01', 'pop/base_size0_02', 'pop/base_size0_03',
  'pop/base_size1_01', 'pop/base_size1_02', 'pop/base_size1_03',
  'pop/base_size2_01', 'pop/base_size2_02', 'pop/base_size2_03',
  'pop/base_size3_01', 'pop/base_size3_02', 'pop/base_size3_03',
  'pop/base_size4_01', 'pop/base_size4_02', 'pop/base_size4_03',
  'pop/split_01', 'pop/split_02', 'pop/split_03',
  'pop/flourish_electric', 'pop/flourish_armored_shatter',
  'pop/flourish_lava', 'pop/flourish_sludge', 'pop/flourish_starbubble_clock',
  'weapon/harpoon_fire_01', 'weapon/harpoon_fire_02', 'weapon/harpoon_fire_03',
  // Floor bounces — the rhythmic "tok" between pops is a signature Pang beat,
  // so all five sizes ride in the first preload wave.
  'bounce/floor_size0', 'bounce/floor_size1', 'bounce/floor_size2',
  'bounce/floor_size3', 'bounce/floor_size4',
  'ui/nav_move', 'ui/nav_confirm', 'ui/button_hover',
  'stinger/player_dead', 'stinger/level_clear', 'stinger/timer_warning_10s',
  'combo/first_pop_celebration', 'combo/go_beat',
  'combo/milestone_5_nice', 'combo/milestone_10_wild',
  'boss/hit_weak_point', 'hazard/explosion_large',
  'pickup/generic_collect', 'pickup/shield_break',
  'pickup/weapon_capsule', 'combo/trick_close_call', 'combo/trick_air_pop',
  'combo/multipop_double', 'combo/multipop_triple', 'hazard/explosion_small',
];

/** World pop scales — semitone offsets within one octave. Every world plays
 *  its chain in a different mode, so a long chain in the Arctic sounds unlike
 *  one in the Volcano. Kept to five-note scales so any run of pops is consonant. */
const POP_SCALES: Record<string, number[]> = {
  beach:   [0, 2, 4, 7, 9],    // major pentatonic — bright
  desert:  [0, 1, 4, 5, 7],    // phrygian-dominant fragment — heat haze
  arctic:  [0, 2, 3, 7, 10],   // minor with a cold 7th
  city:    [0, 3, 5, 7, 10],   // minor pentatonic — neon
  volcano: [0, 3, 5, 6, 10],   // blues — the flat five smoulders
  airship: [0, 2, 4, 6, 9],    // lydian colour — lift
  boss:    [0, 1, 5, 6, 10],   // dissonant — danger
};

const WEAPON_SFX: Record<string, { id: string; variants?: boolean; vol: number }> = {
  harpoon:    { id: 'weapon/harpoon_fire', variants: true, vol: 0.9 },
  double:     { id: 'weapon/double_fire', variants: true, vol: 0.85 },
  triple:     { id: 'weapon/triple_fire', variants: true, vol: 0.85 },
  powerwire:  { id: 'weapon/grapple_fire', vol: 0.85 },
  diagonal:   { id: 'weapon/diagonal_fire', variants: true, vol: 0.85 },
  machinegun: { id: 'weapon/machinegun_fire', vol: 0.5 },
  laser:      { id: 'weapon/laser_fire', vol: 0.9 },
  flame:      { id: 'weapon/flame_start', vol: 0.5 },
  shotgun:    { id: 'weapon/shotgun_fire', vol: 0.95 },
  shuriken:   { id: 'weapon/shuriken_fire', variants: true, vol: 0.85 },
  bomb:       { id: 'weapon/bomb_launch', vol: 0.9 },
};

const PICKUP_SFX: Record<string, string> = {
  shield: 'pickup/shield', life: 'pickup/life', score: 'pickup/score_gem', time: 'pickup/time',
  slowtime: 'pickup/slowtime', freeze: 'pickup/freeze', clearsmoke: 'pickup/clearsmoke',
  magnet: 'pickup/magnet', combo: 'pickup/combo_boost', dynamite: 'pickup/dynamite',
};

/** Per-id "last played" timestamps for the anti-machine-gun limiter. */
const _lastPlayed = new Map<string, number>();
// ---------- Ambient bed ----------
let _ambSrc: AudioBufferSourceNode | null = null;
let _ambGain: GainNode | null = null;
let _ambCurrent = '';

const _buffers = new Map<string, AudioBuffer>();
const _loading = new Map<string, Promise<AudioBuffer | null>>();
const _failed = new Set<string>();
const _variantCounters = new Map<string, number>();

// ---------- Music ----------
// HTMLAudioElement instead of decoded AudioBuffer: streams from disk, loops
// natively, and avoids holding the full ~6 MB file in memory after decode.
// Trade-off: it's not routed through the master GainNode, so we manage mute/
// duck by directly pausing the element.
const MUSIC_VOL = 0.4;
const MUSIC_BASE = `${import.meta.env.BASE_URL}music/`;
let _musicEl: HTMLAudioElement | null = null;
let _musicCurrent: string | null = null;

const GAMEPLAY_MUSIC_STATES = new Set<GameState>([
  State.PLAYING,
  State.PLAYER_DEAD,
  State.LEVEL_CLEAR,
  State.GAME_OVER,
  State.BOSS_DEFEATED,
  State.VICTORY,
]);

function _loadOne(ctx: AudioContext, id: string): Promise<AudioBuffer | null> {
  const cached = _buffers.get(id);
  if (cached) return Promise.resolve(cached);
  if (_failed.has(id)) return Promise.resolve(null);
  const existing = _loading.get(id);
  if (existing) return existing;

  const p = (async () => {
    for (const ext of _sfxExts) {
      try {
        const res = await fetch(`${SFX_BASE}${id}.${ext}`);
        if (!res.ok) continue;
        const data = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(data);
        _buffers.set(id, buf);
        return buf;
      } catch { /* try next extension */ }
    }
    _failed.add(id);
    return null;
  })();
  _loading.set(id, p);
  return p;
}

// ============================ AUDIO =================================
/** Asset-first sound system with procedural Web Audio fallback so the game
 *  never goes silent if a file fails to load. Audio context is created lazily
 *  on first user interaction (browser policy). */
export const AudioSys = {
  ctx: null as AudioContext | null,
  master: null as GainNode | null,
  muted: false,
  /** Transient duck flag set when an ad is playing. Independent from `muted`
   *  (the user's persisted preference) so the user's mute state is restored
   *  cleanly when the ad finishes. CrazyGames requires the game to be silent
   *  while ad audio plays — failing to do so is a top rejection cause. */
  ducked: false,
  /** Set when the CrazyGames player mutes the game from the platform UI
   *  (SDK `game.settings.muteAudio`). Independent from `muted` (the in-game
   *  toggle) and `ducked` (ads) so the three never clobber each other. Required
   *  to honestly tick "supports muting audio through the SDK". */
  cgMuted: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Drop ogg from the probe list on browsers that can't decode it (Safari/iOS).
    _sfxExts = _oggSupported() ? SFX_EXTS : SFX_EXTS.filter((e) => e !== 'ogg');
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // Fire-and-forget Tier-S preload. Procedural fallback covers anything not ready.
    for (const id of TIER_S_PRELOAD) _loadOne(this.ctx, id);
    // Start the default menu loop. First user gesture (the same one that
    // unlocked the audio context above) lets the browser autoplay it.
    this.musicPlay('main_menu_music');
  },
  toggle() {
    this.muted = !this.muted;
    if (!this.muted) this.sfx('ui/mute_toggle', 0.6);
    Storage.data.muted = this.muted;
    Storage.save();
    this._musicSync();
  },
  /** Suspend the audio context AND pause music so nothing leaks through an ad.
   *  CrazyGames rejects games that play audio over their ad slot. */
  duckForAd() {
    this.ducked = true;
    this._applyContextState();
  },
  /** Restore audio after an ad finishes (success or error). */
  unduckForAd() {
    this.ducked = false;
    this._applyContextState();
  },
  /** Platform mute: the CrazyGames player toggled audio from the site UI.
   *  Routes through the same silencing path as an ad duck but on its own flag,
   *  so an ad ending can't un-mute a platform-muted player and vice-versa. */
  setPlatformMute(on: boolean) {
    this.cgMuted = on;
    this._applyContextState();
  },
  /** Suspend the audio context whenever an ad OR the platform wants silence,
   *  resume only when neither does, then reconcile music to match. */
  _applyContextState() {
    try {
      if (this.ducked || this.cgMuted) this.ctx?.suspend?.();
      else this.ctx?.resume?.();
    } catch { /* swallow */ }
    this._musicSync();
  },

  /** Start (or switch to) a music loop. Idempotent for the same id. */
  musicPlay(id: string) {
    if (!_musicEl) {
      _musicEl = new Audio();
      _musicEl.loop = true;
      _musicEl.preload = 'auto';
      _musicEl.volume = MUSIC_VOL;
    }
    if (_musicCurrent !== id) {
      _musicCurrent = id;
      _musicEl.src = `${MUSIC_BASE}${id}.mp3`;
    }
    this._musicSync();
  },
  /** Route background music from the current game state.
   *  Pause owns its own loop; active gameplay states share the gameplay loop;
   *  everything else uses the main-menu loop. */
  syncMusicForState(state: GameState) {
    if (state === State.PAUSED) {
      this.musicPlay('pause_menu_music');
      return;
    }
    if (GAMEPLAY_MUSIC_STATES.has(state)) {
      this.musicPlay('game_music');
      return;
    }
    this.musicPlay('main_menu_music');
  },
  /** Reconcile music playback with current mute + duck state. Called from
   *  init/toggle/duck/unduck so the same gate covers every transition. */
  _musicSync() {
    if (!_musicEl || !_musicCurrent) return;
    const shouldPlay = !this.muted && !this.ducked && !this.cgMuted;
    if (shouldPlay) {
      if (_musicEl.paused) _musicEl.play().catch(() => { /* needs user gesture, init will retry */ });
    } else {
      if (!_musicEl.paused) _musicEl.pause();
    }
  },

  /** Play a cached asset. Returns true if it played (caller skips procedural
   *  fallback); false if not loaded yet (caller plays procedural; asset starts
   *  downloading in the background and is ready for next call). */
  _playId(id: string, vol = 1): boolean {
    if (this.muted || this.cgMuted || !this.ctx || !this.master) return false;
    const buf = _buffers.get(id);
    if (!buf) {
      _loadOne(this.ctx, id);
      return false;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.master);
    src.start();
    return true;
  },

  /** Round-robin variant pool: tries `${prefix}_01..03` and plays whichever is
   *  loaded next in rotation. Avoids the mechanical sameness of replaying one
   *  file during rapid clears. */
  _playVariant(prefix: string, vol = 1): boolean {
    if (this.muted || this.cgMuted || !this.ctx) return false;
    const c = _variantCounters.get(prefix) ?? 0;
    for (let i = 0; i < 3; i++) {
      const idx = ((c + i) % 3) + 1;
      const id = `${prefix}_${String(idx).padStart(2, '0')}`;
      if (_buffers.has(id)) {
        _variantCounters.set(prefix, c + 1);
        return this._playId(id, vol);
      }
    }
    for (let i = 1; i <= 3; i++) _loadOne(this.ctx, `${prefix}_${String(i).padStart(2, '0')}`);
    return false;
  },

  /** Play any asset id once, with a short per-id rate limit so a burst of
   *  identical events can't stack into a harsh wall. Returns whether it played
   *  (so callers can chain a procedural fallback with `||`). */
  sfx(id: string, vol = 1, minGapMs = 45): boolean {
    if (this.muted || this.cgMuted || !this.ctx) return false;
    const now = performance.now();
    const last = _lastPlayed.get(id) || 0;
    if (now - last < minGapMs) return true;      // swallowed, but "handled"
    if (!this._playId(id, vol)) return false;
    _lastPlayed.set(id, now);
    return true;
  },

  /** Tempo of the music bed. Gameplay nudges it: time-stop and slow-mo drag
   *  it down, late boss phases and deep Panic waves push it up. Pitch is
   *  preserved by the browser, so this reads as urgency, not a tape warp. */
  setMusicRate(rate: number) {
    if (!_musicEl) return;
    const r = Math.max(0.5, Math.min(1.3, rate));
    if (Math.abs(_musicEl.playbackRate - r) > 0.004) {
      try { _musicEl.playbackRate = r; } catch { /* some browsers clamp */ }
    }
  },
  /** Momentary music dip for big audiovisual beats (boss intro, PopShot). */
  setMusicVolume(k: number) {
    if (_musicEl) _musicEl.volume = MUSIC_VOL * Math.max(0, Math.min(1, k));
  },

  /** Looping per-world ambience under the music (surf, wind, city hum …).
   *  Pass '' to stop. Lazy-loads; silent until the buffer arrives. */
  ambient(theme: string) {
    if (!this.ctx || !this.master) return;
    if (this.muted || this.cgMuted) theme = '';
    if (theme === _ambCurrent) return;
    _ambCurrent = theme;
    const ctx = this.ctx;
    if (_ambSrc && _ambGain) {
      const old = _ambSrc, og = _ambGain;
      try { og.gain.setTargetAtTime(0, ctx.currentTime, 0.25); old.stop(ctx.currentTime + 1); } catch { /* already stopped */ }
      _ambSrc = null; _ambGain = null;
    }
    if (!theme) return;
    const id = `ambient/${theme}_loop`;
    _loadOne(ctx, id).then(buf => {
      if (!buf || _ambCurrent !== theme || !this.master) return;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.32, ctx.currentTime, 0.8);
      src.connect(g).connect(this.master);
      src.start();
      _ambSrc = src; _ambGain = g;
    });
  },

  /** The melodic half of a pop: one plucked note from the current world's
   *  scale. `step` is the chain length, so a growing chain climbs the scale
   *  and a cascade rips through it as an arpeggio. Quiet by design — it sits
   *  on top of the sampled pop rather than replacing it. */
  _scale: POP_SCALES.beach,
  _lastNoteMs: 0,
  setPopScale(theme: string) { this._scale = POP_SCALES[theme] || POP_SCALES.beach; },
  popNote(step: number, size = 2) {
    if (this.muted || this.cgMuted || !this.ctx || !this.master) return;
    const now = performance.now();
    if (now - this._lastNoteMs < 28) return;
    this._lastNoteMs = now;
    const sc = this._scale;
    const n = Math.max(0, step - 1);
    const octave = Math.min(2, Math.floor(n / sc.length));
    // Past the top of the range the line keeps dancing in the upper octave
    // instead of climbing into dog-whistle territory.
    const deg = sc[n % sc.length];
    const semis = deg + octave * 12;
    const freq = 392 * Math.pow(2, semis / 12);          // root: G4
    const t = this.ctx.currentTime;
    const vol = 0.11 + Math.min(0.05, size * 0.012);
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle'; osc2.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 2, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.35;
    osc.connect(g); osc2.connect(g2).connect(g);
    g.connect(this.master);
    osc.start(t); osc2.start(t);
    osc.stop(t + 0.24); osc2.stop(t + 0.24);
  },

  weaponFire(weapon: string) {
    const w = WEAPON_SFX[weapon] || WEAPON_SFX.harpoon;
    const ok = w.variants ? this._playVariant(w.id, w.vol) : this.sfx(w.id, w.vol, 35);
    if (ok) return;
    // Procedural stand-ins, one voice per weapon so they stay distinguishable
    // even before (or without) the samples.
    switch (weapon) {
      case 'machinegun': this.beep(520, 0.035, 'square', 0.12, -200); break;
      case 'laser':      this.beep(1400, 0.22, 'sawtooth', 0.2, -1100); break;
      case 'shotgun':    this.noise(0.14, 1800, 0.35); break;
      case 'bomb':       this.beep(240, 0.12, 'sine', 0.25, 160); break;
      case 'shuriken':   this.beep(1500, 0.07, 'triangle', 0.14, 500); break;
      case 'flame':      this.noise(0.1, 900, 0.1); break;
      default:           this.beep(880, 0.06, 'square', 0.18, -400);
    }
  },
  /** The PopShot: a rising charge-release. Deliberately the biggest weapon
   *  sound in the game. */
  popshotFire() {
    this.sfx('weapon/laser_fire', 0.8);
    this.beep(220, 0.5, 'sawtooth', 0.22, 1500);
    this.beep(440, 0.4, 'triangle', 0.2, 1300);
    this.noise(0.35, 2600, 0.22);
  },
  popshotReady() {
    this.sfx('panic/rainbow_gauge_full', 0.8) || [523, 784, 1046, 1568].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.12, 'triangle', 0.26), i * 60));
  },
  dash() {
    this.noise(0.14, 2400, 0.16);
    this.beep(300, 0.12, 'sine', 0.12, 500);
  },
  /** Near-miss tick. Pitch climbs with consecutive grazes. */
  graze(streak: number) {
    const f = 900 + Math.min(streak, 8) * 120;
    this.beep(f, 0.05, 'sine', 0.13, 400);
  },
  zap() {
    this.sfx('pop/flourish_electric', 0.6, 60) || this.beep(2200, 0.06, 'square', 0.16, -1400);
  },
  fuseLit() {
    this.beep(700, 0.5, 'square', 0.07, 900);
  },
  bumper() {
    this.sfx('bounce/platform_01', 0.5, 60);
    this.beep(660, 0.07, 'triangle', 0.16, 500);
  },
  bounceSoft(kind: 'wall' | 'platform') {
    if (this.muted || this.cgMuted || !this.ctx) return;
    const now = performance.now();
    if (now - this._lastBounceMs < 70) return;
    this._lastBounceMs = now;
    this._playVariant2(kind === 'wall' ? 'bounce/wall' : 'bounce/platform', 0.22);
  },
  /** Two-variant round robin (the wall/platform sets ship _01/_02 only). */
  _playVariant2(prefix: string, vol: number): boolean {
    const c = _variantCounters.get(prefix) ?? 0;
    _variantCounters.set(prefix, c + 1);
    return this._playId(`${prefix}_0${(c % 2) + 1}`, vol);
  },
  trick(id: string) {
    const map: Record<string, string> = {
      clutch: 'combo/trick_clutch', close_call: 'combo/trick_close_call',
      air_pop: 'combo/trick_air_pop', bank_shot: 'combo/trick_bank_shot',
    };
    this.sfx(map[id] || 'combo/trick_air_pop', 0.55, 120) || this.beep(1320, 0.08, 'triangle', 0.16, 300);
  },
  multipop(n: number) {
    const id = n <= 2 ? 'combo/multipop_double' : n === 3 ? 'combo/multipop_triple' : 'combo/multipop_mega';
    this.sfx(id, 0.7) || this.beep(880 + n * 60, 0.14, 'triangle', 0.22, 300);
  },
  /** Sandstorm about to blow: a rising hiss. */
  windWarn() {
    this.noise(0.9, 900, 0.1);
    this.beep(180, 0.9, 'sine', 0.06, 260);
  },
  windBlow() {
    this.noise(2.4, 1400, 0.16);
  },
  /** Volcano rumble under an eruption. */
  rumble() {
    this.sfx('boss/warning_telegraph', 0.5);
    this.noise(1.2, 160, 0.4);
    this.beep(55, 1.0, 'sawtooth', 0.22, -15);
  },
  /** The chain timer ran out. A soft falling pair — a sigh, not a punishment. */
  chainEnd(len: number) {
    if (len < 5) return;
    this.beep(520, 0.12, 'sine', 0.12, -160);
    setTimeout(() => this.beep(390, 0.16, 'sine', 0.1, -120), 90);
  },
  pickupFor(type: string) {
    const id = PICKUP_SFX[type];
    if (id) { if (this.sfx(id, 0.85)) return; }
    else if (this.sfx('pickup/weapon_capsule', 0.85)) return;
    this.pickup();
  },

  // ---------- Procedural primitives (kept as fallback) ----------
  /** Generic envelope tone */
  beep(freq, dur, type = 'square', vol = 0.4, slide = 0) {
    if (this.muted || this.cgMuted || !this.ctx || !this.master) return;
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
    if (this.muted || this.cgMuted || !this.ctx || !this.master) return;
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

  // ---------- Game-event hooks (asset-first, procedural fallback) ----------
  shoot() {
    if (this._playVariant('weapon/harpoon_fire', 0.9)) return;
    this.beep(880, 0.06, 'square', 0.18, -400);
  },
  /** Pop sound — pitch drops as ball size increases for tactile size feedback.
   *  Optional `type` overlays a small typed flourish on top of the base pop:
   *    electric → high zap, lava → low sizzle (noise burst), smoke → soft whoosh,
   *    armored → metallic clank, bonus → chime, explosive → boom-tail.
   *  Variants are quieter than the base pop so the audio mix stays balanced and
   *  the dominant feedback is still the size-pitched core pop. */
  _popBurstMs: 0,
  _popBurstN: 0,
  pop(size: number = 2, type: string = 'normal', quiet = false) {
    const s = Math.max(0, Math.min(4, size));
    // Density control: during a cascade dozens of pops land within a few
    // hundred ms. Each successive one in a burst is turned down, so the
    // result is a rolling crackle with the melody on top — not a wall.
    const now = performance.now();
    if (now - this._popBurstMs > 220) this._popBurstN = 0;
    this._popBurstMs = now;
    this._popBurstN++;
    const density = 1 / (1 + Math.max(0, this._popBurstN - 2) * 0.22);
    const playedBase = this._playVariant(`pop/base_size${s}`, (quiet ? 0.6 : 1) * density);
    if (quiet && this._popBurstN > 3) return;
    if (!playedBase) {
      const lo = 760 - s * 90;        // 760, 670, 580, 490, 400
      const hi = lo + 220;
      this.beep(lo, 0.08 + s * 0.012, 'triangle', 0.28 + s * 0.035, -180 - s * 30);
      this.beep(hi, 0.05, 'sine', 0.14, 0);
    }
    switch (type) {
      case 'electric':
        if (!this._playId('pop/flourish_electric', 0.55)) {
          this.beep(2200, 0.06, 'square', 0.16, -1400);
        }
        break;
      case 'lava':
        if (!this._playId('pop/flourish_lava', 0.5)) {
          this.noise(0.18, 1200, 0.18);
          this.beep(180, 0.18, 'sawtooth', 0.18, -60);
        }
        break;
      case 'smoke':
        this.noise(0.22, 600, 0.16);
        break;
      case 'armored':
        if (!this._playId('pop/flourish_armored_shatter', 0.55)) {
          this.beep(1100, 0.05, 'square', 0.22, 0);
          this.beep(540, 0.04, 'square', 0.14, 0);
        }
        break;
      case 'bonus':
        if (!this._playId('combo/multipop_double', 0.55)) {
          this.beep(1320, 0.16, 'triangle', 0.22, 0);
          setTimeout(() => this.beep(1760, 0.18, 'triangle', 0.18, 0), 50);
        }
        break;
      case 'explosive':
        // Quick tail to bridge into the explode() call site without overlap.
        this.beep(120, 0.18, 'sawtooth', 0.22, -40);
        break;
      case 'sludge':
        if (!this._playId('pop/flourish_sludge', 0.55)) {
          this.noise(0.16, 350, 0.18);
        }
        break;
    }
  },
  split() {
    if (this._playVariant('pop/split', 0.7)) return;
    this.beep(380, 0.1, 'sawtooth', 0.2, 120);
  },
  /** Timestamp of the last floor-bounce sound — global rate limit so a screen
   *  full of balls reads as a rhythm, not a drum roll. */
  _lastBounceMs: 0,
  /** Ball floor bounce — the metronome of the whole game. Quiet, size-pitched,
   *  rate-limited to one per ~90ms across all balls. */
  bounce(size: number = 2) {
    if (this.muted || this.cgMuted || !this.ctx) return;
    const now = performance.now();
    if (now - this._lastBounceMs < 90) return;
    this._lastBounceMs = now;
    const s = Math.max(0, Math.min(4, size));
    if (this._playId(`bounce/floor_size${s}`, 0.28 + s * 0.04)) return;
    this.beep(300 - s * 35, 0.05, 'sine', 0.1, -60);
  },
  /** Soft descending blip when a shot dies without hitting anything and the
   *  combo breaks — makes the streak loss audible without being punishing. */
  miss() {
    this.beep(320, 0.09, 'sine', 0.1, -140);
  },
  /** Combo-milestone fanfare: short ascending arpeggio whose pitch rises with the
   *  milestone level (1 = first milestone). Procedurally synthesized, no assets. */
  comboHit(level: number) {
    const id = level <= 1 ? 'combo/milestone_5_nice'
      : level === 2 ? 'combo/milestone_10_wild'
      : level === 3 ? 'combo/milestone_15_insane'
      : 'combo/milestone_20_godlike';
    if (this._playId(id, 0.9)) return;
    const offset = (level - 1) * 80;
    const notes = [392 + offset, 523 + offset, 659 + offset, 784 + offset];
    notes.forEach((f, i) => setTimeout(() => this.beep(f, 0.1, 'triangle', 0.32), i * 55));
  },
  /** Early-chain rising tick for combos 2–4 — fills the celebration dead zone
   *  between the first pop and the combo-5 NICE! fanfare. Pitch climbs with
   *  the chain so the player *hears* the streak building. */
  comboTick(combo: number) {
    const f = 540 + Math.min(combo, 8) * 110;
    setTimeout(() => this.beep(f, 0.07, 'triangle', 0.2, 60), 40);
  },
  pickup() {
    if (this._playId('pickup/generic_collect', 0.85)) return;
    this.beep(660, 0.08, 'sine', 0.4, 300);
    this.beep(990, 0.1, 'sine', 0.3, 200);
  },
  shieldBreak() {
    if (this._playId('pickup/shield_break', 0.8)) return;
    this.beep(220, 0.2, 'sawtooth', 0.4, -100);
  },
  hurt() {
    if (this._playId('stinger/player_dead', 0.9)) return;
    this.beep(160, 0.35, 'sawtooth', 0.45, -120);
  },
  explode(big = true) {
    if (this.sfx(big ? 'hazard/explosion_large' : 'hazard/explosion_small', big ? 0.95 : 0.8, 70)) return;
    this.noise(0.3, 600, big ? 0.6 : 0.4);
    this.beep(120, 0.3, 'sawtooth', big ? 0.4 : 0.25, -60);
  },
  bossHit() {
    if (this._playId('boss/hit_weak_point', 0.85)) return;
    this.beep(280, 0.1, 'square', 0.3, -100);
    this.beep(440, 0.08, 'square', 0.2, 0);
  },
  levelClear() {
    if (this._playId('stinger/level_clear', 0.9)) return;
    [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.beep(f,0.18,'triangle',0.4),i*80));
  },
  warning() {
    if (this._playId('stinger/timer_warning_10s', 0.6)) return;
    this.beep(880, 0.07, 'square', 0.25);
  },
  menu() {
    if (this._playId('ui/nav_move', 0.7)) return;
    this.beep(660, 0.06, 'square', 0.2);
  },
  /** Primary-CTA click (PLAY, Daily, Retry) — a firmer confirm than the
   *  nav-move tick, so committing to an action feels different from browsing. */
  confirm() {
    if (this._playId('ui/nav_confirm', 0.85)) return;
    this.beep(520, 0.07, 'triangle', 0.3);
    setTimeout(() => this.beep(780, 0.09, 'triangle', 0.3), 55);
  },
  /** Pointer entered a button — Tier-B subtle tick. Kept very quiet so a row
   *  of buttons swept by the cursor doesn't fatigue the ear. */
  hover() {
    if (this._playId('ui/button_hover', 0.35)) return;
    this.beep(1200, 0.02, 'sine', 0.06);
  },
  /** First-pop fanfare — a bigger, brighter, longer arpeggio than the combo
   *  one. Fires once per player, ever, on the very first ball they pop. */
  firstPop() {
    if (this._playId('combo/first_pop_celebration', 0.95)) return;
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 'triangle', 0.4), i * 70));
  },
  /** GO! beat at level start — short rising two-note pulse, like a starting bell. */
  go() {
    if (this._playId('combo/go_beat', 0.85)) return;
    this.beep(660, 0.09, 'triangle', 0.35);
    setTimeout(() => this.beep(990, 0.13, 'triangle', 0.4), 70);
  },
};
