/**
 * HTML/CSS Hub screen — the meta "back room".
 *
 * Part of the hybrid main-menu redesign: the attract-style main menu keeps
 * only the high-intent surfaces (logo, PLAY, Daily hero, a compact rewards
 * rail, a rank badge), and everything that read like a live-ops dashboard —
 * the profile/rank card, the full weekly-event detail, and theme mastery —
 * moves here, one tap away via the rank badge or the "Hub" nav button.
 *
 * No retention data is lost; it's re-homed so the front screen feels like a
 * game cabinet, not a web page. Built once at boot, toggled by domRoot.ts.
 *
 * Public API:
 *   buildHub(game): HTMLElement   — constructs the screen, wires nav.
 *   syncHub(game, root): void     — per-frame diffed sync of the dynamic bits.
 */

import { State } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { Storage } from '../../systems/storage';
import { currentTitle } from '../../systems/titles';
import { themeMastery } from '../../systems/mastery';
import { fmtCompact } from '../../utils';
import { weeklyBlock } from './resultParts';
import type { Game } from '../../game';

/** Marksman tier from lifetime pops — 25 pops/level, capped at 99. Mirrors
 *  the card that used to live on the main menu. */
function computeRank(pops: number): { level: number; cur: number; max: number; ratio: number } {
  const POPS_PER_LEVEL = 25;
  const level = Math.min(99, Math.floor(pops / POPS_PER_LEVEL) + 1);
  const cur   = pops - (level - 1) * POPS_PER_LEVEL;
  const max   = POPS_PER_LEVEL;
  const ratio = level >= 99 ? 1 : cur / max;
  return { level, cur, max, ratio };
}

/** Best single-run score across every mode. */
function computeHighScore(): number {
  let best = 0;
  if (Storage.data.bestScoreAttack > best) best = Storage.data.bestScoreAttack;
  if (Storage.data.bestPanicScore > best)  best = Storage.data.bestPanicScore;
  if ((Storage.data.bestBossRush || 0) > best) best = Storage.data.bestBossRush || 0;
  const bt = Storage.data.bestTour || {};
  for (const k in bt) if (bt[k] > best) best = bt[k];
  return best;
}

const MEDAL_GLYPH = ['—', '🥉', '🥈', '🥇'];

const HUB_NAV: { label: string; target: string }[] = [
  { label: 'Profile',     target: State.PROFILE     },
  { label: 'Stats',       target: State.STATS       },
  { label: 'High Scores', target: State.HIGH_SCORES },
];

export function buildHub(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen hub menu-backdrop';
  root.setAttribute('data-screen', 'hub');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Hub');

  // Drifting bubbles, same ambient backdrop as the menu.
  const bubbles = document.createElement('div');
  bubbles.className = 'menu__bubbles';
  bubbles.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 10; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.setProperty('--i', String(i));
    bubbles.appendChild(b);
  }
  root.appendChild(bubbles);

  const panel = document.createElement('div');
  panel.className = 'hub__panel';
  panel.innerHTML = `
    <h1 class="ui-heading ui-heading--display hub__title">HUB</h1>

    <div class="hub__profile cel-panel">
      <div class="menu__profile-header">
        <div class="menu__profile-avatar">PS</div>
        <div class="menu__profile-meta">
          <div class="menu__profile-name">PLAYER</div>
          <span class="menu__profile-title" data-role="profile-title" hidden></span>
        </div>
      </div>
      <div class="menu__profile-rank-wrap">
        <div class="menu__profile-rank-labels">
          <span>LVL <b data-role="profile-lvl">1</b></span>
          <span><b data-role="profile-xp-cur">0</b> / <span data-role="profile-xp-max">25</span> POPS</span>
        </div>
        <div class="menu__profile-rank-bar">
          <div class="menu__profile-rank-fill" data-role="profile-rank-fill" style="width:0%"></div>
        </div>
      </div>
      <div class="menu__profile-stats">
        <div class="menu__profile-stat">
          <div class="menu__profile-stat-label">HIGH SCORE</div>
          <div class="menu__profile-stat-value" data-role="profile-stat-score">0</div>
        </div>
        <div class="menu__profile-stat">
          <div class="menu__profile-stat-label">LEVELS</div>
          <div class="menu__profile-stat-value" data-role="profile-stat-levels">0</div>
        </div>
        <div class="menu__profile-stat">
          <div class="menu__profile-stat-label">BEST COMBO</div>
          <div class="menu__profile-stat-value" data-role="profile-stat-combo">×0</div>
        </div>
      </div>
    </div>

    <div class="hub__weekly" data-role="weekly"></div>

    <div class="hub__section">
      <div class="profile-section__title">Theme Mastery</div>
      <div class="hub__mastery" data-role="mastery"></div>
    </div>

    <nav class="hub__nav" aria-label="Hub navigation" data-role="nav"></nav>
  `;
  root.appendChild(panel);

  // Nav buttons into the deeper meta screens.
  const nav = panel.querySelector('[data-role="nav"]') as HTMLElement;
  for (const item of HUB_NAV) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn';
    b.textContent = item.label;
    b.addEventListener('click', () => {
      AudioSys.menu();
      game.state = item.target as Game['state'];
    });
    nav.appendChild(b);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'ui-btn ui-btn--cta hub__back';
  back.textContent = '‹ Back';
  back.addEventListener('click', () => {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  });
  nav.appendChild(back);

  const refs: Refs = {
    profileTitle:    panel.querySelector('[data-role="profile-title"]')     as HTMLElement,
    profileLvl:      panel.querySelector('[data-role="profile-lvl"]')       as HTMLElement,
    profileXpCur:    panel.querySelector('[data-role="profile-xp-cur"]')    as HTMLElement,
    profileXpMax:    panel.querySelector('[data-role="profile-xp-max"]')    as HTMLElement,
    profileRankFill: panel.querySelector('[data-role="profile-rank-fill"]') as HTMLElement,
    profileStatScore:  panel.querySelector('[data-role="profile-stat-score"]')  as HTMLElement,
    profileStatLevels: panel.querySelector('[data-role="profile-stat-levels"]') as HTMLElement,
    profileStatCombo:  panel.querySelector('[data-role="profile-stat-combo"]')  as HTMLElement,
    weekly:  panel.querySelector('[data-role="weekly"]')  as HTMLElement,
    mastery: panel.querySelector('[data-role="mastery"]') as HTMLElement,
  };
  (root as any).__refs = refs;
  return root;
}

