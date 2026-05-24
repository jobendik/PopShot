import { H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { drawBackground } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { consumeAnyConfirm, consumePressed } from '../systems/input';
import { Storage } from '../systems/storage';
import type { Game } from '../game';

/** Generic "press anything to go back to the menu" handler shared by all info screens. */
function dismissOnAnyInput(game: Game) {
  if (consumePressed('Escape') || consumeAnyConfirm()) {
    AudioSys.menu();
    game.state = State.MAIN_MENU;
  }
}

// ---------------- Controls ----------------
export function updateControls(game: Game) {
  dismissOnAnyInput(game);
}

export function renderControls(game: Game) {
  const ctx = game.ctx;
  drawBackground(ctx, 'beach', game.t);
  ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
  ctx.strokeText('CONTROLS', W/2, 100);
  ctx.fillText('CONTROLS', W/2, 100);

  const lines = [
    'Move Left      A / Left',
    'Move Right     D / Right',
    'Shoot Up       Space / W / Up',
    'Pause          P / Esc',
    'Instant Restart  R',
    'Mute Sound     M',
    'Menu Confirm   Enter',
    'Player 2 Join  I / K / U',
    'Player 2 Move  J / L',
    '',
    'Goal: pop every ball before the timer runs out.',
    'Weapons include laser, flame, shotgun, shuriken, and bomb.',
    'Freeze, magnet, smoke-clear, and combo pickups can turn a level.',
  ];
  ctx.font = '20px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 220, 170 + i * 30);
  }
  ctx.textAlign = 'center'; ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
}

// ---------------- High Scores ----------------
export function updateHighScores(game: Game) {
  dismissOnAnyInput(game);
}

export function renderHighScores(game: Game) {
  const ctx = game.ctx;
  drawBackground(ctx, 'city', game.t);
  ctx.font = 'bold 46px sans-serif';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
  ctx.textAlign = 'center';
  ctx.strokeText('HIGH SCORES', W/2, 90);
  ctx.fillText('HIGH SCORES', W/2, 90);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd60a';
  ctx.fillText('Score Attack Best: ' + Storage.data.bestScoreAttack, W/2, 150);
  ctx.fillText('Panic Best Wave: ' + Storage.data.bestPanicWave, W/2, 184);
  ctx.fillText('Panic Best Score: ' + Storage.data.bestPanicScore, W/2, 218);

  const top = [...LEVELS]
    .map((l, i) => ({ label: 'Lv ' + (i + 1) + ' ' + l.name, score: Storage.data.bestTour[l.id] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < top.length; i++) {
    ctx.fillStyle = i < 3 ? '#ffd60a' : '#fff';
    ctx.fillText(top[i].label, W/2 - 230, 280 + i * 25);
    ctx.textAlign = 'right';
    ctx.fillText(top[i].score.toString(), W/2 + 230, 280 + i * 25);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center';
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
}

// ---------------- Credits ----------------
export function updateCredits(game: Game) {
  dismissOnAnyInput(game);
}

export function renderCredits(game: Game) {
  const ctx = game.ctx;
  drawBackground(ctx, 'arctic', game.t);
  ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
  ctx.strokeText('CREDITS', W/2, 100);
  ctx.fillText('CREDITS', W/2, 100);
  ctx.font = '20px sans-serif';
  const lines = [
    'Bubble Breaker Adventure',
    'A TypeScript HTML5 Canvas arcade game.',
    'Inspired by the Pang / Buster Bros series.',
    '',
    'Code & design: this build for Jo.',
    'No external assets. Built with Vite.',
    'Audio: Web Audio API procedural synthesis.',
    '',
    'Built to teach the ball-splitting genre',
    'with arcade clarity and tight feel.',
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W/2, 170 + i * 28);
  }
  ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
}
