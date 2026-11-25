import { test, expect } from '@playwright/test';
import { boot, collectErrors, realErrors } from './helpers';

/**
 * Gameplay invariants, driven straight through the fixed-timestep loop
 * (game.update(1/60)) on the production bundle. Nothing here depends on
 * rendering or wall-clock time, so the whole Tour simulates in seconds.
 */

test.describe.configure({ timeout: 180_000 });

test('every Tour stage runs to a clear with valid state (27 stages, 3 bosses)', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page);
  const rows = await page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys;
    const out: any[] = [];
    for (let li = 0; li < 27; li++) {
      g.forcedSeed = 4242 + li;
      g.startTour(li); g.introTimer = 0;
      let invalid = '', maxBalls = 0, maxPhase = 0, f = 0;
      for (; f < 60 * 240; f++) {
        // Invulnerable chase-bot: this test is about termination + validity,
        // not difficulty.
        const p = g.player;
        if (p && g.state === 'playing') {
          p.invuln = 1;
          let tx: number | null = null, best = 1e9;
          for (const b of g.balls) { const d = Math.abs(b.x - p.x) + (b.type === 'explosive' && b.fuse > 0 ? 9999 : 0); if (d < best) { best = d; tx = b.x; } }
          if (tx == null && g.boss) tx = g.boss.x;
          keys.ArrowLeft = tx != null && tx < p.x - 5;
          keys.ArrowRight = tx != null && tx > p.x + 5;
          keys.Space = true;
        }
        g.update(1 / 60);
        maxBalls = Math.max(maxBalls, g.balls.length);
        if (g.boss) maxPhase = Math.max(maxPhase, g.boss.phase);
        for (const b of g.balls) {
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) invalid = 'non-finite ball';
          else if (b.x < 16 || b.x > 944 || b.y < 40 || b.y > 500) invalid = `ball out of arena ${b.x.toFixed(0)},${b.y.toFixed(0)}`;
          else if (b.size < 0 || b.size > 4) invalid = 'bad size ' + b.size;
        }
        if (p && (!Number.isFinite(p.x) || p.x < 16 || p.x > 944)) invalid = 'player out of arena';
        if (!Number.isFinite(g.score) || g.score < 0) invalid = 'bad score';
        if (g.state === 'level_clear' || g.state === 'game_over' || g.state === 'victory') break;
      }
      out.push({ li, name: g.levelName, state: g.state, secs: +(f / 60).toFixed(1), invalid, maxBalls, boss: !!g.boss, maxPhase, unlocked: g.unlockedLevel, summaryOk: !!g.summary && g.summary.total === g.score });
    }
    keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
    g.forcedSeed = null;
    return out;
  });
  for (const r of rows) {
    expect(r.invalid, `${r.name}: ${r.invalid}`).toBe('');
    expect(r.state, `${r.name} did not clear (${r.secs}s)`).toBe('level_clear');
    expect(r.summaryOk, `${r.name}: stage summary total must equal the stage score`).toBe(true);
    expect(r.unlocked, `${r.name}: clearing must unlock the next stage`).toBeGreaterThanOrEqual(r.li + 1);
    expect(r.maxBalls, `${r.name}: ball count ran away`).toBeLessThan(60);
    if (r.boss) expect(r.maxPhase, `${r.name}: boss never reached its final phase`).toBe(3);
  }
  expect(rows.filter(r => r.boss).length).toBe(3);
  expect(realErrors(errors)).toEqual([]);
});

test('a size-4 ball family is exactly 31 pops, by hand and by PopShot cascade', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    const mk = (size: number) => {
      g.startTour(0); g.introTimer = 0;
      const proto = g.balls[0];
      const B = proto.constructor;
      g.balls = [new B(480, 200, size, 'normal', 95, 0)];
      g.player.invuln = 999;
    };
    // 1) Pop everything one at a time through the public pop path.
    mk(4);
    let pops = 0, guard = 0;
    while (g.balls.some((b: any) => !b.dead) && guard++ < 500) {
      const b = g.balls.find((x: any) => !x.dead);
      g._popBall(b, null);
      pops++;
      g.balls = g.balls.filter((x: any) => !x.dead);
    }
    const byHand = { pops, levelPops: g.levelPops, left: g.balls.length };
    // 2) One cascade: mark the root and let the fuses do the rest.
    mk(4);
    const root = g.balls[0];
    root.cascade = true;
    g._popBall(root, { kind: 'cascade' });
    let frames = 0;
    while (g.balls.length > 0 && frames++ < 600) { g.player.invuln = 999; g.update(1 / 60); if (g.state !== 'playing') break; }
    return { byHand, cascade: { levelPops: g.levelPops, left: g.balls.length, frames, state: g.state } };
  });
  expect(res.byHand).toEqual({ pops: 31, levelPops: 31, left: 0 });
  expect(res.cascade.levelPops).toBe(31);
  expect(res.cascade.left).toBe(0);
  expect(res.cascade.frames).toBeLessThan(180);        // the whole tree bursts in under 3 s
});

