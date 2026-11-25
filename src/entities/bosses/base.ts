import { GROUND_Y, type Rect } from '../../constants';
import { AudioSys } from '../../systems/audio';
import { rand } from '../../utils';
import { Hazard } from '../hazard';
import { FloatingText, Particle, Shockwave, pushText } from '../particle';
import type { Projectile } from '../projectile';
import type { Game } from '../../game';

// ============================ BOSS BASE =============================
// Shared skeleton for every boss: an intro beat, a deterministic action
// queue (no setTimeout — everything runs on simulation time, so pausing,
// hit-stop and the Freeze pickup all behave), damage bookkeeping, and a
// drawn-out death sequence. Each boss supplies its own body, attacks and the
// rule for how it can be hurt.

export type BossKind = 'globo' | 'volta' | 'rift';

const DEATH_TIME = 2.1;

interface Pending { t: number; fn: () => void; }

export abstract class Boss {
  abstract kind: BossKind;
  abstract name: string;
  x = 480;
  y = 130;
  r = 60;
  hp = 1;
  maxHp = 1;
  dead = false;
  phase = 1;
  flash = 0;
  /** Seconds of entrance remaining. The boss is harmless and untouchable
   *  until it hits 0, and the level clock is held. */
  introT = 2.6;
  /** Seconds into the death sequence, or -1 while alive. */
  dying = -1;
  /** Boss-local clock (advances with simulation time). */
  t = 0;
  private pending: Pending[] = [];
  private deathBoomT = 0;
  private lastNoEffect = -9;

  /** True while the boss can hurt and be hurt. */
  get active() { return this.introT <= 0 && this.dying < 0 && !this.dead; }

  /** Run `fn` after `delay` seconds of simulation time. */
  protected after(delay: number, fn: () => void) {
    this.pending.push({ t: delay, fn });
  }

