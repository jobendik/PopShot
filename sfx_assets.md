# Bubble Breaker Adventure — SFX & Music Asset Spec

> Comprehensive, code-keyed list of every sound the game can emit. Built to be handed to a sound designer (or a stock-library shopping list) without leaving anything ambiguous. Every asset has a **trigger** (where it fires in the codebase), a **character description**, a **length budget**, and a **priority tier** so you can ship a core set first.

---

## 1. Technical specifications

| Spec | Value | Rationale |
|---|---|---|
| **Format (web)** | `.ogg` primary, `.mp3` fallback | OGG is smaller and ubiquitous on Chromium/Firefox; MP3 fallback covers Safari and older iOS. Ship both, let the loader pick. |
| **Sample rate** | 44.1 kHz | Web Audio resamples automatically; 44.1 keeps fidelity without bloating files. Don't ship 48 kHz — wasted bits. |
| **Bit depth (source)** | 16-bit | Sufficient for SFX; saves half the size vs 24-bit. |
| **Channels — SFX** | Mono | Mono SFX are ~half the file size and we don't need stereo separation in a single-screen arcade game. |
| **Channels — Music** | Stereo | Music wants imaging; bundle cost is amortized over loop length. |
| **Bitrate target — SFX (ogg)** | 96 kbps VBR | Hearing test threshold for short percussive sounds is ~80 kbps; 96 leaves headroom. |
| **Bitrate target — Music (ogg)** | 128 kbps VBR | Acceptable for loop music in a browser game. |
| **Peak loudness** | **−3 dBFS true peak** | Prevents clipping when multiple sounds overlap (Web Audio sums then clamps). |
| **RMS / LUFS target — SFX** | **−14 LUFS short-term** | Matches CrazyGames de-facto loudness expectation. Avoid sub-bass-heavy SFX that confuse the player when an ad audio takes over. |
| **RMS / LUFS target — Music** | **−18 LUFS integrated** | Quieter than SFX so the action stays foreground. |
| **Trim** | ≤10 ms silence at head, ≤30 ms tail | Tight starts make pops feel responsive. |
| **Fade-out** | Apply where the tail isn't naturally clean | Prevents clicks; especially important for ball pops fired dozens of times per second. |
| **Loops (music)** | Sample-accurate seamless loop, no fade at loop point | Browser audio loops will click on a non-zero-crossing seam. |

### 1.1 Loader contract (what `audio.ts` will expect)

Each entry below has a stable **Asset ID** like `sfx/weapon/harpoon_fire_01`. The loader maps `Asset ID → { ogg, mp3 }` pairs. Variants are suffixed `_01`, `_02`, `_03` — the playback layer round-robins (or random-no-repeat) so a rapid sequence of pops doesn't sound mechanical.

```
public/sfx/
  weapon/        # weapon fire + impact
  pop/           # ball pop variants per type + size
  bounce/        # floor/wall/platform bounces (variations)
  pickup/        # per-pickup
  hazard/        # lava sizzle, electric beam, falling rock, etc.
  creature/      # bird/dragon/crab/ball-fish
  boss/          # boss attack windups + impacts
  ui/            # menu nav, button click, hover
  combo/         # milestone arpeggios + trick chips
  panic/         # rainbow gauge, star bubble, time-stop, wave start
  ambient/       # per-world ambience beds (optional)
  stinger/       # one-shot transitions
public/music/
  menu_loop.ogg
  world_beach_loop.ogg
  ...
```

---

## 2. Bundle budget

| Tier | What it includes | Approx. raw size | Gzipped impact | Verdict |
|---|---|---|---|---|
| **Core (Tier S)** | 40-60 essential SFX, no music | 200-400 KB | n/a (audio is already compressed) | **Ship at launch.** Doesn't break the small-bundle promise. |
| **Full SFX (Tier S + A)** | ~120 SFX with variants | 600 KB – 1 MB | n/a | Ship if QA goes well. |
| **+ Music** | 9 loops (menu, 6 worlds, boss, panic) at 30-60s each | 2-4 MB | n/a | **Lazy-load** after first interaction; do not block first paint. |
| **+ Ambience beds (Tier B)** | Per-world ambient drones | +500 KB | n/a | Optional polish, lazy-load. |

**Hard ceiling:** total audio payload ≤ 4 MB. Anything beyond that hurts CrazyGames load metrics even if lazy-loaded.

**Lazy-loading rule:** menu music and world-specific tracks load on demand. Only Tier-S SFX block first interaction; everything else streams in after `loadingStop`.

---

## 3. Naming convention