interface Refs {
  profileTitle: HTMLElement;
  profileLvl: HTMLElement; profileXpCur: HTMLElement; profileXpMax: HTMLElement;
  profileRankFill: HTMLElement;
  profileStatScore: HTMLElement; profileStatLevels: HTMLElement; profileStatCombo: HTMLElement;
  weekly: HTMLElement; mastery: HTMLElement;
}

export function syncHub(_game: Game, root: HTMLElement) {
  const refs = (root as any).__refs as Refs;
  if (!refs) return;

  // --- Profile card ---
  const title = currentTitle();
  if (title) {
    refs.profileTitle.hidden = false;
    setText(refs.profileTitle, title.label);
  } else {
    refs.profileTitle.hidden = true;
  }
  const rank = computeRank(Storage.data.lifetimePops || 0);
  setText(refs.profileLvl,   String(rank.level));
  setText(refs.profileXpCur, String(rank.cur));
  setText(refs.profileXpMax, String(rank.max));
  const widthPct = (rank.ratio * 100).toFixed(1) + '%';
  if (refs.profileRankFill.style.width !== widthPct) refs.profileRankFill.style.width = widthPct;
  setText(refs.profileStatScore,  fmtCompact(computeHighScore()));
  setText(refs.profileStatLevels, String(Storage.data.unlockedLevel || 0));
  setText(refs.profileStatCombo,  '×' + (Storage.data.lifetimeMaxCombo || 0));

  // --- Weekly detail (reuses the result-screen weekly block) ---
  const weeklyHtml = weeklyBlock();
  if (refs.weekly.innerHTML !== weeklyHtml) refs.weekly.innerHTML = weeklyHtml;

  // --- Theme mastery ---
  const masteryHtml = themeMastery().map(m => {
    const pct = Math.min(100, Math.round(m.progress * 100));
    return `<div class="hub__mastery-row ${m.tier === 3 ? 'is-gold' : ''}">
      <div class="hub__mastery-top">
        <span class="hub__mastery-name">${MEDAL_GLYPH[m.tier]} ${m.label}</span>
        <b>${m.tierLabel}</b>
      </div>
      <div class="hub__mastery-bar"><span style="width:${pct}%"></span></div>
      <small>${m.nextLabel}</small>
    </div>`;
  }).join('');
  if (refs.mastery.innerHTML !== masteryHtml) refs.mastery.innerHTML = masteryHtml;
}

function setText(el: HTMLElement, value: string) {
  if (el.textContent !== value) el.textContent = value;
}
