import { CEILING_Y, GROUND_Y, W, WALL_L, WALL_R, type BallType, type Rect } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { gchance, gpick, grand, grandi } from '../../systems/rng';
import { INK } from '../../rendering/theme';
import { clamp, rand } from '../../utils';
import { Ball } from '../ball';
import { FloatingText, Particle, Shockwave, pushText } from '../particle';
import type { Projectile } from '../projectile';
import type { Game } from '../../game';
import { Boss, circleTouchesRect, shotDamage, shotHitsCircle, type BossKind } from './base';

// ============================ COMMANDER RIFT ========================
// The finale, in three acts — each one calling back to something the Tour
// already taught:
//
//   I   HUNTER      Open hull. Shoot it. It answers with ball drops and
//                   aimed strikes. (World 1-2 fundamentals.)
//   II  FORTRESS    Shield up, exactly like VOLTA: only a blast beside it or a
//                   PopShot opens a firing window. It also starts stealing
//                   balls with a tractor beam and hurling them at you.
//   III MELTDOWN    Shield burnt out for good. It vaporises the platforms,
//                   drops low, hunts you, and tears open GRAVITY RIFTS that
//                   make every ball float.

const SHIELD_DOWN_TIME = 5.2;

export class Rift extends Boss {
  kind: BossKind = 'rift';
  name = 'COMMANDER RIFT';
  private vx = 80;
  private attackT = 2.6;
  private overload = 0;
  private bombT = 2;
  private spin = 0;
  /** Ball currently held in the tractor beam, and the throw countdown. */
  private held: Ball | null = null;
  private holdT = 0;
  private throwX = 0;
  private riftT = 0;       // seconds of low gravity remaining
  private riftCd = 9;
  private baseY = CEILING_Y + 64;

  constructor() {
    super();
    this.maxHp = 66;
    this.hp = 66;
    this.r = 60;
    this.x = W / 2;
    this.y = -100;
    this.introT = 2.8;
  }

  get shielded() { return this.phase === 2 && this.overload <= 0; }

  protected updateIntro(dt: number) {
    this.y += (this.baseY - this.y) * Math.min(1, dt * 2.2);
  }
  protected onIntroEnd() { this.y = this.baseY; }

