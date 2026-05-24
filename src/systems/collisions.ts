import { Particle } from '../entities/particle';
import { Pickup } from '../entities/pickup';
import { collideCircleRect, rand, rectOverlap } from '../utils';
import { AudioSys } from './audio';
import type { Game } from '../game';

/**
 * Single per-frame collision pass for every entity pair the gameplay state
 * cares about. Mutates `game` directly (kills players, pops balls, fires
 * pickups, detonates bombs). Should be called from updatePlaying after all
 * entity updates and before the cleanup-filter pass.
 */
export function resolveCollisions(game: Game) {
  const players = game.getLivingPlayers();

  // ---- Player vs (ball / hazard / crab / boss) ----
  for (const player of players) {
    if (player.invuln > 0) continue;
    const hb = game.getPlayerHurtbox(player);
    for (const b of game.balls) {
      if (b.dead) continue;
      const c = collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h);
      if (c) { game.killPlayer(player, 'ball'); break; }
    }
    if (player.dead) continue;
    for (const h of game.hazards) {
      const active = h.active !== false;
      const hurts = h.type === 'electric_beam' || h.type === 'boss_beam' || h.type === 'electric_barrier'
        || h.type === 'flame_vent' || h.type === 'falling_rock' || h.type === 'lava';
      if (active && hurts && rectOverlap(hb, h)) { game.killPlayer(player, 'hazard'); break; }
    }
    if (player.dead) continue;
    for (const c of game.crabs) {
      if (rectOverlap(hb, c.getHitbox())) { game.killPlayer(player, 'crab'); break; }
    }
    if (!player.dead && game.boss && !game.boss.dead) {
      const dx = player.x - game.boss.x, dy = (player.y - 24) - game.boss.y;
      if (Math.sqrt(dx*dx + dy*dy) < game.boss.r + 16) game.killPlayer(player, 'boss');
    }
  }

  // ---- Crab vs ball (crabs pop balls and reverse on contact) ----
  for (const c of game.crabs) {
    const hb = c.getHitbox();
    for (const b of game.balls) {
      if (b.dead) continue;
      if (collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h)) {
        game._popBall(b, c);
        c.vx *= -1;
      }
    }
  }

  // ---- Projectile vs (boss / destructible / ball) ----
  for (const p of game.projectiles) {
    if (p.dead) continue;

    if (game.boss && !game.boss.dead && game.boss.collides(p)) {
      p.didHit = true;
      if (p.type === 'bomb') {
        game.explodeProjectile(p, p.x, p.y);
      } else {
        game.boss.hit(game, p.type === 'laser' ? 3 : p.type === 'shuriken' ? 2 : 1);
        if (p.consumeOnHit()) p.dead = true;
        if (p.type === 'shuriken') p.dead = true;
      }
    }

    for (const d of game.destructibles) {
      if (d.dead) continue;
      let hit = false;
      if (p.type === 'harpoon' || p.type === 'laser') {
        if (p.x >= d.x && p.x <= d.x + d.w && p.tipY <= d.y + d.h && p.tipY >= d.y) hit = true;
      } else if (p.type === 'bullet' || p.type === 'pellet') {
        if (p.x >= d.x && p.x <= d.x + d.w && p.y <= d.y + d.h && p.y >= d.y) hit = true;
      } else if (p.type === 'flame') {
        if (p.x + p.r > d.x && p.x - p.r < d.x + d.w && p.y + p.r > d.y && p.y - p.r < d.y + d.h) hit = true;
      } else if (p.type === 'shuriken' || p.type === 'bomb') {
        if (collideCircleRect(p.x, p.y, p.r, d.x, d.y, d.w, d.h)) hit = true;
      }
      if (hit) {
        p.didHit = true;
        if (p.type === 'bomb') {
          game.explodeProjectile(p, p.x, p.y);
          break;
        }
        d.hp--;
        if (d.hp <= 0) {
          d.dead = true;
          AudioSys.pop();
          game.addScore(100);
          if (d.contains) game.pickups.push(new Pickup(d.x + d.w / 2, d.y + d.h / 2, d.contains));
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2, s = rand(60, 180);
            game.particles.push(new Particle(d.x + d.w/2, d.y + d.h/2, Math.cos(a)*s, Math.sin(a)*s, 0.5, '#a8682c', 6, 200));
          }
        }
        if (p.consumeOnHit()) { p.dead = true; break; }
      }
    }

    if (!p.dead) {
      for (const b of game.balls) {
        if (b.dead) continue;
        if (p.hits(b)) {
          p.didHit = true;
          if (p.type === 'bomb') {
            game.explodeProjectile(p, b.x, b.y);
            break;
          }
          game._popBall(b, p);
          p.hitBalls.add(b);
          if (p.type === 'shuriken' && p.hitBalls.size >= 3) { p.dead = true; break; }
          if (p.consumeOnHit()) { p.dead = true; break; }
        }
      }
    }
  }

  // ---- Player vs pickup (uses full hitbox so grab range is unaffected by tiny-hurtbox modifier) ----
  for (const player of game.getLivingPlayers()) {
    const hb = player.getHitbox();
    for (const pk of game.pickups) {
      if (pk.dead) continue;
      if (pk.x > hb.x - 14 && pk.x < hb.x + hb.w + 14 && pk.y > hb.y - 14 && pk.y < hb.y + hb.h + 14) {
        pk.apply(player, game);
        pk.dead = true;
      }
    }
  }
}
