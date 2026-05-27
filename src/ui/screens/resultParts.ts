/**
 * Shared retention widgets for result screens (Level Clear, Game Over,
 * Daily Result). Each function returns an HTML string; the caller is
 * responsible for placing it inside the .overlay-card.
 *
 * Design intent (matches the framework):
 *   - Mission bars: show all three daily missions with progress, so even
 *     a failed run shows "you almost finished a mission".
 *   - Weekly row: surface the Panic event goal + best when relevant.
 *   - XP bar: animates the +Δ between before/after using a CSS transition.
 *   - Next best action: one single line, the most relevant goal next.
 */

import { LEVELS } from '../../data/levels';
import { activeMissions, getWeeklyEvent, nextUnlockHint, weeklyBestScore } from '../../systems/retention';
import { computeAccountLevel, infoFromTotalXp, type AccountLevelInfo } from '../../systems/progression';
import { medalFor } from '../../systems/daily';
import { Storage, type MedalTier } from '../../systems/storage';
import type { Game } from '../../game';

/** Daily missions block — three progress bars, one per active mission. */
export function missionsBlock(): string {
  const ms = activeMissions();
  if (!ms.length) return '';
  const rows = ms.map(m => {
    const pct = Math.round((m.progress / m.target) * 100);
    const done = m.complete;
    return `
      <div class="result-mission ${done ? 'is-complete' : ''}">
        <div class="result-mission__head">
          <span class="result-mission__label">${done ? '✓ ' : ''}${m.label}</span>
          <span class="result-mission__count">${Math.min(m.progress, m.target).toLocaleString()} / ${m.target.toLocaleString()}</span>
        </div>
        <div class="result-mission__bar"><span style="width:${pct}%"></span></div>
      </div>`;
  }).join('');
  return `
    <div class="result-section">
      <div class="result-section__label">Daily Missions</div>
      ${rows}
    </div>`;
}

/** Weekly Panic event row — only meaningful when the player has touched panic. */
export function weeklyBlock(): string {
  const ev = getWeeklyEvent();
  const best = weeklyBestScore();
  if (best <= 0) {
    return `
      <div class="result-section">
        <div class="result-section__label">Weekly · ${ev.label}</div>
        <div class="result-mission">
          <div class="result-mission__head">
            <span class="result-mission__label">${ev.goalLabel}</span>
            <span class="result-mission__count">Try Panic Mode</span>
          </div>
        </div>
      </div>`;
  }
  const pct = Math.min(100, Math.round((best / ev.scoreGoal) * 100));
  return `
    <div class="result-section">
      <div class="result-section__label">Weekly · ${ev.label}</div>
      <div class="result-mission ${best >= ev.scoreGoal ? 'is-complete' : ''}">
        <div class="result-mission__head">
          <span class="result-mission__label">Best Panic Score</span>
          <span class="result-mission__count">${best.toLocaleString()} / ${ev.scoreGoal.toLocaleString()}</span>
        </div>
        <div class="result-mission__bar"><span style="width:${pct}%"></span></div>
      </div>
    </div>`;
}

/** Account-XP bar — animates from the before-run XP position to the after.
 *  The element is built static; syncXpBar() drives the animation. */
export function xpBarBlock(preRunTotalXp: number): string {
  const before = infoFromTotalXp(preRunTotalXp);
  const after  = computeAccountLevel(Storage.data);
  const gained = Math.max(0, after.totalXp - before.totalXp);
  const leveledUp = after.level > before.level;
  // Initial render shows the BEFORE position; sync() animates to AFTER.
  const startPct = Math.round(before.ratio * 100);
  return `
    <div class="result-section result-xp" data-role="xp-block"
         data-before-level="${before.level}" data-after-level="${after.level}"
         data-before-pct="${startPct}" data-after-pct="${Math.round(after.ratio * 100)}"
         data-gained="${gained}" data-leveled="${leveledUp ? '1' : '0'}">
      <div class="result-section__label">
        <span data-role="xp-level">Lv ${before.level}</span>
        <span class="result-xp__gain" data-role="xp-gain">${gained > 0 ? '+' + gained + ' XP' : ''}</span>
      </div>
      <div class="result-mission__bar result-xp__bar">
        <span data-role="xp-fill" style="width:${startPct}%"></span>
      </div>
      <div class="result-xp__sub" data-role="xp-sub">${after.inLevel} / ${after.xpForCurrent} XP</div>
    </div>`;
}

