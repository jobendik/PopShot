/**
 * Game Over overlay. Dramatic — alarm-pulse border, warning chrome,
 * death-reason callout, run stats, rewarded-continue when available.
 */

import { DEATH_REASON_TEXT, State } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { Storage } from '../../systems/storage';
import { deathTipFor } from '../../systems/retention';
import { emit } from '../../systems/analytics';
import { canRewardedContinue, startRewardedContinue } from '../../state/gameOver';
import {
  missionsBlock, weeklyBlock, xpBarBlock, syncXpBar,
  nextBestActionBlock, almostCallout,
} from './resultParts';
import type { Game } from '../../game';

export function buildGameOver(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen gameover overlay-screen';
  root.setAttribute('data-screen', 'game_over');
  root.setAttribute('aria-label', 'Game over');

  const card = document.createElement('div');
  card.className = 'overlay-card';
  card.innerHTML = `
    <div class="gameover__warning" data-role="warning">Run Ended</div>
    <h2 class="ui-heading ui-heading--display ui-heading--fail overlay-card__title">Game Over</h2>
    <p class="daily__desc" data-role="reason" hidden></p>
    <div class="result-almost" data-role="almost" hidden></div>
    <p class="gameover__tip" data-role="tip"></p>
    <div class="overlay-card__stats" data-role="stats"></div>
    <div data-role="missions"></div>
    <div data-role="weekly"></div>
    <div data-role="xp"></div>
    <div data-role="nba"></div>
    <div class="overlay-card__actions">
      <button type="button" class="ui-btn ui-btn--success" data-role="continue" hidden>▶  Watch Ad to Continue</button>
      <button type="button" class="ui-btn ui-btn--cta"     data-role="retry">Retry</button>
      <button type="button" class="ui-btn ui-btn--ghost"   data-role="menu">Main Menu</button>
    </div>
    <div class="overlay-card__hint" data-role="hint">Press any key to retry · Esc for menu</div>
  `;
  root.appendChild(card);

  card.querySelector<HTMLElement>('[data-role="retry"]')!.addEventListener('click', () => {
    AudioSys.menu();
    if (game.mode === 'score_attack') game.startScoreAttack();
    else if (game.mode === 'panic')     game.startPanic();
    else if (game.mode === 'boss_rush') game.startBossRush();
    else                                game.loadLevel(game.levelIndex);
  });
  card.querySelector<HTMLElement>('[data-role="menu"]')!.addEventListener('click', () => {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  });
  card.querySelector<HTMLElement>('[data-role="continue"]')!.addEventListener('click', () => {
    AudioSys.menu();
    startRewardedContinue(game);
  });

  return root;
}

export function syncGameOver(game: Game, root: HTMLElement) {
  const reason = root.querySelector<HTMLElement>('[data-role="reason"]');
  if (reason) {
    if (game.lastDeathReason) {
      reason.hidden = false;
      reason.textContent = DEATH_REASON_TEXT[game.lastDeathReason];
    } else reason.hidden = true;
  }

  const stats = root.querySelector<HTMLElement>('[data-role="stats"]');
  if (stats) {
    const rows: { label: string; value: string; cls?: string }[] = [];
    rows.push({ label: 'Final Score', value: game.score.toLocaleString(), cls: 'ui-stat-row__value--best' });
    if (game.mode === 'panic') {
      const best = Math.max(Storage.data.bestPanicWave, game.panicWave);
      const bestScore = Math.max(Storage.data.bestPanicScore, game.score);
      const newScore = game.score >= Storage.data.bestPanicScore && game.score > 0;
      rows.push({ label: 'Reached Wave', value: String(game.panicWave) });
      rows.push({ label: 'Best Wave',    value: String(best) });
      rows.push({ label: 'Best Score',   value: bestScore.toLocaleString(), cls: newScore ? 'ui-stat-row__value--win' : undefined });
    } else if (game.mode === 'score_attack') {
      const best = Storage.data.bestScoreAttack;
      const newBest = game.score > best;
      rows.push({ label: 'Personal Best', value: Math.max(best, game.score).toLocaleString(), cls: newBest ? 'ui-stat-row__value--win' : undefined });
    } else if (game.mode === 'boss_rush') {
      const newCount = game.bossRushCount > (Storage.data.bestBossRushCount || 0);
      rows.push({ label: 'Bosses Defeated', value: String(game.bossRushCount), cls: newCount ? 'ui-stat-row__value--win' : undefined });
      rows.push({ label: 'Best Run',        value: Math.max(Storage.data.bestBossRushCount || 0, game.bossRushCount) + ' bosses' });
      rows.push({ label: 'Best Score',      value: Math.max(Storage.data.bestBossRush || 0, game.score).toLocaleString() });
    }
    if (game.shotsFired > 0) {
      const acc = Math.round((game.shotsHit / game.shotsFired) * 100);
      rows.push({ label: 'Accuracy', value: acc + '%' });
    }
    if (game.maxCombo > 1) rows.push({ label: 'Max Combo', value: '×' + game.maxCombo });
    const html = rows.map(r => `
      <div class="ui-stat-row">
        <span class="ui-stat-row__label">${r.label}</span>
        <span class="ui-stat-row__value ${r.cls || ''}">${r.value}</span>
      </div>
    `).join('');
    if (stats.innerHTML !== html) stats.innerHTML = html;
  }

  // "You almost…" comeback callout — turns a loss into useful feedback.
  const almost = root.querySelector<HTMLElement>('[data-role="almost"]');
  if (almost && !almost.dataset.populated) {
    almost.dataset.populated = '1';
    const cb = almostCallout(game);
    if (cb) {
      almost.hidden = false;
      almost.innerHTML = '<span class="result-almost__icon">★</span> ' + cb.text;
      almost.dataset.kind = cb.kind;
    } else {
      almost.hidden = true;
    }
  }

  // Daily mission bars, weekly row, XP bar, next-best-action.
  const missions = root.querySelector<HTMLElement>('[data-role="missions"]');
  if (missions && !missions.dataset.populated) { missions.innerHTML = missionsBlock(); missions.dataset.populated = '1'; }
  const weekly = root.querySelector<HTMLElement>('[data-role="weekly"]');
  if (weekly && !weekly.dataset.populated) { weekly.innerHTML = weeklyBlock(); weekly.dataset.populated = '1'; }
  const xp = root.querySelector<HTMLElement>('[data-role="xp"]');
  if (xp && !xp.dataset.populated) {
    xp.innerHTML = xpBarBlock(game.preRunTotalXp);
    xp.dataset.populated = '1';
    syncXpBar(xp);
  }
  const nba = root.querySelector<HTMLElement>('[data-role="nba"]');
  if (nba && !nba.dataset.populated) { nba.innerHTML = nextBestActionBlock(game); nba.dataset.populated = '1'; }

  const tip = root.querySelector<HTMLElement>('[data-role="tip"]');
  if (tip) {
    const text = deathTipFor(game.lastDeathReason, game);
    if (tip.textContent !== text) {
      tip.textContent = text;
      emit('death.tip_shown', { mode: game.mode, reason: game.lastDeathReason || 'unknown' });
    }
  }

  const cont = root.querySelector<HTMLElement>('[data-role="continue"]');
  if (cont) {
    const show = canRewardedContinue(game);
    cont.hidden = !show;
    cont.toggleAttribute('disabled', game.awaitingAd);
  }
  const hint = root.querySelector<HTMLElement>('[data-role="hint"]');
  if (hint) hint.textContent = game.awaitingAd ? 'Loading ad…' : 'Press any key to retry · Esc for menu';
}
