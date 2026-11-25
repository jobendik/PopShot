import { DEATH_REASON_TEXT, H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { drawBackground, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { hasPlayedToday, liveStreak, pickDailyChallenge, todayUTC } from '../systems/daily';
import { consumeAnyConfirm, consumePressed, pointer, pointerHit, pointerOver } from '../systems/input';
import { Storage } from '../systems/storage';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

// ---------- Daily Challenge: intro screen ----------
export function getDailyIntroLayout() {
  const playW = 320, playH = 78;
  const playX = W/2 - playW/2;
  const playY = H - 130;
  const backW = 140, backH = 44;
  const backX = 32, backY = H - 64;
  return { playX, playY, playW, playH, backX, backY, backW, backH };
}

export function updateDailyIntro(game: Game) {
  if (consumePressed('Escape')) { game.state = State.MAIN_MENU; AudioSys.menu(); return; }
  const layout = getDailyIntroLayout();
  if (pointer.pressed) {
    if (pointerHit(layout.playX, layout.playY, layout.playW, layout.playH)) {
      pointer.pressed = false;
      AudioSys.menu();
      game.startDaily();
      return;
    }
    if (pointerHit(layout.backX, layout.backY, layout.backW, layout.backH)) {
      pointer.pressed = false;
      AudioSys.menu();
      game.state = State.MAIN_MENU;
      return;
    }
  }
  if (consumeAnyConfirm()) {
    AudioSys.menu();
    game.startDaily();
  }
}

// ---------- Daily Challenge: result screen ----------
export function getDailyResultLayout() {
  // Two buttons: Copy, Menu. Sharing stays clipboard-only — external share
  // links (X/Twitter intents) are not allowed on CrazyGames.
  const btnW = 170, btnH = 56, gap = 12;
  const totalW = btnW * 2 + gap;
  const startX = W/2 - totalW / 2;
  const y = H - 110;
  return {
    copy:  { x: startX,                y, w: btnW, h: btnH },
    menu:  { x: startX + (btnW + gap), y, w: btnW, h: btnH },
  };
}

export function updateDailyResult(game: Game) {
  if (consumePressed('Escape')) { game.state = State.MAIN_MENU; AudioSys.menu(); return; }
  const layout = getDailyResultLayout();
  if (pointer.pressed) {
    if (pointerHit(layout.copy.x, layout.copy.y, layout.copy.w, layout.copy.h)) {
      pointer.pressed = false;
      copyDailyShareText(game);
      return;
    }
    if (pointerHit(layout.menu.x, layout.menu.y, layout.menu.w, layout.menu.h)) {
      pointer.pressed = false;
      AudioSys.menu();
      game.state = State.MAIN_MENU;
      return;
    }
  }
  if (consumePressed('Enter') || consumePressed('Space')) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

/** Build the shareable text for the clipboard copy. */
function buildShareText(game: Game): string {
  const pick = game.daily ?? pickDailyChallenge();
  return `I scored ${game.dailyResultScore.toLocaleString()} on today's PopShot daily — modifier: ${pick.modifierLabel}. Beat me!`;
}

export function copyDailyShareText(game: Game) {
  const text = buildShareText(game);
  const fallback = () => {
    // Older browsers / iframes without clipboard permissions: select & exec a copy.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      game.dailyResultShareCopied = game.t;
    } catch { /* clipboard truly unavailable */ }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      game.dailyResultShareCopied = game.t;
    }).catch(fallback);
  } else {
    fallback();
  }
}

