import { CEILING_Y, H, W, type BallType, type PickupType, type ThemeName } from '../constants';
import { Ball } from '../entities/ball';
import { FloatingText, Shockwave, pushText } from '../entities/particle';
import { Pickup } from '../entities/pickup';
import { AudioSys } from './audio';
import { banner } from './combat';
import { gchance, gpick, grand, grandi } from './rng';
import type { Game } from '../game';

// ============================ PANIC MODE ============================
// Endless survival, restructured so it escalates through VARIETY rather than
// by piling on more balls:
//
//   • Waves are drawn from named recipes (a storm of electric balls, a
//     minefield, a single titan, a hex swarm …), sized by a threat budget.
//   • Every 4 waves the arena moves to the next ZONE — a different world's
//     backdrop and that world's mechanic (wind, ice, bumpers, eruptions,
//     fans, low gravity). Surviving a full lap of zones starts LAP 2, where
//     the budget is higher and the calm between gusts/eruptions is shorter.
//
// The ball count is capped; past the cap a wave pays out as score instead.

export const WAVES_PER_ZONE = 4;
const MAX_BALLS = 14;

interface Zone { theme: ThemeName; title: string; sub: string; }
const ZONES: Zone[] = [
  { theme: 'beach',   title: 'ZONE 1 — THE SHALLOWS', sub: 'no tricks. just you and the bounce.' },
  { theme: 'desert',  title: 'ZONE 2 — SANDSTORM',    sub: 'gusts shove every ball sideways.' },
  { theme: 'arctic',  title: 'ZONE 3 — BLACK ICE',    sub: 'the floor is ice. brake early.' },
  { theme: 'city',    title: 'ZONE 4 — PINBALL',      sub: 'bumpers kick balls and block shots.' },
  { theme: 'volcano', title: 'ZONE 5 — ERUPTION',     sub: 'watch the red rings on the floor.' },
  { theme: 'airship', title: 'ZONE 6 — UPDRAFT',      sub: 'deck fans blow balls sky-high.' },
  { theme: 'boss',    title: 'ZONE 7 — THE RIFT',     sub: 'low gravity. everything floats.' },
];

type Spec = { size: number; type: BallType };
/** Threat cost of a ball by size — roughly the pops it represents. */
const COST = [1, 2, 4, 7, 12];

type Recipe = (budget: number) => Spec[];

function fill(budget: number, sizes: number[], types: BallType[]): Spec[] {
  const out: Spec[] = [];
  let left = budget;
  let guard = 0;
  while (left > 0 && guard++ < 20) {
    const size = gpick(sizes.filter(s => COST[s] <= left + 1).length ? sizes.filter(s => COST[s] <= left + 1) : [Math.min(...sizes)]);
    out.push({ size, type: gpick(types) });
    left -= COST[size];
  }
  return out;
}

const RECIPES: Record<string, Recipe> = {
  classic:   b => fill(b, [2, 3], ['normal']),
  twins:     b => fill(b, [3], ['normal']),
  swarm:     b => fill(Math.min(b, 16), [1], ['normal', 'normal', 'hexagon']),
  titan:     b => [{ size: 4, type: 'normal' }, ...fill(Math.max(0, b - 12), [1, 2], ['normal'])],
  storm:     b => [{ size: 3, type: 'electric' }, ...fill(Math.max(2, b - 7), [2, 3], ['normal', 'electric'])],
  minefield: b => [{ size: 3, type: 'explosive' }, { size: 2, type: 'explosive' }, ...fill(Math.max(2, b - 11), [2], ['normal'])],
  hexes:     b => fill(b, [2, 3], ['hexagon']),
  heavy:     b => fill(b, [3], ['armored', 'normal']),
  murk:      b => fill(b, [2, 3], ['smoke', 'sludge', 'normal']),
  magma:     b => fill(b, [2, 3], ['lava', 'normal']),
  bounty:    b => [{ size: 2, type: 'bonus' }, ...fill(Math.max(2, b - 4), [2, 3], ['normal'])],
};

/** Recipes on offer per zone — each zone leans on the ball types that play
 *  best with its mechanic. */
const ZONE_RECIPES: Record<ThemeName, string[]> = {
  beach:   ['classic', 'twins', 'classic', 'bounty'],
  desert:  ['classic', 'storm', 'minefield', 'swarm'],
  arctic:  ['twins', 'murk', 'heavy', 'bounty'],
  city:    ['hexes', 'storm', 'classic', 'swarm'],
  volcano: ['magma', 'minefield', 'heavy', 'titan'],
  airship: ['swarm', 'storm', 'titan', 'hexes'],
  boss:    ['titan', 'minefield', 'storm', 'hexes', 'heavy'],
};

export function zoneIndexFor(wave: number) { return Math.floor((wave - 1) / WAVES_PER_ZONE); }

