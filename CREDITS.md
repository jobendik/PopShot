# Asset Credits

## Code, art, and design

All gameplay code, procedural canvas art, and UI are original to this project.

## Fonts (`public/fonts/`)

- **Bowlby One** — © The Bowlby One Project Authors. SIL Open Font License 1.1.
- **Inter** — © The Inter Project Authors (rsms.me/inter). SIL Open Font License 1.1.

## Audio (`public/sfx/`, `public/music/`)

Sound effects and music are edited/compressed from royalty-free game-audio
libraries (source archives and WAV masters are kept outside the repo — see
`.gitignore`):

- **Sonniss GDC Game Audio Bundle** (royalty-free, commercial use permitted)
- **FilmCow Recorded / Designed SFX** (royalty-free license)
- **JDSherbert — Ultimate UI SFX Pack (Free)** (royalty-free license)
- **Kenney UI Audio** (CC0)
- **Shapeforms Audio Free Sound Effects** (royalty-free license)

### Provenance status — unresolved, read before publishing

The list above is what this file has always claimed. It has **not** been
independently verified, and the repository cannot verify it:

- There is no per-file manifest mapping each of the ~150 shipped SFX and 3
  music tracks to the library (and library edition/year) it came from. The
  source archives and WAV masters are deliberately kept outside the repo.
- No licence texts are included for any audio library.
- "Royalty-free" is not one licence. Terms differ per library and sometimes
  per edition (for example, each year's Sonniss GDC bundle ships its own
  licence, and its terms on redistribution and on use in generative/AI
  tooling should be read for the specific year used).
- The three music tracks (`public/music/*.mp3`, ~8.6 MB) have no stated
  source at all beyond the general list above.

Before a commercial release someone with access to the original archives
should (1) write that manifest, (2) add the licence texts, and (3) replace
anything that cannot be traced. Until then, treat the audio as *believed*
licensed, not *confirmed* licensed.

### Added in the systems overhaul

No new audio files were added. New sounds — the per-world pop melody, dash,
graze, PopShot, wind, rumble, fuse — are synthesised at runtime with the Web
Audio API (`src/systems/audio.ts`) and are original to this project. The
overhaul also wired up ~80 already-shipped SFX that the game previously never
played.
