import { DASH_COOLDOWN, DASH_IFRAMES, DASH_SPEED, DASH_TIME, GROUND_Y, WALL_L, WALL_R, type WeaponType } from '../constants';
import { AudioSys } from '../systems/audio';
import { isTouchDevice, keys, keysPressed } from '../systems/input';
import { equippedPalette } from '../systems/titles';
import { clamp, rand } from '../utils';
import { Particle, Shockwave } from './particle';
import { Projectile } from './projectile';
import { drawBot, ROBOT_P2_PALETTE, ROBOT_P3_PALETTE, ROBOT_P4_PALETTE, ROBOT_MUZZLE_LOCAL_Y, type RobotPalette } from './robot';
import type { Game } from '../game';

// P1 uses the equipped/owned palette (see draw() below); P2-P4 get fixed,
// visually distinct skins so all four players are readable at a glance.
const PLAYER_PALETTES: Record<number, RobotPalette | undefined> = {
  2: ROBOT_P2_PALETTE,
  3: ROBOT_P3_PALETTE,
  4: ROBOT_P4_PALETTE,
};

// Visual scale of the treaded robot relative to its native size. Tuned so the
// bot reads at roughly the same footprint as the old humanoid (~46px tall).
// Gameplay (hitbox, walls, muzzle math) all derive from this — bump it to make
// the robot bigger/smaller without touching anything else.
const ROBOT_SCALE = 0.68;

// ---- Movement model -------------------------------------------------------
// Top speed is unchanged from the original (320 px/s) but the bot now ramps
// into and out of it over a handful of frames. That buys two things at once:
// the treads feel like they have mass, and a one-frame tap moves ~1px instead
// of ~5px, so fine positioning under a ball is actually finer than before.
const ACCEL = 4200;        // px/s² from rest toward the held direction
const TURN = 7200;         // px/s² when reversing (snappier than a cold start)
const DECEL = 5600;        // px/s² when the stick is released
// Ice: the same bot on a frozen floor. Slow to start, slower to stop.
const ICE_ACCEL = 1150;
const ICE_TURN = 1500;
const ICE_DECEL = 430;

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

