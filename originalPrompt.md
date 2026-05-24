Act as a senior professional web game developer, arcade game designer, gameplay programmer, technical architect, and HTML5 Canvas specialist.

I want you to create a complete, playable browser game just like the game by Pang Adventures (2016), the modern continuation of the classic Pang / Buster Bros formula.

Working title:
"Bubble Breaker Adventure" or another original title.

Technology requirements:
- Use HTML, CSS, and JavaScript.
- Prefer a single self-contained `index.html` file unless the project would be clearer with `index.html`, `style.css`, and `game.js`.
- Use HTML5 Canvas for rendering.
- Do not require external assets.
- Do not require npm, Vite, Webpack, Phaser, or any build step.
- The game must run directly by opening `index.html` in a browser.
- The implementation must be complete and playable, not pseudocode.
- Prioritize clean, readable, maintainable code over clever tricks.
- Include comments explaining the main systems.
- Avoid overengineering. Make a solid arcade game first.

High-level game concept:
Create a fast, colorful, single-screen arcade action game inspired by Pang Adventures. The player controls a small hero at the bottom of the screen. Bouncing attack balls fall and rebound around the arena. The player shoots upward with a vertical harpoon/sting weapon. When a large ball is hit, it splits into two smaller balls. Smaller balls bounce faster and become more dangerous. The goal is to clear all balls before the timer expires while avoiding contact with balls, hazards, enemies, and boss attacks.

Core gameplay loop:
1. Level starts with the player at the bottom center.
2. A countdown/timer is visible.
3. Bouncing balls move around the arena.
4. Player moves left/right and fires upward.
5. The projectile hits balls, pickups, destructible blocks, enemies, or boss weak points.
6. Large balls split into smaller balls.
7. Smallest balls disappear when hit.
8. Powerups drop from popped balls, destructible objects, or floating capsules.
9. Player collects temporary weapons, shields, score items, and bonus items.
10. The level ends when all required balls/enemies are cleared.
11. Score is calculated based on popped balls, remaining time, accuracy, combo, collected items, and optional no-miss bonus.
12. If the player is hit without a shield, the player dies and the level restarts or lives decrease depending on mode.

Core feel:
- Immediate arcade feel.
- Very readable action.
- Bright cartoon-style visuals.
- Tight controls.
- Short levels.
- Instant restart.
- “Just one more try” feeling.
- Difficult but fair.
- The player must always understand why they died.
- Avoid frustrating randomness in early levels.
- Add visual juice: screen shake, particles, pop effects, floating score numbers, hit flashes, glow, timer warnings, combo effects.

Controls:
Keyboard:
- A / Left Arrow = move left
- D / Right Arrow = move right
- Space / W / Up Arrow = shoot
- P = pause
- R = instant restart
- Enter = confirm/menu
- Escape = back/menu

Optional two-player local co-op:
Implement if feasible after the single-player version is solid.
Player 2:
- J / L = move left/right
- I / K / U = shoot, or another clear key mapping
Co-op rules:
- Both players share the same level objective.
- Each player can pop balls.
- If one player dies, they can either respawn after a delay if lives remain, or be revived by the other player depending on the simplified implementation.
- Make co-op optional and do not let it break single-player.

Player mechanics:
- Player moves only left/right on the ground.
- No jumping unless you decide a specific level mechanic requires it. Classic Pang-style movement is horizontal movement plus upward shooting.
- Player has a small circular or capsule-shaped hitbox.
- Movement should feel responsive, with acceleration and friction kept minimal.
- The player cannot leave the arena.
- The player can fire upward only.
- The default weapon should be a “Sting” / harpoon-like projectile: a vertical line rising from the player toward the ceiling.
- The default weapon should have either one active shot at a time or a short cooldown, depending on balance.
- If the default harpoon reaches the ceiling without hitting anything, it disappears.
- Player can pick up temporary weapons that replace the default weapon for a limited time or limited ammo.
- If the player has a shield, one hit consumes the shield instead of killing the player.

Ball mechanics:
Implement several ball sizes:
- Huge ball
- Large ball
- Medium ball
- Small ball
- Tiny ball

Rules:
- Balls bounce off the floor, walls, and optionally platforms.
- Gravity pulls balls down.
- Balls maintain arcade-like bounce height.
- Larger balls move slower and bounce higher.
- Smaller balls move faster and are harder to dodge.
- When a ball is hit:
  - If larger than the smallest size, split into two smaller balls.
  - The two child balls should travel in opposite horizontal directions.
  - Child balls inherit position but get new velocities.
  - Add pop particles and score text.
  - Play a simple generated sound if possible.
  - If smallest size, remove it completely.
