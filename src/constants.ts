// ============================ CONSTANTS =============================
export const W = 960, H = 540;                  // Logical canvas resolution
export const GROUND_Y = 488;                    // Floor y
export const CEILING_Y = 56;                    // Ceiling y
export const WALL_L = 16, WALL_R = W - 16;      // Side walls
export const GRAVITY = 760;                     // px/s^2

// Ball size tiers 0..4 = tiny, small, medium, large, huge
export const BALL_RADIUS  = [12, 18, 26, 36, 48];
export const BALL_BOUNCE  = [340, 410, 490, 570, 650];   // floor bounce velocity
export const BALL_HSPEED  = [200, 165, 140, 115, 95];    // horizontal travel
export const BALL_SCORE   = [200, 150, 100, 75, 50];

// ---- Chain (combo) -------------------------------------------------------
// The chain is purely time-based: every pop refreshes a window, and the chain
// only ends when that window runs dry. A missed shot never breaks it — which
// keeps touch auto-fire and manual fire on exactly the same scoring footing.
// The window tightens as the chain grows, so long chains demand aggression.
export const CHAIN_WINDOW_MAX = 3.0;     // seconds at chain 1
export const CHAIN_WINDOW_MIN = 1.7;     // seconds at chain 30+
/** Score multiplier for the current chain length: +0.5 every 5 pops, cap ×5. */
export function chainMult(chain: number): number {
  return 1 + Math.min(8, Math.floor(chain / 5)) * 0.5;
}
export function chainWindow(chain: number): number {
  const k = Math.min(1, chain / 30);
  return CHAIN_WINDOW_MAX + (CHAIN_WINDOW_MIN - CHAIN_WINDOW_MAX) * k;
}

// ---- PopShot meter -------------------------------------------------------
// Charged by pops, tricks and grazes. When full, the next shot is a PopShot:
// a piercing super-harpoon that makes every ball it touches burst all the way
// down its family tree in one rippling cascade.
export const POPSHOT_MAX = 100;
export const POPSHOT_PER_POP = 3;
export const POPSHOT_PER_TRICK = 7;
export const POPSHOT_PER_GRAZE = 6;

// ---- Dash ----------------------------------------------------------------
export const DASH_TIME = 0.16;           // seconds of burst travel
export const DASH_SPEED = 780;           // px/s during the burst (~125px)
export const DASH_IFRAMES = 0.24;        // invulnerability from dash start
export const DASH_COOLDOWN = 1.25;       // seconds from dash start to next dash

// ---- Graze ---------------------------------------------------------------
export const GRAZE_MARGIN = 15;          // px outside the hurtbox that counts
export const GRAZE_COOLDOWN = 1.1;       // per-ball, seconds
export const GRAZE_SCORE = 40;

// Hexagons travel a touch faster horizontally and bounce slightly higher than
// their round counterparts — homage to Super Pang's Exagon physics.
export const HEX_HSPEED_MULT = 1.18;
export const HEX_BOUNCE_MULT = 1.08;

// Color palettes per ball type [primary, dark]
export const BALL_COLORS = {
  normal:    ['#ff4d6d', '#9d0a32'],
  electric:  ['#ffd60a', '#ff8500'],
  explosive: ['#ff5400', '#8a0202'],
  smoke:     ['#9aa3ad', '#3a4148'],
  lava:      ['#ff7733', '#7a1818'],
  sludge:    ['#9be15d', '#3a6b1c'],
  armored:   ['#c7ccd1', '#4f555a'],
  bonus:     ['#06d6a0', '#0a7058'],
  // Super Pang polygonal variant — sharper, jagged trajectory. Visually
  // distinct so the player can read it instantly against the bouncing roster.
  hexagon:   ['#9e7bff', '#3d1a8a'],
  // Panic-mode shimmering bubble — flashing colors signal the screen-clear
  // power-up moment (cycles Clock / Star icons).
  star:      ['#ffffff', '#ffd60a'],
} as const;

// Theme palettes per world (sky top, sky bottom, ground top, ground bottom, accent)
export const THEMES = {
  beach:  { sky1: '#56cbf9', sky2: '#ffe0b3', g1: '#f6d68d', g2: '#caa468', acc: '#ff7f50' },
  desert: { sky1: '#ff9e6b', sky2: '#ffd9a3', g1: '#e0a05a', g2: '#a8602a', acc: '#5b2c0f' },
  arctic: { sky1: '#0b1e3c', sky2: '#4a6fa5', g1: '#dfeefd', g2: '#a9c6df', acc: '#9be7ff' },
  city:   { sky1: '#18233d', sky2: '#596d91', g1: '#4f5a66', g2: '#202832', acc: '#ffe66d' },
  volcano:{ sky1: '#35111f', sky2: '#bd3b22', g1: '#3b2420', g2: '#150a0a', acc: '#ffb703' },
  airship:{ sky1: '#153a62', sky2: '#88c6e8', g1: '#6c5a45', g2: '#2f241a', acc: '#f4d35e' },
  boss:   { sky1: '#10031c', sky2: '#3a004d', g1: '#2b1340', g2: '#160922', acc: '#ff2b88' },
} as const;

