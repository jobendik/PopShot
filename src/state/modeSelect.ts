import { H, State, W } from '../constants';
import { drawBackground, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed, pointer, pointerHit } from '../systems/input';
import { Storage } from '../systems/storage';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

const MODE_ITEMS = [
  { title: 'TOUR',         desc: 'The adventure: 27 stages, 6 worlds, 3 bosses.' },
  { title: 'SCORE ATTACK', desc: '3 lives. The whole Tour. One score to beat.' },
  { title: 'PANIC MODE',   desc: 'Endless waves through rotating zones. How far can you get?' },
  { title: 'BOSS RUSH',    desc: 'All three bosses back to back, on one set of lives.' },
  { title: 'BACK',         desc: 'Return to main menu.' },
];

export function updateModeSelect(game: Game) {
  const items = MODE_ITEMS.length;
  if (consumePressed('ArrowUp')   || consumePressed('KeyW')) { game.modeSelectIndex = (game.modeSelectIndex - 1 + items) % items; AudioSys.menu(); }
  if (consumePressed('ArrowDown') || consumePressed('KeyS')) { game.modeSelectIndex = (game.modeSelectIndex + 1) % items; AudioSys.menu(); }
  if (consumePressed('Escape')) { game.state = State.MAIN_MENU; AudioSys.menu(); return; }
  // Click on a row picks it directly (then falls through to confirm).
  if (pointer.pressed) {
    for (let i = 0; i < items; i++) {
      const y = 200 + i * 70;
      if (pointerHit(W/2 - 280, y - 30, 560, 56)) {
        game.modeSelectIndex = i;
        pointer.pressed = false;
        break;
      }
    }
  }
  if (consumeAnyConfirm()) {
    AudioSys.menu();
    if (game.modeSelectIndex === 0) game.state = State.LEVEL_SELECT;
    else if (game.modeSelectIndex === 1) game.startScoreAttack();
    else if (game.modeSelectIndex === 2) game.startPanic();
    else if (game.modeSelectIndex === 3) game.startBossRush();
    else if (game.modeSelectIndex === 4) game.state = State.MAIN_MENU;
  }
}