```
sfx/<category>/<event>_<variant>.<ext>
sfx/weapon/harpoon_fire_01.ogg
sfx/pop/normal_size3_02.ogg
sfx/pickup/dynamite_collect.ogg
music/world_volcano_loop.ogg
```

- snake_case, lowercase, no spaces
- `_01`, `_02`, `_03` suffix for variant pool
- size-keyed pops use `_size0` through `_size4` (matching `BALL_RADIUS` indices)
- never use file extension to discriminate — always rely on the ID

---

## 4. Priority tiers

| Tier | Meaning |
|---|---|
| **S** | Ship-blocking. The core arcade feel collapses without these. |
| **A** | Strongly improves perceived production value. Ship by launch if possible. |
| **B** | Polish. Add post-launch based on metrics / feedback. |
| **C** | Aspirational. Only if you have a budget and time. |

---

## 5. Player actions

| Asset ID | Trigger | Character | Length | Tier | Notes |
|---|---|---|---|---|---|
| `sfx/player/footstep_01..03` | `player.ts` while `vx !== 0` | Soft sand/wood thud, three variants for rhythm | 60-90ms | C | Currently absent. Adds liveliness; mix very low. |
| `sfx/player/respawn` | `respawnPlayer` | Warm shimmer, ascending whoosh | 600ms | A | Plays when the player re-spawns after a death (with lives remaining). |
| `sfx/player/invuln_loop` | While `invuln > 0` | Subtle protective hum | loopable 400ms | B | Mix very low. |
| `sfx/player/jam_warning` | Set `weaponDisabled` after bird hit | Comic record-scratch / electric stutter | 350ms | A | Telegraphs "your weapons are locked." |
| `sfx/player/jam_recover` | `weaponDisabled` hits 0 | Brief unmute / power-on tone | 250ms | A | Reward sound for getting your weapon back. |

---

## 6. Weapons (fire SFX, per weapon)

Each weapon's fire sound should be **instantly distinguishable** even with eyes closed — that's how a player learns weapon identity. Match the visual: power wire = chunky, diagonal = whippy, laser = electric.

| Asset ID | Weapon | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/weapon/harpoon_fire_01..03` | Harpoon (default) | Tight pneumatic "tk" with metallic ring tail | 80-120ms | **S** |
| `sfx/weapon/double_fire_01..02` | Double | Same as harpoon but with a tiny stereo echo | 120ms | **S** |
| `sfx/weapon/triple_fire_01..02` | Triple | Layered double-shot, slightly brighter | 130ms | A |
| `sfx/weapon/grapple_fire` | Power Wire travel | Heavier "thwock" — heavy projectile | 180ms | A |
| `sfx/weapon/grapple_anchor` | Grapple reaches ceiling | Solid metal clamp / hook bite | 220ms | A |
| `sfx/weapon/grapple_break` | Grapple struck by ball | Snap + cable-recoil twang | 200ms | A |
| `sfx/weapon/diagonal_fire_01..02` | Diagonal twin bolts | Two near-simultaneous whippy zips | 160ms | A |
| `sfx/weapon/machinegun_fire` | Machine gun (single shot) | Sharp dry crack | 60ms | **S** |
| `sfx/weapon/machinegun_dryfire` | Empty trigger | Click-click | 80ms | C | Optional polish if we ever expose the empty state. |
| `sfx/weapon/laser_fire` | Laser | Charged electric zap with downward pitch slide | 220ms | **S** |
| `sfx/weapon/laser_hum_loop` | While laser beam is alive (0.2s) | High-pitched whine | loopable 100ms | B |
| `sfx/weapon/flame_loop` | While `flameActive` (continuous) | Roar of a small flamethrower | loopable 250ms | **S** |
| `sfx/weapon/flame_start` | First frame `flameActive` flips on | Ignition huff | 200ms | A |
| `sfx/weapon/flame_stop` | `flameActive` flips off | Soft fizz / pilot light | 200ms | A |
| `sfx/weapon/shotgun_fire` | Shotgun | Wide chunky boom | 280ms | **S** |
| `sfx/weapon/shotgun_reload` | After ammo decrements (optional) | Pump action | 380ms | B |
| `sfx/weapon/shuriken_fire_01..03` | Shuriken | Sharp metallic whoosh with spin tail | 280ms | A |
| `sfx/weapon/shuriken_bounce` | Wall/ceiling bounce | Metallic ricochet ping | 120ms | A |
| `sfx/weapon/bomb_launch` | Bomb projectile spawn | Hollow thump / launcher cough | 200ms | A |
| `sfx/weapon/bomb_arc_loop` | While bomb is mid-air | Faint whistle | loopable 300ms | B |
| `sfx/weapon/bomb_explode` | `explodeProjectile()` | Big crunchy detonation with low-end thump | 700ms | **S** (alias to `sfx/hazard/explosion_large`) |

> **Code hook:** add `AudioSys.fire(weapon: WeaponType)` and route to the right pool. Replace the single `shoot()` call site.

---

## 7. Ball pop SFX

The pop is **the** core feel sound. Pitch must drop with ball size — bigger = lower, more weight. Each ball type also gets a type-flourish layered on top of the base pop.

### 7.1 Base pop (per size, all types)

| Asset ID | Size | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/pop/base_size0_01..03` | 0 (tiny) | Bright "pip", high frequency snap | 50ms | **S** |
| `sfx/pop/base_size1_01..03` | 1 (small) | Crisp "pok" | 70ms | **S** |
| `sfx/pop/base_size2_01..03` | 2 (medium) | Round "pop" | 90ms | **S** |
| `sfx/pop/base_size3_01..03` | 3 (large) | Deep "pomp" with body | 120ms | **S** |
| `sfx/pop/base_size4_01..03` | 4 (huge) | Thick "thomp" with sub-bass | 160ms | **S** |

