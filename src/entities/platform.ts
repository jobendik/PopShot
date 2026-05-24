import { roundRect } from '../rendering/canvas';
import type { ThemeName } from '../constants';

// ============================ PLATFORM ==============================
export interface PlatformOptions {
  blocksShots?: boolean;
  color?: string;
  vx?: number;
  minX?: number;
  maxX?: number;
}

export class Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  blocksShots: boolean;
  color: string;
  vx: number;
  minX: number;
  maxX: number;
  constructor(x, y, w, h, opts: PlatformOptions = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.blocksShots = opts.blocksShots !== false;
    this.color = opts.color || '#7a5a3a';
    this.vx = opts.vx || 0;
    this.minX = opts.minX ?? x;
    this.maxX = opts.maxX ?? x;
  }
  update(dt) {
    if (!this.vx) return;
    this.x += this.vx * dt;
    if (this.x < this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
    if (this.x > this.maxX) { this.x = this.maxX; this.vx = -Math.abs(this.vx); }
  }
  draw(ctx, theme) {
    ctx.fillStyle = this.color;
    roundRect(ctx, this.x, this.y, this.w, this.h, 4, true, false);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(this.x + 2, this.y + 2, this.w - 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(this.x, this.y + this.h - 3, this.w, 3);
  }
}
