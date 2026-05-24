export type MedalTier = 0 | 1 | 2 | 3;     // 0 = none, 1 = bronze, 2 = silver, 3 = gold

export interface SaveData {
  schemaVersion: 2;
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
}

const KEY_V1 = 'bba_save_v1';
const KEY_V2 = 'bba_save_v2';

function createDefaultSave(): SaveData {
  return {
    schemaVersion: 2,
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
  };
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

// ============================ STORAGE ===============================
// Wrapper around localStorage with versioned schema + graceful migration.
export const Storage: { data: SaveData; load: () => SaveData; save: () => void } = {
  data: createDefaultSave(),
  load() {
    try {
      const rawV2 = localStorage.getItem(KEY_V2);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        this.data = { ...createDefaultSave(), ...(parsed || {}) };
        // Defensive: nested objects need to be present even after partial saves.
        if (!this.data.bestTour)  this.data.bestTour  = {};
        if (!this.data.medals)    this.data.medals    = {};
        if (!this.data.dailyBest) this.data.dailyBest = {};
        return this.data;
      }
      const rawV1 = localStorage.getItem(KEY_V1);
      if (rawV1) {
        this.data = migrateFromV1(rawV1);
        // Persist immediately so v1 readers don't run forever.
        this.save();
        return this.data;
      }
    } catch { /* localStorage unavailable: use defaults */ }
    this.data = createDefaultSave();
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY_V2, JSON.stringify(this.data)); } catch { /* ignore */ }
  },
};
