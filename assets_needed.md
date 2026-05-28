# Visual Assets Needed — Bubble Breaker

A technical reference for every sprite and background asset that should replace
the current procedural canvas drawing. Written to be handed directly to an
image generator: each entry includes exact pixel dimensions, format, animation
frame counts, and a copy-pasteable prompt.

Balls, particles, shockwaves, and HUD elements stay procedural (see `onAssets.md`
for the full rationale). Everything listed here is what is currently drawn
procedurally but would benefit significantly from a real sprite.

---

## Global Style Guide

Apply this style description to **every** asset below so they form a coherent set.
Paste it as a preamble before each individual prompt.

> **Style preamble (copy into every prompt):**
> "bright modern cartoon arcade game sprite, bold flat colors with clean dark
> outlines (~2 px), subtle cel-shading with a single strong light source from
> the upper-left, no texture noise, no photorealism, no gradients in the line
> art, transparent PNG background, game-ready pixel-clean edges."

---

## 1. Player Character (P1)

**Usage:** The main playable character. Currently drawn procedurally as a
30 × 46 px explorer figure with an adventure hat, torso, legs, boots,
and a hand-held harpoon launcher.

**Sprite size:** 64 × 96 px per frame  
**Atlas layout:** horizontal strip, all frames in one row  
**Format:** PNG, transparent background  
**Required animation states (separate atlases or rows):**

| State | Frames | Notes |
|---|---|---|
| Idle | 4 | Gentle breathing bob, slight hat tilt on frames 3-4 |
| Walk | 8 | Full stride cycle, legs scissor clearly |
| Shoot | 3 | Wind-up → fire → recoil; launcher kicks back on frame 2 |
| Hit (stunned) | 4 | Stars circling head, weapon dropped; matches bird-stun in code |
| Shield | 2 | Glowing dome aura, 2-frame pulse |
| Death | 6 | Character tumbles and fades out |

**Character design notes (from current code):**
- Explorer/adventurer theme: wide-brimmed adventure hat with a small feather/pin accent
- Colour palette: royal blue body (`#3a86ff` range), dark boots, bright accent on hat
- Carries a short barrel-style harpoon launcher held at the hip
- Bold single eye, determined smirk, round face

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Adventurer hero character sprite sheet, 8 walk-cycle frames in a horizontal strip on a transparent background, 64x96 px per frame. Character wears a wide-brimmed explorer hat with a small feather pin, royal blue jacket with a diagonal chest strap, dark boots, and holds a short harpoon launcher at the hip. Round face with a single bold eye, friendly determined smirk. Clean dark outline, bright arcade colors, cel-shaded, side-view facing right. Legs clearly stride with boot definition. Bright blue color story, accent gold feather on hat.
```

---

## 2. Player Character (P2 / Co-op)

**Usage:** Second player in local co-op. Same body type as P1 but a distinct
teal/cyan colour palette so players can tell each other apart at a glance.

**Sprite size:** 64 × 96 px per frame  
**Same animation states as P1** (idle, walk, shoot, hit, shield, death)  

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Adventurer hero character sprite sheet, 8 walk-cycle frames in a horizontal strip on a transparent background, 64x96 px per frame. Same silhouette as a blue explorer hero but with a teal and cyan color scheme: teal jacket, dark teal hat, cyan accent, no feather (replaced by a small star badge). Round face with a single bold eye, friendly smirk, side-view facing right. Clearly distinguishable from a royal-blue counterpart.
```

---

## 3. Boss — "The Commander" (Flying Saucer)

**Usage:** The final-world boss. Currently a purple/pink UFO saucer with a
glowing yellow eye/weak-point at the centre. Floats near the ceiling, drifts
left and right, fires beams and spawns balls. Must have a visible weak-point
that reads as a target.

**Sprite size:** 160 × 100 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Idle / float | 4 | Gentle hover wobble, underlights pulse |
| Phase 2 (damaged) | 4 | Cracks visible, spark effects, faster throb |
| Phase 3 (critical) | 4 | Heavy damage, smoke trails, red eyes flashing |
| Death | 8 | Explosion sequence, breaks apart |
| Beam charge telegraph | 3 | Bright charge-up glow builds on the emitter |

