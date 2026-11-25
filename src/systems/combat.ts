import { BALL_COLORS, BALL_SCORE, GRAZE_SCORE, H, POPSHOT_MAX, POPSHOT_PER_GRAZE, POPSHOT_PER_POP, POPSHOT_PER_TRICK, State, W, chainMult, chainWindow, type DeathReason } from '../constants';
import { LEVELS } from '../data/levels';
import { ARC_RANGE, type Ball } from '../entities/ball';
import type { Destructible } from '../entities/destructible';
import { Bolt, FloatingText, Particle, PopBurst, Shockwave, pushText } from '../entities/particle';
import { Pickup } from '../entities/pickup';
import type { Player } from '../entities/player';
import type { Projectile } from '../entities/projectile';
import { rand } from '../utils';
import { emit } from './analytics';
import { AudioSys } from './audio';
import { medalFor, recordDailyAttempt } from './daily';
import { Platform as Sdk } from './platform';
import { Storage } from './storage';
import { markTitlesSeen, newlyEarnedTitles, recordTrick } from './titles';
import { advanceMissions } from './retention';
import { FX } from '../ui/overlay/effects';
import { pulseScoreDelta } from '../ui/hud/hud.html';
import { Haptics } from './haptics';
import type { Game } from '../game';

/** What caused a pop. Projectiles carry `owner`; everything else is a tagged
 *  object so chain reactions can be told apart from direct hits. */
export type PopSource =
  | Projectile
  | { kind: 'cascade' | 'arc' | 'blast' | 'creature' | 'wipe' }
  | null
  | undefined;

function isShot(source: any): source is Projectile {
  return !!source && typeof source === 'object' && 'owner' in source;
}

/** Centre-screen callout. Occupies the exclusive 'banner' slots, so a new
 *  banner replaces the previous one instead of stacking on top of it. */
export function banner(game: Game, title: string, sub = '', color = '#ffd60a', size = 52, life = 1.1) {
  // Banners live in the upper third — above the bounce apex of most balls and
  // well clear of the player — so a celebration never hides a threat.
  const y = 158;
  pushText(game.floatingTexts, new FloatingText(W / 2, y, title, color, size), 'banner', life).rise = 10;
  if (sub) pushText(game.floatingTexts, new FloatingText(W / 2, y + size * 0.5 + 12, sub, '#fff', Math.max(14, size * 0.34)), 'banner2', life).rise = 10;
  else for (const o of game.floatingTexts) if (o.slot === 'banner2') o.dead = true;
}

/** Feed the PopShot meter. Fires the READY beat exactly once per fill. */
export function addCharge(game: Game, amount: number) {
  if (game.popShotReady || amount <= 0) return;
  let k = 1;
  if (game.modifier === 'overcharge') k = 3;
  if (game.getAllPlayers().length > 1) k *= 0.8;
  game.popCharge = Math.min(POPSHOT_MAX, game.popCharge + amount * k);
  if (game.popCharge >= POPSHOT_MAX) {
    game.popShotReady = true;
    AudioSys.popshotReady();
    Haptics.pop();
    const p = game.getLivingPlayers()[0];
    if (p) {
      pushText(game.floatingTexts, new FloatingText(p.x, p.y - 74, 'POPSHOT READY!', '#fff3b0', 20), 'popshot', 1.4).rise = 26;
      game.shockwaves.push(new Shockwave(p.x, p.y - 24, 90, '#fff3b0', 0.4));
    }
    // The very first time, spell out what a full meter means.
    if (!Storage.data.tips?.popshot) {
      Storage.data.tips = { ...(Storage.data.tips || {}), popshot: true };
      Storage.save();
      banner(game, 'POPSHOT READY!', 'your next shot bursts a whole ball family', '#fff3b0', 34, 2.6);
    }
  }
}

