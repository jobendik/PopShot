import { H, State, W } from '../constants';
import { LEVELS } from '../data/levels';
import { FloatingText, Shockwave } from '../entities/particle';
import { drawBackground, roundRect } from '../rendering/canvas';
import { AudioSys } from '../systems/audio';
import { resolveCollisions } from '../systems/collisions';
import { renderHUD, renderTouchControls } from '../systems/hud';
import { consumePauseTap, consumePressed, isTouchDevice, keysPressed, pointer, tickTouchInputs } from '../systems/input';
import { Platform as Sdk } from '../systems/platform';
import { Storage } from '../systems/storage';
import { clamp } from '../utils';
import type { Game } from '../game';

export function updatePlaying(game: Game, dt: number) {
  // Touch input: translate active touches into synthetic key state.
  tickTouchInputs(isTouchDevice);

  // Pause — keyboard or canvas pause button.
  if (consumePressed('KeyP') || consumePressed('Escape') || consumePauseTap()) {
    game.state = State.PAUSED; AudioSys.menu(); return;
  }
  // Local co-op is a desktop-only feature (touch UI is single-player).
  if (!isTouchDevice && !game.player2 && (consumePressed('KeyI') || consumePressed('KeyK') || consumePressed('KeyU'))) {
    game.joinPlayer2();
  }
  // Restart
  if (consumePressed('KeyR')) {
    if (game.mode === 'panic') return game.startPanic();
    if (game.mode === 'score_attack') return game.startScoreAttack();
    return game.loadLevel(game.levelIndex);
  }

  // Effective dt (slow time / hit pause)
  if (game.hitPause > 0) {
    game.hitPause -= dt;
    dt *= 0.05;
  }
  if (game.slowTime > 0) {
    game.slowTime -= dt;
    dt *= 0.45;
  }
  if (game.freezeTime > 0)     game.freezeTime     = Math.max(0, game.freezeTime - dt);
  if (game.magnetTime > 0)     game.magnetTime     = Math.max(0, game.magnetTime - dt);
  if (game.comboBoostTime > 0) game.comboBoostTime = Math.max(0, game.comboBoostTime - dt);
  const motionDt = game.freezeTime > 0 ? 0 : dt;

  // Update timer (campaign and score attack)
  if (game.mode !== 'panic') {
    game.timer -= dt;
    const warningSecond = Math.ceil(game.timer);
    if (warningSecond > 0 && warningSecond <= 10 && warningSecond !== game.lastTimerWarning) {
      game.lastTimerWarning = warningSecond;
      AudioSys.warning();
    }
    if (game.timer <= 0) {
      game.timer = 0;
      if (game.player) game.killPlayer(game.player, 'timeout');
      return;
    }
  }

  // Combo decay
  game.comboDecay -= dt;
  if (game.comboDecay <= 0 && game.combo > 0) {
    game.combo = Math.max(0, game.combo - 1);
    game.comboDecay = 0.5;
  }

  // Intro timer — any movement, shoot, or pointer press dismisses early.
  if (game.introTimer > 0) {
    const before = game.introTimer;
    game.introTimer -= dt;
    const moved = keysPressed['ArrowLeft'] || keysPressed['ArrowRight']
               || keysPressed['KeyA'] || keysPressed['KeyD']
               || keysPressed['KeyJ'] || keysPressed['KeyL'];
    const shot  = keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']
               || keysPressed['KeyI'];
    if (moved || shot || pointer.pressed) game.introTimer = 0;
    // Edge: intro just ended (either by timeout or early-dismiss). Fire a
    // brief "GO!" beat so the player knows their input matters NOW. Panic
    // mode prints its own WAVE banner, so skip there to avoid stacking.
    if (before > 0 && game.introTimer <= 0 && game.mode !== 'panic') {
      game.floatingTexts.push(new FloatingText(W/2, H/2 - 10, 'GO!', '#ffd60a', 88));
      game.shockwaves.push(new Shockwave(W/2, H/2 - 10, 220, '#ffd60a', 0.45));
      AudioSys.go();
    }
  }

  // Effects timers
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 30);
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt);

  // --- Entity updates ---
  for (const p of [game.player, game.player2]) {
    if (!p) continue;
    if (p.dead && p.respawnTimer > 0) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0 && game.lives > 0) game.respawnPlayer(p);
    } else {
      p.update(dt, game);
    }
  }

  for (const p of game.platforms) p.update(dt);
  for (const c of game.crabs) c.update(dt);
  for (const b of game.balls) b.update(motionDt, game);
  for (const p of game.projectiles) p.update(dt, game);
  for (const pk of game.pickups) pk.update(dt, game);
  for (const h of game.hazards) h.update(dt);
  for (const pt of game.particles) pt.update(dt);
  for (const sw of game.shockwaves) sw.update(dt);
  for (const sc of game.smokeClouds) sc.update(dt);
  for (const ft of game.floatingTexts) ft.update(dt);
  if (game.boss) game.boss.update(motionDt, game);

  // --- Collisions ---
  resolveCollisions(game);

  // --- Cleanup ---
  for (const p of game.projectiles) {
    if (p.dead && !p.didHit && p.type !== 'flame') {
      game.combo = 0;
      game.comboDecay = 0;
    }
  }
  game.balls         = game.balls.filter(b => !b.dead);
  game.projectiles   = game.projectiles.filter(p => !p.dead);
  game.pickups       = game.pickups.filter(p => !p.dead);
  game.destructibles = game.destructibles.filter(d => !d.dead);
  game.hazards       = game.hazards.filter(h => !h.dead);
  game.particles     = game.particles.filter(p => !p.dead);
  game.shockwaves    = game.shockwaves.filter(s => !s.dead);
  game.smokeClouds   = game.smokeClouds.filter(p => !p.dead);
  game.floatingTexts = game.floatingTexts.filter(f => !f.dead);
  if (game.particles.length   > 300) game.particles.length   = 300;
  if (game.shockwaves.length  > 40)  game.shockwaves.length  = 40;
  if (game.smokeClouds.length > 80)  game.smokeClouds.length = 80;

  // --- Win conditions ---
  if (game.bossLevel) {
    if (game.boss && game.boss.dead && game.balls.length === 0) {
      game.state = State.BOSS_DEFEATED;
      game.bossDefeatedTimer = 2;
      Sdk.happytime();
      game.unlockedLevel = Math.max(game.unlockedLevel, LEVELS.length);
      Storage.data.unlockedLevel = game.unlockedLevel;
      Storage.save();
    }
  } else if (game.mode === 'panic') {
    if (game.balls.length === 0 && game.boss == null) {
      if (game.panicWave > Storage.data.bestPanicWave) {
        Storage.data.bestPanicWave = game.panicWave; Storage.save();
      }
      if (game.score > Storage.data.bestPanicScore) {
        Storage.data.bestPanicScore = game.score; Storage.save();
      }
      game.addScore(500 * game.panicWave);
      game.advancePanicWave();
    }
  } else {
    if (game.balls.length === 0) {
      game.levelClear();
    }
  }
}

