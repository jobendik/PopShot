# Bubble Breaker Adventure — Plan for Further Development

> **Purpose of this document.** This is the working development plan and memory bank for taking Bubble Breaker Adventure from its current "feature-complete prototype" state to a polished, retention-driven release on **CrazyGames**. It is intentionally opinionated. It is also intentionally smaller than the existing `roadAhead.md`: the goal is something a developer (or a fresh chat session) can actually execute against, not a wishlist.
>
> **Read me first** if you are returning to this project after a break, or if you are an AI assistant being asked to continue the work.

---

## 0. Snapshot: what this game *is* today

Verified by reading the codebase, not from memory:

- **Stack:** TypeScript + Vite + a custom HTML5 Canvas engine. ~3,600 lines of source. No external runtime deps. No asset pipeline (everything is drawn procedurally). Procedural Web Audio.
- **Bundle:** Tiny. Loads almost instantly. This is a strategic advantage and must be protected.
- **Canvas:** Fixed logical resolution `960 x 540`, scaled to viewport via CSS `width: min(100vw, calc(100vh * 16 / 9))`. Responsive sizing already works.
- **Content:** 18 handcrafted levels across 6 themes (beach → desert → arctic → city → volcano → airship) + a Commander RIFT boss level. 8 ball types, 8 weapons, 10 pickup types, hazards, destructibles, moving platforms, neutral crabs.
- **Modes:** Tour (campaign), Score Attack, Panic (endless waves). Local 2-player co-op (P2 joins mid-game with I/K/U).
- **Polish already present:** forgiving hurtbox ([player.ts:57-59](src/entities/player.ts#L57-L59)), hit-pause, screen shake, combo system with decay, mute, pause, instant restart, intro banners per level, fixed-timestep update loop.
- **Save:** versioned localStorage key `bba_save_v1` in [systems/storage.ts](src/systems/storage.ts). Stores per-level bests, mode bests, mute, unlocked level. Simple to extend.
- **Critical gaps for CrazyGames:** no touch input, no CrazyGames SDK, no responsive HUD scaling, no medals, no daily challenge, no analytics hooks, monolithic [game.ts](src/game.ts) (1,411 lines), 8-item front menu.

**The game is genuinely good.** The single-screen ball-splitting loop works, the feel is mostly there, the content count is already above the median CrazyGames arcade entry. The job is *finishing it for the platform*, not rebuilding it.

---

## 1. North star

> **A modern, single-screen ball-splitting arcade game that loads in under 2 seconds, plays on phone or desktop, and gives the player exactly one reason to come back tomorrow.**

If a proposed change does not serve that sentence, it should be deferred or cut.

---

## 2. Strategic pillars

Only four. Every task in this plan ties back to one of them.

1. **Frictionless first session.** A first-time visitor on CrazyGames should be playing within ~5 seconds of clicking the thumbnail, and popping their first bubble within ~10 seconds. This is the single biggest determinant of CrazyGames placement.
2. **Mobile parity.** Touch input is non-negotiable. Roughly half of CrazyGames traffic is mobile. A keyboard-only game caps its reach at ~50%.
3. **One reason to return.** A daily challenge with a shared leaderboard and a visible streak. Not weekly events, not a battle pass — one good daily hook done well.
4. **Platform hygiene.** CrazyGames SDK wired correctly (gameads, banner ads, save data, happytime, gameplay start/stop). No console errors. Loads in any iframe size. Plays nicely with autoplay-blocked audio.

**Explicitly not pillars:** more weapons, more ball types, more bosses, more worlds, online co-op, level editor, cosmetics shop, story cutscenes. The roadmap in `roadAhead.md` lists ~60+ such items — they are not bad ideas, they are wrong-phase ideas. Resist them until after launch.

---

## 3. What we will *not* change

Decisions worth defending against future scope creep:

- **The custom Canvas engine.** Do not migrate to Phaser, PixiJS, or any framework. The current engine is small, fast, and proven on the existing content.
- **Procedural drawing and audio.** Do not introduce sprite atlases or audio files unless we have a specific, measured reason. The tiny bundle is a CrazyGames feature.
- **The 18 existing levels.** They work. Tune individual numbers if needed, but do not redesign them.
- **The three modes (Tour / Score Attack / Panic).** No new modes before launch.
- **Local co-op.** Keep it, polish the join prompt, but never let it complicate the solo onboarding.
- **The 960x540 logical resolution.** Resize the viewport scaling, never the game's internal coordinate system.

---

## 4. Phased plan

Each phase has a **goal**, **exit criteria** (what "done" means), and a **rough size**. Phases are mostly sequential — Phase 1 and 2 can overlap, but Phase 3 should not start until 1 and 2 are done.

### Phase 1 — Frictionless first session (1–2 weeks)

**Goal:** Cut every second of friction between "iframe loads" and "first ball pops."

**Changes:**

- Replace the 8-item main menu with a giant **PLAY** button (and a small "More" affordance for Modes/Controls/Credits). Map any key or click/tap to start Tour from the highest unlocked level.
- Auto-start Level 1 on first-ever visit (detected via empty save), skipping the menu entirely. Show a single line of contextual control hint that fades after the first pop.
- Make the level intro banner skippable instantly (any input dismisses it).
- Shorten the restart and game-over flows. "R to retry" should be the default action everywhere; game-over should auto-focus retry so a player can mash any key.
- Audit and minimize text on the HUD. Today it shows weapon, ammo, P2 hint, effect timers, combo, lives, score, target, level name, restart hint. That is too much. Keep score, timer, lives, weapon, combo. Move the rest to pause.

**Exit criteria:**

- Time-to-first-pop on a cold load, mouse only: ≤ 10 seconds.
- Retry after game-over: ≤ 1 second.
- HUD legibility test at 320px tall (mobile landscape): all elements readable.

### Phase 2 — Mobile parity (2–3 weeks)

**Goal:** Game is fully playable on a phone in landscape with no keyboard.

**Changes:**

- Add a touch input layer in [systems/input.ts](src/systems/input.ts) that exposes the same `keys` and `keysPressed` interface so the rest of the code doesn't need to know touch exists.
- On-screen controls: left half = movement (tap-and-hold left/right zones, *not* a virtual joystick — this is a one-axis game), right half = shoot button. Buttons rendered to the canvas, hit-tested in input layer.
- Auto-detect touch device (`'ontouchstart' in window`) and only render touch UI then. Desktop stays clean.
- Tune the touch zones so the player's thumbs don't cover key gameplay. Pause button top-right, large enough to hit but not accidentally tappable.
- Disable iOS double-tap-to-zoom and the rubber-band scroll on the canvas.
- Verify the responsive scaling already in [styles.css](src/styles.css) works in portrait (probably needs an orientation prompt — "Please rotate to landscape" overlay).
- Co-op is desktop-only. On touch, hide the P2 join hint entirely.

**Exit criteria:**

- Playable end-to-end on a mid-range Android in Chrome and on iOS Safari.
- 60 fps on a 2019-era phone with 100+ particles on screen.
- No layout breakage from 360×640 (small phone) up to 2560×1440 (desktop).
- An orientation lock or rotation prompt for portrait.

### Phase 3 — Retention hook: medals + daily challenge (2 weeks)

**Goal:** Give the player one specific reason to return tomorrow, and reasons to replay levels they already cleared.

**Changes:**

- **Per-level medals** (bronze/silver/gold) based on score thresholds defined in [data/levels.ts](src/data/levels.ts). Today the `targetScore` field exists but is barely used — extend it to 3 tiers. Display medals on the level select grid.
- **Daily Challenge mode** — one curated stage per UTC day, selected by seed from the existing 18 levels with a modifier rolled from a small set: fast balls, low gravity, double score, no pickups, tiny hurtbox. Same seed for all players globally.
- **Streak counter** stored in save data. Visible on main menu: "🔥 3 day streak — play today's challenge to keep it."
- **Share screen** after a daily challenge run: "I scored X on today's challenge — beat me." Just a clean result screen and a copy-link button for now; full social plumbing comes later.
- Extend the save schema. Bump key from `bba_save_v1` to `bba_save_v2` and write a migration in [systems/storage.ts](src/systems/storage.ts).

**New save fields:**
```
medals: Record<levelId, 0|1|2|3>     // none/bronze/silver/gold
dailyLastPlayed: 'YYYY-MM-DD'
dailyStreak: number
dailyBest: Record<'YYYY-MM-DD', number>
```

**Exit criteria:**

- Three medal thresholds defined and visible on every level.
- Daily Challenge accessible from main menu, deterministic per UTC day, score persisted.
- Streak increments correctly across day boundaries (test by manually adjusting system clock or by mocking `Date.now`).

### Phase 4 — CrazyGames SDK integration (1 week)

**Goal:** Ship-ready integration with the CrazyGames platform. Done correctly the first time so we are not rewriting it under launch pressure.

**Changes:**

- Add the CrazyGames SDK as a runtime script (loaded conditionally — when not on the platform, all SDK calls become no-ops so local dev still works).
- Create `src/systems/platform.ts` as a thin adapter: `Platform.gameplayStart()`, `Platform.gameplayStop()`, `Platform.happytime()`, `Platform.requestAd('midgame' | 'rewarded')`, `Platform.save(data)`, `Platform.load()`.
- Wire `gameplayStart` when entering `State.PLAYING`, `gameplayStop` when entering any non-playing state.
- Wire `happytime` on level clear and boss defeat.
- **Midgame ads:** only between levels in Tour mode, and never before the player has cleared at least one level in this session. Never during active gameplay.
- **Rewarded ads:** one optional rewarded "continue" on game-over in Score Attack and Panic. Never on Tour (which has unlimited retries already).
- **Banner ads:** if used, only on the main menu, never during a run.
- Replace the localStorage save backend with `Platform.save/load` (CrazyGames-aware), keeping localStorage as the local fallback.

**Exit criteria:**

- Game runs identically with and without the SDK present (verify with `npm run dev` locally vs. CrazyGames preview).
- No console errors or unhandled promise rejections in either mode.
- All SDK calls are debounced/guarded so they cannot fire twice in a row.
- Bundle size after build is still under 200 KB gzipped (today it should be well under this — keep it that way).

### Phase 5 — Feel and clarity pass (2 weeks)

**Goal:** Polish the things players unconsciously notice. Do *not* add new content.

**Changes (small, individually):**

- Stronger pop feedback: bigger particle burst on large balls, brief radial flash on the pop position.
- Ball shadows on the floor to make trajectory readable.
- Slight squash-and-stretch on floor bounce.
- Better telegraphs on hazards (electric pre-charge, flame vent windup) — many already exist, audit each.
- Reduced-motion / reduced-flash setting in the pause menu, wired to skip screen shake and white flash.
- Audio: layer the pop sound with a pitch shift based on ball size. Already partly there in [systems/audio.ts](src/systems/audio.ts), make it more pronounced.
- Combo voice/text feedback at thresholds (5, 10, 15, 20).

**Exit criteria:**

- 5 random people watching a 30-second clip can each name a moment they thought looked "satisfying."
- Reduced-motion mode produces no flash or shake.

### Phase 6 — Code health (1 week, optionally parallel)

**Goal:** Prevent [game.ts](src/game.ts) from collapsing under the new systems.

**Changes:**

- Split [game.ts](src/game.ts) (1,411 lines) into:
  - `src/state/` — one file per state (menu, levelSelect, playing, paused, gameOver, etc.) with `update(dt)` and `render(ctx)` exports.
  - `src/systems/collisions.ts` — extract the giant `resolveCollisions` method.
  - `src/systems/hud.ts` — extract HUD rendering.
  - `src/systems/menus.ts` — extract menu rendering.
- Keep `Game` as the orchestrator that owns the entity arrays and dispatches to state handlers.
- This is a *behavior-preserving refactor*. Write down expected behavior before, verify identical after.

**Exit criteria:**

- No file in `src/` exceeds 500 lines.
- Build still passes, all levels still play identically.

### Phase 7 — Launch prep (1 week)

**Goal:** Ship.

**Changes:**

- Final QA pass against the checklist in §8.
- Create CrazyGames thumbnail and capsule art. This is a real deliverable — the thumbnail is the single biggest determinant of click-through rate.
- Write a 1-sentence game description and a 3-bullet feature list for the CrazyGames listing.
- Submit, fix whatever CrazyGames review feedback comes back, ship.

---

## 5. After launch

These are not in scope before launch. They are listed so they have a place to live and do not pollute the pre-launch phases.

- More levels (target: 24 → 36 over time, one new world at a time).
- Cosmetics: player skins, harpoon trails, pop-effect variants. Unlocked via medals only — no premium currency.
- Achievements system.
- Online leaderboards for Daily Challenge and Panic.
- Weekly tournament mode.
- More bosses (next two: a slime queen, an airship).
- New ball types — only add one if it changes player decision-making, not for visual variety.
- Level editor for internal use, then maybe for players.

The `roadAhead.md` document is a useful idea bank for this phase — treat it as such.

---

## 6. Anti-goals — actively resist these

If a future conversation suggests any of the following, push back unless there is a measured, specific justification:

- **Rewriting in Phaser/PixiJS/Three.js.** The current engine works for this game's scope.
- **Adding a sprite asset pipeline.** Procedural drawing is a feature.
- **Permanent gameplay upgrades.** Will pollute leaderboards and turn this into a grind game.
- **Premium currency, IAP, battle pass.** Not appropriate for the platform or the genre.
- **Long story cutscenes or required dialogue.** Arcade game. Get to the action.
- **More than ~12 items on the main menu.** Today it has 8 already and that is too many.
- **Online co-op or any real-time multiplayer.** Massive engineering cost, low payoff for a single-screen arcade game.
- **Removing existing content "to focus."** The 18 levels are an asset, not debt.

---

## 7. Operating principles for future development

For whoever (human or AI) picks this up next:

1. **Measure before you cut, and after you ship.** "Time to first pop," "first-level completion rate," and "daily return rate" are the only three metrics that matter pre-launch. Find ways to estimate them — even by hand, by watching real people play.
2. **Prefer subtraction.** This codebase already has more features than it needs to launch. Most improvements should be removals or simplifications, not additions.
3. **Test on a real phone, not a simulator.** Touch input feels wrong in DevTools' mobile mode. Plug in an actual device.
4. **Never break local dev.** Every platform integration must have a no-SDK fallback path so the game runs from `npm run dev` without console errors.
5. **One feature, one PR.** Resist the urge to bundle "polish" changes into "feature" changes.
6. **When in doubt, do the boring thing.** Familiar UI patterns. Predictable controls. Standard CrazyGames integrations. This is not the project to innovate on tooling.

---

## 8. Implementation checklist

Tick these in order. Each item should be a single focused change.

### Phase 1 — Frictionless first session

- [ ] Replace main menu with a single large PLAY button + secondary nav
- [ ] Any key/click/tap on title screen starts the game
- [ ] First-ever visit auto-starts Level 1, no menu
- [ ] Level intro banner dismissible by any input
- [ ] Game-over screen auto-defaults to "retry"
- [ ] HUD audit: keep only score, timer, lives, weapon, combo (move rest to pause)
- [ ] P2 join hint hidden by default, surfaced only after Level 3
- [ ] Measure time-to-first-pop on a cold load; target ≤ 10s
- [ ] Measure time-to-retry after death; target ≤ 1s

### Phase 2 — Mobile parity

- [ ] Touch input layer in `src/systems/input.ts` that maps to existing `keys`/`keysPressed`
- [ ] Render on-canvas touch controls (left/right zones + shoot button) on touch devices
- [ ] Detect touch with `'ontouchstart' in window`, only show touch UI then
- [ ] Add `touch-action: none` and viewport meta to prevent iOS gestures
- [ ] Add pause button to canvas, top-right, large enough to hit
- [ ] Orientation prompt overlay when device is in portrait
- [ ] Hide co-op affordances on touch devices
- [ ] Test on real Android Chrome
- [ ] Test on real iOS Safari
- [ ] Verify 60 fps on a mid-range phone

### Phase 3 — Retention hook

- [ ] Define bronze/silver/gold thresholds per level in `data/levels.ts`
- [ ] Render medals on the level select grid
- [ ] Save schema: bump key to `bba_save_v2`, add migration
- [ ] Add `medals`, `dailyLastPlayed`, `dailyStreak`, `dailyBest` to save
- [ ] Daily Challenge mode entry point on main menu
- [ ] Deterministic seed-from-date selects a level and modifier
- [ ] Modifier pool: fast balls, low gravity, double score, no pickups, tiny hurtbox
- [ ] Streak counter visible on main menu with flame icon
- [ ] Streak resets if a day is skipped
- [ ] Post-run share screen with copy-link button
- [ ] Daily Challenge accessible exactly once per day per user (with practice mode infinite)

### Phase 4 — CrazyGames SDK

- [ ] Add CrazyGames SDK script tag (loaded conditionally)
- [ ] `src/systems/platform.ts` adapter with no-op fallbacks for local dev
- [ ] Call `gameplayStart` on entering `State.PLAYING`
- [ ] Call `gameplayStop` on every transition out of `State.PLAYING`
- [ ] Call `happytime` on level clear and boss defeat
- [ ] Midgame ad between Tour levels (skip on first level of session)
- [ ] Rewarded "continue" option on Score Attack and Panic game-over
- [ ] Migrate save to `Platform.save/load` with localStorage fallback
- [ ] Verify no console errors with SDK absent
- [ ] Verify no console errors with SDK present on CrazyGames preview
- [ ] Bundle size check: under 200 KB gzipped

### Phase 5 — Feel and clarity

- [ ] Bigger particle bursts on large-ball pops
- [ ] Radial flash on pop position
- [ ] Floor shadow under each ball
- [ ] Squash-and-stretch on floor bounce
- [ ] Audit every hazard for clear telegraph (electric, flame vent, falling rock, boss beam)
- [ ] Reduced-motion setting in pause menu (disables shake and flash)
- [ ] Pop sound pitch by ball size, more pronounced
- [ ] Combo voice/text at 5, 10, 15, 20 thresholds

### Phase 6 — Code health (can run parallel)

- [ ] Extract state handlers from `game.ts` into `src/state/`
- [ ] Extract `resolveCollisions` into `src/systems/collisions.ts`
- [ ] Extract HUD into `src/systems/hud.ts`
- [ ] Extract menus into `src/systems/menus.ts`
- [ ] No file in `src/` exceeds 500 lines
- [ ] All 18 levels still play identically after refactor

### Phase 7 — Launch prep

- [ ] Full smoke test: every mode, every level, both co-op modes, mobile + desktop
- [ ] Test in CrazyGames developer preview
- [ ] Test on at least three real devices (desktop, Android, iOS)
- [ ] Test with audio context blocked (autoplay policy)
- [ ] Test with localStorage disabled
- [ ] Verify save migration from `v1` to `v2` works for existing players
- [ ] Create thumbnail artwork (the most important asset for CTR)
- [ ] Write game description (one sentence)
- [ ] Write feature bullets (three)
- [ ] Submit to CrazyGames
- [ ] Address review feedback
- [ ] Ship

---

## 9. Glossary for fresh chats

- **CrazyGames** — the target platform. Free-to-play browser games. Discovery happens via thumbnail-driven category pages. Featured placement depends on session length, return rate, completion rate.
- **Tour mode** — the campaign. 18 levels, currently linear, gated by `unlockedLevel`.
- **Score Attack** — replayable scoring mode that cycles through levels.
- **Panic mode** — endless wave survival.
- **Level intro banner** — the floating box at the start of each level showing the level name and a tip.
- **Combo** — chain of consecutive pops without missing a shot. Boosts score. Decays over time.
- **Hit pause** — brief freeze-frame after a hit, for impact feel. Already implemented.
- **bba_save_v1** — current localStorage save key. To become `_v2` in Phase 3.

---

## 10. Closing principle

> The game is already good. The work ahead is not to make it bigger; it is to make it the version of itself that a player on a phone, who has never heard of it, will play for 30 seconds — and then come back tomorrow.

If a future change does not directly serve that sentence, defer it.
