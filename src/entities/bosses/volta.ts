import { CEILING_Y, GROUND_Y, W, WALL_L, WALL_R, type Rect } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { gchance, grand, grandi } from '../../systems/rng';
import { INK } from '../../rendering/theme';
import { clamp, rand } from '../../utils';
import { Ball } from '../ball';
import { Bolt, FloatingText, Particle, Shockwave, pushText } from '../particle';
import type { Projectile } from '../projectile';
import type { Game } from '../../game';
import { Boss, circleTouchesRect, shotDamage, shotHitsCircle, type BossKind } from './base';

// ============================ VOLTA =================================
// The Storm Engine. A tesla machine riding a rail under the ceiling, wrapped
// in a shield your harpoons simply bounce off. It cannot be shot down.
//
// It CAN be blown up with its own ammunition: VOLTA feeds bomb balls into the
// arena, and a bomb that detonates beside it tears the shield open (OVERLOAD)
// for a few seconds of direct fire. Electric balls popped underneath it arc
// straight through the shield for chip damage.
//
// The fight turns the player's reflex inside out: instead of "pop everything
// as fast as possible" it is "light that fuse at the right moment so the ball
// is at the top of its bounce, under the boss, when it goes off".

const SHIELD_DOWN_TIME = 4.6;

export class Volta extends Boss {
  kind: BossKind = 'volta';
  name = 'VOLTA — THE STORM ENGINE';
  private vx = 60;
  /** >0 while the shield is down. */
  overload = 0;
  private attackT = 3.2;
  private cellT = 1.2;
  private sparkT = 5;
  private shieldSpin = 0;
  private hinted = false;

  constructor() {
    super();
    this.maxHp = 40;
    this.hp = 40;
    this.r = 46;
    this.x = W / 2;
    this.y = -80;
    this.introT = 2.4;
  }

  private get restY() { return CEILING_Y + 78; }

  protected updateIntro(dt: number) {
    this.y += (this.restY - this.y) * Math.min(1, dt * 2.6);
    this.shieldSpin += dt * 1.2;
  }
  protected onIntroEnd(game: Game) {
    this.y = this.restY;
    pushText(game.floatingTexts, new FloatingText(W / 2, 220, 'SHOTS BOUNCE OFF ITS SHIELD', '#9be7ff', 18), 'bosshint', 2.6).rise = 6;
    pushText(game.floatingTexts, new FloatingText(W / 2, 246, 'light a bomb ball so it bursts beside it', '#fff', 15, 'ui'), 'bosshint2', 2.6).rise = 6;
  }

