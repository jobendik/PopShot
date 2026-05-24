# Bubble Breaker Adventure — Road Ahead

**Document purpose:** This document describes a broad, long-term development roadmap for **Bubble Breaker Adventure**, a modern browser arcade game inspired by the classic single-screen bubble-splitting action formula. It is intentionally expansive: it lists not only what should be done immediately, but also what the game *could* become if it is developed into a larger, more polished, CrazyGames-ready product.

**Current project baseline:** The game is currently a TypeScript + Vite + HTML5 Canvas project with a compact custom engine. It already includes a handcrafted Tour mode, Score Attack, Panic Mode, local co-op, persistent high scores, procedural Web Audio, multiple worlds/themes, many ball types, several weapons, pickups, hazards, destructibles, moving platforms, neutral helpers, and a boss fight.

**Core strategic principle:** The game should not simply become “larger.” It should become **the most satisfying modern browser version of the bubble-splitting arcade formula**: instantly understandable, visually premium, highly responsive, highly replayable, easy to start, difficult to master, and differentiated enough to stand apart from existing retro-style competitors.

---

## 1. Product Vision

### 1.1 One-sentence pitch

**Bubble Breaker Adventure is a premium single-screen arcade action game where players dodge, split, chain-pop, and survive bouncing hazards across vivid worlds, boss encounters, co-op challenges, and replayable score modes.**

### 1.2 Player promise

The player should feel:

- “I understand this immediately.”
- “I can survive if I move cleverly.”
- “Every shot matters.”
- “Popping a huge bubble into many smaller ones is satisfying.”
- “I made a risky choice and it paid off.”
- “I want one more attempt.”
- “I can get better at this.”
- “This looks far more polished than the old games in this genre.”

### 1.3 Market positioning

The game should not position itself as a direct copy of any older game. It should position itself as a **modernized arcade skill game** with:

- premium visuals,
- tight controls,
- readable hazards,
- more expressive stages,
- more satisfying effects,
- better progression,
- local co-op,
- multiple modes,
- challenge variety,
- and strong browser/mobile accessibility.

### 1.4 Design identity

The game should have a clear identity that is separate from classic references. Possible identity directions:

1. **Expedition Adventure**  
   A hero travels through islands, ruins, labs, airships, volcanoes, and cosmic zones while breaking unstable energy orbs.

2. **Science Lab Containment**  
   Bouncing energy organisms escape containment chambers. The player uses harpoons, lasers, magnets, freeze beams, and experimental tools.

3. **Treasure-Hunter Arcade Quest**  
   The player clears cursed bubble creatures from temples and airships to recover treasure.

4. **Toybox Action Arcade**  
   Bright, playful, toy-like worlds with exaggerated physics and spectacle.

5. **Premium Neon Arcade**  
   Clean, glowing, modern, high-contrast, with elegant FX and strong readability.

The chosen identity should be visually strong, but never at the cost of gameplay readability.

---

## 2. Current Strengths To Preserve

The current version already has several strong ingredients. These should be protected during future development.

### 2.1 Compact technical foundation

The current custom Canvas + TypeScript architecture is lightweight and appropriate for a single-screen arcade game. There is no urgent need to move to Phaser unless the project grows into asset-heavy animation, advanced scene composition, or editor-based level production.

Preserve:

- fast boot,
- small bundle,
- direct rendering control,
- simple collision model,
- immediate-mode UI if it remains manageable,
- procedural audio,
- data-driven levels,
- TypeScript structure.

### 2.2 Strong arcade loop

The core loop is already understandable:

```text
Dodge bouncing objects → shoot upward → split objects → survive smaller threats → clear level → score bonus → next level
```

This loop is the game’s most valuable asset. Every new feature must strengthen it.

### 2.3 Existing content variety

The game already has:

- 18 handcrafted stages,
- several themes,
- many weapon types,
- multiple ball types,
- hazards,
- pickups,
- destructibles,
- co-op,
- boss fight,
- Score Attack,
- Panic Mode.

This is a strong foundation. Future development should focus on polish, clarity, progression, retention, and differentiation — not merely adding random systems.

### 2.4 Strong “one more try” potential

Because levels are short, failure is understandable, and success depends on skill, the game naturally supports replayability.

This should be reinforced with:

- fast restarts,
- clear failure feedback,
- level medals,
- daily challenges,
- leaderboards,
- ghost/replay systems,
- skill-based achievements.

---

## 3. Strategic Risks

### 3.1 Risk: becoming too similar to existing retro titles

The game must avoid looking like a reskinned version of existing bubble-splitting games. The core mechanic can be familiar, but the presentation, systems, level design, progression, and feel should clearly be its own product.

Avoid:

- similar character silhouettes,
- similar menus,
- similar level layouts,
- similar visual language,
- similar branding,
- similar enemy/theme choices,
- similar UI framing.

Strengthen:

- original world identity,
- unique weapons,
- combo/chaining mechanics,
- progression systems,
- modern VFX,
- level modifiers,
- boss design,
- daily/seasonal challenges.

### 3.2 Risk: overcomplication

The genre’s strength is immediate readability. If the game adds too many systems too early, it may lose its arcade clarity.

Rule:

> Complexity should be optional, progressive, and layered after the player understands the base loop.

### 3.3 Risk: “more features” reducing readability

Premium graphics must not obscure:

- ball size,
- ball trajectory,
- player hitbox,
- projectile lines,
- pickup type,
- hazard timing,
- safe zones,
- boss telegraphs,
- remaining time.

Readable gameplay beats decorative spectacle.

### 3.4 Risk: desktop-only limitations

The current project is keyboard-focused. For CrazyGames, mobile and tablet support can greatly improve reach. If the game remains desktop-only, it can still work, but the potential audience becomes smaller.

Mobile support should be considered a major roadmap item.

---

## 4. Development Philosophy

### 4.1 Keep the first 10 seconds sacred

The first 10 seconds should answer:

- What am I?
- What threatens me?
- What do I do?
- What happens when I shoot?
- Why is this satisfying?

The player should not need to read a long explanation.

### 4.2 Make the game feel better before making it bigger

Priority order:

1. Controls.
2. Collision forgiveness.
3. Shot feel.
4. Ball bounce readability.
5. Pop feedback.
6. Level pacing.
7. Visual polish.
8. Progression.
9. More content.
10. Meta systems.

### 4.3 Add depth through mastery, not UI clutter

The best depth should come from:

- movement timing,
- shot placement,
- ball splitting strategy,
- risk-reward pickup decisions,
- route planning,
- combo chaining,
- co-op coordination.

Avoid making depth depend mostly on menus and upgrades.

### 4.4 Every feature needs a purpose

Each new feature should improve at least one of these:

- first-session fun,
- replayability,
- clarity,
- progression,
- retention,
- visual identity,
- social sharing,
- performance,
- accessibility,
- monetization readiness.

---

## 5. Immediate Product Goal

Before expanding heavily, the game should become a polished release candidate.

### 5.1 Release-candidate definition

A release candidate should include:

- stable Tour mode,
- clear main menu,
- working Score Attack,
- working Panic Mode,
- reliable high-score persistence,
- no console errors,
- responsive resizing,
- clear pause/restart flow,
- good audio/mute/settings,
- polished first level,
- clear controls screen,
- readable HUD,
- smooth performance,
- optional local co-op that does not confuse solo players.

### 5.2 Immediate top priorities

1. Improve game feel.
2. Improve visual identity.
3. Improve first-time onboarding.
4. Add touch controls or explicitly mark desktop-only.
5. Improve UI/menu polish.
6. Improve level select and progression feedback.
7. Add medals and unlock rewards.
8. Add CrazyGames-ready integration scaffolding.

---

## 6. Core Gameplay Improvements

### 6.1 Movement feel

The player should feel precise, quick, and fair.

Possible upgrades:

- acceleration/deceleration tuning,
- optional instant arcade movement,
- configurable movement speed,
- slipperiness modifiers in some levels,
- short dash ability as a pickup or unlock,
- crouch/duck under low bounces,
- roll/dive move for advanced play,
- ledge/platform drop-through if vertical platforming expands,
- recoil-based micro movement from certain weapons,
- movement assist for mobile controls.

Recommended approach:

- Keep default movement simple.
- Add advanced movement only if it increases skill expression without making the game harder to understand.

### 6.2 Collision forgiveness

Classic arcade games can feel harsh. A modern browser version should be fairer.

Possible upgrades:

- smaller player hurtbox than visual sprite,
- visible hurtbox option in accessibility/debug settings,
- short invulnerability after respawn,
- subtle “near miss” detection,
- shield grace after entering a level,
- mercy slow-motion when a huge ball is about to hit,
- beginner mode with more forgiving hitbox,
- optional classic mode with strict hitbox.

### 6.3 Shooting feel

The shot should feel powerful and crisp.

Possible upgrades:

- muzzle flash,
- shot recoil animation,
- screen micro-shake on powerful weapons,
- harpoon cable tension animation,
- projectile impact sparks,
- hit pause on big pops,
- dynamic pitch audio by ball size,
- combo voice/text feedback,
- particle burst direction based on impact angle,
- slow-motion on final pop.

### 6.4 Ball physics readability

The player must be able to predict bounces.

Possible upgrades:

- slightly exaggerated squash/stretch on floor bounce,
- shadow under each ball,
- size-coded glow/rim color,
- warning trail for dangerous ball types,
- subtle trajectory ghosting on beginner/tutorial mode,
- stronger visual distinction between normal and special balls,
- consistent bounce height per size tier,
- clear split direction telegraph.

### 6.5 Ball splitting strategy

The main strategy is when and where to split large balls.

Possible upgrades:

- split-angle variants by ball type,
- split delay for certain types,
- split preview in tutorial,
- chain reaction scoring,
- “perfect split” bonus if player pops at safe timing,
- “danger split” warning for huge balls near player,
- “controlled split” weapon that splits vertically rather than diagonally,
- “containment shot” that briefly freezes the split children.

### 6.6 Level time pressure

Timers create tension, but should not feel unfair.

Possible upgrades:

- visible timer urgency states,
- music intensity ramps,
- “last 10 seconds” visual warning,
- time bonus medals,
- optional relaxed mode without timer,
- challenge mode with strict timer,
- time-extension pickups,
- time penalty for taking hits instead of instant life loss in casual mode.

---

## 7. Ball Type Roadmap

The current game already includes several ball types. Future ball types should create new tactical patterns, not just visual variety.

### 7.1 Existing ball types to polish

#### Normal

Purpose: baseline readable bubble behavior.

Upgrade ideas:

- more satisfying pop particles,
- clearer tier-based color/value,
- small expression/emotion if balls become creatures,
- theme-specific skins.

#### Electric

Purpose: vertical danger and timing.

Upgrade ideas:

- stronger pre-discharge warning,
- visible charge meter,
- lightning chain between nearby electric balls,
- temporary electrified platforms,
- shockwave on split.

#### Explosive

Purpose: chain reactions and risk-reward.

Upgrade ideas:

- fuse timer clearly visible,
- blast radius preview,
- chain detonation scoring,
- destructible wall interaction,
- safe “defuse” shot type.

#### Smoke

Purpose: visibility reduction.

Upgrade ideas:

- smoke opacity should never become unfair,
- wind/fan hazards that move smoke,
- smoke-clearing pickups,
- silhouettes visible through smoke in accessibility mode,
- smoke used as stealth cover for special enemies.

#### Lava

Purpose: area denial.

Upgrade ideas:

- floor lava puddles with clear lifetime,
- lava hardens into temporary platforms,
- lava ignites crates,
- lava balls split into embers instead of regular children.

#### Sludge

Purpose: movement restriction.

Upgrade ideas:

- slime puddles slow the player,
- slime can be burned away by flame weapon,
- slime causes balls to bounce lower,
- slime puddles can trap pickups.

#### Armored

Purpose: target priority and weapon choice.

Upgrade ideas:

- visible cracked armor after first hit,
- armor-piercing weapon bonuses,
- armored children have lower bounce but higher speed,
- shield fragments become temporary hazards.

#### Bonus

Purpose: reward and surprise.

Upgrade ideas:

- better visual clarity,
- guaranteed useful reward rules,
- rare golden bonus ball,
- risky cursed bonus ball,
- bonus ball that runs away from shots.

### 7.2 New ball type ideas

#### Ghost Ball

Passes through platforms but not walls. Becomes solid shortly before floor impact.

Use case:

- advanced worlds,
- timing puzzles,
- boss minions.

#### Mirror Ball

Reflects certain projectiles unless hit by the correct weapon or from the correct angle.

Use case:

- encourages weapon switching,
- creates interesting danger from reflected shots.

#### Gravity Ball

Pulls the player, pickups, or small balls toward it.

Use case:

- spatial control,
- advanced chaos levels,
- combo setups.

#### Magnet Ball

Attracts or repels projectiles.

Use case:

- puzzle-like levels,
- forces player to position before shooting.

#### Splitter Ball

Splits more times than normal, but children are weaker.

Use case:

- panic and score modes,
- satisfying mass clear moments.

#### Swarm Ball

Releases tiny crawling enemies or micro-bubbles when hit.

Use case:

- variation from pure bouncing hazards.

#### Shield Ball

Projects a shield around nearby balls.

Use case:

- target priority,
- mini-puzzle encounters.

#### Phase Ball

Alternates between vulnerable and invulnerable states.

Use case:

- timing challenge,
- boss-style stages.

#### Crystal Ball

Shatters into sharp fragments that bounce once before disappearing.

Use case:

- short-term danger burst,
- visually satisfying clears.

#### Poison Ball

Leaves toxic clouds or puddles.

Use case:

- area denial distinct from lava/slime.

#### Ice Ball

Creates slippery floor patches or freezes platforms.

Use case:

- arctic world expansion.

#### Wind Ball

Changes horizontal direction unpredictably in air currents.

Use case:

- sky/airship worlds.

#### Heavy Ball

Bounces lower but moves faster horizontally and shakes platforms.

Use case:

- different timing pattern.

#### Tiny Swarm Ball

Starts small but multiplies if not killed quickly.

Use case:

- creates urgency.

#### Boss Core Ball

Cannot be destroyed directly; must be split by clearing linked smaller balls.

Use case:

- puzzle boss stages.

---

## 8. Weapon Roadmap

The current weapon set is already broad. The roadmap should focus on feel, balance, identity, and strategic use.

### 8.1 Existing weapons to polish

#### Harpoon

The default weapon must feel perfect.

Upgrade ideas:

- improved cable animation,
- better tip impact,
- active-shot indicator,
- optional “hold to charge” variant in special mode,
- skin variants.

#### Double Harpoon

Upgrade ideas:

- clear dual-shot UI indicator,
- two-shot rhythm tutorial,
- combo reward for double hits.

#### Machine Gun

Upgrade ideas:

- recoil flash,
- ammo counter,
- overheating variant,
- ricochet bullets as rare modifier.

#### Flamethrower

Upgrade ideas:

- cone rendering upgrade,
- burns slime/smoke/lava interactions,
- damage-over-time clarity,
- risk of reduced range but high area control.

#### Laser

Upgrade ideas:

- charge-up beam,
- screen flash but accessibility-safe,
- piercing priority line,
- reflection interaction with mirror balls.

#### Shotgun

Upgrade ideas:

- pellet spread preview,
- close-range bonus,
- crowd-control identity.

#### Shuriken

Upgrade ideas:

- wall bounce predictability,
- trail effect,
- combo reward for multi-hit ricochets.

#### Bomb

