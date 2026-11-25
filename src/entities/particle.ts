import { clamp } from '../utils';
import { INK, displayFont, uiFont } from '../rendering/theme';

// ============================ PARTICLES =============================
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
  dead: boolean;
  /** Velocity damping per second (0 = none). Gives bursts a punchy
   *  "fast out, slow settle" profile instead of a linear drift. */
  drag: number;
  /** When true the particle renders as a short streak along its velocity —
   *  reads as a spark / speed line rather than a dot. */
  streak: boolean;
  constructor(x, y, vx, vy, life, color, size = 4, gravity = 0, drag = 0, streak = false) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size; this.gravity = gravity;
    this.dead = false;
    this.drag = drag;
    this.streak = streak;
  }
  update(dt) {
    this.vy += this.gravity * dt;
    if (this.drag > 0) {
      const k = Math.max(0, 1 - this.drag * dt);
      this.vx *= k; this.vy *= k;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    const r = this.size * a * 0.6 + 1;
    if (this.streak) {
      // Streak: a tapered line trailing behind the velocity vector.
      const k = 0.035;
      ctx.globalAlpha = a;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, r * 0.9);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * k, this.y - this.vy * k);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    // Soft glow halo (faint, large) + bright core (small). Reads as a
    // glowing spark rather than a sharp pixel.
    ctx.globalAlpha = a * 0.4;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Tiny white core for hot center on fresh particles.
    if (a > 0.6) {
      ctx.globalAlpha = (a - 0.6) * 1.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  dead: boolean;
  /** 'display' = Bowlby One (punchy labels: combos, +score), 'ui' = Inter
   *  (descriptive sentences). Matches the HTML overlay's split so in-world
   *  text reads in the same faces as the menus / HUD. */
  face: 'display' | 'ui';
  /** Optional exclusivity tag. Pushing a new text through `pushText` with the
   *  same slot retires the previous occupant, so big centre-screen callouts
   *  replace each other instead of stacking into an unreadable pile. */
  slot: string;
  /** Upward drift in px/s. Banners drift slowly; score ticks rise faster. */
  rise: number;
  /** Cached half-width in px (measured on first draw). */
  halfW: number;
  constructor(x, y, text, color = '#fff', size = 22, face: 'display' | 'ui' = 'display') {
    this.halfW = -1;
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size; this.life = 1.0; this.maxLife = 1.0;
    this.dead = false;
    this.face = face;
    this.slot = '';
    this.rise = 40;
  }
  update(dt) {
    this.y -= this.rise * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    // Pop-in scale: starts big, settles to 1.0 over the first 150ms of life.
    const age = 1 - a;
    const pop = age < 0.15 ? 1.6 - age * 4 : 1.0;
    ctx.save();
    // Brand faces (not raw sans-serif) so combo / score / banner text matches
    // the HTML .fx-* labels exactly. Ink outline (not pure black) keeps the
    // whole game's text on one palette.
    ctx.font = this.face === 'ui' ? uiFont(this.size, 800) : displayFont(this.size);
    // Keep the whole label on screen: a chip spawned beside a wall slides in
    // instead of being cut off by it.
    if (this.halfW < 0) this.halfW = ctx.measureText(this.text).width / 2 + 6;
    const hw = this.halfW * pop;
    const cx = Math.max(16 + hw, Math.min(944 - hw, this.x));
    ctx.translate(cx, Math.max(74, this.y));
    ctx.scale(pop, pop);
    // Hold full opacity, then fade over the last 35% of the life.
    ctx.globalAlpha = Math.min(1, a / 0.35);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Soft drop shadow for depth.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(this.text, 1, 2);
    ctx.lineWidth = Math.max(3, this.size * 0.16);
    ctx.strokeStyle = INK;
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/** Expanding radial ring used as pop / explosion flash. Lives briefly, draws
 *  as a fading circle outline so it reads as "impact at this point" without
 *  obscuring the rest of the scene. */
export class Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  dead: boolean;
  constructor(x: number, y: number, maxR = 60, color = '#ffffff', life = 0.28) {
    this.x = x; this.y = y;
    this.r = 0; this.maxR = maxR;
    this.life = life; this.maxLife = life;
    this.color = color; this.dead = false;
  }
  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    const t = 1 - this.life / this.maxLife;
    // Ease-out: fast growth at first, slowing toward maxR.
    this.r = this.maxR * (1 - Math.pow(1 - t, 2));
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.75;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3 * a + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();
    // Inner bright flash early in the lifetime
    if (a > 0.6) {
      ctx.globalAlpha = (a - 0.6) * 2;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class SmokeCloud {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  dead: boolean;

  constructor(x, y, r = 38, life = 3.2) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() * 2 - 1) * 14;
    this.vy = -10 - Math.random() * 10;
    this.r = r;
    this.life = life;
    this.maxLife = life;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.r += 6 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.28 * a;
    const grad = ctx.createRadialGradient(this.x, this.y, this.r * 0.1, this.x, this.y, this.r);
    grad.addColorStop(0, '#d8dee6');
    grad.addColorStop(0.7, '#8d99a6');
    grad.addColorStop(1, 'rgba(80,85,92,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Push a floating text into an exclusive slot: anything already occupying
 *  that slot is retired first. Use for centre-screen callouts ('banner',
 *  'banner2') and per-anchor chips so feedback never stacks illegibly. */
export function pushText(list: FloatingText[], ft: FloatingText, slot: string, life = 1.0): FloatingText {
  for (const o of list) if (o.slot === slot) o.dead = true;
  ft.slot = slot;
  ft.life = life; ft.maxLife = life;
  list.push(ft);
  return ft;
}

/** The burst left behind by a popped ball: a ring of membrane fragments that
 *  fly outward and tumble, plus a brief hot core. One object draws every
 *  fragment, so a 30-ball cascade costs 30 draw objects, not 300. */
export class PopBurst {
  x: number; y: number; r: number;
  color: string; dark: string;
  life: number; maxLife: number;
  dead: boolean;
  rot: number;
  n: number;
  hex: boolean;
  constructor(x: number, y: number, r: number, color: string, dark: string, hex = false) {
    this.x = x; this.y = y; this.r = r;
    this.color = color; this.dark = dark;
    this.life = 0.34 + r * 0.004; this.maxLife = this.life;
    this.dead = false;
    this.rot = Math.random() * Math.PI * 2;
    this.n = r < 16 ? 5 : r < 30 ? 7 : 9;
    this.hex = hex;
  }
  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = 1 - clamp(this.life / this.maxLife, 0, 1);       // 0 → 1
    const ease = 1 - Math.pow(1 - t, 3);
    const a = 1 - t;
    const rad = this.r * (1 + ease * 1.25);
    // Hot core flash — the "snap" of the pop, gone within the first third.
    if (t < 0.3) {
      const k = 1 - t / 0.3;
      ctx.globalAlpha = k * 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * (0.55 + t * 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
    // Membrane fragments: arc slivers of the original outline flying apart.
    const seg = (Math.PI * 2) / this.n;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      const ang = this.rot + i * seg + ease * 0.5 * (i % 2 ? 1 : -1);
      const span = seg * 0.62 * (1 - ease * 0.75);
      ctx.globalAlpha = a;
      ctx.strokeStyle = i % 2 ? this.color : this.dark;
      ctx.lineWidth = Math.max(1.5, this.r * 0.2 * (1 - ease * 0.6));
      ctx.beginPath();
      if (this.hex) {
        const x1 = this.x + Math.cos(ang - span / 2) * rad, y1 = this.y + Math.sin(ang - span / 2) * rad;
        const x2 = this.x + Math.cos(ang + span / 2) * rad, y2 = this.y + Math.sin(ang + span / 2) * rad;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      } else {
        ctx.arc(this.x, this.y, rad, ang - span / 2, ang + span / 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** A jagged lightning bolt between two points. Purely cosmetic — the gameplay
 *  effect (the arc pop) is scheduled separately — but it is what makes an
 *  electric chain legible: you can SEE which ball the charge jumped to. */
export class Bolt {
  pts: number[];
  life: number; maxLife: number;
  dead: boolean;
  color: string;
  width: number;
  constructor(x1: number, y1: number, x2: number, y2: number, color = '#ffe14a', width = 3, life = 0.2) {
    this.life = life; this.maxLife = life;
    this.dead = false;
    this.color = color;
    this.width = width;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const steps = Math.max(3, Math.min(12, Math.round(len / 22)));
    this.pts = [x1, y1];
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      const j = (Math.random() - 0.5) * Math.min(34, len * 0.28) * Math.sin(k * Math.PI);
      this.pts.push(x1 + dx * k + nx * j, y1 + dy * k + ny * j);
    }
    this.pts.push(x2, y2);
  }
  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(this.pts[0], this.pts[1]);
      for (let i = 2; i < this.pts.length; i += 2) ctx.lineTo(this.pts[i], this.pts[i + 1]);
      ctx.stroke();
    };
    ctx.globalAlpha = a * 0.35;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * 3.4;
    trace();
    ctx.globalAlpha = a;
    ctx.lineWidth = this.width * 1.4;
    trace();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, this.width * 0.55);
    trace();
    ctx.globalAlpha = 1;
  }
}