> 3 variants per size = 15 files. Round-robin to avoid auditory fatigue during rapid clears.

### 7.2 Type flourishes (layered on top of base, lower mix)

| Asset ID | Ball type | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/pop/flourish_electric` | electric | High-voltage zap + sparkle | 180ms | **S** |
| `sfx/pop/flourish_explosive_fuse` | explosive (fuse started, not yet detonated) | Sizzling fuse | loopable 250ms | A |
| `sfx/pop/flourish_explosive_detonate` | explosive (final boom) | Deep boom + glass shatter | 500ms | **S** |
| `sfx/pop/flourish_smoke` | smoke | Soft whoosh + cough | 280ms | A |
| `sfx/pop/flourish_lava` | lava | Sizzling drip / lava plop | 250ms | A |
| `sfx/pop/flourish_sludge` | sludge | Wet splat | 240ms | A |
| `sfx/pop/flourish_armored_crack` | armored (1st hit) | Metal dent, no destruction | 180ms | A |
| `sfx/pop/flourish_armored_shatter` | armored (final hit) | Metal shell shatter | 320ms | A |
| `sfx/pop/flourish_bonus_chime` | bonus capsule | Bright bell + magical sparkle | 500ms | **S** |
| `sfx/pop/flourish_hexagon` | hexagon | Glassy crystalline shatter, jaggier than normal | 250ms | A |
| `sfx/pop/flourish_starbubble_clock` | star bubble (Clock face) | Time-warp shimmer, slowed-tape effect | 600ms | A |
| `sfx/pop/flourish_starbubble_star` | star bubble (Star face) | Bright fanfare / wand sweep | 700ms | A |
| `sfx/pop/flourish_flashing_freeze` | flashing micro-ball | Crystalline freeze tinkle | 400ms | A |

### 7.3 Split sound

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/pop/split_01..03` | After ball spawns children | Liquid "schploop" / membrane tearing | 180ms | **S** | Currently `audio.ts:split()`. |

### 7.4 Bounce SFX

Currently absent from procedural audio. Adds enormous arcade feel.

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/bounce/floor_size0..4` | Ball hits floor | Soft thud, pitch by size | 60ms | A |
| `sfx/bounce/wall_01..02` | Ball hits side wall | Lateral tap | 50ms | B |
| `sfx/bounce/platform_01..02` | Ball hits a platform top/bottom | Wooden / metallic depending on platform skin | 60ms | B |
| `sfx/bounce/ceiling` | Ball hits ceiling | Dull thump | 50ms | B |

> **Mix rule:** bounce sounds must be MUCH quieter than pops (−15 dB relative) and cooled-down (max 1 bounce SFX per ~50ms across all balls) or they overwhelm the mix.

---

## 8. Combo & trick fanfares

### 8.1 Combo milestones

Replaces `comboHit(level)` in `audio.ts`. Each is a unique stinger, not just pitch-shifted.

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/combo/milestone_5_nice` | Combo hits 5 | Bright arpeggio "+1 tier" celebration | 600ms | **S** |
| `sfx/combo/milestone_10_wild` | Combo hits 10 | Bigger arpeggio + low impact | 800ms | **S** |
| `sfx/combo/milestone_15_insane` | Combo hits 15 | Layered fanfare + screen-shake-tier hit | 1000ms | A |
| `sfx/combo/milestone_20_godlike` | Combo hits 20 | Choir / cinematic "ohhh!" sweep + drum | 1400ms | A |

