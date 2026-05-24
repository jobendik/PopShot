import { roundRect } from '../rendering/canvas';
import type { PickupType } from '../constants';

// ============================ DESTRUCTIBLE ==========================
export class Destructible {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  contains: PickupType | null;
  dead: boolean;
  constructor(x, y, w, h, contains = null) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.hp = 1;
    this.contains = contains;  // pickup type to drop, or null
    this.dead = false;
  }
  draw(ctx) {
    ctx.fillStyle = '#a8682c';
    roundRect(ctx, this.x, this.y, this.w, this.h, 3, true, false);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    // Wood plank lines
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.h / 2);
    ctx.lineTo(this.x + this.w, this.y + this.h / 2);
    ctx.stroke();
  }
}
