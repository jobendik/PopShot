import { H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { drawBackground, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed } from '../systems/input';
import { Storage } from '../systems/storage';
import { earnedTitles, lockedTitles } from '../systems/titles';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

/** Generic "press anything to go back to the menu" handler shared by all info screens. */
function dismissOnAnyInput(game: Game) {
  if (consumePressed('Escape') || consumeAnyConfirm()) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

// ---------------- Hub ----------------
// HTML-owned meta screen (profile/rank, weekly detail, mastery). No canvas
// renderer; this just lets keyboard/gamepad players back out to the menu.
export function updateHub(game: Game) {
  dismissOnAnyInput(game);
}

// ---------------- Controls ----------------
export function updateControls(game: Game) {
  dismissOnAnyInput(game);
}

// ---------------- High Scores ----------------
export function updateHighScores(game: Game) {
  dismissOnAnyInput(game);
}

// ---------------- Credits ----------------
export function updateCredits(game: Game) {
  dismissOnAnyInput(game);
}

// ---------------- Stats ----------------
export function updateStats(game: Game) {
  dismissOnAnyInput(game);
}

export function updateProfile(game: Game) {
  if (consumePressed('Escape')) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

function formatTime(ms: number): string {
  if (!ms || ms < 1000) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + (totalSec % 60) + 's';
  return totalSec + 's';
}