// State machine names
export const State = {
  BOOT: 'boot',
  MAIN_MENU: 'main_menu',
  MODE_SELECT: 'mode_select',
  LEVEL_SELECT: 'level_select',
  HIGH_SCORES: 'high_scores',
  CONTROLS: 'controls',
  CREDITS: 'credits',
  STATS: 'stats',
  PROFILE: 'profile',
  HUB: 'hub',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_CLEAR: 'level_clear',
  PLAYER_DEAD: 'player_dead',
  GAME_OVER: 'game_over',
  BOSS_DEFEATED: 'boss_defeated',
  VICTORY: 'victory',
  DAILY_INTRO: 'daily_intro',
  DAILY_RESULT: 'daily_result',
} as const;

// Daily Challenge modifiers. The pool is intentionally small; each modifier
// changes one tactical dimension without rewriting physics.
export const DAILY_MODIFIERS = [
  { id: 'double_score',  label: 'DOUBLE SCORE',  desc: 'Every pop scores ×2.' },
  { id: 'no_pickups',    label: 'NO PICKUPS',    desc: 'No weapons or power-ups will spawn.' },
  { id: 'tiny_hurtbox',  label: 'TINY HURTBOX',  desc: 'You are a smaller target.' },
  { id: 'big_bubbles',   label: 'BIG BUBBLES',   desc: 'Every ball starts one size larger.' },
  { id: 'sudden_death',  label: 'SUDDEN DEATH',  desc: 'One life. No retries.' },
  // Added with the systems overhaul — each one re-uses a world mechanic so the
  // daily can remix any level into a genuinely different problem.
  { id: 'windstorm',     label: 'WINDSTORM',     desc: 'Gusts shove every ball sideways.' },
  { id: 'moon_bounce',   label: 'MOON BOUNCE',   desc: 'Low gravity. Everything hangs in the air.' },
  { id: 'live_wires',    label: 'LIVE WIRES',    desc: 'Every ball is electric — pops arc to neighbours.' },
  { id: 'overcharge',    label: 'OVERCHARGE',    desc: 'The PopShot meter fills three times faster.' },
  { id: 'black_ice',     label: 'BLACK ICE',     desc: 'The floor is ice. You slide.' },
] as const;

/** Why the player died. Surfaced to the player on the game-over screen so
 *  the loss is intelligible and "fair" rather than mysterious. */
export type DeathReason = 'ball' | 'hazard' | 'crab' | 'boss' | 'timeout' | 'unknown'
  | 'lava' | 'rock' | 'beam' | 'flame' | 'barrier' | 'blast';

export const DEATH_REASON_TEXT: Record<DeathReason, string> = {
  ball:    'A bouncing ball reached you.',
  hazard:  'A hazard caught you.',
  crab:    'A wandering crab knocked you out.',
  boss:    'The boss crushed you.',
  timeout: 'The timer ran out.',
  unknown: 'You were defeated.',
  lava:    'You stepped on a lava patch.',
  rock:    'A falling rock landed on you.',
  beam:    'An energy beam caught you.',
  flame:   'A flame vent flared under you.',
  barrier: 'You touched a live barrier.',
  blast:   'You were inside a bomb ball\'s blast core.',
};

export type BallType = keyof typeof BALL_COLORS;
export type ThemeName = keyof typeof THEMES;
export type GameState = (typeof State)[keyof typeof State];
export type DailyModifierId = (typeof DAILY_MODIFIERS)[number]['id'];
// 'triple'   — three concurrent harpoons (Pang! 3)
// 'powerwire' — wire anchors to ceiling, persists until struck by a ball (defensive trap)
// 'diagonal' — fires twin 45-degree harpoons (Sheila the Thief homage)
export type WeaponType = 'harpoon' | 'double' | 'triple' | 'powerwire' | 'diagonal'
  | 'machinegun' | 'laser' | 'flame' | 'shotgun' | 'shuriken' | 'bomb';
/** Friendly display names for the HUD and pickup callouts. */
export const WEAPON_LABEL: Record<WeaponType, string> = {
  harpoon: 'HARPOON', double: 'TWIN HARPOON', triple: 'TRIPLE HARPOON',
  powerwire: 'POWER WIRE', diagonal: 'SPLIT BOLTS', machinegun: 'MACHINE GUN',
  laser: 'RAIL LASER', flame: 'FLAMETHROWER', shotgun: 'SCATTER SHOT',
  shuriken: 'RICOCHET STAR', bomb: 'STICKY BOMB',
};
export type PickupType = WeaponType | 'shield' | 'score' | 'life' | 'time'
  | 'slowtime' | 'freeze' | 'clearsmoke' | 'magnet' | 'combo' | 'dynamite';
export type GameMode = 'tour' | 'score_attack' | 'panic' | 'daily' | 'boss_rush';
export interface Rect { x: number; y: number; w: number; h: number; }