/** A near miss: a ball skimmed the hurtbox without touching it. */
export function graze(game: Game, player: Player, ball: Ball) {
  game.grazeStreak = game.grazeStreakT > 0 ? game.grazeStreak + 1 : 1;
  game.grazeStreakT = 2.2;
  game.runGrazes++;
  const mult = chainMult(game.combo) * (game.modifier === 'double_score' ? 2 : 1);
  const gained = Math.round(GRAZE_SCORE * mult * Math.min(3, 1 + (game.grazeStreak - 1) * 0.5));
  game.addScore(gained);
  addCharge(game, POPSHOT_PER_GRAZE);
  AudioSys.graze(game.grazeStreak);
  // Sparks jump from the ball's near edge toward the player — the visible
  // proof of how close that was.
  const dx = player.x - ball.x, dy = (player.y - 24) - ball.y;
  const d = Math.hypot(dx, dy) || 1;
  const ex = ball.x + (dx / d) * ball.r, ey = ball.y + (dy / d) * ball.r;
  for (let i = 0; i < 6; i++) {
    const a = Math.atan2(dy, dx) + rand(-0.9, 0.9);
    const s = rand(120, 260);
    game.particles.push(new Particle(ex, ey, Math.cos(a) * s, Math.sin(a) * s, rand(0.14, 0.28), i % 2 ? '#9be7ff' : '#fff', 4, 0, 4, true));
  }
  const label = game.grazeStreak >= 2 ? 'GRAZE ×' + game.grazeStreak : 'GRAZE';
  const ft = pushText(game.floatingTexts, new FloatingText(player.x, player.y - 62, label + '  +' + gained, '#9be7ff', 13), 'graze' + player.playerNum, 0.7);
  ft.rise = 30;
}

/** Award a named trick: small score, PopShot charge, one compact chip. */
function awardTrick(game: Game, id: string, label: string, bonus: number, color: string, x: number, y: number) {
  const dailyMult = game.modifier === 'double_score' ? 2 : 1;
  game.addScore(Math.round(bonus * dailyMult));
  game.runTricks++;
  addCharge(game, POPSHOT_PER_TRICK);
  Storage.data.lifetimeTricks = (Storage.data.lifetimeTricks || 0) + 1;
  advanceMissions('trick', 1);
  const progress = recordTrick(id);
  AudioSys.trick(id);
  const ft = new FloatingText(x, y, label, color, 14);
  ft.life = 0.8; ft.maxLife = 0.8;
  game.floatingTexts.push(ft);
  if (progress.contract) {
    const left = Math.max(0, progress.contract.target - progress.count);
    if (progress.completedNow) {
      FX.medal(progress.contract.title, progress.contract.label + ' complete', 'mythic', 'TITLE');
    } else if (left > 0 && left <= 2) {
      FX.toast('info', progress.contract.label.toUpperCase(), left + ' to ' + progress.contract.title);
    }
  }
}
export { awardTrick };

/**
 * Hit a ball. Runs the ball's own reaction first — an armored shell cracking
 * or a bomb's fuse lighting is NOT a pop and earns nothing — and only credits
 * the pop (score, chain, feedback) when the ball was actually destroyed.
 */
export function popBall(game: Game, ball: Ball, source: PopSource) {
  if (ball.dead) return;
  if (isShot(source)) source.didHit = true;

  // ---------- Panic-mode Star Bubble ----------
  // Star Bubbles are popped instead of split. The face on the bubble dictates
  // the effect: Clock → universal freeze (~6 s), Star → full-screen wipe.
  if (ball.type === 'star') {
    creditPop(game, ball, source, 0);
    if (ball.starMode === 0) {
      game.freezeTime = Math.max(game.freezeTime, 6);
      AudioSys.sfx('panic/freeze_engage', 0.9);
      banner(game, 'TIME FREEZE!', '', '#9be7ff', 40);
      game.shockwaves.push(new Shockwave(ball.x, ball.y, 220, '#9be7ff', 0.45));
    } else {
      // Star face: every ball on screen pops in a wave radiating from the star.
      AudioSys.sfx('panic/star_bubble_star_pop', 0.9);
      let n = 0;
      for (const b of game.balls) {
        if (b === ball || b.dead) continue;
        b.cascade = true;
        b.popFuse = 0.05 + Math.hypot(b.x - ball.x, b.y - ball.y) / 1400;
        b.popFuseKind = 'cascade';
        n++;
      }
      banner(game, 'SCREEN CLEAR!', n + ' balls', '#ffd60a', 44);
      game.flash = 0.5;
      game.shake = 18;
      game.shockwaves.push(new Shockwave(ball.x, ball.y, 420, '#ffd60a', 0.7));
    }
    ball.dead = true;
    game.hitPause = Math.max(game.hitPause, 0.08);
    return;
  }

  const children = ball.hit(game, source);
  if (children === null) return;           // survived (armor / fuse) — no credit
  creditPop(game, ball, source, children.length);
  if (children.length > 0) {
    AudioSys.split();
    game.balls.push(...children);
  }
  ball.dead = true;
}

