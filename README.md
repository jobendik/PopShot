# Bubble Breaker Adventure

A TypeScript HTML5 Canvas arcade game built with Vite.

## Scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - type-check and build for production
- `npm run preview` - preview the production build

## Engine Decision

The game currently does not need Phaser 3. Its core is a compact single-screen canvas loop with simple collision, procedural drawing, immediate-mode menus, and Web Audio effects. Phaser would add weight and a rewrite cost before the project has enough sprite, animation, tiled-map, asset-loading, or scene-management complexity to justify it.

Reconsider Phaser later if development moves toward asset-heavy worlds, reusable scenes, animation pipelines, camera work, or editor-driven level production.

## Implemented From The Original Brief

- 18 handcrafted Tour stages across beach, desert, arctic, city, volcano, and airship themes, plus a boss fight.
- Score Attack, Panic Mode, high-score screen, localStorage persistence, and procedural Web Audio.
- Optional local co-op: press `I`, `K`, or `U` during play to join as Player 2. Player 2 moves with `J`/`L`.
- Full weapon set from the brief: harpoon, double, machine gun, flamethrower, laser, shotgun, shuriken, and bomb.
- Extended pickups: shield, life, score, time, slow time, freeze, smoke clear, magnet, combo booster, and weapon capsules.
- Extra level objects: moving platforms, destructible crates, electric barriers, flame vents, falling rocks, smoke clouds, slime/lava zones, and neutral helpers.
# BubbleBreaker
