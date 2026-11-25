import { CEILING_Y, GRAVITY, GROUND_Y, W, WALL_L, WALL_R, type Rect } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { grand } from '../../systems/rng';
import { INK } from '../../rendering/theme';
import { clamp, rand } from '../../utils';
import { Ball } from '../ball';
import { Hazard } from '../hazard';
import { Particle, Shockwave } from '../particle';
import type { Projectile } from '../projectile';
import type { Game } from '../../game';
import { Boss, circleTouchesRect, shotDamage, shotHitsCircle, type BossKind } from './base';

// ============================ KING GLOBO ============================
// The first boss is the game's own premise wearing a crown: a colossal ball
// that bounces around the arena and, when you break it, SPLITS — one king
// into two princes into four squires. Everything the player has learned about
// reading arcs and running under a bounce applies, just bigger and meaner.
//
//   King   — huge and slow. Spits balls at you; when wounded, belly-flops.
//   Prince — two of them, faster, still spitting.
//   Squire — four small panicking ones that just want to run you over.

interface Tier { r: number; hp: number; bounce: number; hs: number; }
const TIERS: Tier[] = [
  { r: 74, hp: 12, bounce: 600, hs: 92 },
  { r: 52, hp: 7,  bounce: 560, hs: 126 },
  { r: 36, hp: 4,  bounce: 520, hs: 168 },
];
/** Total HP still "inside" a body of this tier once it is broken open. */
const BELOW = [14 + 16, 8, 0];
const TOTAL_HP = 12 + 14 + 16;

interface Body {
  x: number; y: number; vx: number; vy: number;
  tier: number; hp: number;
  squash: number;      // floor-bounce squash clock
  hurt: number;        // grimace clock
  spitT: number;       // seconds until next spit
  puff: number;        // spit telegraph clock (counts down), 0 = idle
  /** Belly-flop state: 0 none, 1 hanging at the apex, 2 plunging. */
  flop: number;
  flopT: number;
  born: number;
}

export class Globo extends Boss {
  kind: BossKind = 'globo';
  name = 'KING GLOBO';
  bodies: Body[] = [];
  private flopCd = 6;
  private lookX = W / 2;
  private lookY = GROUND_Y - 30;
  private lastArc: Body | null = null;

  constructor() {
    super();
    this.maxHp = TOTAL_HP;
    this.hp = TOTAL_HP;
    this.r = TIERS[0].r;
    this.x = W / 2 + 180;
    this.y = -110;
    this.bodies.push(this.make(0, this.x, this.y, -TIERS[0].hs, 0));
    this.introT = 2.4;
  }

  private make(tier: number, x: number, y: number, vx: number, vy: number): Body {
    return { x, y, vx, vy, tier, hp: TIERS[tier].hp, squash: 0, hurt: 0, spitT: tier === 0 ? 3.2 : grand(3, 5.5), puff: 0, flop: 0, flopT: 0, born: 0.25 };
  }

  private syncAnchor() {
    // The HUD / death sequence anchor follows the biggest surviving body.
    let best: Body | null = null;
    for (const b of this.bodies) if (!best || b.tier < best.tier) best = b;
    if (best) { this.x = best.x; this.y = best.y; this.r = TIERS[best.tier].r; }
  }