Upgrade ideas:

- arc preview,
- radius indicator,
- destructible interactions,
- chain explosion scoring.

### 8.2 New weapon ideas

#### Chain Harpoon

A harpoon that links several small balls together and pops them in sequence.

#### Net Launcher

Temporarily traps a ball in place, allowing controlled splitting.

#### Freeze Lance

Freezes one ball or slows a group along a narrow beam.

#### Gravity Spike

Creates a gravity well that pulls smaller balls together.

#### Boomerang Blade

Travels upward, curves, then returns, allowing skilled multi-hits.

#### Railgun

Slow charge, instant vertical pierce, huge reward for good timing.

#### Bubble Shield Projector

Places a short-lived shield wall above the player, blocking one falling object.

#### Time Needle

Hits one ball and temporarily slows all children from that split.

#### Drone Turret

Temporary helper that shoots upward automatically from a fixed position.

#### Orbital Saw

Short-duration weapon that circles the player and cuts small balls.

#### Reflector Beam

Bounces off platforms and walls, useful for angled shots.

#### Splash Cannon

Pops one ball and sends small shockwaves sideways.

#### Paint Gun

Marks balls for bonus points when popped in order.

#### Combo Wand

Weak damage, but greatly increases combo multiplier if used skillfully.

### 8.3 Weapon balance principles

Each weapon should have:

- a clear fantasy,
- a unique tactical role,
- obvious feedback,
- visible duration/ammo,
- clear strengths,
- clear weaknesses,
- no excessive randomness.

Weapons should not all be simple upgrades over the default harpoon. Some should be situational.

---

## 9. Pickup Roadmap

### 9.1 Existing pickups to improve

Current pickups include shield, life, score, time, slow time, freeze, smoke clear, magnet, combo booster, and weapon capsules.

Improvements:

- larger, clearer icons,
- short label when collected,
- pickup magnetism when near player,
- glow intensity by rarity,
- pickup expiration warning,
- icon legend in pause menu,
- unique pickup sounds,
- better rarity balancing.

### 9.2 New pickup ideas

#### Extra Jump / Hover Boots

Temporarily lets the player hop or hover to avoid low bounces.

Caution: This changes the core movement model and should be used carefully.

#### Safe Dome

Creates a small safety bubble around the player for a few seconds.

#### Split Lock

Next ball hit will not split immediately; children appear after a delay.

#### Score Magnet

Attracts score gems from popped balls.

#### Clone Shot

Next shot fires from the player and a mirrored ghost position.

#### Stage Cleaner

Clears smoke, slime, and small lava puddles.

#### Lucky Capsule

Random reward with visible odds or simple rarity tiers.

#### Golden Timer

Freezes the level timer for a short period.

#### Combo Insurance

Prevents combo from dropping once.

#### Panic Button

Clears nearby tiny balls but gives no score.

#### Risk Token

Increases score multiplier but spawns an extra hazard.

### 9.3 Pickup fairness rules

- Never spawn pickups inside immediate danger.
- Do not spawn critical pickups where the player cannot reach them.
- Avoid pickup clutter during intense moments.
- Avoid random rewards that feel unfair.
- Ensure icons are readable at small screen sizes.

---

## 10. Enemy and Helper Roadmap

The current crab helper/enemy behavior can be expanded into a broader system.

### 10.1 Neutral helpers

Possible helpers:

#### Crab

Current helper/obstacle. Can pop balls but hurts on contact.

Upgrade ideas:

- clearer visual alignment: friendly, neutral, or hostile,
- predictable patrol paths,
- special crab variants by world.

#### Drone Buddy

Temporarily shoots upward or collects pickups.

#### Shield Bot

Walks back and forth creating temporary safe cover.

#### Magnet Pet

Pulls score gems and pickups toward player.

#### Repair Mouse

Fixes broken platforms or disables hazards.

### 10.2 Hostile ground enemies

Possible enemies:

- crawling slime creatures,
- floor spiders,
- jumping bots,
- rolling mines,
- shield carriers,
- hazard drones,
- thieves that steal pickups,
- timer goblins that reduce time if not stopped.

Important: Ground enemies must not distract from the main ball-splitting mechanic. They should appear as seasoning, not as a second main game.

### 10.3 Flying enemies

Possible flying enemies:

- bats,
- drones,
- balloons,
- electric wisps,
- bomb-droppers,
- healers that restore balls,
- shield generators.

Flying enemies should be used carefully because the player primarily shoots upward; they can make the game feel too shooter-like if overused.

---

## 11. Hazard Roadmap

### 11.1 Existing hazards to polish

Current hazards include lava, slime, electric beams/barriers, boss warnings/beams, flame vents, and falling rocks.

Improvements:

- stronger telegraphs,
- consistent warning colors,
- hazard icon language,
- accessibility-friendly alternatives to flashing,
- better audio cues,
- clear active/inactive states,
- danger zones visible through smoke.

### 11.2 New hazard ideas

#### Wind Gusts

Push balls and/or player sideways.

#### Conveyor Belts

Move player or pickups along the ground.

#### Crumbling Floor

Sections temporarily disappear after repeated impacts.

#### Bounce Pads

Change ball trajectory dramatically.

#### Spike Rails

Moving ceiling or wall hazards.

#### Rotating Lasers

Slow, readable beams that force movement.

#### Gravity Wells

Pull balls into strange arcs.

#### Water Pools

Slow the player but extinguish fire/lava effects.

#### Ice Floor

Reduces friction.

#### Steam Vents

Launch balls upward or obscure vision briefly.

#### Portals

Balls enter one side and exit another.

#### Trap Doors

Open/close and alter safe movement lanes.

#### Alarm Zones

Standing in them spawns extra small balls or enemies.

### 11.3 Hazard design principle

Every hazard must be:

- readable before it hurts,
- avoidable through skill,
- visually distinct,
- used in levels that teach it before testing it.

---

## 12. Platform and Level Object Roadmap

### 12.1 Platform variants

Possible platform types:

- static platform,
- moving horizontal platform,
- moving vertical platform,
- disappearing platform,
- one-way shot platform,
- one-way player platform,
- glass platform that breaks after hits,
- rubber platform that increases ball bounce,
- sticky platform that slows balls,
- electric platform that charges balls,
- rotating platform,
- elevator platform,
- switch-controlled platform.

### 12.2 Destructible objects

Possible destructibles:

- crates,
- barrels,
- glass jars,
- treasure pots,
- ice blocks,
- slime pods,
- explosive barrels,
- shield generators,
- locked capsules,
- chain-linked boxes requiring multiple hits,
- puzzle switches.

### 12.3 Interactive level objects

Possible interactives:

- levers,
- buttons,
- pressure plates,
- teleport gates,
- cannons,
- fans,
- mirrors,
- magnets,
- timed doors,
- elevators,
- rotating gears,
- rope anchors,
- breakable ceiling sections.

These should be introduced only if the game expands into more puzzle-like stages.

---

## 13. Level Design Roadmap

### 13.1 Current level structure

The current levels are single-screen handcrafted puzzles across multiple themes. This is a good fit for the genre.

### 13.2 Level design pillars

Each level should have one clear idea:

- teach a new mechanic,
- test a known mechanic,
- combine two mechanics,
- create a memorable layout,
- provide a score challenge,
- create a power-up moment,
- create a boss/miniboss pattern.

Avoid levels that are just “more balls.”

### 13.3 World structure

Possible world plan:

1. **Beach / Training Coast**  
   Normal balls, basic platforms, safe learning.

2. **Desert / Crate Caravan**  
   Destructibles, explosive balls, heat hazards.

3. **Arctic / Frost Labs**  
   smoke, ice, slippery floor, freeze mechanics.

4. **Neon City / Rooftops**  
   electric barriers, moving platforms, drones.

5. **Volcano / Core Foundry**  
   lava, flame vents, falling rocks, high pressure.