### 8.2 Trick chips

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/combo/trick_clutch` | `CLUTCH!` | Heartbeat-then-pop + brass stab | 500ms | A |
| `sfx/combo/trick_close_call` | `CLOSE CALL` | Whoosh-by + heart-thud | 400ms | A |
| `sfx/combo/trick_air_pop` | `AIR POP` | Soaring shimmer | 450ms | A |
| `sfx/combo/trick_bank_shot` | `BANK SHOT` | Cue-ball clack + ricochet chime | 400ms | A |

### 8.3 Multi-pop chains

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/combo/multipop_double` | `DOUBLE POP` | Cascading two-tone | 400ms | A |
| `sfx/combo/multipop_triple` | `TRIPLE POP` | Three-tone with rising tail | 550ms | A |
| `sfx/combo/multipop_mega` | `MEGA POP` (4-7 pops) | Big rolling cascade + cymbal | 800ms | A |
| `sfx/combo/multipop_ultra` | `ULTRA POP` (8+ pops) | Huge cinematic cascade + impact | 1200ms | B |

### 8.4 Special moments

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/combo/first_pop_celebration` | One-time FIRST POP! ever | Big confetti pop + ascending fanfare | 1500ms | **S** | Currently `firstPop()`. |
| `sfx/combo/go_beat` | Intro banner dismissed | Short "GO!" bell hit | 300ms | **S** | Currently `go()`. |
| `sfx/combo/title_unlock` | New title earned | Magical "achievement" sting | 1200ms | A |

---

## 9. Pickups

The pickup sound is one of the highest-frequency reward sounds in the game. Each type deserves distinct character so the player learns through sound what they grabbed without looking at the HUD.

| Asset ID | Pickup | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/pickup/generic_collect` | (fallback) | Bright two-note chime | 250ms | **S** | Currently `pickup()`. |
| `sfx/pickup/shield` | Shield | Energy bubble / power-shield engage | 400ms | **S** |
| `sfx/pickup/shield_break` | Shield consumed by hit | Cracking glass + zap | 350ms | **S** | Currently `shieldBreak()`. |
| `sfx/pickup/life` | Extra life | Bright "1-up" musical phrase | 600ms | A |
| `sfx/pickup/score_gem` | Score gem | Sparkle + ka-ching | 250ms | A |
| `sfx/pickup/time` | +Time | Clock-tick reverse + sparkle | 350ms | A |
| `sfx/pickup/slowtime` | Slow time | Tape-slow whoosh + low pad | 500ms | A |
| `sfx/pickup/freeze` | Freeze | Crystalline frost / ice-form | 500ms | A |
| `sfx/pickup/clearsmoke` | Clear smoke | Wind gust / dissipation whoosh | 450ms | B |
| `sfx/pickup/magnet` | Magnet | Powered-on hum + soft pull | 400ms | B |
| `sfx/pickup/combo_boost` | Combo booster | Rising electric energy | 500ms | A |
| `sfx/pickup/dynamite` | Dynamite (just collected) | Burning fuse + thunderclap | 800ms | A |
| `sfx/pickup/weapon_capsule` | Any weapon pickup | Snappy unlock click + the weapon's own signature | 400ms | A |
| `sfx/pickup/expire_warning` | Pickup blinking before despawn | Subtle ticking pulse | loopable 200ms | C |

---