/**
 * Everything that happens BECAUSE a ball was destroyed: score, chain, tricks,
 * PopShot charge, elemental after-effects, and the layered pop feedback.
 * Called by popBall and directly by Ball.detonate (a bomb pops itself).
 */
export function creditPop(game: Game, ball: Ball, source: PopSource, childCount = 0) {
  Haptics.pop();
  const shot = isShot(source);
  const kind = shot ? 'shot' : (source as any)?.kind || 'other';
  const sz = ball.size;

  // ---------- Chain ----------
  const prevCombo = game.combo;
  game.combo++;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.comboDecay = chainWindow(game.combo);
  game.comboWindow = game.comboDecay;
  game.levelPops++;
  if (game.combo > (Storage.data.lifetimeMaxCombo || 0)) Storage.data.lifetimeMaxCombo = game.combo;

  // ---------- Score ----------
  const boost = game.comboBoostTime > 0 ? 1.5 : 1;
  const mult = chainMult(game.combo) * boost;
  const dailyMult = game.modifier === 'double_score' ? 2 : 1;
  const gained = Math.round(BALL_SCORE[sz] * mult * dailyMult);
  game.addScore(gained);
  pulseScoreDelta(gained);
  game.chainScore += gained;
  // World-space score tick: full size for direct hits, compact for the
  // ripples of a chain reaction (their sum is announced by the chain label).
  const tick = new FloatingText(ball.x, ball.y - 8, '+' + gained, mult >= 2 ? '#ffd60a' : '#fff', shot ? 17 : 12);
  tick.life = shot ? 0.7 : 0.45; tick.maxLife = tick.life; tick.rise = 55;
  game.floatingTexts.push(tick);

  // ---------- Multi-pop window ----------
  // Pops landing within a short window are announced as ONE label at their
  // centroid when the window closes (see playing.ts) — never one per ball.
  game.chainCount++;
  // A multi-pop is "at once": direct hits get a FIXED 0.2 s window from the
  // first pop, so a rapid-fire weapon can't stretch one window into an
  // "ULTRA POP" just by holding the trigger. Chain reactions (arcs, blasts,
  // cascades) do extend it — the reaction is the event.
  if (game.chainCount === 1) game.chainTimer = 0.2;
  else if (kind !== 'shot') game.chainTimer = Math.max(game.chainTimer, 0.18);
  game.chainCx = (game.chainCx * (game.chainCount - 1) + ball.x) / game.chainCount;
  game.chainCy = (game.chainCy * (game.chainCount - 1) + ball.y) / game.chainCount;
  if (kind === 'arc') game.chainArcs++;
  if (kind === 'blast') game.chainBlasts++;
  if (kind === 'cascade') game.chainCascade++;
  if (shot && source.owner) game.chainOwners |= 1 << source.owner.playerNum;

  addCharge(game, POPSHOT_PER_POP + (kind === 'arc' || kind === 'blast' ? 1 : 0));

  // ---------- Tricks (direct hits only, max one per pop) ----------
  const othersAlive = game.balls.some(b => !b.dead && b !== ball);
  const isLastBall = !othersAlive && childCount === 0;
  if (shot && source.type !== 'popshot') {
    const owner = source.owner || game.player;
    const playerDist = owner ? Math.hypot(ball.x - owner.x, ball.y - (owner.y - 22)) : Infinity;
    const sinceWall = ball.age - ball.lastWallTime;
    // Tricks are meant to be noticed, so each one has to be earned: the bar
    // is "the player did something a careful player would not have".
    if (isLastBall && game.mode !== 'panic' && !game.bossLevel && game.timer > 0 && game.timer < 3) {
      awardTrick(game, 'clutch', 'CLUTCH!', 400, '#ff36c4', ball.x, ball.y - 34);
    } else if (playerDist < 66 && ball.vy > 40) {
      // Stood their ground under a ball that was already coming down on them.
      awardTrick(game, 'close_call', 'CLOSE CALL', 100, '#ff7f50', ball.x, ball.y - 34);
    } else if (ball.floorBounces === 0 && ball.airGen >= 2 && ball.bornT <= 0) {
      // Third generation in a row caught before any of them touched the floor.
      awardTrick(game, 'air_pop', 'JUGGLE', 80 + Math.min(4, ball.airGen - 2) * 40, '#9be7ff', ball.x, ball.y - 34);
    } else if (sinceWall >= 0 && sinceWall < 0.22 && ball.size >= 1) {
      awardTrick(game, 'bank_shot', 'BANK SHOT', 60, '#06d6a0', ball.x, ball.y - 34);
    } else if (Math.abs(ball.vy) < 28 && ball.floorBounces > 0 && ball.size >= 2) {
      // Hit dead on the top of its arc — the hardest moment to time.
      awardTrick(game, 'apex', 'APEX', 60, '#e0b3ff', ball.x, ball.y - 34);
    }
  }

  Storage.data.lifetimePops = (Storage.data.lifetimePops || 0) + 1;
  advanceMissions('pop', 1);
  game.shotsHit++;

  // ---------- Sound: sampled pop + one note of the chain melody ----------
  AudioSys.pop(sz, ball.type, kind !== 'shot');
  AudioSys.popNote(game.combo, sz);

  // First-pop is the most important conversion signal: "the player got to
  // gameplay AND took a successful action." Emit at most once per session.
  if (!game.sessionFirstPopEmitted) {
    game.sessionFirstPopEmitted = true;
    emit('first_pop', { mode: game.mode, level: game.levelIndex });
    if (!Storage.data.firstPopCelebrated) {
      Storage.data.firstPopCelebrated = true;
      Storage.save();
      banner(game, 'FIRST POP!', 'keep popping to build a chain', '#ffd60a', 44, 1.6);
      game.shockwaves.push(new Shockwave(ball.x, ball.y, 160, '#ffd60a', 0.55));
      game.flash = Math.max(game.flash, 0.3);
      AudioSys.firstPop();
    }
  }

  // ---------- Pop feedback ----------
  const palette = BALL_COLORS[ball.type] || BALL_COLORS.normal;
  const color = palette[0], colorDark = palette[1];
  // Membrane burst: the ball's own outline tearing apart.
  game.bursts.push(new PopBurst(ball.x, ball.y, ball.r, color, colorDark, ball.type === 'hexagon'));
  // Spark spray — streaks with drag, so they snap out fast and hang.
  const quiet = kind === 'cascade' || kind === 'arc';
  const sparkN = Math.round((6 + sz * 4) * (quiet ? 0.6 : 1));
  for (let i = 0; i < sparkN; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(180, 380 + sz * 60);
    game.particles.push(new Particle(ball.x + Math.cos(a) * ball.r * 0.5, ball.y + Math.sin(a) * ball.r * 0.5,
      Math.cos(a) * s, Math.sin(a) * s - 40, rand(0.22, 0.42 + sz * 0.04), i % 3 === 0 ? '#fff' : color, 4 + sz, 260, 3.4, true));
  }
  // Droplets — the liquid inside, falling under gravity.
  const dropN = Math.round((3 + sz * 2) * (quiet ? 0.5 : 1));
  for (let i = 0; i < dropN; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(60, 170 + sz * 20);
    game.particles.push(new Particle(ball.x, ball.y, Math.cos(a) * s, Math.sin(a) * s - rand(60, 140),
      rand(0.4, 0.75), i % 2 ? color : colorDark, 5 + sz * 1.5, 620));
  }
  game.shockwaves.push(new Shockwave(ball.x, ball.y, 34 + sz * 22, color, 0.24 + sz * 0.03));
  // Type signatures — each material leaves a different mark.
  if (ball.type === 'lava') {
    for (let i = 0; i < 6; i++) game.particles.push(new Particle(ball.x + rand(-ball.r, ball.r) * 0.5, ball.y, rand(-40, 40), rand(-160, -60), rand(0.5, 0.9), i % 2 ? '#ffd60a' : '#ff7733', 4, -60));
  } else if (ball.type === 'armored') {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(140, 300);
      game.particles.push(new Particle(ball.x, ball.y, Math.cos(a) * s, Math.sin(a) * s - 80, rand(0.5, 0.8), i % 2 ? '#e9eef5' : '#6b737b', 7, 700));
    }
  } else if (ball.type === 'sludge') {
    for (let i = 0; i < 5; i++) game.particles.push(new Particle(ball.x, ball.y, rand(-120, 120), rand(-200, -40), rand(0.5, 0.8), '#9be15d', 8, 800));
  }
  // Floor-dust puff — only if the pop happened near the floor.
  if (ball.y > 400 && !quiet) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + Math.random() * Math.PI;
      const s = rand(40, 110);
      game.particles.push(new Particle(ball.x + rand(-12, 12), Math.min(ball.y + ball.r, 484),
        Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.4 - 30, rand(0.35, 0.55), '#d8c9a8', 5, 90));
    }
  }
  for (const p of game.getLivingPlayers()) p.cheer();

  // ---------- Electric: the charge jumps to the nearest ball ----------
  if (ball.type === 'electric') arcFrom(game, ball);

  // ---------- Chain milestones ----------
  if (prevCombo < game.combo) {
    const c = game.combo;
    const milestone = c === 5 ? 1 : c === 10 ? 2 : c === 15 ? 3 : c === 20 ? 4 : c === 30 ? 5 : c === 40 ? 6 : 0;
    if (milestone > 0) {
      const label = ['', 'NICE!', 'WILD!', 'INSANE!', 'GODLIKE!', 'UNREAL!', 'POP GOD!'][milestone];
      const tint  = ['', '#ffd60a', '#ff7f50', '#ff36c4', '#9be7ff', '#b9ff66', '#ffffff'][milestone];
      banner(game, label, c + ' CHAIN  ·  ×' + chainMult(c).toFixed(1), tint, 30 + milestone * 3, 0.9);
      game.shockwaves.push(new Shockwave(W / 2, 158, 150 + milestone * 30, tint, 0.45));
      game.flash = Math.max(game.flash, 0.08 + milestone * 0.03);
      game.shake = Math.max(game.shake, 3 + milestone * 1.5);
      game.hitPause = Math.max(game.hitPause, 0.05 + milestone * 0.02);
      // Only the rare tiers earn a persistent callout; the banner covers the rest.
      if (milestone >= 5) {
        FX.medal(label.replace('!', ''), c + ' chain', milestone >= 6 ? 'mythic' : 'plat', '×' + chainMult(c).toFixed(1));
      }
      if (milestone >= 4) FX.chromAb();
      AudioSys.comboHit(Math.min(4, milestone));
    }
  }

  // Flashing micro-ball: popping the tagged size-0 child grants a brief
  // arcade-style freeze.
  if (ball.flashing && ball.size === 0) {
    game.freezeTime = Math.max(game.freezeTime, 2.2);
    game.addScore(300);
    AudioSys.sfx('panic/freeze_engage', 0.7);
    const ft = new FloatingText(ball.x, ball.y - 22, 'TIME STOP!', '#9be7ff', 18);
    game.floatingTexts.push(ft);
    game.shockwaves.push(new Shockwave(ball.x, ball.y, 100, '#9be7ff', 0.4));
  }
  // Panic gauge: each pop fills the Rainbow Gauge a notch.
  if (game.mode === 'panic') game.panicGauge = Math.min(game.panicGaugeMax, game.panicGauge + 1);

  // Hit-stop — bigger balls bite harder; chain-reaction pops barely pause so a
  // cascade flows instead of stuttering.
  const stop = kind === 'shot' ? 0.028 + sz * 0.012 + (isLastBall ? 0.05 : 0) : 0.012;
  game.hitPause = Math.max(game.hitPause, stop);
  if (kind === 'shot') game.shake = Math.max(game.shake, 1.5 + sz * 1.2);

  // "Last one!" bullet-time — when this pop leaves exactly one ball alive,
  // a brief slow-mo beat (once per level) marks the finish line.
  if (!game.lastBallSlowmo && !game.bossLevel && game.mode !== 'panic') {
    const remaining = game.balls.filter(b => !b.dead && b !== ball).length + childCount;
    if (remaining === 1 && game.levelPops > 2) {
      game.lastBallSlowmo = true;
      game.slowTime = Math.max(game.slowTime, 0.6);
      pushText(game.floatingTexts, new FloatingText(W / 2, 150, 'LAST ONE!', '#ffd60a', 28), 'last', 0.9);
    }
  }

  // Title-unlock detection. newlyEarnedTitles returns [] in steady state.
  const newTitles = newlyEarnedTitles();
  if (newTitles.length > 0) {
    const t = newTitles[0];
    FX.medal(t.label, 'New title earned', 'mythic', 'TITLE');
    AudioSys.sfx('combo/title_unlock', 0.9) || AudioSys.firstPop();
    markTitlesSeen(newTitles.map(n => n.id));
  }
}

