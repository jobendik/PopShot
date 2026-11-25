import { BALL_BOUNCE, BALL_COLORS, BALL_HSPEED, BALL_RADIUS, CEILING_Y, GROUND_Y, GRAVITY, HEX_BOUNCE_MULT, HEX_HSPEED_MULT, WALL_L, WALL_R, type BallType, type PickupType } from '../constants';
import { AudioSys } from '../systems/audio';
import { gchance, gpick, grand, grand01 } from '../systems/rng';
import { clamp, collideCircleRect, rand, sweepHitsRect } from '../utils';
import { Hazard } from './hazard';
import { Particle, Shockwave, SmokeCloud } from './particle';
import { Pickup } from './pickup';
import { INK, displayFont } from '../rendering/theme';
import type { Game } from '../game';

/** Blast radius of an explosive ball by size tier. The lethal zone for the
 *  player is a smaller core (BLAST_LETHAL of this) — see detonate(). */
export const BLAST_RADIUS = [78, 96, 114, 132, 150];
export const BLAST_LETHAL = 0.58;
/** How far an electric pop can arc to a neighbour. */
export const ARC_RANGE = 165;
/** How strongly each size tier is shoved by wind (small = light). */
const WIND_FACTOR = [1.35, 1.15, 1.0, 0.85, 0.7];

let nextBallId = 1;

// ============================ BALL ==================================
export class Ball {
  id: number;
  x: number;
  y: number;
  size: number;
  r: number;
  type: BallType;
  vx: number;
  vy: number;
  dead: boolean;
  spin: number;
  armorHits: number;
  fuse: number;
  electricCharge: number;
  smokeTimer: number;
  squashTime: number;            // remaining seconds of squash-and-stretch after floor bounce
  /** Remaining seconds of the sideways squash after a wall / bumper hit. */
  wallSquash: number;
  /** Panic-mode "time-stop micro-ball" marker. In Pang's Panic Mode, exactly
   *  one tiny child in each large balloon's family tree is flagged: popping it
   *  freezes all balls for ~2 seconds. We mirror this by tagging a child
   *  during the deterministic split branch the homage requires (always the
   *  LEFT child for normal balls; right child for hexagons). */
  flashing: boolean;
  /** True when this ball is one of Panic Mode's Star/Clock bubbles — a special
   *  power-up bubble that cycles between Clock (freeze) and Star (clear)
   *  states. Drawn with a shimmering body. */
  star: boolean;
  /** Cycle timer used by Star Bubbles to alternate between Clock and Star
   *  modes (`starMode === 0` Clock, `starMode === 1` Star). Cycles slowly so
   *  the player can choose which icon to pop. */
  starMode: number;
  starCycle: number;
  /** Total floor bounces since spawn. AIR POP trick checks this — a ball
   *  popped without ever touching the floor is a satisfying skill shot. */
  floorBounces: number;
  /** Seconds since spawn. Used by AIR POP minimum-airtime rule so freshly
   *  spawned balls (which haven't had a chance to touch the floor yet) don't
   *  trivially qualify. */
  age: number;
  /** Time of the most recent wall bounce, in seconds since spawn. BANK SHOT
   *  trick checks `age - lastWallTime < ~0.35`. Negative initial value means
   *  "never bounced yet." */
  lastWallTime: number;
  /** Transient sideways drift from wind gusts and bumper kicks. Kept separate
   *  from `vx` so a ball's learnable base arc survives: the drift decays back
   *  to zero and the ball returns to its normal rhythm. */
  driftVx: number;
  /** Per-ball graze cooldown (seconds) so one near miss scores exactly once. */
  grazeCd: number;
  /** Set by a PopShot. A cascading ball's children inherit the flag and
   *  auto-pop on a short stagger, so the whole family tree bursts in a ripple. */
  cascade: boolean;
  /** Delayed auto-pop timer (cascade ripple / electric arc). <0 = inactive. */
  popFuse: number;
  /** What lit popFuse — forwarded to popBall as the pop source. */
  popFuseKind: 'cascade' | 'arc' | '';
  /** Seconds during which this ball cannot be chosen as an arc target. Fresh
   *  children are briefly grounded so a single spark can't ping-pong through
   *  one family forever. */
  arcImmune: number;
  /** Spawn pop-in animation clock (counts down). */
  bornT: number;
  /** White flash clock after a non-lethal hit (armor crack, fuse lit). */
  hitFlash: number;
  /** Bounce modifier visual: >0 superheated by a lava patch, <0 slimed. */
  surfaceFx: number;
  /** Last bumper that kicked this ball + cooldown, so a ball resting against a
   *  bumper is kicked once, not every frame. */
  bumperCd: number;
  /** Held in a boss tractor beam: physics is suspended, the boss moves it. */
  held: boolean;
  /** Consecutive generations popped without touching the floor. Drives the
   *  JUGGLE trick: this ball's parent was itself caught in the air. */
  airGen: number;
  constructor(x, y, size, type: BallType = 'normal', vx = 0, vy = 0) {
    this.id = nextBallId++;
    this.x = x; this.y = y;
    this.size = size;
    this.r = BALL_RADIUS[size];
    this.type = type;
    // Hexagons travel a touch faster as a baseline; preserves the Super Pang feel.
    const hspeed = BALL_HSPEED[size] * (type === 'hexagon' ? HEX_HSPEED_MULT : 1);
    this.vx = vx || (grand01() < 0.5 ? -1 : 1) * hspeed;
    this.vy = vy;
    this.dead = false;
    this.spin = 0;
    // Type-specific state
    // Only the big armored balls carry plating. Once one is small enough it is
    // bare, cracked steel: the plating is a problem to solve at the top of the
    // family tree, not a tax on every one of its fifteen descendants.
    this.armorHits = (type === 'armored' && size >= 2) ? 1 : 0;
    this.fuse = 0;                                   // explosive fuse
    this.electricCharge = grand(2.2, 3.6);           // electric ball discharge timer
    this.smokeTimer = 0;                             // smoke ball periodic puffs
    this.squashTime = 0;
    this.wallSquash = 0;
    this.flashing = false;
    this.star = (type === 'star');
    this.starMode = 0;
    this.starCycle = 0;
    this.floorBounces = 0;
    this.age = 0;
    this.lastWallTime = -10;
    this.driftVx = 0;
    this.grazeCd = 0;
    this.cascade = false;
    this.popFuse = -1;
    this.popFuseKind = '';
    this.arcImmune = 0;
    this.bornT = 0;
    this.hitFlash = 0;
    this.surfaceFx = 0;
    this.bumperCd = 0;
    this.held = false;
    this.airGen = 0;
  }

