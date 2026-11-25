# PopShot

A TypeScript + Vite + HTML5 Canvas arcade game. **Pop. Split. Dodge. Survive.** It starts from the classic bouncing-ball formula and adds chains, a cascading super shot, a dash, elemental ball reactions, world mechanics and three bosses. Procedural art, asset-based audio with a procedural WebAudio fallback, no runtime dependencies, CrazyGames-ready.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check + production build (outputs to `dist/`)
- `npm run preview` — serve the production build locally

## Engine decision

Custom Canvas + TypeScript, no framework. The core is a compact single-screen game loop with hand-tuned collision, immediate-mode menus, and Web Audio synthesis. Phaser would add weight and a rewrite cost before the project has the sprite, animation, tiled-map, asset-loading, or scene-management complexity to justify it.

Reconsider later only if development moves toward asset-heavy worlds, reusable scenes, animation pipelines, camera work, or editor-driven level production.

## What's in the build

### The loop
- **Pop → split → dodge**, with constant-height arcade arcs you can learn to read.
- **Chain** — every pop refreshes a timer ring; the chain multiplies score up to ×5. A missed shot never breaks it (so touch auto-fire and keyboard score on equal terms). Clear a stage in one unbroken chain for a **PERFECT CHAIN**.
- **PopShot** — pops, tricks and near misses charge the gold bar under your bot. When it is full the next shot is a piercing lance that makes every ball it touches burst all the way down its family tree.
- **Dash** — a short burst you cannot be hurt during (`Shift` / `S` / `↓`, gamepad bumpers, double-tap on touch). Dash *through* a ball for **PHASE**.
- **Graze** — let a ball skim past you for score and PopShot charge.

