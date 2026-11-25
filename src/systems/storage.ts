import { remapLegacyLevelIndex } from '../data/levels';
import { Platform as Sdk } from './platform';

export type MedalTier = 0 | 1 | 2 | 3;     // 0 = none, 1 = bronze, 2 = silver, 3 = gold

/** Personal bests recorded under the previous scoring model (medalScale 2).
 *  They cannot be compared with current scores, so they are kept here —
 *  shown as "Classic" records and still honoured by title unlocks — instead
 *  of being silently overwritten or pretending to be the same scale. */
export interface LegacyBests {
  scoreAttack: number;
  panicWave: number;
  panicScore: number;
  bossRush: number;
  bossRushCount: number;
}

export interface SaveData {
  /** 3 = the 27-stage Tour (two boss stages inserted; unlockedLevel remapped). */
  schemaVersion: 3;
  bestTour: Record<string, number>;
  bestScoreAttack: number;
  bestPanicWave: number;
  bestPanicScore: number;
  muted: boolean;
  unlockedLevel: number;
  // Added in v2 ↓
  medals: Record<string, MedalTier>;
  dailyLastPlayed: string;          // 'YYYY-MM-DD' (UTC) of the last day the daily was attempted
  dailyStreak: number;              // consecutive UTC days the player has attempted the daily
  dailyBest: Record<string, number>;// 'YYYY-MM-DD' -> best score on that day
  reducedMotion: boolean;           // accessibility: skip screen shake and white flash
  lastSessionDate: string;          // 'YYYY-MM-DD' (UTC) — used to drive the welcome-back banner
  firstPopCelebrated: boolean;      // one-time "FIRST POP!" celebration has fired for this player
  lifetimeMaxCombo: number;         // highest combo ever reached, for the Combo Crusher title
  lifetimePops: number;             // every ball popped ever — drives the Marksman title
  bestMultiPop: number;             // largest single multi-pop chain ever — drives Detonator
  lifetimeTricks: number;           // CLUTCH/AIR/CLOSE/BANK shots accumulated — drives Trickster
  lifetimePlayMs: number;           // cumulative time spent in the PLAYING state, ms
  /** Comma-joined ids of titles we have already shown the unlock toast for.
   *  Prevents re-firing the toast on every session for titles already known. */
  seenTitleIds: string;
  /** Highest Boss Rush completion score, persisted across sessions so the
   *  player has a tangible "beat my best" to chase in the mode. */
  bestBossRush: number;
  /** Highest number of bosses defeated in a single Boss Rush run. */
  bestBossRushCount: number;
  /** Optional equipped title id. Empty means "auto-pick the best earned title". */
  equippedTitleId: string;
  /** Cosmetic palette id used by Player 1. */
  playerPaletteId: string;
  /** Per-trick counters. Keys are trick ids from systems/titles.ts. */
  trickStats: Record<string, number>;
  /** Best Panic score successfully queued for CrazyGames leaderboard submit. */
  leaderboardPanicSubmitted: number;
  /** UTC day that owns the current mission roll. */
  missionDay: string;
  /** Current mission progress by mission id. */
  missionStates: Record<string, { id: string; progress: number; claimed: boolean }>;
  /** Spend-free progression currency earned from missions and weekly events. */
  missionStars: number;
  /** Best Panic score for each weekly event id. */
  weeklyPanicBest: Record<string, number>;
  /** Week id whose weekly reward has already been granted. */
  weeklyRewardClaimed: string;
  /** Mobile-only: auto-fire while playing so the player doesn't have to hold the
   *  Fire button. Default on (mobile thumb fatigue is the #1 Pang-on-phone gripe).
   *  Desktop ignores this entirely. */
  mobileAutoFire: boolean;
  /** Mobile-only: swap movement buttons to the right side and fire to the left
   *  for left-handed players. Body[data-lefty] drives CSS. */
  mobileLefty: boolean;
  /** Mobile-only: 0.85–1.25 scale multiplier on touch controls so small-handed
   *  players can shrink them and tablet players can grow them. */
  mobileTouchScale: number;
  /** Mobile-only: navigator.vibrate() on press / pop / damage. */
  mobileHaptics: boolean;
  /** Mobile-only: one-time-seen flag for the first-play touch overlay. */
  mobileOnboardingSeen: boolean;
  /** Scoring generation.
   *   2 — Tour medals moved from cumulative-run to per-level scores.
   *   3 — time-based chains, tiered multipliers and new clear bonuses.
   *  Scores from an older generation are not comparable: on upgrade the
   *  per-level best SCORES are cleared (so new runs can register), earned
   *  MEDAL TIERS are kept (an achievement stays achieved), and mode bests
   *  move to `legacy`. */
  medalScale: number;
  /** Mode bests from the previous scoring generation (see LegacyBests). */
  legacy: LegacyBests;
  /** Stages cleared in one unbroken chain — drives the Perfectionist title. */
  perfectChains: number;
  /** One-time contextual tips already shown (id → true). */
  tips: Record<string, boolean>;
  /** Touch: double-tap a side to dash. On by default; can be switched off
   *  by players who find it fires by accident. */
  mobileDoubleTapDash: boolean;
}

