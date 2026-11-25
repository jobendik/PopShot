import { H, State, THEMES, W } from '../constants';
import { LEVELS } from '../data/levels';
import { drawBackground, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed, pointer, pointerHit } from '../systems/input';
import { Storage } from '../systems/storage';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

// Layout constants shared by update (hit-testing) and the legacy canvas
// render. COLS matches the HTML grid (.levels__grid: 9 columns = two worlds
// of four stages + their boss) so the keyboard cursor moves the way the
// screen looks.
const COLS = 9;
const CELL_W = 140;
const CELL_H = 68;
const GAP = 8;
const START_Y = 130;

function gridOrigin() {
  return W/2 - (COLS * (CELL_W + GAP) - GAP) / 2;
}

export function updateLevelSelect(game: Game) {
  // Keyboard cursor never wanders into the locked tail of the grid.
  const maxLevel = Math.min(LEVELS.length - 1, game.unlockedLevel);
  game.levelSelectIndex = Math.min(game.levelSelectIndex, maxLevel);
  if (consumePressed('ArrowLeft')  || consumePressed('KeyA')) { game.levelSelectIndex = Math.max(0, game.levelSelectIndex - 1); AudioSys.menu(); }
  if (consumePressed('ArrowRight') || consumePressed('KeyD')) { game.levelSelectIndex = Math.min(maxLevel, game.levelSelectIndex + 1); AudioSys.menu(); }
  if (consumePressed('ArrowUp')    || consumePressed('KeyW')) { game.levelSelectIndex = Math.max(0, game.levelSelectIndex - COLS); AudioSys.menu(); }
  if (consumePressed('ArrowDown')  || consumePressed('KeyS')) { game.levelSelectIndex = Math.min(maxLevel, game.levelSelectIndex + COLS); AudioSys.menu(); }
  if (consumePressed('Escape')) { game.state = State.MAIN_MENU; AudioSys.menu(); return; }
  if (consumeAnyConfirm() && game.levelSelectIndex <= game.unlockedLevel) {
    AudioSys.menu();
    game.startTour(game.levelSelectIndex);
  }
}

