import { CEILING_Y, GROUND_Y, H, State, W, WALL_L, WALL_R, chainMult } from '../constants';
import { LEVELS } from '../data/levels';
import { Ball } from '../entities/ball';
import { Hazard } from '../entities/hazard';
import { FloatingText, Shockwave, pushText } from '../entities/particle';
import { drawBackground, roundRect } from '../rendering/canvas';
import { PAL, displayFont, uiFont, inkText } from '../rendering/theme';
import { rand } from '../utils';
import { AudioSys } from '../systems/audio';
import { emit } from '../systems/analytics';
import { resolveCollisions } from '../systems/collisions';
import { banner, endChain } from '../systems/combat';
import { consumePressed, isTouchDevice, keysPressed, pointer } from '../systems/input';
import { Platform as Sdk } from '../systems/platform';
import { gchance, grand } from '../systems/rng';
import { Storage } from '../systems/storage';
import { advanceMissions } from '../systems/retention';
import { clamp } from '../utils';
import { FX } from '../ui/overlay/effects';
import type { Game } from '../game';

let onboardingHintEmitted = false;

/** Sandstorm state machine: calm → warn (streaks + arrow, no force) → blow. */
function updateWind(game: Game, dt: number) {
  const w = game.wind;
  if (w.strength <= 0) { w.ax = 0; return; }
  w.timer -= dt;
  if (w.timer <= 0) {
    if (w.phase === 'calm') {
      w.phase = 'warn';
      w.dir = gchance(0.5) ? -1 : 1;
      w.timer = 1.15;
      AudioSys.windWarn();
    } else if (w.phase === 'warn') {
      w.phase = 'blow';
      w.timer = 2.6;
      AudioSys.windBlow();
    } else {
      w.phase = 'calm';
      w.timer = grand(w.gapMin, w.gapMax);
    }
  }
  w.ax = w.phase === 'blow' ? w.dir * w.strength : 0;
}

/** Volcano: on a fixed beat, rocks hang in the ceiling (ring on the floor),
 *  then drop. Positions are seeded and never stack on top of each other. */
function updateEruption(game: Game, dt: number) {
  const e = game.eruption;
  if (!e) return;
  e.timer -= dt;
  if (e.timer > 0) return;
  e.timer = e.interval;
  const xs: number[] = [];
  for (let i = 0; i < e.count; i++) {
    let x = 0, tries = 0;
    do { x = grand(WALL_L + 30, WALL_R - 60); tries++; }
    while (tries < 8 && xs.some(o => Math.abs(o - x) < 90));
    xs.push(x);
    game.hazards.push(new Hazard('falling_rock', x, CEILING_Y + 4, 30, 30, 9, 0.9 + i * 0.18));
  }
  game.shake = Math.max(game.shake, 7);
  game.eruptFlash = 1;
  AudioSys.rumble();
}

