// PopShot test bot — injected into the page by tools/sim.mjs and the
// Playwright specs. It is NOT a model of a human player. It is a consistent,
// moderately competent agent: it forward-predicts ball arcs for ~0.9 s,
// picks the safest of {left, stay, right}, dashes when every option is
// predicted to collide, and otherwise walks under the most attackable ball.
//
// What it is good for: relative comparisons (is stage B harder than stage A?
// did a tuning change move the death rate?), score-distribution estimates for
// medal targets, and long soak runs that look for invalid states.
// What it is NOT good for: claiming a stage "feels" fair or fun.
(function () {
  const GROUND = 488, WL = 16, WR = 944, GRAV = 760;
  const BOUNCE = [340, 410, 490, 570, 650];
  const HB_HALF = 10, HB_TOP = 448, HB_BOT = 486;

  function simBall(b, g, t) {
    // Closed-form-ish stepping (cheap, ignores platforms/bumpers/wind changes).
    let x = b.x, y = b.y, vx = b.vx + (b.driftVx || 0), vy = b.vy;
    const steps = Math.max(1, Math.round(t / (1 / 30)));
    const dt = t / steps;
    const gs = g.gravityScale || 1;
    for (let i = 0; i < steps; i++) {
      vy += GRAV * gs * dt; x += vx * dt; y += vy * dt;
      if (y + b.r >= GROUND) { y = GROUND - b.r; vy = -BOUNCE[b.size] * Math.sqrt(gs) * (b.type === 'hexagon' ? 1.08 : 1); }
      if (x - b.r <= WL) { x = WL + b.r; vx = Math.abs(vx); }
      if (x + b.r >= WR) { x = WR - b.r; vx = -Math.abs(vx); }
    }
    return [x, y];
  }
  function circleRect(cx, cy, r, px) {
    const nx = Math.max(px - HB_HALF, Math.min(px + HB_HALF, cx));
    const ny = Math.max(HB_TOP, Math.min(HB_BOT, cy));
    const dx = cx - nx, dy = cy - ny;
    return Math.sqrt(dx * dx + dy * dy) - r;
  }

  /** Threat circles for boss bodies (Globo) so the bot respects them. */
  function bossThreats(g) {
    const out = [];
    const boss = g.boss;
    if (!boss || !boss.active) return out;
    if (boss.bodies) {
      const R = [74, 52, 36], B = [600, 560, 520];
      for (const b of boss.bodies) out.push({ x: b.x, y: b.y, vx: b.vx, vy: b.flop === 1 ? 0 : b.vy, r: R[b.tier], size: 4, type: 'boss', bounce: B[b.tier], flop: b.flop });
    }
    return out;
  }
  function simBody(b, t) {
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
    const steps = Math.max(1, Math.round(t / (1 / 30))), dt = t / steps;
    for (let i = 0; i < steps; i++) {
      vy += GRAV * dt; x += vx * dt; y += vy * dt;
      if (y + b.r >= GROUND) { y = GROUND - b.r; vy = -b.bounce; }
      if (x - b.r <= WL) { x = WL + b.r; vx = Math.abs(vx); }
      if (x + b.r >= WR) { x = WR - b.r; vx = -Math.abs(vx); }
    }
    return [x, y];
  }

  function dangerAt(g, px, t, balls, bodies) {
    // Returns the smallest clearance (px) to any threat at time t, lower = worse.
    let min = 1e9;
    for (const b of balls) {
      const [x, y] = simBall(b, g, t);
      const c = circleRect(x, y, b.r, px);
      if (c < min) min = c;
    }
    for (const b of bodies) {
      const [x, y] = simBody(b, t);
      const c = circleRect(x, y, b.r, px);
      if (c < min) min = c;
    }
    for (const h of g.hazards) {
      if (h.dead) continue;
      const ty = h.type;
      let lethalSoon = false;
      if (ty === 'boss_beam' || ty === 'electric_beam') lethalSoon = true;
      else if (ty === 'boss_warning') lethalSoon = h.life < t + 0.15;
      else if (ty === 'lava') lethalSoon = h.life > t;
      else if (ty === 'flame_vent' || ty === 'electric_barrier') lethalSoon = true;   // treat as always hot: conservative
      else if (ty === 'falling_rock') lethalSoon = (h.delay || 0) < t + 0.6;
      if (!lethalSoon) continue;
      if (ty !== 'lava' && ty !== 'falling_rock' && (h.y > HB_BOT || h.y + h.h < HB_TOP)) continue;
      const c = Math.max(h.x - (px + HB_HALF), (px - HB_HALF) - (h.x + h.w));
      if (c < min) min = c;
    }
    for (const c of g.crabs) {
      const cx = c.x + c.vx * t;
      const d = Math.abs(cx - px) - 17 - HB_HALF;
      if (d < min) min = d;
    }
    // Lit bomb balls: stay out of the lethal core.
    for (const b of balls) {
      if (b.type === 'explosive' && b.fuse > 0 && b.fuse < t + 0.1) {
        const [x, y] = simBall(b, g, b.fuse);
        const R = [78, 96, 114, 132, 150][b.size] * 0.58;
        const d = Math.hypot(px - x, 466 - y) - R - 6;
        if (d < min) min = d;
      }
    }
    return min;
  }

  const HORIZON = [0.05, 0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.9];

  /** Decide this frame's inputs. skill ∈ [0,1] scales foresight + reaction. */
  let rngState = 1, lastAct = 0;
  function rnd() { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; }
  window.__botSeed = function (seed) { rngState = (seed >>> 0) || 1; lastAct = 0; };

  window.__botStep = function (g, keys, keysPressed, opts) {
    const p = g.player;
    opts = opts || {};
    keys.ArrowLeft = false; keys.ArrowRight = false; keys.Space = false;
    if (!p || p.dead) return;
    const balls = g.balls.filter(b => !b.dead && !b.held);
    const bodies = bossThreats(g);
    const speed = 320;
    const horizonN = opts.skill === 0 ? 4 : HORIZON.length;
    let bestAct = 0, bestScore = -1e9, scores = {};
    // Attack target: the ball whose column we can reach soonest, preferring low risk.
    let tx = null, tBest = 1e9;
    for (const b of balls) {
      if (b.type === 'explosive' && b.fuse > 0) continue;
      const d = Math.abs(b.x - p.x) + (b.y > 400 ? 60 : 0);
      if (d < tBest) { tBest = d; tx = b.x + (b.vx + (b.driftVx || 0)) * 0.18; }
    }
    if (tx == null && g.boss && g.boss.active) tx = g.boss.x;
    for (const pk of g.pickups) { if (!pk.dead && pk.y > 440 && Math.abs(pk.x - p.x) < 160) { tx = tx == null ? pk.x : tx; } }
    for (const act of [-1, 0, 1]) {
      let worst = 1e9;
      for (let i = 0; i < horizonN; i++) {
        const t = HORIZON[i];
        const px = Math.max(WL + 15, Math.min(WR - 15, p.x + act * speed * t * (g.iceFloor ? 0.6 : 1) + (g.iceFloor ? p.vx * t * 0.5 : 0)));
        const c = dangerAt(g, px, t, balls, bodies);
        // Near-term clearance matters most.
        const weighted = c + t * 26;
        if (weighted < worst) worst = weighted;
      }
      let s = Math.min(worst, 46) * 10;
      if (worst < 6) s -= 2000;
      if (tx != null) s -= Math.abs((p.x + act * 40) - tx) * 0.06;
      if (act === 0) s += 0.5;
      // Mild corner aversion — a cornered bot has nowhere to dodge.
      const nx = p.x + act * 60;
      if (nx < WL + 80 || nx > WR - 80) s -= 14;
      scores[act] = worst;
      if (s > bestScore) { bestScore = s; bestAct = act; }
    }
    // Human-ish imperfection: now and then the bot is a few frames late, i.e.
    // it repeats its previous action. `sloppy` is the per-frame probability.
    const sloppy = opts.sloppy == null ? 0.12 : opts.sloppy;
    if (rnd() < sloppy && scores[lastAct] > 2) bestAct = lastAct;
    lastAct = bestAct;
    if (bestAct < 0) keys.ArrowLeft = true;
    if (bestAct > 0) keys.ArrowRight = true;
    // Dash when every option is about to be hit.
    if (opts.dash !== false && scores[-1] < 4 && scores[0] < 4 && scores[1] < 4 && p.dashCd <= 0) {
      // Dash toward the side with more room after the dash.
      const l = dangerAt(g, Math.max(WL + 15, p.x - 125), 0.3, balls, bodies);
      const r = dangerAt(g, Math.min(WR - 15, p.x + 125), 0.3, balls, bodies);
      keysPressed[l > r ? 'DashLeft' : 'DashRight'] = true;
    }
    keys.Space = true;       // always firing, like touch auto-fire
  };
})();
