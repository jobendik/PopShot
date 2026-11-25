# PopShot — development notes (systems overhaul)

Short record of what was found, what was decided and why, what was measured,
and what was thrown away. Numbers come from `tools/sim.mjs` (a scripted bot)
or headless Chromium — **not** from human playtesting. Treat the bot as a
ruler for comparing stage A against stage B, not as a player.

## 1. What the baseline actually was

Verified by reading the code and running it, not from the README:

| Area | Finding |
| --- | --- |
| Bundle | 254.7 KB / 72.3 KB gz JS, 16.8 KB gz CSS (README was accurate) |
| Audio | 150 SFX ids shipped, **45 wired**. Every weapon played the harpoon sound. Per-world ambience loops existed and were never played. |
| Combo | A missed shot reset the combo. Touch auto-fire is always on, so on phones the combo, the accuracy bonus and the 2000-pt no-miss bonus were effectively unreachable. |
| Boss | One boss. Boss Rush was that boss three times. Its sweep beam could spawn at player height across the full arena width — unavoidable ~7% of the time. Its attack used `setTimeout`, so a beam could fire while paused. |
| Bosses, perf | `ctx.filter = 'brightness()'` hit-flash dropped boss stages to 37 fps (133 ms p95) in software rendering. |
| Determinism | `Math.random()` everywhere, including initial ball direction — the "deterministic" Daily was only deterministic in *which* level it picked. |
| Levels | 24 stages, nearly all "2–3 balls + 1–2 platforms + a crate". Worlds differed by palette and ball types, not by rules. `falling_rock` hazards fell once at t=0 and were gone. |
| Weapons | Explosive balls split if hit twice during the fuse. The laser re-hit children spawned inside the beam and deleted whole families. `game.canvas.height` (device pixels) was used as a world-space bound. |
| Rewarded ads | README said Score Attack had no continues; the code offered one. Leaving the game-over screen mid-ad still granted the continue into a dead run. |
| Dead code | ~1,100 lines of retired canvas menu renderers + a commented-out humanoid player. |

What was already good and was kept: the fixed-timestep loop, the constant
bounce-height arcade physics, the forgiving hurtbox, the RIG-7 robot rig, the
DOM/CSS UI layer, the SDK adapter, the save/cloud merge design.

## 2. The decisions

**Chain instead of combo.** The chain is purely time-based: each pop refreshes
a window (3.0 s shrinking to 1.7 s by chain 30); a miss costs nothing. The
multiplier is tiered (+0.5 every 5, cap ×5) so it is readable. This is the one
change that puts touch and keyboard on the same scoring model. It also creates
the game's core tension for free: keeping a chain alive forces you to pop the
next ball *before it is safe to*. Accuracy / no-miss bonuses were replaced by
Chain, Style, Flawless (no life lost) and PERFECT CHAIN (whole stage in one
chain) — all reachable while auto-firing.

**PopShot.** A meter charged by pops, tricks and grazes. Full meter → the next
shot is a piercing lance that makes every ball it touches *cascade*: it and all
of its descendants burst on a ~0.13 s ripple. It is the game's namesake, its
clip moment, and a real decision (spend it to escape now, or save it for the
size-4?). On touch it holds fire until something is actually in the column.

**Dash + graze.** One new verb (Shift / S / ↓, bumpers, double-tap): 0.16 s
burst, 0.24 s of i-frames, 1.25 s cooldown. It answers the genre's cheapest
death (pinned in a corner by tiny balls). Graze pays for letting a ball skim
the hurtbox; dashing through one is PHASE. Both feed the PopShot meter, so
risky play is what earns the super.

**Elements as rules, not decoration.** Electric pops arc to the nearest ball.
Bomb balls never split: lit, they pop everything in a drawn ring, shove what is
just outside it, clear smoke, damage bosses — and the drawn red core knocks the
player out. Lava patches superheat a bounce (×1.2), slime damps it (×0.78);
both are visible on the floor before the ball lands.

**One mechanic per world.** Desert: telegraphed wind gusts (on a separate,
decaying drift channel so the base arc stays learnable). Arctic: ice floor
(player inertia). City: pinball bumpers that kick balls and block shots.
Volcano: eruptions on a beat with landing rings. Airship: deck fans. Beach
stays pure on purpose.