/** Electric discharge: jump to the nearest eligible ball (or the boss) and
 *  pop it a beat later. Fresh children are briefly grounded, so a spark walks
 *  outward through the arena instead of looping inside one family. */
export function arcFrom(game: Game, from: { x: number; y: number; id?: number }) {
  let best: Ball | null = null;
  let bestD = Infinity;
  for (const b of game.balls) {
    if (b.dead || b === from || b.arcImmune > 0 || b.popFuse >= 0 || b.type === 'star') continue;
    const d = Math.hypot(b.x - from.x, b.y - from.y) - b.r;
    if (d < ARC_RANGE && d < bestD) { bestD = d; best = b; }
  }
  const boss = game.boss;
  if (boss && !boss.dead) {
    const hit = boss.arcTarget(from.x, from.y, ARC_RANGE);
    if (hit && hit.d < bestD) {
      game.bolts.push(new Bolt(from.x, from.y, hit.x, hit.y, '#ffe14a', 4, 0.26));
      boss.onArc(game, hit.x, hit.y);
      AudioSys.zap();
      return;
    }
  }
  if (!best) return;
  game.bolts.push(new Bolt(from.x, from.y, best.x, best.y));
  best.popFuse = 0.1;
  best.popFuseKind = 'arc';
  best.hitFlash = 0.1;
  AudioSys.zap();
}