/** Drive the XP bar animation after the block has been inserted into the DOM. */
export function syncXpBar(root: HTMLElement): void {
  const block = root.querySelector<HTMLElement>('[data-role="xp-block"]');
  if (!block || block.dataset.synced === '1') return;
  block.dataset.synced = '1';
  const fill = block.querySelector<HTMLElement>('[data-role="xp-fill"]');
  const levelLabel = block.querySelector<HTMLElement>('[data-role="xp-level"]');
  const sub = block.querySelector<HTMLElement>('[data-role="xp-sub"]');
  const afterPct = Number(block.dataset.afterPct || 0);
  const afterLevel = Number(block.dataset.afterLevel || 1);
  const leveled = block.dataset.leveled === '1';
  // Small delay so the user sees the bar start at "before" then animate up,
  // matching the reward-reveal cadence (score first, then XP).
  setTimeout(() => {
    if (fill) fill.style.width = afterPct + '%';
    if (leveled) {
      if (levelLabel) levelLabel.textContent = 'Lv ' + afterLevel + ' — LEVEL UP!';
      block.classList.add('is-levelup');
    } else if (levelLabel) {
      levelLabel.textContent = 'Lv ' + afterLevel;
    }
    void sub; // currentl static; left as a hook for future per-second drain
  }, 350);
}

/** Pick the single highest-value next action for the player. */
export function nextBestAction(game: Game): { text: string; sub?: string } {
  // 1) Almost-complete mission wins — most actionable, most "one more run".
  const ms = activeMissions();
  const nearMission = ms
    .filter(m => !m.complete && m.target > 0)
    .map(m => ({ m, frac: m.progress / m.target }))
    .filter(x => x.frac >= 0.4)
    .sort((a, b) => b.frac - a.frac)[0];
  if (nearMission) {
    const left = nearMission.m.target - nearMission.m.progress;
    return { text: nearMission.m.label, sub: left.toLocaleString() + ' to go' };
  }

  // 2) Tour: next medal threshold on current stage, or unlock the next level.
  if (game.mode === 'tour' || game.mode === 'score_attack') {
    const L = LEVELS[game.levelIndex];
    if (L) {
      const cur = Storage.data.bestTour[L.id] || game.score;
      const tier = medalFor(cur, L.targetScore);
      const next = nextMedalDelta(cur, L.targetScore, tier);
      if (next) return { text: 'Replay ' + L.name + ' for ' + next.label, sub: next.delta.toLocaleString() + ' more points' };
    }
    const nextIdx = game.levelIndex + 1;
    if (nextIdx < LEVELS.length && nextIdx > game.unlockedLevel) {
      return { text: 'Clear ' + L.name + ' to unlock ' + LEVELS[nextIdx].name };
    }
    if (nextIdx < LEVELS.length) {
      return { text: 'Next: ' + LEVELS[nextIdx].name };
    }
  }

  // 3) Panic: chase weekly goal, or beat personal best wave.
  if (game.mode === 'panic') {
    const ev = getWeeklyEvent();
    const best = weeklyBestScore();
    if (best < ev.scoreGoal) {
      return { text: 'One more Panic could beat the weekly goal', sub: (ev.scoreGoal - best).toLocaleString() + ' to reach ' + ev.label };
    }
    const bestWave = Storage.data.bestPanicWave || 0;
    return { text: 'Push past Wave ' + (bestWave + 1) + ' next run' };
  }

  // 4) Fallback to the existing nextUnlockHint (palette / title progress).
  return { text: nextUnlockHint() };
}

