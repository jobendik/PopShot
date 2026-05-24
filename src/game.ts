import { BALL_COLORS, BALL_SCORE, CEILING_Y, GROUND_Y, H, State, THEMES, W, WALL_L, WALL_R, type BallType, type GameMode, type GameState, type ThemeName } from './constants';
import { LEVELS } from './data/levels';
import { Ball } from './entities/ball';
import { Boss } from './entities/boss';
import { Crab } from './entities/crab';
import { Destructible } from './entities/destructible';
import { Hazard } from './entities/hazard';
import { Particle, FloatingText, SmokeCloud } from './entities/particle';
import { Pickup } from './entities/pickup';
import { Platform } from './entities/platform';
import { Player } from './entities/player';
import { Projectile } from './entities/projectile';
import { AudioSys } from './systems/audio';
import { keysPressed, consumePressed } from './systems/input';
import { Storage } from './systems/storage';
import { drawBackground, drawDemoBall, roundRect } from './rendering/canvas';
import { clamp, collideCircleRect, rand, randi, rectOverlap } from './utils';

// ============================ GAME ==================================
export interface LevelSummary {
  base: number;
  time: number;
  accuracy: number;
  combo: number;
  noMiss: number;
  total: number;
  best: number;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState;
  t: number;
  lastTime: number;
  mode: GameMode;
  levelIndex: number;
  unlockedLevel: number;
  player: Player | null;
  player2: Player | null;
  balls: Ball[];
  projectiles: Projectile[];
  pickups: Pickup[];
  platforms: Platform[];
  destructibles: Destructible[];
  hazards: Hazard[];
  particles: Particle[];
  smokeClouds: SmokeCloud[];
  floatingTexts: FloatingText[];
  crabs: Crab[];
  boss: Boss | null;
  score: number;
  lives: number;
  timer: number;
  combo: number;
  maxCombo: number;
  shotsHit: number;
  shotsFired: number;
  comboDecay: number;
  theme: ThemeName;
  targetScore: number;
  levelName: string;
  bossLevel: boolean;
  shake: number;
  flash: number;
  slowTime: number;
  freezeTime: number;
  magnetTime: number;
  comboBoostTime: number;
  hitPause: number;
  bossDefeatedTimer: number;
  lastTimerWarning: number;
  accumulator: number;
  fixedStep: number;
  panicWave: number;
  panicSpawnTimer: number;
  menuIndex: number;
  levelSelectIndex: number;
  modeSelectIndex: number;
  introTimer: number;
  introText: string;
  summary: LevelSummary | null;
  constructor() {
    const canvas = document.getElementById('game');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected #game canvas element to exist.');
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context is not available.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = State.MAIN_MENU;
    this.t = 0;     // time in seconds
    this.lastTime = 0;

    // Modes
    this.mode = 'tour';            // 'tour' | 'score_attack' | 'panic'
    this.levelIndex = 0;
    this.unlockedLevel = 0;        // for Tour level select

    // Run state
    this.player = null;
    this.player2 = null;
    this.balls = [];
    this.projectiles = [];
    this.pickups = [];
    this.platforms = [];
    this.destructibles = [];
    this.hazards = [];
    this.particles = [];
    this.smokeClouds = [];
    this.floatingTexts = [];
    this.crabs = [];
    this.boss = null;

    // Stats
    this.score = 0;
    this.lives = 3;
    this.timer = 60;
    this.combo = 0;
    this.maxCombo = 0;
    this.shotsHit = 0;
    this.shotsFired = 0;
    this.comboDecay = 0;
    this.theme = 'beach';
    this.targetScore = 0;
    this.levelName = '';
    this.bossLevel = false;

    // Effects
    this.shake = 0;
    this.flash = 0;
    this.slowTime = 0;  // seconds of slow-mo
    this.freezeTime = 0;
    this.magnetTime = 0;
    this.comboBoostTime = 0;
    this.hitPause = 0;
    this.bossDefeatedTimer = 0;
    this.lastTimerWarning = 0;
    this.accumulator = 0;
    this.fixedStep = 1 / 60;

    // Panic mode
    this.panicWave = 0;
    this.panicSpawnTimer = 0;

    // Menu
    this.menuIndex = 0;
    this.levelSelectIndex = 0;
    this.modeSelectIndex = 0;

    // Tutorial banner state
    this.introTimer = 0;
    this.introText = '';

    // Level clear summary
    this.summary = null;
  }

  // ------------------- STATE TRANSITIONS -------------------
  startTour(levelIndex = 0) {
    this.mode = 'tour';
    this.lives = 3;
    this.score = 0;
    this.loadLevel(levelIndex);
  }

  startScoreAttack() {
    this.mode = 'score_attack';
    this.lives = 3;
    this.score = 0;
    this.loadLevel(0);
  }

  startPanic() {
    this.mode = 'panic';
    this.lives = 3;
    this.score = 0;
    this.panicWave = 0;
    this.theme = 'boss';
    this.levelName = 'Panic Wave 1';
    this.targetScore = 0;
    this.timer = 999;
    this.balls = []; this.projectiles = []; this.pickups = [];
    this.platforms = []; this.destructibles = []; this.hazards = [];
    this.particles = []; this.smokeClouds = []; this.floatingTexts = []; this.crabs = [];
    this.player = new Player(W / 2, GROUND_Y - 0);
    this.player2 = null;
    this.boss = null;
    this.bossLevel = false;
    this.state = State.PLAYING;
    this.advancePanicWave();
  }

  advancePanicWave() {
    this.panicWave++;
    this.levelName = 'Panic Wave ' + this.panicWave;
    AudioSys.levelClear();
    this.floatingTexts.push(new FloatingText(W / 2, H / 2, 'WAVE ' + this.panicWave, '#ffd60a', 48));
    // Spawn a wave: difficulty scales
    const count = Math.min(2 + Math.floor(this.panicWave / 2), 8);
    const minSize = clamp(2 - Math.floor(this.panicWave / 5), 0, 2);
    const maxSize = clamp(3 + Math.floor(this.panicWave / 4), 3, 4);
    const specials: BallType[] = ['normal','normal','electric','explosive','smoke','sludge','armored','lava'];
    for (let i = 0; i < count; i++) {
      const size = randi(minSize, maxSize);
      const types: BallType[] = this.panicWave < 3 ? ['normal'] : specials.slice(0, Math.min(specials.length, 2 + Math.floor(this.panicWave / 2)));
      const type = types[randi(0, types.length - 1)];
      this.balls.push(new Ball(rand(80, W - 80), CEILING_Y + 40, size, type, rand(-150, 150), 0));
    }
    if (this.panicWave % 3 === 0) {
      this.pickups.push(new Pickup(W / 2 + rand(-200, 200), H / 2, 'shield'));
    }
    if (this.panicWave % 5 === 0) {
      this.hazards.push(new Hazard('falling_rock', rand(80, W - 120), CEILING_Y + 10, 28, 28, 6));
    }
  }