  /** Mark for split. Children inherit position, opposite horizontal velocities.
   *  Panic-mode "flashing micro-ball" propagation: the flashing flag travels
   *  with one child per split until it bottoms out at size-0 (so the player
   *  can actually pop it). For round balls the flag lives in the LEFT child;
   *  for hexagons it lives in the RIGHT — matching the classic Pang rule. */
  split(game) {
    this.dead = true;
    if (this.size === 0) return [];
    const childSize = this.size - 1;
    const childSpeed = BALL_HSPEED[childSize] * (this.type === 'hexagon' ? HEX_HSPEED_MULT : 1);
    const g = Math.sqrt(game?.gravityScale ?? 1);
    const childBounce = BALL_BOUNCE[childSize] * (this.type === 'hexagon' ? HEX_BOUNCE_MULT : 1) * 0.65 * g;
    const children: Ball[] = [];
    for (let i = 0; i < 2; i++) {
      const dir = i === 0 ? -1 : 1;
      const child = new Ball(
        this.x + dir * this.r * 0.25, this.y - 8,
        childSize, this.type,
        dir * childSpeed,
        -childBounce * (this.cascade ? 1.15 : 1)
      );
      child.bornT = 0.16;
      child.arcImmune = 0.55;
      child.airGen = this.floorBounces === 0 ? this.airGen + 1 : 0;
      child.driftVx = this.driftVx * 0.5;
      if (this.cascade) {
        // Ripple: each generation pops a beat after the last, the two
        // siblings a hair apart so the notes of the cascade never coincide.
        child.cascade = true;
        child.popFuse = 0.13 + i * 0.045;
        child.popFuseKind = 'cascade';
      }
      children.push(child);
    }
    if (this.flashing || (game && game.mode === 'panic')) {
      // Tag exactly one descendant per family — left for normal/elemental,
      // right for hexagons. Either propagate an existing flag or seed a new
      // one at the first split when running in Panic mode.
      const idx = this.type === 'hexagon' ? 1 : 0;
      children[idx].flashing = true;
    }
    return children;
  }