## 10. Hazards & environment

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/hazard/electric_charge` | Electric ball approaching discharge | Building electric whine | 1200ms | A |
| `sfx/hazard/electric_beam` | Discharge fires | Sharp zap + thunder crack | 400ms | **S** |
| `sfx/hazard/electric_barrier_loop` | Active electric barrier | Low electric hum | loopable 400ms | A |
| `sfx/hazard/flame_vent_start` | Flame vent ignites | Pilot-light puff + whoosh | 300ms | A |
| `sfx/hazard/flame_vent_loop` | Active flame vent | Roaring flame | loopable 400ms | A |
| `sfx/hazard/falling_rock_warn` | Telegraph ring pulses | Rising whistle | 600ms | A |
| `sfx/hazard/falling_rock_impact` | Rock hits floor | Heavy thud + debris shatter | 500ms | **S** |
| `sfx/hazard/lava_drop` | Lava-ball drips on bounce | Wet sizzle | 200ms | A |
| `sfx/hazard/lava_zone_loop` | Active lava patch | Low bubbling | loopable 600ms | B |
| `sfx/hazard/slime_drop` | Sludge-ball deposits slime | Wet plop | 180ms | A |
| `sfx/hazard/slime_step` | Player walks through slime | Squelch (pitch-randomized) | 120ms | B |
| `sfx/hazard/destructible_break` | Crate destroyed | Wooden splinter shatter | 380ms | A |
| `sfx/hazard/destructible_hit` | Crate hit but not yet broken | Dull wood knock | 120ms | B |
| `sfx/hazard/explosion_small` | Small radius | Quick pop-bang | 400ms | A |
| `sfx/hazard/explosion_large` | Bomb / explosive ball / dynamite | Deep boom + debris tail | 700ms | **S** | Currently `explode()`. |
| `sfx/hazard/smoke_puff` | Smoke ball emits cloud | Whoosh + cough | 280ms | B |

---

## 11. Creatures (bestiary)

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/creature/crab_walk_loop` | Crab idle movement | Tiny clicks on the rhythm of footsteps | loopable 600ms | C |
| `sfx/creature/crab_pop` | Crab pops a ball | Small claw-snip + ball pop | 200ms | B |
| `sfx/creature/bird_caw` | Bird visible / on screen periodically | Short squawk | 300ms | A |
| `sfx/creature/bird_jam_player` | Bird hits player → weapon disabled | Annoyed squawk + record-scratch | 500ms | **S** |
| `sfx/creature/bird_killed` | Bird shot down | Comic poof + feather flutter | 400ms | A |
| `sfx/creature/redbird_killed` | Red bird shot (drops pickup) | Same poof + reward chime tail | 600ms | A |
| `sfx/creature/ballfish_swim` | Ball-fish present | Watery wiggle / undulation | loopable 800ms | C |
| `sfx/creature/dragon_friendly_loop` | Dragon idle | Friendly soft purr | loopable 1000ms | B |
| `sfx/creature/dragon_pop_assist` | Dragon pops a ball for the player | Cheerful chirp + small pop | 300ms | A |
| `sfx/creature/dragon_kicked` | Dragon shot → helpful explosion | Surprised roar + sparkle blast | 800ms | A |

---

## 12. Boss

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/boss/phase_intro` | Boss enters / phase transition | Cinematic stinger + low brass | 2000ms | A |
| `sfx/boss/hit_weak_point` | `boss.hit()` damage tick | Crystalline metal hit + glow | 250ms | **S** | Currently `bossHit()`. |
| `sfx/boss/hit_armor` | Damage on shielded phase | Dull thud / deflection | 200ms | A |
| `sfx/boss/warning_telegraph` | Boss warning hazard appears | Ominous "incoming!" siren | 800ms | A |
| `sfx/boss/laser_charge` | Boss laser windup | Building electric whine, longer than ball variant | 1500ms | A |
| `sfx/boss/laser_fire_loop` | Boss laser active | Continuous electric roar | loopable 400ms | A |
| `sfx/boss/spawn_ball` | Boss spawns a new ball | Deep "release" thump | 250ms | B |
| `sfx/boss/projectile_drop` | Boss fires a downward projectile | Heavy whoosh | 280ms | A |
| `sfx/boss/death_sequence` | Boss defeated multi-stage explosion | Layered explosions over 2-3s | 3000ms | **S** |
| `sfx/boss/voice_taunt` | Boss-intro voice taunt (optional) | Stylized growl, language-agnostic | 800-1200ms | C |

---

## 13. UI / Menu

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/ui/nav_move` | Menu arrow up/down | Soft "tk" | 60ms | **S** | Currently `menu()`. |
| `sfx/ui/nav_confirm` | Enter/Space/click on a primary button | Bright confirmation chime | 200ms | **S** |
| `sfx/ui/nav_back` | Esc / Back | Descending two-tone | 180ms | A |
| `sfx/ui/button_hover` | Pointer enters a button | Very subtle tick | 40ms | B | Use sparingly — overuse is irritating. |
| `sfx/ui/toggle_on` | Reduced motion / mute toggled on | Soft positive click | 100ms | A |
| `sfx/ui/toggle_off` | Same toggled off | Same, slightly lower pitch | 100ms | A |
| `sfx/ui/mute_toggle` | M key | Distinct from generic toggle | 120ms | A |
| `sfx/ui/error` | Disallowed action (rare) | Soft "nope" buzz | 200ms | B |
| `sfx/ui/copy_clipboard` | Daily result copied | Tiny "snap" + ✓ confirmation | 220ms | A |
| `sfx/ui/share_open` | X share button opens new tab | Whoosh / portal | 350ms | B |
| `sfx/ui/welcome_back` | Welcome-back banner appears | Friendly arpeggio | 800ms | A |
| `sfx/ui/streak_milestone` | 3 / 7 / 14-day streak hit | Rising celebration cascade | 1500ms | A |

