import { H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed } from '../systems/input';
import { Platform as Sdk } from '../systems/platform';
import { UI } from '../ui/domRoot';
import type { Game } from '../game';

// ---------------- LEVEL CLEAR ----------------
/** Advance from a level-clear to the next stage. Honors Boss Rush queue,
 *  Score Attack wrap, midgame ad cadence, and the final-level VICTORY path.
 *  Invoked by both the keyboard "any key to continue" path AND the
 *  on-screen Next Level button. */
export function advanceFromLevelClear(game: Game): void {
  AudioSys.menu();
  game.summary = null;
  if (game.bossLevel) {
    if (game.mode === 'boss_rush') {
      game.bossRushCount++;
      const nextBossIndex = game.bossRushQueue.shift();
      if (nextBossIndex == null) {
        game.saveRunBest();
        AudioSys.sfx('stinger/victory', 0.95);
        game.state = State.VICTORY;
        return;
      }
      // The rush rewards momentum: every boss down restores one life (max 3).
      game.lives = Math.min(3, game.lives + 1);
      game.loadLevel(nextBossIndex);
      game.introTitle = 'BOSS ' + (game.bossRushCount + 1) + ' OF ' + (game.bossRushCount + 1 + game.bossRushQueue.length);
      game.introText = LEVELS[nextBossIndex].name + '\n+1 life for the last one. Keep going.';
      game.introTimer = 3;
      return;
    }
  }
  const next = game.levelIndex + 1;
  if (next >= LEVELS.length && game.mode !== 'score_attack') {
    AudioSys.sfx('stinger/victory', 0.95);
    game.state = State.VICTORY;
    return;
  }
  const targetIndex = game.mode === 'score_attack' ? (next % LEVELS.length) : next;

  // CrazyGames hygiene: midgame ad between Tour levels — but never before
  // the player has cleared at least one level in this session.
  const shouldAd = game.mode === 'tour' && game.sessionLevelsCleared >= 1;
  game.sessionLevelsCleared++;
  if (shouldAd) {
    game.awaitingAd = true;
    const token = game.runToken;
    Sdk.gameplayStop();
    Sdk.requestMidgameAd().finally(() => {
      game.awaitingAd = false;
      // Only advance if the player is still sitting on this result screen.
      if (game.runToken !== token || game.state !== State.LEVEL_CLEAR) return;
      game.loadLevel(targetIndex);
    });
  } else {
    game.loadLevel(targetIndex);
  }
}

export function updateLevelClear(game: Game) {
  if (game.awaitingAd) return; // ad in flight — ignore further input until it resolves
  if (consumeAnyConfirm()) advanceFromLevelClear(game);
}

// ---------------- BOSS DEFEATED ----------------
export function updateBossDefeated(game: Game, dt: number) {
  game.bossDefeatedTimer -= dt;
  for (const pt of game.particles) pt.update(dt);
  for (const sw of game.shockwaves) sw.update(dt);
  for (const sc of game.smokeClouds) sc.update(dt);
  for (const ft of game.floatingTexts) ft.update(dt);
  game.particles = game.particles.filter(p => !p.dead);
  game.shockwaves = game.shockwaves.filter(s => !s.dead);
  game.smokeClouds = game.smokeClouds.filter(p => !p.dead);
  game.floatingTexts = game.floatingTexts.filter(f => !f.dead);
  if (game.bossDefeatedTimer <= 0) game.levelClear();
}

// ---------------- VICTORY (after final boss / last level) ----------------
export function updateVictory(game: Game) {
  if (consumeAnyConfirm() || consumePressed('Escape')) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