6. **Airship / Sky Armada**  
   wind, moving decks, long-range weapons.

7. **Crystal Caverns**  
   reflective surfaces, crystal balls, ricochets.

8. **Haunted Observatory**  
   ghost balls, phase mechanics, gravity shifts.

9. **Machine Factory**  
   conveyor belts, magnets, lasers, production hazards.

10. **Cosmic Rift**  
   portals, gravity wells, boss gauntlets.

### 13.4 Level count roadmap

Possible content milestones:

- **MVP:** 18 levels + boss.
- **Release Candidate:** 24 levels + 2 bosses.
- **Full Launch:** 36 levels + 3 bosses + daily challenge.
- **Expanded Version:** 60 levels + 6 bosses + challenge variants.
- **Long-Term:** 100+ levels with level editor tools and community/shared challenge support if feasible.

### 13.5 Level pacing

For each world:

1. Level 1: introduce mechanic safely.
2. Level 2: use mechanic with light pressure.
3. Level 3: combine mechanic with platform/layout twist.
4. Level 4: challenge version.
5. Level 5: miniboss or special level.

### 13.6 Level modifiers

Optional modifiers can increase replayability:

- low gravity,
- fast balls,
- giant balls,
- tiny swarm,
- no pickups,
- weapon roulette,
- double score but one life,
- darkness/silhouette mode,
- mirror controls,
- moving walls,
- shrinking safe zone,
- boss hazard active in normal level.

---

## 14. Boss Roadmap

### 14.1 Boss design goals

Bosses should not merely be large targets. They should remix the core bubble-splitting mechanics.

A good boss should:

- have clear phases,
- spawn or manipulate balls,
- telegraph attacks,
- reward precise timing,
- introduce spectacle,
- remain readable,
- not become unfair bullet hell.

### 14.2 Boss archetypes

#### Commander Rift

Current boss concept. Can be expanded with weak-point phases.

Possible attacks:

- vertical laser sweep,
- ball spawn waves,
- shield phase,
- platform destruction,
- electric beam warnings,
- final desperation phase.

#### Bubble Kraken

Tentacles throw bouncing orbs. Tentacles can be stunned by popping linked balls.

#### Clockwork Zeppelin

Airship boss that drops bombs, wind gusts, and magnetic mines.

#### Crystal Monarch

Reflective boss that requires ricochet shots or mirror timing.

#### Slime Queen

Creates slime puddles and divides into smaller slime cores.

#### Volcano Titan

Summons lava balls and floor vents.

#### Ghost Conductor

Phase-shifts platforms and balls, requiring timing.

#### Factory Core

Mechanical boss that produces balls from conveyor tubes.

#### Cosmic Singularity

Gravity boss that bends projectile paths and ball arcs.

### 14.3 Boss rewards

Bosses could unlock:

- new world,
- new weapon,
- cosmetic skin,
- permanent medal,
- challenge mode modifier,
- co-op character,
- soundtrack track,
- trophy in collection room.

---

## 15. Game Modes Roadmap

### 15.1 Tour Mode

The main campaign mode.

Upgrade ideas:

- world map,
- level medals,
- unlock gates,
- boss stages,
- secrets,
- bonus stages,
- cutscene panels,
- optional dialogue bubbles,
- replay incentives.

### 15.2 Score Attack

A replayable scoring mode.

Upgrade ideas:

- rotating stage pool,
- fixed daily seed,
- score multipliers,
- no continues,
- strict timer,
- leaderboards,
- ghost score target,
- bronze/silver/gold/platinum thresholds.

### 15.3 Panic Mode

Endless survival waves.

Upgrade ideas:

- wave rewards,
- wave modifiers,
- boss every 5 waves,
- escalating hazards,
- random weapon draft between waves,
- online leaderboard,
- weekly Panic ruleset.

### 15.4 Challenge Mode

Handcrafted challenge stages with special rules.

Examples:

- one shot only,
- no pickups,
- tiny hitbox,
- all electric balls,
- invisible timer,
- combo requirement,
- clear without moving left,
- clear with only bombs,
- survive 90 seconds.

### 15.5 Daily Challenge

One shared daily level or seed.

Features:

- same layout for all players,
- one attempt or unlimited practice,
- daily leaderboard,
- daily reward chest,
- streak bonus,
- special modifier.

### 15.6 Weekly Tournament

A curated sequence of levels with a cumulative score.

Features:

- 5-level gauntlet,
- no continues,
- global leaderboard,
- cosmetic reward,
- rotating world theme.

### 15.7 Boss Rush

Fight all bosses in sequence.

Features:

- score bonuses,
- no full healing between bosses,
- optional co-op,
- difficulty tiers.

### 15.8 Time Trial

Clear stages as fast as possible.

Features:

- split timers,
- best-time ghosts,
- instant restart,
- medal thresholds.

### 15.9 Casual Mode

For broader audience.

Features:

- larger life pool,
- no strict timer,
- more shields,
- slower early balls,
- optional hints,
- reduced flashing.

### 15.10 Classic Mode

For purists.

Features:

- strict lives,
- strict hitboxes,
- minimal power-ups,
- no upgrades,
- high-score focus.

### 15.11 Co-op Campaign

Two players locally or potentially online later.

Features:

- separate scores or shared score,
- revive mechanic,
- co-op medals,
- co-op-specific levels,
- friendly collision optional,
- teamwork weapons.

### 15.12 Versus Mode

A competitive local mode.

Possible variants:

- split-screen survival race,
- send bubbles to opponent by popping yours,
- last player standing,
- territory control with popped bubbles,
- score duel.

This is optional and should not distract from the main release.

---

## 16. Progression Roadmap

### 16.1 Level unlocks

Basic campaign progression should remain simple:

- complete level to unlock next level,
- earn medals for better performance,
- boss unlocks after enough medals or completing all world stages.

### 16.2 Medal system

Medals create replayability.

Possible medals:

- clear medal,
- bronze/silver/gold score medal,
- time medal,
- no-hit medal,
- combo medal,
- accuracy medal,
- co-op medal,
- challenge medal.

### 16.3 Player rank

A simple account/profile rank can reward overall play.

XP sources:

- level clears,
- medals,
- daily challenges,
- achievements,
- boss clears,
- Panic waves,
- Score Attack milestones.

Rank rewards:

- skins,
- trails,
- title badges,
- alternate projectile visuals,
- menu backgrounds,
- new challenge modifiers.

### 16.4 Unlockable weapons

Weapons can either remain pickup-only or become progressively introduced.

Recommended:

- keep all weapons as pickups,
- unlock them gradually into the random pickup pool,
- teach each weapon through a tutorial/challenge stage.

### 16.5 Permanent upgrades: caution

Permanent gameplay upgrades can damage arcade fairness if not balanced.

Possible safe upgrades:

- cosmetic only,
- extra starting shield in casual mode only,
- slightly longer pickup magnet in non-leaderboard modes,
- unlockable starting weapon for casual replay,
- practice assists.

For competitive score modes, disable permanent gameplay upgrades or separate leaderboards.

### 16.6 Cosmetic progression

This is safer than power progression.

Possible cosmetics:

- player skins,
- harpoon skins,
- projectile trails,
- pop effects,
- ball skins,
- victory poses,
- UI themes,
- menu background themes,
- co-op partner skins,
- title cards.

### 16.7 Collection book

A collection system can give long-term goals.

Collectibles:

- ball encyclopedia,
- weapon cards,
- world postcards,
- boss trophies,
- rare pickup discoveries,
- character skins,
- achievement badges.

---

## 17. Retention Systems

### 17.1 Daily reward

A simple daily reward can improve return behavior.

Possible rewards:

- coins,
- cosmetic shards,
- challenge tickets,
- random skin fragment,
- one-time casual assist,
- daily chest.

Avoid making rewards necessary for core progress.

### 17.2 Daily challenge