  private physics(b: Body, dt: number, game: Game | null) {
    const T = TIERS[b.tier];
    if (b.flop === 1) {
      // Hanging at the apex, shivering — the telegraph for the plunge.
      b.flopT -= dt;
      b.vx = 0; b.vy = 0;
      if (b.flopT <= 0) { b.flop = 2; b.vy = 1150; }
      return;
    }
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y + T.r >= GROUND_Y) {
      b.y = GROUND_Y - T.r;
      b.squash = 0.22;
      if (b.flop === 2) {
        // Belly flop lands: the arena shakes rocks loose from the ceiling.
        b.flop = 0;
        b.vy = -T.bounce * 0.8;
        b.vx = (b.x < W / 2 ? 1 : -1) * T.hs;
        if (game) {
          game.shake = Math.max(game.shake, 16);
          game.shockwaves.push(new Shockwave(b.x, GROUND_Y - 6, 200, '#ffd9a3', 0.45));
          AudioSys.explode(true);
          for (let i = 0; i < 16; i++) {
            game.particles.push(new Particle(b.x + rand(-T.r, T.r), GROUND_Y - 4, rand(-260, 260), rand(-320, -80), rand(0.4, 0.8), '#d8c9a8', 7, 600));
          }
          const target = game.getLivingPlayers()[0];
          const px = target ? target.x : W / 2;
          for (const off of [-1, 1]) {
            const rx = clamp(px + off * grand(90, 210), WALL_L + 30, WALL_R - 60);
            game.hazards.push(new Hazard('falling_rock', rx, CEILING_Y + 6, 30, 30, 9, 0.75));
          }
        }
      } else {
        b.vy = -T.bounce;
        if (game) {
          AudioSys.bounce(4);
          if (b.tier === 0) game.shake = Math.max(game.shake, 4);
        }
      }
    }
    if (b.x - T.r <= WALL_L) { b.x = WALL_L + T.r; b.vx = Math.abs(b.vx); }
    else if (b.x + T.r >= WALL_R) { b.x = WALL_R - T.r; b.vx = -Math.abs(b.vx); }
  }

  protected updateIntro(dt: number) {
    for (const b of this.bodies) { this.physics(b, dt, null); if (b.squash > 0) b.squash -= dt; }
    this.syncAnchor();
  }

  protected updateAlive(dt: number, game: Game) {
    const target = game.getLivingPlayers()[0];
    if (target) { this.lookX = target.x; this.lookY = target.y - 24; }
    this.flopCd -= dt;
    for (const b of this.bodies) {
      if (b.squash > 0) b.squash -= dt;
      if (b.hurt > 0) b.hurt -= dt;
      if (b.born > 0) b.born -= dt;
      this.physics(b, dt, game);

      // ---- Spit: cheeks puff, then a ball arcs out toward the player ----
      if (b.tier < 2 && b.flop === 0) {
        if (b.puff > 0) {
          b.puff -= dt;
          if (b.puff <= 0) {
            const dir = this.lookX < b.x ? -1 : 1;
            const size = b.tier === 0 ? 2 : 1;
            const T = TIERS[b.tier];
            const ball = new Ball(b.x + dir * T.r * 0.7, b.y + T.r * 0.25, size, 'normal', dir * (size === 2 ? 140 : 165), -220);
            ball.bornT = 0.16;
            game.balls.push(ball);
            AudioSys.sfx('boss/spawn_ball', 0.8) || AudioSys.beep(260, 0.12, 'sine', 0.25, 200);
          }
        } else {
          b.spitT -= dt;
          if (b.spitT <= 0) {
            b.spitT = (b.tier === 0 ? 4.4 : 6.2) + grand(-0.5, 0.8);
            if (game.balls.length < 7 && b.y < GROUND_Y - 150) b.puff = 0.55;
            else b.spitT = 0.6;
          }
        }
      }
      // ---- Belly flop: only the wounded King, only from near the apex ----
      if (b.tier === 0 && b.hp <= 6 && b.flop === 0 && this.flopCd <= 0 && Math.abs(b.vy) < 60 && b.y < GROUND_Y - 220) {
        b.flop = 1;
        b.flopT = 0.55;
        b.puff = 0;
        this.flopCd = 6.5;
        AudioSys.sfx('boss/warning_telegraph', 0.8) || AudioSys.warning();
      }
    }
    this.syncAnchor();
  }

  private hurtBody(game: Game, b: Body, dmg: number, hx: number, hy: number) {
    const real = Math.min(dmg, b.hp);
    b.hp -= real;
    b.hurt = 0.3;
    b.squash = Math.max(b.squash, 0.12);
    this.damage(game, real, hx, hy);
    if (b.hp > 0) return;
    // ---- This body breaks open ----
    const T = TIERS[b.tier];
    game.shockwaves.push(new Shockwave(b.x, b.y, T.r * 2.2, '#ff8ad0', 0.45));
    game.shake = Math.max(game.shake, 12 - b.tier * 3);
    game.hitPause = Math.max(game.hitPause, 0.12);
    game.flash = Math.max(game.flash, 0.2);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(140, 420);
      game.particles.push(new Particle(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.4, 0.8), i % 2 ? '#c64bd9' : '#ffd60a', 8, 500, 1.5, i % 3 === 0));
    }
    AudioSys.pop(4, 'normal');
    this.bodies.splice(this.bodies.indexOf(b), 1);
    if (b.tier < 2) {
      const N = TIERS[b.tier + 1];
      for (const dir of [-1, 1]) {
        const c = this.make(b.tier + 1, clamp(b.x + dir * N.r * 0.6, WALL_L + N.r, WALL_R - N.r), Math.min(b.y, GROUND_Y - N.r - 4), dir * N.hs, -N.bounce * 0.7);
        this.bodies.push(c);
      }
      AudioSys.sfx('boss/phase_intro', 0.8);
      this.phase = b.tier + 2;
    } else {
      // A squire bursts into one ordinary ball — the mop-up after the war.
      const ball = new Ball(b.x, b.y, 1, 'normal', (b.vx < 0 ? -1 : 1) * 165, -260);
      ball.bornT = 0.16;
      game.balls.push(ball);
    }
  }

  hitBy(game: Game, proj: Projectile): boolean {
    if (!this.active) return false;
    for (const b of this.bodies.slice()) {
      const T = TIERS[b.tier];
      if (!shotHitsCircle(proj, b.x, b.y, T.r)) continue;
      const dmg = shotDamage(proj.type);
      if (dmg > 0) this.hurtBody(game, b, dmg, proj.x, proj.type === 'bullet' || proj.type === 'pellet' ? proj.y : b.y + T.r * 0.7);
      return true;
    }
    return false;
  }

  touches(hb: Rect): boolean {
    if (!this.active) return false;
    for (const b of this.bodies) {
      if (circleTouchesRect(b.x, b.y, TIERS[b.tier].r * 0.93, hb)) return true;
    }
    return false;
  }

  onBlast(game: Game, x: number, y: number, radius: number) {
    for (const b of this.bodies.slice()) {
      if (Math.hypot(b.x - x, b.y - y) < radius + TIERS[b.tier].r * 0.8) this.hurtBody(game, b, 4, b.x, b.y);
    }
  }
  arcTarget(x: number, y: number, range: number) {
    if (!this.active) return null;
    let best: { x: number; y: number; d: number } | null = null;
    this.lastArc = null;
    for (const b of this.bodies) {
      const d = Math.hypot(b.x - x, b.y - y) - TIERS[b.tier].r;
      if (d < range && (!best || d < best.d)) { best = { x: b.x, y: b.y, d }; this.lastArc = b; }
    }
    return best;
  }
  onArc(game: Game, x: number, y: number) {
    if (this.lastArc && this.bodies.includes(this.lastArc)) this.hurtBody(game, this.lastArc, 2, x, y);
  }
  inColumn(x: number) {
    return this.active && this.bodies.some(b => Math.abs(b.x - x) < TIERS[b.tier].r);
  }
  protected deathPoint() { return { x: this.x + rand(-60, 60), y: this.y + rand(-50, 50) }; }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (this.dead || this.dying >= 0) return;
    for (const b of this.bodies) this.drawBody(ctx, b, t);
  }

  private drawBody(ctx: CanvasRenderingContext2D, b: Body, t: number) {
    const T = TIERS[b.tier];
    const r = T.r;
    // Floor shadow — also the belly-flop landing marker.
    const alt = clamp(GROUND_Y - (b.y + r), 0, 420);
    ctx.fillStyle = `rgba(0,0,0,${(0.34 * (1 - alt / 420) + 0.08).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(b.x, GROUND_Y + 2, r * (0.85 - alt / 900), 6, 0, 0, Math.PI * 2); ctx.fill();
    if (b.flop > 0) {
      const pulse = 0.5 + Math.abs(Math.sin(t * 18)) * 0.5;
      ctx.strokeStyle = `rgba(255,77,109,${(0.5 + pulse * 0.5).toFixed(2)})`;
      ctx.lineWidth = 3 + pulse * 2;
      ctx.beginPath(); ctx.ellipse(b.x, GROUND_Y + 2, r * 1.05, 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const sq = clamp(b.squash / 0.22, 0, 1);
    const puff = b.puff > 0 ? 1 - b.puff / 0.55 : 0;
    const shiver = b.flop === 1 ? Math.sin(t * 70) * 3 : 0;
    let sx = (1 + sq * 0.2) * (1 + puff * 0.1), sy = (1 - sq * 0.18) * (1 + puff * 0.06);
    if (b.born > 0) { const k = 1 - b.born / 0.25; sx *= 0.6 + 0.4 * k; sy *= 0.6 + 0.4 * k; }
    ctx.save();
    ctx.translate(b.x + shiver, b.y + r * (1 - sy) * sq);
    ctx.scale(sx, sy);

    // Body — royal magenta, same glass-ball language as the regular roster.
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.16, '#f06bd6');
    g.addColorStop(0.8, '#8a1f9e');
    g.addColorStop(1, '#5a1070');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    // Damage cracks deepen as this body's HP drains.
    const wound = 1 - b.hp / T.hp;
    if (wound > 0.2) {
      ctx.strokeStyle = `rgba(40,0,50,${(0.3 + wound * 0.5).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.42, -r * 0.2); ctx.lineTo(-r * 0.6, r * 0.05);
      if (wound > 0.5) { ctx.moveTo(r * 0.75, -r * 0.3); ctx.lineTo(r * 0.5, r * 0.02); ctx.lineTo(r * 0.68, r * 0.3); ctx.lineTo(r * 0.45, r * 0.5); }
      if (wound > 0.75) { ctx.moveTo(-r * 0.1, r * 0.95); ctx.lineTo(0, r * 0.7); ctx.lineTo(-r * 0.2, r * 0.55); }
      ctx.stroke();
    }
    // Specular.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.5, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();

    // ---- Face ----
    const dx = this.lookX - b.x, dy = this.lookY - b.y;
    const n = Math.hypot(dx, dy) || 1;
    const lx = (dx / n) * r * 0.07, ly = (dy / n) * r * 0.07;
    const hurt = b.hurt > 0;
    const scared = b.tier === 2;
    const eyeY = -r * 0.12, eyeX = r * 0.3, eyeR = r * (scared ? 0.2 : 0.17);
    for (const s of [-1, 1]) {
      if (hurt) {
        // X eyes.
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, r * 0.07); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * eyeX - eyeR * 0.7, eyeY - eyeR * 0.7); ctx.lineTo(s * eyeX + eyeR * 0.7, eyeY + eyeR * 0.7);
        ctx.moveTo(s * eyeX + eyeR * 0.7, eyeY - eyeR * 0.7); ctx.lineTo(s * eyeX - eyeR * 0.7, eyeY + eyeR * 0.7);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s * eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(s * eyeX + lx, eyeY + ly, eyeR * (scared ? 0.3 : 0.5), 0, Math.PI * 2); ctx.fill();
        // Brows: angry V for king/princes, raised and worried for squires.
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, r * 0.08); ctx.lineCap = 'round';
        ctx.beginPath();
        if (scared) { ctx.moveTo(s * (eyeX - eyeR), eyeY - eyeR * 1.7); ctx.lineTo(s * (eyeX + eyeR), eyeY - eyeR * 1.3); }
        else { ctx.moveTo(s * (eyeX + eyeR * 1.1), eyeY - eyeR * 1.7); ctx.lineTo(s * (eyeX - eyeR * 0.9), eyeY - eyeR * 0.9); }
        ctx.stroke();
      }
    }
    // Mouth: puffed "o" before a spit, grimace when hurt, wobbling panic for
    // squires, otherwise a wide toothy grin.
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, r * 0.06); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const my = r * 0.36;
    if (b.puff > 0 || b.flop === 1) {
      ctx.fillStyle = '#3a0a45';
      ctx.beginPath(); ctx.ellipse(0, my, r * 0.14, r * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (hurt || scared) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const px = -r * 0.3 + (i / 6) * r * 0.6;
        const py = my + (i % 2 ? -1 : 1) * r * 0.05;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, my - r * 0.06);
      ctx.quadraticCurveTo(0, my + r * 0.3, r * 0.36, my - r * 0.06);
      ctx.quadraticCurveTo(0, my + r * 0.06, -r * 0.36, my - r * 0.06);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Hit flash: a white veil over the body. (Deliberately NOT ctx.filter —
    // canvas filters force a slow path and cost whole frames on weak GPUs.)
    if (this.flash > 0 && b.hurt > 0.14) {
      ctx.globalAlpha = Math.min(0.6, this.flash / 0.16 * 0.6);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- Crown (king) / circlet (princes) — rides the squash with a lag ----
    if (b.tier < 2) {
      const cw = r * (b.tier === 0 ? 0.62 : 0.42), ch = r * (b.tier === 0 ? 0.42 : 0.24);
      const cyTop = -r * 0.96 - ch + sq * r * 0.1 + Math.sin(t * 5 + b.x * 0.01) * 1.5;
      ctx.fillStyle = '#ffd60a';
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-cw, cyTop + ch);
      ctx.lineTo(-cw, cyTop + ch * 0.2);
      ctx.lineTo(-cw * 0.5, cyTop + ch * 0.62);
      ctx.lineTo(0, cyTop);
      ctx.lineTo(cw * 0.5, cyTop + ch * 0.62);
      ctx.lineTo(cw, cyTop + ch * 0.2);
      ctx.lineTo(cw, cyTop + ch);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(0, cyTop + ch * 0.62, Math.max(2.5, ch * 0.16), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-cw * 0.85, cyTop + ch * 0.78, cw * 1.7, 2);
    }
    ctx.restore();
  }
}
