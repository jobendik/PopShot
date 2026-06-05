/**
 * Three related overlays: Level Clear, Boss Defeated, Victory.
 * All share the .overlay-card chrome and a confetti layer for celebration.
 */

import { State } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { LEVELS } from '../../data/levels';
import { medalFor } from '../../systems/daily';
import { advanceFromLevelClear } from '../../state/levelClear';
import {
  missionsBlock, weeklyBlock, xpBarBlock, syncXpBar,
  nextBestActionBlock, levelClearHeadline,
} from './resultParts';
import { FX, type MedalTier } from '../overlay/effects';
import type { Game } from '../../game';

/** Honor the OS reduced-motion preference for the reward sequence. */
function prefersReduce(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function confettiLayer(count = 24): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'confetti';
  const colors = ['var(--brand-yellow)', 'var(--brand-coral)', 'var(--brand-mint)', 'var(--brand-cyan)', 'var(--brand-pink)', 'var(--brand-violet)'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.style.setProperty('--i', String(i));
    s.style.setProperty('--c', colors[i % colors.length]);
    wrap.appendChild(s);
  }
  return wrap;
}

export function buildLevelClear(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen clear overlay-screen';
  root.setAttribute('data-screen', 'level_clear');
  root.setAttribute('aria-label', 'Level clear');

  const card = document.createElement('div');
  card.className = 'overlay-card';
  card.appendChild(confettiLayer(20));
  card.innerHTML = `
    <h2 class="ui-heading ui-heading--display ui-heading--win overlay-card__title" data-role="headline">Level Clear!</h2>
    <div class="overlay-card__sub" data-role="level-name"></div>
    <div class="overlay-card__stats clear__stat-list" data-role="stats"></div>
    <div data-role="missions"></div>
    <div data-role="weekly"></div>
    <div data-role="xp"></div>
    <div data-role="nba"></div>
    <div class="overlay-card__actions" data-role="actions">
      <button type="button" class="ui-btn ui-btn--cta"   data-role="next">Next Level</button>
      <button type="button" class="ui-btn ui-btn--ghost" data-role="retry">Retry</button>
      <button type="button" class="ui-btn ui-btn--ghost" data-role="menu">Main Menu</button>
    </div>
    <div class="overlay-card__hint" data-role="hint">Press any key for Next</div>
  `;
  card.appendChild(confettiLayer(20));

  root.appendChild(card);

  card.querySelector<HTMLElement>('[data-role="next"]')!.addEventListener('click', () => {
    cancelSequence(root);
    advanceFromLevelClear(game);
  });
  card.querySelector<HTMLElement>('[data-role="retry"]')!.addEventListener('click', () => {
    cancelSequence(root);
    AudioSys.menu();
    retryCurrent(game);
  });
  card.querySelector<HTMLElement>('[data-role="menu"]')!.addEventListener('click', () => {
    cancelSequence(root);
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  });

  return root;
}

function retryCurrent(game: Game) {
  if (game.mode === 'score_attack') return game.startScoreAttack();
  if (game.mode === 'panic')        return game.startPanic();
  if (game.mode === 'boss_rush')    return game.startBossRush();
  return game.loadLevel(game.levelIndex);
}

export function syncLevelClear(game: Game, root: HTMLElement) {
  const headlineEl = root.querySelector<HTMLElement>('[data-role="headline"]');
  if (headlineEl) headlineEl.textContent = levelClearHeadline(game);

  const nameEl = root.querySelector<HTMLElement>('[data-role="level-name"]');
  if (nameEl) nameEl.textContent = game.levelName;

  // Hide "Next Level" on the last Tour stage; only show Retry/Menu. Cheap,
  // run every frame.
  const nextBtn = root.querySelector<HTMLElement>('[data-role="next"]');
  if (nextBtn) {
    const showNext = game.mode === 'tour'
      ? game.levelIndex + 1 < LEVELS.length
      : game.mode === 'score_attack';
    nextBtn.hidden = !showNext;
  }

  // Reward sequence runs ONCE per run. game.summary is a fresh object each
  // clear (nulled in advanceFromLevelClear), so a changed identity means a
  // new run to celebrate. Once sequenced, per-frame sync leaves the tally
  // alone so the count-up isn't clobbered.
  if (!game.summary) return;
  if ((root as any).__seqSummary === game.summary) return;
  (root as any).__seqSummary = game.summary;
  runRewardSequence(game, root);
}