test('bomb balls never split, chain into each other, and the reaction terminates', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.startTour(0); g.introTimer = 0;
    const B = g.balls[0].constructor;
    g.balls = [
      new B(300, 200, 3, 'explosive', 0.001, 0), new B(380, 200, 3, 'explosive', 0.001, 0),
      new B(460, 200, 2, 'explosive', 0.001, 0), new B(540, 210, 3, 'armored', 0.001, 0),
    ];
    g.player.x = 800; g.player.invuln = 999;
    g._popBall(g.balls[0], null);                       // lights the first fuse
    const litNotPopped = !g.balls[0].dead && g.balls[0].fuse > 0;
    let frames = 0, explosiveChildren = 0, peak = 0;
    while (frames++ < 240) {
      g.player.invuln = 999;
      g.update(1 / 60);
      peak = Math.max(peak, g.balls.length);
      explosiveChildren += g.balls.filter((b: any) => b.type === 'explosive' && b.size < 2 && b.age < 0.05).length;
      if (g.state !== 'playing') break;
    }
    return { litNotPopped, explosiveLeft: g.balls.filter((b: any) => b.type === 'explosive').length, explosiveChildren, peak, armoredLeft: g.balls.filter((b: any) => b.type === 'armored').length };
  });
  expect(res.litNotPopped).toBe(true);
  expect(res.explosiveLeft).toBe(0);
  expect(res.explosiveChildren).toBe(0);
  expect(res.peak).toBeLessThan(12);
  expect(res.armoredLeft).toBeGreaterThan(0);          // the blast cracked the armor; it did not delete the ball
});

test('electric pops arc to a neighbour exactly once per ball', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.startTour(0); g.introTimer = 0;
    const B = g.balls[0].constructor;
    const e = new B(400, 200, 2, 'electric', 0.001, 0);
    const near = new B(470, 210, 2, 'normal', 0.001, 0);
    const far = new B(880, 420, 2, 'normal', 0.001, 0);
    g.balls = [e, near, far];
    g.player.x = 100; g.player.invuln = 999;
    g._popBall(e, null);
    const armed = near.popFuse >= 0 && far.popFuse < 0;
    for (let i = 0; i < 20; i++) { g.player.invuln = 999; g.update(1 / 60); }
    return { armed, nearPopped: near.dead, farAlive: !far.dead, bolts: g.levelPops };
  });
  expect(res.armed).toBe(true);
  expect(res.nearPopped).toBe(true);
  expect(res.farAlive).toBe(true);
  expect(res.bolts).toBe(2);
});

test('the chain is time-based: a missed shot never breaks it, an empty window does', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys;
    g.startTour(1); g.introTimer = 0;
    g.player.invuln = 999;
    g._popBall(g.balls[0], null);
    const afterPop = g.combo;
    // Park the player in a corner and fire into empty air for 1.5 s.
    g.player.x = 40; keys.Space = true;
    for (let i = 0; i < 90; i++) { g.player.invuln = 999; g.player.x = 40; g.update(1 / 60); }
    const afterMisses = g.combo, shots = g.shotsFired;
    keys.Space = false;
    for (let i = 0; i < 60 * 4; i++) { g.player.invuln = 999; g.player.x = 40; g.update(1 / 60); }
    return { afterPop, afterMisses, shots, afterWindow: g.combo, broken: g.chainBroken };
  });
  expect(res.afterPop).toBe(1);
  expect(res.shots).toBeGreaterThan(2);
  expect(res.afterMisses).toBe(1);
  expect(res.afterWindow).toBe(0);
  expect(res.broken).toBe(true);
});

