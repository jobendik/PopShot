import { test, expect } from '@playwright/test';
import { boot } from './helpers';

/** Save compatibility: every upgrade path keeps what the player earned. */

const V2_SAVE = {
  schemaVersion: 2, medalScale: 2,
  unlockedLevel: 10,                              // old index 10 = arctic_3
  bestTour: { beach_1: 4100, beach_2: 5200 },
  medals: { beach_1: 3, beach_2: 2, desert_1: 1 },
  bestScoreAttack: 25500, bestPanicWave: 12, bestPanicScore: 31000,
  bestBossRush: 9000, bestBossRushCount: 3,
  dailyStreak: 4, dailyLastPlayed: '2026-11-20', dailyBest: { '2026-11-20': 7000 },
  lifetimePops: 1234, lifetimeMaxCombo: 22, lifetimeTricks: 40, bestMultiPop: 6,
  trickStats: { bank_shot: 16, clutch: 1 },
  missionStars: 13, equippedTitleId: 'marksman', playerPaletteId: 'classic',
  muted: true, reducedMotion: true, firstPopCelebrated: true, mobileOnboardingSeen: true,
  seenTitleIds: 'marksman,bubble_buster',
};

test('v2 save upgrades to v3: unlocks remapped, medals kept, incomparable scores archived', async ({ page }) => {
  await boot(page, { save: V2_SAVE });
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('popshot_save_v2')!));
  expect(d.schemaVersion).toBe(3);
  expect(d.medalScale).toBe(3);
  // Two boss stages were inserted (after Desert and after City): old 10 → new 11.
  expect(d.unlockedLevel).toBe(11);
  // Earned medal tiers survive; the old-scale scores behind them are cleared.
  expect(d.medals).toEqual({ beach_1: 3, beach_2: 2, desert_1: 1 });
  expect(d.bestTour).toEqual({});
  // Mode bests move to the archive rather than being overwritten or mixed.
  expect(d.legacy).toEqual({ scoreAttack: 25500, panicWave: 12, panicScore: 31000, bossRush: 9000, bossRushCount: 3 });
  expect(d.bestScoreAttack).toBe(0);
  expect(d.bestPanicWave).toBe(0);
  // Everything else is untouched.
  expect(d.dailyStreak).toBe(4);
  expect(d.dailyBest).toEqual({ '2026-11-20': 7000 });
  expect(d.lifetimePops).toBe(1234);
  expect(d.lifetimeMaxCombo).toBe(22);
  expect(d.trickStats).toEqual({ bank_shot: 16, clutch: 1 });
  expect(d.missionStars).toBe(13);
  expect(d.equippedTitleId).toBe('marksman');
  expect(d.muted).toBe(true);
  expect(d.reducedMotion).toBe(true);
  // Titles earned under the old model are still earned (via the archive).
  const titles = await page.evaluate(() => {
    const S = (window as any).__Storage.data;
    return { waveRider: Math.max(S.bestPanicWave, S.legacy.panicWave) >= 10, scoreHunter: S.legacy.scoreAttack >= 20000 };
  });
  expect(titles).toEqual({ waveRider: true, scoreHunter: true });
});

test('the upgrade runs exactly once and is stable across reloads', async ({ page }) => {
  await boot(page, { save: V2_SAVE });
  const first = await page.evaluate(() => localStorage.getItem('popshot_save_v2'));
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  const second = await page.evaluate(() => JSON.parse(localStorage.getItem('popshot_save_v2')!));
  const a = JSON.parse(first!);
  expect(second.unlockedLevel).toBe(a.unlockedLevel);      // not remapped a second time
  expect(second.legacy).toEqual(a.legacy);
  expect(second.medals).toEqual(a.medals);
});

