import { H, State, W } from '../constants';
import { roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { consumePressed, isTouchDevice, pointer, pointerHit, pointerOver } from '../systems/input';
import { Storage } from '../systems/storage';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

export interface PauseButton {
  key: 'restart' | 'resume' | 'menu';
  label: string;
  x: number; y: number; w: number; h: number;
}

export function getPauseButtons(): PauseButton[] {
  const btnW = 180, btnH = 56, gap = 16;
  const totalW = btnW * 3 + gap * 2;
  const startX = W / 2 - totalW / 2;
  const y = H - 110;
  return [
    { key: 'restart', label: 'RESTART', x: startX,                       y, w: btnW, h: btnH },
    { key: 'resume',  label: 'RESUME',  x: startX + (btnW + gap),        y, w: btnW, h: btnH },
    { key: 'menu',    label: 'MENU',    x: startX + (btnW + gap) * 2,    y, w: btnW, h: btnH },
  ];
}

/** Reduced-motion accessibility toggle. Sits left of the mute toggle. */
export function getPauseToggleRect() {
  const reducedW = 280, muteW = 130, gap = 12, h = 40;
  const totalW = reducedW + gap + muteW;
  const startX = W/2 - totalW / 2;
  return { x: startX, y: H - 178, w: reducedW, h };
}

/** Mute toggle. Sits to the right of the reduced-motion toggle. */
export function getPauseMuteRect() {
  const reduced = getPauseToggleRect();
  return { x: reduced.x + reduced.w + 12, y: reduced.y, w: 130, h: 40 };
}

function restartCurrentRun(game: Game) {
  if (game.mode === 'panic') return game.startPanic();
  if (game.mode === 'score_attack') return game.startScoreAttack();
  return game.loadLevel(game.levelIndex);
}

export function updatePaused(game: Game) {
  if (consumePressed('KeyP') || consumePressed('Escape')) { game.state = State.PLAYING; AudioSys.sfx('stinger/pause_close', 0.7) || AudioSys.menu(); return; }
  if (consumePressed('Enter')) { game.state = State.MAIN_MENU; AudioSys.menu(); return; }
  if (consumePressed('KeyR')) { restartCurrentRun(game); return; }
  // M is the canonical mute key everywhere else in the app — make it work from
  // pause too so a player can adjust audio without using the pointer.
  if (consumePressed('KeyM')) { AudioSys.toggle(); AudioSys.menu(); return; }
  // Pause-screen buttons (touch + desktop click).
  if (pointer.pressed) {
    const t = getPauseToggleRect();
    if (pointerHit(t.x, t.y, t.w, t.h)) {
      pointer.pressed = false;
      AudioSys.menu();
      Storage.data.reducedMotion = !Storage.data.reducedMotion;
      Storage.save();
      return;
    }
    const m = getPauseMuteRect();
    if (pointerHit(m.x, m.y, m.w, m.h)) {
      pointer.pressed = false;
      // AudioSys.toggle() persists Storage.data.muted on its own.
      AudioSys.toggle();
      AudioSys.menu();
      return;
    }
    for (const b of getPauseButtons()) {
      if (pointerHit(b.x, b.y, b.w, b.h)) {
        pointer.pressed = false;
        AudioSys.menu();
        if (b.key === 'resume') game.state = State.PLAYING;
        else if (b.key === 'menu') game.state = State.MAIN_MENU;
        else if (b.key === 'restart') restartCurrentRun(game);
        return;
      }
    }
  }
}