test('dash grants brief invulnerability and respects its cooldown', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    g.startTour(0); g.introTimer = 0;
    g.balls = [];                                       // empty arena; keep the level alive via a parked ball
    const B = g.player.constructor;
    void B;
    const p = g.player;
    p.invuln = 0;
    const x0 = p.x;
    // Re-add one far-away ball so the stage doesn't clear.
    g.loadLevel(0); g.introTimer = 0;
    const q = g.player; q.invuln = 0; q.x = 200;
    for (const b of g.balls) { b.x = 800; b.y = 120; }
    kp.ShiftLeft = true;
    g.update(1 / 60);
    const dashing = q.dashT > 0, untouchable = q.untouchable;
    let frames = 0;
    while (q.dashT > 0 && frames++ < 60) { for (const b of g.balls) { b.x = 800; b.y = 120; b.vy = 0; } g.update(1 / 60); }
    const travelled = Math.abs(q.x - 200);
    kp.ShiftLeft = true; g.update(1 / 60);
    const secondDashBlocked = q.dashT <= 0;
    return { dashing, untouchable, travelled, secondDashBlocked, x0 };
  });
  expect(res.dashing).toBe(true);
  expect(res.untouchable).toBe(true);
  expect(res.travelled).toBeGreaterThan(90);
  expect(res.travelled).toBeLessThan(170);
  expect(res.secondDashBlocked).toBe(true);
});

test('pausing freezes the simulation; resuming continues it', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    g.startTour(1); g.introTimer = 0;
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    const snap = () => JSON.stringify([g.simT, g.timer, g.score, g.balls.map((b: any) => [b.x, b.y, b.vx, b.vy])]);
    kp.KeyP = true; g.update(1 / 60);
    const paused = g.state;
    const a = snap();
    for (let i = 0; i < 300; i++) g.update(1 / 60);
    const b = snap();
    kp.KeyP = true; g.update(1 / 60);
    const resumed = g.state;
    for (let i = 0; i < 10; i++) g.update(1 / 60);
    return { paused, frozen: a === b, resumed, advanced: snap() !== b };
  });
  expect(res.paused).toBe('paused');
  expect(res.frozen).toBe(true);
  expect(res.resumed).toBe('playing');
  expect(res.advanced).toBe(true);
});

test('restart and game over reset every piece of run state', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    g.startTour(4); g.introTimer = 0;
    g.player.invuln = 999;
    for (let i = 0; i < 6; i++) { const b = g.balls.find((x: any) => !x.dead && x.type !== 'explosive'); if (b) g._popBall(b, null); }
    g.popCharge = 77; g.freezeTime = 3; g.slowTime = 2; g.lives = 1;
    const dirty = { score: g.score, combo: g.combo };
    kp.KeyR = true; g.update(1 / 60);
    const afterRestart = { score: g.score, combo: g.combo, lives: g.lives, charge: g.popCharge, freeze: g.freezeTime, slow: g.slowTime, pops: g.levelPops, state: g.state, hazards: g.hazards.length };
    // Drive to a real game over.
    g.lives = 1; g.player.invuln = 0; g.player.dashIframes = 0;
    g.killPlayer(g.player, 'ball');
    const over = g.state;
    kp.Space = true; g.update(1 / 60);       // any key retries
    const afterRetry = { state: g.state, lives: g.lives, score: g.score, dead: g.player.dead };
    return { dirty, afterRestart, over, afterRetry };
  });
  expect(res.dirty.score).toBeGreaterThan(0);
  expect(res.afterRestart).toMatchObject({ score: 0, combo: 0, lives: 3, charge: 0, freeze: 0, slow: 0, pops: 0, state: 'playing' });
  expect(res.over).toBe('game_over');
  expect(res.afterRetry).toMatchObject({ state: 'playing', lives: 3, score: 0, dead: false });
});

