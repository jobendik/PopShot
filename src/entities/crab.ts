import { GROUND_Y, WALL_L, WALL_R } from '../constants';

export class Crab {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  minX: number;
  maxX: number;
  dead: boolean;

  constructor(x: number, y = GROUND_Y, minX = WALL_L + 30, maxX = WALL_R - 30, speed = 72) {
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 18;
    this.vx = speed;
    this.minX = minX;
    this.maxX = maxX;
    this.dead = false;
  }

  getHitbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  update(dt: number) {
    this.x += this.vx * dt;
    if (this.x < this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
    if (this.x > this.maxX) { this.x = this.maxX; this.vx = -Math.abs(this.vx); }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const dir = Math.sign(this.vx) || 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#e85d04';
    ctx.strokeStyle = '#5f1d00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -11, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffba08';
    ctx.beginPath(); ctx.arc(-6, -17, 3, 0, Math.PI * 2); ctx.arc(6, -17, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5f1d00';
    ctx.beginPath();
    ctx.moveTo(-13, -9); ctx.lineTo(-24, -16); ctx.lineTo(-29, -11);
    ctx.moveTo(13, -9); ctx.lineTo(24, -16); ctx.lineTo(29, -11);
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(i * 7 - 6, -5); ctx.lineTo(i * 9 - 13, -1);
      ctx.moveTo(i * 7 + 6, -5); ctx.lineTo(i * 9 + 13, -1);
    }
    ctx.stroke();
    ctx.fillStyle = '#5f1d00';
    ctx.fillRect(dir * 4, -18, 3, 3);
    ctx.restore();
  }
}