**Design notes:** Purple lower hull, hot-pink domed top, large glowing yellow
eye in the centre (the weak point players must shoot). Retro sci-fi kitsch.
Width ~120 px, height ~80 px at idle scale.

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Retro sci-fi flying saucer boss enemy sprite, 4-frame idle animation horizontal strip, 160x100 px per frame, transparent background. Purple flattened lower hull, hot-pink domed top, glowing yellow central eye (this is the weak-point target — make it prominent and circular). Small underside windows with blue glow. Alien kitsch aesthetic, bold arcade colors. No text. The eye must be clearly distinct and centered.
```

---

## 4. Crab (Ground Enemy)

**Usage:** A small orange crab that walks the floor. Kills the player on
contact. No attack, just patrols. Currently drawn as a 34 × 18 px ellipse
body with pincer arms.

**Sprite size:** 64 × 48 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Walk | 6 | Legs scuttle side-to-side; body bobs slightly |
| Death | 4 | Flips over, legs curl up |

**Design notes:** Bright orange/red body, yellow eyes on stalks, two large
dark pincers. Reads as "hostile" at a glance.

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Orange cartoon crab enemy sprite sheet, 6-frame side-walking animation in a horizontal strip, 64x48 px per frame, transparent background. Bright orange-red rounded body, short yellow eye stalks with black dot eyes, two large dark red pincers raised slightly. Small walking legs visible underneath. Hostile arcade enemy aesthetic. Legs scuttle on alternating frames. Bold black outline.
```

---

## 5. Bird (Flying Enemy — Standard)

**Usage:** A grey bird that flies in a sine-wave path through the play area.
Stuns the player's weapon on contact (no kill). Can be shot for points.
Currently drawn as a simple grey ellipse with a yellow beak and animated
flapping wings, approximately 26 × 16 px.

**Sprite size:** 48 × 32 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Flap | 4 | Wing up → level → down → level cycle |

**Design notes:** Slate grey body, yellow beak pointing in direction of travel,
small black eye. Nuisance bird, not aggressive-looking.

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Small grey cartoon bird enemy sprite sheet, 4-frame wing-flap animation in a horizontal strip, 48x32 px per frame, transparent background. Slate grey plump rounded body, yellow triangular beak pointing right, small black eye, wings animated in an up-down cycle. Compact arcade nuisance bird, not threatening, almost cute. Bold dark outline, clean flat colors.
```

---

## 6. Red Bird (Flying Enemy — Elite)

**Usage:** Same flight pattern as the standard bird but bright pink-red and
drops a guaranteed pickup when killed. Currently `#ff4d6d` body, darker
`#9d0a32` wings.

**Sprite size:** 48 × 32 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Flap | 4 | Same as standard bird but visually distinct |

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Small bright red-pink cartoon bird enemy sprite sheet, 4-frame wing-flap animation in a horizontal strip, 48x32 px per frame, transparent background. Hot pink-red plump rounded body, yellow beak pointing right, small white eye with black pupil, dark crimson wings. Visually distinct from a grey version. A glowing aura or sparkle hint suggests it drops loot when killed. Bold dark outline.
```

---

## 7. Ball Fish (Flying Enemy — Sine Wave)

**Usage:** A round golden puffer-fish that flies in wide sine-wave arcs.
Stuns the player's weapon on contact. Wider vertical amplitude than the bird.
Currently drawn as a yellow circle (~11 px radius) with an orange side fin.

**Sprite size:** 56 × 40 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Float / swim | 4 | Fin ripples, body jiggles slightly |

**Design notes:** Golden-yellow round puffer body, orange side fin, small
black eye, surprised/dopey expression. Fish out of water.

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Round golden puffer-fish cartoon enemy sprite sheet, 4-frame idle animation in a horizontal strip, 56x40 px per frame, transparent background. Chubby round golden-yellow body with a small orange side fin pointing left, tiny dot-eyes with a surprised expression, no legs or arms. Floating fish-out-of-water aesthetic, used as a flying nuisance in an arcade game. Bold dark outline, bright yellow-orange color story.
```

---

## 8. Dragon (Friendly Floor Creature)

**Usage:** A small green dragon that walks the floor. It is friendly — it
pops any ball it touches (helpful to the player) but is non-lethal. Can be
shot for score points with a chance to drop a pickup. Currently drawn as a
green ellipse body with yellow spines, round head with a friendly smile.

**Sprite size:** 72 × 48 px per frame  
**Format:** PNG, transparent background  

