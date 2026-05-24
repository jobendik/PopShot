import { clamp } from '../utils';

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
  constructor(x, y, vx, vy, life, color, size = 4, gravity = 0) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size; this.gravity = gravity;
    this.dead = false;
  }
  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    const s = this.size * a + 1;
    ctx.fillRect(this.x - s/2, this.y - s/2, s, s);
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
  constructor(x, y, text, color = '#fff', size = 22) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size; this.life = 1.0; this.maxLife = 1.0;
    this.dead = false;
  }
  update(dt) {
    this.y -= 40 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${this.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
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
