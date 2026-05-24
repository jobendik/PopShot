import { H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed } from '../systems/input';
import { Platform as Sdk } from '../systems/platform';
import type { Game } from '../game';

// ---------------- LEVEL CLEAR ----------------
export function updateLevelClear(game: Game) {
  if (game.awaitingAd) return; // ad in flight — ignore further input until it resolves
  if (consumeAnyConfirm()) {
    AudioSys.menu();
    game.summary = null;
    if (game.bossLevel) {
      game.state = State.VICTORY;
      return;
    }
    const next = game.levelIndex + 1;
    if (next >= LEVELS.length) { game.state = State.VICTORY; return; }
    const targetIndex = game.mode === 'score_attack' ? (next % LEVELS.length) : next;

    // CrazyGames hygiene: midgame ad between Tour levels — but never before
    // the player has cleared at least one level in this session.
    const shouldAd = game.mode === 'tour' && game.sessionLevelsCleared >= 1;
    game.sessionLevelsCleared++;
    if (shouldAd) {
      game.awaitingAd = true;
      Sdk.gameplayStop();
      Sdk.requestMidgameAd().finally(() => {
        game.awaitingAd = false;
        game.loadLevel(targetIndex);
      });
    } else {
      game.loadLevel(targetIndex);
    }
  }
}

export function renderLevelClear(game: Game) {
  const ctx = game.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = '#ffd60a';
  ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 6; ctx.textAlign = 'center';
  ctx.strokeText('LEVEL CLEAR!', W/2, 130);
  ctx.fillText('LEVEL CLEAR!', W/2, 130);
  const s = game.summary;
  if (s) {
    const rows: [string, number][] = [
      ['Base Score', s.base],
      ['Time Bonus', s.time],
      ['Accuracy Bonus', s.accuracy],
      ['Combo Bonus', s.combo],
      ['No-Miss Bonus', s.noMiss],
    ];
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < rows.length; i++) {
      ctx.fillStyle = '#fff';
      ctx.fillText(rows[i][0], W/2 - 180, 200 + i * 36);
      ctx.textAlign = 'right';
      ctx.fillText('+' + rows[i][1], W/2 + 180, 200 + i * 36);
      ctx.textAlign = 'left';
    }
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText('TOTAL', W/2 - 180, 410);
    ctx.textAlign = 'right';
    ctx.fillText(s.total.toString(), W/2 + 180, 410);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cfd6df';
    ctx.textAlign = 'center';
    ctx.fillText('Best: ' + s.best, W/2, 440);
  }
  ctx.font = '16px sans-serif';
  ctx.fillStyle = game.awaitingAd ? '#ffd60a' : 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(game.awaitingAd ? 'Loading ad…' : 'Press Enter / Space to continue', W/2, H - 30);
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

export function renderBossDefeated(game: Game) {
  const ctx = game.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = 'bold 54px sans-serif';
  ctx.fillStyle = '#ffd60a';
  ctx.strokeStyle = '#0a1832';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.strokeText('BOSS DEFEATED!', W/2, H/2 - 10);
  ctx.fillText('BOSS DEFEATED!', W/2, H/2 - 10);
}

// ---------------- VICTORY (after final boss / last level) ----------------
export function updateVictory(game: Game) {
  if (consumeAnyConfirm() || consumePressed('Escape')) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

export function renderVictory(game: Game) {
  const ctx = game.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = 'bold 72px sans-serif'; ctx.fillStyle = '#ffd60a'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 6;
  ctx.strokeText('VICTORY!', W/2, H/2 - 40);
  ctx.fillText('VICTORY!', W/2, H/2 - 40);
  ctx.font = '24px sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText('Commander RIFT has fallen.', W/2, H/2 + 10);
  ctx.fillText('Final Score: ' + game.score, W/2, H/2 + 44);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#cfd6df';
  ctx.fillText('Press Enter to return to menu', W/2, H - 40);
}