| State | Frames | Notes |
|---|---|---|
| Walk | 6 | Waddles, spines bobble |
| Happy / pop | 4 | Eyes sparkle, puff of smoke from mouth after popping a ball |

**Design notes:** Bright emerald green, yellow dorsal spines, stubby tail,
friendly wide smile. The pulsing green aura in the code telegraphs
"I am friendly" — the sprite should communicate the same energy.

**Prompt:**

```
bright modern cartoon arcade game sprite, bold flat colors with clean dark outlines (~2 px), subtle cel-shading with a single strong light source from the upper-left, no texture noise, no photorealism, no gradients in the line art, transparent PNG background, game-ready pixel-clean edges.

Small friendly cartoon dragon sprite sheet, 6-frame walk cycle in a horizontal strip, 72x48 px per frame, transparent background. Bright emerald green rounded body, yellow triangular dorsal spines along the back, stubby tail, short legs, round head with a big friendly smile and wide happy eyes. Cute, non-threatening, arcade mascot energy. Facing right. Bold dark outline, bright green color story with gold spine accents.
```

---

## 9. Pickup Icons (Weapon & Power-Up Box)

**Usage:** Pickups spawn when a ball is popped. They float down, bob on the
floor, and disappear after 12 seconds. Currently drawn as a plain coloured
rounded rectangle with a letter label. There are **21 distinct pickup types**.
Replace the box + letter with a small illustrated icon that communicates the
power-up at a glance.

**Sprite size:** 32 × 32 px per icon  
**Atlas layout:** 4 columns × 6 rows (24 cells; 3 spare), single PNG atlas  
**Format:** PNG, transparent background  

### Icon list and individual prompts

For each icon, the full style preamble applies. Each should be designed so
the icons look like a set (same line weight, same shading style, same icon
frame/background shape if desired — e.g., a rounded square badge).

---

#### 9.1 Shield
*Colour hint: blue `#3a86ff`*

```
32x32 px transparent PNG game icon. Bright blue kite-shaped shield with a glowing blue rim and a small star in the centre. Arcade pickup icon style: bold dark outline, flat cel-shaded, clean transparent background. No text.
```

---

#### 9.2 Harpoon (basic weapon)
*Colour hint: warm cream `#ffe9a8`*

```
32x32 px transparent PNG game icon. A single golden harpoon arrow pointing straight up, with a thin trailing cable dangling below the tip. Arcade pickup icon style: bold dark outline, flat cel-shaded, cream and gold colors, clean transparent background. No text.
```

---

#### 9.3 Double Harpoon
*Colour hint: teal `#06d6a0`*

```
32x32 px transparent PNG game icon. Two teal harpoon arrows pointing upward side by side, with matching cables. Arcade pickup icon style: bold dark outline, flat cel-shaded, teal and gold colors, clean transparent background. No text.
```

---

#### 9.4 Triple Harpoon
*Colour hint: sky blue `#9be7ff`*

```
32x32 px transparent PNG game icon. Three light-blue harpoon arrows fanned upward in a slight spread, with cables. Arcade pickup icon style: bold dark outline, flat cel-shaded, sky blue and white colors, clean transparent background. No text.
```

---

#### 9.5 Power Wire (Grapple)
*Colour hint: sky blue `#9be7ff`*

```
32x32 px transparent PNG game icon. A blue electrified wire with a glowing anchor hook at the top and a crackle of electricity along its length. Arcade pickup icon style: bold dark outline, flat cel-shaded, cyan and white colors, clean transparent background. No text.
```

---

#### 9.6 Diagonal Shot
*Colour hint: gold `#ffd60a`*

```
32x32 px transparent PNG game icon. Two golden harpoon bolts crossed in an X shape, pointing up-left and up-right diagonally. Arcade pickup icon style: bold dark outline, flat cel-shaded, bright gold colors, clean transparent background. No text.
```

---

#### 9.7 Machine Gun
*Colour hint: orange `#fb5607`*

```
32x32 px transparent PNG game icon. A small orange cartoon machine gun or rapid-fire pistol viewed from the side, with motion lines indicating fast fire. Arcade pickup icon style: bold dark outline, flat cel-shaded, orange and dark grey colors, clean transparent background. No text.
```

---

#### 9.8 Laser
*Colour hint: hot pink `#ff36c4`*

