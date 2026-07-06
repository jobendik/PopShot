import { test, expect, type Page } from '@playwright/test';

/**
 * Production-build smoke suite — the checks a CrazyGames reviewer would do
 * first: does it boot clean, does a first-time visitor land in gameplay
 * immediately, do pause/restart work, does the save survive a reload, and
 * does nothing throw on resize.
 *
 * All checks observe `body[data-state]` (kept in sync every frame by
 * src/ui/domRoot.ts) so the suite needs no dev-only test hooks.
 */

/** Console/page errors collected per test. The CrazyGames SDK script is
 *  allowed to fail to load (blocked/offline dev) — everything else fails
 *  the test. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

function realErrors(errors: string[]): string[] {
  return errors.filter(e =>
    !e.includes('sdk.crazygames.com') &&           // SDK CDN blocked in CI
    !e.includes('Failed to load resource'),         // ditto (script/asset 404 from blocked hosts)
  );
}

test('first visit boots straight into gameplay with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  // First-time visitor (empty localStorage) skips the menu entirely.
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });
  await expect(page.locator('#game')).toBeVisible();
  // Let a couple seconds of gameplay run so update/render/collision code executes.
  await page.waitForTimeout(2000);
  expect(realErrors(errors)).toEqual([]);
});

test('pause, resume, and instant restart all work from the keyboard', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });

  await page.keyboard.press('KeyP');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');

  await page.keyboard.press('KeyP');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');

  // R = instant in-run restart; must land back in playing without a menu trip.
  await page.keyboard.press('KeyR');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  expect(realErrors(errors)).toEqual([]);
});

test('returning player lands on the main menu and PLAY re-enters gameplay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });

  // Simulate progress so the next load is a "returning player" boot.
  await page.evaluate(() => {
    const raw = localStorage.getItem('popshot_save_v2');
    const save = raw ? JSON.parse(raw) : {};
    save.unlockedLevel = 1;
    localStorage.setItem('popshot_save_v2', JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'main_menu', { timeout: 10_000 });

  // The save round-tripped: PLAY reads "CONTINUE" for a player with progress.
  const playLabel = page.locator('[data-role="play-label"]');
  await expect(playLabel).toContainText('CONTINUE');

  // Two screens carry a data-role="play" button (menu + daily intro); the
  // menu's CTA is the .menu__play one.
  await page.locator('.menu__play').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });
});

test('gameplay survives aggressive viewport resizing', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });

  // CrazyGames iframe floor, a tablet-ish box, a portrait phone, then desktop.
  for (const vp of [
    { width: 907, height: 510 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
  }
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  expect(realErrors(errors)).toEqual([]);
});

test('mute persists across reload (save/load)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });
  await page.keyboard.press('KeyM'); // toggle mute mid-game
  const muted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('popshot_save_v2') || '{}').muted === true);
  expect(muted).toBe(true);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing', { timeout: 10_000 });
  const stillMuted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('popshot_save_v2') || '{}').muted === true);
  expect(stillMuted).toBe(true);
});