  protected updateAlive(dt: number, game: Game) {
    this.shieldSpin += dt * (this.overload > 0 ? 0.2 : 1.2 + this.phase * 0.3);
    // Rail drift. Slower while overloaded — it is stunned.
    const speed = (this.overload > 0 ? 0.25 : 1) * (1 + (this.phase - 1) * 0.25);
    this.x += this.vx * speed * dt;
    if (this.x < 150) { this.x = 150; this.vx = Math.abs(this.vx); }
    if (this.x > W - 150) { this.x = W - 150; this.vx = -Math.abs(this.vx); }
    this.y = this.restY + Math.sin(this.t * 1.6) * 6;

    if (this.overload > 0) {
      this.overload -= dt;
      if (this.overload <= 0) {
        AudioSys.sfx('boss/phase_intro', 0.6);
        game.shockwaves.push(new Shockwave(this.x, this.y, this.r + 40, '#9be7ff', 0.35));
      }
    }

    // ---- Ammunition feed: always keep a bomb ball in play ----
    this.cellT -= dt;
    const bombs = game.balls.filter(b => !b.dead && b.type === 'explosive').length;
    if (this.cellT <= 0 && bombs < (this.phase >= 2 ? 2 : 1) && this.overload <= 0) {
      this.cellT = 3.6 - this.phase * 0.4;
      const dir = gchance(0.5) ? -1 : 1;
      const b = new Ball(this.x, this.y + this.r + 20, 3, 'explosive', dir * 115, 80);
      b.bornT = 0.16;
      game.balls.push(b);
      AudioSys.sfx('boss/spawn_ball', 0.8) || AudioSys.beep(220, 0.14, 'sine', 0.25, 160);
      game.shockwaves.push(new Shockwave(this.x, this.y + this.r, 50, '#ff7733', 0.25));
    }
    // ---- Electric sparks: chip-damage fodder, and chain fuel ----
    this.sparkT -= dt;
    const sparks = game.balls.filter(b => !b.dead && b.type === 'electric').length;
    if (this.sparkT <= 0 && sparks === 0 && game.balls.length < 6) {
      this.sparkT = 7.5 - this.phase;
      const dir = gchance(0.5) ? -1 : 1;
      const b = new Ball(this.x - dir * 30, this.y + this.r + 16, 2, 'electric', dir * 140, 60);
      b.bornT = 0.16;
      game.balls.push(b);
    }

    // ---- Lightning ----
    this.attackT -= dt;
    if (this.attackT <= 0 && this.overload <= 0) {
      const target = game.getLivingPlayers()[0];
      const px = target ? target.x : W / 2;
      const roll = this.phase === 1 ? 0 : grandi(0, this.phase === 2 ? 1 : 2);
      AudioSys.sfx('boss/laser_charge', 0.7) || AudioSys.warning();
      if (roll === 0) {
        // Strike: one bolt on the player, plus flankers in later phases.
        this.strikeColumn(game, px, 36, 0.75, CEILING_Y);
        if (this.phase >= 2) this.after(0.28, () => this.strikeColumn(game, clamp(px + (gchance(0.5) ? -1 : 1) * 130, WALL_L + 30, WALL_R - 30), 36, 0.7, CEILING_Y));
      } else if (roll === 1) {
        // Storm wall: the arena lights up in bands, with one band left dark.
        const bands = 5;
        const bw = (WALL_R - WALL_L) / bands;
        // The dark lane is always the player's own band or a neighbour —
        // reachable on foot inside the warning, never a coin-flip across the arena.
        const pb = clamp(Math.floor((px - WALL_L) / bw), 0, bands - 1);
        const safe = clamp(pb + grandi(-1, 1), 0, bands - 1);
        for (let i = 0; i < bands; i++) {
          if (i === safe) continue;
          this.strikeColumn(game, WALL_L + bw * (i + 0.5), bw - 26, 1.15, CEILING_Y, 0.4);
        }
      } else {
        // Walking barrage: bolts march across the floor toward the player.
        const from = px < W / 2 ? WALL_R - 60 : WALL_L + 60;
        const dir = px < W / 2 ? -1 : 1;
        for (let i = 0; i < 6; i++) {
          const cx = from + dir * i * 135;
          if (cx < WALL_L + 20 || cx > WALL_R - 20) continue;
          this.after(i * 0.3, () => this.strikeColumn(game, cx, 44, 0.6, CEILING_Y, 0.3));
        }
      }
      this.attackT = (this.phase === 1 ? 3.6 : this.phase === 2 ? 3.0 : 2.5) + grand(-0.3, 0.3);
    }
  }