---

## 14. Game-state stingers

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/stinger/level_intro_banner` | Level intro banner slide-in | Soft whoosh + percussion tap | 400ms | A |
| `sfx/stinger/level_clear` | `clearLevel()` | Big celebratory arpeggio | 1500ms | **S** | Currently `levelClear()`. |
| `sfx/stinger/new_medal_bronze` | Bronze tier earned | Single bell tier | 600ms | A |
| `sfx/stinger/new_medal_silver` | Silver tier earned | Double bell tier | 800ms | A |
| `sfx/stinger/new_medal_gold` | Gold tier earned | Triple bell + crystalline shine | 1200ms | **S** |
| `sfx/stinger/new_best` | New score PB on Score Attack / Panic / Boss Rush / Daily | Bright "NEW BEST!" fanfare | 1500ms | **S** |
| `sfx/stinger/new_combo_best` | NEW COMBO BEST banner | Same family as new-best, slightly different colors | 1200ms | A |
| `sfx/stinger/boss_defeated` | Boss defeated → VICTORY transition | Epic resolution chord | 2500ms | A |
| `sfx/stinger/victory` | Final victory screen | Full triumphant theme | 3000ms | A |
| `sfx/stinger/game_over` | Game over screen | Descending "ahhh" / defeat motif | 1500ms | A |
| `sfx/stinger/player_dead` | Player loses a life | Punchy "ugh" + pitch-down hit | 600ms | **S** | Currently `hurt()`. |
| `sfx/stinger/timer_warning_10s` | Timer hits ≤ 10s (per-second) | Tense tick-tick | 100ms each | **S** | Currently `warning()`. |
| `sfx/stinger/timer_critical_3s` | Timer hits ≤ 3s | Faster, higher-pitched tick | 80ms each | A |
| `sfx/stinger/pause_open` | Entering pause | Reverb-suction whoosh | 300ms | A |
| `sfx/stinger/pause_close` | Resuming | Reverse of above | 250ms | A |

---

## 15. Panic Mode specials

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/panic/wave_start` | New wave begins | Drum hit + WAVE N callout | 1000ms | A |
| `sfx/panic/wave_clear` | Wave fully cleared | Brief celebration sting | 800ms | A |
| `sfx/panic/star_bubble_spawn` | Star bubble drops | Magical shimmer + descend | 1200ms | A |
| `sfx/panic/star_bubble_clock_pop` | Star bubble (Clock face) popped | Time-warp slowdown + held shimmer | 1500ms | A |
| `sfx/panic/star_bubble_star_pop` | Star bubble (Star face) popped | Full screen-clear explosion fanfare | 2000ms | **S** |
| `sfx/panic/rainbow_gauge_full` | Rainbow gauge overflows | Rising rainbow arpeggio | 1500ms | A |
| `sfx/panic/freeze_engage` | Universal freeze starts | Time-stop "shhhk" | 400ms | **S** |
| `sfx/panic/freeze_disengage` | Freeze ends | Time-resume "shhhk" reverse | 300ms | A |
| `sfx/panic/flashing_microball_pop` | Flashing micro-ball popped (alt path) | Crystalline tinkle + soft freeze | 500ms | A | (Subset of `pop/flourish_flashing_freeze` — choose one source.) |

---

## 16. Co-op events

| Asset ID | Trigger | Character | Length | Tier |
|---|---|---|---|---|
| `sfx/coop/p2_join` | `joinPlayer2()` | Friendly two-tone "ready" | 600ms | A |
| `sfx/coop/player_down` | A player dies but revive window opens | Pulse-warning "stay with me" | 700ms | A |
| `sfx/coop/revive_in_progress` | Living player standing over downed teammate | Building energy tone | loopable 400ms | C |
| `sfx/coop/revive_success` | Revive collision triggered | Bright resurrection arpeggio | 1000ms | A |
| `sfx/coop/revive_expired` | 10-second window ran out → death | Sad downward swell | 800ms | B |

---

## 17. World ambience beds (optional)

Each world gets a quiet looping background bed. Mix LOW (−24 LUFS or quieter). Lazy-load per world.