  protected updateAlive(dt: number, game: Game) {
    this.spin += dt;
    const target = game.getLivingPlayers()[0];
    const px = target ? target.x : W / 2;

    // ---- Movement ----
    if (this.phase < 3) {
      const stun = this.overload > 0 ? 0.3 : 1;
      this.x += this.vx * stun * dt;
      if (this.x < 130) { this.x = 130; this.vx = Math.abs(this.vx); }
      if (this.x > W - 130) { this.x = W - 130; this.vx = -Math.abs(this.vx); }
    } else {
      // Meltdown: it hunts the player, but never fast enough to out-run a dash.
      const want = clamp(px, 130, W - 130);
      this.x += clamp(want - this.x, -1, 1) * 120 * dt;
    }
    const wantY = this.phase === 3 ? CEILING_Y + 104 : CEILING_Y + 64;
    this.baseY += (wantY - this.baseY) * Math.min(1, dt * 1.5);
    this.y = this.baseY + Math.sin(this.t * 1.7) * 10;

    if (this.overload > 0) this.overload -= dt;

    // ---- Gravity rift (phase III) ----
    if (this.riftT > 0) {
      this.riftT -= dt;
      game.gravityScale = 0.42;
      if (this.riftT <= 0) { game.gravityScale = game.baseGravityScale; AudioSys.sfx('boss/phase_intro', 0.5); }
    }

    // ---- Tractor beam: hold, aim, hurl ----
    if (this.held) {
      const b = this.held;
      if (b.dead) { this.held = null; }
      else {
        this.holdT -= dt;
        const tx = this.x, ty = this.y + this.r * 0.6 + b.r + 8;
        b.held = true;
        b.x += (tx - b.x) * Math.min(1, dt * 7);
        b.y += (ty - b.y) * Math.min(1, dt * 7);
        if (this.holdT > 0.45) this.throwX = px;      // aim locks for the last beat
        if (this.holdT <= 0) {
          b.held = false;
          const dx = this.throwX - b.x;
          const fall = Math.max(60, (GROUND_Y - b.r) - b.y);
          const tt = fall / 640;
          b.vx = Math.sign(dx || 1) * Math.abs(b.vx);
          b.driftVx = clamp(dx / tt - b.vx, -190, 190);
          b.vy = 640;
          this.held = null;
          AudioSys.sfx('boss/projectile_drop', 0.8) || AudioSys.beep(500, 0.2, 'sawtooth', 0.2, -300);
        }
      }
    }

    // ---- Ammunition for phase II: there must always be a way in ----
    if (this.phase === 2) {
      this.bombT -= dt;
      const bombs = game.balls.filter(b => !b.dead && b.type === 'explosive').length;
      if (this.bombT <= 0 && bombs === 0 && this.overload <= 0) {
        this.bombT = 3.4;
        const dir = gchance(0.5) ? -1 : 1;
        const b = new Ball(this.x, this.y + this.r, 3, 'explosive', dir * 115, 60);
        b.bornT = 0.16;
        game.balls.push(b);
        AudioSys.sfx('boss/spawn_ball', 0.8);
      }
    }

    // ---- Attacks ----
    this.attackT -= dt;
    if (this.attackT <= 0 && this.overload <= 0 && !this.held) {
      this.attack(game, px);
      const base = this.phase === 1 ? 3.1 : this.phase === 2 ? 3.0 : 2.2;
      this.attackT = base + grand(-0.3, 0.3);
    }
    if (this.phase === 3) {
      this.riftCd -= dt;
      if (this.riftCd <= 0 && this.riftT <= 0) {
        this.riftCd = 11;
        this.riftT = 3.6;
        AudioSys.sfx('boss/phase_intro', 0.8);
        game.flash = Math.max(game.flash, 0.2);
        pushText(game.floatingTexts, new FloatingText(W / 2, 210, 'GRAVITY RIFT', '#d9a6ff', 30), 'bosshint', 1.4);
        game.shockwaves.push(new Shockwave(this.x, this.y, 420, '#b266ff', 0.8));
      }
    }
  }

  private dropBalls(game: Game, n: number, pool: BallType[], size = 2) {
    for (let i = 0; i < n; i++) {
      if (game.balls.length >= 8) break;
      const b = new Ball(this.x + grand(-34, 34), this.y + this.r * 0.6, size, gpick(pool), grand(-1, 1) < 0 ? -140 : 140, 40);
      b.bornT = 0.16;
      game.balls.push(b);
    }
    AudioSys.sfx('boss/spawn_ball', 0.8) || AudioSys.warning();
  }