  loadLevel(index) {
    if (index >= LEVELS.length) {
      // Cleared the campaign
      this.state = State.VICTORY;
      return;
    }
    const L = LEVELS[index];
    this.levelIndex = index;
    this.theme = L.theme;
    this.timer = L.timeLimit;
    this.targetScore = L.targetScore;
    this.levelName = L.name;
    this.bossLevel = !!L.boss;
    this.introText = L.intro || '';
    this.introTimer = L.intro ? 4 : 0;

    this.balls = L.balls.map(b => new Ball(b.x, b.y, b.size, b.type || 'normal', b.vx || 0, b.vy || 0));
    this.platforms = (L.platforms || []).map(p => new Platform(p.x, p.y, p.w, p.h, p));
    this.destructibles = (L.destructibles || []).map(d => new Destructible(d.x, d.y, d.w, d.h, d.contains));
    this.pickups = (L.pickups || []).map(p => new Pickup(p.x, p.y, p.type));
    this.hazards = (L.hazards || []).map(h => new Hazard(h.type, h.x, h.y, h.w, h.h, h.life ?? 999));
    this.projectiles = [];
    this.particles = [];
    this.smokeClouds = [];
    this.floatingTexts = [];
    this.crabs = (L.crabs || []).map(c => new Crab(c.x, (c as any).y ?? GROUND_Y, c.minX, c.maxX, c.speed));
    this.combo = 0; this.maxCombo = 0;
    this.shotsHit = 0; this.shotsFired = 0;
    this.shake = 0; this.flash = 0; this.slowTime = 0; this.freezeTime = 0; this.magnetTime = 0; this.comboBoostTime = 0; this.hitPause = 0;
    this.bossDefeatedTimer = 0; this.lastTimerWarning = 0;
    this.player = new Player(W / 2, GROUND_Y);
    this.player2 = null;
    this.boss = L.boss ? new Boss() : null;
    this.state = State.PLAYING;
  }

  // ------------------- GAME EVENTS -------------------
  addScore(n) {
    this.score += n;
  }

  getLivingPlayers() {
    return [this.player, this.player2].filter((p): p is Player => !!p && !p.dead);
  }

  joinPlayer2() {
    if (this.player2 || this.state !== State.PLAYING) return;
    this.player2 = new Player(W / 2 + 64, GROUND_Y, true);
    this.player2.invuln = 2;
    this.floatingTexts.push(new FloatingText(W / 2, H / 2 + 46, 'PLAYER 2 JOINED', '#9be7ff', 24));
    AudioSys.pickup();
  }

  respawnPlayer(player: Player) {
    player.x = player.isP2 ? W / 2 + 64 : W / 2 - 64;
    player.y = GROUND_Y;
    player.vx = 0;
    player.dead = false;
    player.respawnTimer = 0;
    player.invuln = 2;
    player.setWeapon('harpoon');
  }

  saveRunBest() {
    if (this.mode === 'score_attack' && this.score > Storage.data.bestScoreAttack) {
      Storage.data.bestScoreAttack = this.score;
      Storage.save();
    }
    if (this.mode === 'panic') {
      if (this.panicWave - 1 > Storage.data.bestPanicWave) Storage.data.bestPanicWave = this.panicWave - 1;
      if (this.score > Storage.data.bestPanicScore) Storage.data.bestPanicScore = this.score;
      Storage.save();
    }
  }

  /** Internal: pop a ball with proper effects and chaining. */
  _popBall(ball, source) {
    if (ball.dead) return;
    const baseScore = BALL_SCORE[ball.size];
    const boost = this.comboBoostTime > 0 ? 0.5 : 0;
    const comboMult = 1 + boost + Math.min(this.combo, 20) * 0.05;
    const gained = Math.round(baseScore * comboMult);
    this.addScore(gained);
    this.floatingTexts.push(new FloatingText(ball.x, ball.y - 10, '+' + gained, this.combo >= 5 ? '#ffd60a' : '#fff'));
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboDecay = 4;
    this.shotsHit++;
    if (source && 'didHit' in source) source.didHit = true;
    AudioSys.pop();

    // Pop particles
    const color = BALL_COLORS[ball.type] ? BALL_COLORS[ball.type][0] : '#fff';
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(80, 220);
      this.particles.push(new Particle(ball.x, ball.y, Math.cos(a)*s, Math.sin(a)*s, rand(0.3, 0.6), color, 6, 100));
    }