export function updatePlaying(game: Game, dt: number) {
  // Pause — keyboard. The on-screen pause button (HTML HUD) has its own click
  // handler that flips game.state directly.
  if (consumePressed('KeyP') || consumePressed('Escape')) {
    game.state = State.PAUSED; AudioSys.sfx('stinger/pause_open', 0.7) || AudioSys.menu(); return;
  }
  // Local co-op is a desktop-only feature (touch UI is single-player).
  // P2 joins via its keyboard letters (I/U/K, none of which P1 uses) or its
  // own 2nd-controller button. P3 and P4 have NO keyboard join at all: their
  // natural letters are the same physical keys P1/P2 use, so a keyboard join
  // would let one person's keypresses drive two players. P3/P4 therefore only
  // join via their own dedicated 3rd/4th gamepad.
  if (!isTouchDevice && !game.player2 && (consumePressed('KeyI') || consumePressed('KeyK') || consumePressed('KeyU') || consumePressed('Gamepad2Shoot'))) {
    game.joinPlayer2();
  }
  if (!isTouchDevice && !game.player3 && consumePressed('Gamepad3Shoot')) {
    game.joinPlayer3();
  }
  if (!isTouchDevice && !game.player4 && consumePressed('Gamepad4Shoot')) {
    game.joinPlayer4();
  }
  // Restart
  if (consumePressed('KeyR')) {
    if (game.mode === 'panic') return game.startPanic();
    if (game.mode === 'score_attack') return game.startScoreAttack();
    if (game.mode === 'boss_rush') return game.startBossRush();
    if (game.mode === 'daily') return game.startDaily();
    return game.startTour(game.levelIndex);
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
  game.simT += dt;
  if (game.eruptFlash > 0) game.eruptFlash = Math.max(0, game.eruptFlash - dt * 1.6);

  // The clock is held while an intro card or a boss entrance is on screen —
  // reading time is never charged against the player.
  const bossIntro = !!game.boss && game.boss.introT > 0;
  const clockHeld = bossIntro || game.introTimer > 0;

  // Update timer (campaign and score attack)
  if (game.mode !== 'panic' && !clockHeld) {
    game.timer -= dt;
    const warningSecond = Math.ceil(game.timer);
    if (warningSecond > 0 && warningSecond <= 10 && warningSecond !== game.lastTimerWarning) {
      game.lastTimerWarning = warningSecond;
      if (warningSecond <= 3) AudioSys.sfx('stinger/timer_critical_3s', 0.7) || AudioSys.warning();
      else AudioSys.warning();
    }
    if (game.timer <= 0) {
      game.timer = 0;
      // Timeout ends the round for the whole team at once, and costs the
      // shared pool exactly one life (not one per player still standing).
      game.getLivingPlayers().forEach((p, i) => { p.invuln = 0; p.dashIframes = 0; game.killPlayer(p, 'timeout', i === 0); });
      return;
    }
  }

  // ---- Chain timer ----
  // Time-based only: the chain ends when the window runs dry, never because
  // a shot missed. Held during a full freeze (nothing is moving to chase).
  if (game.combo > 0 && game.freezeTime <= 0) {
    game.comboDecay -= dt;
    if (game.comboDecay <= 0) endChain(game);
  }
  if (game.grazeStreakT > 0) game.grazeStreakT -= dt;

  // Lifetime play-time accumulator. The save is debounced via cloud writes
  // already (Storage.save), so we don't persist on every tick — the buffer
  // flushes on level clear / death where Storage.save() is called anyway.
  Storage.data.lifetimePlayMs = (Storage.data.lifetimePlayMs || 0) + dt * 1000;
  if (game.firstRunHintAge >= 0 && game.introTimer <= 0) {
    game.firstRunHintAge += dt;
    if (!onboardingHintEmitted) {
      onboardingHintEmitted = true;
      emit('onboarding.hint_shown', { level: game.levelIndex });
    }
  }

  // Multi-pop window: closes when no new pops have arrived for ~200ms. We
  // emit ONE consolidated label at the centroid — never one per ball — and
  // name it after HOW the pops happened, so the player learns what they did.
  if (game.chainTimer > 0) {
    game.chainTimer -= dt;
    if (game.chainTimer <= 0 && game.chainCount >= 2) {
      const n = game.chainCount;
      let label = '', bonus = 0, color = '#ffd60a', size = 30;
      if (n === 2) { label = 'DOUBLE POP'; bonus = 100; color = '#9be7ff'; size = 24; }
      else if (n === 3) { label = 'TRIPLE POP'; bonus = 250; color = '#ffd60a'; size = 28; }
      else if (n === 4) { label = 'QUAD POP'; bonus = 500; color = '#ff7f50'; size = 32; }
      else if (n <= 7)  { label = 'MEGA POP'; bonus = 1000; color = '#ff36c4'; size = 38; }
      else              { label = 'ULTRA POP'; bonus = 2000; color = '#ff36c4'; size = 44; }
      const owners = game.chainOwners;
      const multiOwner = (owners & (owners - 1)) !== 0;
      if (game.chainCascade > 0) { label = 'POPSHOT!'; color = '#fff3b0'; bonus = n * 80; size = Math.min(48, 30 + n); }
      else if (game.chainArcs > 0 && game.chainBlasts > 0) { label = 'CHAIN REACTION'; color = '#b9ff66'; bonus = Math.round(bonus * 1.5); }
      else if (game.chainArcs > 0) { label = n >= 4 ? 'LIGHTNING STORM' : 'ARC POP'; color = '#ffe14a'; }
      else if (game.chainBlasts > 0) { label = n >= 4 ? 'BIG BANG' : 'BLAST POP'; color = '#ff9a3c'; }
      else if (multiOwner) { label = 'TAG TEAM'; color = '#06d6a0'; bonus = Math.round(bonus * 1.5); }
      const dailyMult = game.modifier === 'double_score' ? 2 : 1;
      const gained = bonus * dailyMult;
      game.addScore(gained);
      const cx = clamp(game.chainCx, 120, W - 120), cy = clamp(game.chainCy, 110, GROUND_Y - 90);
      pushText(game.floatingTexts, new FloatingText(cx, cy - 16, label, color, size), 'multi', 0.95).rise = 24;
      pushText(game.floatingTexts, new FloatingText(cx, cy + 8, '×' + n + '   +' + (game.chainScore + gained).toLocaleString(), '#fff', 15), 'multi2', 0.95).rise = 24;
      game.shockwaves.push(new Shockwave(game.chainCx, game.chainCy, 80 + n * 18, color, 0.4));
      AudioSys.multipop(n);
      if (n >= 8) FX.medal(label, n + ' balls at once', 'mythic', '+' + gained);
      if (n > (Storage.data.bestMultiPop || 0)) Storage.data.bestMultiPop = n;
      if (n >= 3) advanceMissions('multi_pop', 1);
    }
    if (game.chainTimer <= 0) {
      game.chainCount = 0;
      game.chainCx = 0;
      game.chainCy = 0;
      game.chainTimer = 0;
      game.chainScore = 0;
      game.chainArcs = 0; game.chainBlasts = 0; game.chainCascade = 0; game.chainOwners = 0;
    }
  }

  // Intro timer — any movement, shoot, or pointer press dismisses early.
  if (game.introTimer > 0) {
    const before = game.introTimer;
    game.introTimer -= dt;
    const moved = keysPressed['ArrowLeft'] || keysPressed['ArrowRight']
               || keysPressed['KeyA'] || keysPressed['KeyD']
               || keysPressed['KeyJ'] || keysPressed['KeyL']
               || keysPressed['Gamepad2Left'] || keysPressed['Gamepad2Right'];
    const shot  = keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']
               || keysPressed['KeyI'] || keysPressed['Gamepad2Shoot'];
    if (moved || shot || pointer.pressed) game.introTimer = 0;
    // Edge: intro just ended (either by timeout or early-dismiss). Fire a
    // brief "GO!" beat so the player knows their input matters NOW. Panic
    // mode prints its own WAVE banner, so skip there to avoid stacking.
    if (before > 0 && game.introTimer <= 0 && game.mode !== 'panic' && !game.bossLevel) {
      banner(game, 'GO!', '', '#ffd60a', 64, 0.6);
      game.shockwaves.push(new Shockwave(W/2, 158, 200, '#ffd60a', 0.45));
      AudioSys.go();
    }
  }

  // --- World mechanics ---
  updateWind(game, motionDt);
  updateEruption(game, motionDt);
  for (const f of game.fans) f.update(motionDt, game);
  for (const bm of game.bumpers) bm.update(dt);

  // --- Entity updates ---
  for (const p of game.getAllPlayers()) {
    if (p.dead && p.respawnTimer > 0) {
      p.update(dt, game);                     // advances the knockout tumble
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0 && game.lives > 0) game.respawnPlayer(p);
    } else {
      p.update(dt, game);
    }
  }

  for (const p of game.platforms) p.update(motionDt);
  for (const c of game.crabs) c.update(motionDt);
  for (const cr of game.creatures) cr.update(motionDt);
  // Snapshot: fuses can pop balls, and pops append children to game.balls.
  const snapshot = game.balls.slice();
  for (const b of snapshot) b.tickFuses(dt, game);
  for (const b of game.balls) if (!b.dead) b.update(motionDt, game);
  for (const p of game.projectiles) p.update(dt, game);
  for (const pk of game.pickups) pk.update(dt, game);
  // During a time-freeze the WORLD stops: telegraphs, vents, rocks and floor
  // patches all hold (a boss's warning must never run out while the beam it
  // announces is still frozen). Beams that are already live keep burning down
  // so a freeze can't pin a lethal column in place.
  for (const h of game.hazards) {
    const live = h.type === 'electric_beam' || h.type === 'boss_beam';
    h.update(live ? dt : motionDt, game);
  }
  for (const pt of game.particles) pt.update(dt);
  for (const sw of game.shockwaves) sw.update(dt);
  for (const sc of game.smokeClouds) sc.update(dt);
  for (const ft of game.floatingTexts) ft.update(dt);
  for (const bo of game.bolts) bo.update(dt);
  for (const bu of game.bursts) bu.update(dt);
  if (game.boss) game.boss.update(motionDt, game);

  // --- Collisions ---
  resolveCollisions(game);

  // --- Cleanup ---
  game.balls         = game.balls.filter(b => !b.dead);
  game.projectiles   = game.projectiles.filter(p => !p.dead);
  game.pickups       = game.pickups.filter(p => !p.dead);
  game.destructibles = game.destructibles.filter(d => !d.dead);
  game.hazards       = game.hazards.filter(h => !h.dead);
  game.creatures     = game.creatures.filter(c => !c.dead);
  game.particles     = game.particles.filter(p => !p.dead);
  game.shockwaves    = game.shockwaves.filter(s => !s.dead);
  game.smokeClouds   = game.smokeClouds.filter(p => !p.dead);
  game.floatingTexts = game.floatingTexts.filter(f => !f.dead);
  game.bolts         = game.bolts.filter(b => !b.dead);
  game.bursts        = game.bursts.filter(b => !b.dead);
  // Hard caps: drop the OLDEST effects first so fresh feedback always shows.
  if (game.particles.length   > 340) game.particles.splice(0, game.particles.length - 340);
  if (game.shockwaves.length  > 40)  game.shockwaves.splice(0, game.shockwaves.length - 40);
  if (game.smokeClouds.length > 80)  game.smokeClouds.splice(0, game.smokeClouds.length - 80);
  if (game.floatingTexts.length > 28) game.floatingTexts.splice(0, game.floatingTexts.length - 28);

  // --- Adaptive music tempo ---
  let rate = 1;
  if (game.freezeTime > 0) rate = 0.8;
  else if (game.slowTime > 0) rate = 0.88;
  else if (game.boss && game.boss.active) rate = 1 + (game.boss.phase - 1) * 0.04;
  else if (game.mode === 'panic') rate = 1 + Math.min(0.12, game.panicWave * 0.005);
  else if (game.timer < 10) rate = 1.06;
  AudioSys.setMusicRate(rate);

  // --- Win conditions ---
  if (game.state !== State.PLAYING) return;
  if (game.bossLevel) {
    if (game.boss && game.boss.dead && game.balls.length === 0) {
      game.state = State.BOSS_DEFEATED;
      game.bossDefeatedTimer = 1.6;
      AudioSys.setMusicVolume(1);
      Sdk.happytime();
    }
  } else if (game.mode === 'panic') {
    // Star Bubble timer — drops one Star Bubble periodically so the player
    // always has a screen-clear / freeze option even on long survivals.
    if (game.panicStarTimer > 0) game.panicStarTimer -= dt;
    const noStarOnScreen = !game.balls.some(b => b.type === 'star');
    if (game.panicStarTimer <= 0 && noStarOnScreen) {
      game.balls.push(new Ball(grand(140, W - 140), CEILING_Y + 40, 2, 'star', grand(-90, 90) || 60, 60));
      pushText(game.floatingTexts, new FloatingText(W/2, 170, 'STAR BUBBLE!', '#ffd60a', 22), 'wave', 1.0);
      AudioSys.sfx('panic/star_bubble_spawn', 0.8);
      game.panicStarTimer = 30;
    }
    // Rainbow Gauge: when full, force the next wave even mid-fight.
    if (game.panicGauge >= game.panicGaugeMax) {
      game.panicGauge = 0;
      game.addScore(300 * game.panicWave);
      AudioSys.sfx('panic/rainbow_gauge_full', 0.8);
      game.advancePanicWave();
    } else if (game.balls.length === 0) {
      if (game.panicWave > Storage.data.bestPanicWave) {
        Storage.data.bestPanicWave = game.panicWave; Storage.save();
      }
      if (game.score > Storage.data.bestPanicScore) {
        Storage.data.bestPanicScore = game.score; Storage.save();
      }
      game.panicGauge = 0;
      game.addScore(500 * game.panicWave);
      game.advancePanicWave();
    }
  } else {
    if (game.balls.length === 0) {
      game.levelClear();
    }
  }
}