  private attack(game: Game, px: number) {
    const choices = this.phase === 1 ? [0, 0, 1] : this.phase === 2 ? [0, 1, 2, 2, 3] : [1, 3, 4, 4, 0];
    const a = gpick(choices);
    if (a === 0) {
      this.dropBalls(game, this.phase >= 2 ? 2 : 1, this.phase === 1 ? ['normal', 'normal', 'hexagon'] : ['normal', 'electric', 'hexagon', 'electric']);
    } else if (a === 1) {
      AudioSys.sfx('boss/laser_charge', 0.7) || AudioSys.warning();
      this.strikeColumn(game, px, 34, 0.7, this.y + 20);
      if (this.phase >= 2) this.after(0.3, () => this.strikeColumn(game, clamp(px + 120, WALL_L + 30, WALL_R - 30), 34, 0.65, this.y + 20));
      if (this.phase >= 3) this.after(0.6, () => this.strikeColumn(game, clamp(px - 120, WALL_L + 30, WALL_R - 30), 34, 0.6, this.y + 20));
    } else if (a === 2) {
      // Tractor: steal the biggest ordinary ball on the field.
      let pick: Ball | null = null;
      for (const b of game.balls) {
        if (b.dead || b.type === 'explosive' || b.type === 'star' || b.popFuse >= 0) continue;
        if (!pick || b.size > pick.size) pick = b;
      }
      if (pick && pick.size >= 1) {
        this.held = pick;
        this.holdT = 1.35;
        this.throwX = px;
        AudioSys.sfx('boss/warning_telegraph', 0.8) || AudioSys.warning();
      } else {
        this.dropBalls(game, 2, ['normal', 'hexagon']);
      }
    } else if (a === 3) {
      // Storm wall — bands of fire with one safe lane.
      AudioSys.sfx('boss/laser_charge', 0.8) || AudioSys.warning();
      const bands = 5;
      const bw = (WALL_R - WALL_L) / bands;
      // The dark lane is always the player's own band or a neighbour —
      // reachable on foot inside the warning, never a coin-flip across the arena.
      const pb = clamp(Math.floor((px - WALL_L) / bw), 0, bands - 1);
      const safe = clamp(pb + grandi(-1, 1), 0, bands - 1);
      for (let i = 0; i < bands; i++) {
        if (i === safe) continue;
        this.strikeColumn(game, WALL_L + bw * (i + 0.5), bw - 24, this.phase === 3 ? 1.0 : 1.15, CEILING_Y, 0.4);
      }
    } else {
      // Meltdown barrage: bolts walk across the arena.
      AudioSys.sfx('boss/laser_charge', 0.8) || AudioSys.warning();
      const dir = px < W / 2 ? -1 : 1;
      const from = dir < 0 ? WALL_R - 60 : WALL_L + 60;
      for (let i = 0; i < 7; i++) {
        const cx = from + dir * i * 125;
        if (cx < WALL_L + 20 || cx > WALL_R - 20) continue;
        this.after(i * 0.26, () => this.strikeColumn(game, cx, 42, 0.55, CEILING_Y, 0.28));
      }
      this.dropBalls(game, 1, ['normal', 'hexagon'], 2);
    }
  }

  protected onDamaged(game: Game) {
    const ratio = this.hp / this.maxHp;
    const next = ratio < 0.34 ? 3 : ratio < 0.67 ? 2 : 1;
    if (next <= this.phase) return;
    this.phase = next;
    this.attackT = 1.8;
    AudioSys.sfx('boss/phase_intro', 0.95);
    game.shake = Math.max(game.shake, 16);
    game.flash = Math.max(game.flash, 0.3);
    game.hitPause = Math.max(game.hitPause, 0.2);
    game.shockwaves.push(new Shockwave(this.x, this.y, 300, '#ff2b88', 0.6));
    if (next === 2) {
      this.vx *= 1.2;
      pushText(game.floatingTexts, new FloatingText(W / 2, 200, 'SHIELDS UP!', '#9be7ff', 30), 'bosshint', 1.8).rise = 6;
      pushText(game.floatingTexts, new FloatingText(W / 2, 230, 'burst a bomb ball beside it — or land a PopShot', '#fff', 15, 'ui'), 'bosshint2', 2.6).rise = 6;
    } else {
      // Meltdown: the platforms are vaporised.
      for (const p of game.platforms) {
        game.shockwaves.push(new Shockwave(p.x + p.w / 2, p.y, 110, '#ff2b88', 0.5));
        for (let i = 0; i < 14; i++) {
          game.particles.push(new Particle(p.x + rand(0, p.w), p.y + rand(0, p.h), rand(-200, 200), rand(-260, 60), rand(0.4, 0.8), i % 2 ? '#ff8ad0' : '#7a5a3a', 7, 600));
        }
      }
      game.platforms = [];
      AudioSys.explode(true);
      if (this.held) { this.held.held = false; this.held = null; }
      pushText(game.floatingTexts, new FloatingText(W / 2, 200, 'MELTDOWN!', '#ff2b88', 36), 'bosshint', 1.8).rise = 6;
    }
  }