interface SeqRow { label: string; cls?: string; prefix?: string; target?: number; raw?: string; big?: boolean; }

/** Build + animate the level-clear reward: stat rows count up one at a time
 *  with a tick, the Total slams a medal stamp + chromatic-aberration punch,
 *  then the meta blocks (missions/weekly/xp/nba) fade in below. */
function runRewardSequence(game: Game, root: HTMLElement) {
  cancelSequence(root);
  const s = game.summary!;
  const stats = root.querySelector<HTMLElement>('[data-role="stats"]');
  if (!stats) return;
  const reduce = prefersReduce();

  const rows: SeqRow[] = [
    { label: 'Base Score', prefix: '+', target: s.base },
    { label: 'Time Bonus', prefix: '+', target: s.time },
    { label: 'Accuracy',   prefix: '+', target: s.accuracy },
    { label: 'Combo',      prefix: '+', target: s.combo },
    { label: 'No-Miss',    prefix: '+', target: s.noMiss },
  ];
  if (s.tricks > 0) rows.push({ label: 'Tricks', raw: '×' + s.tricks });
  rows.push({ label: 'Total', prefix: '', target: s.total, cls: 'ui-stat-row__value--win', big: true });
  if (s.best > 0) rows.push({ label: 'Best', raw: s.best.toLocaleString(), cls: 'ui-stat-row__value--best' });
  if (s.newComboBest) rows.push({ label: 'NEW COMBO BEST', raw: '!', cls: 'ui-stat-row__value--win' });

  stats.innerHTML = rows.map((r, i) => {
    const initial = r.raw !== undefined ? r.raw : (r.prefix ?? '') + '0';
    return `<div class="ui-stat-row clear-row${reduce ? ' is-in' : ''}" data-row="${i}">
        <span class="ui-stat-row__label">${r.label}</span>
        <span class="ui-stat-row__value ${r.cls || ''}" data-rowval="${i}">${initial}</span>
      </div>`;
  }).join('');

  populateMeta(game, root);

  // Reduced motion: snap everything, fire the medal once, no chrom-ab.
  if (reduce) {
    rows.forEach((r, i) => {
      if (r.target !== undefined) {
        const el = stats.querySelector<HTMLElement>(`[data-rowval="${i}"]`);
        if (el) el.textContent = (r.prefix ?? '') + r.target.toLocaleString();
      }
    });
    slamMedal(game);
    revealMeta(root);
    return;
  }

  const gen = ((root as any).__seqGen = ((root as any).__seqGen | 0) + 1);
  const alive = () => (root as any).__seqGen === gen && (root as any).__seqSummary === game.summary;
  const timers: number[] = ((root as any).__seqTimers = []);
  const ROW_MS = 300;

  const animateRow = (i: number, done: () => void) => {
    const rowEl = stats.querySelector<HTMLElement>(`[data-row="${i}"]`);
    const valEl = stats.querySelector<HTMLElement>(`[data-rowval="${i}"]`);
    if (rowEl) rowEl.classList.add('is-in');
    AudioSys.menu(); // per-row tick
    const r = rows[i];
    if (r.target === undefined) { if (r.big && valEl) valEl.classList.add('is-pop'); done(); return; }
    const target = r.target, prefix = r.prefix ?? '';
    const start = performance.now();
    const tick = (now: number) => {
      if (!alive()) return;
      const t = Math.min(1, (now - start) / ROW_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      if (valEl) valEl.textContent = prefix + Math.round(target * eased).toLocaleString();
      if (t < 1) { (root as any).__seqRaf = requestAnimationFrame(tick); }
      else { if (r.big && valEl) valEl.classList.add('is-pop'); done(); }
    };
    (root as any).__seqRaf = requestAnimationFrame(tick);
  };

  let i = 0;
  const runNext = () => {
    if (!alive()) return;
    if (i >= rows.length) {
      const t = window.setTimeout(() => { if (alive()) revealMeta(root); }, 260);
      timers.push(t);
      return;
    }
    const isBig = !!rows[i].big;
    animateRow(i, () => {
      if (!alive()) return;
      if (isBig) slamMedal(game); // medal stamps at the Total
      i++;
      const t = window.setTimeout(runNext, isBig ? 240 : 90);
      timers.push(t);
    });
  };
  runNext();
}

/** Stamp the medal sticker + chromatic-aberration punch for this clear. */
function slamMedal(game: Game) {
  const s = game.summary;
  if (!s) return;
  let tier: MedalTier;
  if (game.mode === 'tour') {
    const t = medalFor(s.total, LEVELS[game.levelIndex]?.targetScore ?? 0);
    tier = (['bronze', 'bronze', 'silver', 'gold'] as MedalTier[])[t];
  } else {
    tier = s.best > 0 && s.total >= s.best ? 'gold' : 'silver';
  }
  if (s.newComboBest) tier = 'plat';
  const label = tier === 'plat' ? 'NEW RECORD' : tier.toUpperCase() + ' MEDAL';
  FX.medal(levelClearHeadline(game), label, tier);
  FX.chromAb();
  AudioSys.levelClear();
}

/** Populate the meta blocks (fresh each run) in a hidden state, ready to fade. */
function populateMeta(game: Game, root: HTMLElement) {
  const set = (sel: string, html: string) => {
    const el = root.querySelector<HTMLElement>(`[data-role="${sel}"]`);
    if (el) { el.innerHTML = html; el.classList.add('result-meta-block'); el.classList.remove('is-revealed'); }
  };
  set('missions', missionsBlock());
  set('weekly', weeklyBlock());
  set('xp', xpBarBlock(game.preRunTotalXp));
  set('nba', nextBestActionBlock(game));
}

/** Fade in the meta blocks and kick the XP bar animation as they appear. */
function revealMeta(root: HTMLElement) {
  for (const sel of ['missions', 'weekly', 'xp', 'nba']) {
    const el = root.querySelector<HTMLElement>(`[data-role="${sel}"]`);
    if (el) el.classList.add('is-revealed');
  }
  const xp = root.querySelector<HTMLElement>('[data-role="xp"]');
  if (xp) syncXpBar(xp);
}

/** Stop any in-flight reward sequence (fast Next/Retry/Menu, or a new run). */
function cancelSequence(root: HTMLElement) {
  if ((root as any).__seqRaf) { cancelAnimationFrame((root as any).__seqRaf); (root as any).__seqRaf = undefined; }
  const timers = (root as any).__seqTimers as number[] | undefined;
  if (timers) { for (const t of timers) clearTimeout(t); timers.length = 0; }
  (root as any).__seqGen = ((root as any).__seqGen | 0) + 1; // invalidate pending callbacks
}

export function buildBossDefeated(_game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen clear overlay-screen';
  root.setAttribute('data-screen', 'boss_defeated');
  root.setAttribute('aria-label', 'Boss defeated');

  const card = document.createElement('div');
  card.className = 'overlay-card';
  card.innerHTML = `
    <h2 class="ui-heading ui-heading--display ui-heading--win overlay-card__title">Boss Defeated!</h2>
    <div class="overlay-card__sub">Stand by…</div>
  `;
  card.appendChild(confettiLayer(30));
  root.appendChild(card);
  return root;
}

export function buildVictory(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen victory overlay-screen';
  root.setAttribute('data-screen', 'victory');
  root.setAttribute('aria-label', 'Victory');

  const card = document.createElement('div');
  card.className = 'overlay-card';
  card.innerHTML = `
    <h2 class="ui-heading ui-heading--display ui-heading--win overlay-card__title">VICTORY!</h2>
    <div class="overlay-card__sub">The Commander has fallen.</div>
    <div class="overlay-card__stats">
      <div class="ui-stat-row">
        <span class="ui-stat-row__label">Final Score</span>
        <span class="ui-stat-row__value ui-stat-row__value--best" data-role="final-score">0</span>
      </div>
      <div class="ui-stat-row">
        <span class="ui-stat-row__label">Bosses Defeated</span>
        <span class="ui-stat-row__value" data-role="boss-count">0</span>
      </div>
    </div>
    <div class="overlay-card__actions">
      <button type="button" class="ui-btn ui-btn--cta" data-role="menu">Main Menu</button>
    </div>
    <div class="overlay-card__hint">Thank you for playing</div>
  `;
  card.appendChild(confettiLayer(40));
  root.appendChild(card);

  card.querySelector<HTMLElement>('[data-role="menu"]')!.addEventListener('click', () => {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  });

  return root;
}

export function syncVictory(game: Game, root: HTMLElement) {
  const score = root.querySelector<HTMLElement>('[data-role="final-score"]');
  if (score) score.textContent = game.score.toLocaleString();
  const bc = root.querySelector<HTMLElement>('[data-role="boss-count"]');
  if (bc) bc.textContent = String(game.bossRushCount || (game.mode === 'tour' ? 1 : 0));
}
