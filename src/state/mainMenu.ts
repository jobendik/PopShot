import { GROUND_Y, H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { drawBackground, drawDemoBall, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { dismissWelcomeBack, getWelcomeBackBanner, hasPlayedToday, liveStreak, todayUTC } from '../systems/daily';
import { consumePressed, pointer, pointerHit, pointerOver } from '../systems/input';
import { Storage } from '../systems/storage';
import { currentTitle } from '../systems/titles';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

const SECONDARY = [
  { key: 'levels',   label: 'Levels' },
  { key: 'modes',    label: 'Modes' },
  { key: 'stats',    label: 'Stats' },
  { key: 'controls', label: 'How to Play' },
  { key: 'credits',  label: 'Credits' },
] as const;

// Welcome-back banner — sits between the title and the PLAY button when shown.
export const WELCOME_BACK_RECT = { x: W/2 - 280, y: 188, w: 560, h: 38 };

// Idle-rotation hints. After ~6s of menu inactivity, one of these fades in/out
// at the bottom of the screen, cycling every few seconds, so the player learns
// hidden affordances (daily streaks, co-op, combo decay) without clicking.
const IDLE_HINTS = [
  '🔥 Daily streaks grow over consecutive days — don\'t miss a day.',
  'Local co-op: a second player can join with I / K / U on desktop.',
  'Chain pops fast — your combo decays if you wait too long.',
  'Each level has bronze, silver, and gold medals to chase.',
  'Score Attack and Panic Mode live under Modes — try them once.',
  'Pickups change your weapon. Try the laser, flamethrower, and bomb.',
] as const;

// How long the menu must sit untouched before idle hints start cycling.
const IDLE_HINT_DELAY = 6;
// How long each hint stays on screen before the next one rolls in.
const IDLE_HINT_PERIOD = 5;
// How long each fade-in / fade-out takes.
const IDLE_HINT_FADE   = 0.6;

let menuIdleSince = 0;
let lastInputT    = 0;
/** Call once per frame from the main-menu render path so the idle clock is
 *  always relative to the same reference (game.t) as other animations. */
function bumpIdleClock(game: Game, hadInput: boolean) {
  if (hadInput) lastInputT = game.t;
  menuIdleSince = game.t - lastInputT;
}

/** Layout rects used by both update (hit-testing) and render. */
export function getMainMenuLayout() {
  const playW = 340, playH = 88;
  const playX = W / 2 - playW / 2;
  const playY = 240;
  const dailyW = 340, dailyH = 60;
  const dailyX = W/2 - dailyW/2;
  const dailyY = playY + playH + 16;
  // Five secondary buttons — slightly narrower than the four-button layout
  // so the full row still fits the 960-wide canvas with comfortable margins.
  const secW = 140, secH = 44, secGap = 10;
  const secCount = SECONDARY.length;
  const secTotal = secCount * secW + (secCount - 1) * secGap;
  const secY = dailyY + dailyH + 18;
  const secStartX = W / 2 - secTotal / 2;
  const secondaryRects = SECONDARY.map((b, i) => ({
    ...b,
    x: secStartX + i * (secW + secGap),
    y: secY, w: secW, h: secH,
  }));
  const soundW = 44, soundH = 44;
  const soundRect = { x: W - soundW - 18, y: 18, w: soundW, h: soundH };
  return { playX, playY, playW, playH, dailyX, dailyY, dailyW, dailyH, secondaryRects, soundRect };
}

export function getResumeLevel(game: Game) {
  return Math.min(game.unlockedLevel, LEVELS.length - 1);
}

function openMenuAction(game: Game, key: string) {
  if (key === 'levels')        game.state = State.LEVEL_SELECT;
  else if (key === 'modes')    game.state = State.MODE_SELECT;
  else if (key === 'stats')    game.state = State.STATS;
  else if (key === 'controls') game.state = State.CONTROLS;
  else if (key === 'credits')  game.state = State.CREDITS;
  else if (key === 'highscores') game.state = State.HIGH_SCORES;
}

export function updateMainMenu(game: Game) {
  // When the HTML overlay owns this screen, native DOM buttons handle their
  // own clicks and the per-frame sync runs from UI.syncFrame(). We still
  // accept keyboard Enter/Space here as a global shortcut so a returning
  // keyboard user can hit Enter on the page without focusing a button.
  if (UI.isHandledByHtml(State.MAIN_MENU)) {
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      game.startTour(getResumeLevel(game));
    }
    return;
  }
  const layout = getMainMenuLayout();
  // Keyboard cycling: 0 = PLAY, 1 = DAILY, 2..5 = secondary buttons
  const items = 2 + layout.secondaryRects.length;
  // Track whether the player interacted this frame so the idle-hint clock
  // can reset to zero when the menu is "active."
  let hadInput = false;
  if (consumePressed('ArrowUp') || consumePressed('KeyW')) {
    game.menuIndex = (game.menuIndex - 1 + items) % items; AudioSys.menu(); hadInput = true;
  }
  if (consumePressed('ArrowDown') || consumePressed('KeyS')) {
    game.menuIndex = (game.menuIndex + 1) % items; AudioSys.menu(); hadInput = true;
  }
  // Left/right cycle within the secondary nav, jump up/down otherwise.
  if (consumePressed('ArrowLeft') || consumePressed('KeyA')) {
    if (game.menuIndex >= 2) game.menuIndex = Math.max(2, game.menuIndex - 1);
    else game.menuIndex = (game.menuIndex - 1 + items) % items;
    AudioSys.menu(); hadInput = true;
  }
  if (consumePressed('ArrowRight') || consumePressed('KeyD')) {
    if (game.menuIndex >= 2) game.menuIndex = Math.min(items - 1, game.menuIndex + 1);
    else game.menuIndex = (game.menuIndex + 1) % items;
    AudioSys.menu(); hadInput = true;
  }
  // Any pointer activity also counts as engagement.
  if (pointer.pressed || pointer.down) hadInput = true;
  bumpIdleClock(game, hadInput);

  // Mouse click hit-tests take priority over keyboard selection.
  if (pointer.pressed) {
    // Tap the welcome-back banner to dismiss it (it auto-clears so no follow-up action).
    if (getWelcomeBackBanner() && pointerHit(WELCOME_BACK_RECT.x, WELCOME_BACK_RECT.y, WELCOME_BACK_RECT.w, WELCOME_BACK_RECT.h)) {
      pointer.pressed = false;
      AudioSys.menu();
      dismissWelcomeBack();
      return;
    }
    if (pointerHit(layout.playX, layout.playY, layout.playW, layout.playH)) {
      pointer.pressed = false;
      AudioSys.menu();
      game.startTour(getResumeLevel(game));
      return;
    }
    if (pointerHit(layout.dailyX, layout.dailyY, layout.dailyW, layout.dailyH)) {
      pointer.pressed = false;
      AudioSys.menu();
      game.openDaily();
      return;
    }
    for (let i = 0; i < layout.secondaryRects.length; i++) {
      const r = layout.secondaryRects[i];
      if (pointerHit(r.x, r.y, r.w, r.h)) {
        pointer.pressed = false;
        AudioSys.menu();
        openMenuAction(game, r.key);
        return;
      }
    }
    if (pointerHit(layout.soundRect.x, layout.soundRect.y, layout.soundRect.w, layout.soundRect.h)) {
      pointer.pressed = false;
      AudioSys.toggle();
      Storage.data.muted = AudioSys.muted;
      Storage.save();
      return;
    }
  }

  if (consumePressed('Enter') || consumePressed('Space')) {
    AudioSys.menu();
    if (game.menuIndex === 0) {
      game.startTour(getResumeLevel(game));
    } else if (game.menuIndex === 1) {
      game.openDaily();
    } else {
      const sec = layout.secondaryRects[game.menuIndex - 2];
      if (sec) openMenuAction(game, sec.key);
    }
  }
}