  protected onDeath(game: Game) {
    game.gravityScale = game.baseGravityScale;
    if (this.held) { this.held.held = false; this.held = null; }
  }
  protected startDying(game: Game) {
    super.startDying(game);
    game.gravityScale = game.baseGravityScale;
    if (this.held) { this.held.held = false; this.held = null; }
  }

  onBlast(game: Game, x: number, y: number, radius: number) {
    if (!this.active) return;
    if (Math.hypot(this.x - x, this.y - y) > radius + this.r * 0.8) return;
    this.damage(game, 7, this.x, this.y);
    if (this.phase === 2 && this.dying < 0) this.breakShield(game);
  }

  private breakShield(game: Game) {
    this.overload = SHIELD_DOWN_TIME;
    this.attackT = Math.max(this.attackT, 1.2);
    if (this.held) { this.held.held = false; this.held = null; }
    game.shockwaves.push(new Shockwave(this.x, this.y, 170, '#9be7ff', 0.5));
    pushText(game.floatingTexts, new FloatingText(this.x, this.y + this.r + 30, 'SHIELD DOWN — FIRE!', '#ffd60a', 22), 'bosshint', 1.5).rise = 8;
  }

  hitBy(game: Game, proj: Projectile): boolean {
    if (!this.active) return false;
    const shield = this.shielded;
    const rr = shield ? this.r + 14 : this.r * 0.95;
    if (!shotHitsCircle(proj, this.x, this.y + 6, rr)) return false;
    const hy = proj.type === 'bullet' || proj.type === 'pellet' ? proj.y : this.y + rr * 0.6;
    if (proj.type === 'popshot') {
      this.damage(game, 8, proj.x, hy);
      if (this.phase === 2 && this.dying < 0) this.breakShield(game);
      return true;
    }
    if (shield) { this.noEffect(game, proj.x, hy, 'SHIELDED'); return true; }
    const dmg = shotDamage(proj.type);
    if (dmg > 0) this.damage(game, dmg, proj.x, hy);
    return true;
  }

