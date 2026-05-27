import { type DeathReason } from '../constants';
import { emit } from './analytics';
import { todayUTC } from './daily';
import { Storage } from './storage';
import { FX } from '../ui/overlay/effects';
import type { Game } from '../game';

export type MissionKind = 'pop' | 'trick' | 'pickup' | 'level_clear' | 'score' | 'panic_wave' | 'medal' | 'score_improve' | 'multi_pop';

export interface MissionDef {
  id: string;
  label: string;
  kind: MissionKind;
  target: number;
  rewardStars: number;
}

export interface MissionView extends MissionDef {
  progress: number;
  claimed: boolean;
  complete: boolean;
}

/** Which game activity a weekly event targets. */
export type WeeklyMode = 'panic' | 'score_attack' | 'combo';

export interface WeeklyEvent {
  id: string;
  weekId: string;
  label: string;
  desc: string;
  goalLabel: string;
  /** Mode that counts toward this week's goal. */
  mode: WeeklyMode;
  scoreGoal: number;
  waveGoal: number;
  /** Minimum max-combo to fulfil a 'combo' event. 0 for non-combo events. */
  comboGoal: number;
  rewardStars: number;
}

type WeeklyEventDef = Omit<WeeklyEvent, 'id' | 'weekId' | 'goalLabel'>;

const MISSION_DEFS: MissionDef[] = [
  { id: 'pop_60',       label: 'Pop 60 bubbles',       kind: 'pop',         target: 60,    rewardStars: 1 },
  { id: 'trick_5',      label: 'Land 5 trick shots',    kind: 'trick',       target: 5,     rewardStars: 1 },
  { id: 'pickup_5',     label: 'Grab 5 pickups',        kind: 'pickup',      target: 5,     rewardStars: 1 },
  { id: 'clear_2',      label: 'Clear 2 stages',        kind: 'level_clear', target: 2,     rewardStars: 1 },
  { id: 'score_15000',  label: 'Score 15,000 in a run', kind: 'score',       target: 15000, rewardStars: 2 },
  { id: 'panic_wave_6', label: 'Reach Panic Wave 6',    kind: 'panic_wave',  target: 6,     rewardStars: 2 },
  { id: 'medal_any',    label: 'Earn any medal',        kind: 'medal',       target: 1,     rewardStars: 1 },
  { id: 'improve_any',  label: 'Improve any stage score', kind: 'score_improve', target: 1, rewardStars: 1 },
  { id: 'multi_pop_3',  label: 'Land a triple multi-pop', kind: 'multi_pop', target: 1,     rewardStars: 1 },
];

