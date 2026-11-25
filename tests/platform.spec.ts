import { test, expect } from '@playwright/test';
import { boot, collectErrors, realErrors } from './helpers';

/**
 * CrazyGames integration, exercised against a stub of the SDK v3 surface.
 * These cover the behaviours CrazyGames QA rejects builds for: gameplay
 * events, ads never interrupting play, rewards only on a finished ad, and
 * clean recovery when an ad errors or is abandoned.
 */

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__cg.calls.slice());

/** Step the sim until the run is over (or give up). */
async function driveToGameOver(page: import('@playwright/test').Page, start: string) {
  await page.evaluate((start) => {
    const g = (window as any).__game;
    (g as any)[start]();
    g.introTimer = 0;
    g.lives = 1;
    for (let i = 0; i < 5; i++) g.update(1 / 60);
    g.player.invuln = 0; g.player.dashIframes = 0;
    g.killPlayer(g.player, 'ball');
    g.update(1 / 60);
  }, start);
}

test('gameplayStart / gameplayStop bracket live play, and the SDK is initialised first', async ({ page }) => {
  await boot(page, { sdk: 'stub' });
  await page.evaluate(() => {
    const g = (window as any).__game, kp = (window as any).__keysPressed;
    g.startTour(0); g.introTimer = 0;
    for (let i = 0; i < 5; i++) g.update(1 / 60);
    kp.KeyP = true; g.update(1 / 60);          // pause
    for (let i = 0; i < 5; i++) g.update(1 / 60);
    kp.KeyP = true; g.update(1 / 60);          // resume
    for (let i = 0; i < 5; i++) g.update(1 / 60);
  });
  const c = (await calls(page)).filter((x: string) => x !== 'happytime');
  expect(c[0]).toBe('init');
  expect(c.indexOf('loadingStart')).toBeLessThan(c.indexOf('loadingStop'));
  const gp = c.filter((x: string) => x.startsWith('gameplay'));
  expect(gp).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart']);
});

test('rewarded continue: granted only when the ad finishes, exactly once, even on duplicate callbacks', async ({ page }) => {
  await boot(page, { sdk: 'stub' });
  await page.evaluate(() => { (window as any).__cg.adMode = 'double'; });
  await driveToGameOver(page, 'startPanic');
  expect(await page.evaluate(() => (window as any).__game.state)).toBe('game_over');
  await page.evaluate(() => { (window as any).__game.render(); });
  const btn = page.locator('[data-role="continue"]');
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForFunction(() => (window as any).__game.state === 'playing', null, { timeout: 4000 });
  const s = await page.evaluate(() => {
    const g = (window as any).__game;
    return { lives: g.lives, used: g.usedRewardedContinue, dead: g.player.dead, awaiting: g.awaitingAd };
  });
  expect(s).toEqual({ lives: 1, used: true, dead: false, awaiting: false });
  // Second death in the same run: no second offer.
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.player.invuln = 0; g.player.dashIframes = 0;
    g.killPlayer(g.player, 'ball'); g.update(1 / 60); g.render();
  });
  expect(await page.evaluate(() => (window as any).__game.state)).toBe('game_over');
  await expect(btn).toBeHidden();
  expect((await calls(page)).filter((x: string) => x === 'ad:rewarded').length).toBe(1);
});

test('rewarded continue: an errored ad grants nothing and leaves the run over', async ({ page }) => {
  await boot(page, { sdk: 'stub' });
  await page.evaluate(() => { (window as any).__cg.adMode = 'error'; });
  await driveToGameOver(page, 'startScoreAttack');
  await page.evaluate(() => { (window as any).__game.render(); });
  await page.locator('[data-role="continue"]').click();
  await page.waitForFunction(() => (window as any).__game.awaitingAd === false, null, { timeout: 4000 });
  const s = await page.evaluate(() => { const g = (window as any).__game; return { state: g.state, lives: g.lives, used: g.usedRewardedContinue }; });
  expect(s).toEqual({ state: 'game_over', lives: 0, used: false });
});

test('rewarded continue: leaving the screen mid-ad drops the reward instead of resurrecting the run', async ({ page }) => {
  await boot(page, { sdk: 'stub' });
  await page.evaluate(() => { (window as any).__cg.adMode = 'hold'; });
  await driveToGameOver(page, 'startPanic');
  await page.evaluate(() => { (window as any).__game.render(); });
  await page.locator('[data-role="continue"]').click();
  expect(await page.evaluate(() => (window as any).__game.awaitingAd)).toBe(true);
  // Player bails to the menu via the on-screen button while the ad is "showing".
  await page.evaluate(() => { const g = (window as any).__game; g.state = 'main_menu'; g.runToken++; });
  await page.evaluate(() => { const cb = (window as any).__cg.pending; cb.adStarted(); cb.adFinished(); });
  await page.waitForFunction(() => (window as any).__game.awaitingAd === false, null, { timeout: 4000 });
  const s = await page.evaluate(() => { const g = (window as any).__game; return { state: g.state, lives: g.lives, used: g.usedRewardedContinue }; });
  expect(s).toEqual({ state: 'main_menu', lives: 0, used: false });
});