const KEY_V1 = 'bba_save_v1';
const KEY_V2_LEGACY = 'bba_save_v2';
const KEY_V2 = 'popshot_save_v2';

function createDefaultSave(): SaveData {
  return {
    schemaVersion: 3,
    bestTour: {},
    bestScoreAttack: 0,
    bestPanicWave: 0,
    bestPanicScore: 0,
    muted: false,
    unlockedLevel: 0,
    medals: {},
    dailyLastPlayed: '',
    dailyStreak: 0,
    dailyBest: {},
    reducedMotion: false,
    lastSessionDate: '',
    firstPopCelebrated: false,
    lifetimeMaxCombo: 0,
    lifetimePops: 0,
    bestMultiPop: 0,
    lifetimeTricks: 0,
    lifetimePlayMs: 0,
    seenTitleIds: '',
    bestBossRush: 0,
    bestBossRushCount: 0,
    equippedTitleId: '',
    playerPaletteId: 'classic',
    trickStats: {},
    leaderboardPanicSubmitted: 0,
    missionDay: '',
    missionStates: {},
    missionStars: 0,
    weeklyPanicBest: {},
    weeklyRewardClaimed: '',
    mobileAutoFire: true,
    mobileLefty: false,
    mobileTouchScale: 1,
    mobileHaptics: true,
    mobileOnboardingSeen: false,
    medalScale: 3,
    legacy: { scoreAttack: 0, panicWave: 0, panicScore: 0, bossRush: 0, bossRushCount: 0 },
    perfectChains: 0,
    tips: {},
    mobileDoubleTapDash: true,
  };
}

/**
 * Bring a raw snapshot (local OR cloud) up to the current schema. Pure: it
 * returns a new object and never touches storage, so the same function is
 * applied to a stale cloud copy before it is merged — a v2 cloud save can
 * therefore never drag index-based or old-scale values into a v3 save.
 */
export function upgradeSnapshot(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const out = { ...raw };
  // v2 → v3: two boss stages were inserted into the Tour.
  if ((out.schemaVersion ?? 2) < 3) {
    if (typeof out.unlockedLevel === 'number') out.unlockedLevel = remapLegacyLevelIndex(out.unlockedLevel);
    out.schemaVersion = 3;
  }
  const scale = out.medalScale ?? 0;
  if (scale < 3) {
    const prev: Partial<LegacyBests> = out.legacy || {};
    out.legacy = {
      scoreAttack:   Math.max(prev.scoreAttack || 0,   out.bestScoreAttack || 0),
      panicWave:     Math.max(prev.panicWave || 0,     out.bestPanicWave || 0),
      panicScore:    Math.max(prev.panicScore || 0,    out.bestPanicScore || 0),
      bossRush:      Math.max(prev.bossRush || 0,      out.bestBossRush || 0),
      bossRushCount: Math.max(prev.bossRushCount || 0, out.bestBossRushCount || 0),
    };
    out.bestScoreAttack = 0;
    out.bestPanicWave = 0;
    out.bestPanicScore = 0;
    out.bestBossRush = 0;
    out.bestBossRushCount = 0;
    out.leaderboardPanicSubmitted = 0;
    out.weeklyPanicBest = {};
    out.bestTour = {};
    // Medals from generation 2 are grandfathered. Anything older was judged
    // on cumulative run scores and never meant the same thing — drop those.
    if (scale < 2) out.medals = {};
    out.medalScale = 3;
  }
  return out;
}

function migrateFromV1(raw: string): SaveData {
  const out = createDefaultSave();
  try {
    const v1 = JSON.parse(raw);
    if (v1 && typeof v1 === 'object') {
      if (v1.bestTour && typeof v1.bestTour === 'object') out.bestTour = v1.bestTour;
      if (typeof v1.bestScoreAttack === 'number') out.bestScoreAttack = v1.bestScoreAttack;
      if (typeof v1.bestPanicWave === 'number')   out.bestPanicWave   = v1.bestPanicWave;
      if (typeof v1.bestPanicScore === 'number')  out.bestPanicScore  = v1.bestPanicScore;
      if (typeof v1.muted === 'boolean')          out.muted           = v1.muted;
      if (typeof v1.unlockedLevel === 'number')   out.unlockedLevel   = v1.unlockedLevel;
    }
  } catch { /* corrupt v1: fall back to defaults */ }
  return out;
}