test('legacy level-index remap covers every old position', async ({ page }) => {
  const cases: [number, number][] = [[0, 0], [7, 7], [8, 9], [15, 16], [16, 18], [23, 25], [24, 26], [25, 27]];
  for (const [oldIdx, newIdx] of cases) {
    await page.goto('about:blank');
    await page.context().clearCookies();
    const p = await page.context().newPage();
    await boot(p, { save: { schemaVersion: 2, medalScale: 2, unlockedLevel: oldIdx, firstPopCelebrated: true } });
    const got = await p.evaluate(() => (window as any).__Storage.data.unlockedLevel);
    expect(got, `old index ${oldIdx}`).toBe(newIdx);
    await p.close();
  }
});

test('v1 save and corrupt save both boot cleanly', async ({ page, context }) => {
  // v1 lived under its own key and only knew six fields.
  await page.route('**/sdk.crazygames.com/**', r => r.abort());
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__s')) return;
    sessionStorage.setItem('__s', '1');
    localStorage.setItem('bba_save_v1', JSON.stringify({ unlockedLevel: 24, bestScoreAttack: 9000, muted: true, bestTour: { beach_1: 99999 } }));
  });
  await page.goto('/?popdebug=1');
  await page.waitForFunction(() => (window as any).__game);
  const d = await page.evaluate(() => (window as any).__Storage.data);
  expect(d.schemaVersion).toBe(3);
  expect(d.unlockedLevel).toBe(26);                 // old final-boss index → new final-boss index
  expect(d.legacy.scoreAttack).toBe(9000);
  expect(d.bestTour).toEqual({});                   // cumulative-era scores never carried over
  expect(d.muted).toBe(true);

  const p2 = await context.newPage();
  await boot(p2, { rawSave: '{not json' });
  const state = await p2.evaluate(() => ({ s: (window as any).__game.state, v: (window as any).__Storage.data.schemaVersion }));
  expect(state.v).toBe(3);
  expect(['playing', 'main_menu']).toContain(state.s);
});

test('a stale v2 CLOUD save is upgraded before it is merged into a v3 local save', async ({ page }) => {
  const cloud = JSON.stringify({ ...V2_SAVE, unlockedLevel: 20, bestScoreAttack: 99000, medals: { city_1: 3 } });
  await boot(page, {
    sdk: 'stub', cloud,
    save: { schemaVersion: 3, medalScale: 3, unlockedLevel: 5, bestScoreAttack: 40000, medals: { beach_1: 1 }, bestTour: { beach_1: 5000 }, firstPopCelebrated: true, muted: true },
  });
  await page.waitForFunction(() => (window as any).__Storage.data.unlockedLevel > 5, null, { timeout: 5000 });
  const d = await page.evaluate(() => (window as any).__Storage.data);
  expect(d.unlockedLevel).toBe(22);                 // max(local 5, remap(cloud 20) = 22)
  expect(d.bestScoreAttack).toBe(40000);            // the old-scale 99000 must NOT win
  expect(d.legacy.scoreAttack).toBe(99000);         // …it is archived instead
  expect(d.medals).toEqual({ beach_1: 1, city_1: 3 });
  expect(d.bestTour).toEqual({ beach_1: 5000 });    // new-scale local best survives
});

test('progress is written through: clearing a stage persists unlock, best and medal', async ({ page }) => {
  await boot(page, { save: { schemaVersion: 3, medalScale: 3, unlockedLevel: 0, firstPopCelebrated: true, mobileOnboardingSeen: true, muted: true } });
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.startTour(0); g.introTimer = 0;
    g.player.invuln = 999;
    let guard = 0;
    while (g.balls.length && guard++ < 200) { g._popBall(g.balls.find((b: any) => !b.dead), null); g.balls = g.balls.filter((b: any) => !b.dead); }
    g.update(1 / 60);
    return { state: g.state, summary: g.summary, saved: JSON.parse(localStorage.getItem('popshot_save_v2')!) };
  });
  expect(res.state).toBe('level_clear');
  expect(res.saved.unlockedLevel).toBe(1);
  expect(res.saved.bestTour.beach_1).toBe(res.summary.total);
  expect(res.saved.medals.beach_1).toBeGreaterThanOrEqual(1);
});