  touches(hb: Rect): boolean {
    return this.active && circleTouchesRect(this.x, this.y + 6, this.r * 0.8, hb);
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (this.dead) return;
    const r = this.r;
    const now = t * 1000;
    // Tractor beam + throw telegraph (world space, under the saucer).
    if (this.held && !this.held.dead) {
      const b = this.held;
      const k = clamp(1 - this.holdT / 1.35, 0, 1);
      ctx.fillStyle = `rgba(178,102,255,${(0.16 + k * 0.2).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(this.x - 14, this.y + r * 0.4);
      ctx.lineTo(this.x + 14, this.y + r * 0.4);
      ctx.lineTo(b.x + b.r + 10, b.y + b.r);
      ctx.lineTo(b.x - b.r - 10, b.y + b.r);
      ctx.closePath(); ctx.fill();
      // Where it is about to be thrown.
      const pulse = 0.5 + Math.abs(Math.sin(t * 16)) * 0.5;
      ctx.strokeStyle = `rgba(255,77,109,${(0.35 + k * 0.55 * pulse).toFixed(2)})`;
      ctx.lineWidth = 2 + k * 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r); ctx.lineTo(this.throwX, GROUND_Y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(this.throwX, GROUND_Y + 1, b.r * 1.1, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save();
    const shake = this.dying >= 0 ? rand(-4, 4) : this.overload > 0 ? Math.sin(t * 60) * 1.5 : 0;
    ctx.translate(this.x + shake, this.y);
    ctx.lineJoin = 'round';
    if (this.flash > 0) ctx.filter = 'brightness(1.9)';

    // Phase aura — a pulsing menace ring that intensifies in later phases.
    if (this.phase >= 2) {
      const pa = (this.phase === 3 ? 0.3 : 0.18) * (0.6 + Math.abs(Math.sin(now / 300)) * 0.4);
      ctx.save();
      ctx.globalAlpha = pa;
      ctx.strokeStyle = '#ff2b88';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Hover glow beneath the saucer.
    const glow = ctx.createRadialGradient(0, r * 0.5, 4, 0, r * 0.5, r * 1.1);
    glow.addColorStop(0, 'rgba(255,43,136,0.5)');
    glow.addColorStop(1, 'rgba(255,43,136,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();

    // Twin thruster flames.
    const flick = 6 + Math.sin(now / 60) * 4;
    for (const sx of [-r * 0.62, r * 0.62]) {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.moveTo(sx - 6, r * 0.26); ctx.lineTo(sx + 6, r * 0.26); ctx.lineTo(sx, r * 0.26 + flick);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8ad0';
      ctx.beginPath();
      ctx.moveTo(sx - 3, r * 0.26); ctx.lineTo(sx + 3, r * 0.26); ctx.lineTo(sx, r * 0.26 + flick * 0.6);
      ctx.closePath(); ctx.fill();
    }

    // Side pods — menace fins flanking the hull.
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#4a2f7a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.82, 4, r * 0.15, r * 0.24, sx * 0.45, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // Lower hull — wide cel-shaded metallic disc with the shared ink outline.
    const hull = ctx.createLinearGradient(0, -r * 0.1, 0, r * 0.5);
    hull.addColorStop(0, '#8a5fc4');
    hull.addColorStop(0.5, '#5a3a8a');
    hull.addColorStop(1, '#2e1b52');
    ctx.fillStyle = hull;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 8, r, r * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Rim lights chasing around the disc.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const lx = Math.cos(a) * r * 0.82, ly = 8 + Math.sin(a) * r * 0.38;
      const on = Math.sin(now / 200 + i) > 0;
      ctx.fillStyle = on ? '#ffd60a' : 'rgba(255,43,136,0.65)';
      ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // Dome — glowing pink canopy, ink outline + glass highlight.
    const dome = ctx.createLinearGradient(0, -r * 0.5, 0, 2);
    dome.addColorStop(0, '#ff8ac4');
    dome.addColorStop(1, '#ff2b88');
    ctx.fillStyle = dome;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -4, r * 0.58, r * 0.46, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -16, r * 0.16, r * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();

    // Angry brows.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -15); ctx.lineTo(-3, -10);
    ctx.moveTo(12, -15); ctx.lineTo(3, -10);
    ctx.stroke();

    // Weak-point core eye — ink socket, glowing iris, vertical slit pupil.
    const pulse = 0.6 + Math.abs(Math.sin(now / 240)) * 0.4;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(0, -3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.45 * pulse;
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(0, -3, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const iris = ctx.createRadialGradient(-1, -4, 1, 0, -3, 9);
    iris.addColorStop(0, '#fff');
    iris.addColorStop(0.35, '#ffd60a');
    iris.addColorStop(1, '#ff7b00');
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, -3, 2.3, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-2.6, -6, 1.6, 0, Math.PI * 2); ctx.fill();

    ctx.filter = 'none';

    // ---- Shield (phase II) ----
    if (this.phase === 2 && this.dying < 0) {
      const sr = r + 14;
      if (this.overload <= 0) {
        ctx.globalAlpha = 0.14 + Math.sin(t * 5) * 0.04;
        ctx.fillStyle = '#9be7ff';
        ctx.beginPath(); ctx.ellipse(0, 6, sr, sr * 0.72, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#9be7ff'; ctx.lineWidth = 3;
        ctx.setLineDash([18, 10]);
        ctx.lineDashOffset = -this.spin * 40;
        ctx.beginPath(); ctx.ellipse(0, 6, sr, sr * 0.72, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else {
        const k = clamp(this.overload / SHIELD_DOWN_TIME, 0, 1);
        ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(0, 6, sr, sr * 0.72, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