function nextMedalDelta(score: number, target: number, tier: MedalTier):
  { label: string; delta: number } | null {
  if (target <= 0) return null;
  const bronze = target;
  const silver = Math.floor(target * 1.25);
  const gold   = Math.floor(target * 1.5);
  if (tier === 0) return { label: 'BRONZE', delta: bronze - score };
  if (tier === 1) return { label: 'SILVER', delta: silver - score };
  if (tier === 2) return { label: 'GOLD',   delta: gold - score };
  return null;
}

/** Render the next-best-action line for inclusion in a result card. */
export function nextBestActionBlock(game: Game): string {
  const a = nextBestAction(game);
  return `
    <div class="result-nba">
      <div class="result-nba__label">Next</div>
      <div class="result-nba__text">${escapeHtml(a.text)}${a.sub ? ' <span class="result-nba__sub">' + escapeHtml(a.sub) + '</span>' : ''}</div>
    </div>`;
}

/** Pick the headline string for a level clear. */
export function levelClearHeadline(game: Game): string {
  const L = LEVELS[game.levelIndex];
  if (!L || game.mode !== 'tour') return 'Stage Clear!';
  const tier = medalFor(game.score, L.targetScore);
  const prevTier = Storage.data.medals[L.id] || 0;
  if (tier === 3 && prevTier < 3) return 'GOLD MEDAL!';
  if (tier === 2 && prevTier < 2) return 'SILVER MEDAL!';
  if (tier === 1 && prevTier < 1) return 'BRONZE MEDAL!';
  const best = Storage.data.bestTour[L.id] || 0;
  if (game.score >= best && game.score > 0 && best > 0) return 'NEW BEST!';
  if (game.shotsFired > 0 && game.shotsFired === game.shotsHit) return 'PERFECT CLEAR!';
  if (game.lives === 1) return 'CLUTCH CLEAR!';
  return 'Level Clear!';
}

/** Pick the "you almost…" comeback callout for a failed run. Null when none fits. */
export function almostCallout(game: Game): { text: string; kind: 'mission' | 'medal' | 'best' | 'wave' } | null {
  // Almost-mission first — most generic
  const near = activeMissions()
    .filter(m => !m.complete && m.target > 0)
    .map(m => ({ m, left: m.target - m.progress, frac: m.progress / m.target }))
    .filter(x => x.frac >= 0.7)
    .sort((a, b) => b.frac - a.frac)[0];
  if (near) return { text: near.left + ' ' + near.m.label.toLowerCase().replace(/^[a-z]/, c => c) + ' from done', kind: 'mission' };

  if (game.mode === 'panic') {
    const bestWave = Storage.data.bestPanicWave || 0;
    if (bestWave > 0 && game.panicWave - 1 === bestWave) {
      return { text: 'Matched your best wave — one more run could beat it', kind: 'wave' };
    }
    if (bestWave > 0 && game.panicWave - 1 >= bestWave - 1 && game.panicWave - 1 > 0) {
      return { text: 'One wave from your personal best', kind: 'wave' };
    }
  }

  if (game.mode === 'tour' || game.mode === 'score_attack') {
    const L = LEVELS[game.levelIndex];
    if (L) {
      const cur = Storage.data.bestTour[L.id] || 0;
      if (cur > 0 && game.score > 0 && game.score >= cur * 0.85 && game.score < cur) {
        return { text: 'Within ' + (cur - game.score).toLocaleString() + ' of your best', kind: 'best' };
      }
      const tier = medalFor(game.score, L.targetScore);
      const next = nextMedalDelta(game.score, L.targetScore, tier);
      if (next && next.delta <= L.targetScore * 0.2 && next.delta > 0) {
        return { text: next.delta.toLocaleString() + ' points from ' + next.label, kind: 'medal' };
      }
    }
  }

  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
}