```
32x32 px transparent PNG game icon. A hot-pink laser beam firing straight upward from a small gun barrel, with a bright glow bloom at the tip. Arcade pickup icon style: bold dark outline, flat cel-shaded, magenta and white colors, clean transparent background. No text.
```

---

#### 9.9 Flamethrower
*Colour hint: orange `#ff7733`*

```
32x32 px transparent PNG game icon. A small orange flamethrower nozzle with a stylised flame burst shooting upward, yellow core with orange-red edges. Arcade pickup icon style: bold dark outline, flat cel-shaded, orange and yellow fire colors, clean transparent background. No text.
```

---

#### 9.10 Shotgun
*Colour hint: amber `#ffbe0b`*

```
32x32 px transparent PNG game icon. A wide-mouth shotgun barrel viewed from the side, with a spread of 5 small pellet dots fanning upward from the muzzle. Arcade pickup icon style: bold dark outline, flat cel-shaded, amber and dark grey colors, clean transparent background. No text.
```

---

#### 9.11 Shuriken
*Colour hint: silver `#dfe6ee`*

```
32x32 px transparent PNG game icon. A silver four-pointed shuriken (throwing star) with a slight motion-spin blur on the tips. Arcade pickup icon style: bold dark outline, flat cel-shaded, steel silver and dark outline, clean transparent background. No text.
```

---

#### 9.12 Bomb
*Colour hint: dark navy `#2b2d42`*

```
32x32 px transparent PNG game icon. A classic round black cartoon bomb with a lit amber fuse and a small orange spark at the tip. Arcade pickup icon style: bold dark outline, flat cel-shaded, black body with amber fuse, clean transparent background. No text.
```

---

#### 9.13 Score Bag
*Colour hint: gold `#ffd60a`*

```
32x32 px transparent PNG game icon. A small golden coin bag or treasure sack with a dollar/star symbol on the front and a golden glow aura. Arcade pickup icon style: bold dark outline, flat cel-shaded, bright gold and white colors, clean transparent background. No text.
```

---

#### 9.14 Extra Life (1-UP)
*Colour hint: red `#ff4d6d`*

```
32x32 px transparent PNG game icon. A bright red heart with a small "1UP" embossed or floating above it, glowing pink rim. Arcade pickup icon style: bold dark outline, flat cel-shaded, red and pink colors, clean transparent background. No text.
```

---

#### 9.15 Time Extension
*Colour hint: cyan `#56cbf9`*

```
32x32 px transparent PNG game icon. A small blue clock face with a green plus arrow circling it, indicating added time. Arcade pickup icon style: bold dark outline, flat cel-shaded, cyan and white colors, clean transparent background. No text.
```

---

#### 9.16 Slow Time
*Colour hint: purple `#a06cd5`*

```
32x32 px transparent PNG game icon. A purple hourglass with swirling sand and a small crescent moon beside it, suggesting slowed time. Arcade pickup icon style: bold dark outline, flat cel-shaded, violet and white colors, clean transparent background. No text.
```

---

#### 9.17 Freeze
*Colour hint: ice blue `#9be7ff`*

```
32x32 px transparent PNG game icon. A light blue snowflake with a crystalline star shape and a faint icy glow. Arcade pickup icon style: bold dark outline, flat cel-shaded, ice blue and white colors, clean transparent background. No text.
```

---

#### 9.18 Clear Smoke
*Colour hint: light grey `#cfd6df`*

```
32x32 px transparent PNG game icon. A small fan or wind symbol blowing away a puff of grey smoke, leaving clear air. Arcade pickup icon style: bold dark outline, flat cel-shaded, light grey and white colors, clean transparent background. No text.
```

---

#### 9.19 Magnet
*Colour hint: pink `#f72585`*

```
32x32 px transparent PNG game icon. A classic horseshoe magnet in bright pink/red with yellow tips and small arc lines showing magnetic pull. Arcade pickup icon style: bold dark outline, flat cel-shaded, magenta and yellow colors, clean transparent background. No text.
```

---

#### 9.20 Combo Boost
*Colour hint: hot pink `#ff36c4`*

```
32x32 px transparent PNG game icon. A glowing pink lightning bolt with a small "x" multiplier symbol beside it and a radial star burst, suggesting a score multiplier. Arcade pickup icon style: bold dark outline, flat cel-shaded, hot pink and white colors, clean transparent background. No text.
```

---

