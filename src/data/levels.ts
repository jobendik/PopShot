import type { BallType, PickupType, ThemeName } from '../constants';
import type { HazardType } from '../entities/hazard';
import type { CreatureKind } from '../entities/creature';

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
   *  bronze rewards a clean clear and gold demands combos + clear bonuses. */
  targetScore: number;
  balls: LevelBallDefinition[];
  platforms: LevelRectDefinition[];
  destructibles: LevelRectDefinition[];
  pickups: LevelPickupDefinition[];
  hazards?: LevelHazardDefinition[];
  crabs?: LevelCrabDefinition[];
  creatures?: LevelCreatureDefinition[];
  intro?: string;
  boss?: boolean;
}

// ============================ LEVEL DATA ============================
/** Levels are data objects. Each is a single-screen puzzle.
 *  The LevelManager (inside Game) instantiates entities from these. */
export const LEVELS = [
  // WORLD 1 - BEACH
  {
    id: 'beach_1', name: 'Beach Day', theme: 'beach', timeLimit: 50, targetScore: 2000,
    balls: [{ x: 480, y: 200, size: 3, type: 'normal', vx: 120, vy: 0 }],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Move with A/D. Shoot UP with Space.\nPop every ball to win!'
  },
  {
    id: 'beach_2', name: 'Sunny Splits', theme: 'beach', timeLimit: 55, targetScore: 3200,
    balls: [
      { x: 320, y: 180, size: 3, type: 'normal' },
      { x: 640, y: 180, size: 3, type: 'normal' }
    ],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Big balls split into smaller, faster ones.\nKeep popping until they\'re gone.'
  },
  {
    id: 'beach_3', name: 'Sandcastles', theme: 'beach', timeLimit: 60, targetScore: 3400,
    balls: [{ x: 480, y: 200, size: 4, type: 'normal' }],
    platforms: [
      { x: 250, y: 360, w: 200, h: 16 },
      { x: 510, y: 360, w: 200, h: 16 },
    ],
    destructibles: [], pickups: [],
    intro: 'Platforms bounce balls and block your shots.'
  },
  {
    id: 'beach_4', name: 'Surf\'s Up', theme: 'beach', timeLimit: 55, targetScore: 4000,
    balls: [
      { x: 300, y: 200, size: 3, type: 'normal' },
      { x: 660, y: 200, size: 3, type: 'normal' },
      { x: 480, y: 100, size: 2, type: 'bonus' }
    ],
    platforms: [{ x: 380, y: 380, w: 200, h: 16 }],
    destructibles: [], pickups: [{ x: 200, y: 420, type: 'shield' }],
    intro: 'Yellow ? balls drop weapons or items.\nShields take one hit for you.'
  },

  // WORLD 2 - DESERT
  {
    id: 'desert_1', name: 'Crackling Dunes', theme: 'desert', timeLimit: 60, targetScore: 3400,
    balls: [
      { x: 320, y: 180, size: 3, type: 'normal' },
      { x: 640, y: 180, size: 3, type: 'electric' }
    ],
    platforms: [], destructibles: [], pickups: [],
    intro: 'Electric balls discharge downward bolts.\nWatch the warning flash!'
  },
  {
    id: 'desert_2', name: 'Crate Caravan', theme: 'desert', timeLimit: 60, targetScore: 3600,
    balls: [
      { x: 200, y: 200, size: 3, type: 'normal' },
      { x: 760, y: 200, size: 3, type: 'normal' }
    ],
    platforms: [{ x: 400, y: 380, w: 160, h: 16 }],
    destructibles: [
      { x: 240, y: 432, w: 40, h: 40, contains: 'machinegun' },
      { x: 680, y: 432, w: 40, h: 40, contains: 'shield' },
    ],
    pickups: [],
    intro: 'Crates break to drop pickups.\nUse them when balls cluster!'
  },
  {
    id: 'desert_3', name: 'Boom Town', theme: 'desert', timeLimit: 55, targetScore: 3000,
    balls: [
      { x: 240, y: 180, size: 3, type: 'explosive' },
      { x: 720, y: 180, size: 3, type: 'explosive' }
    ],
    platforms: [{ x: 380, y: 360, w: 200, h: 16 }],
    destructibles: [],
    pickups: [{ x: 480, y: 420, type: 'double' }],
    intro: 'Hit explosive balls to start their fuse.\nChain reactions = big score!'
  },
  {
    id: 'desert_4', name: 'Heat Wave', theme: 'desert', timeLimit: 60, targetScore: 4200,
    balls: [
      { x: 320, y: 180, size: 3, type: 'lava' },
      { x: 640, y: 180, size: 3, type: 'normal' },
      { x: 480, y: 220, size: 2, type: 'electric' }
    ],
    platforms: [
      { x: 200, y: 360, w: 150, h: 16 },
      { x: 610, y: 360, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'laser' }],
    pickups: [],
    intro: 'Lava balls leave hot patches on the floor.\nKeep moving!'
  },

  // WORLD 3 - ARCTIC
  {
    id: 'arctic_1', name: 'Frostfall', theme: 'arctic', timeLimit: 60, targetScore: 3400,
    balls: [
      { x: 480, y: 180, size: 4, type: 'smoke' }
    ],
    platforms: [{ x: 380, y: 360, w: 200, h: 16 }],
    destructibles: [],
    pickups: [{ x: 200, y: 420, type: 'shotgun' }],
    intro: 'Smoke balls fog the view.\nStay calm. Listen for bounces.'
  },
  {
    id: 'arctic_2', name: 'Glacier Slime', theme: 'arctic', timeLimit: 55, targetScore: 3400,
    balls: [
      { x: 280, y: 180, size: 3, type: 'sludge' },
      { x: 680, y: 180, size: 3, type: 'sludge' }
    ],
    platforms: [], destructibles: [],
    pickups: [{ x: 480, y: 420, type: 'machinegun' }],
    intro: 'Sludge leaves slowing slime.\nDon\'t get stuck!'
  },
  {
    id: 'arctic_3', name: 'Iron Hail', theme: 'arctic', timeLimit: 70, targetScore: 4200,
    balls: [
      { x: 320, y: 180, size: 3, type: 'armored' },
      { x: 640, y: 180, size: 3, type: 'armored' },
      { x: 480, y: 240, size: 2, type: 'normal' }
    ],
    platforms: [{ x: 380, y: 380, w: 200, h: 16 }],
    destructibles: [
      { x: 200, y: 432, w: 40, h: 40, contains: 'flame' },
      { x: 720, y: 432, w: 40, h: 40, contains: 'shield' }
    ],
    pickups: [],
    intro: 'Armored balls need TWO hits before splitting.'
  },
  {
    id: 'arctic_4', name: 'Storm Front', theme: 'arctic', timeLimit: 60, targetScore: 5200,
    balls: [
      { x: 200, y: 160, size: 3, type: 'electric' },
      { x: 760, y: 160, size: 3, type: 'electric' },
      { x: 480, y: 240, size: 3, type: 'explosive' },
      { x: 480, y: 100, size: 1, type: 'bonus' }
    ],
    platforms: [
      { x: 160, y: 380, w: 140, h: 16 },
      { x: 660, y: 380, w: 140, h: 16 },
      { x: 410, y: 290, w: 140, h: 16 },
    ],
    destructibles: [],
    pickups: [{ x: 480, y: 420, type: 'shield' }],
    intro: 'Everything at once. Stay sharp!'
  },

  // WORLD 4 - CITY
  {
    id: 'city_1', name: 'Rooftop Patrol', theme: 'city', timeLimit: 65, targetScore: 3400,
    balls: [
      { x: 250, y: 180, size: 3, type: 'normal' },
      { x: 710, y: 160, size: 3, type: 'bonus' }
    ],
    platforms: [
      { x: 230, y: 340, w: 160, h: 16 },
      { x: 570, y: 340, w: 160, h: 16 },
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'shuriken' }],
    pickups: [{ x: 120, y: 420, type: 'magnet' }],
    // Crab patrols the right flank — its range never crosses the player
    // spawn at W/2 = 480, so an idle player is threatened by balls only.
    crabs: [{ x: 640, minX: 520, maxX: 800, speed: 84 }],
    intro: 'Neutral helpers can pop balls, but touching them still hurts.'
  },
  {
    id: 'city_2', name: 'Neon Barriers', theme: 'city', timeLimit: 70, targetScore: 4200,
    balls: [
      { x: 260, y: 150, size: 3, type: 'electric' },
      { x: 700, y: 190, size: 3, type: 'armored' },
      { x: 480, y: 130, size: 2, type: 'bonus' }
    ],
    platforms: [{ x: 360, y: 330, w: 240, h: 16, vx: 70, minX: 280, maxX: 440 }],
    destructibles: [{ x: 180, y: 432, w: 40, h: 40, contains: 'freeze' }],
    pickups: [{ x: 760, y: 420, type: 'combo' }],
    // Barrier divides the arena at the right third — NOT at x≈474, which is
    // the player spawn column (W/2 = 480) and used to electrocute the player
    // where they stood. The combo pickup beyond it is the reason to cross.
    hazards: [{ type: 'electric_barrier', x: 614, y: 350, w: 12, h: 138, life: 999 }],
    intro: 'Electric barriers pulse on and off. Time your dodge.'
  },
  {
    id: 'city_3', name: 'Hex District', theme: 'city', timeLimit: 70, targetScore: 3600,
    balls: [
      { x: 300, y: 170, size: 3, type: 'hexagon' },
      { x: 660, y: 170, size: 3, type: 'hexagon' }
    ],
    platforms: [{ x: 390, y: 350, w: 180, h: 16 }],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'triple' }],
    pickups: [],
    intro: 'Hexagons bounce on jagged, faster paths.\nDon\'t trust the rhythm — lead your shots.'
  },
  {
    id: 'city_4', name: 'Night Flight', theme: 'city', timeLimit: 70, targetScore: 4400,
    balls: [
      { x: 240, y: 170, size: 3, type: 'normal' },
      { x: 720, y: 170, size: 3, type: 'normal' },
      { x: 480, y: 140, size: 2, type: 'electric' }
    ],
    platforms: [
      { x: 230, y: 340, w: 160, h: 16 },
      { x: 570, y: 340, w: 160, h: 16 },
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'shield' }],
    pickups: [],
    creatures: [
      { kind: 'bird', x: 200, y: 150, dir: 1 },
      { kind: 'bird', x: 760, y: 210, dir: -1 }
    ],
    intro: 'Birds jam your cannon for 3 seconds on contact.\nShoot them down first — or dodge around them.'
  },

  // WORLD 5 - VOLCANO
  {
    id: 'volcano_1', name: 'Vent Field', theme: 'volcano', timeLimit: 70, targetScore: 3400,
    balls: [
      { x: 260, y: 160, size: 3, type: 'lava' },
      { x: 700, y: 160, size: 3, type: 'smoke' }
    ],
    platforms: [
      { x: 150, y: 355, w: 140, h: 16 },
      { x: 670, y: 355, w: 140, h: 16 }
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'clearsmoke' }],
    pickups: [{ x: 480, y: 420, type: 'bomb' }],
    hazards: [
      { type: 'flame_vent', x: 330, y: 432, w: 36, h: 56, life: 999 },
      { type: 'flame_vent', x: 594, y: 432, w: 36, h: 56, life: 999 }
    ],
    intro: 'Flame vents telegraph before they flare. Bombs clear clusters.'
  },
  {
    id: 'volcano_2', name: 'Falling Stone', theme: 'volcano', timeLimit: 75, targetScore: 4200,
    balls: [
      { x: 220, y: 130, size: 3, type: 'explosive' },
      { x: 740, y: 130, size: 3, type: 'sludge' },
      { x: 480, y: 200, size: 2, type: 'armored' }
    ],
    platforms: [{ x: 370, y: 320, w: 220, h: 16, vx: 90, minX: 260, maxX: 480 }],
    destructibles: [{ x: 720, y: 432, w: 40, h: 40, contains: 'life' }],
    pickups: [{ x: 200, y: 420, type: 'slowtime' }],
    hazards: [
      { type: 'falling_rock', x: 180, y: 70, w: 30, h: 30, life: 9 },
      { type: 'falling_rock', x: 760, y: 95, w: 30, h: 30, life: 9 }
    ],
    intro: 'Falling rocks hurt, then crumble. Watch the ceiling.'
  },
  {
    id: 'volcano_3', name: 'Dragon\'s Den', theme: 'volcano', timeLimit: 70, targetScore: 4400,
    // Lava balls open near the walls heading outward, so the first bounces
    // happen far from the spawn point and the dragon's patrol.
    balls: [
      { x: 200, y: 140, size: 3, type: 'lava', vx: -95 },
      { x: 760, y: 140, size: 3, type: 'lava', vx: 95 },
      { x: 480, y: 200, size: 2, type: 'smoke' }
    ],
    platforms: [{ x: 390, y: 340, w: 180, h: 16 }],
    destructibles: [{ x: 200, y: 432, w: 40, h: 40, contains: 'clearsmoke' }],
    pickups: [{ x: 760, y: 420, type: 'shield' }],
    // Vent sits right of center — NEVER under the player spawn (W/2 = 480).
    hazards: [{ type: 'flame_vent', x: 602, y: 432, w: 36, h: 56, life: 999 }],
    creatures: [{ kind: 'dragon', x: 300, dir: 1 }],
    intro: 'The green dragon pops any ball it touches.\nLet it help — or shoot it for a parting blast.'
  },
  {
    id: 'volcano_4', name: 'Ashfall', theme: 'volcano', timeLimit: 75, targetScore: 4800,
    balls: [
      { x: 240, y: 150, size: 3, type: 'armored' },
      { x: 720, y: 150, size: 3, type: 'armored' },
      { x: 480, y: 210, size: 2, type: 'explosive' }
    ],
    platforms: [
      { x: 160, y: 360, w: 150, h: 16 },
      { x: 650, y: 360, w: 150, h: 16 },
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'laser' }],
    pickups: [],
    hazards: [
      { type: 'falling_rock', x: 300, y: 80, w: 30, h: 30, life: 9 },
      { type: 'falling_rock', x: 640, y: 95, w: 30, h: 30, life: 9 }
    ],
    creatures: [{ kind: 'red_bird', x: 480, y: 140, dir: 1 }],
    intro: 'The red bird always drops a power-up.\nArmored balls still take two hits each.'
  },

  // WORLD 6 - AIRSHIP
  {
    id: 'airship_1', name: 'Deck Crossfire', theme: 'airship', timeLimit: 80, targetScore: 4800,
    balls: [
      { x: 260, y: 150, size: 4, type: 'normal' },
      { x: 700, y: 150, size: 3, type: 'electric' }
    ],
    platforms: [
      { x: 170, y: 360, w: 160, h: 16, blocksShots: false, color: '#8d6e63' },
      { x: 630, y: 360, w: 160, h: 16, blocksShots: false, color: '#8d6e63' },
      { x: 380, y: 290, w: 200, h: 16, vx: 80, minX: 320, maxX: 440 }
    ],
    destructibles: [
      { x: 260, y: 432, w: 40, h: 40, contains: 'laser' },
      { x: 660, y: 432, w: 40, h: 40, contains: 'shuriken' }
    ],
    pickups: [{ x: 480, y: 420, type: 'shield' }],
    crabs: [{ x: 180, minX: 100, maxX: 300, speed: 70 }, { x: 780, minX: 660, maxX: 860, speed: -70 }],
    intro: 'Some decks do not block shots. Use the moving platform.'
  },
  {
    id: 'airship_2', name: 'Final Approach', theme: 'airship', timeLimit: 85, targetScore: 5600,
    balls: [
      { x: 190, y: 150, size: 3, type: 'electric' },
      { x: 770, y: 150, size: 3, type: 'lava' },
      { x: 480, y: 110, size: 3, type: 'smoke' },
      { x: 480, y: 240, size: 2, type: 'bonus' }
    ],
    platforms: [
      { x: 150, y: 365, w: 150, h: 16 },
      { x: 660, y: 365, w: 150, h: 16 },
      { x: 395, y: 300, w: 170, h: 16 }
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'bomb' }],
    pickups: [{ x: 780, y: 420, type: 'freeze' }],
    // Off-center for the same reason as city_2: x≈474 is the spawn column.
    hazards: [{ type: 'electric_barrier', x: 330, y: 330, w: 12, h: 158, life: 999 }],
    intro: 'Smoke, sparks, and a barrier line.\nClear the smoke, freeze, then strike.'
  },
  {
    id: 'airship_3', name: 'Skyfish Run', theme: 'airship', timeLimit: 80, targetScore: 5000,
    // Both balls open heading away from the spawn — the giant hexagon needs
    // a full wall bounce before its sweep threatens the starting position.
    balls: [
      { x: 220, y: 140, size: 4, type: 'hexagon', vx: -110 },
      { x: 740, y: 170, size: 3, type: 'normal', vx: 100 }
    ],
    platforms: [
      { x: 380, y: 300, w: 200, h: 16, vx: 80, minX: 300, maxX: 460 },
      { x: 150, y: 380, w: 140, h: 16 }
    ],
    destructibles: [{ x: 660, y: 432, w: 40, h: 40, contains: 'shotgun' }],
    pickups: [{ x: 120, y: 420, type: 'slowtime' }],
    creatures: [
      { kind: 'ball_fish', x: 200, y: 180, dir: 1 },
      { kind: 'ball_fish', x: 760, y: 260, dir: -1 }
    ],
    intro: 'Ball-fish patrol the sky lanes — they jam your cannon.\nThe giant hexagon won\'t wait. Start chipping.'
  },
  {
    id: 'airship_4', name: 'Stormwall', theme: 'airship', timeLimit: 85, targetScore: 5200,
    balls: [
      { x: 190, y: 150, size: 3, type: 'electric' },
      { x: 770, y: 150, size: 3, type: 'armored' },
      { x: 480, y: 120, size: 2, type: 'hexagon' },
      { x: 340, y: 220, size: 2, type: 'smoke' }
    ],
    platforms: [
      { x: 150, y: 365, w: 150, h: 16 },
      { x: 660, y: 365, w: 150, h: 16 },
      { x: 395, y: 295, w: 170, h: 16 }
    ],
    destructibles: [{ x: 460, y: 432, w: 40, h: 40, contains: 'bomb' }],
    pickups: [{ x: 780, y: 420, type: 'freeze' }],
    hazards: [
      { type: 'falling_rock', x: 250, y: 75, w: 30, h: 30, life: 9 },
      { type: 'falling_rock', x: 700, y: 90, w: 30, h: 30, life: 9 }
    ],
    creatures: [{ kind: 'bird', x: 480, y: 170, dir: -1 }],
    intro: 'The last gauntlet before the Commander.\nDebris falls from above — watch the telegraph rings.'
  },

  // BOSS
  {
    id: 'boss', name: 'Commander RIFT', theme: 'boss', timeLimit: 120, targetScore: 5000,
    balls: [],
    platforms: [
      { x: 80, y: 380, w: 130, h: 16 },
      { x: 750, y: 380, w: 130, h: 16 },
    ],
    destructibles: [
      { x: 460, y: 432, w: 40, h: 40, contains: 'machinegun' }
    ],
    pickups: [{ x: 200, y: 420, type: 'shield' }],
    boss: true,
    intro: 'COMMANDER RIFT\nShoot the glowing weak point.\nWatch its attacks!'
  },
] satisfies LevelDefinition[];