  /** Clocks that must keep running even while the world is frozen (Freeze
   *  pickup, Clock bubble): cascade ripples and arc pops are player rewards
   *  and should never be swallowed by a time-stop. */
  tickFuses(dt: number, game: Game) {
    if (this.dead) return;
    if (this.grazeCd > 0) this.grazeCd -= dt;
    if (this.arcImmune > 0) this.arcImmune -= dt;
    if (this.bornT > 0) this.bornT = Math.max(0, this.bornT - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.bumperCd > 0) this.bumperCd -= dt;
    if (this.popFuse >= 0) {
      this.popFuse -= dt;
      if (this.popFuse < 0) {
        const kind = this.popFuseKind || 'cascade';
        this.popFuseKind = '';
        game._popBall(this, { kind });
      }
    }
    if (this.type === 'explosive' && this.fuse > 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) this.detonate(game);
    }
  }

  update(dt, game: Game) {
    if (dt <= 0) return;
    // Type-specific behaviour
    if (this.type === 'electric') {
      this.electricCharge -= dt;
      if (this.electricCharge <= 0) {
        // Discharge: spawn a brief downward electric beam hazard
        game.hazards.push(new Hazard('electric_beam', this.x - 6, this.y, 12, GROUND_Y - this.y, 0.5));
        AudioSys.sfx('hazard/electric_beam', 0.5);
        this.electricCharge = grand(3.0, 4.6);
      }
    }
    if (this.type === 'smoke') {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        game.smokeClouds.push(new SmokeCloud(this.x + rand(-12, 12), this.y + rand(-8, 8), rand(26, 44), 2.8));
        this.smokeTimer = 0.45;
      }
    }
    if (this.type === 'star' || this.star) {
      // Cycle between Clock (mode 0, ~freeze) and Star (mode 1, ~clear).
      // Long cycle (~3 s per face) so the player can choose; matches Pang.
      this.starCycle += dt;
      if (this.starCycle > 3) {
        this.starCycle = 0;
        this.starMode = 1 - this.starMode;
        // Face-flip ping — a soft ring so the player notices the reward on
        // offer just changed without having to stare at the bubble.
        game.shockwaves.push(new Shockwave(this.x, this.y, this.r + 14, '#ffffff', 0.25));
      }
    }

    if (this.held) { this.age += dt; return; }

    // ---- Environment forces ----
    const gScale = game.gravityScale;
    const gRoot = Math.sqrt(gScale);
    let gravity = GRAVITY * gScale;
    // Wind: accelerates the transient drift, never the base arc.
    const windAx = game.wind.ax;
    if (windAx !== 0) {
      this.driftVx += windAx * WIND_FACTOR[this.size] * dt;
      this.driftVx = clamp(this.driftVx, -190, 190);
    } else if (this.driftVx !== 0) {
      this.driftVx *= Math.max(0, 1 - 1.6 * dt);
      if (Math.abs(this.driftVx) < 2) this.driftVx = 0;
    }
    // Updraft fans: a running fan lifts any ball in its column.
    for (const f of game.fans) {
      if (f.power <= 0.05) continue;
      if (this.x > f.x && this.x < f.x + f.w && this.y > f.top) {
        gravity -= f.lift * f.power * WIND_FACTOR[this.size];
        this.surfaceFx = 0;
      }
    }

    // Physics
    const prevY = this.y;
    this.vy += gravity * dt;
    if (this.vy < -720) this.vy = -720;       // fan/bumper safety cap
    this.x += (this.vx + this.driftVx) * dt;
    this.y += this.vy * dt;
    this.spin += (this.vx + this.driftVx) * dt * 0.02;
    this.age += dt;
    if (this.squashTime > 0) this.squashTime = Math.max(0, this.squashTime - dt);
    if (this.wallSquash > 0) this.wallSquash = Math.max(0, this.wallSquash - dt);
    if (this.surfaceFx !== 0) {
      this.surfaceFx += (this.surfaceFx > 0 ? -1 : 1) * dt * 1.4;
      if (Math.abs(this.surfaceFx) < 0.03) this.surfaceFx = 0;
    }

    // Floor: arcade-consistent bounce (constant peak height). Hexagon balls
    // get a slight bounce-height boost AND a small horizontal-velocity jitter
    // on each bounce, so their trajectory feels jagged rather than smooth.
    if (this.y + this.r >= GROUND_Y) {
      this.y = GROUND_Y - this.r;
      let bounceMult = (this.type === 'hexagon' ? HEX_BOUNCE_MULT : 1) * gRoot;
      // Reactive floor: the patches balls leave behind change how the NEXT
      // ball bounces there. Lava superheats (higher, floatier arc); slime is
      // sticky (a low, fast, dangerous hop). Both are visible on the floor
      // before the ball lands, so the altered arc is readable in advance.
      // (The tiniest balls are too light to be affected — a low-hopping
      // size-0 ball would be nearly impossible to run under.)
      const patch = this.size >= 1 ? floorPatchAt(game, this.x) : null;
      if (patch === 'lava') { bounceMult *= 1.2; this.surfaceFx = 1; }
      else if (patch === 'slime') { bounceMult *= 0.78; this.surfaceFx = -1; }
      this.vy = -BALL_BOUNCE[this.size] * bounceMult;
      if (this.type === 'hexagon') {
        // Tiny direction jitter — never enough to flip sign, just enough to
        // disrupt clean prediction. Caps protect us from runaway speeds.
        this.vx *= (1 + grand(-0.06, 0.06));
        const cap = BALL_HSPEED[this.size] * HEX_HSPEED_MULT * 1.3;
        this.vx = clamp(this.vx, -cap, cap);
      }
      this.squashTime = 0.18;
      this.floorBounces++;
      AudioSys.bounce(this.size);
      // Lava ball drips on bounce — big balls often, small ones rarely, the
      // tiniest never, so a split family doesn't carpet the whole floor.
      const drip = [0, 0.28, 0.45, 0.6, 0.6][this.size];
      if (this.type === 'lava' && gchance(drip)) {
        game.hazards.push(new Hazard('lava', this.x - 18, GROUND_Y - 4, 36, 8, 3.5));
        AudioSys.sfx('hazard/lava_drop', 0.35);
      }
      // Sludge drops slime
      if (this.type === 'sludge' && gchance(drip * 0.85)) {
        game.hazards.push(new Hazard('slime', this.x - 22, GROUND_Y - 4, 44, 8, 4));
        AudioSys.sfx('hazard/slime_drop', 0.35);
      }
    }

    // Walls
    if (this.x - this.r <= WALL_L) { this.x = WALL_L + this.r; this.vx = Math.abs(this.vx); this.driftVx = Math.abs(this.driftVx) * 0.5; this.onWall(); }
    else if (this.x + this.r >= WALL_R) { this.x = WALL_R - this.r; this.vx = -Math.abs(this.vx); this.driftVx = -Math.abs(this.driftVx) * 0.5; this.onWall(); }

    // Ceiling
    if (this.y - this.r <= CEILING_Y) {
      this.y = CEILING_Y + this.r;
      if (this.vy < 0) this.vy = -this.vy * 0.8;
    }

    // Platforms - circle vs rect
    for (const p of game.platforms) {
      const c = collideCircleRect(this.x, this.y, this.r, p.x, p.y, p.w, p.h);
      if (c) {
        this.x += c.nx * c.depth;
        this.y += c.ny * c.depth;
        if (Math.abs(c.ny) > Math.abs(c.nx)) {
          // Vertical collision: arcade bounce
          if (c.ny < 0) { this.vy = -BALL_BOUNCE[this.size] * gRoot; this.squashTime = 0.14; AudioSys.bounceSoft('platform'); }
          else          { this.vy = Math.abs(this.vy) * 0.7; }
        } else {
          this.vx = c.nx * Math.abs(this.vx);
          this.wallSquash = 0.14;
        }
      } else if (this.x + this.r >= p.x && this.x - this.r <= p.x + p.w
                 && sweepHitsRect(this.x, prevY, this.y, this.r, p.x, p.y, p.w, p.h)) {
        // Swept fallback: a fast-moving (or lag-spiked) ball can clear a thin
        // platform's whole vertical span within one physics step, so the
        // end-of-frame circle check above never overlaps it. Resolve the
        // crossing using the ball's direction of travel so it still bounces
        // off the platform instead of tunnelling through.
        if (prevY < p.y) {
          // Was above, ended below/past — snap to the top surface.
          this.y = p.y - this.r;
          this.vy = -BALL_BOUNCE[this.size] * (this.type === 'hexagon' ? HEX_BOUNCE_MULT : 1) * gRoot;
        } else {
          // Was below, ended above/past — snap to the underside.
          this.y = p.y + p.h + this.r;
          this.vy = Math.abs(this.vy) * 0.7;
        }
      }
    }

    // Destructibles (also bouncy)
    for (const d of game.destructibles) {
      if (d.dead) continue;
      const c = collideCircleRect(this.x, this.y, this.r, d.x, d.y, d.w, d.h);
      if (c) {
        this.x += c.nx * c.depth;
        this.y += c.ny * c.depth;
        if (Math.abs(c.ny) > Math.abs(c.nx)) {
          if (c.ny < 0) this.vy = -BALL_BOUNCE[this.size] * gRoot;
          else this.vy = Math.abs(this.vy) * 0.7;
        } else this.vx = c.nx * Math.abs(this.vx);
      }
    }

    // Pinball bumpers: a bumper throws the ball away along the contact normal.
    // The base horizontal speed is preserved (only its sign can flip), so the
    // ball leaves on a fresh but still learnable arc; the kick itself rides
    // on the decaying drift channel.
    for (const bm of game.bumpers) {
      const dx = this.x - bm.x, dy = this.y - bm.y;
      const rr = this.r + bm.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d, ny = dy / d;
      this.x = bm.x + nx * rr;
      this.y = bm.y + ny * rr;
      if (this.bumperCd > 0) continue;
      this.bumperCd = 0.12;
      if (Math.abs(nx) > 0.25) this.vx = Math.sign(nx) * Math.abs(this.vx);
      this.driftVx = clamp(this.driftVx + nx * 150, -190, 190);
      // Upward hits launch to the ball's own natural bounce height so the
      // rhythm it returns to is the one the player already knows.
      this.vy = ny < 0.2
        ? -BALL_BOUNCE[this.size] * gRoot * (0.72 + 0.28 * -Math.min(0, ny))
        : Math.max(this.vy, 260 * ny);
      this.wallSquash = 0.16;
      this.lastWallTime = this.age;
      bm.kick(game, this);
    }

    // Numerical safety net — a ball must never leave the arena or go NaN.
    if (!(this.x === this.x) || !(this.y === this.y) || !(this.vx === this.vx) || !(this.vy === this.vy)) {
      this.x = clamp(this.x || 480, WALL_L + this.r, WALL_R - this.r);
      this.y = CEILING_Y + this.r + 20;
      this.vx = BALL_HSPEED[this.size]; this.vy = 0; this.driftVx = 0;
    }
    if (this.y - this.r > GROUND_Y + 4) { this.y = GROUND_Y - this.r; this.vy = -BALL_BOUNCE[this.size]; }
  }

  private onWall() {
    this.lastWallTime = this.age;
    this.wallSquash = 0.16;
    AudioSys.bounceSoft('wall');
  }

  /** Explosive balls never split: once lit they blow, popping every ball in
   *  range, shoving the ones just outside it, clearing smoke — and knocking out
   *  a player standing inside the hot core. The fuse ring drawn while lit shows
   *  both radii, so "shoot it, then get clear" is always a readable decision. */
  detonate(game: Game) {
    if (this.dead) return;
    this.dead = true;
    this.fuse = 0;
    const blastR = BLAST_RADIUS[this.size];
    AudioSys.explode(this.size >= 2);
    game.flash = Math.max(game.flash, 0.2);
    game.shake = Math.max(game.shake, 8 + this.size * 2);
    game.hitPause = Math.max(game.hitPause, 0.07);
    game.creditPop(this, { kind: 'blast' });
    game.shockwaves.push(new Shockwave(this.x, this.y, blastR, '#ffb347', 0.4));
    game.shockwaves.push(new Shockwave(this.x, this.y, blastR * 0.55, '#ffffff', 0.25));
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(160, 460);
      game.particles.push(new Particle(this.x, this.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.6), i % 3 ? '#ff7733' : '#ffd60a', 7, 120, 3.2, i % 2 === 0));
    }
    // Chain: pop balls in range, light other explosives, shove the rest.
    const pushR = blastR + 120;
    for (const b of game.balls) {
      if (b === this || b.dead) continue;
      const dx = b.x - this.x, dy = b.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < blastR + b.r * 0.5) {
        if (b.type === 'explosive') { if (b.fuse <= 0 || b.fuse > 0.16) b.fuse = 0.16; b.hitFlash = 0.16; }
        else game._popBall(b, { kind: 'blast' });
      } else if (d < pushR) {
        const k = 1 - (d - blastR) / 120;
        b.driftVx = clamp(b.driftVx + (dx / (d || 1)) * 170 * k, -190, 190);
        if (dy < 0) b.vy -= 160 * k;
      }
    }
    // Smoke is blown clear of the blast.
    for (const sc of game.smokeClouds) {
      if (Math.hypot(sc.x - this.x, sc.y - this.y) < blastR + 40) sc.life = Math.min(sc.life, 0.25);
    }
    // Crates in range break open.
    for (const d of game.destructibles) {
      if (d.dead) continue;
      if (Math.hypot(d.x + d.w / 2 - this.x, d.y + d.h / 2 - this.y) < blastR) game.breakCrate(d);
    }
    // Bosses take real damage from a blast — for some it is the only way in.
    if (game.boss && !game.boss.dead) game.boss.onBlast(game, this.x, this.y, blastR);
    // The hot core is lethal to players caught inside it.
    const lethal = blastR * BLAST_LETHAL;
    for (const p of game.getLivingPlayers()) {
      if (Math.hypot(p.x - this.x, (p.y - 22) - this.y) < lethal) game.killPlayer(p, 'blast');
    }
  }

  /** Apply a hit. Returns array of new child balls created (possibly empty),
   *  or null when the ball survived the hit (armor cracked / fuse lit). */
  hit(game: Game, source) {
    const forced = source?.kind === 'cascade' || source?.type === 'popshot';
    if (this.type === 'armored' && this.armorHits > 0 && !forced) {
      this.armorHits--;
      this.hitFlash = 0.14;
      AudioSys.sfx('pop/flourish_armored_crack', 0.7) || AudioSys.bossHit();
      // Armor-break clang: spark spray + a small ring so the "that hit
      // counted" beat is unmissable — the cross-strap also disappears.
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(120, 300);
        game.particles.push(new Particle(this.x, this.y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.2, 0.4), i % 2 ? '#fff' : '#c7ccd1', 5, 160, 2, true));
      }
      game.shockwaves.push(new Shockwave(this.x, this.y, this.r + 18, '#ffffff', 0.22));
      return null; // not destroyed
    }
    if (this.type === 'explosive') {
      if (forced) { this.detonate(game); return null; }
      // First hit lights the fuse; anything after that just hurries it along.
      if (this.fuse <= 0) {
        this.fuse = source?.kind === 'arc' ? 0.2 : 0.7;
        this.hitFlash = 0.16;
        AudioSys.fuseLit();
      }
      return null;
    }
    if (this.type === 'smoke') {
      for (let i = 0; i < 3; i++) game.smokeClouds.push(new SmokeCloud(this.x + rand(-18, 18), this.y + rand(-12, 12), rand(32, 52), 3.4));
    }
    if (this.type === 'bonus') {
      // Drop a random pickup
      if (game.modifier !== 'no_pickups') game.pickups.push(new Pickup(this.x, this.y, randomPickupType()));
    }
    return this.split(game);
  }

  draw(ctx: CanvasRenderingContext2D, t = 0, frozen = false) {
    const c = BALL_COLORS[this.type] || BALL_COLORS.normal;
    const r = this.r;
    // Shadow — alpha and width scale with how close the ball is to the floor,
    // giving the player a strong trajectory cue without obscuring the world.
    const altitude = clamp(GROUND_Y - (this.y + r), 0, 400);
    const shadowAlpha = 0.32 * (1 - altitude / 400) + 0.06;
    const shadowRX = r * (0.75 - altitude / 700);
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(this.x, GROUND_Y + 2, Math.max(6, shadowRX), 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Deformation: impact squash + velocity stretch + spawn pop-in ----
    // The ball is drawn at unit scale and the context is scaled, so every
    // overlay (cracks, icons, highlights) deforms with the body for free.
    const sqz = this.squashTime / 0.18;
    const wsq = this.wallSquash / 0.16;
    const speedStretch = Math.min(0.05, Math.abs(this.vy) / 12000);
    let sx = (1 + sqz * 0.2) * (1 - wsq * 0.12) * (1 - speedStretch);
    let sy = (1 - sqz * 0.18) * (1 + wsq * 0.1) * (1 + speedStretch);
    if (this.bornT > 0) {
      // Children tear out of the parent: start small, overshoot, settle.
      const k = 1 - this.bornT / 0.16;
      const pop = 0.55 + 0.45 * k + Math.sin(k * Math.PI) * 0.18;
      sx *= pop; sy *= pop;
    }
    const cy = this.y + r * (1 - sy) * sqz;         // keep the base planted while squashed
    const isHex = this.type === 'hexagon';

    // Heat / slime aura from a reactive floor patch (drawn unscaled, behind).
    if (this.surfaceFx !== 0) {
      const k = Math.abs(this.surfaceFx);
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = this.surfaceFx > 0 ? '#ff9a3c' : '#9be15d';
      ctx.beginPath(); ctx.arc(this.x, cy, r + 5 + k * 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // PopShot mark — a golden corona on balls that are about to cascade.
    if (this.cascade) {
      const pulse = 0.5 + Math.sin(t * 40 + this.id) * 0.5;
      ctx.globalAlpha = 0.5 + pulse * 0.4;
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, cy, r + 3 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.type === 'smoke') {
      // Wispy outer halo — three soft rings of decreasing alpha to fake a
      // diffuse, smoke-cloaked edge without using filters.
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.12 - i * 0.03;
        ctx.fillStyle = '#aab0b8';
        ctx.beginPath();
        ctx.arc(this.x + Math.sin(t * 2 + i * 2) * 2, cy + Math.cos(t * 1.7 + i) * 2, r + 3 + i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (this.type === 'lava') {
      // Heat glow — a breathing ember halo so lava reads as HOT at a glance.
      const breathe = 0.5 + Math.sin(t * 5 + this.id) * 0.5;
      ctx.globalAlpha = 0.16 + breathe * 0.1;
      ctx.fillStyle = '#ff7b1c';
      ctx.beginPath(); ctx.arc(this.x, cy, r + 5 + breathe * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(this.x, cy);
    ctx.scale(sx, sy);

    // Body — full-radius radial gradient. Top-left light source.
    const grad = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r);
    grad.addColorStop(0,    '#fff');
    grad.addColorStop(0.18, c[0]);
    grad.addColorStop(0.85, c[1]);
    grad.addColorStop(1,    c[1]);
    ctx.fillStyle = grad;
    const rot = this.spin * 0.6;
    if (isHex) {
      // Six-sided polygon, rotating with horizontal travel. Jagged
      // silhouette reads instantly as different physics.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Facets: spokes from the centre to each vertex + a lit top wedge.
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      // Re-trace the outline, shade the lower faces, and leave the path
      // current for the outline stroke below.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const hexShade = ctx.createLinearGradient(0, -r * 0.2, 0, r);
      hexShade.addColorStop(0, 'rgba(0,0,0,0)');
      hexShade.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = hexShade;
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // Inner shadow ring — soft dark crescent on the bottom-right, sells
      // volume. Skip for hex (its facets already convey depth).
      const innerGrad = ctx.createRadialGradient(r * 0.3, r * 0.4, r * 0.3, r * 0.3, r * 0.4, r);
      innerGrad.addColorStop(0, 'rgba(0,0,0,0)');
      innerGrad.addColorStop(0.8, 'rgba(0,0,0,0)');
      innerGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = innerGrad;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // Rolling surface marks — two soft blobs that orbit with the ball's
      // spin. They make travel direction and speed readable from the body
      // itself, and keep big balls from looking like static stickers.
      if (this.type === 'normal' || this.type === 'sludge' || this.type === 'bonus' || this.type === 'star') {
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        for (let i = 0; i < 2; i++) {
          const a = rot * 1.6 + i * Math.PI;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.24, r * 0.16, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    // Outline — dark tone of the ball's own palette so each ball "owns" its
    // silhouette.
    ctx.strokeStyle = c[1];
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ---------- Per-type material ----------
    if (this.type === 'lava') {
      // Magma crust: glowing fissures that rotate with the ball and pulse.
      const glow = 0.55 + Math.sin(t * 6 + this.id * 1.3) * 0.25;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? `rgba(90,10,10,0.55)` : `rgba(255,214,90,${glow.toFixed(2)})`;
        ctx.lineWidth = pass === 0 ? Math.max(2, r * 0.13) : Math.max(1, r * 0.05);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = rot + i * 1.65 + 0.4;
          const x1 = Math.cos(a) * r * 0.2, y1 = Math.sin(a) * r * 0.2;
          const x2 = Math.cos(a + 0.35) * r * 0.55, y2 = Math.sin(a + 0.35) * r * 0.55;
          const x3 = Math.cos(a + 0.1) * r * 0.86, y3 = Math.sin(a + 0.1) * r * 0.86;
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        }
        ctx.stroke();
      }
    } else if (this.type === 'sludge') {
      // Slime sheen + a couple of wobbling drips hanging off the underside.
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#caf580';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.15, r * 0.6, r * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c[1];
      for (let i = 0; i < 2; i++) {
        const dx = (i === 0 ? -0.38 : 0.3) * r;
        const len = r * (0.22 + 0.14 * (0.5 + Math.sin(t * 3 + i * 2 + this.id) * 0.5));
        ctx.beginPath();
        ctx.ellipse(dx, r * 0.86 + len * 0.4, r * 0.11, len, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'armored') {
      // Riveted plating. Intact: a bolted cross-strap. Cracked: the strap is
      // gone and a fracture runs across the shell — one more hit splits it.
      if (this.armorHits > 0) {
        ctx.strokeStyle = '#2a3036';
        ctx.lineWidth = Math.max(3, r * 0.2);
        ctx.beginPath();
        ctx.moveTo(-r * 0.96, 0); ctx.lineTo(r * 0.96, 0);
        ctx.moveTo(0, -r * 0.96); ctx.lineTo(0, r * 0.96);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, -r * 0.1); ctx.lineTo(r * 0.9, -r * 0.1);
        ctx.stroke();
        ctx.fillStyle = '#e9eef5';
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, Math.max(1.4, r * 0.07), 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.strokeStyle = '#20252a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, -r * 0.3); ctx.lineTo(-r * 0.3, -r * 0.05); ctx.lineTo(-r * 0.1, -r * 0.4);
        ctx.lineTo(r * 0.2, r * 0.05); ctx.lineTo(r * 0.72, -r * 0.12);
        ctx.moveTo(-r * 0.3, -r * 0.05); ctx.lineTo(-r * 0.2, r * 0.5);
        ctx.moveTo(r * 0.2, r * 0.05); ctx.lineTo(r * 0.36, r * 0.6);
        ctx.stroke();
      }
    } else if (this.type === 'explosive') {
      // Bomb core: a breathing ember when dormant, a frantic strobe when lit.
      const lit = this.fuse > 0;
      const k = lit ? (Math.floor(this.fuse * 14) % 2 === 0 ? 1 : 0.35) : 0.6 + Math.sin(t * 4 + this.id) * 0.2;
      ctx.fillStyle = lit && k === 1 ? '#fff' : '#ffd60a';
      ctx.globalAlpha = lit ? 1 : 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r * (lit ? 0.42 : 0.33) * (0.9 + k * 0.2), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(40,0,0,0.6)';
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, rot, rot + Math.PI * 1.2); ctx.stroke();
    }

    // Specular highlight — small bright "wet" dot, plus the larger soft
    // primary highlight underneath. Skip for hex (no glass-ball read).
    if (!isHex) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, -r * 0.5, r * 0.1, r * 0.07, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Fresnel rim — subtle bright crescent on the bottom-left edge.
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, Math.PI * 0.7, Math.PI * 1.15);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Type icons
    if (this.type === 'electric') {
      ctx.strokeStyle = '#fff';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, r * 0.1) + Math.sin(t * 12) * 0.6;
      const k = r / 26;
      ctx.beginPath();
      ctx.moveTo(-4 * k, -9 * k);
      ctx.lineTo(3 * k, -1.5 * k);
      ctx.lineTo(-3 * k, 1.5 * k);
      ctx.lineTo(4 * k, 9 * k);
      ctx.stroke();
    } else if (this.type === 'bonus') {
      // Brand display face (not raw sans-serif) with an ink outline so the
      // "?" reads on the bright bonus body and matches the game's text.
      ctx.font = displayFont(r * 1.15);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.strokeStyle = INK;
      ctx.strokeText('?', 0, 1);
      ctx.fillStyle = '#fff';
      ctx.fillText('?', 0, 1);
      ctx.textBaseline = 'alphabetic';
    } else if (this.type === 'star') {
      // Cycle face: 0 = clock dial (freeze), 1 = star (full clear).
      ctx.fillStyle = '#0a1832';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      if (this.starMode === 0) {
        // Clock dial — circle outline + two hands.
        ctx.strokeStyle = '#0a1832';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        const ang = (t * 3) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * r * 0.45, Math.sin(ang) * r * 0.45);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.4);
        ctx.stroke();
      } else {
        // Filled star
        ctx.fillStyle = '#ffd60a';
        ctx.strokeStyle = '#5b3500';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? r * 0.65 : r * 0.28;
          const sxp = Math.cos(ang) * rr, syp = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(sxp, syp); else ctx.lineTo(sxp, syp);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Frozen: a frosted shell + glints. Tells the player the ball is locked.
    if (frozen) {
      ctx.fillStyle = 'rgba(190,235,255,0.42)';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.2, -r * 0.5);
      ctx.moveTo(r * 0.1, r * 0.55); ctx.lineTo(r * 0.5, r * 0.2);
      ctx.stroke();
    }
    // Hit flash — a white veil over the body on a non-lethal hit.
    if (this.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, this.hitFlash / 0.14) * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ---- Unscaled overlays (rings, arcs, telegraphs) ----
    // Flashing micro-ball marker (Panic mode) — strobing white ring. Visible
    // only at size 0 since that's the ball the player must pop to trigger the
    // time-stop reward.
    if (this.flashing && this.size === 0) {
      const strobe = 0.5 + Math.abs(Math.sin(t * 14)) * 0.5;
      ctx.globalAlpha = 0.6 + strobe * 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 + strobe * 2;
      ctx.beginPath();
      ctx.arc(this.x, cy, r + 4 + strobe * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.type === 'electric') {
      // Live crackle: short arcs dancing on the surface, re-rolled ~16×/s
      // from a cheap time hash so they flicker without allocating.
      const tick = Math.floor(t * 16) + this.id * 7;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const h = Math.sin((tick + i * 31) * 12.9898) * 43758.5453;
        const a = (h - Math.floor(h)) * Math.PI * 2;
        const r1 = r * 0.96, r2 = r + 5 + (i % 2) * 4;
        ctx.moveTo(this.x + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(this.x + Math.cos(a + 0.22) * (r1 + r2) * 0.5, cy + Math.sin(a + 0.22) * (r1 + r2) * 0.5);
        ctx.lineTo(this.x + Math.cos(a + 0.05) * r2, cy + Math.sin(a + 0.05) * r2);
      }
      ctx.stroke();
      // Pre-discharge warning: the closer to 0 the charge timer is, the
      // brighter the halo, plus a dashed line showing exactly where the bolt
      // will land. Gives the player a clear "about to fire downward" cue.
      const charge = this.electricCharge;
      if (charge < 1.1) {
        const urgency = clamp(1 - charge / 1.1, 0, 1);
        const strobe = 0.5 + Math.abs(Math.sin(t * (8 + urgency * 22))) * 0.5;
        ctx.globalAlpha = 0.35 + urgency * 0.55 * strobe;
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 3 + urgency * 4;
        ctx.beginPath();
        ctx.arc(this.x, cy, r + 4 + urgency * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25 + urgency * 0.45;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(this.x, cy + r + 4); ctx.lineTo(this.x, GROUND_Y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    } else if (this.type === 'explosive' && this.fuse > 0) {
      // Lit fuse: draw both radii. Outer dashed ring = everything here pops.
      // Inner solid ring = the lethal core. Shrinks its pulse as the fuse burns.
      const blastR = BLAST_RADIUS[this.size];
      const k = clamp(this.fuse / 0.7, 0, 1);
      ctx.globalAlpha = 0.5 + (1 - k) * 0.4;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.arc(this.x, cy, blastR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, cy, blastR * BLAST_LETHAL, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.1 + (1 - k) * 0.14;
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.arc(this.x, cy, blastR * BLAST_LETHAL, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/** Which reactive patch (if any) covers floor position x. Lava wins ties. */
function floorPatchAt(game: Game, x: number): 'lava' | 'slime' | null {
  let found: 'lava' | 'slime' | null = null;
  for (const h of game.hazards) {
    if (h.dead || (h.type !== 'lava' && h.type !== 'slime')) continue;
    if (x >= h.x - 4 && x <= h.x + h.w + 4) {
      if (h.type === 'lava') return 'lava';
      found = 'slime';
    }
  }
  return found;
}

const PICKUP_POOL: PickupType[] = [
  'shield', 'double', 'triple', 'powerwire', 'diagonal',
  'machinegun', 'laser', 'flame', 'shotgun', 'shuriken', 'bomb',
  'score', 'life', 'time', 'slowtime', 'freeze', 'clearsmoke', 'magnet', 'combo', 'dynamite',
];
export function randomPickupType(): PickupType {
  return gpick(PICKUP_POOL);
}