function installZone(game: Game, zi: number) {
  const lap = Math.floor(zi / ZONES.length);
  const zone = ZONES[zi % ZONES.length];
  game.theme = zone.theme;
  AudioSys.setPopScale(zone.theme);
  // Clear the previous zone's fixtures; in-flight balls carry over.
  game.hazards = game.hazards.filter(h => h.type === 'lava' || h.type === 'slime');
  const tighten = 1 / (1 + lap * 0.25);
  const spec: Parameters<Game['setupArena']>[0] = {};
  switch (zone.theme) {
    case 'desert':  spec.wind = { strength: 250 + lap * 30, gapMin: 4 * tighten, gapMax: 6.5 * tighten }; break;
    case 'arctic':  spec.ice = true; break;
    case 'city':    spec.bumpers = [{ x: 250, y: 260 }, { x: 710, y: 260 }, { x: 480, y: 170, r: 26 }]; break;
    case 'volcano': spec.eruption = { interval: 6.5 * tighten, count: 2 + Math.min(2, lap), first: 3 }; break;
    case 'airship': spec.fans = [{ x: 170, w: 130, on: 3.2, off: 3.6, phase: 0 }, { x: 660, w: 130, on: 3.2, off: 3.6, phase: 3.4 }]; break;
    case 'boss':    spec.gravity = 0.55; spec.wind = { strength: 150, gapMin: 6, gapMax: 9 }; break;
  }
  game.setupArena(spec);
  if (zi > 0) {
    banner(game, zone.title + (lap > 0 ? '  ·  LAP ' + (lap + 1) : ''), zone.sub, '#9be7ff', 30, 2.2);
    game.shockwaves.push(new Shockwave(W / 2, H / 2, 520, '#9be7ff', 0.8));
    game.flash = Math.max(game.flash, 0.25);
    AudioSys.sfx('panic/wave_clear', 0.9);
    // A zone survived earns a breather: a shield and a full-screen freeze beat.
    game.pickups.push(new Pickup(W / 2, H / 2 - 40, 'shield'));
    game.freezeTime = Math.max(game.freezeTime, 1.2);
  }
}

const WEAPON_DROPS: PickupType[] = ['double', 'triple', 'machinegun', 'laser', 'shotgun', 'shuriken', 'bomb', 'powerwire', 'diagonal', 'flame'];

export function startPanicRun(game: Game) {
  game.panicWave = 0;
  game.panicGauge = 0;
  game.panicGaugeMax = 12;
  game.panicStarTimer = 22;
  game.theme = 'beach';
  game.levelName = 'PANIC MODE';
  advancePanic(game);
}

export function advancePanic(game: Game) {
  const prevZone = game.panicWave > 0 ? zoneIndexFor(game.panicWave) : -1;
  game.panicWave++;
  const wave = game.panicWave;
  const zi = zoneIndexFor(wave);
  if (zi !== prevZone) installZone(game, zi);
  const zone = ZONES[zi % ZONES.length];
  const lap = Math.floor(zi / ZONES.length);
  game.levelName = 'Wave ' + wave + ' · ' + zone.title.split('— ')[1];
  game.panicGaugeMax = 12 + Math.min(18, wave * 2);
  AudioSys.sfx('panic/wave_start', 0.8) || AudioSys.levelClear();
  if (zi === prevZone) {
    pushText(game.floatingTexts, new FloatingText(W / 2, 130, 'WAVE ' + wave, '#ffd60a', 34), 'wave', 1.1);
  }

  // ---- Compose the wave ----
  const budget = Math.min(34, 7 + wave * 1.5 + lap * 4);
  const pool = ZONE_RECIPES[zone.theme];
  // The first wave of the run is always the gentlest possible opener.
  const recipe = wave === 1 ? RECIPES.twins : RECIPES[gpick(pool)];
  const specs = wave === 1 ? [{ size: 3, type: 'normal' as BallType }] : recipe(budget);
  const room = Math.max(0, MAX_BALLS - game.balls.filter(b => !b.dead).length);
  const px = game.getLivingPlayers()[0]?.x ?? W / 2;
  let spawned = 0;
  for (let i = 0; i < specs.length; i++) {
    if (spawned >= room) {
      // Arena is saturated: the rest of the wave pays out as score instead.
      game.addScore(120 * COST[specs[i].size]);
      continue;
    }
    // Spread across the ceiling, never directly over the player.
    let x = 100 + ((i + 0.5) / specs.length) * (W - 200) + grand(-40, 40);
    if (Math.abs(x - px) < 110) x += x < px ? -130 : 130;
    x = Math.max(70, Math.min(W - 70, x));
    const dir = x < px ? -1 : 1;                      // open heading away
    const b = new Ball(x, CEILING_Y + 46 + grand(0, 40), specs[i].size, specs[i].type, 0, 0);
    b.vx = dir * Math.abs(b.vx);
    b.bornT = 0.16;
    game.balls.push(b);
    spawned++;
  }

  // ---- Cadenced help ----
  if (wave % 3 === 0) {
    const type: PickupType = gchance(0.35) ? 'shield' : gpick(WEAPON_DROPS);
    game.pickups.push(new Pickup(grand(140, W - 140), H / 2, type));
  }
  if (wave % 10 === 0) game.pickups.push(new Pickup(grandi(200, W - 200), H / 2 - 60, 'life'));
}