/** Break a crate: score, debris, and whatever it was holding. */
export function breakCrate(game: Game, d: Destructible) {
  if (d.dead) return;
  d.dead = true;
  AudioSys.sfx('hazard/destructible_break', 0.8) || AudioSys.pop();
  game.addScore(100);
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
  if (d.contains) game.pickups.push(new Pickup(cx, cy, d.contains));
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(80, 240);
    game.particles.push(new Particle(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 80, rand(0.4, 0.7), i % 2 ? '#b8742f' : '#7a4a1c', 7, 700));
  }
  game.shockwaves.push(new Shockwave(cx, cy, 44, '#f0c27a', 0.22));
}

export function explodeProjectile(game: Game, projectile: Projectile, x: number, y: number) {
  if (projectile.dead) return;
  projectile.dead = true;
  projectile.didHit = true;
  AudioSys.explode(false);
  game.flash = Math.max(game.flash, 0.14);
  game.shake = Math.max(game.shake, 8);
  const radius = projectile.explosionRadius || 90;
  game.shockwaves.push(new Shockwave(x, y, radius, '#ffb347', 0.35));
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(140, 400);
    game.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.6), i % 2 ? '#ff5400' : '#ffd60a', 7, 140, 3, i % 2 === 0));
  }
  for (const b of game.balls) {
    if (b.dead) continue;
    const dx = b.x - x, dy = b.y - y;
    if (dx * dx + dy * dy < (radius + b.r) * (radius + b.r)) popBall(game, b, { kind: 'blast' });
  }
  for (const d of game.destructibles) {
    if (d.dead) continue;
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < radius * radius) breakCrate(game, d);
  }
  for (const sc of game.smokeClouds) {
    if (Math.hypot(sc.x - x, sc.y - y) < radius + 40) sc.life = Math.min(sc.life, 0.25);
  }
  if (game.boss && !game.boss.dead) game.boss.onBlast(game, x, y, radius);
  game.hitPause = Math.max(game.hitPause, 0.06);
}

