import { GRAZE_COOLDOWN, GRAZE_MARGIN, type DeathReason } from '../constants';
import type { HazardType } from '../entities/hazard';
import { FloatingText, Particle, Shockwave, pushText } from '../entities/particle';
import { Pickup } from '../entities/pickup';
import { dragonDropPickup } from '../entities/creature';
import { collideCircleRect, rand, rectOverlap } from '../utils';
import { AudioSys } from './audio';
import { addCharge, awardTrick, graze } from './combat';
import { Haptics } from './haptics';
import type { Game } from '../game';

const HAZARD_REASON: Partial<Record<HazardType, DeathReason>> = {
  electric_beam: 'beam', boss_beam: 'beam', electric_barrier: 'barrier',
  flame_vent: 'flame', falling_rock: 'rock', lava: 'lava',
};

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
    const hb = game.getPlayerHurtbox(player);
    if (player.untouchable) {
      // Mid-dash: passing clean THROUGH a ball is the PHASE trick — the
      // payoff for committing to a dash instead of backing away.
      if (player.dashIframes > 0 && !player.dashPhased) {
        for (const b of game.balls) {
          if (b.dead) continue;
          if (collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h)) {
            player.dashPhased = true;
            b.grazeCd = GRAZE_COOLDOWN;
            awardTrick(game, 'phase', 'PHASE!', 120, '#9be7ff', player.x, player.y - 64);
            game.shockwaves.push(new Shockwave(player.x, player.y - 24, 60, '#9be7ff', 0.25));
            break;
          }
        }
      }
      continue;
    }
    for (const b of game.balls) {
      if (b.dead) continue;
      const c = collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h);
      if (c) { game.killPlayer(player, 'ball'); break; }
      // Graze: skimmed the hurtbox without touching. Newborn children are
      // excluded so popping a ball overhead never pays out as a "near miss".
      if (b.grazeCd <= 0 && b.age > 0.4 && !b.held
          && collideCircleRect(b.x, b.y, b.r + GRAZE_MARGIN, hb.x, hb.y, hb.w, hb.h)) {
        b.grazeCd = GRAZE_COOLDOWN;
        graze(game, player, b);
      }
    }
    if (player.dead) continue;
    for (const h of game.hazards) {
      const active = h.active !== false;
      const reason = HAZARD_REASON[h.type];
      // Lava patches are handled by Player.update (it needs foot position).
      if (active && reason && h.type !== 'lava' && rectOverlap(hb, h)) { game.killPlayer(player, reason); break; }
    }
    if (player.dead) continue;
    for (const c of game.crabs) {
      if (rectOverlap(hb, c.getHitbox())) { game.killPlayer(player, 'crab'); break; }
    }
    if (!player.dead && game.boss && game.boss.active && game.boss.touches(hb)) game.killPlayer(player, 'boss');
  }

  // ---- Crab vs ball (crabs pop balls and reverse on contact) ----
  for (const c of game.crabs) {
    if (c.popCooldown > 0) continue;
    const hb = c.getHitbox();
    for (const b of game.balls) {
      if (b.dead) continue;
      if (collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h)) {
        game._popBall(b, { kind: 'creature' });
        c.vx *= -1;
        c.popCooldown = 0.9;
        break;
      }
    }
  }

  // ---- Creatures: dragon pops balls / birds stun the player on contact. ----
  for (const cr of game.creatures) {
    if (cr.dead) continue;
    const hb = cr.getHitbox();
    // Creature vs ball — dragons pop, hostile birds don't interact (would feel
    // unfair if they popped balls AND stunned us). Rate-limited to one pop
    // per beat (popCooldown) so the dragon assists instead of insta-clearing
    // whole ball families the frame their children spawn.
    if (!cr.hostile && cr.popCooldown <= 0) {
      for (const b of game.balls) {
        if (b.dead) continue;
        if (collideCircleRect(b.x, b.y, b.r, hb.x, hb.y, hb.w, hb.h)) {
          game._popBall(b, { kind: 'creature' });
          cr.popCooldown = 1.2;
          AudioSys.sfx('creature/dragon_pop_assist', 0.7);
          break;
        }
      }
    }
    // Creature vs player — hostile birds STUN weapons (3s lockout). Friendly
    // dragons are walkable (no effect on the player). A dash slips past.
    if (cr.hostile) {
      for (const player of game.getLivingPlayers()) {
        if (player.untouchable || player.weaponDisabled > 0) continue;
        const phb = player.getHitbox();
        if (rectOverlap(phb, hb)) {
          player.weaponDisabled = 3;
          AudioSys.sfx('creature/bird_jam_player', 0.8) || AudioSys.warning();
          pushText(game.floatingTexts, new FloatingText(player.x, player.y - 56, 'CANNON JAMMED!', '#ff4d6d', 16), 'jam' + player.playerNum, 1.0);
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2, s = rand(60, 160);
            game.particles.push(new Particle(player.x, player.y - 24, Math.cos(a)*s, Math.sin(a)*s, 0.5, '#ffd60a', 4));
          }
        }
      }
    }
  }

  // ---- Projectile vs creature (shoot down birds / kick the dragon) ----
  for (const p of game.projectiles) {
    if (p.dead) continue;
    for (const cr of game.creatures) {
      if (cr.dead) continue;
      const hb = cr.getHitbox();
      let hit = false;
      if (p.type === 'harpoon' || p.type === 'laser' || p.type === 'grapple' || p.type === 'popshot') {
        const half = (p.w || 6) / 2;
        if (p.x + half >= hb.x && p.x - half <= hb.x + hb.w
            && p.tipY <= hb.y + hb.h && p.startY >= hb.y) hit = true;
      } else if (p.type === 'bullet' || p.type === 'pellet') {
        if (p.x >= hb.x && p.x <= hb.x + hb.w && p.y <= hb.y + hb.h && p.y >= hb.y) hit = true;
      } else {
        // Circular weapons (flame/shuriken/bomb/diagonal)
        if (collideCircleRect(p.x, p.y, p.r || 8, hb.x, hb.y, hb.w, hb.h)) hit = true;
      }
      if (hit) {
        if (p.hitCreatures.has(cr)) continue;
        p.hitCreatures.add(cr);
        p.didHit = true;
        const drop = cr.hit();
        game.addScore(cr.score);
        game.floatingTexts.push(new FloatingText(cr.x, cr.y - 14, '+' + cr.score, '#ffd60a', 16));
        if (cr.dead) {
          AudioSys.sfx('creature/bird_killed', 0.8);
          game.shockwaves.push(new Shockwave(cr.x, cr.y, 80, cr.kind === 'dragon' ? '#06d6a0' : '#ff4d6d', 0.35));
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2, s = rand(80, 220);
            game.particles.push(new Particle(cr.x, cr.y, Math.cos(a)*s, Math.sin(a)*s, 0.5,
              cr.kind === 'red_bird' ? '#ff4d6d' : cr.kind === 'dragon' ? '#06d6a0' : '#9aa3ad', 5, 300));
          }
          addCharge(game, 6);
          if (drop === 'guaranteed') {
            if (game.modifier !== 'no_pickups') game.pickups.push(new Pickup(cr.x, cr.y, dragonDropPickup()));
          } else if (drop === 'maybe') {
            // Kicked dragon: a parting blast that pops every nearby ball.
            const blast = 130;
            for (const b of game.balls) {
              if (b.dead) continue;
              const dx = b.x - cr.x, dy = b.y - cr.y;
              if (dx*dx + dy*dy < blast*blast) game._popBall(b, { kind: 'blast' });
            }
            game.shockwaves.push(new Shockwave(cr.x, cr.y, 160, '#06d6a0', 0.5));
            AudioSys.explode(false);
          }
        }
        if (p.consumeOnHit()) { p.dead = true; break; }
      }
    }
  }

  // ---- Projectile vs (boss / destructible / ball) ----
  for (const p of game.projectiles) {
    if (p.dead) continue;

    const boss = game.boss;
    if (boss && boss.active && !p.hitBoss && boss.hitBy(game, p)) {
      p.didHit = true;
      p.hitBoss = true;
      if (p.type === 'bomb') {
        game.explodeProjectile(p, p.x, p.y);
      } else if (p.consumeOnHit() || p.type === 'shuriken') {
        p.dead = true;
      }
      if (p.dead) continue;
    }

    for (const d of game.destructibles) {
      if (d.dead) continue;
      let hit = false;
      if (p.type === 'harpoon' || p.type === 'laser' || p.type === 'grapple' || p.type === 'popshot') {
        const half = (p.w || 6) / 2;
        if (p.x + half >= d.x && p.x - half <= d.x + d.w && p.tipY <= d.y + d.h && p.startY >= d.y) hit = true;
      } else if (p.type === 'bullet' || p.type === 'pellet') {
        if (p.x >= d.x && p.x <= d.x + d.w && p.y <= d.y + d.h && p.y >= d.y) hit = true;
      } else {
        if (collideCircleRect(p.x, p.y, p.r || 8, d.x, d.y, d.w, d.h)) hit = true;
      }
      if (hit) {
        p.didHit = true;
        if (p.type === 'bomb') {
          game.explodeProjectile(p, p.x, p.y);
          break;
        }
        game.breakCrate(d);
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
          if (p.type === 'popshot') {
            // Already-marked balls are riding a cascade; leave them to it.
            if (b.cascade) continue;
            b.cascade = true;
          }
          p.hitBalls.add(b);
          game._popBall(b, p);
          if (p.type === 'grapple') AudioSys.sfx('weapon/grapple_break', 0.6);
          if (p.type === 'shuriken' && p.hitBalls.size >= 4) { p.dead = true; break; }
          if (p.consumeOnHit()) { p.dead = true; break; }
        }
      }
    }
  }

  // ---- Co-op rescue: a living player reaches a downed teammate ----
  const all = game.getAllPlayers();
  for (const a of all) {
    if (a.dead) continue;
    for (const b of all) {
      if (b === a || !b.dead || b.respawnTimer <= 0) continue;
      const dx = a.x - b.x;
      if (Math.abs(dx) < 34) {
        // Revived exactly where they fell, with a grace window for both — a
        // rescue is a risk the rescuer took and it should feel like a win.
        game.respawnPlayer(b, b.x);
        b.invuln = 2.0;
        a.invuln = Math.max(a.invuln, 0.8);
        game.addScore(500);
        addCharge(game, 12);
        pushText(game.floatingTexts, new FloatingText(b.x, b.y - 60, 'RESCUE!  +500', '#06d6a0', 24), 'down' + b.playerNum, 1.2);
        game.shockwaves.push(new Shockwave(b.x, b.y - 24, 120, '#06d6a0', 0.45));
        AudioSys.sfx('stinger/new_best', 0.7) || AudioSys.pickup();
        for (let i = 0; i < 18; i++) {
          const an = Math.random() * Math.PI * 2, s = rand(100, 260);
          game.particles.push(new Particle(b.x, b.y - 24, Math.cos(an)*s, Math.sin(an)*s, 0.55, '#06d6a0', 5, 0, 2, i % 2 === 0));
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
        // Collection juice — a small ring + spark burst at the grab point so
        // picking something up lands with the same weight as popping a ball.
        game.shockwaves.push(new Shockwave(pk.x, pk.y, 54, '#ffd60a', 0.3));
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = rand(60, 160);
          game.particles.push(new Particle(pk.x, pk.y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.25, 0.45), i % 2 ? '#ffd60a' : '#fff', 4, 160));
        }
        game.shake = Math.max(game.shake, 2.5);
        Haptics.pop();
      }
    }
  }
}