// ============================ PLAYER ================================
export class Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  speed: number;
  facing: number;
  /** 1-4. Drives keyboard/gamepad input mapping and the visual palette
   *  (P1 uses the equipped/owned palette; P2-P4 get fixed distinct skins). */
  playerNum: number;
  weapon: WeaponType;
  weaponAmmo: number;
  weaponTime: number;
  shotCooldown: number;
  flameActive: boolean;
  shield: boolean;
  invuln: number;
  dead: boolean;
  respawnTimer: number;
  bob: number;
  walkAnim: number;
  /** Seconds remaining where weapons are disabled (after touching a Bird /
   *  Ball-Fish). 0 means weapons are normal. */
  weaponDisabled: number;
  // --- Dash ---
  /** Seconds of burst travel remaining (0 = not dashing). */
  dashT: number;
  dashDir: number;
  /** Seconds until the next dash is available. */
  dashCd: number;
  /** Dash invulnerability — separate from `invuln` so it doesn't trigger the
   *  respawn flicker and so the PHASE trick can tell the two apart. */
  dashIframes: number;
  /** True once this dash has already paid out a PHASE trick. */
  dashPhased: boolean;
  /** Afterimage trail: recent positions with a fading life. */
  ghosts: { x: number; life: number }[];
  ghostTimer: number;
  // --- Robot character animation state (drives drawBot) ---
  /** Free-running clock for idle life (eye scan, breathe, tread shimmer). */
  animT: number;
  /** Signed accumulated travel — spins the wheels + scrolls the tread the
   *  correct way in both directions. */
  dist: number;
  /** Seconds since the cannon began firing, or <0 for "at rest". Drives the
   *  whole anticipation -> launch -> spring-recovery recoil. */
  fireT: number;
  /** Seconds since the last successful pop, or <0 for none. Drives the happy
   *  eye-squint + little hop. */
  cheerT: number;
  /** Where the eye is looking (unit-ish offsets) and how scared it is. */
  lookX: number;
  lookY: number;
  fear: number;
  /** Seconds since death, for the knockout tumble. <0 when alive. */
  deathT: number;
  deathVx: number;
  constructor(x, y, playerNum = 1) {
    this.x = x; this.y = y;
    this.w = 30; this.h = 46;
    this.vx = 0;
    this.speed = 320;
    this.facing = 1;
    this.playerNum = playerNum;

    // Weapon state
    this.weapon = 'harpoon';
    this.weaponAmmo = 0;          // for limited-ammo weapons
    this.weaponTime = 0;          // for timed weapons
    this.shotCooldown = 0;
    this.flameActive = false;     // for flamethrower visuals

    // Survival
    this.shield = false;
    this.invuln = 0;              // brief i-frames after respawn
    this.dead = false;
    this.respawnTimer = 0;
    this.weaponDisabled = 0;

    this.dashT = 0;
    this.dashDir = 1;
    this.dashCd = 0;
    this.dashIframes = 0;
    this.dashPhased = false;
    this.ghosts = [];
    this.ghostTimer = 0;

    // Anim
    this.bob = 0;
    this.walkAnim = 0;
    this.animT = 0;
    this.dist = 0;
    this.fireT = -1;
    this.cheerT = -1;
    this.lookX = 0;
    this.lookY = 0;
    this.fear = 0;
    this.deathT = -1;
    this.deathVx = 0;
  }

  /** Returns the smaller-than-visual hitbox for forgiving collisions. */
  getHitbox() {
    return { x: this.x - 10, y: this.y - this.h + 6, w: 20, h: this.h - 8 };
  }

  /** True while nothing can hurt this player (respawn grace or mid-dash). */
  get untouchable() {
    return this.invuln > 0 || this.dashIframes > 0;
  }

  /** Player muzzle position - tip of the harpoon cannon. The robot's cannon is
   *  top-mounted and vertical (centered on x), so shots leave from the centre
   *  rather than offset by facing. Matches drawBot's returned muzzle at rest. */
  getMuzzle() {
    return { x: this.x, y: this.y + ROBOT_MUZZLE_LOCAL_Y * ROBOT_SCALE };
  }

  update(dt, game: Game) {
    if (this.dead) {
      if (this.deathT >= 0) this.deathT += dt;
      return;
    }

    // Input mapping:
    //   P1 = WASD/Arrows + Space, dash on Shift / S / ↓   (+ its own gamepad)
    //   P2 = J/L + I/U/K, dash on O / H                    (+ its own gamepad)
    //   P3 = its own (3rd) gamepad ONLY
    //   P4 = its own (4th) gamepad ONLY
    // P3/P4 deliberately have NO keyboard fallback: P3's natural keyboard
    // letters (A/D/W) are the exact same physical keys P1 already uses, and
    // P4's (J/L/I) are the same keys P2 uses. On a single physical keyboard
    // those pairs are indistinguishable, so reading them here would make
    // P1's/P2's own keypresses also drive P3/P4. Gating P3/P4 on their
    // dedicated Gamepad3*/Gamepad4* synthetic keys only (see
    // systems/input.ts) guarantees each requires its own physical controller.
    let left: boolean, right: boolean, shoot: boolean, dash: boolean, dashL = false, dashR = false;
    if (this.playerNum === 2) {
      left = keys.KeyJ || keys.Gamepad2Left;
      right = keys.KeyL || keys.Gamepad2Right;
      shoot = keys.KeyI || keys.KeyU || keys.KeyK || keys.Gamepad2Shoot;
      dash = keysPressed.KeyO || keysPressed.KeyH || keysPressed.Gamepad2Dash;
    } else if (this.playerNum === 3) {
      left = keys.Gamepad3Left;
      right = keys.Gamepad3Right;
      shoot = keys.Gamepad3Shoot;
      dash = keysPressed.Gamepad3Dash;
    } else if (this.playerNum === 4) {
      left = keys.Gamepad4Left;
      right = keys.Gamepad4Right;
      shoot = keys.Gamepad4Shoot;
      dash = keysPressed.Gamepad4Dash;
    } else {
      left = keys.KeyA || keys.ArrowLeft;
      right = keys.KeyD || keys.ArrowRight;
      shoot = keys.Space || keys.KeyW || keys.ArrowUp;
      dash = keysPressed.ShiftLeft || keysPressed.ShiftRight || keysPressed.KeyS
        || keysPressed.ArrowDown || keysPressed.GamepadDash;
      // Touch: a double-tap on a movement zone dashes that way.
      dashL = !!keysPressed.DashLeft;
      dashR = !!keysPressed.DashRight;
    }

    // Slime puddles are sticky.
    let inSlime = false;
    for (const h of game.hazards) {
      if (h.type === 'slime' && this.x > h.x && this.x < h.x + h.w && Math.abs(this.y - h.y) < 24) inSlime = true;
    }
    const speedMul = inSlime ? 0.45 : 1;
    const dir = left && !right ? -1 : right && !left ? 1 : 0;
    if (dir !== 0) this.facing = dir;

    // ---- Dash ----
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashIframes > 0) this.dashIframes -= dt;
    if ((dash || dashL || dashR) && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashDir = dashL ? -1 : dashR ? 1 : (dir || this.facing);
      this.facing = this.dashDir;
      this.dashT = DASH_TIME;
      this.dashCd = DASH_COOLDOWN;
      this.dashIframes = DASH_IFRAMES;
      this.dashPhased = false;
      this.ghostTimer = 0;
      game.runDashes++;
      AudioSys.dash();
      for (let i = 0; i < 7; i++) {
        game.particles.push(new Particle(this.x - this.dashDir * 8, GROUND_Y - rand(2, 10),
          -this.dashDir * rand(60, 220), rand(-90, -10), rand(0.25, 0.45), '#e8dcc0', 5, 160, 2));
      }
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * DASH_SPEED * (inSlime ? 0.7 : 1);
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghosts.push({ x: this.x, life: 0.22 });
        this.ghostTimer = 0.028;
      }
      if (this.dashT <= 0) this.vx = this.dashDir * this.speed;   // hand momentum back to the treads
    } else {
      const ice = game.iceFloor;
      const target = dir * this.speed * speedMul;
      const reversing = dir !== 0 && this.vx !== 0 && Math.sign(this.vx) !== dir;
      const rate = dir === 0 ? (ice ? ICE_DECEL : DECEL) : reversing ? (ice ? ICE_TURN : TURN) : (ice ? ICE_ACCEL : ACCEL);
      this.vx = approach(this.vx, target, rate * dt);
    }
    for (const g of this.ghosts) g.life -= dt;
    if (this.ghosts.length && this.ghosts[0].life <= 0) this.ghosts.shift();

    this.x += this.vx * dt;
    const minX = WALL_L + this.w / 2, maxX = WALL_R - this.w / 2;
    if (this.x < minX) { this.x = minX; if (this.vx < 0) this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; if (this.vx > 0) this.vx = 0; }

    // Walk + idle animation. Walking advances faster and bigger; standing
    // still adds a tiny breathing motion so the character feels alive.
    if (Math.abs(this.vx) > 20) {
      this.walkAnim += dt * 12;
      this.bob = Math.sin(this.walkAnim) * 2;
    } else {
      this.walkAnim += dt * 2.2;
      this.bob = Math.sin(this.walkAnim) * 0.6;
    }
    // Ice skid spray: sliding with no input (or against it) kicks up frost.
    if (game.iceFloor && Math.abs(this.vx) > 120 && (dir === 0 || Math.sign(this.vx) !== dir) && Math.random() < 0.5) {
      game.particles.push(new Particle(this.x - Math.sign(this.vx) * 10, GROUND_Y - 3,
        -Math.sign(this.vx) * rand(20, 90), rand(-70, -20), rand(0.2, 0.4), '#dff4ff', 4, 200));
    }

    // Robot animation clocks. dist is SIGNED so the tread + wheels roll the
    // correct way when moving left vs right.
    this.animT += dt;
    this.dist += this.vx * dt;

    // Threat awareness — the eye tracks the most dangerous nearby ball.
    let bestD = Infinity, tx = 0, ty = 0;
    for (const b of game.balls) {
      if (b.dead) continue;
      const dx = b.x - this.x, dy = b.y - (this.y - 30);
      const d = Math.hypot(dx, dy) - b.r;
      if (d < bestD) { bestD = d; tx = dx; ty = dy; }
    }
    if (bestD < 320) {
      const n = Math.hypot(tx, ty) || 1;
      this.lookX += (tx / n - this.lookX) * Math.min(1, dt * 10);
      this.lookY += (ty / n - this.lookY) * Math.min(1, dt * 10);
      const fearTarget = clamp(1 - (bestD - 14) / 70, 0, 1);
      this.fear += (fearTarget - this.fear) * Math.min(1, dt * 12);
    } else {
      this.lookX *= 1 - Math.min(1, dt * 4);
      this.lookY *= 1 - Math.min(1, dt * 4);
      this.fear *= 1 - Math.min(1, dt * 6);
    }

    // Lava damage
    if (!this.untouchable) {
      for (const h of game.hazards) {
        if (h.type === 'lava' && !h.dead && h.life > 0.25 && this.x > h.x && this.x < h.x + h.w && Math.abs(this.y - h.y) < 28) {
          game.killPlayer(this, 'lava');
          break;
        }
      }
      if (this.dead) return;
    }

    // Weapon timers
    this.shotCooldown -= dt;
    this.invuln -= dt;
    if (this.weaponDisabled > 0) {
      this.weaponDisabled = Math.max(0, this.weaponDisabled - dt);
      if (this.weaponDisabled === 0) AudioSys.sfx('player/jam_recover', 0.6);
    }
    if (this.weaponTime > 0) {
      this.weaponTime -= dt;
      if (this.weaponTime <= 0 && this.weapon !== 'harpoon') {
        this.setWeapon('harpoon');
      }
    }

    // Shooting (blocked entirely while a Bird/Ball-Fish has disabled weapons)
    this.flameActive = false;
    if (shoot && this.weaponDisabled <= 0) {
      const cdBefore = this.shotCooldown;
      if (!this.tryPopShot(game)) this.tryShoot(game);
      // A shot actually left the barrel iff tryShoot bumped the cooldown back
      // up — that's the cue to (re)start the cannon recoil animation.
      if (this.shotCooldown > cdBefore) {
        this.fireT = 0;
        // Muzzle sparks — a few fast, short-lived embers at the cannon tip so
        // the shot reads visually, not just from the recoil + sound. Skipped
        // for the flamethrower (its continuous muzzle glow covers this).
        if (this.weapon !== 'flame') {
          const m = this.getMuzzle();
          for (let i = 0; i < 4; i++) {
            game.particles.push(new Particle(
              m.x, m.y,
              (Math.random() - 0.5) * 160, -180 - Math.random() * 180,
              0.1 + Math.random() * 0.08, i % 2 ? '#ffd60a' : '#fff', 3, 0, 0, true,
            ));
          }
        }
      }
    }

    // Advance the cannon recoil envelope + the cheer reaction.
    if (this.fireT >= 0) { this.fireT += dt; if (this.fireT > 0.62) this.fireT = -1; }
    if (this.cheerT >= 0) { this.cheerT += dt; if (this.cheerT > 0.95) this.cheerT = -1; }
  }

  /** Trigger the happy eye-squint + hop. Call on a successful pop for free
   *  emotional payoff. Never restarts a cheer already in progress, so a long
   *  chain reads as one happy bounce rather than a jitter. */
  cheer() { if (this.cheerT < 0 || this.cheerT > 0.5) this.cheerT = 0; }

  /** Fire the PopShot if the shared meter is full. With touch auto-fire the
   *  shot is held until something is actually in the firing column, so a full
   *  meter is never wasted on empty air just because the trigger is always
   *  down. Returns true if it fired. */
  tryPopShot(game: Game): boolean {
    if (!game.popShotReady || this.shotCooldown > 0) return false;
    if (isTouchDevice) {
      let lined = false;
      for (const b of game.balls) {
        if (!b.dead && Math.abs(b.x - this.x) < b.r + 8 && b.y < this.y - 40) { lined = true; break; }
      }
      if (!lined && game.boss && !game.boss.dead && game.boss.inColumn(this.x)) lined = true;
      if (!lined) return false;
    }
    const m = this.getMuzzle();
    game.projectiles.push(new Projectile(m.x, m.y, 'popshot', this));
    game.popShotReady = false;
    game.popCharge = 0;
    game.runPopShots++;
    this.shotCooldown = 0.3;
    game.shotsFired++;
    game.shake = Math.max(game.shake, 9);
    game.flash = Math.max(game.flash, 0.18);
    game.hitPause = Math.max(game.hitPause, 0.05);
    game.shockwaves.push(new Shockwave(m.x, m.y, 110, '#fff3b0', 0.35));
    AudioSys.popshotFire();
    return true;
  }

  tryShoot(game: Game) {
    const m = this.getMuzzle();
    const count = (type: string) => {
      let n = 0;
      for (const p of game.projectiles) if (p.owner === this && p.type === type && !p.dead) n++;
      return n;
    };
    const fired = (cooldown: number) => {
      this.shotCooldown = cooldown;
      game.shotsFired++;
      AudioSys.weaponFire(this.weapon);
    };
    const spend = () => {
      this.weaponAmmo--;
      if (this.weaponAmmo <= 0) this.setWeapon('harpoon');
    };
    if (this.shotCooldown > 0) { if (this.weapon === 'flame') this.flameActive = true; return; }
    switch (this.weapon) {
      case 'harpoon':
        // Single-active-shot rule: the wire must retract before the next shot.
        if (count('harpoon') < 1) { game.projectiles.push(new Projectile(m.x, m.y, 'harpoon', this)); fired(0.08); }
        break;
      case 'double':
        // Twin Harpoon — two wires may be out at once. Rate, not reach.
        if (count('harpoon') < 2) { game.projectiles.push(new Projectile(m.x, m.y, 'harpoon', this)); fired(0.05); }
        break;
      case 'triple':
        // Trident — one volley of three parallel wires. Width, not rate: it
        // forgives sloppy positioning but only one volley flies at a time.
        if (count('harpoon') < 1) {
          for (const off of [-30, 0, 30]) {
            const px = clamp(m.x + off, WALL_L + 4, WALL_R - 4);
            game.projectiles.push(new Projectile(px, m.y, 'harpoon', this));
          }
          fired(0.1);
        }
        break;
      case 'powerwire':
        // Power Wire — anchors to the ceiling and waits. Two may coexist.
        if (count('grapple') < 2) { game.projectiles.push(new Projectile(m.x, m.y, 'grapple', this)); fired(0.18); spend(); }
        break;
      case 'diagonal': {
        // Split Bolts — a mirrored pair at 45°, each good for one wall bounce.
        const k = Math.SQRT1_2;
        game.projectiles.push(new Projectile(m.x, m.y, 'diagonal', this, -k, -k));
        game.projectiles.push(new Projectile(m.x, m.y, 'diagonal', this,  k, -k));
        fired(0.22); spend();
        break;
      }
      case 'machinegun':
        game.projectiles.push(new Projectile(m.x + rand(-2, 2), m.y, 'bullet', this));
        fired(0.07); spend();
        break;
      case 'laser':
        game.projectiles.push(new Projectile(m.x, m.y, 'laser', this));
        game.flash = Math.max(game.flash, 0.08);
        fired(0.42); spend();
        break;
      case 'flame':
        this.flameActive = true;
        game.projectiles.push(new Projectile(m.x, m.y, 'flame', this));
        this.shotCooldown = 0.03;
        AudioSys.sfx('weapon/flame_loop', 0.35, 420) || AudioSys.weaponFire('flame');
        spend();
        break;
      case 'shotgun':
        for (let i = -2; i <= 2; i++) {
          const p = new Projectile(m.x, m.y, 'pellet', this);
          p.vx = i * 130;
          p.vy = -900 + Math.abs(i) * 40;
          game.projectiles.push(p);
        }
        game.shake = Math.max(game.shake, 3);
        fired(0.32); spend();
        break;
      case 'shuriken':
        game.projectiles.push(new Projectile(m.x, m.y, 'shuriken', this));
        fired(0.3); spend();
        break;
      case 'bomb':
        game.projectiles.push(new Projectile(m.x, m.y, 'bomb', this));
        fired(0.55); spend();
        break;
    }
  }

  setWeapon(name) {
    this.weapon = name;
    switch (name) {
      case 'harpoon':    this.weaponTime = 0; this.weaponAmmo = 0; break;
      case 'double':     this.weaponTime = 14; this.weaponAmmo = 0; break;
      case 'triple':     this.weaponTime = 12; this.weaponAmmo = 0; break;
      case 'powerwire':  this.weaponTime = 0; this.weaponAmmo = 8;  break;   // fixed wires per pickup
      case 'diagonal':   this.weaponTime = 0; this.weaponAmmo = 14; break;   // paired bolts
      case 'machinegun': this.weaponTime = 0; this.weaponAmmo = 60; break;
      case 'laser':      this.weaponTime = 0; this.weaponAmmo = 10; break;
      case 'flame':      this.weaponTime = 0; this.weaponAmmo = 90; break;
      case 'shotgun':    this.weaponTime = 0; this.weaponAmmo = 8;  break;
      case 'shuriken':   this.weaponTime = 0; this.weaponAmmo = 8;  break;
      case 'bomb':       this.weaponTime = 0; this.weaponAmmo = 5;  break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, game?: Game) {
    const pal = PLAYER_PALETTES[this.playerNum] || equippedPalette().colors;
    if (this.dead) {
      // Knockout tumble: the bot is punted into the air, spins, and drops off
      // the bottom of the screen. Slapstick, quick, and it tells the player
      // exactly where they were when it happened.
      if (this.deathT < 0 || this.deathT > 1.3) return;
      const t = this.deathT;
      const px = this.x + this.deathVx * t;
      const py = this.y - 24 - 420 * t + 760 * t * t;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 9 * (this.deathVx < 0 ? -1 : 1));
      drawBot(ctx, 0, 24, { facing: this.facing, t: this.animT, vx: 0, dist: this.dist, fireT: -1, cheerT: -1, pal, scale: ROBOT_SCALE, fear: 1, lookX: 0, lookY: -1, alpha: clamp(1.3 - t, 0, 1) });
      ctx.restore();
      return;
    }

    const x = this.x, y = this.y + this.bob;
    // Dash afterimages — fading silhouettes strung out behind the burst.
    for (const g of this.ghosts) {
      if (g.life <= 0) continue;
      drawBot(ctx, g.x, this.y, { facing: this.facing, t: this.animT, vx: this.dashDir * 400, dist: this.dist, fireT: -1, cheerT: -1, pal, scale: ROBOT_SCALE, alpha: (g.life / 0.22) * 0.34 });
      ctx.globalAlpha = 1;
    }
    // Respawn grace: the bot pulses translucent (never fully hidden — the
    // player must always be able to find themselves, above all in the first
    // second of a stage). A dash stays fully opaque.
    const ghosted = this.invuln > 0 && this.dashIframes <= 0 && Math.floor(this.invuln * 12) % 2 === 0;

    // PopShot charged: a golden corona around the cannon, so a full meter is
    // readable without looking at the HUD.
    const ready = !!game?.popShotReady;
    if (ready) {
      const m = this.getMuzzle();
      const pulse = 0.5 + Math.sin(this.animT * 12) * 0.5;
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(m.x, m.y + 4, 12 + pulse * 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // drawBot draws its own shadow + harpoon cannon; the status overlays
    // (shield / stun / flame) below sit on top of it.
    drawBot(ctx, this.x, this.y, {
      facing: this.facing, t: this.animT, vx: this.vx, dist: this.dist,
      fireT: this.fireT, cheerT: this.cheerT,
      pal, scale: ROBOT_SCALE,
      lookX: this.lookX, lookY: this.lookY, fear: this.fear,
      alpha: ghosted ? 0.45 : 1,
    });
    ctx.globalAlpha = 1;

    // Charge + dash gauge — a thin arc under the treads. Gold segment is the
    // PopShot meter; the cyan pip below it is the dash (dim while recharging).
    if (game) {
      const gy = GROUND_Y + 9;
      const k = clamp(game.popCharge / 100, 0, 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(10,24,50,0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - 20, gy); ctx.lineTo(x + 20, gy); ctx.stroke();
      if (k > 0.01) {
        ctx.strokeStyle = ready ? (Math.sin(this.animT * 16) > 0 ? '#ffffff' : '#ffd60a') : '#ffd60a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 20, gy); ctx.lineTo(x - 20 + 40 * k, gy); ctx.stroke();
      }
      const dk = clamp(1 - this.dashCd / DASH_COOLDOWN, 0, 1);
      ctx.strokeStyle = dk >= 1 ? '#9be7ff' : 'rgba(155,231,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, gy + 6); ctx.lineTo(x - 9 + 18 * dk, gy + 6); ctx.stroke();
    }

    // Shield aura — sized to wrap the wider robot hull.
    if (this.shield) {
      ctx.strokeStyle = `hsla(${(performance.now() / 6) % 360}, 100%, 70%, 0.8)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 26, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,190,255,0.12)';
      ctx.fill();
    }

    // Bird-stun: spinning star indicator above the cannon while weapons are
    // locked. Telegraphs to the player exactly why their shots aren't coming out.
    if (this.weaponDisabled > 0) {
      const t = performance.now() / 200;
      ctx.save();
      ctx.translate(x, y - 60);
      ctx.rotate(t);
      ctx.fillStyle = '#ffd60a';
      ctx.strokeStyle = '#5b3500';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const r = i % 2 === 0 ? 7 : 3;
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Muzzle flash — a two-frame bloom right after a shot leaves the barrel.
    if (this.fireT >= 0 && this.fireT < 0.07) {
      const m = this.getMuzzle();
      const k = 1 - this.fireT / 0.07;
      ctx.globalAlpha = 0.75 * k;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(m.x, m.y - 2, 4 + k * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4 * k;
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(m.x, m.y - 2, 8 + k * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Flame muzzle visual (additional flair beyond the projectiles)
    if (this.flameActive) {
      const m = this.getMuzzle();
      ctx.fillStyle = '#ffeb3b';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 6, 8 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