test('co-op: a downed teammate can be rescued, and a team wipe costs one life', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.startTour(0); g.introTimer = 0;
    for (const b of g.balls) { b.x = 880; b.y = 100; b.vx = 0.001; }
    g.joinPlayer2();
    const p1 = g.player, p2 = g.player2;
    p1.invuln = 0; p2.invuln = 0;
    p1.x = 200; p2.x = 600;
    const lives0 = g.lives;
    g.killPlayer(p2, 'ball');
    const afterDown = { state: g.state, lives: g.lives, p2dead: p2.dead, window: p2.respawnTimer };
    // Walk P1 onto P2.
    p1.x = 600;
    for (const b of g.balls) { b.x = 880; b.y = 100; b.vy = 0; }
    g.update(1 / 60);
    const afterRescue = { p2dead: p2.dead, p2x: Math.round(p2.x), p2invuln: p2.invuln > 0, state: g.state, score: g.score };
    // Timeout wipes both players at once: exactly one life.
    p1.invuln = 0; p2.invuln = 0;
    const livesBefore = g.lives;
    g.timer = 0.001;
    g.update(1 / 60);
    const afterTimeout = { lives: g.lives, state: g.state, bothDead: p1.dead && p2.dead };
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    return { lives0, afterDown, afterRescue, livesBefore, afterTimeout, finalState: g.state, p2StillThere: !!g.player2 && !g.player2.dead };
  });
  expect(res.afterDown).toMatchObject({ state: 'playing', lives: res.lives0 - 1, p2dead: true, window: 10 });
  expect(res.afterRescue).toMatchObject({ p2dead: false, p2x: 600, p2invuln: true, state: 'playing' });
  expect(res.afterRescue.score).toBeGreaterThanOrEqual(500);
  expect(res.afterTimeout.lives).toBe(res.livesBefore - 1);
  expect(res.afterTimeout.bothDead).toBe(true);
  expect(res.finalState).toBe('playing');               // timeout reloads the stage with lives left
  expect(res.p2StillThere).toBe(true);                   // …and player 2 is not silently dropped
});

test('Panic mode survives 60 waves of zone rotation with a bounded arena', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys;
    g.forcedSeed = 99;
    g.startPanic(); g.introTimer = 0;
    let invalid = '', peak = 0, f = 0;
    const themes = new Set<string>();
    for (; f < 60 * 900 && g.panicWave < 60; f++) {
      const p = g.player;
      p.invuln = 1;
      let tx: number | null = null, best = 1e9;
      for (const b of g.balls) { const d = Math.abs(b.x - p.x) + (b.type === 'explosive' && b.fuse > 0 ? 9999 : 0); if (d < best) { best = d; tx = b.x; } }
      keys.ArrowLeft = tx != null && tx < p.x - 5;
      keys.ArrowRight = tx != null && tx > p.x + 5;
      keys.Space = true;
      g.update(1 / 60);
      themes.add(g.theme);
      peak = Math.max(peak, g.balls.length);
      for (const b of g.balls) if (!Number.isFinite(b.x) || b.x < 16 || b.x > 944 || b.y < 40 || b.y > 500) invalid = 'ball ' + b.x + ',' + b.y;
      if (g.state !== 'playing') break;
    }
    keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
    g.forcedSeed = null;
    return { wave: g.panicWave, state: g.state, invalid, peak, themes: [...themes].sort(), particles: g.particles.length, texts: g.floatingTexts.length, hazards: g.hazards.length, secs: Math.round(f / 60) };
  });
  expect(res.invalid).toBe('');
  expect(res.state).toBe('playing');
  expect(res.wave).toBe(60);
  expect(res.peak).toBeLessThan(70);
  expect(res.themes).toEqual(['airship', 'arctic', 'beach', 'boss', 'city', 'desert', 'volcano']);
  expect(res.particles).toBeLessThanOrEqual(340);
  expect(res.texts).toBeLessThanOrEqual(40);            // capped at 28 per frame + that frame's new callouts
  expect(res.hazards).toBeLessThan(60);
  expect(realErrors(errors)).toEqual([]);
});