Daily Challenge is likely more valuable than a passive daily login reward because it gives the player a reason to play.

Recommended:

- one curated or seeded stage per day,
- leaderboard,
- streak reward,
- special modifier,
- shareable result screen.

### 17.3 Weekly events

Possible event themes:

- Electric Week,
- Volcano Rush,
- Tiny Bubble Swarm,
- Boss Invasion,
- Co-op Weekend,
- Golden Score Week,
- Retro Classic Week,
- Low Gravity Week.

### 17.4 Missions

Short goals:

- pop 100 bubbles,
- clear 3 levels without losing life,
- use laser 5 times,
- reach wave 10 in Panic,
- collect 5 shields,
- defeat a boss,
- earn a gold medal.

### 17.5 Achievement system

Achievements should support mastery.

Categories:

- progression,
- skill,
- weapon mastery,
- ball-type mastery,
- boss mastery,
- co-op,
- daily/weekly,
- secret/funny.

### 17.6 Return screen

When player returns:

- show current streak,
- show new daily challenge,
- show unfinished medals,
- highlight one recommended next action.

Do not overload with many popups.

---

## 18. Economy and Rewards

### 18.1 Should the game have currency?

Yes, but carefully.

Possible currency:

- **Coins:** earned from levels and score.
- **Stars:** earned from medals.
- **Gems:** avoid premium-style currency unless necessary.
- **Tickets:** optional entry for special challenges.

Recommended:

- Coins for cosmetics and optional assists.
- Stars for unlocking cosmetic tiers or bonus challenges.
- No aggressive monetization currency in early release.

### 18.2 Reward sources

- level score,
- time bonus,
- combo bonus,
- no-hit bonus,
- daily challenge,
- achievements,
- boss clears,
- hidden collectibles,
- co-op clears.

### 18.3 Reward sinks

- cosmetics,
- alternate visual themes,
- practice assists,
- challenge unlocks,
- music tracks,
- player titles,
- collectible cards.

### 18.4 Avoid pay-to-win feeling

Since the game is skill-based arcade, avoid permanent power advantages in leaderboard modes.

---

## 19. UI/UX Roadmap

### 19.1 Main menu

The main menu should be premium, simple, and immediately action-focused.

Recommended buttons:

1. Play
2. Level Select
3. Daily Challenge
4. Modes
5. Cosmetics / Collection
6. Settings

Avoid showing too many buttons at once.

### 19.2 First-run flow

First-run should be:

```text
Main menu → Play → Level 1 starts immediately → simple control hint → first pop within seconds
```

Do not force a long tutorial.

### 19.3 HUD

HUD should show only what matters:

- lives,
- score,
- timer,
- current weapon/ammo,
- combo,
- level name,
- player 2 status if active,
- pause button.

Optional:

- medal progress,
- boss health,
- daily challenge rank.

### 19.4 Level clear screen

Should show:

- base score,
- time bonus,
- accuracy bonus,
- combo bonus,
- no-hit bonus,
- medal earned,
- best score comparison,
- next level button,
- replay button.

### 19.5 Game over screen

Should be fast and motivating:

- “Retry” as primary action,
- show what killed player,
- show best attempt,
- suggest simple improvement,
- no slow animations before retry.

### 19.6 Level select

Features:

- world map or grid,
- medals visible,
- locked stages clear,
- boss nodes,
- challenge variants,
- recommended next level.

### 19.7 Settings

Must include:

- master volume,
- music volume,
- SFX volume,
- mute,
- controls remap if feasible,
- touch layout options,
- reduced motion,
- screen shake toggle,
- flash reduction,
- high contrast mode,
- language if localized later.

### 19.8 Pause menu

Should include:

- resume,
- restart,
- controls,
- settings,
- quit to menu.

For mobile, pause should be easy to reach but not accidentally tapped.

---

## 20. Tutorial and Onboarding Roadmap

### 20.1 Tutorial philosophy

Teach by playing.

Avoid:

- long text,
- modal interruptions,
- forcing player to read before action,
- explaining every feature upfront.

### 20.2 First level tutorial beats

1. Player appears.
2. Text: “Move” with arrows/A-D or touch cue.
3. One large slow ball bounces safely.
4. Text: “Shoot upward.”
5. Player pops ball.
6. Children split predictably.
7. Player clears them.
8. Level clear screen rewards player.

### 20.3 Progressive tutorialization

Each new world introduces one or two concepts:

- Level 1: move/shoot.
- Level 2: splitting.
- Level 3: platforms.
- Level 4: pickups.
- Desert: crates/explosives.
- Arctic: smoke/sludge/armor.
- City: moving platforms/electric barriers.
- Volcano: vents/lava/falling rocks.
- Airship: wind/moving decks.
- Boss: telegraphs/weak points.

### 20.4 Optional tutorial replay

Add a “How to Play” mode where players can practice:

- shooting,
- dodging,
- weapon pickups,
- special ball types,
- boss attacks.

---

## 21. Visual Roadmap

### 21.1 Visual target

The game should look dramatically better than old retro web versions while keeping the same instant readability.

Target qualities:

- premium arcade polish,
- strong silhouettes,
- high contrast,
- expressive themes,
- juicy particles,
- modern lighting/glow,
- readable UI,
- clear danger language.

### 21.2 Art style options

#### Option A: Hand-drawn cartoon arcade

Pros:

- charming,
- broad appeal,
- good for kids/families,
- easy to differentiate.

Cons:

- needs better art assets.

#### Option B: Neon vector arcade

Pros:

- easier to produce procedurally,
- strong readability,
- premium browser look,
- small file size.

Cons:

- may feel abstract if not characterful.

#### Option C: Toy-like 2.5D rendered sprites

Pros:

- premium thumbnail appeal,
- can feel modern.

Cons:

- asset production heavier.

#### Option D: Pixel-art deluxe

Pros:

- nostalgic,
- manageable assets,
- readable.

Cons:

- many retro competitors.

Recommended: **cartoon-neon hybrid** — bright, readable, modern, with high-quality procedural or hand-drawn-style sprites.

### 21.3 Player visual upgrade

The current player should eventually become a distinct mascot.

Possible identities:

- bubble hunter,
- robot technician,
- tiny astronaut,
- slime ranger,
- toy soldier,
- arcade hero,
- lab containment specialist,
- explorer.

The character should have:

- strong silhouette,
- clear facing direction,
- readable hurtbox,
- expressive idle/walk/shoot/hit animations,
- unlockable skins.

### 21.4 Ball visual upgrade

Balls should feel alive or energetic.

Options:

- glossy bubble orbs,
- slime creatures,
- unstable energy spheres,
- cursed bouncing gems,
- alien blobs,
- mechanical drones.

Important: They must remain circular and readable.

### 21.5 Background upgrade

Backgrounds should be beautiful but not distracting.

Possible layers:

- far sky gradient,
- midground silhouettes,
- animated environmental elements,
- foreground framing,
- subtle parallax,
- level-specific props.

Avoid high-detail clutter behind active balls.

### 21.6 VFX roadmap

Add:

- pop bursts,
- size-dependent particle explosions,
- combo sparks,
- slow-motion final hit,
- pickup glow,
- weapon trails,
- boss warning effects,
- smoke/steam/lava particles,
- level clear celebration,
- screen flash with accessibility control.

### 21.7 Animation roadmap

Add:

- player idle,
- run cycle,
- shoot pose,
- hit reaction,
- respawn effect,
- victory pose,
- pickup animation,
- ball squash/stretch,
- platform motion polish,
- boss phase transitions.

---

## 22. Audio Roadmap

### 22.1 Audio identity

The game should sound like a satisfying arcade toy.

Priorities:

- clean pop sounds,
- distinct weapon sounds,
- readable danger warnings,
- level clear fanfare,
- boss intensity,
- combo feedback.

### 22.2 Procedural audio improvements