#### 9.21 Dynamite
*Colour hint: red-orange `#ff5400`*

```
32x32 px transparent PNG game icon. A bundle of three red dynamite sticks tied together with a lit fuse, small sparks at the fuse tip. Arcade pickup icon style: bold dark outline, flat cel-shaded, red and orange colors, clean transparent background. No text.
```

---

## 10. Background Layers — Beach Biome

**Usage:** Parallax backdrop for the first world. The canvas is 960 × 540 px
(logical). Backgrounds are rendered behind all gameplay and the floor. The
current procedural version draws a sky gradient, two tropical island
silhouettes, a sea band with wave layers, and a sandy beach floor.

**Deliver as three separate transparent-background PNG layers** (parallax system):
1. `bg_beach_far.png` — 960 × 540 px — sky, sun, distant islands, seabirds
2. `bg_beach_mid.png` — 960 × 540 px — sea band with waves and foam line
3. `bg_beach_near.png` — 960 × 540 px — sandy shore details, wet sand

**Prompt (far layer):**

```
960x540 px 2D cartoon arcade game background layer, transparent background, bright modern style, no UI, no characters, no balls. Far parallax layer for a tropical beach level. Warm golden sky with a large sun in the upper-right, faint horizon haze. Two silhouetted tropical islands in the distance with palm tree crowns visible. Three or four tiny stylised seabirds (simple M-shapes) in the far sky. Very low saturation on the islands — muted teal/blue silhouettes. Leaves bottom 180 px fully transparent for gameplay floor. Wide-angle, horizontal composition.
```

**Prompt (mid layer):**

```
960x540 px 2D cartoon arcade game background layer, transparent background, bright modern style, no UI, no characters, no balls. Mid parallax layer for a tropical beach level. A horizontal sea band across the middle of the image (roughly y=393 to y=428): deep teal at the top blending to bright turquoise at the shore, with three sine-wave foam lines and short white wave crests. A column of sun reflection shimmer under the sun position (right side). Wet sand line at the bottom of the sea band. Fully transparent above and below the sea band. Wide 960 px, exact horizontal strip.
```

**Prompt (near layer):**

```
960x540 px 2D cartoon arcade game background layer, transparent background, bright modern style, no UI, no characters, no balls. Near parallax layer for a tropical beach level. Sandy beach floor strip occupying the bottom 120 px: warm golden sand texture (stylised flat cartoon, no photorealism), small shells and pebbles scattered, footprint details. Fully transparent above the sand. Wide 960 px composition.
```

---

## 11. Background Layers — Desert Biome

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for a desert level. Burnt orange sky gradient, large half-submerged sun at the horizon casting heat haze shimmer. Five flat-top mesa silhouettes at varied heights in muted rust-brown. A few distant dust-mote drifts (small translucent dots). Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for a desert level. Sand dune curve crossing the lower third of the image in warm tan/sienna, two dune layers at different distances with subtle shading. Four cactus silhouettes in dark brown-ochre at the dune base. Transparent above and below the dune band. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for a desert level. Desert floor strip at the bottom 100 px: cracked dry earth texture (flat cartoon style, bold cracks), small rocks and sand ripples. Fully transparent above. Wide 960 px.
```

---

## 12. Background Layers — Arctic Biome

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for an arctic night level. Deep navy sky with a soft aurora borealis (green and violet curtain bands, low opacity) across the upper sky. Distant mountain silhouettes in desaturated dark blue. Small star field. Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for an arctic level. Snow-capped mountain peaks in blue-grey with bright white snow caps and pale blue shadow faces. Eight pine tree silhouettes in very dark navy at the mountain base. Transparent above and below the mountain band. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for an arctic level. Snow floor strip at the bottom 100 px: flat cartoon snow with soft blue shadows, small ice crystals and a few snow drifts. Fully transparent above. Wide 960 px.
```

---