| Asset ID | World | Character | Length | Tier |
|---|---|---|---|---|
| `ambient/beach_loop` | Beach | Distant surf + gulls | 30s loop | B |
| `ambient/desert_loop` | Desert | Wind + tumbleweed rasp | 30s loop | B |
| `ambient/arctic_loop` | Arctic | Wind + distant ice creak | 30s loop | B |
| `ambient/city_loop` | City | Distant traffic + neon hum | 30s loop | B |
| `ambient/volcano_loop` | Volcano | Low rumble + lava bubble | 30s loop | B |
| `ambient/airship_loop` | Airship | Wind + engine drone | 30s loop | B |
| `ambient/boss_loop` | Boss arena | Cosmic dissonant pad | 30s loop | B |

---

## 18. Music

Music is the single largest perceived-quality lever after the thumbnail. Loops should be 30-60s, seamlessly loopable, with a clear melodic identity per world. Mix below SFX so action stays foreground.

| Asset ID | Where it plays | Character | Length | Tier |
|---|---|---|---|---|
| `music/menu_loop` | Main menu | Bright, hopeful, arcade-y, mid-tempo (~110-120 BPM) | 45s loop | A |
| `music/world_beach_loop` | Levels 1-4 | Upbeat surf rock / chiptune | 45s loop | A |
| `music/world_desert_loop` | Levels 5-7 | Western twang with arcade swing | 45s loop | A |
| `music/world_arctic_loop` | Levels 8-10 | Cool synth-wave with twinkles | 45s loop | A |
| `music/world_city_loop` | Levels 11-13 | Synthwave / neon | 45s loop | A |
| `music/world_volcano_loop` | Levels 14-16 | Driving rock / industrial | 45s loop | A |
| `music/world_airship_loop` | Level 17-18 | Adventure / pirates / swashbuckle | 45s loop | A |
| `music/boss_loop` | Boss fight | Big antagonist theme | 60s loop | **S** |
| `music/panic_loop` | Panic mode | Escalating intensity (multi-layered stems ideal but optional) | 60s loop | A |
| `music/boss_rush_loop` | Boss Rush | Tournament / gauntlet variant of boss theme | 60s loop | B |
| `music/victory_jingle` | Victory screen | 5-8 second resolved fanfare | 8s one-shot | A |
| `music/game_over_jingle` | Game Over screen | 4-6 second descending motif | 6s one-shot | A |
| `music/daily_intro_loop` | Daily challenge intro screen | Subtle reflective theme | 30s loop | B |

> **Music ducking:** when an explosion fires (or any S-tier impact SFX), duck music −6 dB for ~250ms then restore. Web Audio handles this with a single `GainNode` on the music bus. Worth one afternoon of implementation.

> **Adaptive Panic Mode music (Tier C):** swap to a more intense variant past wave 10. Or layer additional stems. Big ROI on retention, big production cost.

---

## 19. Mapping to existing code

For each existing procedural function in `src/systems/audio.ts`, here's the recommended replacement / augmentation:

| Current procedural fn | Replace with | Tier |
|---|---|---|
| `shoot()` | Route to `sfx/weapon/<weapon>_fire` based on the firing weapon | **S** |
| `pop(size, type)` | `sfx/pop/base_size{N}` + optional `sfx/pop/flourish_<type>` overlay | **S** |
| `split()` | `sfx/pop/split` (variant pool) | **S** |
| `comboHit(level)` | `sfx/combo/milestone_{5,10,15,20}_<name>` per level | **S** |
| `pickup()` | `sfx/pickup/<type>` keyed to the pickup that was collected | **S** |
| `shieldBreak()` | `sfx/pickup/shield_break` | **S** |
| `hurt()` | `sfx/stinger/player_dead` | **S** |
| `explode()` | `sfx/hazard/explosion_large` | **S** |
| `bossHit()` | `sfx/boss/hit_weak_point` | **S** |
| `levelClear()` | `sfx/stinger/level_clear` | **S** |
| `warning()` | `sfx/stinger/timer_warning_10s` (with `_3s` variant) + reuse for electric pre-charge | **S** |
| `menu()` | `sfx/ui/nav_move` | **S** |
| `firstPop()` | `sfx/combo/first_pop_celebration` | **S** |
| `go()` | `sfx/combo/go_beat` | **S** |
| (new) `fire(weapon)` | Dispatcher into per-weapon pool | **S** |
| (new) `bounce(size, surface)` | Per-surface bounce pool | A |
| (new) `creature(kind, event)` | Per-creature pool | A |
| (new) `music.play(track)` / `music.crossfade(track)` | Music bus | A |

### 19.1 Suggested loader shape