Current procedural Web Audio is a strength for small build size.

Upgrade ideas:

- layered pop sounds by size,
- pitch variation,
- stereo panning by position,
- weapon-specific synthesis,
- boss warning tones,
- low-pass filter in pause/slow-time,
- dynamic music intensity.

### 22.3 Music roadmap

Possible tracks:

- main menu theme,
- beach theme,
- desert theme,
- arctic theme,
- city theme,
- volcano theme,
- airship theme,
- boss theme,
- panic mode theme,
- victory theme.

If using generated/synth music, ensure loops are short, polished, and not annoying.

### 22.4 Audio accessibility

Add visual equivalents for:

- timer warnings,
- electric charge warnings,
- boss attacks,
- pickup spawn,
- player hit.

---

## 23. Mobile and Touch Roadmap

### 23.1 Importance

Mobile support could significantly improve the game’s reach. However, the game must still feel precise.

### 23.2 Touch control options

#### Option A: Left/right buttons + shoot button

Simple and readable.

Pros:

- easy to implement,
- classic arcade layout.

Cons:

- may feel less fluid.

#### Option B: Virtual joystick + shoot button

Pros:

- familiar mobile action layout.

Cons:

- can be less precise for one-dimensional movement.

#### Option C: Drag-to-move + auto-shoot

Player drags horizontally, character follows; shooting is automatic or tap-based.

Pros:

- very mobile-friendly,
- easier for casual players.

Cons:

- changes skill balance.

#### Option D: Tap left/right halves + hold shoot

Pros:

- simple.

Cons:

- less premium.

Recommended:

- Desktop: keyboard movement + shoot.
- Mobile: left/right buttons + shoot button, with optional drag-to-move mode.

### 23.3 Mobile UI requirements

- large buttons,
- no tiny text,
- safe area support,
- landscape orientation preferred,
- pause button reachable,
- no important UI under fingers,
- input latency minimized.

### 23.4 Mobile gameplay adjustments

- slightly larger player forgiveness,
- slower early levels,
- bigger pickups,
- reduced small-ball chaos,
- clearer warning effects,
- optional auto-fire in casual mobile mode.

---

## 24. Accessibility Roadmap

### 24.1 Visual accessibility

Add:

- high contrast mode,
- reduced motion,
- reduced flash,
- screen shake toggle,
- colorblind-safe ball outlines,
- danger pattern overlays beyond color,
- larger UI text option,
- readable font scaling,
- optional darkened background behind gameplay objects.

### 24.2 Control accessibility

Add:

- remappable keys,
- alternative shoot key,
- one-handed mode,
- hold/toggle shooting option,
- gamepad support,
- touch layout customization.

### 24.3 Difficulty accessibility

Add:

- casual mode,
- extra lives option,
- slower ball speed option outside leaderboards,
- aim assist / trajectory hint in tutorial,
- practice mode.

### 24.4 Audio accessibility

Add visual indicators for important sounds.

---

## 25. Co-op Roadmap

### 25.1 Current local co-op

The current version has optional local co-op. This is a valuable differentiator.

### 25.2 Co-op improvements

- clearer join prompt,
- character select for Player 2,
- separate color coding,
- separate weapon HUD,
- revive mechanic,
- shared lives option,
- separate lives option,
- co-op medals,
- co-op-specific score bonuses,
- co-op combo chains,
- co-op tutorial.

### 25.3 Co-op mechanics

Possible team mechanics:

- one player can revive the other,
- dual-shot combo when both hit same ball quickly,
- shield transfer,
- special two-player super attack,
- one player controls a drone/helper,
- team roles: attacker/support.

### 25.4 Online co-op: caution

Online co-op is technically much more complex. It should be postponed unless the game is already successful.

If implemented later:

- use deterministic lockstep only if physics is stable,
- or authoritative server if budget allows,
- support invite links,
- keep latency tolerance in mind.

---

## 26. Leaderboards and Competitive Roadmap

### 26.1 Local high scores

Current localStorage high scores are a good baseline.

Improve with:

- per-level best scores,
- per-mode best scores,
- best time,
- best combo,
- best no-hit streak.

### 26.2 Online leaderboards

If platform integration supports it:

- daily challenge leaderboard,
- weekly Panic leaderboard,
- level-specific leaderboard,
- boss rush leaderboard.

### 26.3 Anti-cheat considerations

For browser games, client-side scores are easy to manipulate. Keep expectations realistic.

Possible mitigation:

- submit run summary data,
- detect impossible scores,
- separate casual and competitive modes,
- use fixed daily seeds,
- avoid high-stakes rewards tied to leaderboard rank.

### 26.4 Ghost/replay system

Possible future feature:

- record inputs per run,
- allow replay of best run,
- show ghost in time trial,
- share replay code.

This is advanced but powerful for skill games.

---

## 27. CrazyGames Integration Roadmap

### 27.1 Basic platform readiness

Ensure:

- game loads quickly,
- no console errors,
- no external CDN dependency unless justified,
- responsive iframe behavior,
- full-screen support,
- mute/settings available,
- save works,
- game can run without SDK locally,
- no broken ad calls during Basic Launch.

### 27.2 SDK integration

Possible SDK areas:

- gameplay start/stop events,
- happy time events after major achievements,
- rewarded ads after death or for optional continue,
- midgame ads only at natural breaks,
- save support if needed,
- invite/share if future co-op/leaderboard features expand.

### 27.3 Ad placement strategy

Ads should never interrupt active arcade play.

Safe placements:

- after level clear,
- after game over,
- between world transitions,
- optional rewarded continue,
- optional double cosmetic coins,
- optional daily challenge retry if appropriate.

Avoid:

- ads during active level,
- ads before first gameplay,
- forced ads after very short failed attempts,
- ad prompts that obscure retry flow.

### 27.4 Conversion-first design

The player should reach gameplay quickly.

Recommended:

- one-click Play,
- no account requirement,
- no settings gate,
- no lengthy intro,
- no huge loading screen,
- first level starts quickly.

---

## 28. Technical Architecture Roadmap

### 28.1 Current architecture

Current structure:

- custom Game class,
- data-driven levels,
- entity classes,
- procedural rendering,
- systems for audio/input/storage,
- Vite build.

This is good for current scope.

### 28.2 Refactoring priorities

If the project grows, gradually split responsibilities.

Possible modules:

- `GameStateMachine`
- `LevelManager`
- `ModeManager`
- `CollisionSystem`
- `ScoreSystem`
- `ComboSystem`
- `PickupSystem`
- `WeaponSystem`
- `BallSystem`
- `HudRenderer`
- `MenuRenderer`
- `TransitionSystem`
- `SettingsSystem`
- `ProfileSystem`
- `AchievementSystem`
- `DailyChallengeSystem`

Avoid over-refactoring too early. Refactor when it reduces risk.

### 28.3 Rendering roadmap

Options:

1. Continue immediate-mode Canvas.
2. Add sprite atlas but keep Canvas.
3. Add layered Canvas for background/gameplay/UI.
4. Move to Phaser only if asset-heavy scene management becomes needed.

Recommended near-term:

- keep Canvas,
- add rendering helper modules,
- add optional sprite generation/caching,
- avoid framework rewrite before release candidate.

### 28.4 Performance roadmap

Ensure:

- stable 60 FPS on low-end devices,
- object pooling for particles/projectiles/pickups,
- no excessive allocations per frame,
- capped particle counts,
- efficient collision loops,
- DPR control,
- battery-friendly mobile mode,
- reduced effects setting.

### 28.5 Save schema roadmap

Current storage should evolve into a versioned profile.

Save fields:

- schema version,
- unlocked levels,
- medals,
- best scores,
- settings,
- cosmetics unlocked,
- daily challenge progress,
- achievements,
- stats,
- tutorial flags.

Add migration helpers early.

### 28.6 Data-driven content