**Three bosses, each a different question.**
- *King Globo* — the premise with a crown: break it and it splits (1 → 2 → 4).
- *VOLTA* — cannot be shot. You light its own bomb balls so they burst beside it.
- *Commander RIFT* — three acts that reuse both lessons, then vaporise the
  platforms and bend gravity.

**Panic.** Waves come from named recipes sized by a threat budget, and every
4 waves the arena moves to the next zone (a world backdrop + its mechanic).
Ball count is capped; overflow pays out as score.

**Seeded gameplay RNG + sim-time timers.** Everything that affects an outcome
draws from one mulberry32 stream; cosmetics keep `Math.random`. The Daily seeds
from the UTC date, so the bounces — not just the level pick — are shared.

## 3. Measurements

Bot sweep, 12 seeds/stage, after tuning (`node tools/sim.mjs --seeds 12`):

| World | Bot deaths per run (range over its stages) |
| --- | --- |
| Beach | 0.00 – 0.17 |
| Desert | 0.00 – 0.67 |
| King Globo | 0.00 |
| Arctic | 0.00 – 0.17 |
| City | 0.00 – 0.42 |
| VOLTA | 1.08 |
| Volcano | 0.08 – 0.75 |
| Airship | 0.25 – 0.58 |
| Commander RIFT | 1.67 (9/12 runs cleared on 3 lives) |

Tuning the sweep drove (first pass → final):

| Change | Before | After |
| --- | --- | --- |
| Tricks awarded per stage (they were noise) | ~18 | ~4 |
| Heat Wave bot deaths/run | 1.60 | 0.50 |
| Dragon's Den bot deaths/run (lava carpeted the floor) | 1.80 | 0.25 |
| Glacier Slime bot deaths/run (tiny balls on slime could not be run under) | 1.10 | 0.08 |
| Ashfall average clear time (every armored descendant needed 2 hits) | 93 s | 70 s |
| Laser clear time vs harpoon | 2.29× slower, 17 timeouts | 0.90×, 0 timeouts |
| Boss stage frame time p95 (software GL) | 133 ms (37 fps avg) | 16.8 ms (59 fps avg) |

Medal targets: bronze ≈ 0.66 × the bot's median stage score, so gold
(×1.5) ≈ the bot median.

Other numbers: simulation step ≈ 0.015 ms; a full 27-stage Tour simulates in
under a second; first visit reaches `playing` ~220 ms after navigation on the
production build (local preview server).

## 4. Tried and rejected

- **Ball–ball collisions.** Makes trajectories unreadable; the constant-height
  arc is the thing players learn. Momentum transfer exists only where it is
  drawn on screen: bumpers and blast shove.
- **Bumper kicks that change a ball's base speed.** Arcs never recovered.
  Kicks now ride the decaying drift channel and upward kicks launch to the
  ball's own natural bounce height.
- **Fans at 2× gravity lift.** Pinned small balls to the ceiling and the bot
  timed out. Lift reduced, on-time shortened.
- **Slime/lava bounce changes on size-0 balls.** Produced balls you could not
  run under. Patches now ignore the smallest tier.
- **Every armored descendant armored.** Tedious, not hard. Only size ≥ 2 carry
  plating now.
- **A boss "storm wall" with a random safe lane.** The lane could be ~740 px
  away with 1.15 s of warning. It is now always the player's band or a
  neighbour.
- **Multi-pop window that extends on every hit.** A machine gun produced
  "ULTRA POP +2000" by holding fire. Direct hits now get a fixed 0.2 s window;
  only chain reactions extend it.
- **AIR POP for any airborne child / CLOSE CALL at 90 px.** Fired on most pops.
  Replaced by JUGGLE (third generation in a row caught airborne) and a tighter,
  must-be-descending CLOSE CALL.
- **Caching background layers to an offscreen canvas.** Measured first: the
  whole frame is ~1 ms of command submission. Not worth the complexity.
- **Composing new music.** I cannot listen to output. Audio work was limited
  to things that are safe blind: wiring assets already made for those events,
  a rate limiter, a five-note pop scale per world, and tempo nudges.

## 5. Known limits

- No human playtesting, no physical phone, no gamepad, no real CrazyGames
  iframe. Touch was exercised in Chromium device emulation only.
- Nobody has *heard* the new mix. Pop-note keys may clash with the music bed.
- The bot fires constantly and reacts in one frame; its scores flatter the
  chain system and its death rates understate how hard dodging is for people.
- Double-tap-to-dash on touch may misfire for players who tap to micro-adjust;
  there is a toggle in the pause menu, default on.