/** Render the gameplay scene: world, entities, touch controls, HUD, intro overlay. */
export function renderWorld(game: Game) {
  const ctx = game.ctx;
  drawBackground(ctx, game.theme, game.t);

  for (const p of game.platforms) p.draw(ctx, game.theme);
  for (const d of game.destructibles) if (!d.dead) d.draw(ctx);
  for (const h of game.hazards) h.draw(ctx);
  for (const c of game.crabs) c.draw(ctx);
  for (const pk of game.pickups) pk.draw(ctx);
  if (game.boss) game.boss.draw(ctx);
  for (const b of game.balls) b.draw(ctx);
  for (const p of game.projectiles) p.draw(ctx);
  if (game.player) game.player.draw(ctx);
  if (game.player2) game.player2.draw(ctx);
  for (const pt of game.particles) pt.draw(ctx);
  for (const sw of game.shockwaves) sw.draw(ctx);
  for (const sc of game.smokeClouds) sc.draw(ctx);
  for (const ft of game.floatingTexts) ft.draw(ctx);

  // Touch controls (translucent, drawn before HUD so the score/timer overlay them).
  if (game.state === State.PLAYING || game.state === State.PLAYER_DEAD) {
    renderTouchControls(game);
  }

  renderHUD(game);

  // Intro banner — slides down from above on appearance, fades on dismiss.
  if (game.introTimer > 0 && game.introText) {
    const a = clamp(game.introTimer / 4, 0, 1);
    // The intro starts at game.introTimer = 4 and counts down. "elapsed"
    // grows from 0 → 4. Slide-in eases over the first 350ms.
    const elapsed = 4 - game.introTimer;
    const slidePhase = Math.min(1, elapsed / 0.35);
    const easeOut = 1 - Math.pow(1 - slidePhase, 3);
    const offsetY = (1 - easeOut) * -80;  // start 80px above target, slide to 0
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, offsetY);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, W/2 - 300, H/2 - 60, 600, 120, 14, true, false);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,214,10,0.55)';
    roundRect(ctx, W/2 - 300, H/2 - 60, 600, 120, 14, false, true);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'center';
    // Banner header: prefer introTitle when set (mode-specific framing),
    // otherwise fall back to the level's name.
    const bannerTitle = game.introTitle || game.levelName;
    ctx.fillText(bannerTitle, W/2, H/2 - 25);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#fff';
    const lines = game.introText.split('\n');
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W/2, H/2 + 5 + i * 22);
    ctx.restore();
  }
}

