import type { BallType, PickupType, ThemeName } from '../constants';
import type { HazardType } from '../entities/hazard';
import type { CreatureKind } from '../entities/creature';
import type { BossKind } from '../entities/bosses/base';

export interface LevelBallDefinition {
  x: number;
  y: number;
  size: number;
  type?: BallType;
  vx?: number;
  vy?: number;
}

export interface LevelRectDefinition {
  x: number;
  y: number;
  w: number;
  h: number;
  contains?: PickupType | null;
  blocksShots?: boolean;
  color?: string;
  vx?: number;
  minX?: number;
  maxX?: number;
}

export interface LevelPickupDefinition {
  x: number;
  y: number;
  type: PickupType;
}

export interface LevelHazardDefinition {
  type: HazardType;
  x: number;
  y: number;
  w: number;
  h: number;
  life?: number;
}

export interface LevelCrabDefinition {
  x: number;
  y?: number;
  minX?: number;
  maxX?: number;
  speed?: number;
}

export interface LevelCreatureDefinition {
  kind: CreatureKind;
  x: number;
  y?: number;
  dir?: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  theme: ThemeName;
  timeLimit: number;
  /** Per-level bronze threshold for THIS level's score (the points earned
   *  between level start and clear, bonuses included). Silver = ×1.25,
   *  gold = ×1.5 — see systems/daily.ts medalFor(). Targets are tuned so
   *  bronze rewards a clean clear and gold demands long chains + bonuses. */
  targetScore: number;
  balls: LevelBallDefinition[];
  platforms: LevelRectDefinition[];
  destructibles: LevelRectDefinition[];
  pickups: LevelPickupDefinition[];
  hazards?: LevelHazardDefinition[];
  crabs?: LevelCrabDefinition[];
  creatures?: LevelCreatureDefinition[];
  intro?: string;
  /** Touch-specific intro (falls back to `intro`). */
  introTouch?: string;
  boss?: BossKind;
  // ---- World mechanics ----
  /** Sandstorm gusts: peak sideways acceleration on balls + calm gap range. */
  wind?: { strength: number; gapMin: number; gapMax: number };
  /** Frozen floor: the player has inertia. */
  ice?: boolean;
  /** Pinball bumpers. */
  bumpers?: { x: number; y: number; r?: number }[];
  /** Updraft fans on the floor. */
  fans?: { x: number; w?: number; on?: number; off?: number; phase?: number }[];
  /** Volcanic eruptions: every `interval` seconds, `count` rocks fall. */
  eruption?: { interval: number; count: number; first?: number };
  /** Gravity multiplier (1 = normal). */
  gravity?: number;
}

// ============================ LEVEL DATA ============================
/** Levels are data objects. Each is a single-screen arena with a reason to
 *  exist: it either teaches one idea, or combines two the player already
 *  knows into a new problem. Each WORLD owns one mechanic that changes how
 *  balls (or the player) move:
 *
 *    Beach   — the fundamentals, nothing else.
 *    Desert  — sandstorm gusts push balls sideways; bomb + electric balls.
 *    Arctic  — the floor is ice; smoke, sludge and armored balls.
 *    City    — pinball bumpers kick balls and block shots; hexagons, birds.
 *    Volcano — eruptions rain telegraphed rocks; vents; lava floors.
 *    Airship — deck fans blow balls sky-high; everything at once.
 *
 *  The player always spawns at x = 480, so nothing lethal starts in that
 *  column and opening ball paths lead away from it. */