const WEEKLY_EVENTS: WeeklyEventDef[] = [
  // Panic events
  { label: 'Rainbow Rush', desc: 'Push Panic Mode for score. Star Bubbles decide the run.', mode: 'panic',        scoreGoal: 35000, waveGoal: 8,  comboGoal: 0, rewardStars: 4 },
  { label: 'Wave Climb',   desc: 'Survive deep waves. Safe movement beats greedy shots.',   mode: 'panic',        scoreGoal: 25000, waveGoal: 10, comboGoal: 0, rewardStars: 4 },
  { label: 'Combo Panic',  desc: 'Keep chains alive while the board fills up.',             mode: 'panic',        scoreGoal: 45000, waveGoal: 7,  comboGoal: 0, rewardStars: 5 },
  { label: 'No Fear Week', desc: 'Close calls and quick clears turn into big scores.',      mode: 'panic',        scoreGoal: 30000, waveGoal: 9,  comboGoal: 0, rewardStars: 4 },
  // Score Attack events
  { label: 'Score Sprint', desc: 'Race through Tour levels for the highest single-run score in Score Attack.',    mode: 'score_attack', scoreGoal: 30000, waveGoal: 0, comboGoal: 0, rewardStars: 4 },
  { label: 'Tour Blitz',   desc: 'Blast through stages. Tricks and chained pops stack points fast.',             mode: 'score_attack', scoreGoal: 40000, waveGoal: 0, comboGoal: 0, rewardStars: 5 },
  // Combo events — any mode counts, best run combo is tracked
  { label: 'Combo Craze',  desc: 'Keep your chain alive across any mode. Your peak combo this week is your score.', mode: 'combo', scoreGoal: 0, waveGoal: 0, comboGoal: 15, rewardStars: 4 },
  { label: 'Chain Breaker',desc: 'Build the longest unbroken combo you can. Any mode qualifies.',                   mode: 'combo', scoreGoal: 0, waveGoal: 0, comboGoal: 20, rewardStars: 5 },
];

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function currentWeekId(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function pickMissionIds(day: string): string[] {
  const pool = MISSION_DEFS.slice();
  const seed = hash32(day + ':missions');
  pool.sort((a, b) => (hash32(a.id + seed) % 997) - (hash32(b.id + seed) % 997));
  return pool.slice(0, 3).map(m => m.id);
}

function ensureMissions(): void {
  const day = todayUTC();
  if (Storage.data.missionDay === day && Storage.data.missionStates) return;
  const states: Record<string, { id: string; progress: number; claimed: boolean }> = {};
  for (const id of pickMissionIds(day)) states[id] = { id, progress: 0, claimed: false };
  Storage.data.missionDay = day;
  Storage.data.missionStates = states;
  Storage.save();
  emit('missions.roll', { day, ids: Object.keys(states) });
}

export function activeMissions(): MissionView[] {
  ensureMissions();
  return Object.keys(Storage.data.missionStates || {}).map(id => {
    const def = MISSION_DEFS.find(m => m.id === id) || MISSION_DEFS[0];
    const state = Storage.data.missionStates[id] || { id, progress: 0, claimed: false };
    const progress = Math.min(def.target, Math.max(0, state.progress || 0));
    return { ...def, progress, claimed: !!state.claimed, complete: progress >= def.target };
  });
}

export function advanceMissions(kind: MissionKind, amount = 1, value = 0): MissionView[] {
  ensureMissions();
  const completed: MissionView[] = [];
  let dirty = false;
  for (const mission of activeMissions()) {
    if (mission.kind !== kind) continue;
    const state = Storage.data.missionStates[mission.id];
    const before = state.progress || 0;
    const next = kind === 'score' || kind === 'panic_wave'
      ? Math.max(before, value || amount)
      : before + amount;
    state.progress = Math.min(mission.target, next);
    if (!state.claimed && state.progress >= mission.target) {
      state.claimed = true;
      Storage.data.missionStars = (Storage.data.missionStars || 0) + mission.rewardStars;
      completed.push({ ...mission, progress: mission.target, claimed: true, complete: true });
      FX.toast('success', 'MISSION COMPLETE', mission.label + ' +' + mission.rewardStars + ' stars');
      emit('mission.complete', { id: mission.id, stars: mission.rewardStars });
    }
    if (state.progress !== before) dirty = true;
  }
  if (dirty || completed.length > 0) Storage.save();
  return completed;
}

export function getWeeklyEvent(): WeeklyEvent {
  const weekId = currentWeekId();
  const base = WEEKLY_EVENTS[hash32(weekId) % WEEKLY_EVENTS.length];
  let goalLabel: string;
  if (base.mode === 'combo') {
    goalLabel = 'Goal: Combo ×' + base.comboGoal + ' in any mode';
  } else if (base.mode === 'score_attack') {
    goalLabel = 'Goal: ' + base.scoreGoal.toLocaleString() + ' in Score Attack';
  } else {
    goalLabel = 'Goal: Wave ' + base.waveGoal + ' or ' + base.scoreGoal.toLocaleString() + ' score';
  }
  return {
    ...base,
    id: weekId + ':' + base.label.toLowerCase().replace(/\s+/g, '_'),
    weekId,
    goalLabel,
  };
}

/** Best metric stored for the current weekly event (score or max-combo value). */
export function weeklyBestScore(): number {
  const event = getWeeklyEvent();
  return Storage.data.weeklyPanicBest?.[event.id] || 0;
}

export function recordWeeklyPanic(score: number, wave: number): { newBest: boolean; rewarded: boolean } {
  const event = getWeeklyEvent();
  if (event.mode !== 'panic') return { newBest: false, rewarded: false };
  if (!Storage.data.weeklyPanicBest) Storage.data.weeklyPanicBest = {};
  const before = Storage.data.weeklyPanicBest[event.id] || 0;
  const newBest = score > before;
  if (newBest) {
    Storage.data.weeklyPanicBest[event.id] = score;
    emit('weekly.best', { event: event.id, score, wave });
  }
  let rewarded = false;
  const metGoal = score >= event.scoreGoal || wave >= event.waveGoal;
  if (metGoal && Storage.data.weeklyRewardClaimed !== event.weekId) {
    Storage.data.weeklyRewardClaimed = event.weekId;
    Storage.data.missionStars = (Storage.data.missionStars || 0) + event.rewardStars;
    FX.toast('success', 'WEEKLY COMPLETE', '+' + event.rewardStars + ' mission stars');
    emit('weekly.reward', { event: event.id, score, wave, stars: event.rewardStars });
    rewarded = true;
  }
  if (newBest || rewarded) Storage.save();
  return { newBest, rewarded };
}

export function recordWeeklyScoreAttack(score: number): { newBest: boolean; rewarded: boolean } {
  const event = getWeeklyEvent();
  if (event.mode !== 'score_attack') return { newBest: false, rewarded: false };
  if (!Storage.data.weeklyPanicBest) Storage.data.weeklyPanicBest = {};
  const before = Storage.data.weeklyPanicBest[event.id] || 0;
  const newBest = score > before;
  if (newBest) {
    Storage.data.weeklyPanicBest[event.id] = score;
    emit('weekly.best', { event: event.id, score });
  }
  let rewarded = false;
  if (score >= event.scoreGoal && Storage.data.weeklyRewardClaimed !== event.weekId) {
    Storage.data.weeklyRewardClaimed = event.weekId;
    Storage.data.missionStars = (Storage.data.missionStars || 0) + event.rewardStars;
    FX.toast('success', 'WEEKLY COMPLETE', '+' + event.rewardStars + ' mission stars');
    emit('weekly.reward', { event: event.id, score, stars: event.rewardStars });
    rewarded = true;
  }
  if (newBest || rewarded) Storage.save();
  return { newBest, rewarded };
}

export function recordWeeklyCombo(maxCombo: number): { newBest: boolean; rewarded: boolean } {
  const event = getWeeklyEvent();
  if (event.mode !== 'combo') return { newBest: false, rewarded: false };
  if (!Storage.data.weeklyPanicBest) Storage.data.weeklyPanicBest = {};
  const before = Storage.data.weeklyPanicBest[event.id] || 0;
  const newBest = maxCombo > before;
  if (newBest) {
    Storage.data.weeklyPanicBest[event.id] = maxCombo;
    emit('weekly.best', { event: event.id, combo: maxCombo });
  }
  let rewarded = false;
  if (maxCombo >= event.comboGoal && Storage.data.weeklyRewardClaimed !== event.weekId) {
    Storage.data.weeklyRewardClaimed = event.weekId;
    Storage.data.missionStars = (Storage.data.missionStars || 0) + event.rewardStars;
    FX.toast('success', 'WEEKLY COMPLETE', '+' + event.rewardStars + ' mission stars');
    emit('weekly.reward', { event: event.id, combo: maxCombo, stars: event.rewardStars });
    rewarded = true;
  }
  if (newBest || rewarded) Storage.save();
  return { newBest, rewarded };
}

export function nextUnlockHint(): string {
  const stars = Storage.data.missionStars || 0;
  const candidates = [
    { need: 5, have: stars, text: 'Next palette at 5 mission stars' },
    { need: 12, have: stars, text: 'Neon palette at 12 mission stars' },
    { need: 25, have: stars, text: 'Weekly Legend title at 25 mission stars' },
    { need: 75, have: Storage.data.lifetimePops || 0, text: 'Mint palette at 75 lifetime pops' },
    { need: 3, have: Storage.data.dailyStreak || 0, text: 'Sunburst palette at a 3-day streak' },
    { need: 10, have: Storage.data.bestPanicWave || 0, text: 'Wave Rider title at Panic Wave 10' },
  ].filter(c => c.have < c.need);
  candidates.sort((a, b) => (b.have / b.need) - (a.have / a.need));
  const c = candidates[0];
  if (!c) return 'All nearby unlocks cleared. Chase gold medals and weekly Panic.';
  return c.text + ' (' + c.have + '/' + c.need + ')';
}

export function deathTipFor(reason: DeathReason | null, game: Game): string {
  if (game.mode === 'panic') return 'Panic tip: use Star Bubbles to reset crowded screens, then move before firing again.';
  if (reason === 'timeout') return 'Timer tip: take easy small pops first. The board gets safer and the clock bonus can wait.';
  if (reason === 'ball') return 'Movement tip: stand where the ball will bounce next, not where it is now.';
  if (reason === 'hazard') return 'Hazard tip: clear falling threats before chasing a perfect combo.';
  if (reason === 'boss') return 'Boss tip: wait for the boss lane to open, fire once, then reposition.';
  if (reason === 'crab') return 'Crab tip: hop to the other side early; the bottom lane is not always safe.';
  return 'Tip: one clean pop is better than a rushed shot that traps you.';
}