test('the Daily Challenge replays identically from the same date', async ({ page }) => {
  await boot(page);
  const run = () => page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys, kp = (window as any).__keysPressed;
    const pick = (window as any).__pickDaily('2031-05-17');
    g.daily = pick;
    g.startDaily(); g.introTimer = 0;
    (window as any).__botSeed(7);
    const trace: string[] = [];
    for (let f = 0; f < 60 * 25; f++) {
      if (g.state !== 'playing') break;
      (window as any).__botStep(g, keys, kp, { sloppy: 0 });
      g.update(1 / 60);
      if (f % 120 === 0) trace.push(g.balls.map((b: any) => b.x.toFixed(3) + ',' + b.y.toFixed(3) + ',' + b.type + b.size).join(';') + '|' + g.score + '|' + g.player.x.toFixed(3));
    }
    keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
    return { pick, seed: g.runSeed, trace, score: g.score };
  });
  const a = await run();
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  await page.addScriptTag({ path: 'tools/bot.js' });
  await page.evaluate(() => { (window as any).__game.manualStep = true; });
  const b = await run();
  expect(a.pick).toEqual(b.pick);
  expect(a.seed).toBe(b.seed);
  expect(a.trace.length).toBeGreaterThan(5);
  expect(a.trace).toEqual(b.trace);
  expect(a.score).toBe(b.score);
  // …and a different date is a different challenge seed.
  const other = await page.evaluate(() => {
    const g = (window as any).__game;
    g.daily = (window as any).__pickDaily('2031-05-18'); g.startDaily();
    return g.runSeed;
  });
  expect(other).not.toBe(a.seed);
});

test('Boss Rush chains all three bosses, restores a life per boss, and ends in victory', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys, kp = (window as any).__keysPressed;
    g.forcedSeed = 11;
    g.startBossRush(); g.introTimer = 0;
    const order: string[] = [g.boss.kind];
    const livesAtStart: number[] = [];
    g.lives = 1;                                           // prove the +1 life between fights
    let f = 0;
    for (; f < 60 * 600; f++) {
      const p = g.player;
      if (g.state === 'playing' && p) {
        p.invuln = 1;
        let tx: number | null = null, best = 1e9;
        for (const b of g.balls) { const d = Math.abs(b.x - p.x) + (b.type === 'explosive' && b.fuse > 0 ? 9999 : 0); if (d < best) { best = d; tx = b.x; } }
        if (tx == null && g.boss) tx = g.boss.x;
        keys.ArrowLeft = tx != null && tx < p.x - 5;
        keys.ArrowRight = tx != null && tx > p.x + 5;
        keys.Space = true;
      } else { keys.Space = false; }
      if (g.state === 'level_clear') {
        keys.Space = false; kp.Enter = true; g.update(1 / 60);
        if (g.state === 'playing') { order.push(g.boss.kind); livesAtStart.push(g.lives); g.introTimer = 0; }
        continue;
      }
      g.update(1 / 60);
      if (g.state === 'victory' || g.state === 'game_over') break;
    }
    keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
    g.forcedSeed = null;
    const S = (window as any).__Storage.data;
    return { order, livesAtStart, state: g.state, count: g.bossRushCount, best: S.bestBossRush, bestCount: S.bestBossRushCount, score: g.score };
  });
  expect(res.order).toEqual(['globo', 'volta', 'rift']);
  expect(res.livesAtStart).toEqual([2, 3]);
  expect(res.state).toBe('victory');
  expect(res.count).toBe(3);
  expect(res.bestCount).toBe(3);
  expect(res.best).toBe(res.score);
});

test('Score Attack walks the Tour in order on one score and one set of lives', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    g.startScoreAttack(); g.introTimer = 0;
    const seen: number[] = [g.levelIndex];
    const scores: number[] = [];
    for (let n = 0; n < 3; n++) {
      g.player.invuln = 999;
      let guard = 0;
      while (g.balls.length && guard++ < 400) { g._popBall(g.balls.find((b: any) => !b.dead), null); g.balls = g.balls.filter((b: any) => !b.dead); }
      g.update(1 / 60);
      scores.push(g.score);
      kp.Enter = true; g.update(1 / 60);
      g.introTimer = 0;
      seen.push(g.levelIndex);
    }
    return { seen, scores, mode: g.mode, state: g.state, lives: g.lives };
  });
  expect(res.seen).toEqual([0, 1, 2, 3]);
  expect(res.scores[1]).toBeGreaterThan(res.scores[0]);
  expect(res.scores[2]).toBeGreaterThan(res.scores[1]);
  expect(res.mode).toBe('score_attack');
  expect(res.state).toBe('playing');
  expect(res.lives).toBe(3);
});