export function killPlayer(game: Game, player: Player, reason: DeathReason = 'unknown', chargeLife = true) {
  // Respawn grace AND dash i-frames protect against everything (a timeout
  // clears both before it calls in — the clock is not dodgeable).
  if (player.untouchable || player.dead) return;
  if (player.shield) {
    player.shield = false;
    player.invuln = 1.0;
    AudioSys.shieldBreak();
    Haptics.damage();
    game.flash = 0.15;
    game.shake = 6;
    game.shockwaves.push(new Shockwave(player.x, player.y - 24, 70, '#3a86ff', 0.3));
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(160, 320);
      game.particles.push(new Particle(player.x, player.y - 24, Math.cos(a) * s, Math.sin(a) * s, 0.4, '#3a86ff', 5, 0, 3, true));
    }
    return;
  }
  player.dead = true;
  player.deathT = 0;
  player.deathVx = (player.x < W / 2 ? 1 : -1) * rand(40, 120);
  game.lastDeathReason = reason;
  // Diagnostics for the simulator / tests: what exactly was closest.
  if (reason === 'ball') {
    let near: Ball | null = null, nd = Infinity;
    for (const b of game.balls) { const d = Math.hypot(b.x - player.x, b.y - (player.y - 22)) - b.r; if (d < nd) { nd = d; near = b; } }
    game.lastDeathInfo = near ? { size: near.size, type: near.type, age: +near.age.toFixed(2), vy: Math.round(near.vy), y: Math.round(near.y), simT: +game.simT.toFixed(1) } : null;
  } else game.lastDeathInfo = null;
  game.levelDeaths++;
  AudioSys.hurt();
  Haptics.death();
  game.shake = 18; game.flash = 0.3;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(120, 320);
    game.particles.push(new Particle(player.x, player.y - 24, Math.cos(a) * s, Math.sin(a) * s, 0.6, i % 2 ? '#ff4d6d' : '#ffd60a', 6, 300, 2.5, i % 2 === 0));
  }
  // Chromatic-aberration flash — the strongest "ouch" signal we have.
  FX.chromAb();
  FX.damageFlash();
  endChain(game, true);
  // In co-op, a single shared event (e.g. the level timer hitting 0) can
  // kill every player in the same frame. That should still only cost the
  // team ONE life, not one per player caught in the blast.
  if (chargeLife) game.lives--;
  if (chargeLife && game.lives > 0) {
    FX.toast('danger', 'LIFE LOST', game.lives + ' remaining');
  }
  // In co-op, lives are a shared pool, but the run must not end just because
  // ONE teammate's death drained the last life. Only end the run once every
  // player is actually down.
  const anyoneElseAlive = game.getAllPlayers().some(p => p !== player && !p.dead);
  if (game.lives <= 0 && !anyoneElseAlive) {
    emit('run.fail', { mode: game.mode, level: game.levelIndex, score: game.score, reason });
    advanceMissions('score', 1, game.score);
    // Daily challenge: any failed run is still a logged attempt.
    if (game.mode === 'daily') {
      recordDailyAttempt(game.score);
      game.dailyResultScore = game.score;
      game.dailyResultShareCopied = 0;
      game.state = State.DAILY_RESULT;
      return;
    }
    AudioSys.sfx('stinger/game_over', 0.9);
    game.state = State.GAME_OVER;
    game.saveRunBest();
  } else if (anyoneElseAlive) {
    // Revive window: 10 seconds for a teammate to reach the downed player.
    // After that, normal respawn — unless the shared life pool is spent.
    if (game.lives > 0) {
      player.respawnTimer = 10.0;
      pushText(game.floatingTexts, new FloatingText(player.x, player.y - 46,
        'P' + player.playerNum + ' DOWN — RESCUE!', '#ff4d6d', 18), 'down' + player.playerNum, 1.6);
    } else {
      player.respawnTimer = 0;
      pushText(game.floatingTexts, new FloatingText(player.x, player.y - 46,
        'P' + player.playerNum + ' OUT OF LIVES', '#ff4d6d', 18), 'down' + player.playerNum, 1.6);
    }
  } else {
    game.state = State.PLAYER_DEAD;
    game.hitPause = 1.2;
  }
}

