export interface SaveData {
  bestTour: Record<string, number>;
  bestScoreAttack: number;
  bestPanicWave: number;
  bestPanicScore: number;
  muted: boolean;
  unlockedLevel?: number;
}

function createDefaultSave(): SaveData {
  return {
    bestTour: {},
    bestScoreAttack: 0,
    bestPanicWave: 0,
    bestPanicScore: 0,
    muted: false,
  };
}

// ============================ STORAGE ===============================
// Tiny wrapper around localStorage with JSON parsing and safe fallbacks.
export const Storage: { KEY: string; data: SaveData; load: () => SaveData; save: () => void } = {
  KEY: 'bba_save_v1',
  data: createDefaultSave(),
  load() {
    try { this.data = { ...createDefaultSave(), ...(JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}) }; }
    catch (e) { this.data = createDefaultSave(); }
    if (!this.data.bestTour) this.data.bestTour = {};
    if (!this.data.bestScoreAttack) this.data.bestScoreAttack = 0;
    if (!this.data.bestPanicWave) this.data.bestPanicWave = 0;
    if (!this.data.bestPanicScore) this.data.bestPanicScore = 0;
    if (this.data.muted == null) this.data.muted = false;
    return this.data;
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },
};