- Touching a ball kills the player unless shielded.
- Each ball has a clear color, outline, highlight, and size so the player can read it instantly.

Special ball types inspired by Pang Adventures:
Implement at least some of these:

1. Normal Ball
- Basic bouncing ball.
- Splits normally.

2. Electric Ball
- Has blue/yellow lightning visual.
- When hit by the default harpoon, releases a dangerous vertical or downward electric bolt.
- If hit by certain weapon types, it may be safer.
- Add warning flash before the electric discharge.
- The discharge should be avoidable and clearly telegraphed.

3. Explosive Ball
- Has orange/red explosive core.
- When hit, starts a short countdown.
- After countdown, explodes and damages/splits nearby balls.
- Can trigger chain reactions.
- Explosion must be visually clear and not unfair.

4. Smoke Ball
- Releases smoke clouds when hit or while bouncing.
- Smoke partially obscures the playfield for a few seconds.
- Smoke should not make the game unreadable; keep transparency moderate.

5. Lava Ball
- Drops small lava splashes or leaves temporary hot zones on the floor.
- Touching lava hurts/kills unless shielded.
- Lava hazards fade out after a few seconds.

6. Sludge Ball
- Drops slime zones on the ground.
- Slime slows player movement while standing in it.
- Slime fades after a few seconds.

7. Armored Ball
- Requires two hits before splitting.
- Shows cracks after first hit.

8. Bonus Ball / Capsule Ball
- Contains a pickup.
- When popped, releases a weapon or score item.

Weapons:
Implement a small but meaningful arsenal. Each weapon must feel different and have pros/cons.

1. Default Sting / Harpoon
- Vertical line projectile.
- Shoots straight up.
- Can only have one active shot or limited rapid fire.
- Good precision weapon.

2. Double Sting
- Allows two vertical shots active at once or faster cooldown.
- Temporary duration.

3. Machine Gun / Gatling
- Rapid-fire bullets upward.
- Great against many small balls.
- Bullets are small and fast.
- Limited duration or ammo.
- Makes electric balls safer than default harpoon if you implement that interaction.

4. Flamethrower
- Short-range cone upward.
- Continuous fire while holding shoot.
- Good against nearby clusters.
- Limited fuel.
- Risky because the player must stand closer.

5. Laser
- Instant vertical beam.
- Pierces through multiple balls.
- Strong but short duration or slow cooldown.
- Add glow and screen flash.

6. Shuriken
- Throws spinning blades upward.
- Can pierce one or more targets.
- Maybe bounces once off wall/ceiling for fun.
- Limited ammo.

7. Shotgun
- Fires a spread of short-range pellets upward.
- Good for clusters, weak at long range.

8. Bomb / Rocket
- Fires upward and explodes on impact.
- Strong area effect.
- Limited ammo.

Pickups:
- Shield: protects from one hit.
- Extra Life: only in modes with lives.
- Time Bonus: adds seconds to timer.
- Score Fruit / Coins: score items.
- Weapon pickups: temporary weapons.
- Slow Time: slows balls briefly.
- Freeze: freezes balls briefly.
- Clear Smoke: removes smoke clouds.
- Magnet: pulls score items toward player.
- Combo Booster: temporary score multiplier.

Scoring system:
Implement:
- Points for popping balls.
- More points for smaller balls.
- Bonus for remaining time.
- Accuracy bonus: fewer missed shots gives more points.
- Combo system:
  - Consecutive hits without missing increase combo.
  - Combo decays or resets after missed shot / time gap / player hit.
- No-miss bonus:
  - Award bonus if the player clears a level without a wasted shot.
- Display floating score numbers where balls pop.
- Display current score, combo bar, timer, weapon, lives, shield state, and level name.

Game modes:
Implement a simplified but strong version of the three major modes.

1. Tour Mode / Adventure Mode
- Main campaign.
- Player travels through themed locations.
- Each location has multiple stages.
- After a set of stages, player fights a boss.
- For the first implementation, create at least 12 handcrafted levels across 3 themed worlds, plus 1 boss fight.
- Structure the code so more levels can easily be added.
- The real Pang Adventures has 100+ levels, but for this HTML implementation, build a strong scalable level system and include enough content to demonstrate the full design.