/** The chain timer ran out (or the player was hit). Banks nothing — score was
 *  paid per pop — but marks the level as not a PERFECT CHAIN. */
export function endChain(game: Game, silent = false) {
  if (game.combo <= 0) return;
  if (!silent) AudioSys.chainEnd(game.combo);
  if (game.combo >= 10 && !silent) {
    const p = game.getLivingPlayers()[0];
    if (p) {
      const ft = pushText(game.floatingTexts, new FloatingText(p.x, p.y - 70, 'CHAIN ' + game.combo + ' BANKED', '#cfd6df', 13), 'chainend', 0.9);
      ft.rise = 24;
    }
  }
  if (game.levelPops > 0) game.chainBroken = true;
  game.combo = 0;
  game.comboDecay = 0;
  Storage.save();
}

export function clearLevel(game: Game) {
  AudioSys.levelClear();
  Sdk.happytime();
  emit('level.clear', { mode: game.mode, level: game.levelIndex, score: game.score, timer: Math.max(0, Math.round(game.timer)) });
  advanceMissions('level_clear', 1);
  advanceMissions('score', 1, game.score);
  game.flash = 0.3;
  const dailyMult = game.modifier === 'double_score' ? 2 : 1;
  // Clear bonuses. Every one of them is reachable with touch auto-fire:
  // nothing here depends on NOT shooting.
  const timeBonus = Math.round(game.timer) * 25;
  const chainBonus = game.maxCombo * 60;
  const styleBonus = (game.runTricks * 80 + game.runGrazes * 30) * dailyMult;
  const flawlessBonus = game.levelDeaths === 0 ? 1000 : 0;
  // PERFECT CHAIN: the whole stage in one unbroken chain.
  const perfect = !game.chainBroken && game.levelPops >= 6 && game.levelDeaths === 0;
  const perfectBonus = perfect ? 2000 : 0;
  const total = timeBonus + chainBonus + styleBonus + flawlessBonus + perfectBonus;
  game.addScore(total);
  if (perfect) {
    banner(game, 'PERFECT CHAIN!', 'one unbroken chain  +' + perfectBonus, '#b9ff66', 40, 1.6);
    Storage.data.perfectChains = (Storage.data.perfectChains || 0) + 1;
  }

  // Daily run finishes via the daily result screen.
  if (game.mode === 'daily') {
    recordDailyAttempt(game.score);
    game.dailyResultScore = game.score;
    game.dailyResultShareCopied = 0;
    game.state = State.DAILY_RESULT;
    return;
  }

  // Per-level score: only the points earned on THIS stage (including the
  // clear bonuses above). Medals and per-level bests use this delta so a
  // level's medal means the same thing whether it was reached mid-run or
  // replayed directly from level select.
  const levelScore = game.score - game.levelScoreStart;

  const L = LEVELS[game.levelIndex];
  if (L && game.mode === 'tour') {
    const cur = Storage.data.bestTour[L.id] || 0;
    const improvedExisting = cur > 0 && levelScore > cur;
    if (levelScore > cur) Storage.data.bestTour[L.id] = levelScore;
    const newTier = medalFor(levelScore, L.targetScore);
    const prevTier = Storage.data.medals[L.id] || 0;
    if (newTier > prevTier) Storage.data.medals[L.id] = newTier;
    game.unlockedLevel = Math.max(game.unlockedLevel, game.levelIndex + 1);
    Storage.data.unlockedLevel = game.unlockedLevel;
    Storage.save();
    if (newTier > 0) advanceMissions('medal', 1);
    if (improvedExisting) advanceMissions('score_improve', 1);
    if (newTier > 0) {
      const tierName = (['bronze', 'silver', 'gold'] as const)[newTier - 1];
      const upgrade = newTier > prevTier;
      if (upgrade) AudioSys.sfx('stinger/new_medal_' + tierName, 0.9);
      FX.medal(
        upgrade ? 'NEW MEDAL' : 'MEDAL EARNED',
        L.name + ' — ' + tierName.toUpperCase(),
        tierName,
        '+' + total,
      );
    }
  } else if (L && game.mode === 'score_attack') {
    const cur = Storage.data.bestTour[L.id] || 0;
    if (levelScore > cur) { Storage.data.bestTour[L.id] = levelScore; Storage.save(); }
  }

  const newComboBest = game.maxCombo > game.preRunMaxCombo && game.maxCombo >= 5;
  // The summary card shows THIS stage's earnings (levelScore), not the run
  // total — that's what the medal was judged on and what "Best" refers to.
  game.summary = {
    base: levelScore - total,
    time: timeBonus, chain: chainBonus, style: styleBonus, flawless: flawlessBonus, perfect: perfectBonus,
    total: levelScore,
    best: L ? (Storage.data.bestTour[L.id] || 0) : 0,
    tricks: game.runTricks,
    newComboBest,
  };

  game.state = State.LEVEL_CLEAR;
}
