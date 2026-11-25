#!/usr/bin/env node
// Batch simulator: runs the mortal bot over every Tour stage for N seeds and
// prints clear rate, deaths, time and score percentiles.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/sim.mjs [--seeds 8] [--levels 0,1,2] [--url http://localhost:4173/?popdebug=1]
//
// Uses the fixed-timestep loop directly (game.update(1/60)), so a full Tour
// sweep takes seconds, not minutes, and never depends on rendering.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const SEEDS = +arg('seeds', 6);
const URL = arg('url', 'http://localhost:5173/');
const LEVELS = arg('levels', '') ? arg('levels', '').split(',').map(Number) : null;
const botSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'bot.js'), 'utf8');

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300)));
await page.route('**/sdk.crazygames.com/**', r => r.abort());
await page.addInitScript(() => {
  localStorage.setItem('popshot_save_v2', JSON.stringify({ schemaVersion: 3, medalScale: 3, unlockedLevel: 27, firstPopCelebrated: true, mobileOnboardingSeen: true, muted: true }));
});
await page.goto(URL);
await page.waitForFunction(() => window.__game);
await page.addScriptTag({ content: botSrc });

const rows = await page.evaluate(({ SEEDS, LEVELS }) => {
  const g = window.__game, keys = window.__keys, kp = window.__keysPressed;
  g.manualStep = true;
  const out = [];
  const total = 27;
  for (let li = 0; li < total; li++) {
    if (LEVELS && !LEVELS.includes(li)) continue;
    const runs = [];
    for (let s = 0; s < SEEDS; s++) {
      g.forcedSeed = 1000 + s * 7919 + li * 131;
      window.__botSeed(g.forcedSeed);
      g.startTour(li); g.introTimer = 0;
      let f = 0, deaths = 0, lastLives = g.lives, invalid = '';
      const maxF = 60 * 260;
      for (; f < maxF; f++) {
        if (g.state === 'playing') window.__botStep(g, keys, kp);
        g.update(1 / 60);
        if (g.lives < lastLives) { deaths += lastLives - g.lives; lastLives = g.lives; }
        if (g.state === 'level_clear' || g.state === 'game_over' || g.state === 'victory') break;
        for (const b of g.balls) if (!(b.x === b.x) || b.x < 0 || b.x > 960 || b.y < 40 || b.y > 500) invalid = 'ball ' + b.x + ',' + b.y;
      }
      const lvlScore = g.summary ? g.summary.total : g.score;
      runs.push({ cleared: g.state === 'level_clear' || g.state === 'victory', deaths, t: f / 60, score: lvlScore, chain: g.maxCombo, perfect: g.summary ? g.summary.perfect > 0 : false, tricks: g.runTricks, grazes: g.runGrazes, ps: g.runPopShots, invalid, timeouts: g.lastDeathReason === 'timeout' ? 1 : 0, reason: g.lastDeathReason });
    }
    out.push({ li, name: g.levelName, target: g.targetScore, runs });
  }
  g.forcedSeed = null;
  keys.ArrowLeft = keys.ArrowRight = keys.Space = false;
  return out;
}, { SEEDS, LEVELS });

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log('lvl name               clear  deaths/run  time   score p25/p50/p75      chain  tricks graze  target  medal@p50  reasons');
for (const r of rows) {
  const n = r.runs.length;
  const cleared = r.runs.filter(x => x.cleared);
  const sc = cleared.map(x => x.score);
  const med = sc.length ? pct(sc, 0.5) : 0;
  const medal = !sc.length ? '-' : med >= r.target * 1.5 ? 'gold' : med >= r.target * 1.25 ? 'silver' : med >= r.target ? 'bronze' : 'none';
  const reasons = {};
  for (const x of r.runs) if (x.deaths) reasons[x.reason] = (reasons[x.reason] || 0) + 1;
  console.log(
    String(r.li).padStart(2), r.name.padEnd(18),
    (cleared.length + '/' + n).padStart(5),
    (r.runs.reduce((a, x) => a + x.deaths, 0) / n).toFixed(2).padStart(10),
    ((cleared.reduce((a, x) => a + x.t, 0) / (cleared.length || 1)).toFixed(0) + 's').padStart(6),
    (sc.length ? pct(sc, 0.25) + '/' + med + '/' + pct(sc, 0.75) : '-').padStart(22),
    String(Math.round(r.runs.reduce((a, x) => a + x.chain, 0) / n)).padStart(6),
    String(Math.round(r.runs.reduce((a, x) => a + x.tricks, 0) / n)).padStart(6),
    String(Math.round(r.runs.reduce((a, x) => a + x.grazes, 0) / n)).padStart(5),
    String(r.target).padStart(7), medal.padStart(8), ' ', JSON.stringify(reasons),
    r.runs.some(x => x.invalid) ? ' INVALID ' + r.runs.find(x => x.invalid).invalid : '',
  );
}
if (errs.length) console.log('PAGE ERRORS:\n' + [...new Set(errs)].join('\n'));
await browser.close();