More systems should be data-driven:

- levels,
- worlds,
- weapons,
- pickups,
- achievements,
- daily modifiers,
- cosmetics,
- boss phases.

This makes future development faster and safer.

---

## 29. Level Editor and Tooling Roadmap

### 29.1 Why a level editor matters

If the game expands beyond 30–40 stages, hand-editing TypeScript level data becomes slow.

### 29.2 Simple internal editor

Possible first editor:

- browser-only dev mode,
- drag platforms/balls/hazards,
- edit properties,
- export JSON/TS object,
- playtest instantly,
- snap-to-grid optional.

### 29.3 Advanced editor features

- level validation,
- difficulty estimate,
- automatic screenshot preview,
- medal threshold suggestions,
- path/safety heatmap,
- object templates,
- copy/paste stage elements,
- batch world editing.

### 29.4 Procedural challenge generator

Later, generate daily challenges from templates:

- choose theme,
- choose ball set,
- choose layout archetype,
- choose modifier,
- validate spawn safety,
- estimate difficulty.

---

## 30. Content Expansion Ideas

### 30.1 New worlds

#### Jungle Ruins

Features:

- vines,
- rolling logs,
- poison bubbles,
- crumbling platforms.

#### Crystal Caverns

Features:

- reflective crystals,
- mirror balls,
- ricochet weapons.

#### Toy Factory

Features:

- conveyor belts,
- mechanical balls,
- toy bots,
- rotating platforms.

#### Haunted Mansion

Features:

- ghost balls,
- flickering lights,
- phase platforms.

#### Moon Base

Features:

- low gravity,
- airlocks,
- floating pickups,
- cosmic balls.

#### Candy Carnival

Features:

- sticky floors,
- gummy balls,
- bouncing pads,
- bright casual appeal.

#### Underwater Dome

Features:

- slower movement,
- buoyant bubbles,
- currents,
- oxygen timer modifier.

#### Time Lab

Features:

- time-slow zones,
- reversing balls,
- clockwork hazards.

### 30.2 Bonus stages

Possible bonus stages:

- collect coins while avoiding harmless balls,
- pop golden bubbles only,
- survive for 30 seconds,
- weapon training challenge,
- boss target practice,
- chain reaction puzzle.

### 30.3 Secret stages

Unlock via:

- clearing levels no-hit,
- finding hidden object,
- earning all medals in a world,
- daily challenge streak,
- boss secret condition.

---

## 31. Narrative and Theme Roadmap

### 31.1 Should the game have story?

Yes, but light.

Arcade games benefit from flavor, but not long cutscenes.

### 31.2 Story options

#### Adventure Quest

A hero travels through worlds to stop unstable bouncing energy creatures.

#### Lab Escape

Experimental bubbles escape containment, and the player must clean facilities.

#### Airship Expedition

The player chases sky pirates who weaponized bouncing orbs.

#### Cosmic Rift

Portals release unstable spheres into multiple worlds.

### 31.3 Delivery method

Use:

- short world intro cards,
- boss taunts,
- level names,
- collectible postcards,
- animated map moments,
- no long dialogue before gameplay.

### 31.4 Tone

Recommended tone:

- playful,
- energetic,
- adventurous,
- slightly comic,
- never too dark,
- family-friendly.

---

## 32. Monetization and Full Launch Readiness

### 32.1 Monetization philosophy

The game should be fun without ads. Ads should be optional or placed at fair breaks.

### 32.2 Rewarded ad ideas

- continue after death once per run,
- double coins after level clear,
- unlock cosmetic chest faster,
- extra daily challenge attempt,
- revive co-op partner,
- temporary casual assist.

### 32.3 Forced ads

If used later, only between levels or after game over, never during active play.

### 32.4 Cosmetic economy

Cosmetics are safest:

- player skins,
- weapon trails,
- pop effects,
- UI themes,
- title badges,
- victory poses.

### 32.5 Avoid monetization mistakes

Avoid:

- pay-to-win upgrades,
- ad before first gameplay,
- ad after every failed short attempt,
- confusing currency systems,
- manipulative timers.

---

## 33. Metrics and Tuning Roadmap

### 33.1 Internal metrics to track during testing

Even before analytics integration, manually track:

- first level completion rate,
- deaths per level,
- average time per level,
- retry rate,
- quit points,
- most-used weapons,
- least-used weapons,
- pickup collection rate,
- mode selection rate,
- co-op usage,
- mobile vs desktop performance.

### 33.2 Gameplay tuning targets

Early game:

- level 1 should be completed by almost everyone,
- first death should feel fair,
- first boss should be dramatic but not brutal,
- player should see at least one exciting pickup within first few minutes.

Mid game:

- difficulty should rise through mechanic combinations,
- not just faster balls,
- worlds should feel distinct.

Late game:

- mastery challenges,
- optional hard medals,
- boss rush,
- panic mode.

### 33.3 A/B test candidates

If possible:

- auto-start first level vs menu first,
- tutorial text amount,
- starting lives,
- first world difficulty,
- pickup frequency,
- default movement speed,
- casual vs classic default.

---

## 34. QA Roadmap

### 34.1 Core smoke test

Every build:

- fresh load works,
- Play starts level 1,
- player moves,
- player shoots,
- balls split,
- player can die,
- level can be cleared,
- score saves,
- pause works,
- restart works,
- audio mute works,
- no console errors.

### 34.2 Mode tests

- Tour mode complete path,
- Score Attack starts and ends correctly,
- Panic waves advance,
- Boss can be defeated,
- Victory state works,
- Level select respects unlocks.

### 34.3 Input tests

- keyboard,
- alternative keys,
- player 2 join,
- touch controls if added,
- gamepad if added,
- pause/resume after tab focus loss.

### 34.4 Save tests

- new save,
- existing save,
- corrupted save,
- version migration,
- localStorage disabled/failing,
- high score update.

### 34.5 Responsive tests

- 16:9 desktop iframe,
- fullscreen desktop,
- small laptop iframe,
- mobile landscape,
- tablet landscape,
- high-DPR screens,
- low-performance devices.

### 34.6 Edge case tests

- player dies at same time as level clear,
- boss dies as timer reaches zero,
- pickup collected as player dies,
- all balls cleared during explosion chain,
- player 2 joins mid-level,
- pause during hit pause,
- restart during boss phase.

---

## 35. Technical Debt Watchlist

### 35.1 Monolithic Game class

The current Game class may become too large as systems expand.

Refactor triggers:

- too many mode-specific branches,
- UI rendering becomes hard to manage,
- adding achievements/dailies becomes risky,
- bugs appear due to shared state complexity.

### 35.2 Immediate-mode menus

Immediate-mode canvas menus are fine early, but more complex UI may benefit from DOM overlay or structured UI components.

Possible future split:

- Canvas for gameplay,
- DOM/CSS for menus, settings, level select, achievements,
- Canvas HUD if it needs tight integration.

### 35.3 No asset pipeline

Procedural drawing is efficient, but premium visuals may require sprites.

Possible future:

- generated sprite atlas,
- hand-drawn PNG atlas,
- compressed audio assets,
- lazy loading per world.

### 35.4 Collision complexity

As hazards and projectiles grow, collision logic may become messy.

Possible solution:

- central collision system,
- collision layers,
- entity tags,
- broadphase grid if needed.

---

## 36. Phased Roadmap

## Phase 0 — Stabilize Current Build

Goal: Make current version reliable.

Tasks:

- run typecheck/build,
- fix console errors,
- verify all 18 levels,
- verify boss fight,
- verify high-score persistence,
- verify player 2 join,
- verify all weapons,
- verify all pickups,
- verify all hazards,
- improve README/test checklist.

Deliverable:

- stable playable build.

---

## Phase 1 — Game Feel and Readability Pass

Goal: Make the game feel dramatically better without adding major systems.

Tasks:

