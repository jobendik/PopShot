import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The production bundle only exposes its debug hooks behind this flag. */
export const DEBUG_URL = '/?popdebug=1';

const BOT_SRC = readFileSync(join(process.cwd(), 'tools', 'bot.js'), 'utf8');

export interface SaveSeed { [key: string]: unknown }

/** A save that skips first-visit onboarding and unlocks the whole Tour. */
export const VETERAN_SAVE: SaveSeed = {
  schemaVersion: 3, medalScale: 3, unlockedLevel: 27,
  firstPopCelebrated: true, mobileOnboardingSeen: true, muted: true,
};

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

export function realErrors(errors: string[]): string[] {
  return errors.filter(e => !e.includes('sdk.crazygames.com') && !e.includes('Failed to load resource'));
}

/**
 * Boot the game with debug hooks and (optionally) a seeded save.
 * `sdk: 'blocked'` aborts the CrazyGames script (the local-dev path);
 * `sdk: 'stub'` serves a controllable fake SDK (see STUB_SDK).
 */
export async function boot(page: Page, opts: { save?: SaveSeed | null; rawSave?: string; sdk?: 'blocked' | 'stub'; cloud?: string } = {}) {
  const sdk = opts.sdk ?? 'blocked';
  if (sdk === 'blocked') {
    await page.route('**/sdk.crazygames.com/**', r => r.abort());
  } else {
    await page.route('**/sdk.crazygames.com/**', r => r.fulfill({ contentType: 'application/javascript', body: STUB_SDK }));
  }
  const save = opts.rawSave ?? (opts.save === null ? null : JSON.stringify(opts.save ?? VETERAN_SAVE));
  await page.addInitScript(({ save, cloud }) => {
    // Seed only once per test: a later reload must see whatever the game wrote.
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    if (save != null) localStorage.setItem('popshot_save_v2', save);
    if (cloud != null) (window as any).__cgCloudSeed = cloud;
  }, { save, cloud: opts.cloud ?? null });
  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => (window as any).__game);
  await page.addScriptTag({ content: BOT_SRC });
  await page.evaluate(() => { (window as any).__game.manualStep = true; });
}

/** A controllable stand-in for the CrazyGames SDK v3 surface the game uses. */
const STUB_SDK = `
(function () {
  var cg = window.__cg = { calls: [], adMode: 'finish', pending: null, cloud: {}, muteListeners: [] };
  if (window.__cgCloudSeed) cg.cloud['popshot_save_v2'] = window.__cgCloudSeed;
  window.CrazyGames = { SDK: {
    init: function () { cg.calls.push('init'); return Promise.resolve(); },
    game: {
      gameplayStart: function () { cg.calls.push('gameplayStart'); },
      gameplayStop: function () { cg.calls.push('gameplayStop'); },
      happytime: function () { cg.calls.push('happytime'); },
      loadingStart: function () { cg.calls.push('loadingStart'); },
      loadingStop: function () { cg.calls.push('loadingStop'); },
      setGameContext: function () {},
      settings: { muteAudio: false },
      addSettingsChangeListener: function (cb) { cg.muteListeners.push(cb); },
    },
    ad: {
      hasAdblock: function () { return Promise.resolve(false); },
      requestAd: function (type, cb) {
        cg.calls.push('ad:' + type);
        cg.pending = cb;
        if (cg.adMode === 'finish') { cb.adStarted(); setTimeout(function () { cb.adFinished(); cb.adFinished(); }, 30); }
        else if (cg.adMode === 'error') { setTimeout(function () { cb.adError('no fill'); }, 30); }
        else if (cg.adMode === 'double') { cb.adStarted(); setTimeout(function () { cb.adFinished(); cb.adError('late'); cb.adFinished(); }, 30); }
        /* 'hold': the test resolves it by hand via window.__cg.pending */
      },
    },
    user: { getUser: function () { return Promise.resolve(null); } },
    data: {
      getItem: function (k) { return Promise.resolve(cg.cloud[k] == null ? null : cg.cloud[k]); },
      setItem: function (k, v) { cg.cloud[k] = v; return Promise.resolve(); },
    },
  } };
})();
`;