Suggested worlds:
- Tropical Beach
- Desert Canyon
- Arctic Night
- City Rooftop
- Volcano
- Airship / Boss Arena

Each world should have:
- Different background colors and simple procedural scenery.
- Different ball combinations.
- Different obstacles.
- Slightly different music/sound mood if simple generated audio is implemented.

2. Score Attack Mode
- Arcade challenge.
- Player has 3 lives and no continues.
- Reuses Tour levels in sequence.
- Goal is maximum score.
- Game ends when lives reach 0.
- Show final score and best score using localStorage.
- Unlocking can be simulated, but preferably make it available from the start for testing.

3. Panic Mode
- 99-level inspired survival gauntlet, but implement it procedurally.
- Continuous waves of increasing difficulty.
- Player has limited lives.
- Balls spawn in waves.
- Difficulty increases gradually:
  - More balls
  - Larger balls
  - More special balls
  - Less time
  - More hazards
- Show wave number.
- Store best wave and high score in localStorage.

Level design:
The game should use single-screen levels.
Each level definition should include:
- Name
- World/theme
- Timer
- Starting balls
- Platforms
- Destructible blocks
- Hazards
- Pickups
- Special objects
- Optional boss
- Target score

Platforms:
- Static platforms that balls can bounce off.
- Some platforms may block player shots.
- Some platforms may be destructible.
- Some platforms may move or shift to open gaps.
- Platforms should create puzzle-like ball containment without becoming confusing.

Destructible objects:
- Crates or blocks can be destroyed by shots.
- They may contain pickups.
- They may temporarily trap balls.
- Use them for strategy: the player can choose when to open a path.

Environmental hazards:
- Electric barriers that turn on/off.
- Flame vents.
- Falling rocks.
- Smoke clouds.
- Slime puddles.
- Moving walls.
Keep hazards readable and telegraphed.

Friendly/neutral enemies:
- Add crab-like helpers or neutral creatures that move along platforms.
- They can pop balls if balls touch their claws or body.
- They can also hurt the player if touched.
- This creates strategic risk/reward.
- Keep implementation simple.

Boss fights:
Implement at least one boss fight inspired by the idea of Alien Commanders, but legally distinct.
Boss arena:
- Player stands on a platform or ground.
- Boss floats near top.
- Boss has a weak point.
- Player must shoot upward to hit weak point.
- Boss spawns bouncing balls.
- Boss fires projectiles.
- Boss changes attack pattern by health phase.
- Boss health bar visible.
- Boss attacks must be telegraphed.
- Include at least three attack patterns:
  1. Spawn bouncing balls.
  2. Fire downward projectiles.
  3. Sweep laser or electric beam with warning.
- When boss is defeated, trigger explosion particles and level clear.

Visual style:
- Bright, colorful, cartoon arcade style.
- Do not mimic Pang Adventures exactly.
- Use procedural Canvas graphics:
  - Gradient sky backgrounds.
  - Simple clouds, mountains, ocean, desert, snow, city silhouettes.
  - Glossy balls with highlights.
  - Comic-style outlines.
  - Energetic particles.
  - Floating point text.
  - Clear UI panels.
- Use a 16:9 canvas, responsive to browser window.
- Preserve internal logical resolution, e.g. 960x540 or 1280x720, and scale to fit.
- Keep gameplay area readable on desktop and laptop screens.
- Avoid tiny text.

UI/HUD:
Include:
- Main menu
- Mode select
- Level select for Tour Mode
- Pause menu
- Game over screen
- Level clear screen
- Victory screen
- Controls screen
- High score screen

HUD during play:
- Score
- Timer
- Lives
- Current weapon
- Weapon ammo/duration
- Shield indicator
- Combo meter
- Level name
- Target score
- Boss health when relevant
- “Instant Restart: R”
- Optional “Player 2 Press [key] to Join” if co-op is implemented

Game states:
Use a clear state machine:
- BOOT
- MAIN_MENU
- MODE_SELECT
- LEVEL_SELECT
- PLAYING
- PAUSED
- LEVEL_CLEAR
- PLAYER_DEAD
- GAME_OVER
- BOSS_DEFEATED
- VICTORY