test('no rewarded offer in Tour or the Daily, and none without the SDK', async ({ page, context }) => {
  await boot(page, { sdk: 'stub' });
  await driveToGameOver(page, 'startTour');
  await page.evaluate(() => { (window as any).__game.render(); });
  await expect(page.locator('[data-role="continue"]')).toBeHidden();

  const p2 = await context.newPage();
  await boot(p2, { sdk: 'blocked' });
  await driveToGameOver(p2, 'startPanic');
  await p2.evaluate(() => { (window as any).__game.render(); });
  await expect(p2.locator('[data-role="continue"]')).toBeHidden();
});

test('a midgame ad pauses audio + play, never fires mid-stage, and play resumes after it', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page, { sdk: 'stub' });
  const res = await page.evaluate(async () => {
    const g = (window as any).__game, A = (window as any).__AudioSys, cg = (window as any).__cg;
    cg.adMode = 'hold';
    const clear = () => {
      g.player.invuln = 999;
      let guard = 0;
      while (g.balls.length && guard++ < 300) { g._popBall(g.balls.find((b: any) => !b.dead), null); g.balls = g.balls.filter((b: any) => !b.dead); }
      g.update(1 / 60);
    };
    g.startTour(0); g.introTimer = 0;
    clear();
    const adsDuringPlay = cg.calls.filter((c: string) => c.startsWith('ad:')).length;
    const kp = (window as any).__keysPressed;
    kp.Enter = true; g.update(1 / 60);                 // first clear of the session: no ad
    const afterFirst = { state: g.state, level: g.levelIndex, ads: cg.calls.filter((c: string) => c.startsWith('ad:')).length };
    g.introTimer = 0;
    clear();
    kp.Enter = true; g.update(1 / 60);                 // second clear: midgame ad requested
    const requested = cg.calls.filter((c: string) => c === 'ad:midgame').length;
    const during = { awaiting: g.awaitingAd, state: g.state };
    cg.pending.adStarted();
    const ducked = A.ducked;
    // Input during the ad must not advance anything.
    kp.Enter = true; g.update(1 / 60);
    const stillWaiting = g.state;
    cg.pending.adFinished();
    await new Promise(r => setTimeout(r, 30));
    return { adsDuringPlay, afterFirst, requested, during, ducked, stillWaiting, after: { state: g.state, level: g.levelIndex, awaiting: g.awaitingAd, ducked: A.ducked } };
  });
  expect(res.adsDuringPlay).toBe(0);
  expect(res.afterFirst).toEqual({ state: 'playing', level: 1, ads: 0 });
  expect(res.requested).toBe(1);
  expect(res.during).toEqual({ awaiting: true, state: 'level_clear' });
  expect(res.ducked).toBe(true);
  expect(res.stillWaiting).toBe('level_clear');
  expect(res.after).toEqual({ state: 'playing', level: 2, awaiting: false, ducked: false });
  expect(realErrors(errors)).toEqual([]);
});

test('an ad that starts while a stage is live pauses it and hands control back afterwards', async ({ page }) => {
  await boot(page, { sdk: 'stub' });
  const res = await page.evaluate(async () => {
    const g = (window as any).__game, P = (window as any).__Platform, cg = (window as any).__cg;
    cg.adMode = 'hold';
    g.startTour(0); g.introTimer = 0;
    for (let i = 0; i < 10; i++) g.update(1 / 60);
    const t0 = g.simT;
    const done = P.requestRewardedAd();
    cg.pending.adStarted();
    const paused = g.state;
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    const frozen = g.simT === t0;
    cg.pending.adError('x');
    await done;
    return { paused, frozen, after: g.state };
  });
  expect(res).toEqual({ paused: 'paused', frozen: true, after: 'playing' });
});

test('the platform mute setting silences the game independently of the in-game toggle', async ({ page }) => {
  await boot(page, { sdk: 'stub', save: { schemaVersion: 3, medalScale: 3, unlockedLevel: 3, firstPopCelebrated: true, muted: false } });
  const res = await page.evaluate(() => {
    const A = (window as any).__AudioSys, cg = (window as any).__cg;
    const before = { muted: A.muted, cg: A.cgMuted };
    cg.muteListeners.forEach((cb: any) => cb({ muteAudio: true }));
    const on = { muted: A.muted, cg: A.cgMuted };
    cg.muteListeners.forEach((cb: any) => cb({ muteAudio: false }));
    return { before, on, off: { muted: A.muted, cg: A.cgMuted } };
  });
  expect(res.before).toEqual({ muted: false, cg: false });
  expect(res.on).toEqual({ muted: false, cg: true });
  expect(res.off).toEqual({ muted: false, cg: false });
});

test('the build makes no external requests besides the SDK, and has no outbound links', async ({ page }) => {
  const external: string[] = [];
  page.on('request', req => {
    const u = new URL(req.url());
    if (u.hostname !== 'localhost' && u.protocol !== 'data:' && u.protocol !== 'blob:') external.push(u.hostname);
  });
  await boot(page, { sdk: 'stub' });
  await page.evaluate(() => { const g = (window as any).__game; g.startTour(0); for (let i = 0; i < 30; i++) g.update(1 / 60); g.render(); });
  await page.waitForTimeout(400);
  expect([...new Set(external)]).toEqual(['sdk.crazygames.com']);
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href).filter(h => /^https?:/.test(h)));
  expect(links).toEqual([]);
  // The game never asks for fullscreen itself (the platform owns it).
  const fs = await page.evaluate(() => document.documentElement.innerHTML.includes('requestFullscreen'));
  expect(fs).toBe(false);
});
