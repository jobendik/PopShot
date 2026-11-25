/**
 * Level select. The Tour is laid out as three ACTS, one per row: two worlds
 * (4 stages each) and the boss they lead to. Reading left to right, every
 * row ends in a boss tile — the structure of the adventure is the layout.
 */

import { State } from '../../constants';
import { LEVELS } from '../../data/levels';
import { AudioSys } from '../../systems/audio';
import { Storage } from '../../systems/storage';
import type { Game } from '../../game';

/** Medal tier for a tile: the best of the recorded tier (which survives
 *  scoring-model upgrades) and whatever the current best score earns. */
function tierFor(id: string, targetScore: number): number {
  const best = Storage.data.bestTour?.[id] || 0;
  let t = 0;
  if (best > 0 && targetScore > 0) {
    if (best >= targetScore * 1.5) t = 3;
    else if (best >= targetScore * 1.25) t = 2;
    else if (best >= targetScore) t = 1;
  }
  return Math.max(t, Storage.data.medals?.[id] || 0);
}

const BOSS_SHORT: Record<string, string> = { globo: 'KING GLOBO', volta: 'VOLTA', rift: 'CMDR RIFT' };

export function buildLevelSelect(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen levels menu-backdrop';
  root.setAttribute('data-screen', 'level_select');
  root.setAttribute('aria-label', 'Level select');

  const bubbles = document.createElement('div');
  bubbles.className = 'menu-bubbles';
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.setProperty('--i', String(i));
    bubbles.appendChild(b);
  }
  root.appendChild(bubbles);

  const title = document.createElement('h2');
  title.className = 'ui-heading ui-heading--display levels__title';
  title.textContent = 'Tour';
  root.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'levels__grid';
  root.appendChild(grid);

  for (let i = 0; i < LEVELS.length; i++) {
    const L = LEVELS[i] as { id: string; name: string; theme: string; boss?: string };
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'level-cell level-cell--' + L.theme;
    if (L.boss) cell.classList.add('is-boss');
    cell.dataset.levelIndex = String(i);
    cell.title = L.name;
    cell.innerHTML = L.boss
      ? `<span class="level-cell__theme">boss</span>
         <span class="level-cell__num level-cell__num--boss">${BOSS_SHORT[L.boss] || L.name}</span>
         <span class="level-cell__medal" data-role="medal"></span>`
      : `<span class="level-cell__theme">${L.theme}</span>
         <span class="level-cell__num">${i + 1}</span>
         <span class="level-cell__medal" data-role="medal"></span>`;
    cell.addEventListener('mouseenter', () => {
      if (!cell.classList.contains('is-locked')) game.levelSelectIndex = i;
    });
    cell.addEventListener('click', () => {
      if (cell.classList.contains('is-locked')) {
        AudioSys.sfx('ui/error', 0.5) || AudioSys.hover();
        return;
      }
      AudioSys.confirm();
      game.startTour(i);
    });
    grid.appendChild(cell);
  }

  const info = document.createElement('div');
  info.className = 'levels__info';
  info.dataset.role = 'info';
  root.appendChild(info);

  const hint = document.createElement('div');
  hint.className = 'ui-back-hint';
  hint.textContent = 'Esc · back';
  root.appendChild(hint);

  return root;
}

const PIPS = ['', '<i class="pip pip--bronze"></i>', '<i class="pip pip--bronze"></i><i class="pip pip--silver"></i>', '<i class="pip pip--bronze"></i><i class="pip pip--silver"></i><i class="pip pip--gold"></i>'];

export function syncLevelSelect(game: Game, root: HTMLElement) {
  const cells = root.querySelectorAll<HTMLElement>('.level-cell');
  for (const cell of cells) {
    const i = +(cell.dataset.levelIndex || '0');
    const L = LEVELS[i];
    const locked = i > game.unlockedLevel;
    cell.classList.toggle('is-locked', locked);
    // Keyboard cursor — mirrors levelSelectIndex so arrow-key navigation has
    // a visible focus ring in the HTML grid.
    cell.classList.toggle('is-selected', i === game.levelSelectIndex);
    const tier = locked ? 0 : tierFor(L.id, L.targetScore);
    const key = locked ? 'L' : String(tier);
    if (cell.dataset.tier !== key) {
      cell.dataset.tier = key;
      const medalEl = cell.querySelector<HTMLElement>('[data-role="medal"]');
      if (medalEl) medalEl.innerHTML = locked ? '<span class="level-cell__lock">LOCKED</span>' : (PIPS[tier] || '<i class="pip"></i><i class="pip"></i><i class="pip"></i>');
    }
  }
  // Detail line for the selected stage: name, best score and next medal goal.
  const info = root.querySelector<HTMLElement>('[data-role="info"]');
  if (info) {
    const i = Math.min(game.levelSelectIndex, LEVELS.length - 1);
    const L = LEVELS[i];
    const best = Storage.data.bestTour?.[L.id] || 0;
    const tier = tierFor(L.id, L.targetScore);
    const next = tier >= 3 ? 'All medals earned'
      : ['Bronze', 'Silver', 'Gold'][tier] + ' at ' + Math.floor(L.targetScore * [1, 1.25, 1.5][tier]).toLocaleString();
    const text = (i + 1) + ' · ' + L.name.toUpperCase() + '   —   best ' + best.toLocaleString() + '   ·   ' + next;
    if (info.textContent !== text) info.textContent = text;
  }
}