### Modes
- **Tour** — 27 stages: six worlds of four, and three bosses (King Globo after the Desert, VOLTA after the City, Commander RIFT at the end).
- **Score Attack** — 3 lives across the whole Tour on one score. One optional rewarded continue per run where ads are available.
- **Panic** — endless waves built from named recipes; every 4 waves the arena rotates to the next zone (a world backdrop plus that world's mechanic). Rainbow Gauge, Star Bubbles and time-stop micro-balls are all still here.
- **Boss Rush** — all three bosses back to back; each one beaten restores a life.
- **Daily Challenge** — one seeded stage per UTC day with a modifier. The seed drives the *bounces* too, so every player gets the same run. Ten modifiers: `double_score`, `no_pickups`, `tiny_hurtbox`, `big_bubbles`, `sudden_death`, `windstorm`, `moon_bounce`, `live_wires`, `overcharge`, `black_ice`.

### Worlds — one rule each
| World | What changes |
| --- | --- |
| Beach | Nothing. The fundamentals. |
| Desert | Sandstorm gusts shove balls sideways (streaks warn first). Bomb and electric balls arrive. |
| Arctic | The floor is ice — you slide. Smoke, sludge, armored balls. |
| City | Pinball bumpers kick balls and block shots. Hexagons, barriers, birds. |
| Volcano | Eruptions rain rocks on a beat (rings show where). Vents, lava floors, the dragon. |
| Airship | Deck fans blow balls sky-high. Everything at once. |

### Balls and how they interact
- **Electric** — drops a telegraphed bolt; when popped, its charge **arcs** to the nearest ball and pops that too.
- **Bomb (explosive)** — never splits. Shoot it to light the fuse: everything in the dashed ring pops, anything just outside is shoved, smoke is blown away — and the red core knocks *you* out.
- **Lava / sludge** — leave floor patches. Lava burns you and launches balls that land on it higher; slime slows you, makes balls hop low, and gives your treads grip on ice.
- **Armored** — big ones need two hits (or one blast). **Smoke** fogs the view. **Hexagon** bounces on jagged, faster paths. **Bonus** drops a pickup.

### Weapons
Harpoon · Twin Harpoon (two wires out) · Trident (one volley of three) · Power Wire (anchors and survives three pops) · Split Bolts (45° pair, one wall bounce) · Machine Gun · Rail Laser (a sustained column that burns through platforms and bumpers) · Flamethrower · Scatter Shot · Ricochet Star (bounces off walls, ceiling and floor) · Bomb.

### Bosses
- **King Globo** — a colossal ball. Break it and it splits into two princes, then four squires. Spits balls; belly-flops when wounded.
- **VOLTA** — its shield deflects every shot. Light the bomb balls it feeds into the arena so they burst beside it, then fire into the overload window.
- **Commander RIFT** — three acts: open hull → shield + tractor beam that steals balls and hurls them → meltdown (platforms vaporised, gravity rifts).

### Co-op
Local 2–4 players (P2 on keyboard: `J`/`L` move, `I` fire, `O` dash; extra gamepads join P2–P4). Shared lives and PopShot meter. A downed teammate leaves a beacon for 10 seconds: reach them for a **RESCUE** (+500, and they get up where they fell). Pops from two players in one burst score as **TAG TEAM**.

### Persistence
- Versioned save, schema 3. Upgrading a schema-2 save remaps `unlockedLevel` for the two inserted boss stages, keeps every earned medal tier, clears per-stage best *scores* (the scoring model changed), and moves old mode bests to a `legacy` block that is still shown ("Classic") and still counts for titles. A stale cloud save goes through the same upgrade before it is merged.
- Storage key is still `popshot_save_v2` (the key is a label; `schemaVersion` is the version).

### Platform integration
- **CrazyGames SDK v3** via `src/systems/platform.ts`: `gameplayStart`/`Stop` on state transitions, `happytime` on bests, midgame ads only between Tour stages (never the first clear of a session, 60 s minimum spacing), one rewarded continue per run in Score Attack / Panic / Boss Rush. The ad hook pauses play and suspends audio. Rewards are granted only on `adFinished`, exactly once, and only if the player is still on that game-over screen.
- A run that used a continue still counts for local bests but is never submitted to the platform leaderboard.
- Touch: invisible half-screen hold zones, always-on auto-fire, double-tap to dash (toggle in the pause menu). Portrait viewports rotate the stage.
- No custom fullscreen button, no outbound links, no external requests besides the SDK.
- Every SDK call is a safe no-op when the script is absent.

### Bundle
- ~330 KB raw / ~97 KB gzipped JS + ~17 KB gzipped CSS (was 255 / 72 before the systems overhaul). No runtime dependencies. Audio streams lazily with a preload list and a procedural WebAudio fallback.
- Fonts (Bowlby One, Inter) are self-hosted woff2 under `public/fonts/` (OFL).

## Testing and the simulator

```bash
npm test                      # build + Playwright: smoke, gameplay invariants, save migration, platform/ads
node tools/sim.mjs --seeds 12 # bot sweep: clear rate, deaths, time, score percentiles per stage
```

- The fixed-timestep loop can be stepped directly (`game.update(1/60)`), so the tests simulate the whole Tour in under a second without rendering.
- Debug hooks (`window.__game` …) exist in dev builds, and in production builds only when the page is opened with `?popdebug=1`.
- `tools/bot.js` is a predictive dodge-and-shoot bot. It is a measuring stick, not a model of a human — see `DEVNOTES.md`.
- If Playwright cannot find its bundled browser, point it at one: `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm test`.

## Architecture

```
src/
├── main.ts                 # boot, SDK init, error handlers, first-visit auto-start
├── game.ts                 # Game orchestrator: entity arrays, lifecycle, main loop
├── constants.ts            # W/H/GRAVITY, ball/weapon/pickup/mode types, themes
├── data/levels.ts          # 27 hand-crafted stage definitions (data-driven)
├── entities/               # Ball, Crab, Creature, Destructible, Hazard, Particle,
│                           # Pickup, Platform, Player, Projectile, gadgets (Bumper,
│                           # Fan, wind), bosses/ (base + Globo, Volta, Rift)
├── rendering/canvas.ts     # background, ambience layer, shared draw helpers
├── state/                  # per-state update()/render() — one file per State enum
│                           # mainMenu, modeSelect, levelSelect, playing, pause,
│                           # levelClear, gameOver, daily, infoScreens
└── systems/                # analytics, audio, collisions, combat, daily, input,
                            # panic (wave recipes + zones), platform (CG SDK),
                            # rng (seeded gameplay RNG), storage, titles
tools/                      # bot.js (test bot), sim.mjs (batch simulator)
tests/                      # Playwright: smoke, gameplay, save, platform
```

## Local dev

```bash
npm install
npm run dev          # http://localhost:5173
npm run build && npm run preview
```

The CrazyGames SDK is loaded from `index.html` via the official CDN. Local dev runs without it (every SDK call no-ops); the in-game console will simply show `sdk.init.done { hasSDK: false }`.

## GitHub Pages

The app is configured for GitHub Pages with relative asset paths, so the same production build works for both project pages and user pages without hard-coding a repository name.

Live site: https://jobendik.github.io/PopShot/

To publish it:

1. Push to the `main` branch.
2. In GitHub, open Settings -> Pages.
3. Set Source to `GitHub Actions`.

The workflow in `.github/workflows/deploy-pages.yml` will build `dist/` and deploy it automatically.

## Status

Playable end to end and covered by an automated regression suite. Still owed before a store submission — none of it can be done from a build machine:

- **Human playtesting**, especially of difficulty, the dash on touch, and whether the new feedback is too loud.
- **Listening to the mix.** The audio wiring was done blind (see `DEVNOTES.md`).
- **Real devices** at CrazyGames iframe sizes (907×510 → 1366×768) and on phones, plus a real gamepad.
- **Audio provenance** — see `CREDITS.md`: the source libraries are named, but the per-file mapping and licence texts are not in the repo.
- Thumbnail / capsule art and listing copy.
