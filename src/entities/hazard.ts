import { GROUND_Y, GRAVITY } from '../constants';
import { AudioSys } from '../systems/audio';
import { grand01 } from '../systems/rng';
import { clamp, rand } from '../utils';
import { Particle } from './particle';
import type { Game } from '../game';
import { roundRect } from '../rendering/canvas';
import { INK } from '../rendering/theme';

// ============================ HAZARD ================================
export type HazardType = 'lava' | 'slime' | 'electric_beam' | 'boss_warning' | 'boss_beam' | 'electric_barrier' | 'flame_vent' | 'falling_rock';

export class Hazard {
  type: HazardType;
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  maxLife: number;
  dead: boolean;
  active: boolean;
  phase: number;
  vy: number;
  /** Falling rocks only: seconds the rock hangs at the ceiling (telegraph
   *  ring already showing on the floor) before it drops. */
  delay: number;
  landed: boolean;
  constructor(type, x, y, w, h, life = 3, delay = 0) {
    this.type = type; this.x = x; this.y = y; this.w = w; this.h = h;
    this.life = life; this.maxLife = life; this.dead = false;
    this.active = true;
    this.phase = grand01() * Math.PI * 2;
    this.vy = type === 'falling_rock' ? 30 : 0;
    this.delay = delay;
    this.landed = false;
  }
  update(dt, game?: Game) {
    if (this.type === 'falling_rock' && this.delay > 0) {
      // Hanging in the ceiling: harmless until it actually drops.
      this.delay -= dt;
      this.active = false;
      if (this.delay <= 0) this.active = true;
      return;
    }
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.type === 'electric_barrier') {
      this.phase += dt * 2.8;
      this.active = Math.sin(this.phase) > -0.2;
    } else if (this.type === 'flame_vent') {
      // ~2.6 s cycle: rest → pilot light (the telegraph) → flare.
      this.phase += dt * 2.4;
      this.active = Math.sin(this.phase) > 0.2;
    } else if (this.type === 'falling_rock') {
      this.vy += GRAVITY * 0.55 * dt;
      this.y += this.vy * dt;
      if (this.y > GROUND_Y - this.h) {
        this.y = GROUND_Y - this.h;
        this.life = Math.min(this.life, 0.35);
        if (!this.landed) {
          this.landed = true;
          AudioSys.sfx('hazard/falling_rock_impact', 0.6);
          if (game) {
            game.shake = Math.max(game.shake, 5);
            for (let i = 0; i < 10; i++) {
              game.particles.push(new Particle(this.x + this.w / 2 + rand(-10, 10), GROUND_Y - 2,
                rand(-160, 160), rand(-220, -60), rand(0.3, 0.6), i % 2 ? '#8a776c' : '#5c4d46', 6, 520));
            }
          }
        }
      }
    }
  }
  draw(ctx) {
    if (this.type === 'lava') {
      // Fades and narrows in its last second so the player can see it cooling.
      const k = clamp(this.life / 0.8, 0, 1);
      const now = performance.now() / 1000;
      // Heat shimmer rising off the patch — also the "this floor superheats
      // bounces" tell.
      ctx.globalAlpha = 0.16 * k;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w / 2, this.y - 6 + Math.sin(now * 6 + this.phase) * 2, this.w * 0.55, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k;
      ctx.fillStyle = '#ff5400';
      roundRect(ctx, this.x, this.y, this.w, this.h, 3, true, false);
      ctx.fillStyle = '#ffd60a';
      ctx.globalAlpha = (0.5 + Math.sin(now * 9 + this.phase) * 0.25) * k;
      ctx.fillRect(this.x + 4, this.y + 2, this.w - 8, 2);
      ctx.globalAlpha = 1;
    } else if (this.type === 'slime') {
      // Same green family as the sludge ball that drips it, so the cause/effect
      // reads as one material.
      const k = clamp(this.life / 0.8, 0, 1);
      ctx.globalAlpha = k;
      ctx.fillStyle = '#6aa82e';
      roundRect(ctx, this.x, this.y, this.w, this.h, 4, true, false);
      ctx.fillStyle = '#9be15d';
      ctx.fillRect(this.x + 4, this.y + 2, this.w - 8, 2);
      ctx.beginPath();
      ctx.arc(this.x + this.w * 0.25, this.y + 1, 3, Math.PI, 0);
      ctx.arc(this.x + this.w * 0.7, this.y + 1, 4, Math.PI, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (this.type === 'electric_beam') {
      const a = clamp(this.life / this.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffd60a';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + this.w/2 - 1, this.y, 2, this.h);
      ctx.globalAlpha = 1;
    } else if (this.type === 'boss_warning') {
      const a = (Math.sin(performance.now() / 60) + 1) / 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff2b88';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.globalAlpha = 1;
    } else if (this.type === 'boss_beam') {
      ctx.fillStyle = '#ff2b88';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + 2, this.y, this.w - 4, this.h);
    } else if (this.type === 'electric_barrier') {
      ctx.globalAlpha = this.active ? 0.9 : 0.22;
      ctx.fillStyle = this.active ? '#ffd60a' : '#795b13';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + this.w / 2 - 1, this.y, 2, this.h);
      ctx.globalAlpha = 1;
    } else if (this.type === 'flame_vent') {
      ctx.fillStyle = '#343a40';
      roundRect(ctx, this.x, this.y + this.h - 8, this.w, 8, 3, true, false);
      if (this.active) {
        const flicker = 4 + Math.sin(performance.now() / 40) * 3;
        ctx.fillStyle = '#ff5400';
        ctx.beginPath();
        ctx.moveTo(this.x + 4, this.y + this.h - 8);
        ctx.lineTo(this.x + this.w / 2, this.y - flicker);
        ctx.lineTo(this.x + this.w - 4, this.y + this.h - 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd60a';
        ctx.beginPath();
        ctx.moveTo(this.x + 12, this.y + this.h - 8);
        ctx.lineTo(this.x + this.w / 2, this.y + 14 - flicker);
        ctx.lineTo(this.x + this.w - 12, this.y + this.h - 8);
        ctx.closePath();
        ctx.fill();
      } else {
        // Pilot light: grows through the half-second before the flare, so the
        // vent announces itself instead of just switching on.
        const warm = clamp((Math.sin(this.phase) + 0.55) / 0.75, 0, 1);
        ctx.fillStyle = `rgba(255,84,0,${(0.3 + warm * 0.5).toFixed(2)})`;
        ctx.fillRect(this.x + 6, this.y + this.h - 14, this.w - 12, 3);
        if (warm > 0.05 && Math.cos(this.phase) > 0) {
          const hgt = 6 + warm * 16 + Math.sin(performance.now() / 30) * 2;
          ctx.fillStyle = '#ffd60a';
          ctx.beginPath();
          ctx.moveTo(this.x + this.w / 2 - 5, this.y + this.h - 10);
          ctx.lineTo(this.x + this.w / 2, this.y + this.h - 10 - hgt);
          ctx.lineTo(this.x + this.w / 2 + 5, this.y + this.h - 10);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (this.type === 'falling_rock') {
      // Landing-point telegraph: pulsing ring on the floor directly under the
      // rock so the player can dodge laterally. Hidden once the rock has landed
      // (small life remaining → impact frame is already happening).
      if (this.y + this.h < GROUND_Y - 4 && this.life > 0.4) {
        const cx = this.x + this.w / 2;
        if (this.delay > 0) {
          // Still hanging: a thin drop line from the rock to its landing ring.
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = '#ff4d6d';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 10]);
          ctx.beginPath(); ctx.moveTo(cx, this.y + this.h); ctx.lineTo(cx, GROUND_Y); ctx.stroke();
          ctx.restore();
        }
        const pulse = 0.5 + Math.abs(Math.sin(performance.now() / 110)) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.35 + pulse * 0.4;
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 2 + pulse * 2;
        ctx.beginPath();
        ctx.ellipse(cx, GROUND_Y + 1, this.w * 0.85, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.2 + pulse * 0.3;
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.ellipse(cx, GROUND_Y + 1, this.w * 0.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#5c4d46';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      const jx = this.delay > 0 ? Math.sin(performance.now() / 18) * 1.5 : 0;
      ctx.save();
      ctx.translate(jx, 0);
      ctx.beginPath();
      ctx.moveTo(this.x + this.w * 0.2, this.y);
      ctx.lineTo(this.x + this.w * 0.85, this.y + this.h * 0.1);
      ctx.lineTo(this.x + this.w, this.y + this.h * 0.7);
      ctx.lineTo(this.x + this.w * 0.55, this.y + this.h);
      ctx.lineTo(this.x + this.w * 0.1, this.y + this.h * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
