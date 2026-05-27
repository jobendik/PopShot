/**
 * Progression projection — Account Level / Account XP.
 *
 * IMPORTANT: This module adds NO new save fields. The account level is a
 * *pure projection* of existing lifetime data (lifetimePops, missionStars,
 * lifetimeTricks, lifetimePlayMs, bestPanicWave, unlockedLevel, medals).
 *
 * That way: if a player wipes save data, returns from cloud, or we change
 * the formula later, nothing breaks — the level is always derived. We get
 * a per-run "+XP gained" line without taking on the maintenance cost of a
 * persisted XP integer.
 *
 * The formula and curve are deliberately gentle: early levels arrive fast
 * (10 pops → Lv 2 is normal for the first session), then taper to a
 * comfortable "you'll see the next level after another run" rhythm.
 */

import type { SaveData } from './storage';

export interface AccountLevelInfo {
  /** Current account level, 1-based. */
  level: number;
  /** XP accumulated *within* the current level (0..xpForCurrent). */
  inLevel: number;
  /** XP needed to reach the next level (total XP at next minus current). */
  xpForCurrent: number;
  /** 0..1 progress within the current level. */
  ratio: number;
  /** Total XP earned (lifetime projection). */
  totalXp: number;
}

/**
 * Total XP a player has earned across their lifetime, projected from save.
 * Every weight is small and integer; no fractional jitter between sessions.
 *
 *  +1 XP per ball ever popped       (skill volume)
 *  +1 XP per trick shot ever        (skill quality)
 *  +8 XP per mission star           (daily engagement)
 * +15 XP per medal tier earned      (mastery, all medals counted)
 *  +5 XP per best Panic wave        (panic mastery)
 * +10 XP per unlocked Tour level    (progression)
 *  +2 XP per minute of playtime     (gentle floor for failed grind sessions)
 */
export function computeTotalXp(save: SaveData): number {
  const pops    = save.lifetimePops || 0;
  const tricks  = save.lifetimeTricks || 0;
  const stars   = save.missionStars || 0;
  const wave    = save.bestPanicWave || 0;
  const unlocks = save.unlockedLevel || 0;
  const minutes = Math.floor((save.lifetimePlayMs || 0) / 60000);
  let medalSum = 0;
  const medals = save.medals || {};
  for (const id in medals) medalSum += medals[id] || 0;
  return pops + tricks + stars * 8 + medalSum * 15 + wave * 5 + unlocks * 10 + minutes * 2;
}

/**
 * XP required to *reach* level `n` (so xpForLevel(1) === 0). The curve is
 * a soft quadratic that means level 2 arrives within the first stage,
 * level 5 within the first session, and levels keep arriving roughly
 * once per stage clear thereafter.
 *
 *  Lv 2 →   60 XP
 *  Lv 3 →  140 XP
 *  Lv 5 →  360 XP
 *  Lv 10 → 1140 XP
 *  Lv 20 → 3940 XP
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 40 * n + 20 * n * n;
}

export function computeAccountLevel(save: SaveData): AccountLevelInfo {
  const totalXp = computeTotalXp(save);
  let level = 1;
  // Linear walk is fine — practical caps stay under ~50 in normal play.
  while (xpForLevel(level + 1) <= totalXp && level < 200) level++;
  const floor = xpForLevel(level);
  const ceil  = xpForLevel(level + 1);
  const xpForCurrent = Math.max(1, ceil - floor);
  const inLevel = Math.max(0, totalXp - floor);
  return { level, inLevel, xpForCurrent, ratio: inLevel / xpForCurrent, totalXp };
}

/**
 * Reconstruct an AccountLevelInfo from a stored totalXp number — used to
 * project the "before this run" position on the XP bar without needing to
 * snapshot the whole SaveData. Callers cache a single number at run-start.
 */
export function infoFromTotalXp(totalXp: number): AccountLevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp && level < 200) level++;
  const floor = xpForLevel(level);
  const ceil  = xpForLevel(level + 1);
  const xpForCurrent = Math.max(1, ceil - floor);
  const inLevel = Math.max(0, totalXp - floor);
  return { level, inLevel, xpForCurrent, ratio: inLevel / xpForCurrent, totalXp };
}