```ts
// systems/audio.ts (sketch)
type SfxId = string;
const buffers = new Map<SfxId, AudioBuffer>();

async function preload(ids: SfxId[]) { /* fetch + decode + cache */ }
function play(id: SfxId, opts?: { volume?: number; pitch?: number }) { /* ... */ }
function playVariant(prefix: string) { /* pick `${prefix}_01..03` round-robin */ }
```

Keep the existing procedural functions as fallbacks — if a real asset hasn't loaded yet, the procedural beep still fires. That way the game NEVER goes silent during the first 100ms of a session.

---

## 20. Recommended shipping plan

### Tier S only (minimum viable real-audio launch)

Roughly **50 sounds** covering: base pops (15) + key flourishes (5) + weapon fires (5) + special moments (~10) + UI essentials (4) + stinger essentials (~8) + creature jam (1) + boss hit (1) + warnings (2). Estimated ~250 KB total. Doesn't move the load-time needle and the game already feels twice as polished.

### Tier S + A (recommended launch target)

Adds roughly **70 more sounds** for the full weapon roster, every pickup, hazards, creatures, combo milestones, trick chips, multi-pops, medals, world music. ~1.5 MB total (with music). Lazy-load music per world; SFX preload at boot.

### Post-launch (Tier B / C)

Bounce variations, ambience beds, footsteps, boss voice taunt, expire warnings, slime squelches, adaptive Panic stems. Add based on user feedback.

---

## 21. Source recommendations

Stock libraries that have good arcade/pop libraries with permissive licensing:

- **Sonniss GameAudioGDC bundles** (free, royalty-free) — gigabytes of arcade-grade SFX yearly. Best single source for tier S.
- **Pixabay Sound Effects** — free, mixed quality, good for filler.
- **Freesound.org** — CC-licensed, sift for quality, verify license per file.
- **Soundsnap / Splice** (subscription) — for music loops.
- **Custom commission** — for the FIRST POP! celebration, boss death sequence, combo milestones, and per-world music loops. These are the moments that define perceived production value. Worth $200-500 to a freelance composer if budget permits.

---

## 22. Mixing principles (don't skip)

1. **Pops are king.** Mix everything else BELOW the pop sound. The pop is what the player is doing constantly.
2. **Bounce sounds need a cooldown.** With 30+ small balls on screen, naively playing a bounce SFX per collision is unlistenable. Hard cap to 1 per 50ms with random pitch variance.
3. **Layer, don't replace.** Pop = base pop layer + optional type flourish (−6 dB) + optional combo milestone (over the top). Don't try to make one sample do everything.
4. **Duck music under impacts.** −6 dB for 250ms on any S-tier impact. The mix breathes.
5. **Procedural fallback never goes away.** If a sample hasn't loaded, play the procedural equivalent. Silence is worse than a chiptune beep.
6. **Test on phone speakers.** Sub-bass is invisible on phones; that's where half your players live. Don't put information in frequencies below 80 Hz.
7. **Test with ads.** When `AudioSys.duckForAd()` fires, all game audio must pause cleanly. CrazyGames rejects games whose audio leaks into ad playback.

---

## 23. Quick acceptance checklist

Before considering audio "shipped":

- [ ] Every Tier-S asset above has at least one file in `public/sfx/` or `public/music/`.
- [ ] All Tier-S SFX peak under −3 dBFS.
- [ ] Pops have at least 3 variants per size and round-robin in the loader.
- [ ] Music loops are seamless (verified by loading the file in Audacity and playing across the join).
- [ ] No SFX exceeds 1.5s except explicitly designed stingers.
- [ ] On the boss level with 20+ entities active, no clicks, pops, or clipping in the mix.
- [ ] `AudioSys.duckForAd()` silences ALL audio (SFX + music + ambience).
- [ ] Mute toggle (M key) silences ALL audio.
- [ ] Reduced-motion toggle does not affect audio (it shouldn't — audio polish is independent of motion sensitivity).
- [ ] Total audio payload ≤ 4 MB.
- [ ] Game still functions identically if audio fails to load (procedural fallback).

---

## 24. Closing note

The current procedural Web Audio system is genuinely *good* for what it is. Replacing it with real samples is a force-multiplier on perceived quality — but the bar for "real samples" is high. **A bad sample is worse than a good procedural beep.** Curate ruthlessly. If a sample doesn't meaningfully beat the procedural version, ship the procedural one.

The goal isn't "have real audio." The goal is **"the player closes their eyes for five seconds and the audio alone communicates the entire arcade fantasy."** Mix toward that, not toward "every event has a file."