test('difficulty guard: the mortal bot clears World 1 cleanly and can finish every stage', async ({ page }) => {
  // Not a claim about human difficulty — a tripwire. If a physics or tuning
  // change suddenly makes the opening world lethal to a competent scripted
  // agent, or makes any stage unclearable on three lives, this fails.
  await boot(page);
  const rows = await page.evaluate(() => {
    const g = (window as any).__game, keys = (window as any).__keys, kp = (window as any).__keysPressed;
    const out: any[] = [];
    for (let li = 0; li < 27; li++) {
      let clears = 0, deaths = 0;
      const seeds = 4;
      for (let s = 0; s < seeds; s++) {
        g.forcedSeed = 1000 + s * 7919 + li * 131;
        (window as any).__botSeed(g.forcedSeed);
        g.startTour(li); g.introTimer = 0;
        let lives = g.lives;
        for (let f = 0; f < 60 * 260; f++) {
          if (g.state === 'playing') (window as any).__botStep(g, keys, kp);
          g.update(1 / 60);
          if (g.lives < lives) { deaths += lives - g.lives; lives = g.lives; }
          if (g.state === 'level_clear' || g.state === 'game_over') break;
        }
        if (g.state === 'level_clear') clears++;
      }
      out.push({ li, name: g.levelName, clears, deaths, seeds });
    }
    keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
    g.forcedSeed = null;
    return out;
  });
  const world1Deaths = rows.slice(0, 4).reduce((a: number, r: any) => a + r.deaths, 0);
  expect(world1Deaths, 'World 1 should be gentle: ' + JSON.stringify(rows.slice(0, 4))).toBeLessThanOrEqual(3);
  for (const r of rows) expect(r.clears, `${r.name} should be clearable by the bot on 3 lives`).toBeGreaterThanOrEqual(2);
});

test('a time-freeze holds boss telegraphs so no beam ever lands unannounced', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.forcedSeed = 21;
    g.startTour(17); g.introTimer = 0;                    // VOLTA
    g.player.invuln = 999;
    // Run until a warning column is on screen.
    let f = 0;
    while (!g.hazards.some((h: any) => h.type === 'boss_warning') && f++ < 60 * 30) { g.player.invuln = 999; g.update(1 / 60); }
    const warn = g.hazards.find((h: any) => h.type === 'boss_warning');
    if (!warn) return { found: false };
    const lifeBefore = warn.life;
    g.freezeTime = 3;
    for (let i = 0; i < 120; i++) { g.player.invuln = 999; g.update(1 / 60); }
    const during = { stillThere: g.hazards.includes(warn) && !warn.dead, lifeHeld: Math.abs(warn.life - lifeBefore) < 1e-6, beams: g.hazards.filter((h: any) => h.type === 'boss_beam').length };
    // After the thaw every beam that appears must overlap a warning that existed just before it.
    let unannounced = 0;
    const seen = new Set<any>();
    for (let i = 0; i < 60 * 6; i++) {
      const warnings = g.hazards.filter((h: any) => h.type === 'boss_warning').map((h: any) => [h.x, h.w]);
      g.player.invuln = 999;
      g.update(1 / 60);
      for (const h of g.hazards) {
        if (h.type !== 'boss_beam' || seen.has(h)) continue;
        seen.add(h);
        const ok = warnings.some((w: number[]) => Math.abs((w[0] + w[1] / 2) - (h.x + h.w / 2)) < 2);
        if (!ok) unannounced++;
      }
    }
    return { found: true, during, beamsAfter: seen.size, unannounced };
  });
  expect(res.found).toBe(true);
  expect(res.during).toEqual({ stillThere: true, lifeHeld: true, beams: 0 });
  expect(res.beamsAfter).toBeGreaterThan(0);
  expect(res.unannounced).toBe(0);
});

test('dash i-frames also protect from a bomb ball\'s lethal core', async ({ page }) => {
  await boot(page);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    const setup = () => {
      g.startTour(0); g.introTimer = 0;
      const B = g.balls[0].constructor;
      const bomb = new B(480, 440, 3, 'explosive', 0.001, 0);
      g.balls = [bomb, new B(900, 100, 0, 'normal', 0.001, 0)];
      g.player.x = 480; g.player.invuln = 0;
      return bomb;
    };
    let bomb = setup();
    bomb.fuse = 0.02;
    g.update(1 / 60); g.update(1 / 60);
    const standing = g.player.dead;
    bomb = setup();
    bomb.fuse = 0.05;
    kp.ShiftLeft = true;
    g.update(1 / 60);
    for (let i = 0; i < 4; i++) g.update(1 / 60);
    return { standing, dashing: g.player.dead, reason: g.lastDeathReason };
  });
  expect(res.standing).toBe(true);
  expect(res.dashing).toBe(false);
});