/**
 * Merge a cloud snapshot into the local save, preferring the higher value for
 * each progress field so the merge can never erase progress made offline. Used
 * after the SDK Data Module returns a cloud save asynchronously.
 */
function mergeProgress(local: SaveData, cloud: Partial<SaveData>): SaveData {
  const out: SaveData = { ...local };
  if (cloud.unlockedLevel != null)   out.unlockedLevel   = Math.max(local.unlockedLevel,   cloud.unlockedLevel);
  if (cloud.bestScoreAttack != null) out.bestScoreAttack = Math.max(local.bestScoreAttack, cloud.bestScoreAttack);
  if (cloud.bestPanicWave != null)   out.bestPanicWave   = Math.max(local.bestPanicWave,   cloud.bestPanicWave);
  if (cloud.bestPanicScore != null)  out.bestPanicScore  = Math.max(local.bestPanicScore,  cloud.bestPanicScore);
  if (cloud.lifetimeMaxCombo != null) out.lifetimeMaxCombo = Math.max(local.lifetimeMaxCombo || 0, cloud.lifetimeMaxCombo);
  if (cloud.lifetimePops != null)    out.lifetimePops    = Math.max(local.lifetimePops || 0,    cloud.lifetimePops);
  if (cloud.bestMultiPop != null)    out.bestMultiPop    = Math.max(local.bestMultiPop || 0,    cloud.bestMultiPop);
  if (cloud.lifetimeTricks != null)  out.lifetimeTricks  = Math.max(local.lifetimeTricks || 0,  cloud.lifetimeTricks);
  if (cloud.lifetimePlayMs != null)  out.lifetimePlayMs  = Math.max(local.lifetimePlayMs || 0,  cloud.lifetimePlayMs);
  if (cloud.bestBossRush != null)    out.bestBossRush    = Math.max(local.bestBossRush || 0,    cloud.bestBossRush);
  if (cloud.bestBossRushCount != null) out.bestBossRushCount = Math.max(local.bestBossRushCount || 0, cloud.bestBossRushCount);
  if (cloud.leaderboardPanicSubmitted != null) {
    out.leaderboardPanicSubmitted = Math.max(local.leaderboardPanicSubmitted || 0, cloud.leaderboardPanicSubmitted);
  }
  if (cloud.missionStars != null) out.missionStars = Math.max(local.missionStars || 0, cloud.missionStars || 0);
  if (cloud.weeklyPanicBest) {
    const merged = { ...(local.weeklyPanicBest || {}) };
    for (const k in cloud.weeklyPanicBest) merged[k] = Math.max(merged[k] || 0, cloud.weeklyPanicBest[k] || 0);
    out.weeklyPanicBest = merged;
  }
  if (cloud.weeklyRewardClaimed && cloud.weeklyRewardClaimed > (local.weeklyRewardClaimed || '')) {
    out.weeklyRewardClaimed = cloud.weeklyRewardClaimed;
  }
  if (cloud.missionDay) {
    if (cloud.missionDay > (local.missionDay || '')) {
      out.missionDay = cloud.missionDay;
      out.missionStates = cloud.missionStates || {};
    } else if (cloud.missionDay === local.missionDay && cloud.missionStates) {
      const merged = { ...(local.missionStates || {}) };
      for (const id in cloud.missionStates) {
        const c = cloud.missionStates[id];
        const l = merged[id];
        merged[id] = {
          id,
          progress: Math.max(l?.progress || 0, c?.progress || 0),
          claimed: !!(l?.claimed || c?.claimed),
        };
      }
      out.missionStates = merged;
    }
  }
  // Title-seen set: union, so the unlock toast doesn't re-fire on a new device
  // for titles the player has already seen elsewhere.
  if (cloud.seenTitleIds) {
    const merged = new Set((local.seenTitleIds || '').split(',').filter(Boolean));
    for (const id of cloud.seenTitleIds.split(',').filter(Boolean)) merged.add(id);
    out.seenTitleIds = Array.from(merged).join(',');
  }
  if (cloud.dailyStreak != null)     out.dailyStreak     = Math.max(local.dailyStreak,     cloud.dailyStreak);
  // Last-played: take the later date.
  if (cloud.dailyLastPlayed && cloud.dailyLastPlayed > local.dailyLastPlayed) out.dailyLastPlayed = cloud.dailyLastPlayed;
  if (cloud.lastSessionDate && cloud.lastSessionDate > local.lastSessionDate) out.lastSessionDate = cloud.lastSessionDate;
  // Per-level bests: keep the max for each entry; union of keys. Cloud saves
  // from the cumulative-medal era (medalScale < 2) are skipped — their
  // bestTour/medal values are on an incomparable scale (see load()).
  const cloudMedalsComparable = (cloud.medalScale ?? 0) >= 3;
  if (cloud.bestTour && cloudMedalsComparable) {
    const merged = { ...local.bestTour };
    for (const k in cloud.bestTour) merged[k] = Math.max(merged[k] || 0, cloud.bestTour[k]);
    out.bestTour = merged;
  }
  if (cloud.medals && cloudMedalsComparable) {
    const merged = { ...local.medals };
    for (const k in cloud.medals) {
      const cv = cloud.medals[k] as MedalTier;
      const lv = (merged[k] as MedalTier) || 0;
      merged[k] = (cv > lv ? cv : lv) as MedalTier;
    }
    out.medals = merged;
  }
  if (cloud.dailyBest) {
    const merged = { ...local.dailyBest };
    for (const k in cloud.dailyBest) merged[k] = Math.max(merged[k] || 0, cloud.dailyBest[k]);
    out.dailyBest = merged;
  }
  if (cloud.trickStats) {
    const merged = { ...(local.trickStats || {}) };
    for (const k in cloud.trickStats) merged[k] = Math.max(merged[k] || 0, cloud.trickStats[k] || 0);
    out.trickStats = merged;
  }
  if (cloud.legacy) {
    const l = local.legacy || { scoreAttack: 0, panicWave: 0, panicScore: 0, bossRush: 0, bossRushCount: 0 };
    const c = cloud.legacy;
    out.legacy = {
      scoreAttack:   Math.max(l.scoreAttack || 0,   c.scoreAttack || 0),
      panicWave:     Math.max(l.panicWave || 0,     c.panicWave || 0),
      panicScore:    Math.max(l.panicScore || 0,    c.panicScore || 0),
      bossRush:      Math.max(l.bossRush || 0,      c.bossRush || 0),
      bossRushCount: Math.max(l.bossRushCount || 0, c.bossRushCount || 0),
    };
  }
  if (cloud.perfectChains != null) out.perfectChains = Math.max(local.perfectChains || 0, cloud.perfectChains || 0);
  if (cloud.tips) out.tips = { ...(local.tips || {}), ...cloud.tips };
  // Sticky one-time flags: if either side has fired the celebration, keep it.
  if (cloud.firstPopCelebrated) out.firstPopCelebrated = true;
  if (typeof cloud.equippedTitleId === 'string') out.equippedTitleId = cloud.equippedTitleId;
  if (typeof cloud.playerPaletteId === 'string') out.playerPaletteId = cloud.playerPaletteId;
  // Settings (muted, reducedMotion) — prefer the cloud copy if it exists, since
  // it represents the player's most recent device preference.
  if (typeof cloud.muted === 'boolean')         out.muted         = cloud.muted;
  if (typeof cloud.reducedMotion === 'boolean') out.reducedMotion = cloud.reducedMotion;
  return out;
}