export const LEVELS = [
  // ================= WORLD 1 — BEACH =================
  {
    id: 'beach_1', name: 'Beach Day', theme: 'beach', timeLimit: 50, targetScore: 3700,
    balls: [{ x: 620, y: 200, size: 3, type: 'normal', vx: 115, vy: 0 }],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Move with A/D or the arrow keys. Shoot UP with Space.\nPop every ball to win!',
    introTouch: 'Hold the LEFT or RIGHT side to move.\nYou fire automatically — pop every ball!',
  },
  {
    id: 'beach_2', name: 'Chain Reaction', theme: 'beach', timeLimit: 55, targetScore: 8400,
    balls: [
      { x: 300, y: 180, size: 3, type: 'normal', vx: -115 },
      { x: 660, y: 180, size: 3, type: 'normal', vx: 115 }
    ],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Every pop extends your CHAIN — and your multiplier.\nKeep popping before the ring runs out!',
  },
  {
    id: 'beach_3', name: 'Sandcastles', theme: 'beach', timeLimit: 65, targetScore: 7700,
    balls: [{ x: 250, y: 160, size: 4, type: 'normal', vx: 95 }],
    platforms: [
      { x: 210, y: 350, w: 180, h: 16 },
      { x: 570, y: 350, w: 180, h: 16 },
    ],
    destructibles: [], pickups: [],
    intro: 'Platforms bounce balls and block your shots.\nCornered? DASH with Shift — you pass right through danger.',
    introTouch: 'Platforms bounce balls and block your shots.\nCornered? DOUBLE-TAP a side to DASH through danger.',
  },
  {
    id: 'beach_4', name: 'Crab Rave', theme: 'beach', timeLimit: 60, targetScore: 15200,
    balls: [
      { x: 240, y: 200, size: 3, type: 'normal', vx: -115 },
      { x: 720, y: 200, size: 3, type: 'normal', vx: 115 },
      { x: 480, y: 110, size: 2, type: 'bonus', vx: 140 }
    ],
    platforms: [{ x: 390, y: 330, w: 180, h: 16 }],
    destructibles: [], pickups: [{ x: 160, y: 420, type: 'shield' }],
    crabs: [{ x: 720, minX: 600, maxX: 900, speed: 80 }],
    intro: 'The crab pops any ball it touches — but pinches you too.\n? balls drop a weapon or power-up.',
  },

  // ================= WORLD 2 — DESERT =================
  {
    id: 'desert_1', name: 'Live Wires', theme: 'desert', timeLimit: 60, targetScore: 11300,
    balls: [
      { x: 250, y: 170, size: 3, type: 'electric', vx: 115 },
      { x: 330, y: 230, size: 2, type: 'normal', vx: 140 },
      { x: 720, y: 180, size: 3, type: 'normal', vx: -115 }
    ],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Pop an electric ball and its charge ARCS to the nearest ball.\nMind the bolt it drops — the dashed line shows where.',
  },
  {
    id: 'desert_2', name: 'Dust Devils', theme: 'desert', timeLimit: 80, targetScore: 8000,
    balls: [
      { x: 200, y: 190, size: 3, type: 'normal', vx: -115 },
      { x: 760, y: 190, size: 3, type: 'normal', vx: 115 },
      { x: 480, y: 120, size: 2, type: 'normal', vx: -140 }
    ],
    platforms: [{ x: 400, y: 340, w: 160, h: 16 }],
    destructibles: [
      { x: 230, y: 448, w: 40, h: 40, contains: 'machinegun' },
      { x: 690, y: 448, w: 40, h: 40, contains: 'shield' },
    ],
    pickups: [],
    wind: { strength: 250, gapMin: 4, gapMax: 6.5 },
    intro: 'Sandstorm! Gusts shove every ball sideways.\nThe streaks warn you which way before it blows.',
  },
  {
    id: 'desert_3', name: 'Boom Town', theme: 'desert', timeLimit: 60, targetScore: 4600,
    balls: [
      { x: 250, y: 170, size: 3, type: 'explosive', vx: 115 },
      { x: 330, y: 240, size: 2, type: 'normal', vx: 140 },
      { x: 710, y: 170, size: 3, type: 'explosive', vx: -115 },
      { x: 640, y: 240, size: 2, type: 'normal', vx: -140 }
    ],
    platforms: [{ x: 390, y: 350, w: 180, h: 16 }],
    destructibles: [],
    pickups: [{ x: 480, y: 420, type: 'double' }],
    intro: 'Shoot a bomb ball to light its fuse — everything in the ring pops.\nThe RED core is lethal. Light it, then get clear!',
  },
  {
    id: 'desert_4', name: 'Heat Wave', theme: 'desert', timeLimit: 80, targetScore: 6600,
    balls: [
      { x: 230, y: 170, size: 3, type: 'lava', vx: -115 },
      { x: 730, y: 170, size: 3, type: 'normal', vx: 115 },
      { x: 480, y: 130, size: 1, type: 'electric', vx: 165 }
    ],
    platforms: [
      { x: 190, y: 350, w: 150, h: 16 },
      { x: 620, y: 350, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'laser' }],
    pickups: [],
    wind: { strength: 180, gapMin: 6, gapMax: 9 },
    intro: 'Lava balls scorch the floor. Hot patches burn you —\nand launch any ball that lands on them much higher.',
  },
  {
    id: 'boss_globo', name: 'King Globo', theme: 'desert', timeLimit: 150, targetScore: 6400,
    balls: [], platforms: [],
    destructibles: [{ x: 120, y: 448, w: 40, h: 40, contains: 'double' }],
    pickups: [{ x: 800, y: 420, type: 'shield' }],
    boss: 'globo',
    intro: 'KING GLOBO\nBreak him and he SPLITS. Run under the bounce — never stand in the shadow.',
  },

  // ================= WORLD 3 — ARCTIC =================
  {
    id: 'arctic_1', name: 'Black Ice', theme: 'arctic', timeLimit: 65, targetScore: 8700,
    balls: [
      { x: 240, y: 180, size: 3, type: 'normal', vx: -115 },
      { x: 720, y: 180, size: 3, type: 'normal', vx: 115 }
    ],
    platforms: [{ x: 390, y: 340, w: 180, h: 16 }],
    destructibles: [], pickups: [],
    ice: true,
    intro: 'The floor is ice. You slide — brake early.\nA DASH still snaps you exactly where you point it.',
  },
  {
    id: 'arctic_2', name: 'Whiteout', theme: 'arctic', timeLimit: 70, targetScore: 7600,
    balls: [
      { x: 250, y: 170, size: 4, type: 'smoke', vx: 95 }
    ],
    platforms: [{ x: 600, y: 350, w: 180, h: 16 }],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'clearsmoke' }],
    pickups: [{ x: 160, y: 420, type: 'shotgun' }],
    ice: true,
    intro: 'Smoke balls fog the view as they travel.\nWatch the floor shadows — they never lie.',
  },
  {
    id: 'arctic_3', name: 'Glacier Slime', theme: 'arctic', timeLimit: 65, targetScore: 10600,
    balls: [
      { x: 230, y: 180, size: 3, type: 'sludge', vx: -115 },
      { x: 730, y: 180, size: 3, type: 'sludge', vx: 115 },
      { x: 480, y: 120, size: 2, type: 'normal', vx: 140 }
    ],
    platforms: [], destructibles: [],
    pickups: [{ x: 480, y: 420, type: 'machinegun' }],
    ice: true,
    intro: 'Slime is sticky: balls landing on it bounce LOW and fast.\nOn ice, it is also the only place your treads grip.',
  },
  {
    id: 'arctic_4', name: 'Iron Hail', theme: 'arctic', timeLimit: 80, targetScore: 8300,
    balls: [
      { x: 230, y: 170, size: 3, type: 'armored', vx: 115 },
      { x: 730, y: 170, size: 3, type: 'armored', vx: -115 },
      { x: 480, y: 140, size: 3, type: 'explosive', vx: -115 }
    ],
    platforms: [
      { x: 170, y: 370, w: 140, h: 16 },
      { x: 650, y: 370, w: 140, h: 16 },
    ],
    destructibles: [{ x: 110, y: 448, w: 40, h: 40, contains: 'freeze' }],
    pickups: [{ x: 820, y: 420, type: 'shield' }],
    ice: true,
    intro: 'Armored balls take TWO hits to split.\n…or one bomb ball going off beside them.',
  },

  // ================= WORLD 4 — CITY =================
  {
    id: 'city_1', name: 'Tilt!', theme: 'city', timeLimit: 70, targetScore: 8100,
    balls: [
      { x: 220, y: 150, size: 3, type: 'normal', vx: 115 },
      { x: 740, y: 150, size: 3, type: 'normal', vx: -115 }
    ],
    platforms: [], destructibles: [],
    pickups: [{ x: 130, y: 420, type: 'magnet' }],
    bumpers: [{ x: 320, y: 270 }, { x: 640, y: 270 }, { x: 480, y: 170, r: 26 }],
    intro: 'Neon City plays like pinball. Bumpers kick balls away\n— and block your shots. Read the rebound.',
  },
  {
    id: 'city_2', name: 'Neon Barriers', theme: 'city', timeLimit: 75, targetScore: 10800,
    balls: [
      { x: 240, y: 150, size: 3, type: 'electric', vx: -115 },
      { x: 720, y: 190, size: 3, type: 'armored', vx: 115 },
      { x: 480, y: 120, size: 2, type: 'bonus', vx: 140 }
    ],
    platforms: [{ x: 360, y: 330, w: 220, h: 16, vx: 70, minX: 250, maxX: 420 }],
    destructibles: [{ x: 160, y: 448, w: 40, h: 40, contains: 'freeze' }],
    pickups: [{ x: 780, y: 420, type: 'combo' }],
    // Barrier divides the arena at the right third — never in the spawn column.
    hazards: [{ type: 'electric_barrier', x: 634, y: 350, w: 12, h: 138, life: 999 }],
    bumpers: [{ x: 800, y: 230 }],
    intro: 'Electric barriers pulse on and off. Time your crossing —\nor dash straight through the gap.',
  },
  {
    id: 'city_3', name: 'Hex District', theme: 'city', timeLimit: 75, targetScore: 8000,
    balls: [
      { x: 230, y: 170, size: 3, type: 'hexagon', vx: -135 },
      { x: 730, y: 170, size: 3, type: 'hexagon', vx: 135 }
    ],
    platforms: [{ x: 400, y: 360, w: 160, h: 16 }],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'triple' }],
    pickups: [],
    bumpers: [{ x: 250, y: 290 }, { x: 710, y: 290 }],
    intro: 'Hexagons bounce on jagged, faster paths.\nDon\'t trust the rhythm — lead your shots.',
  },
  {
    id: 'city_4', name: 'Night Flight', theme: 'city', timeLimit: 85, targetScore: 10000,
    balls: [
      { x: 220, y: 170, size: 3, type: 'normal', vx: -115 },
      { x: 740, y: 170, size: 3, type: 'normal', vx: 115 },
      { x: 480, y: 130, size: 2, type: 'electric', vx: -140 }
    ],
    platforms: [
      { x: 200, y: 350, w: 150, h: 16 },
      { x: 610, y: 350, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'shield' }],
    pickups: [],
    bumpers: [{ x: 480, y: 230, r: 24 }],
    creatures: [
      { kind: 'bird', x: 200, y: 150, dir: 1 },
      { kind: 'bird', x: 760, y: 210, dir: -1 }
    ],
    intro: 'Birds jam your cannon for 3 seconds on contact.\nShoot them down first — or dodge around them.',
  },
  {
    id: 'boss_volta', name: 'VOLTA', theme: 'city', timeLimit: 170, targetScore: 12000,
    balls: [], platforms: [],
    destructibles: [],
    pickups: [{ x: 150, y: 420, type: 'shield' }],
    boss: 'volta',
    intro: 'VOLTA — THE STORM ENGINE\nYour shots bounce off its shield.\nLight its bomb balls so they burst beside it.',
  },

  // ================= WORLD 5 — VOLCANO =================
  {
    id: 'volcano_1', name: 'Vent Field', theme: 'volcano', timeLimit: 75, targetScore: 8600,
    balls: [
      { x: 230, y: 160, size: 3, type: 'lava', vx: -115 },
      { x: 730, y: 160, size: 3, type: 'smoke', vx: 115 }
    ],
    platforms: [
      { x: 140, y: 350, w: 140, h: 16 },
      { x: 680, y: 350, w: 140, h: 16 }
    ],
    destructibles: [{ x: 880, y: 448, w: 40, h: 40, contains: 'clearsmoke' }],
    pickups: [{ x: 480, y: 420, type: 'bomb' }],
    hazards: [
      { type: 'flame_vent', x: 322, y: 432, w: 36, h: 56, life: 999 },
      { type: 'flame_vent', x: 602, y: 432, w: 36, h: 56, life: 999 }
    ],
    intro: 'Flame vents glow before they flare.\nBombs clear clusters — and blow smoke away.',
  },
  {
    id: 'volcano_2', name: 'Eruption', theme: 'volcano', timeLimit: 80, targetScore: 6300,
    balls: [
      { x: 220, y: 140, size: 3, type: 'explosive', vx: -115 },
      { x: 740, y: 140, size: 3, type: 'sludge', vx: 115 },
      { x: 480, y: 130, size: 2, type: 'armored', vx: 140 }
    ],
    platforms: [{ x: 370, y: 320, w: 220, h: 16, vx: 90, minX: 240, maxX: 500 }],
    destructibles: [{ x: 840, y: 448, w: 40, h: 40, contains: 'life' }],
    pickups: [{ x: 150, y: 420, type: 'slowtime' }],
    eruption: { interval: 6.5, count: 2, first: 4 },
    intro: 'The volcano erupts every few seconds.\nRed rings on the floor show exactly where rocks will land.',
  },
  {
    id: 'volcano_3', name: 'Dragon\'s Den', theme: 'volcano', timeLimit: 75, targetScore: 10000,
    // Lava balls open near the walls heading outward, so the first bounces
    // happen far from the spawn point and the dragon's patrol.
    balls: [
      { x: 200, y: 140, size: 3, type: 'lava', vx: -115 },
      { x: 760, y: 140, size: 3, type: 'lava', vx: 115 },
      { x: 480, y: 130, size: 2, type: 'smoke', vx: -140 }
    ],
    platforms: [{ x: 390, y: 340, w: 180, h: 16 }],
    destructibles: [{ x: 110, y: 448, w: 40, h: 40, contains: 'clearsmoke' }],
    pickups: [{ x: 820, y: 420, type: 'shield' }],
    hazards: [{ type: 'flame_vent', x: 622, y: 432, w: 36, h: 56, life: 999 }],
    creatures: [{ kind: 'dragon', x: 300, dir: 1 }],
    eruption: { interval: 9, count: 1, first: 6 },
    intro: 'The green dragon pops any ball it touches.\nLet it help — or shoot it for a parting blast.',
  },
  {
    id: 'volcano_4', name: 'Ashfall', theme: 'volcano', timeLimit: 95, targetScore: 7600,
    balls: [
      { x: 230, y: 150, size: 3, type: 'armored', vx: -115 },
      { x: 730, y: 150, size: 3, type: 'armored', vx: 115 },
      { x: 480, y: 130, size: 3, type: 'explosive', vx: 115 }
    ],
    platforms: [
      { x: 150, y: 360, w: 150, h: 16 },
      { x: 660, y: 360, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'laser' }],
    pickups: [],
    hazards: [{ type: 'flame_vent', x: 362, y: 432, w: 36, h: 56, life: 999 }],
    creatures: [{ kind: 'red_bird', x: 480, y: 140, dir: 1 }],
    eruption: { interval: 7, count: 2, first: 5 },
    intro: 'The red bird always drops a power-up.\nCrack the armor with the bomb ball — and watch the sky.',
  },

  // ================= WORLD 6 — AIRSHIP =================
  {
    id: 'airship_1', name: 'Updraft', theme: 'airship', timeLimit: 100, targetScore: 17500,
    balls: [
      { x: 230, y: 150, size: 4, type: 'normal', vx: -95 },
      { x: 740, y: 150, size: 3, type: 'electric', vx: 115 }
    ],
    platforms: [
      { x: 390, y: 300, w: 180, h: 16, vx: 80, minX: 330, maxX: 450 }
    ],
    destructibles: [
      { x: 60, y: 448, w: 40, h: 40, contains: 'laser' },
      { x: 860, y: 448, w: 40, h: 40, contains: 'shuriken' }
    ],
    pickups: [{ x: 480, y: 420, type: 'shield' }],
    fans: [{ x: 170, w: 130, on: 2.4, off: 4.2, phase: 0 }, { x: 660, w: 130, on: 2.4, off: 4.2, phase: 3.3 }],
    intro: 'Deck fans blow balls sky-high — small ones most of all.\nAmber lights mean a fan is spinning up.',
  },
  {
    id: 'airship_2', name: 'Crosswinds', theme: 'airship', timeLimit: 90, targetScore: 18200,
    balls: [
      { x: 190, y: 150, size: 3, type: 'electric', vx: -115 },
      { x: 770, y: 150, size: 3, type: 'lava', vx: 115 },
      { x: 480, y: 110, size: 3, type: 'smoke', vx: 115 },
      { x: 330, y: 240, size: 2, type: 'bonus', vx: -140 }
    ],
    platforms: [
      { x: 150, y: 365, w: 150, h: 16 },
      { x: 660, y: 365, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'bomb' }],
    pickups: [{ x: 840, y: 420, type: 'freeze' }],
    fans: [{ x: 415, w: 130, on: 2.4, off: 4.6, phase: 1 }],
    wind: { strength: 200, gapMin: 6, gapMax: 9 },
    intro: 'High-altitude gusts AND a deck fan.\nThe fan clears smoke — use it.',
  },
  {
    id: 'airship_3', name: 'Skyfish Run', theme: 'airship', timeLimit: 95, targetScore: 14100,
    // Both balls open heading away from the spawn — the giant hexagon needs
    // a full wall bounce before its sweep threatens the starting position.
    balls: [
      { x: 220, y: 140, size: 4, type: 'hexagon', vx: -110 },
      { x: 740, y: 170, size: 3, type: 'normal', vx: 115 }
    ],
    platforms: [
      { x: 380, y: 300, w: 200, h: 16, vx: 80, minX: 300, maxX: 460 },
    ],
    destructibles: [{ x: 860, y: 448, w: 40, h: 40, contains: 'shotgun' }],
    pickups: [{ x: 100, y: 420, type: 'slowtime' }],
    bumpers: [{ x: 160, y: 250 }, { x: 800, y: 250 }],
    creatures: [
      { kind: 'ball_fish', x: 200, y: 180, dir: 1 },
      { kind: 'ball_fish', x: 760, y: 260, dir: -1 }
    ],
    intro: 'Ball-fish patrol the sky lanes — they jam your cannon.\nThe giant hexagon won\'t wait. Start chipping.',
  },
  {
    id: 'airship_4', name: 'Stormwall', theme: 'airship', timeLimit: 95, targetScore: 13200,
    balls: [
      { x: 190, y: 150, size: 3, type: 'electric', vx: -115 },
      { x: 770, y: 150, size: 3, type: 'armored', vx: 115 },
      { x: 480, y: 120, size: 3, type: 'explosive', vx: -115 },
      { x: 330, y: 220, size: 2, type: 'hexagon', vx: -165 },
      { x: 640, y: 230, size: 3, type: 'normal', vx: 115 }
    ],
    platforms: [
      { x: 395, y: 310, w: 170, h: 16 }
    ],
    destructibles: [{ x: 460, y: 448, w: 40, h: 40, contains: 'machinegun' }],
    pickups: [{ x: 840, y: 420, type: 'freeze' }],
    fans: [{ x: 150, w: 120, on: 2.4, off: 4.4, phase: 0 }, { x: 690, w: 120, on: 2.4, off: 4.4, phase: 3.4 }],
    creatures: [{ kind: 'bird', x: 480, y: 170, dir: -1 }],
    wind: { strength: 220, gapMin: 5.5, gapMax: 8 },
    intro: 'The last gauntlet before the Commander.\nEverything you have learned, all at once.',
  },

  // ================= FINALE =================
  {
    id: 'boss', name: 'Commander RIFT', theme: 'boss', timeLimit: 240, targetScore: 28600,
    balls: [],
    platforms: [
      { x: 80, y: 380, w: 130, h: 16 },
      { x: 750, y: 380, w: 130, h: 16 },
    ],
    destructibles: [
      { x: 460, y: 448, w: 40, h: 40, contains: 'machinegun' }
    ],
    pickups: [{ x: 200, y: 420, type: 'shield' }],
    boss: 'rift',
    intro: 'COMMANDER RIFT\nThree acts. Shoot the hull, crack the shield,\nsurvive the meltdown.',
  },
] satisfies LevelDefinition[];

/** Index remap for saves written when the Tour had 25 stages (schema 2):
 *  two boss stages were inserted after the Desert and City worlds. */
export function remapLegacyLevelIndex(i: number): number {
  if (i <= 7) return i;
  if (i <= 15) return i + 1;
  if (i <= 24) return i + 2;
  return LEVELS.length;       // "everything cleared"
}

/** Indices of the non-boss stages, in Tour order (Daily / Score Attack pool). */
export const STAGE_INDICES: number[] = LEVELS.map((l, i) => (l.boss ? -1 : i)).filter(i => i >= 0);
/** Indices of the boss stages, in Tour order (Boss Rush). */
export const BOSS_INDICES: number[] = LEVELS.map((l, i) => (l.boss ? i : -1)).filter(i => i >= 0);
