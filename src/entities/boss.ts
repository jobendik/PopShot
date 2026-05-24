import { CEILING_Y, GROUND_Y, W, WALL_L, WALL_R, type BallType } from '../constants';
import { AudioSys } from '../systems/audio';
import { rand, randi } from '../utils';
import { Ball } from './ball';
import { Hazard } from './hazard';
import { Particle } from './particle';
import type { Projectile } from './projectile';
import type { Game } from '../game';

// ============================ BOSS ==================================
/** A floating commander. Hovers near the ceiling, drifts laterally,
 *  cycles through three attack patterns, and exposes a weak point. */
export class Boss {
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  phase: number;
  attackTimer: number;
  attackIndex: number;
  r: number;
  flash: number;
  dead: boolean;
  beamCharge: number;
  beamY: number;
  constructor() {
    this.x = W / 2; this.y = CEILING_Y + 60;
    this.vx = 80;
    this.hp = 60; this.maxHp = 60;
    this.phase = 1;
    this.attackTimer = 2.5;
    this.attackIndex = 0;
    this.r = 60;
    this.flash = 0;
    this.dead = false;
    this.beamCharge = 0; // for beam attack
    this.beamY = 0;
  }
  update(dt, game) {
    if (this.dead) return;
    // Drift
    this.x += this.vx * dt;
    if (this.x < 120) { this.x = 120; this.vx = Math.abs(this.vx); }
    if (this.x > W - 120) { this.x = W - 120; this.vx = -Math.abs(this.vx); }
    this.y = CEILING_Y + 60 + Math.sin(performance.now() / 600) * 12;

    // Phase scaling
    const ratio = this.hp / this.maxHp;
    if (ratio < 0.66 && this.phase === 1) { this.phase = 2; this.attackTimer = 1; this.vx *= 1.2; }
    if (ratio < 0.33 && this.phase === 2) { this.phase = 3; this.attackTimer = 0.8; this.vx *= 1.3; }

    // Attack scheduler
    this.attackTimer -= dt;
    if (this.beamCharge > 0) {
      this.beamCharge -= dt;
      if (this.beamCharge <= 0) {
        // Fire beam: a horizontal sweep at this.beamY
        game.hazards.push(new Hazard('boss_beam', WALL_L, this.beamY - 8, WALL_R - WALL_L, 16, 0.8));
        AudioSys.explode();
        game.shake = 8;
      }
    }
    if (this.attackTimer <= 0) {
      this.doAttack(game);
      // Faster cadence in later phases
      const base = this.phase === 1 ? 3.5 : (this.phase === 2 ? 2.6 : 1.8);
      this.attackTimer = base + rand(-0.3, 0.3);
    }
    this.flash = Math.max(0, this.flash - dt);
  }

  doAttack(game) {
    const choices = this.phase === 1 ? [0, 1] : this.phase === 2 ? [0, 1, 2] : [0, 1, 2, 2];
    const a = choices[randi(0, choices.length - 1)];
    if (a === 0) {
      // Spawn 1-2 bouncing balls
      const count = this.phase >= 2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const types: BallType[] = ['normal','normal','electric','explosive'];
        const type = types[randi(0, types.length - 1)];
        game.balls.push(new Ball(this.x + rand(-30, 30), this.y + 30, 2, type, rand(-160, 160), 0));
      }
      AudioSys.warning();
    } else if (a === 1) {
      // Telegraphed downward projectile from boss center
      const warnX = this.x;
      game.hazards.push(new Hazard('boss_warning', warnX - 8, this.y + 30, 16, GROUND_Y - this.y - 30, 0.5));
      setTimeout(() => {
        if (this.dead) return;
        game.hazards.push(new Hazard('boss_beam', warnX - 10, this.y + 30, 20, GROUND_Y - this.y - 30, 0.4));
        AudioSys.explode();
        game.shake = 6;
      }, 500);
    } else if (a === 2) {
      // Sweep beam: choose a Y between mid and floor, warn, then fire horizontal beam
      this.beamY = rand(GROUND_Y - 160, GROUND_Y - 40);
      game.hazards.push(new Hazard('boss_warning', WALL_L, this.beamY - 8, WALL_R - WALL_L, 16, 0.9));
      this.beamCharge = 0.9;
      AudioSys.warning();
    }
  }

  hit(game, damage = 1) {
    this.hp -= damage;
    this.flash = 0.2;
    AudioSys.bossHit();
    game.particles.push(new Particle(this.x, this.y, rand(-100,100), rand(-100,100), 0.5, '#fff', 6));
    if (this.hp <= 0) {
      this.dead = true;
      AudioSys.explode();
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(80, 400);
        game.particles.push(new Particle(this.x + rand(-30,30), this.y + rand(-20,20), Math.cos(a)*s, Math.sin(a)*s, rand(0.5,1.2), i%2?'#ff2b88':'#ffd60a', 10, 200));
      }
      game.shake = 30;
      game.flash = 0.4;
    }
  }

  /** Check if a projectile collides with the weak point (boss core). */
  collides(proj) {
    if (this.dead) return false;
    if (proj.type === 'harpoon' || proj.type === 'laser') {
      if (proj.x > this.x - this.r * 0.9 && proj.x < this.x + this.r * 0.9
          && proj.tipY < this.y + this.r * 0.7) return true;
    } else if (proj.type === 'bullet' || proj.type === 'pellet' || proj.type === 'shuriken' || proj.type === 'bomb') {
      const dx = proj.x - this.x, dy = proj.y - this.y;
      const rr = this.r + (proj.r || 0);
      if (dx*dx + dy*dy < rr * rr) return true;
    } else if (proj.type === 'flame') {
      const dx = proj.x - this.x, dy = proj.y - this.y;
      if (dx*dx + dy*dy < (this.r + proj.r) * (this.r + proj.r)) return true;
    }
    return false;
  }

  draw(ctx) {
    if (this.dead) return;
    // Saucer
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.filter = 'brightness(2)';
    // Lower hull
    ctx.fillStyle = '#5a3a8a';
    ctx.beginPath();
    ctx.ellipse(0, 10, this.r, this.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c0033'; ctx.lineWidth = 3; ctx.stroke();
    // Dome
    ctx.fillStyle = '#ff2b88';
    ctx.beginPath();
    ctx.ellipse(0, -10, this.r * 0.55, this.r * 0.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // Glass
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-this.r * 0.2, -14, this.r * 0.15, this.r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye / weak point
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(0, -4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }
}