/** Render the gameplay scene: world, entities, effects, intro overlay. */
export function renderWorld(game: Game) {
  const ctx = game.ctx;
  const t = game.t;
  // Parallax follows the (average) player position, eased so a dash reads as
  // a smooth lean rather than a jolt. Off entirely for reduced motion.
  const living = game.getLivingPlayers();
  if (living.length && !Storage.data.reducedMotion) {
    let ax = 0;
    for (const p of living) ax += p.x;
    const target = clamp((ax / living.length - W / 2) / (W / 2), -1, 1);
    game.parallax += (target - game.parallax) * 0.08;
  } else if (Storage.data.reducedMotion) {
    game.parallax = 0;
  }
  drawBackground(ctx, game.theme, t, game.parallax);

  // Ice floor: a glassy sheen band with drifting glints, so the surface that
  // changes how you move also LOOKS different from every other floor.
  if (game.iceFloor) {
    const sheen = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 18);
    sheen.addColorStop(0, 'rgba(255,255,255,0.75)');
    sheen.addColorStop(0.25, 'rgba(190,235,255,0.42)');
    sheen.addColorStop(1, 'rgba(190,235,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(WALL_L, GROUND_Y, WALL_R - WALL_L, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const gx = WALL_L + 40 + ((i * 113 + t * 22) % (WALL_R - WALL_L - 80));
      ctx.moveTo(gx, GROUND_Y + 5); ctx.lineTo(gx + 26, GROUND_Y + 5);
    }
    ctx.stroke();
  }

  // Eruption glow — the sky flares for a beat when the volcano goes off.
  if (game.eruptFlash > 0) {
    const g = ctx.createLinearGradient(0, CEILING_Y, 0, H * 0.7);
    g.addColorStop(0, `rgba(255,120,30,${(0.4 * game.eruptFlash).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, CEILING_Y, W, H * 0.7);
  }

  for (const f of game.fans) f.draw(ctx, t);
  for (const p of game.platforms) p.draw(ctx, game.theme);
  for (const bm of game.bumpers) bm.draw(ctx, t);
  for (const d of game.destructibles) if (!d.dead) d.draw(ctx);
  for (const h of game.hazards) h.draw(ctx);
  for (const c of game.crabs) c.draw(ctx);
  for (const cr of game.creatures) cr.draw(ctx);
  for (const pk of game.pickups) pk.draw(ctx);
  if (game.boss) game.boss.draw(ctx, t);
  const frozen = game.freezeTime > 0;
  for (const b of game.balls) b.draw(ctx, t, frozen);
  for (const p of game.projectiles) p.draw(ctx);
  for (const bu of game.bursts) bu.draw(ctx);
  for (const p of game.getAllPlayers()) p.draw(ctx, game);
  // Downed-player beacon — co-op only, while the rescue window is open. A
  // column of light + a draining ring makes "where" and "how long" readable
  // from across the arena.
  const allPlayers = game.getAllPlayers();
  if (allPlayers.length > 1) {
    for (const p of allPlayers) {
      if (p.dead && p.respawnTimer > 0.05) {
        const k = clamp(p.respawnTimer / 10, 0, 1);
        const urgent = p.respawnTimer < 3.5;
        const beat = 0.5 + Math.abs(Math.sin(t * (urgent ? 9 : 4.5))) * 0.5;
        const col = urgent ? '255,77,109' : '6,214,160';
        const g = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y - 220);
        g.addColorStop(0, `rgba(${col},${(0.34 * beat).toFixed(3)})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 22, GROUND_Y - 220, 44, 220);
        ctx.strokeStyle = 'rgba(10,24,50,0.6)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.x, GROUND_Y - 24, 24, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgb(${col})`;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x, GROUND_Y - 24, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        inkText(ctx, 'P' + p.playerNum, p.x, GROUND_Y - 18, { font: displayFont(16), fill: '#fff', outlineWidth: 3 });
        inkText(ctx, 'RESCUE', p.x, GROUND_Y - 58, { font: displayFont(13), fill: urgent ? PAL.pink : PAL.mint, outlineWidth: 3 });
      }
    }
  }
  for (const pt of game.particles) pt.draw(ctx);
  for (const sw of game.shockwaves) sw.draw(ctx);
  for (const bo of game.bolts) bo.draw(ctx);
  for (const sc of game.smokeClouds) sc.draw(ctx);

  // ---- Wind: streaks across the whole arena. Faint + slow while warning,
  // dense + fast while blowing, always pointing the way the gust goes. ----
  const w = game.wind;
  if (w.phase !== 'calm' && w.dir !== 0) {
    const blowing = w.phase === 'blow';
    const speed = blowing ? 900 : 260;
    const n = blowing ? 26 : 12;
    ctx.strokeStyle = blowing ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = CEILING_Y + 20 + ((i * 53) % (GROUND_Y - CEILING_Y - 30));
      const base = ((t * speed * w.dir + i * 173) % (W + 200) + (W + 200)) % (W + 200) - 100;
      const len = blowing ? 70 + (i % 4) * 22 : 30;
      ctx.moveTo(base, y);
      ctx.lineTo(base - len * w.dir, y);
    }
    ctx.stroke();
    // Direction chevrons under the ceiling — the unambiguous "which way".
    const blink = blowing ? 1 : (Math.sin(t * 16) > 0 ? 1 : 0.35);
    ctx.globalAlpha = blink;
    const cx = W / 2, cy = CEILING_Y + 26;
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * 26 * w.dir + (blowing ? ((t * 60) % 26) * w.dir : 0);
      ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - 7 * w.dir, cy - 9); ctx.lineTo(x + 5 * w.dir, cy); ctx.lineTo(x - 7 * w.dir, cy + 9); ctx.stroke();
      ctx.strokeStyle = blowing ? '#fff' : '#ffd60a'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x - 7 * w.dir, cy - 9); ctx.lineTo(x + 5 * w.dir, cy); ctx.lineTo(x - 7 * w.dir, cy + 9); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Screen-wide state tints ----
  if (frozen) {
    // Time-stop: a cold wash + frost creeping in from the edges.
    const k = clamp(game.freezeTime / 0.5, 0, 1);
    ctx.fillStyle = `rgba(150,215,255,${(0.1 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    const fg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    fg.addColorStop(0, 'rgba(190,235,255,0)');
    fg.addColorStop(1, `rgba(190,235,255,${(0.34 * k).toFixed(3)})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
  }
  if (game.gravityScale < game.baseGravityScale - 0.05) {
    const pulse = 0.5 + Math.sin(t * 5) * 0.5;
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    rg.addColorStop(0, 'rgba(178,102,255,0)');
    rg.addColorStop(1, `rgba(178,102,255,${(0.2 + pulse * 0.12).toFixed(3)})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  for (const ft of game.floatingTexts) ft.draw(ctx);

  // ---- Boss entrance card ----
  const boss = game.boss;
  if (boss && boss.introT > 0 && game.introTimer <= 0) {
    const k = clamp(boss.introT / 0.4, 0, 1) * clamp((2.6 - boss.introT) / 0.3, 0, 1);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,0,20,0.72)';
    ctx.fillRect(0, H / 2 - 54, W, 108);
    ctx.fillStyle = '#ff2b88';
    const stripe = (t * 120) % 40;
    for (let x = -40 + stripe; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, H / 2 - 54); ctx.lineTo(x + 18, H / 2 - 54); ctx.lineTo(x + 8, H / 2 - 46); ctx.lineTo(x - 10, H / 2 - 46);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, H / 2 + 46); ctx.lineTo(x + 18, H / 2 + 46); ctx.lineTo(x + 8, H / 2 + 54); ctx.lineTo(x - 10, H / 2 + 54);
      ctx.closePath(); ctx.fill();
    }
    inkText(ctx, 'WARNING', W / 2, H / 2 - 16, { font: displayFont(22), fill: '#ff2b88', outlineWidth: 4 });
    inkText(ctx, boss.name, W / 2, H / 2 + 26, { font: displayFont(40), fill: '#fff', outlineWidth: 6 });
    ctx.globalAlpha = 1;
  }

  // Final-seconds urgency vignette — red edge glow that builds as the clock
  // runs out, in sync with the warning beeps. Reduced-motion players get a
  // faint static tint instead of the pulse.
  if (game.state === State.PLAYING && game.mode !== 'panic' && game.timer > 0 && game.timer < 10) {
    const urgency = 1 - game.timer / 10;
    const pulse = Storage.data.reducedMotion
      ? 0.5
      : 0.5 + Math.sin(game.t * (6 + urgency * 6)) * 0.5;
    const alpha = (0.08 + urgency * 0.2) * (0.55 + pulse * 0.45);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(255,45,60,0)');
    grad.addColorStop(1, `rgba(255,45,60,${alpha.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // First-ever-session control hint. Desktop gets a calm keyboard pill above
  // the play field; BOTH device classes get the aim line + pulsing "POP THIS"
  // ring on the first ball — that visual goal marker is even more valuable on
  // touch, where the DOM onboarding overlay only explains movement. Shown
  // only until the player has popped their very first ball ever
  // (firstPopCelebrated is a sticky one-way flag in Storage), then fades.
  if (!Storage.data.firstPopCelebrated && game.state === State.PLAYING && game.mode === 'tour' && game.levelIndex === 0 && game.introTimer <= 0) {
    const fadeFrom = 1.0;   // full opacity for the first second
    const hangSecs = 6.0;   // fully visible for this long
    const fadeSecs = 1.5;   // then fade out over this
    const age = Math.max(0, game.firstRunHintAge);
    const tIn = Math.min(1, age / 0.4);
    const tOut = Math.max(0, Math.min(1, (age - hangSecs) / fadeSecs));
    const alpha = fadeFrom * tIn * (1 - tOut);
    if (alpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (!isTouchDevice) {
        const w = 360, h = 56;
        const x = W/2 - w/2, y = 96;
        // Match the HTML overlay-card chrome: navy fill, inner top highlight,
        // accent hairline border.
        ctx.fillStyle = 'rgba(10,24,50,0.82)';
        roundRect(ctx, x, y, w, h, 12, true, false);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        roundRect(ctx, x + 2, y + 2, w - 4, 10, 8, true, false);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,214,10,0.65)';
        roundRect(ctx, x, y, w, h, 12, false, true);
        ctx.font = uiFont(12, 800);
        ctx.fillStyle = PAL.cyan;
        ctx.textAlign = 'center';
        ctx.fillText('HOW TO PLAY', W/2, y + 17);
        ctx.font = uiFont(15, 800);
        ctx.fillStyle = PAL.yellow;
        ctx.fillText('A / D or ← →  MOVE   •   SPACE  FIRE', W/2, y + 40);
      }
      const firstBall = game.balls.find(b => !b.dead);
      if (firstBall && game.player) {
        const pulse = 0.5 + Math.sin(age * 7) * 0.5;
        ctx.strokeStyle = `rgba(255,214,10,${0.45 + pulse * 0.35})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(game.player.x, game.player.y - 46);
        ctx.lineTo(game.player.x, CEILING_Y + 22);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(firstBall.x, firstBall.y, firstBall.r + 10 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        inkText(ctx, 'POP THIS', firstBall.x, firstBall.y - firstBall.r - 18, {
          font: displayFont(15), fill: PAL.yellow, outlineWidth: 3,
        });
      }
      ctx.restore();
    }
  }

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
    const showTarget = game.mode === 'tour' && game.targetScore > 0 && !game.bossLevel;
    const bx = W/2 - 300, by = H/2 - 60, bw = 600, bh = showTarget ? 138 : 120;
    // Overlay-card chrome to match the HTML result/pause cards: deep navy
    // fill, inner top highlight, accent hairline border, top accent bar.
    ctx.fillStyle = 'rgba(10,24,50,0.86)';
    roundRect(ctx, bx, by, bw, bh, 16, true, false);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, bx + 3, by + 3, bw - 6, 12, 10, true, false);
    ctx.fillStyle = PAL.yellow;
    ctx.globalAlpha = a * 0.9;
    roundRect(ctx, bx + bw/2 - 36, by + 8, 72, 4, 2, true, false);
    ctx.globalAlpha = a;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,214,10,0.6)';
    roundRect(ctx, bx, by, bw, bh, 16, false, true);
    // Banner header: prefer introTitle when set (mode-specific framing),
    // otherwise fall back to the level's name. Display face + ink outline so
    // it matches the HTML .fx-banner__title exactly.
    const bannerTitle = game.introTitle || game.levelName;
    inkText(ctx, bannerTitle, W/2, H/2 - 18, { font: displayFont(30), fill: PAL.yellow });
    ctx.font = uiFont(17, 700);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const lines = game.introText.split('\n');
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W/2, H/2 + 16 + i * 22);
    // Tour stages: surface the bronze-medal target up front so the score
    // goal is a plan, not a surprise on the result screen.
    if (showTarget) {
      ctx.font = uiFont(13, 800);
      ctx.fillStyle = PAL.cyan;
      ctx.fillText('MEDAL TARGET  ' + game.targetScore.toLocaleString(), W/2, by + bh - 14);
    }
    ctx.restore();
  }
}