  protected onDamaged(game: Game) {
    const ratio = this.hp / this.maxHp;
    const next = ratio < 0.34 ? 3 : ratio < 0.67 ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      AudioSys.sfx('boss/phase_intro', 0.9);
      game.shake = Math.max(game.shake, 12);
      pushText(game.floatingTexts, new FloatingText(W / 2, 200, next === 2 ? 'VOLTA SURGES!' : 'CRITICAL VOLTAGE!', '#ffe14a', 26), 'bosshint', 1.4);
    }
  }

  /** A blast beside the engine rips the shield off. */
  onBlast(game: Game, x: number, y: number, radius: number) {
    if (!this.active) return;
    if (Math.hypot(this.x - x, this.y - y) > radius + this.r * 0.8) return;
    this.damage(game, 7, this.x, this.y);
    if (this.dying >= 0) return;
    this.overload = SHIELD_DOWN_TIME;
    this.attackT = Math.max(this.attackT, 1.4);
    game.flash = Math.max(game.flash, 0.25);
    game.shockwaves.push(new Shockwave(this.x, this.y, 150, '#9be7ff', 0.5));
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(160, 380);
      game.particles.push(new Particle(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.6), '#9be7ff', 7, 300, 2, i % 2 === 0));
    }
    pushText(game.floatingTexts, new FloatingText(this.x, this.y + this.r + 34, 'OVERLOAD — FIRE!', '#ffd60a', 24), 'bosshint', 1.6).rise = 8;
    if (!this.hinted) { this.hinted = true; }
  }

  onArc(game: Game, x: number, y: number) {
    this.damage(game, 3, x, y);
    game.bolts.push(new Bolt(this.x - 30, this.y, this.x + 30, this.y, '#9be7ff', 3, 0.2));
  }

  hitBy(game: Game, proj: Projectile): boolean {
    if (!this.active) return false;
    const shieldR = this.overload > 0 ? this.r : this.r + 16;
    if (!shotHitsCircle(proj, this.x, this.y, shieldR)) return false;
    const hy = Math.min(this.y + shieldR, proj.type === 'bullet' || proj.type === 'pellet' ? proj.y : this.y + shieldR);
    if (proj.type === 'popshot') {
      // The PopShot is the one shot that punches through: big damage AND it
      // knocks the shield down.
      this.damage(game, 8, proj.x, hy);
      if (this.dying < 0) this.overload = Math.max(this.overload, SHIELD_DOWN_TIME * 0.7);
      return true;
    }
    if (this.overload > 0) {
      const dmg = shotDamage(proj.type);
      if (dmg > 0) this.damage(game, dmg, proj.x, hy);
      return true;
    }
    this.noEffect(game, proj.x, hy, 'SHIELDED — USE A BOMB BALL');
    return true;
  }

  touches(hb: Rect): boolean {
    return this.active && circleTouchesRect(this.x, this.y, this.r, hb);
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (this.dead) return;
    const r = this.r;
    const down = this.overload > 0;
    const shake = this.dying >= 0 ? rand(-3, 3) : down ? Math.sin(t * 60) * 1.5 : 0;
    ctx.save();
    ctx.translate(this.x + shake, this.y);
    ctx.lineJoin = 'round';
    if (this.flash > 0) ctx.filter = 'brightness(1.8)';

    // Rail hanger up to the ceiling.
    ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, CEILING_Y - this.y - 2); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -r * 0.7); ctx.lineTo(-4, CEILING_Y - this.y); ctx.moveTo(4, -r * 0.7); ctx.lineTo(4, CEILING_Y - this.y); ctx.stroke();

    // Chassis — a fat capacitor drum.
    const body = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    body.addColorStop(0, '#6b7c93');
    body.addColorStop(0.5, '#3d4a5c');
    body.addColorStop(1, '#232c39');
    ctx.fillStyle = body;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.86, -r * 0.5); ctx.lineTo(r * 0.86, -r * 0.5);
    ctx.lineTo(r, 0); ctx.lineTo(r * 0.7, r * 0.6); ctx.lineTo(-r * 0.7, r * 0.6); ctx.lineTo(-r, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Copper coil bands.
    ctx.strokeStyle = '#d98a3a'; ctx.lineWidth = 4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-r * 0.78, i * r * 0.2 - r * 0.02); ctx.lineTo(r * 0.78, i * r * 0.2 - r * 0.02); ctx.stroke();
    }
    // Twin electrodes underneath, arcing between them.
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#cfd8e3'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s * r * 0.48, r * 0.72, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (!down && this.dying < 0) {
      const tick = Math.floor(t * 20);
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, r * 0.72);
      for (let i = 1; i < 5; i++) {
        const h = Math.sin((tick + i * 17) * 12.9898) * 43758.5453;
        ctx.lineTo(-r * 0.48 + (i / 5) * r * 0.96, r * 0.72 + ((h - Math.floor(h)) - 0.5) * 14);
      }
      ctx.lineTo(r * 0.48, r * 0.72);
      ctx.stroke();
    }
    // The eye: a round gauge. Calm cyan when shielded, panicked spinning red
    // when overloaded.
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 0.34, 0, Math.PI * 2); ctx.fill();
    const iris = ctx.createRadialGradient(-2, -r * 0.06, 1, 0, -r * 0.02, r * 0.3);
    iris.addColorStop(0, '#fff');
    iris.addColorStop(0.4, down ? '#ff8a5c' : '#9be7ff');
    iris.addColorStop(1, down ? '#c8102e' : '#1b6ca8');
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const needle = down ? t * 18 : -Math.PI / 2 + Math.sin(t * 2) * 0.6;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.02); ctx.lineTo(Math.cos(needle) * r * 0.22, -r * 0.02 + Math.sin(needle) * r * 0.22); ctx.stroke();
    // Angry brow plate.
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath();
    if (down) { ctx.moveTo(-r * 0.4, -r * 0.5); ctx.lineTo(-r * 0.1, -r * 0.42); ctx.moveTo(r * 0.4, -r * 0.5); ctx.lineTo(r * 0.1, -r * 0.42); }
    else { ctx.moveTo(-r * 0.42, -r * 0.48); ctx.lineTo(-r * 0.08, -r * 0.36); ctx.moveTo(r * 0.42, -r * 0.48); ctx.lineTo(r * 0.08, -r * 0.36); }
    ctx.stroke();
    ctx.filter = 'none';

    // ---- Shield: six orbiting hex plates. Gone while overloaded. ----
    if (this.dying < 0) {
      const sr = r + 16;
      if (!down) {
        ctx.globalAlpha = 0.13 + Math.sin(t * 5) * 0.04;
        ctx.fillStyle = '#9be7ff';
        ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
          const a = this.shieldSpin + (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * sr, py = Math.sin(a) * sr;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = 'rgba(155,231,255,0.85)';
          ctx.strokeStyle = INK; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-13, 0); ctx.lineTo(-7, -6); ctx.lineTo(7, -6); ctx.lineTo(13, 0); ctx.lineTo(7, 6); ctx.lineTo(-7, 6);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      } else {
        // Countdown ring: how long the window stays open.
        const k = clamp(this.overload / SHIELD_DOWN_TIME, 0, 1);
        ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, sr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