- tune movement,
- tune ball speeds,
- improve pop feedback,
- improve projectile visuals,
- improve screen shake/hit pause,
- improve ball shadows,
- improve danger telegraphs,
- improve player hurtbox fairness,
- improve pickup readability,
- add reduced flash/shake settings.

Deliverable:

- same game, much better feel.

---

## Phase 2 — First-Time User Experience

Goal: Ensure players understand the game immediately.

Tasks:

- simplify first menu,
- one-click Play,
- improve Level 1 tutorial,
- add better control prompts,
- make first pop satisfying,
- improve level clear summary,
- fast retry button,
- clearer game over feedback.

Deliverable:

- first 60 seconds polished.

---

## Phase 3 — Visual Identity Upgrade

Goal: Make the game look premium and differentiated.

Tasks:

- choose final theme identity,
- redesign player mascot,
- improve ball visuals,
- improve world backgrounds,
- improve HUD art,
- improve menu style,
- add better VFX,
- create thumbnail-ready visual moments.

Deliverable:

- visually competitive arcade presentation.

---

## Phase 4 — Mobile/Touch Support

Goal: Support mobile/tablet if feasible.

Tasks:

- add touch controls,
- add responsive layout,
- tune mobile difficulty,
- ensure buttons are large,
- test landscape mobile,
- add touch tutorial hints.

Deliverable:

- playable mobile version or clear desktop-only decision.

---

## Phase 5 — Progression and Medals

Goal: Improve replayability.

Tasks:

- per-level medals,
- medal thresholds,
- unlock rewards,
- player rank,
- cosmetic rewards,
- improved level select,
- world map or world grid.

Deliverable:

- clear campaign progression and reasons to replay.

---

## Phase 6 — Daily Challenge and Achievements

Goal: Add retention hooks.

Tasks:

- achievement system,
- daily challenge seed/system,
- daily reward or streak,
- mission system,
- stats tracking,
- shareable result screen.

Deliverable:

- player has reasons to return tomorrow.

---

## Phase 7 — Content Expansion

Goal: Add enough content for stronger launch.

Tasks:

- add 6–18 additional levels,
- add 1–2 new worlds,
- add 1–2 new bosses,
- add new ball types,
- add new hazards,
- add challenge stages.

Deliverable:

- broader content package.

---

## Phase 8 — CrazyGames Integration

Goal: Make the game platform-ready.

Tasks:

- SDK adapter,
- gameplay start/stop hooks,
- happy time events,
- optional rewarded ads,
- pause/focus behavior,
- local fallback,
- build-size check,
- iframe testing,
- no console errors.

Deliverable:

- CrazyGames-ready submission candidate.

---

## Phase 9 — Competitive and Social Features

Goal: Increase replayability and shareability.

Tasks:

- daily/weekly leaderboards if feasible,
- better local leaderboards,
- ghost/replay investigation,
- co-op medals,
- share screen,
- tournament mode.

Deliverable:

- stronger long-term skill loop.

---

## Phase 10 — Advanced Expansion

Goal: Long-term growth after launch.

Tasks:

- level editor,
- procedural challenge generator,
- additional worlds,
- boss rush,
- online co-op investigation,
- seasonal events,
- cosmetic shop,
- expanded collection book.

Deliverable:

- post-launch roadmap.

---

## 37. Feature Priority Matrix

| Feature | Impact | Risk | Priority |
|---|---:|---:|---:|
| Game feel polish | Very high | Low | Critical |
| First-level onboarding | Very high | Low | Critical |
| Visual identity upgrade | Very high | Medium | Critical |
| Touch controls | High | Medium | High |
| Medals | High | Low | High |
| Level select polish | High | Low | High |
| Daily challenge | High | Medium | High |
| Achievements | Medium | Medium | Medium |
| More levels | High | Medium | High |
| More weapons | Medium | Medium | Medium |
| More ball types | Medium | Medium | Medium |
| More bosses | High | High | Medium |
| Cosmetics | Medium | Medium | Medium |
| Online leaderboards | Medium | Medium/High | Medium |
| Online co-op | Medium | Very high | Low/Post-launch |
| Level editor | High for dev speed | High | Post-launch/tooling |
| Permanent upgrades | Medium | High balance risk | Caution |
| Story/cutscenes | Low/Medium | Medium | Low |
| Heavy asset pipeline | Medium | High | Later |

---

## 38. Features To Avoid or Postpone

### 38.1 Avoid before first release

- online multiplayer,
- complex economy,
- premium currency,
- season pass,
- too many upgrade trees,
- long story cutscenes,
- too many modes on first menu,
- excessive particle clutter,
- major framework rewrite,
- asset-heavy pipeline before gameplay is proven.

### 38.2 Postpone until after validation

- online co-op,
- world editor for players,
- seasonal live ops,
- advanced leaderboards,
- cloud saves,
- elaborate cosmetics store,
- battle pass-like systems,
- major sequel-sized content expansions.

### 38.3 Never compromise

- instant readability,
- tight controls,
- fair collision,
- fast restart,
- clear goals,
- smooth performance.

---

## 39. Recommended Next Implementation Steps

### Step 1: Create a polish branch

Focus only on:

- controls,
- first level,
- pop feedback,
- UI readability,
- restart flow.

### Step 2: Create a visual identity branch

Focus on:

- player design,
- ball design,
- backgrounds,
- HUD,
- menu.

### Step 3: Create a mobile branch

Focus on:

- touch controls,
- responsive layout,
- mobile testing.

### Step 4: Create progression branch

Focus on:

- medals,
- level select,
- rewards,
- achievements.

### Step 5: Create CrazyGames readiness branch

Focus on:

- SDK adapter,
- pause/focus handling,
- build size,
- no console errors,
- submission checklist.

---

## 40. Ideal Release Version

The ideal first public CrazyGames version should include:

- 24–36 polished levels,
- 2–3 bosses,
- 6–8 worlds or strong world chapters,
- Tour mode,
- Score Attack,
- Panic Mode,
- Daily Challenge,
- local co-op,
- touch controls if feasible,
- medals,
- achievements,
- cosmetics/light rewards,
- excellent first-level onboarding,
- fast restart,
- strong visuals,
- polished audio,
- CrazyGames SDK readiness,
- no console errors,
- small build size,
- stable save system.

---

## 41. The Most Important Design Choice

The game’s opportunity is not simply that it can look better than older bubble-splitting arcade games.

The real opportunity is this:

> **Take a proven, instantly understandable arcade loop and deliver it with modern feel, modern polish, modern progression, and modern replayability — while keeping the original simplicity intact.**

If the game becomes beautiful but cluttered, it loses.

If the game becomes feature-rich but slow to understand, it loses.

If the game becomes modern but less readable, it loses.

If the game becomes polished, immediate, satisfying, fair, replayable, and visually distinct, it has real CrazyGames potential.

---

## 42. Short Final Roadmap Summary

### Must-do

- Better controls and feel.
- Better pop feedback.
- Better first 60 seconds.
- Better visual identity.
- Better HUD/menu polish.
- Medals and replay goals.
- Mobile/touch decision.
- CrazyGames readiness.

### Should-do

- Daily challenge.
- Achievements.
- More bosses.
- More polished worlds.
- Cosmetic rewards.
- Improved co-op.
- Better audio/music.

### Could-do

- Online leaderboards.
- Boss rush.
- Weekly tournaments.
- Level editor.
- Procedural daily levels.
- Online co-op.
- Seasonal events.

### Do later only if successful

- Large-scale live ops.
- Advanced cloud save.
- Player-generated levels.
- Online multiplayer.
- Large cosmetic economy.

---

## 43. Final Product North Star

**Bubble Breaker Adventure should become a premium arcade skill game that is playable in seconds, satisfying for minutes, replayable for weeks, and visually strong enough that players instantly understand: this is not an old retro clone — this is the modern version they actually want to play.**