Physics and collision:
Do not use a physics engine. Implement simple deterministic arcade physics manually:
- Fixed timestep update if possible.
- Circle-vs-rectangle collision for balls and platforms.
- Circle-vs-circle collision for player/balls if needed.
- Projectile-vs-circle collision.
- Ball bounce against walls, floor, ceiling, and platforms.
- Prevent balls from tunneling through platforms by using reasonable velocities and collision correction.
- Keep hitboxes slightly forgiving for the player.

Audio:
Use Web Audio API generated sounds if possible, no external files.
Add simple procedural sounds:
- Shoot
- Ball pop
- Ball split
- Pickup
- Shield break
- Player hit
- Explosion
- Boss hit
- Level clear
- Timer warning
- Menu select
Keep audio optional and include mute toggle.

Difficulty and onboarding:
- The first levels must teach one concept at a time.
- Level 1: normal balls only, generous timer.
- Level 2: splitting behavior.
- Level 3: platforms.
- Level 4: pickups.
- Level 5: special ball.
- Level 6: destructible blocks.
- Later: combine mechanics.
- Do not make the first level brutally hard.
- Add a short tutorial overlay:
  - Move with A/D or arrows.
  - Shoot upward with Space.
  - Pop all balls.
  - Do not touch balls.
  - Collect weapons and shields.
- Tutorial should not block the game for too long.
- Let player skip tutorial.

Performance:
- Must run smoothly at 60 FPS in modern browsers.
- Use object arrays and simple classes.
- Avoid memory leaks.
- Remove inactive projectiles, particles, pickups, hazards.
- Cap particles if necessary.
- Keep rendering efficient.

Persistence:
Use localStorage for:
- Best Tour scores per level.
- Best Score Attack score.
- Best Panic wave.
- Settings: mute, volume, chosen controls maybe.

Implementation structure:
Please write clean JavaScript classes/modules inside the file:
- Game
- Input
- Renderer or draw functions
- Player
- Ball
- Projectile
- WeaponSystem
- Pickup
- Platform
- Hazard
- Particle
- FloatingText
- LevelManager
- Boss
- UI/Menu system
- AudioSystem
- StorageManager

Data-driven level definitions:
Create levels as objects/arrays so I can easily add more:
Example structure:
{
  id: "beach_01",
  name: "Beach - Day 1",
  theme: "beach",
  timeLimit: 60,
  targetScore: 25000,
  balls: [
    { x: 300, y: 120, size: 4, type: "normal", vx: 120, vy: 0 },
    ...
  ],
  platforms: [
    { x: 200, y: 300, w: 180, h: 18, type: "solid" }
  ],
  destructibles: [...],
  pickups: [...],
  hazards: [...]
}

Important implementation strategy:
Do NOT try to build 100+ levels manually in one response. Instead:
1. Build a polished, complete, playable vertical slice.
2. Include at least 12 levels, 3 worlds, Panic Mode, Score Attack Mode, and 1 boss fight.
3. Make the level system scalable so more levels can be added later.
4. Make the game feel complete enough to play immediately.
5. Prioritize actual working gameplay over huge content quantity.

Balance targets:
- Player speed: fast enough to dodge, not slippery.
- Default shot cooldown: satisfying but not spammy.
- First levels: easy and readable.
- Later levels: challenging but fair.
- Panic mode: gradual difficulty increase.
- Timer should create tension without making early levels stressful.
- Player hitbox should be slightly smaller than visual sprite.
- Ball hitboxes should match visuals fairly.

Menus:
Main menu should include:
- Title
- Play Adventure
- Score Attack
- Panic Mode
- Controls
- Toggle Sound
- Credits/Info

Adventure level clear screen:
Show:
- Level complete
- Score
- Time bonus
- Accuracy bonus
- Combo bonus
- Total score
- Best score
- Continue button

Game over screen:
Show:
- Final score
- Best score
- Retry
- Main menu

Code quality requirements:
- Produce complete code.
- Do not leave TODOs for core mechanics.
- Do not write “implementation omitted”.
- Do not give only a plan.
- The first answer should include the actual working files.
- After the code, briefly explain how to run it.
- Also briefly list which features are implemented and which are simplified.
- If the response becomes too long, continue in clearly separated file blocks, but do not skip essential gameplay.