// Debounced cloud write — coalesces save bursts (e.g. several Storage.save()
// calls during a single level-clear) into one network call. The Data Module
// itself rate-limits, so this is purely a polite-citizen optimization.
let cloudWriteTimer: number | null = null;
function scheduleCloudWrite(payload: string) {
  if (typeof window === 'undefined') return;
  if (cloudWriteTimer != null) window.clearTimeout(cloudWriteTimer);
  cloudWriteTimer = window.setTimeout(() => {
    cloudWriteTimer = null;
    Sdk.save(KEY_V2, payload).catch(() => { /* swallow — local copy is canonical */ });
  }, 1200);
}

// ============================ STORAGE ===============================
// Versioned schema with graceful migration. Two-tier persistence:
//   1. localStorage   — synchronous, always written, the source of truth at boot.
//   2. CrazyGames Data Module — best-effort, asynchronous, gives cross-device
//      sync for logged-in CrazyGames users. Merged in after boot when ready.
export const Storage: {
  data: SaveData;
  load: () => SaveData;
  save: () => void;
  hydrateCloud: () => Promise<{ merged: boolean }>;
} = {
  data: createDefaultSave(),
  load() {
    try {
      // Migrate from the legacy key used when the game was called BubbleBreaker.
      const rawLegacyV2 = localStorage.getItem(KEY_V2_LEGACY);
      if (rawLegacyV2 && !localStorage.getItem(KEY_V2)) {
        localStorage.setItem(KEY_V2, rawLegacyV2);
        localStorage.removeItem(KEY_V2_LEGACY);
      }
      const rawV2 = localStorage.getItem(KEY_V2);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        const upgraded = upgradeSnapshot(parsed || {});
        const needsWrite = (parsed?.schemaVersion ?? 2) < 3 || (parsed?.medalScale ?? 0) < 3;
        this.data = { ...createDefaultSave(), ...upgraded };
        // Defensive: nested objects need to be present even after partial saves.
        if (!this.data.bestTour)  this.data.bestTour  = {};
        if (!this.data.medals)    this.data.medals    = {};
        if (!this.data.dailyBest) this.data.dailyBest = {};
        if (!this.data.trickStats) this.data.trickStats = {};
        if (!this.data.missionStates) this.data.missionStates = {};
        if (!this.data.weeklyPanicBest) this.data.weeklyPanicBest = {};
        if (!this.data.playerPaletteId) this.data.playerPaletteId = 'classic';
        if (typeof this.data.equippedTitleId !== 'string') this.data.equippedTitleId = '';
        if (typeof this.data.leaderboardPanicSubmitted !== 'number') this.data.leaderboardPanicSubmitted = 0;
        if (typeof this.data.missionDay !== 'string') this.data.missionDay = '';
        if (typeof this.data.missionStars !== 'number') this.data.missionStars = 0;
        if (typeof this.data.weeklyRewardClaimed !== 'string') this.data.weeklyRewardClaimed = '';
        // Mobile control settings — backfill for pre-existing saves so the
        // mobile UX is sensible on first load after this update.
        if (typeof this.data.mobileAutoFire !== 'boolean') this.data.mobileAutoFire = true;
        if (typeof this.data.mobileLefty !== 'boolean') this.data.mobileLefty = false;
        if (typeof this.data.mobileTouchScale !== 'number' || !isFinite(this.data.mobileTouchScale)) this.data.mobileTouchScale = 1;
        if (typeof this.data.mobileHaptics !== 'boolean') this.data.mobileHaptics = true;
        if (typeof this.data.mobileOnboardingSeen !== 'boolean') this.data.mobileOnboardingSeen = false;
        if (!this.data.legacy) this.data.legacy = createDefaultSave().legacy;
        if (!this.data.tips) this.data.tips = {};
        if (typeof this.data.perfectChains !== 'number') this.data.perfectChains = 0;
        if (typeof this.data.mobileDoubleTapDash !== 'boolean') this.data.mobileDoubleTapDash = true;
        // Persist a schema/scoring upgrade immediately so it runs exactly once.
        if (needsWrite) this.save();
        return this.data;
      }
      const rawV1 = localStorage.getItem(KEY_V1);
      if (rawV1) {
        this.data = { ...createDefaultSave(), ...upgradeSnapshot({ ...migrateFromV1(rawV1), schemaVersion: 2, medalScale: 0 }) };
        // Persist immediately so v1 readers don't run forever.
        this.save();
        return this.data;
      }
    } catch { /* localStorage unavailable: use defaults */ }
    this.data = createDefaultSave();
    return this.data;
  },
  save() {
    const payload = JSON.stringify(this.data);
    try { localStorage.setItem(KEY_V2, payload); } catch { /* ignore */ }
    // Mirror to the cloud (best-effort, debounced). The local copy is still
    // canonical — cloud write failures must never affect gameplay.
    scheduleCloudWrite(payload);
  },
  /** Pull any cloud save and merge it into the local copy. Returns whether a
   *  meaningful merge happened (caller can re-render menus etc). Always safe —
   *  resolves false on no-SDK, no-cloud-entry, parse failure, or no progress. */
  async hydrateCloud() {
    try {
      const raw = await Sdk.load(KEY_V2);
      if (!raw) return { merged: false };
      const cloud = upgradeSnapshot(JSON.parse(raw)) as Partial<SaveData>;
      const before = JSON.stringify(this.data);
      this.data = mergeProgress(this.data, cloud);
      const after = JSON.stringify(this.data);
      if (before === after) return { merged: false };
      // Persist the merged result locally and bounce it back to the cloud so
      // both copies converge. Skip the cloud write if we're already in sync.
      try { localStorage.setItem(KEY_V2, after); } catch { /* ignore */ }
      scheduleCloudWrite(after);
      return { merged: true };
    } catch {
      return { merged: false };
    }
  },
};