  update(dt: number, game: Game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.introT > 0) {
      const before = this.introT;
      this.introT -= dt;
      this.updateIntro(dt, game);
      if (before > 0 && this.introT <= 0) this.onIntroEnd(game);
      return;
    }
    if (this.dying >= 0) {
      this.dying += dt;
      this.deathBoomT -= dt;
      if (this.deathBoomT <= 0) {
        this.deathBoomT = 0.13;
        const p = this.deathPoint();
        game.shockwaves.push(new Shockwave(p.x, p.y, rand(40, 90), Math.random() < 0.5 ? '#ffd60a' : '#ff7733', 0.3));
        for (let i = 0; i < 9; i++) {
          const a = Math.random() * Math.PI * 2, s = rand(120, 380);
          game.particles.push(new Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), i % 2 ? '#fff' : '#ffb347', 7, 200, 2.5, i % 2 === 0));
        }
        game.shake = Math.max(game.shake, 7);
        AudioSys.explode(false);
      }
      this.updateDying(dt, game);
      if (this.dying >= DEATH_TIME) {
        this.dead = true;
        const p = this.deathPoint();
        game.shockwaves.push(new Shockwave(p.x, p.y, 340, '#ffffff', 0.7));
        game.shockwaves.push(new Shockwave(p.x, p.y, 220, '#ffd60a', 0.55));
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, s = rand(100, 560);
          game.particles.push(new Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.2), ['#fff', '#ffd60a', '#ff7733', '#ff36c4'][i % 4], 9, 220, 1.8, i % 3 === 0));
        }
        game.shake = 30;
        game.flash = 0.55;
        AudioSys.explode(true);
        AudioSys.sfx('stinger/boss_defeated', 0.95);
        this.onDeath(game);
      }
      return;
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
    }
    this.updateAlive(dt, game);
  }

  /** Apply damage. Returns true if it landed. */
  damage(game: Game, amount: number, x = this.x, y = this.y): boolean {
    if (!this.active || amount <= 0) return false;
    this.hp -= amount;
    this.flash = 0.16;
    AudioSys.bossHit();
    game.addScore(40 * amount);
    for (let i = 0; i < 4 + amount; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(120, 320);
      game.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.45), i % 2 ? '#fff' : '#ffd60a', 5, 100, 3, true));
    }
    if (amount >= 3) {
      const ft = new FloatingText(x, y - 14, '-' + amount, '#ffd60a', 14 + Math.min(10, amount));
      ft.life = 0.6; ft.maxLife = 0.6;
      game.floatingTexts.push(ft);
      game.hitPause = Math.max(game.hitPause, 0.05);
      game.shake = Math.max(game.shake, 4 + amount);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.startDying(game);
    } else {
      this.onDamaged(game, amount);
    }
    return true;
  }

  protected startDying(game: Game) {
    if (this.dying >= 0) return;
    this.dying = 0;
    this.pending.length = 0;
    // Clear the air: attacks in flight are cancelled so the victory is clean.
    for (const h of game.hazards) if (h.type === 'boss_beam' || h.type === 'boss_warning') h.dead = true;
    game.slowTime = Math.max(game.slowTime, 1.2);
    AudioSys.sfx('boss/death_sequence', 0.9);
    AudioSys.setMusicVolume(0.35);
  }

  /** "That did nothing" feedback, rate-limited so a stream of deflected shots
   *  reads as one message rather than a wall of text. */
  protected noEffect(game: Game, x: number, y: number, label = 'SHIELDED') {
    AudioSys.sfx('boss/hit_armor', 0.6, 90) || AudioSys.beep(1400, 0.04, 'square', 0.12);
    for (let i = 0; i < 4; i++) {
      game.particles.push(new Particle(x, y, rand(-180, 180), rand(-60, 220), rand(0.15, 0.3), '#cfe9ff', 4, 300, 2, true));
    }
    if (this.t - this.lastNoEffect > 1.4) {
      this.lastNoEffect = this.t;
      const ft = pushText(game.floatingTexts, new FloatingText(x, y + 26, label, '#9be7ff', 14), 'bossfx', 0.8);
      ft.rise = 20;
    }
  }

  /** Telegraphed vertical strike: a warning column, then the beam. */
  protected strikeColumn(game: Game, x: number, w: number, warn: number, top = this.y, life = 0.35) {
    game.hazards.push(new Hazard('boss_warning', x - w / 2, top, w, GROUND_Y - top, warn));
    this.after(warn, () => {
      game.hazards.push(new Hazard('boss_beam', x - w / 2, top, w, GROUND_Y - top, life));
      AudioSys.explode(false);
      game.shake = Math.max(game.shake, 5);
    });
  }

  // ---- overridable hooks ----
  protected updateIntro(_dt: number, _game: Game) { /* default: nothing */ }
  protected onIntroEnd(_game: Game) { /* default: nothing */ }
  protected updateDying(_dt: number, _game: Game) { /* default: nothing */ }
  protected onDamaged(_game: Game, _amount: number) { /* default: nothing */ }
  protected onDeath(_game: Game) { /* default: nothing */ }
  /** Where the next death-sequence explosion goes off. */
  protected deathPoint() { return { x: this.x + rand(-this.r, this.r), y: this.y + rand(-this.r * 0.6, this.r * 0.6) }; }

  protected abstract updateAlive(dt: number, game: Game): void;
  abstract draw(ctx: CanvasRenderingContext2D, t: number): void;
  /** Resolve a projectile against the boss. Return true if it struck (the
   *  caller then consumes non-piercing shots). */
  abstract hitBy(game: Game, proj: Projectile): boolean;
  /** Lethal body contact against a player hurtbox. */
  abstract touches(hb: Rect): boolean;

  /** A bomb ball / bomb weapon went off at (x, y) with the given radius. */
  onBlast(game: Game, x: number, y: number, radius: number) {
    if (Math.hypot(this.x - x, this.y - y) < radius + this.r * 0.8) this.damage(game, 5, this.x, this.y);
  }
  /** Nearest point an electric arc starting at (x, y) could reach. */
  arcTarget(x: number, y: number, range: number): { x: number; y: number; d: number } | null {
    if (!this.active) return null;
    const d = Math.hypot(this.x - x, this.y - y) - this.r;
    return d < range ? { x: this.x, y: this.y + this.r * 0.4, d } : null;
  }
  onArc(game: Game, x: number, y: number) { this.damage(game, 3, x, y); }
  /** Is any part of the boss above column x? (Touch PopShot auto-trigger.) */
  inColumn(x: number): boolean { return this.active && Math.abs(x - this.x) < this.r; }
}

/** Damage a projectile type deals to a boss body. */
export function shotDamage(type: string): number {
  switch (type) {
    case 'popshot': return 8;
    case 'laser': return 3;
    case 'shuriken': return 2;
    case 'bomb': return 0;       // bombs explode; onBlast handles it
    default: return 1;
  }
}

/** Does a projectile overlap a circle of radius r at (cx, cy)? */
export function shotHitsCircle(p: Projectile, cx: number, cy: number, r: number): boolean {
  if (p.type === 'harpoon' || p.type === 'grapple' || p.type === 'laser' || p.type === 'popshot') {
    const half = (p.w || 6) / 2;
    if (Math.abs(p.x - cx) > r + half) return false;
    // Vertical segment tipY..startY vs circle: clamp the circle centre onto it.
    const yy = Math.max(p.tipY, Math.min(p.startY, cy));
    const dx = Math.max(0, Math.abs(p.x - cx) - half), dy = yy - cy;
    return dx * dx + dy * dy < r * r;
  }
  const pr = p.r || 5;
  const dx = p.x - cx, dy = p.y - cy;
  return dx * dx + dy * dy < (r + pr) * (r + pr);
}

export function circleTouchesRect(cx: number, cy: number, r: number, hb: Rect): boolean {
  const nx = Math.max(hb.x, Math.min(hb.x + hb.w, cx));
  const ny = Math.max(hb.y, Math.min(hb.y + hb.h, cy));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