Testing checklist before final answer:
Mentally verify:
- Canvas appears.
- Main menu works.
- Player can move.
- Player can shoot.
- Balls bounce.
- Balls split correctly.
- Player dies when hit.
- Shield protects once.
- Timer works.
- Level clears when balls are gone.
- Score increases.
- Pickups work.
- Weapon switching works.
- Panic Mode spawns waves.
- Score Attack uses lives.
- Boss can be damaged and defeated.
- Restart works.
- Pause works.
- No obvious undefined variables.
- No dependency on missing files.
- No external asset required.

Extra polish if feasible:
- Screen shake on explosions.
- Slow motion moment when final ball pops.
- Timer flashes red under 10 seconds.
- Combo text pulse.
- Glossy ball highlights.
- Animated background elements.
- Boss phase transition flash.
- Hit pause for satisfying impact.
- Small particles when player moves.
- Responsive scaling to fit window.
- Touch controls for mobile can be optional, but desktop keyboard is the priority.

Final output format:
Give me:
1. A short explanation of what you built.
2. Complete code, preferably in one `index.html`.
3. Instructions for running it.
4. A concise feature checklist.
5. Suggestions for next improvements, but only after the working code.

Remember:
The goal is to copy Pang Adventures. The goal is to reproduce the genre, mechanics, pacing, and arcade design logic in an HTML5 browser game.

CLAUDE ANSWERED:
Bubble Breaker Adventure — a complete single-file HTML5 Canvas arcade game in the Pang/Buster Bros tradition. Just open index.html in any modern browser; no build step, no dependencies, no external assets.
Controls: A/D or arrows to move, Space to shoot, P pause, R restart, M mute, Enter/Esc for menus.
What's in the box (≈2,500 lines, one file):

Full state machine: boot → menu → mode select → level select → playing → paused → level clear → game over → victory
Player with shield mechanic, slow-time, hit-pause, screen shake/flash, particles (capped at 300), floating score text
8 ball types: normal, electric (telegraphed bolt), explosive (chain reactions), smoke, lava (hot zones), sludge (slow puddles), armored (2-hit, cracks), bonus capsule
5 ball sizes with arcade bounce physics — split into two opposite-velocity children, smallest size despawns
6 weapons with distinct feel: harpoon, double, machine gun, flamethrower, laser (pierce + flash), shotgun
10 pickup types: shield, extra life, time bonus, score gem, weapon capsules, slow-time, freeze, magnet, combo booster, smoke-clear
Combo system with decay + miss reset, accuracy bonus, time bonus, no-miss bonus on level-clear summary
Platforms (solid + destructible crates), hazards (lava patches, slime, electric beams), per-level intro overlays
3 modes: Tour (12 handcrafted levels + 1 boss across beach/desert/arctic/airship), Score Attack (3 lives, runs Tour in order), Panic Mode (procedural waves, escalating difficulty)
Boss "Commander RIFT": 3 phases, 3 attack patterns (ball spawn, telegraphed downward projectiles, sweep beam with warning), weak-point hits, defeat explosion
Procedural Web Audio API SFX (shoot, pop, split, pickup, explode, boss hit, level clear, timer warning) — fully mutable with M
localStorage persistence: best score per level, best Score Attack run, best Panic wave, mute setting
16:9 logical canvas (960×540) that scales to window while preserving aspect ratio

Simplified vs the full spec (so you know where to extend):

12 levels + 1 boss instead of 100+ — but the LEVELS array is data-driven, so adding more is just appending objects
No two-player co-op (spec marked it optional)
Skipped shuriken and bomb/rocket weapons; the 6 included cover the strategic range
No neutral crab helpers
Hazards are lava/slime/electric beams + boss beams; no flame vents, falling rocks, or moving walls
Tutorial is per-level intro overlays rather than a dedicated tutorial mode

Code structure (top-down in the file): constants → utils → Storage → AudioSys → Input → Particle/FloatingText → Player → Ball → Projectile → Pickup → Platform → Destructible → Hazard → Boss → LEVELS data → Game class with per-state render/update → boot.
Suggested next improvements, in order of bang-for-buck:

More levels — the data format is the bottleneck-free part; an hour of level authoring doubles content
Co-op P2 (J/L move, I/K shoot) — Player class is already isolated enough that a second instance + input mapping should drop in cleanly
Shuriken (piercing, wall-bouncing) and Bomb (arcing rocket with AoE) — Projectile already supports pierce and AoE-on-impact patterns
World 4/5 themes (volcano, city rooftop) — background renderer is keyed off theme strings
Touch controls — the input layer is centralized, so a virtual D-pad + fire button would land in one spot