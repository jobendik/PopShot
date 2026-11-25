import { GROUND_Y } from '../constants';
import { AudioSys } from '../systems/audio';
import { INK } from '../rendering/theme';
import { rand } from '../utils';
import { Particle, Shockwave } from './particle';
import type { Ball } from './ball';
import type { Game } from '../game';

// ============================ WORLD GADGETS =========================
// Arena fixtures that make a world play differently, not just look different.
// Each one changes ball trajectories through a simple, visible rule:
//
//   Bumper — Neon City's pinball bumpers. Kick any ball that touches them.
//   Fan    — the Airship's deck fans. A running fan lifts balls in its column.
//
// (Wind gusts and ice floors are arena-wide states, owned by Game.)

/** Pinball bumper: a fixed disc that throws balls off along the contact normal
 *  and blocks shots like a platform. Every kick pays a small score tick and
 *  feeds the chain timer a little — playing the bumpers keeps a chain alive. */
export class Bumper {
  x: number;
  y: number;
  r: number;
  /** Kick animation clock (counts down from KICK_T). */
  kickT: number;
  hue: string;
  constructor(x: number, y: number, r = 22, hue = '#ff36c4') {
    this.x = x; this.y = y; this.r = r;
    this.kickT = 0;
    this.hue = hue;
  }
  update(dt: number) {
    if (this.kickT > 0) this.kickT = Math.max(0, this.kickT - dt);
  }
  kick(game: Game, ball: Ball) {
    this.kickT = 0.22;
    game.addScore(10);
    game.shockwaves.push(new Shockwave(this.x, this.y, this.r + 26, this.hue, 0.22));
    const a = Math.atan2(ball.y - this.y, ball.x - this.x);
    for (let i = 0; i < 5; i++) {
      const s = rand(140, 300), da = a + rand(-0.6, 0.6);
      game.particles.push(new Particle(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r,
        Math.cos(da) * s, Math.sin(da) * s, rand(0.15, 0.3), i % 2 ? '#fff' : this.hue, 4, 0, 3, true));
    }
    AudioSys.bumper();
  }
  /** True if a vertical shot at column x, travelling from y0 up to y1, hits. */
  blocksColumn(x: number, y0: number, y1: number): boolean {
    if (Math.abs(x - this.x) > this.r) return false;
    const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
    return bottom >= this.y - this.r && top <= this.y + this.r;
  }
  blocksCircle(x: number, y: number, r: number): boolean {
    const dx = x - this.x, dy = y - this.y, rr = r + this.r;
    return dx * dx + dy * dy < rr * rr;
  }
  draw(ctx: CanvasRenderingContext2D, t: number) {
    const k = this.kickT / 0.22;
    const r = this.r * (1 + k * 0.22);
    // Outer neon glow.
    ctx.globalAlpha = 0.22 + k * 0.4;
    ctx.fillStyle = this.hue;
    ctx.beginPath(); ctx.arc(this.x, this.y, r + 9 + k * 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Skirt.
    ctx.fillStyle = '#1a2440';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Neon ring — chases around the rim, snaps white on a kick.
    ctx.strokeStyle = k > 0.4 ? '#fff' : this.hue;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, r - 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    const a0 = t * 3.2;
    ctx.beginPath(); ctx.arc(this.x, this.y, r - 5, a0, a0 + 0.9); ctx.stroke();
    // Cap + star.
    const cap = ctx.createRadialGradient(this.x - r * 0.25, this.y - r * 0.3, 1, this.x, this.y, r * 0.55);
    cap.addColorStop(0, '#fff');
    cap.addColorStop(0.35, '#ffe66d');
    cap.addColorStop(1, '#ff9f1c');
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

/** Deck fan: sits on the floor and cycles spin-up → blow → spin-down → rest.
 *  While blowing, any ball over it is lifted (small balls more than big ones)
 *  and smoke above it is blown away. The spin-up is the telegraph. */
export class Fan {
  x: number;       // left edge of the lift column
  w: number;       // column width
  top: number;     // column ceiling (y) — lift applies below this line
  lift: number;    // upward acceleration at full power
  /** 0..1 current blowing strength (eases in/out of each phase). */
  power: number;
  phase: number;   // seconds into the current cycle
  onTime: number;
  offTime: number;
  spin: number;
  constructor(x: number, w = 120, onTime = 2.4, offTime = 4.2, phase = 0, top = 90, lift = 1180) {
    this.x = x; this.w = w; this.top = top; this.lift = lift;
    this.power = 0;
    this.phase = phase;
    this.onTime = onTime;
    this.offTime = offTime;
    this.spin = 0;
  }
  /** Seconds of spin-up warning before the fan actually lifts. */
  static readonly WARN = 0.9;
  update(dt: number, game: Game) {
    this.phase += dt;
    const cycle = this.onTime + this.offTime;
    if (this.phase >= cycle) this.phase -= cycle;
    const blowing = this.phase >= this.offTime;
    const target = blowing ? 1 : 0;
    this.power += (target - this.power) * Math.min(1, dt * 5);
    // Blade speed leads the airflow: it starts spinning during the warning.
    const warn = !blowing && this.phase > this.offTime - Fan.WARN;
    const spinTarget = blowing ? 30 : warn ? 14 : 2;
    this.spin += spinTarget * dt * (0.4 + this.power);
    if (this.power > 0.4) {
      for (const sc of game.smokeClouds) {
        if (sc.x > this.x && sc.x < this.x + this.w) { sc.vy -= 260 * dt; sc.life -= dt * 1.5; }
      }
    }
  }
  /** True during the spin-up warning (drives the floor light). */
  get warning() {
    return this.phase < this.offTime && this.phase > this.offTime - Fan.WARN;
  }
  draw(ctx: CanvasRenderingContext2D, t: number) {
    const cx = this.x + this.w / 2;
    const y = GROUND_Y;
    // Lift column — faint streaks rushing upward while blowing.
    if (this.power > 0.03) {
      const g = ctx.createLinearGradient(0, y, 0, this.top);
      g.addColorStop(0, `rgba(190,235,255,${(0.2 * this.power).toFixed(3)})`);
      g.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x, this.top, this.w, y - this.top);
      ctx.strokeStyle = `rgba(255,255,255,${(0.5 * this.power).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const span = y - this.top;
      for (let i = 0; i < 7; i++) {
        const fx = this.x + 10 + ((i * 37) % (this.w - 20));
        const fy = y - ((t * (300 + i * 40) + i * 91) % span);
        ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22 - (i % 3) * 8);
      }
      ctx.stroke();
    }
    // Housing: a low grille plate with a status light.
    ctx.fillStyle = '#39424e';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x + 6, y); ctx.lineTo(this.x + 16, y - 12);
    ctx.lineTo(this.x + this.w - 16, y - 12); ctx.lineTo(this.x + this.w - 6, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Blades — a flattened spinning ellipse pair.
    ctx.strokeStyle = '#cfd8e3';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const a = this.spin + i * Math.PI / 2;
      const bx = Math.cos(a) * (this.w * 0.3);
      ctx.beginPath(); ctx.moveTo(cx - bx, y - 9); ctx.lineTo(cx + bx, y - 9); ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx, y - 9, 3, 0, Math.PI * 2); ctx.fill();
    // Status light: amber strobe = about to blow, cyan = blowing.
    const warn = this.warning;
    ctx.fillStyle = this.power > 0.5 ? '#9be7ff' : warn ? (Math.sin(t * 22) > 0 ? '#ffd60a' : '#7a6410') : '#2b3440';
    ctx.beginPath(); ctx.arc(this.x + 14, y - 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + this.w - 14, y - 5, 3, 0, Math.PI * 2); ctx.fill();
  }
}

/** Arena-wide wind state. Gusts are announced before they blow. */
export interface WindState {
  /** Current horizontal acceleration applied to balls (px/s²). 0 = calm. */
  ax: number;
  /** Direction of the current/pending gust: -1, +1, or 0 for none scheduled. */
  dir: number;
  /** 'calm' → 'warn' (telegraph) → 'blow' → 'calm'. */
  phase: 'calm' | 'warn' | 'blow';
  /** Seconds remaining in the current phase. */
  timer: number;
  /** Peak gust strength for this arena (px/s²); 0 disables wind entirely. */
  strength: number;
  /** Calm seconds between gusts [min, max]. */
  gapMin: number;
  gapMax: number;
}

export function calmWind(): WindState {
  return { ax: 0, dir: 0, phase: 'calm', timer: 0, strength: 0, gapMin: 5, gapMax: 8 };
}