## 13. Background Layers — City / Night Biome

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for a night city level. Dark navy sky, faint city glow on the horizon. Distant small building silhouettes in very dark blue, sparse dim amber window dots. Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for a night city level. Row of twelve tall dark buildings with window grids: most windows unlit (dark navy), one-third lit with warm amber/yellow glow, a few blinking neon signs in pink and teal. Neon haze above the skyline. Buildings fill the mid and upper areas; transparent below 40% of image height. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for a night city level. Urban pavement floor strip at the bottom 100 px: grey asphalt with neon reflections, a white dashed road line, small manhole cover. Fully transparent above. Wide 960 px.
```

---

## 14. Background Layers — Volcano Biome

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for a volcano level. Dark crimson-maroon sky with a rising ash plume (dark grey puffball clouds) near the left. Far volcanic ridge silhouettes in very dark brown-red. Glowing lava-red horizon line. Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for a volcano level. A large dark volcano cone occupying the left third: steep pointed peak, glowing orange-yellow lava crater at the top, two bright orange lava streams trickling down the flanks. Lava glow pools at the base. Transparent elsewhere except the volcano shape. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for a volcano level. Volcanic rock floor strip at the bottom 100 px: dark basalt with orange lava cracks running through it, glowing ember dots. Flat cartoon style, bold crack lines. Fully transparent above. Wide 960 px.
```

---

## 15. Background Layers — Airship Biome

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for a high-altitude airship level. Bright blue sky fading to deep cerulean at the top, golden-hour horizon glow at the bottom. Fluffy white cloud puffs at several depths (far clouds are small and pale). A small distant airship silhouette drifting across the upper area. Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for an airship level. A large vintage airship balloon occupying the centre: elongated brown-tan envelope with a gondola hanging beneath connected by ropes and rigging. The balloon has a subtle highlight stripe and a few decorative rivets. Transparent elsewhere. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for an airship level. Wooden airship deck floor strip at the bottom 100 px: planks with visible grain (flat cartoon, not photorealistic), brass rivets at the edges, a rope coil detail. Fully transparent above. Wide 960 px.
```

---

## 16. Background Layers — Boss World (Cosmic)

**Format:** 3 layers at 960 × 540 px each, transparent background

**Prompt (far):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Far parallax layer for a final boss cosmic level. Deep space background: very dark purple-black, sparse star field with varied star sizes, a soft magenta/pink nebula glow in the upper-centre radiating outward. Five faint concentric glowing pink rings expanding from the centre (suggests cosmic portal). Low overall brightness. Fully transparent bottom 180 px. Wide horizontal composition.
```

**Prompt (mid):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Mid parallax layer for a cosmic boss level. Two or three floating dark asteroid silhouettes with faint purple rim light. Sparse glowing particles drifting. Transparent elsewhere. Wide 960 px.
```

**Prompt (near):**

```
960x540 px 2D cartoon arcade game background layer, transparent background. Near parallax layer for a cosmic boss level. Dark alien platform floor strip at the bottom 100 px: dark obsidian/purple stone tiles with glowing pink cracks, small crystal formations. Fully transparent above. Wide 960 px.
```

---

## Summary Table

| # | Asset | Frames / Images | Size per frame |
|---|---|---|---|
| 1 | Player P1 — 6 animation states | ~33 frames total | 64 × 96 px |
| 2 | Player P2 — 6 animation states | ~33 frames total | 64 × 96 px |
| 3 | Boss — 5 animation states | ~19 frames total | 160 × 100 px |
| 4 | Crab — walk + death | 10 frames | 64 × 48 px |
| 5 | Bird — flap | 4 frames | 48 × 32 px |
| 6 | Red Bird — flap | 4 frames | 48 × 32 px |
| 7 | Ball Fish — float | 4 frames | 56 × 40 px |
| 8 | Dragon — walk + happy | 10 frames | 72 × 48 px |
| 9 | Pickup icons — 21 types | 21 icons | 32 × 32 px |
| 10–16 | Backgrounds — 7 biomes × 3 layers | 21 images | 960 × 540 px |

**Total sprite frames:** ~118 character/enemy frames  
**Total icons:** 21  
**Total background images:** 21  

---

## Generation Workflow Recommendation

1. Generate all pickup icons first (smallest, fastest to iterate, set the
   colour language for the whole game).
2. Generate P1 idle pose and get the silhouette / hat / colour story right.
   This becomes the reference for all other character work.
3. Use the accepted P1 idle as a reference image (`--cref` in Midjourney,
   or `image weight` in SDXL) when generating P1's other animation states.
4. Generate P2 and enemies using P1 as style anchor.
5. Generate background far layers for all biomes first (they set the mood),
   then mid and near.
6. Once all images are exported as transparent PNGs, pack character frames
   into atlases using TexturePacker (free tier) and export a JSON manifest.
   Background layers can stay as individual PNGs.