    const children = ball.hit(this, source);
    if (children) {
      if (children.length > 0) {
        AudioSys.split();
        this.balls.push(...children);
      }
      ball.dead = true;
    }
    this.hitPause = 0.04;
  }

  explodeProjectile(projectile: Projectile, x: number, y: number) {
    if (projectile.dead) return;
    projectile.dead = true;
    projectile.didHit = true;
    AudioSys.explode();
    this.flash = Math.max(this.flash, 0.18);
    this.shake = Math.max(this.shake, 10);
    const radius = projectile.explosionRadius || 90;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(90, 260);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.35, 0.75), i % 2 ? '#ff5400' : '#ffd60a', 8, 180));
    }
    for (const b of this.balls) {
      if (b.dead) continue;
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < (radius + b.r) * (radius + b.r)) this._popBall(b, projectile);
    }
    for (const d of this.destructibles) {
      if (d.dead) continue;
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      const dx = cx - x, dy = cy - y;
      if (dx * dx + dy * dy < radius * radius) {
        d.dead = true;
        this.addScore(100);
        if (d.contains) this.pickups.push(new Pickup(cx, cy, d.contains));
      }
    }
    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - x, dy = this.boss.y - y;
      if (dx * dx + dy * dy < (radius + this.boss.r) * (radius + this.boss.r)) this.boss.hit(this, 4);
    }
    this.hitPause = 0.06;
  }

  killPlayer(player) {
    if (player.invuln > 0 || player.dead) return;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.0;
      AudioSys.shieldBreak();
      this.flash = 0.15;
      this.shake = 6;
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(120, 250);
        this.particles.push(new Particle(player.x, player.y - 24, Math.cos(a)*s, Math.sin(a)*s, 0.4, '#3a86ff', 5));
      }
      return;
    }
    player.dead = true;
    AudioSys.hurt();
    this.shake = 18; this.flash = 0.3;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(80, 220);
      this.particles.push(new Particle(player.x, player.y - 24, Math.cos(a)*s, Math.sin(a)*s, 0.7, '#ff4d6d', 6, 200));
    }
    this.combo = 0;
    this.lives--;
    if (this.lives <= 0) {
      // Game over
      this.state = State.GAME_OVER;
      this.saveRunBest();
    } else if (this.player2) {
      player.respawnTimer = 1.8;
      this.floatingTexts.push(new FloatingText(player.x, player.y - 42, player.isP2 ? 'P2 DOWN' : 'P1 DOWN', '#ff4d6d', 20));
    } else {
      this.state = State.PLAYER_DEAD;
      this.hitPause = 1.2;
    }
  }

  levelClear() {
    AudioSys.levelClear();
    this.flash = 0.3;
    // Compute bonuses
    const timeBonus = Math.round(this.timer) * 30;
    const accuracy = this.shotsFired > 0 ? (this.shotsHit / this.shotsFired) : 0;
    const accuracyBonus = Math.round(accuracy * 1500);
    const comboBonus = this.maxCombo * 50;
    const noMissBonus = (this.shotsFired === this.shotsHit && this.shotsFired > 0) ? 2000 : 0;
    const total = timeBonus + accuracyBonus + comboBonus + noMissBonus;
    this.addScore(total);

    // Save best
    const L = LEVELS[this.levelIndex];
    if (L) {
      const cur = Storage.data.bestTour[L.id] || 0;
      if (this.score > cur) { Storage.data.bestTour[L.id] = this.score; Storage.save(); }
    }
    this.unlockedLevel = Math.max(this.unlockedLevel, this.levelIndex + 1);
    Storage.data.unlockedLevel = this.unlockedLevel;
    Storage.save();

    this.summary = {
      base: this.score - total,
      time: timeBonus, accuracy: accuracyBonus, combo: comboBonus, noMiss: noMissBonus,
      total: this.score,
      best: L ? (Storage.data.bestTour[L.id] || 0) : 0,
    };

    if (this.bossLevel) {
      this.state = State.LEVEL_CLEAR; // will progress to victory on confirm
    } else {
      this.state = State.LEVEL_CLEAR;
    }
  }

  // ------------------- MAIN LOOP -------------------
  start() {
    requestAnimationFrame(this.frame.bind(this));
  }
  frame(time) {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000) || 0;
    this.lastTime = time;
    this.t += dt;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 5) {
      this.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    this.render();
    requestAnimationFrame(this.frame.bind(this));
  }

  update(dt) {
    // Handle mute toggle universally
    if (consumePressed('KeyM')) AudioSys.toggle();

    switch (this.state) {
      case State.MAIN_MENU:    this.updateMainMenu(); break;
      case State.MODE_SELECT:  this.updateModeSelect(); break;
      case State.LEVEL_SELECT: this.updateLevelSelect(); break;
      case State.HIGH_SCORES:  this.updateHighScores(); break;
      case State.CONTROLS:     this.updateControls(); break;
      case State.CREDITS:      this.updateCredits(); break;
      case State.PLAYING:      this.updatePlaying(dt); break;
      case State.PAUSED:       this.updatePaused(); break;
      case State.LEVEL_CLEAR:  this.updateLevelClear(); break;
      case State.PLAYER_DEAD:  this.updatePlayerDead(dt); break;
      case State.GAME_OVER:    this.updateGameOver(); break;
      case State.BOSS_DEFEATED:this.updateBossDefeated(dt); break;
      case State.VICTORY:      this.updateVictory(); break;
    }

    // Clear per-frame edge buffer
    for (const k in keysPressed) keysPressed[k] = false;
  }

  // ------------------- MENU UPDATES -------------------
  updateMainMenu() {
    const items = 8;
    if (consumePressed('ArrowUp') || consumePressed('KeyW')) { this.menuIndex = (this.menuIndex - 1 + items) % items; AudioSys.menu(); }
    if (consumePressed('ArrowDown') || consumePressed('KeyS')) { this.menuIndex = (this.menuIndex + 1) % items; AudioSys.menu(); }
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      if (this.menuIndex === 0) this.state = State.LEVEL_SELECT;
      else if (this.menuIndex === 1) this.startScoreAttack();
      else if (this.menuIndex === 2) this.startPanic();
      else if (this.menuIndex === 3) this.state = State.MODE_SELECT;
      else if (this.menuIndex === 4) this.state = State.HIGH_SCORES;
      else if (this.menuIndex === 5) this.state = State.CONTROLS;
      else if (this.menuIndex === 6) AudioSys.toggle();
      else if (this.menuIndex === 7) this.state = State.CREDITS;
    }
  }

  updateModeSelect() {
    const items = 4; // Tour, Score Attack, Panic, Back
    if (consumePressed('ArrowUp') || consumePressed('KeyW')) { this.modeSelectIndex = (this.modeSelectIndex - 1 + items) % items; AudioSys.menu(); }
    if (consumePressed('ArrowDown') || consumePressed('KeyS')) { this.modeSelectIndex = (this.modeSelectIndex + 1) % items; AudioSys.menu(); }
    if (consumePressed('Escape')) { this.state = State.MAIN_MENU; AudioSys.menu(); }
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      if (this.modeSelectIndex === 0) this.state = State.LEVEL_SELECT;
      else if (this.modeSelectIndex === 1) this.startScoreAttack();
      else if (this.modeSelectIndex === 2) this.startPanic();
      else if (this.modeSelectIndex === 3) this.state = State.MAIN_MENU;
    }
  }

  updateLevelSelect() {
    const maxLevel = LEVELS.length - 1;
    if (consumePressed('ArrowLeft') || consumePressed('KeyA')) { this.levelSelectIndex = Math.max(0, this.levelSelectIndex - 1); AudioSys.menu(); }
    if (consumePressed('ArrowRight') || consumePressed('KeyD')) { this.levelSelectIndex = Math.min(maxLevel, this.levelSelectIndex + 1); AudioSys.menu(); }
    if (consumePressed('ArrowUp')) { this.levelSelectIndex = Math.max(0, this.levelSelectIndex - 4); AudioSys.menu(); }
    if (consumePressed('ArrowDown')) { this.levelSelectIndex = Math.min(maxLevel, this.levelSelectIndex + 4); AudioSys.menu(); }
    if (consumePressed('Escape')) { this.state = State.MAIN_MENU; AudioSys.menu(); }
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      this.startTour(this.levelSelectIndex);
    }
  }

  updateControls() {
    if (consumePressed('Escape') || consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      this.state = State.MAIN_MENU;
    }
  }
  updateHighScores() {
    if (consumePressed('Escape') || consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      this.state = State.MAIN_MENU;
    }
  }
  updateCredits() {
    if (consumePressed('Escape') || consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      this.state = State.MAIN_MENU;
    }
  }

  // ------------------- PLAY UPDATE -------------------
  updatePlaying(dt) {
    // Pause
    if (consumePressed('KeyP') || consumePressed('Escape')) { this.state = State.PAUSED; AudioSys.menu(); return; }
    if (!this.player2 && (consumePressed('KeyI') || consumePressed('KeyK') || consumePressed('KeyU'))) this.joinPlayer2();
    // Restart
    if (consumePressed('KeyR')) {
      if (this.mode === 'panic') return this.startPanic();
      if (this.mode === 'score_attack') return this.startScoreAttack();
      return this.loadLevel(this.levelIndex);
    }

    // Effective dt (slow time / hit pause)
    if (this.hitPause > 0) {
      this.hitPause -= dt;
      dt *= 0.05;
    }
    if (this.slowTime > 0) {
      this.slowTime -= dt;
      dt *= 0.45;
    }
    if (this.freezeTime > 0) this.freezeTime = Math.max(0, this.freezeTime - dt);
    if (this.magnetTime > 0) this.magnetTime = Math.max(0, this.magnetTime - dt);
    if (this.comboBoostTime > 0) this.comboBoostTime = Math.max(0, this.comboBoostTime - dt);
    const motionDt = this.freezeTime > 0 ? 0 : dt;

    // Update timer (campaign and score attack)
    if (this.mode !== 'panic') {
      this.timer -= dt;
      const warningSecond = Math.ceil(this.timer);
      if (warningSecond > 0 && warningSecond <= 10 && warningSecond !== this.lastTimerWarning) {
        this.lastTimerWarning = warningSecond;
        AudioSys.warning();
      }
      if (this.timer <= 0) {
        this.timer = 0;
        // Lose a life on timeout
        if (this.player) this.killPlayer(this.player);
        return;
      }
    }

    // Combo decay
    this.comboDecay -= dt;
    if (this.comboDecay <= 0 && this.combo > 0) {
      this.combo = Math.max(0, this.combo - 1);
      this.comboDecay = 0.5;
    }

    // Intro timer
    if (this.introTimer > 0) this.introTimer -= dt;

    // Effects timers
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);

    // --- Entity updates ---
    for (const p of [this.player, this.player2]) {
      if (!p) continue;
      if (p.dead && p.respawnTimer > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0 && this.lives > 0) this.respawnPlayer(p);
      } else {
        p.update(dt, this);
      }
    }

    for (const p of this.platforms) p.update(dt);
    for (const c of this.crabs) c.update(dt);
    for (const b of this.balls) b.update(motionDt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const pk of this.pickups) pk.update(dt, this);
    for (const h of this.hazards) h.update(dt);
    for (const pt of this.particles) pt.update(dt);
    for (const sc of this.smokeClouds) sc.update(dt);
    for (const ft of this.floatingTexts) ft.update(dt);
    if (this.boss) this.boss.update(motionDt, this);

    // --- Collisions ---
    this.resolveCollisions();

    // --- Cleanup ---
    for (const p of this.projectiles) {
      if (p.dead && !p.didHit && p.type !== 'flame') {
        this.combo = 0;
        this.comboDecay = 0;
      }
    }
    this.balls = this.balls.filter(b => !b.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.pickups = this.pickups.filter(p => !p.dead);
    this.destructibles = this.destructibles.filter(d => !d.dead);
    this.hazards = this.hazards.filter(h => !h.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.smokeClouds = this.smokeClouds.filter(p => !p.dead);
    this.floatingTexts = this.floatingTexts.filter(f => !f.dead);
    if (this.particles.length > 300) this.particles.length = 300;
    if (this.smokeClouds.length > 80) this.smokeClouds.length = 80;

    // --- Win conditions ---
    if (this.bossLevel) {
      if (this.boss && this.boss.dead && this.balls.length === 0) {
        this.state = State.BOSS_DEFEATED;
        this.bossDefeatedTimer = 2;
        // Save unlock
        this.unlockedLevel = Math.max(this.unlockedLevel, LEVELS.length);
        Storage.data.unlockedLevel = this.unlockedLevel;
        Storage.save();
      }
    } else if (this.mode === 'panic') {
      if (this.balls.length === 0 && this.boss == null) {
        // wave clear
        if (this.panicWave > Storage.data.bestPanicWave) {
          Storage.data.bestPanicWave = this.panicWave; Storage.save();
        }
        if (this.score > Storage.data.bestPanicScore) {
          Storage.data.bestPanicScore = this.score; Storage.save();
        }
        this.addScore(500 * this.panicWave);
        this.advancePanicWave();
      }
    } else {
      if (this.balls.length === 0) {
        this.levelClear();
      }
    }
  }

  resolveCollisions() {
    const players = this.getLivingPlayers();

    for (const player of players) {
      if (player.invuln > 0) continue;
      const hb = player.getHitbox();
      for (const b of this.balls) {
        if (b.dead) continue;
        const c = collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h);
        if (c) { this.killPlayer(player); break; }
      }
      if (player.dead) continue;
      for (const h of this.hazards) {
        const active = h.active !== false;
        const hurts = h.type === 'electric_beam' || h.type === 'boss_beam' || h.type === 'electric_barrier'
          || h.type === 'flame_vent' || h.type === 'falling_rock' || h.type === 'lava';
        if (active && hurts && rectOverlap(hb, h)) { this.killPlayer(player); break; }
      }
      if (player.dead) continue;
      for (const c of this.crabs) {
        if (rectOverlap(hb, c.getHitbox())) { this.killPlayer(player); break; }
      }
      if (!player.dead && this.boss && !this.boss.dead) {
        const dx = player.x - this.boss.x, dy = (player.y - 24) - this.boss.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.boss.r + 16) this.killPlayer(player);
      }
    }

    for (const c of this.crabs) {
      const hb = c.getHitbox();
      for (const b of this.balls) {
        if (b.dead) continue;
        if (collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h)) {
          this._popBall(b, c);
          c.vx *= -1;
        }
      }
    }

    // Projectile vs ball / destructible / boss
    for (const p of this.projectiles) {
      if (p.dead) continue;

      // Boss
      if (this.boss && !this.boss.dead && this.boss.collides(p)) {
        p.didHit = true;
        if (p.type === 'bomb') {
          this.explodeProjectile(p, p.x, p.y);
        } else {
          this.boss.hit(this, p.type === 'laser' ? 3 : p.type === 'shuriken' ? 2 : 1);
          if (p.consumeOnHit()) p.dead = true;
          if (p.type === 'shuriken') p.dead = true;
        }
      }

      // Destructibles
      for (const d of this.destructibles) {
        if (d.dead) continue;
        let hit = false;
        if (p.type === 'harpoon' || p.type === 'laser') {
          if (p.x >= d.x && p.x <= d.x + d.w && p.tipY <= d.y + d.h && p.tipY >= d.y) hit = true;
        } else if (p.type === 'bullet' || p.type === 'pellet') {
          if (p.x >= d.x && p.x <= d.x + d.w && p.y <= d.y + d.h && p.y >= d.y) hit = true;
        } else if (p.type === 'flame') {
          if (p.x + p.r > d.x && p.x - p.r < d.x + d.w && p.y + p.r > d.y && p.y - p.r < d.y + d.h) hit = true;
        } else if (p.type === 'shuriken' || p.type === 'bomb') {
          if (collideCircleRect(p.x, p.y, p.r, d.x, d.y, d.w, d.h)) hit = true;
        }
        if (hit) {
          p.didHit = true;
          if (p.type === 'bomb') {
            this.explodeProjectile(p, p.x, p.y);
            break;
          }
          d.hp--;
          if (d.hp <= 0) {
            d.dead = true;
            AudioSys.pop();
            this.addScore(100);
            if (d.contains) this.pickups.push(new Pickup(d.x + d.w / 2, d.y + d.h / 2, d.contains));
            for (let i = 0; i < 10; i++) {
              const a = Math.random() * Math.PI * 2, s = rand(60, 180);
              this.particles.push(new Particle(d.x + d.w/2, d.y + d.h/2, Math.cos(a)*s, Math.sin(a)*s, 0.5, '#a8682c', 6, 200));
            }
          }
          if (p.consumeOnHit()) { p.dead = true; break; }
        }
      }

      // Balls
      if (!p.dead) {
        for (const b of this.balls) {
          if (b.dead) continue;
          if (p.hits(b)) {
            p.didHit = true;
            if (p.type === 'bomb') {
              this.explodeProjectile(p, b.x, b.y);
              break;
            }
            this._popBall(b, p);
            p.hitBalls.add(b);
            if (p.type === 'shuriken' && p.hitBalls.size >= 3) { p.dead = true; break; }
            if (p.consumeOnHit()) { p.dead = true; break; }
          }
        }
      }
    }

    for (const player of this.getLivingPlayers()) {
      const hb = player.getHitbox();
      for (const pk of this.pickups) {
        if (pk.dead) continue;
        if (pk.x > hb.x - 14 && pk.x < hb.x + hb.w + 14 && pk.y > hb.y - 14 && pk.y < hb.y + hb.h + 14) {
          pk.apply(player, this);
          pk.dead = true;
        }
      }
    }
  }

  // ------------------- OTHER STATES -------------------
  updatePaused() {
    if (consumePressed('KeyP') || consumePressed('Escape')) { this.state = State.PLAYING; AudioSys.menu(); }
    if (consumePressed('Enter')) { this.state = State.MAIN_MENU; AudioSys.menu(); }
    if (consumePressed('KeyR')) {
      if (this.mode === 'panic') return this.startPanic();
      if (this.mode === 'score_attack') return this.startScoreAttack();
      return this.loadLevel(this.levelIndex);
    }
  }

  updateLevelClear() {
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      this.summary = null;
      if (this.bossLevel) {
        this.state = State.VICTORY;
        return;
      }
      const next = this.levelIndex + 1;
      if (next >= LEVELS.length) this.state = State.VICTORY;
      else if (this.mode === 'score_attack') this.loadLevel(next % LEVELS.length);
      else this.loadLevel(next);
    }
  }

  updatePlayerDead(dt) {
    this.hitPause -= dt;
    if (this.hitPause <= 0) {
      if (this.lives > 0) {
        if (this.mode === 'panic') {
          // Respawn in place
          if (this.player) this.respawnPlayer(this.player);
          this.state = State.PLAYING;
        } else {
          this.loadLevel(this.levelIndex);
        }
      } else {
        this.state = State.GAME_OVER;
      }
    }
    // Still update particles for visual continuity
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(p => !p.dead);
  }

  updateBossDefeated(dt) {
    this.bossDefeatedTimer -= dt;
    for (const pt of this.particles) pt.update(dt);
    for (const sc of this.smokeClouds) sc.update(dt);
    for (const ft of this.floatingTexts) ft.update(dt);
    this.particles = this.particles.filter(p => !p.dead);
    this.smokeClouds = this.smokeClouds.filter(p => !p.dead);
    this.floatingTexts = this.floatingTexts.filter(f => !f.dead);
    if (this.bossDefeatedTimer <= 0) this.levelClear();
  }

  updateGameOver() {
    if (consumePressed('Enter') || consumePressed('Space')) {
      AudioSys.menu();
      if (this.mode === 'score_attack') this.startScoreAttack();
      else if (this.mode === 'panic') this.startPanic();
      else this.loadLevel(this.levelIndex);
    }
    if (consumePressed('Escape')) { this.state = State.MAIN_MENU; AudioSys.menu(); }
  }

  updateVictory() {
    if (consumePressed('Enter') || consumePressed('Space') || consumePressed('Escape')) {
      AudioSys.menu();
      this.state = State.MAIN_MENU;
    }
  }

  // ============================ RENDER ============================
  render() {
    const ctx = this.ctx;
    // Reset
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Shake offset
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = rand(-this.shake, this.shake); sy = rand(-this.shake, this.shake); }
    ctx.translate(sx, sy);

    switch (this.state) {
      case State.MAIN_MENU:    this.renderMainMenu(); break;
      case State.MODE_SELECT:  this.renderModeSelect(); break;
      case State.LEVEL_SELECT: this.renderLevelSelect(); break;
      case State.HIGH_SCORES:  this.renderHighScores(); break;
      case State.CONTROLS:     this.renderControls(); break;
      case State.CREDITS:      this.renderCredits(); break;
      case State.PLAYING:
      case State.PAUSED:
      case State.PLAYER_DEAD:
      case State.LEVEL_CLEAR:
      case State.GAME_OVER:
      case State.BOSS_DEFEATED:
      case State.VICTORY:
        this.renderWorld();
        if (this.state === State.PAUSED) this.renderPause();
        if (this.state === State.LEVEL_CLEAR) this.renderLevelClear();
        if (this.state === State.GAME_OVER) this.renderGameOver();
        if (this.state === State.BOSS_DEFEATED) this.renderBossDefeated();
        if (this.state === State.VICTORY) this.renderVictory();
        break;
    }

    // Global flash overlay
    if (this.flash > 0) {
      ctx.globalAlpha = clamp(this.flash, 0, 0.5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  renderMainMenu() {
    const ctx = this.ctx;
    drawBackground(ctx, 'beach', this.t);
    // Title
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = '#0a1832';
    const yT = 130;
    ctx.strokeText('BUBBLE BREAKER', W/2, yT);
    ctx.fillStyle = '#ffd60a';
    ctx.fillText('BUBBLE BREAKER', W/2, yT);
    ctx.font = 'bold 36px sans-serif';
    ctx.strokeText('A D V E N T U R E', W/2, yT + 44);
    ctx.fillStyle = '#fff';
    ctx.fillText('A D V E N T U R E', W/2, yT + 44);

    // A demo ball bouncing across the menu
    const dx = (this.t * 80) % (W - 100) + 50;
    const dy = GROUND_Y - 90 - Math.abs(Math.sin(this.t * 2.4)) * 180;
    drawDemoBall(ctx, dx, dy, 26, ['#ff4d6d','#9d0a32']);

    // Menu items
    const items = ['Play Adventure', 'Score Attack', 'Panic Mode', 'Mode Select', 'High Scores', 'Controls', AudioSys.muted ? 'Sound: OFF' : 'Sound: ON', 'Credits'];
    const baseY = 230;
    for (let i = 0; i < items.length; i++) {
      const sel = i === this.menuIndex;
      ctx.font = sel ? 'bold 25px sans-serif' : '22px sans-serif';
      ctx.fillStyle = sel ? '#ffd60a' : '#fff';
      ctx.lineWidth = 4; ctx.strokeStyle = '#0a1832';
      const label = (sel ? '> ' : '  ') + items[i];
      ctx.strokeText(label, W/2, baseY + i * 34);
      ctx.fillText(label, W/2, baseY + i * 34);
    }

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Up/Down select   Enter confirm   M mute', W/2, H - 18);
  }

  renderModeSelect() {
    const ctx = this.ctx;
    drawBackground(ctx, 'desert', this.t);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
    ctx.textAlign = 'center';
    ctx.strokeText('SELECT MODE', W/2, 120);
    ctx.fillText('SELECT MODE', W/2, 120);

    const items = [
      { title: 'TOUR', desc: 'The campaign. 18 stages across 6 worlds + boss.' },
      { title: 'SCORE ATTACK', desc: '3 lives, no continues. Beat your best.' },
      { title: 'PANIC MODE', desc: 'Endless waves. Survive as long as you can.' },
      { title: 'BACK', desc: 'Return to main menu.' },
    ];
    for (let i = 0; i < items.length; i++) {
      const sel = i === this.modeSelectIndex;
      const y = 200 + i * 70;
      ctx.fillStyle = sel ? 'rgba(255,214,10,0.2)' : 'rgba(0,0,0,0.3)';
      roundRect(ctx, W/2 - 280, y - 30, 560, 56, 10, true, false);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = sel ? '#ffd60a' : '#fff';
      ctx.textAlign = 'left';
      ctx.fillText((sel ? '▶ ' : '  ') + items[i].title, W/2 - 260, y);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#cfd6df';
      ctx.fillText(items[i].desc, W/2 - 260, y + 22);
    }
    // High scores
    ctx.textAlign = 'right';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cfd6df';
    ctx.fillText('Best Score Attack: ' + Storage.data.bestScoreAttack, W - 24, H - 36);
    ctx.fillText('Best Panic Wave: ' + Storage.data.bestPanicWave, W - 24, H - 18);
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Esc back', W/2, H - 36);
  }

  renderHighScores() {
    const ctx = this.ctx;
    drawBackground(ctx, 'city', this.t);
    ctx.font = 'bold 46px sans-serif';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
    ctx.textAlign = 'center';
    ctx.strokeText('HIGH SCORES', W/2, 90);
    ctx.fillText('HIGH SCORES', W/2, 90);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText('Score Attack Best: ' + Storage.data.bestScoreAttack, W/2, 150);
    ctx.fillText('Panic Best Wave: ' + Storage.data.bestPanicWave, W/2, 184);
    ctx.fillText('Panic Best Score: ' + Storage.data.bestPanicScore, W/2, 218);

    const top = [...LEVELS]
      .map((l, i) => ({ label: 'Lv ' + (i + 1) + ' ' + l.name, score: Storage.data.bestTour[l.id] || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < top.length; i++) {
      ctx.fillStyle = i < 3 ? '#ffd60a' : '#fff';
      ctx.fillText(top[i].label, W/2 - 230, 280 + i * 25);
      ctx.textAlign = 'right';
      ctx.fillText(top[i].score.toString(), W/2 + 230, 280 + i * 25);
      ctx.textAlign = 'left';
    }
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
  }

  renderLevelSelect() {
    const ctx = this.ctx;
    drawBackground(ctx, 'arctic', this.t);
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
    ctx.strokeText('LEVEL SELECT', W/2, 80);
    ctx.fillText('LEVEL SELECT', W/2, 80);
    // 5 columns
    const cols = 5, cellW = 168, cellH = 68, gap = 8;
    const startX = W/2 - (cols * (cellW + gap) - gap) / 2;
    const startY = 130;
    for (let i = 0; i < LEVELS.length; i++) {
      const cx = startX + (i % cols) * (cellW + gap);
      const cy = startY + Math.floor(i / cols) * (cellH + gap);
      const L = LEVELS[i];
      const isSel = i === this.levelSelectIndex;
      ctx.fillStyle = isSel ? 'rgba(255,214,10,0.3)' : 'rgba(0,0,0,0.4)';
      roundRect(ctx, cx, cy, cellW, cellH, 10, true, false);
      ctx.strokeStyle = isSel ? '#ffd60a' : '#fff';
      ctx.lineWidth = isSel ? 3 : 1;
      roundRect(ctx, cx, cy, cellW, cellH, 10, false, true);
      // Theme color band
      const T = THEMES[L.theme];
      ctx.fillStyle = T.acc;
      ctx.fillRect(cx + 8, cy + 8, 8, cellH - 16);
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText('Lv ' + (i + 1), cx + 24, cy + 24);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(L.name, cx + 24, cy + 46);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#cfd6df';
      ctx.fillText(L.theme.toUpperCase(), cx + 24, cy + 61);
      const best = Storage.data.bestTour[L.id] || 0;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('Best: ' + best, cx + cellW - 10, cy + 61);
    }
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('← → ↑ ↓ select    Enter play    Esc back', W/2, H - 18);
  }

  renderControls() {
    const ctx = this.ctx;
    drawBackground(ctx, 'beach', this.t);
    ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
    ctx.strokeText('CONTROLS', W/2, 100);
    ctx.fillText('CONTROLS', W/2, 100);

    const lines = [
      'Move Left      A / Left',
      'Move Right     D / Right',
      'Shoot Up       Space / W / Up',
      'Pause          P / Esc',
      'Instant Restart  R',
      'Mute Sound     M',
      'Menu Confirm   Enter',
      'Player 2 Join  I / K / U',
      'Player 2 Move  J / L',
      '',
      'Goal: pop every ball before the timer runs out.',
      'Weapons include laser, flame, shotgun, shuriken, and bomb.',
      'Freeze, magnet, smoke-clear, and combo pickups can turn a level.',
    ];
    ctx.font = '20px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 220, 170 + i * 30);
    }
    ctx.textAlign = 'center'; ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
  }

  renderCredits() {
    const ctx = this.ctx;
    drawBackground(ctx, 'arctic', this.t);
    ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 5;
    ctx.strokeText('CREDITS', W/2, 100);
    ctx.fillText('CREDITS', W/2, 100);
    ctx.font = '20px sans-serif';
    const lines = [
      'Bubble Breaker Adventure',
      'A TypeScript HTML5 Canvas arcade game.',
      'Inspired by the Pang / Buster Bros series.',
      '',
      'Code & design: this build for Jo.',
      'No external assets. Built with Vite.',
      'Audio: Web Audio API procedural synthesis.',
      '',
      'Built to teach the ball-splitting genre',
      'with arcade clarity and tight feel.',
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W/2, 170 + i * 28);
    }
    ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Press Enter or Esc to return', W/2, H - 24);
  }

  // ---------------- World draw ----------------
  renderWorld() {
    const ctx = this.ctx;
    drawBackground(ctx, this.theme, this.t);

    // Platforms
    for (const p of this.platforms) p.draw(ctx, this.theme);
    // Destructibles
    for (const d of this.destructibles) if (!d.dead) d.draw(ctx);
    // Hazards (under balls)
    for (const h of this.hazards) h.draw(ctx);
    for (const c of this.crabs) c.draw(ctx);
    // Pickups
    for (const pk of this.pickups) pk.draw(ctx);
    // Boss
    if (this.boss) this.boss.draw(ctx);
    // Balls
    for (const b of this.balls) b.draw(ctx);
    // Projectiles
    for (const p of this.projectiles) p.draw(ctx);
    // Player
    if (this.player) this.player.draw(ctx);
    if (this.player2) this.player2.draw(ctx);
    // Particles
    for (const pt of this.particles) pt.draw(ctx);
    for (const sc of this.smokeClouds) sc.draw(ctx);
    // Floating text
    for (const ft of this.floatingTexts) ft.draw(ctx);

    // HUD
    this.renderHUD();

    // Intro overlay
    if (this.introTimer > 0 && this.introText) {
      const a = clamp(this.introTimer / 4, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, W/2 - 300, H/2 - 60, 600, 120, 14, true, false);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffd60a';
      ctx.textAlign = 'center';
      ctx.fillText(this.levelName, W/2, H/2 - 25);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      const lines = this.introText.split('\n');
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W/2, H/2 + 5 + i * 22);
      ctx.globalAlpha = 1;
    }
  }

  renderHUD() {
    const ctx = this.ctx;
    // Top bar background
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, CEILING_Y);

    // Score
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE  ' + this.score.toString().padStart(7, '0'), 24, 22);
    // Target/best
    if (this.mode === 'tour' || this.mode === 'score_attack') {
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#cfd6df';
      ctx.fillText('Target ' + this.targetScore, 24, 40);
    }

    // Timer (or wave)
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px sans-serif';
    if (this.mode === 'panic') {
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('WAVE ' + this.panicWave, W/2, 30);
    } else {
      const lowTime = this.timer < 10;
      ctx.fillStyle = lowTime ? (Math.floor(this.timer * 4) % 2 ? '#ff4d6d' : '#fff') : '#fff';
      ctx.fillText(Math.ceil(this.timer) + 's', W/2, 30);
    }

    // Lives
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ff4d6d';
    let lx = W - 24;
    for (let i = 0; i < this.lives; i++) {
      ctx.beginPath();
      ctx.arc(lx, 22, 6, 0, Math.PI * 2);
      ctx.fill();
      lx -= 16;
    }

    // Level name
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cfd6df';
    ctx.fillText(this.levelName, W - 24, 42);

    // Weapon & ammo
    const p = this.player;
    if (p) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#ffd60a';
      let wlabel = 'WEAPON: ' + p.weapon.toUpperCase();
      if (p.weaponAmmo > 0) wlabel += ' x' + p.weaponAmmo;
      else if (p.weaponTime > 0) wlabel += ' ' + Math.ceil(p.weaponTime) + 's';
      ctx.fillText(wlabel, 200, 22);
      // Shield
      if (p.shield) {
        ctx.fillStyle = '#3a86ff';
        ctx.fillText('P1 SHIELD', 200, 40);
      }
    }
    if (this.player2) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#9be7ff';
      const p2Status = this.player2.dead ? 'RESPAWN ' + Math.ceil(this.player2.respawnTimer) : this.player2.weapon.toUpperCase();
      ctx.fillText('P2: ' + p2Status, 320, 40);
    } else {
      ctx.textAlign = 'left';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('P2: press I/K/U to join', 320, 40);
    }
    const effects: string[] = [];
    if (this.slowTime > 0) effects.push('SLOW ' + Math.ceil(this.slowTime));
    if (this.freezeTime > 0) effects.push('FREEZE ' + Math.ceil(this.freezeTime));
    if (this.magnetTime > 0) effects.push('MAGNET ' + Math.ceil(this.magnetTime));
    if (this.comboBoostTime > 0) effects.push('BOOST ' + Math.ceil(this.comboBoostTime));
    if (effects.length) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(effects.join('  '), 530, 40);
    }

    // Combo meter
    if (this.combo > 0) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif';
      const comboColor = this.combo >= 10 ? '#ff36c4' : this.combo >= 5 ? '#ffd60a' : '#fff';
      ctx.fillStyle = comboColor;
      const pulse = 1 + Math.min(this.combo / 20, 1) * Math.sin(performance.now() / 80) * 0.05;
      ctx.save();
      ctx.translate(420, 22);
      ctx.scale(pulse, pulse);
      ctx.fillText('COMBO x' + this.combo, 0, 0);
      ctx.restore();
      // Decay bar
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(420, 28, 100, 6);
      ctx.fillStyle = comboColor;
      ctx.fillRect(420, 28, 100 * clamp(this.comboDecay / 4, 0, 1), 6);
    }

    // Boss health bar
    if (this.boss && !this.boss.dead) {
      const bw = 360, bh = 14;
      const bx = W/2 - bw/2, by = H - 32;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 4, true, false);
      ctx.fillStyle = '#3a0a26';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff2b88';
      ctx.fillRect(bx, by, bw * (this.boss.hp / this.boss.maxHp), bh);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('COMMANDER RIFT', W/2, by - 4);
    }

    // Restart hint
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('Instant Restart: R   Pause: P', W - 16, H - 8);
  }

  renderPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 56px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W/2, H/2 - 20);
    ctx.font = '20px sans-serif'; ctx.fillStyle = '#cfd6df';
    ctx.fillText('Press P or Esc to resume', W/2, H/2 + 20);
    ctx.fillText('R to restart  -  Enter for menu', W/2, H/2 + 50);
  }

  renderBossDefeated() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.strokeStyle = '#0a1832';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.strokeText('BOSS DEFEATED!', W/2, H/2 - 10);
    ctx.fillText('BOSS DEFEATED!', W/2, H/2 - 10);
  }

  renderLevelClear() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 6; ctx.textAlign = 'center';
    ctx.strokeText('LEVEL CLEAR!', W/2, 130);
    ctx.fillText('LEVEL CLEAR!', W/2, 130);
    const s = this.summary;
    if (s) {
      const rows: [string, number][] = [
        ['Base Score', s.base],
        ['Time Bonus', s.time],
        ['Accuracy Bonus', s.accuracy],
        ['Combo Bonus', s.combo],
        ['No-Miss Bonus', s.noMiss],
      ];
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      for (let i = 0; i < rows.length; i++) {
        ctx.fillStyle = '#fff';
        ctx.fillText(rows[i][0], W/2 - 180, 200 + i * 36);
        ctx.textAlign = 'right';
        ctx.fillText('+' + rows[i][1], W/2 + 180, 200 + i * 36);
        ctx.textAlign = 'left';
      }
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('TOTAL', W/2 - 180, 410);
      ctx.textAlign = 'right';
      ctx.fillText(s.total.toString(), W/2 + 180, 410);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#cfd6df';
      ctx.textAlign = 'center';
      ctx.fillText('Best: ' + s.best, W/2, 440);
    }
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('Press Enter / Space to continue', W/2, H - 30);
  }

  renderGameOver() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 64px sans-serif'; ctx.fillStyle = '#ff4d6d'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 6;
    ctx.strokeText('GAME OVER', W/2, H/2 - 40);
    ctx.fillText('GAME OVER', W/2, H/2 - 40);
    ctx.font = '26px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Final Score: ' + this.score, W/2, H/2 + 10);
    const best = this.mode === 'score_attack' ? Storage.data.bestScoreAttack
                : this.mode === 'panic' ? Storage.data.bestPanicWave : 0;
    if (this.mode === 'panic') {
      ctx.fillText('Best Wave: ' + best, W/2, H/2 + 50);
      ctx.fillText('Best Score: ' + Storage.data.bestPanicScore, W/2, H/2 + 84);
    } else if (this.mode === 'score_attack') {
      ctx.fillText('Best Score: ' + best, W/2, H/2 + 50);
    }
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#cfd6df';
    ctx.fillText('Enter / Space: retry        Esc: main menu', W/2, H - 40);
  }

  renderVictory() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 72px sans-serif'; ctx.fillStyle = '#ffd60a'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#0a1832'; ctx.lineWidth = 6;
    ctx.strokeText('VICTORY!', W/2, H/2 - 40);
    ctx.fillText('VICTORY!', W/2, H/2 - 40);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Commander RIFT has fallen.', W/2, H/2 + 10);
    ctx.fillText('Final Score: ' + this.score, W/2, H/2 + 44);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#cfd6df';
    ctx.fillText('Press Enter to return to menu', W/2, H - 40);
  }
}
