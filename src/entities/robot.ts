// ============================ ROBOT CHARACTER =======================
// RIG-7 — a legless treaded harpoon-bot. This is the procedural replacement
// for the old humanoid player (see the commented-out `Player.draw()` body in
// player.ts). One expressive eye is the whole face; a planted tread rolls, the
// hull rocks on suspension, the top-mounted cannon recoils on a real spring,
// and a coral scarf trails in the wind. Everything is drawn in code with a
// single upper-left light source.
//
// Entry point: drawBot(ctx, x, groundY, pose) -> {x, y} muzzle point.
// Originally ported from a standalone harpoon-bot.html prototype (since removed).

import { clamp } from '../utils';

const INK = '#0a1832';
const TAU = Math.PI * 2;

// --- math / easing ---
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
// damped spring settle: starts at 1, oscillates to 0
const settle = (k: number) => Math.cos(k * Math.PI * 2.3) * Math.exp(-k * 4.2);

function shade(hex: string, amt: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }

// Rounded rect that BEGINS a fresh subpath (number or [tl,tr,br,bl] radii).
// Local helper so we never patch CanvasRenderingContext2D.prototype globally.
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const rad = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + rad[0], y);
  ctx.arcTo(x + w, y, x + w, y + h, rad[1]);
  ctx.arcTo(x + w, y + h, x, y + h, rad[2]);
  ctx.arcTo(x, y + h, x, y, rad[3]);
  ctx.arcTo(x, y, x + w, y, rad[0]);
  ctx.closePath();
}

export interface RobotPalette {
  body: string; bodyDark: string; bodyHi: string;
  boot: string; bootHi?: string;
  hat: string; hatHi?: string; hatDark?: string;
  accent: string; core?: string;
}

export interface RobotPose {
  facing?: number;   // +1 / -1   head + dust direction (turret stays vertical)
  t?: number;        // seconds   global clock, for idle life
  vx?: number;       // px/s signed   suspension lean + dust
  dist?: number;     // px        accumulated travel -> wheel spin + tread scroll
  fireT?: number;    // seconds   time since fire began, or <0 for "at rest"
  cheerT?: number;   // seconds   time since a successful pop, or <0 for none
  pal?: RobotPalette;
  scale?: number;    // default 1
}

// P2 green skin — the treaded counterpart to the old teal humanoid. Gold brow
// (hat) is kept for contrast/identity just like P1.
export const ROBOT_P2_PALETTE: RobotPalette = {
  body: '#34a0a4', bodyDark: '#1d646a', bodyHi: '#6bd6db',
  boot: '#0e3a3f', bootHi: '#2f6e72',
  hat: '#ffce4a', hatHi: '#ffe49b', hatDark: '#cf9a1e',
  accent: '#9be7ff', core: '#9bffe9',
};

// Fill any fields the game's PlayerPalette doesn't carry (bootHi, core) so the
// equipped P1 palette "just works" without changing the save format.
function withDefaults(pal: RobotPalette): Required<RobotPalette> {
  return {
    body: pal.body, bodyDark: pal.bodyDark, bodyHi: pal.bodyHi,
    boot: pal.boot, bootHi: pal.bootHi ?? shade(pal.boot, 34),
    hat: pal.hat, hatHi: pal.hatHi ?? shade(pal.hat, 30), hatDark: pal.hatDark ?? shade(pal.hat, -40),
    accent: pal.accent, core: pal.core ?? '#46e0ff',
  };
}

function fireEnv(ft: number | undefined) {
  // anticipation -> launch -> spring recovery, as a pure function of time
  const A = 0.11, B = 0.19, C = 0.60;
  if (ft == null || ft < 0 || ft > C) return { charge: 0, recoil: 0, pitch: 0, flash: 0, smoke: 0, launched: false, t: ft };
  let charge = 0, recoil = 0, pitch = 0, flash = 0, smoke = 0, launched = false;
  if (ft < A) {                                   // wind up: core charges, slight pre-load
    const k = ft / A;
    charge = easeInOutCubic(k);
    recoil = -2.5 * easeOutCubic(k);              // turret eases UP a hair (loading)
    pitch = -0.012 * k;                           // nose dips forward slightly
  } else if (ft < B) {                            // launch: hard kick down + rock back
    const k = (ft - A) / (B - A);
    charge = 1; launched = true;
    recoil = lerp(-2.5, 9, easeOutCubic(k));      // + = turret driven DOWN into hull
    pitch = lerp(-0.012, 0.085, easeOutCubic(k)); // rock backward, front lifts
    flash = 1 - Math.abs(k - 0.30) * 1.6; flash = clamp(flash, 0, 1);
    smoke = k;
  } else {                                        // recovery: damped spring overshoot
    const k = (ft - B) / (C - B);
    recoil = 9 * settle(k);
    pitch = 0.085 * settle(k);
    charge = (1 - k) * 0.35;
    smoke = (1 - k) * 0.9;
  }
  return { charge, recoil, pitch, flash, smoke, launched, t: ft };
}

// where a point sits along the looping tread band (for scrolling lugs)
function treadPoint(s: number, sep: number, wy: number, Rt: number) {
  const arc = Math.PI * Rt, P = 2 * sep + 2 * arc, hs = sep / 2;
  s = ((s % P) + P) % P;
  if (s < sep) return { x: -hs + s, y: wy - Rt, nx: 0, ny: -1 };
  s -= sep;
  if (s < arc) { const a = -Math.PI / 2 + (s / arc) * Math.PI; return { x: hs + Math.cos(a) * Rt, y: wy + Math.sin(a) * Rt, nx: Math.cos(a), ny: Math.sin(a) }; }
  s -= arc;
  if (s < sep) return { x: hs - s, y: wy + Rt, nx: 0, ny: 1 };
  s -= sep;
  const a = Math.PI / 2 + (s / arc) * Math.PI; return { x: -hs + Math.cos(a) * Rt, y: wy + Math.sin(a) * Rt, nx: Math.cos(a), ny: Math.sin(a) };
}

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ang: number, pal: Required<RobotPalette>) {
  // tire
  ctx.lineWidth = 2; ctx.strokeStyle = INK;
  ctx.fillStyle = shade(pal.boot, -6); circle(ctx, cx, cy, r); ctx.fill(); ctx.stroke();
  // hub
  const g = ctx.createRadialGradient(cx - r * .3, cy - r * .3, 1, cx, cy, r * .74);
  g.addColorStop(0, pal.bootHi); g.addColorStop(1, shade(pal.boot, 6));
  ctx.fillStyle = g; circle(ctx, cx, cy, r * .66); ctx.fill();
  // spokes (rotate -> reads as rolling)
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * .55); ctx.stroke(); }
  ctx.restore();
  // axle cap + spec
  ctx.fillStyle = shade(pal.bootHi, 30); circle(ctx, cx, cy, r * .2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(ctx, cx - r * .22, cy - r * .22, r * .12); ctx.fill();
}

interface EyeExpr { look: number; lookY: number; openV: number; squint: number; smile: number; iris: number; browTilt: number; blink: number; }

// ---- the expressive face: one big eye, fully clear, that emotes ----
function eyeFace(ctx: CanvasRenderingContext2D, ex: number, ey: number, R: number, pal: Required<RobotPalette>, e: EyeExpr) {
  ctx.save();
  // recessed socket
  ctx.fillStyle = shade(pal.bodyDark, -30); ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  circle(ctx, ex, ey, R + 1.6); ctx.fill(); ctx.stroke();
  // glowing lens base
  const lg = ctx.createRadialGradient(ex - R * .32, ey - R * .34, 1, ex, ey, R + 1);
  lg.addColorStop(0, '#f4ffff'); lg.addColorStop(.42, pal.core); lg.addColorStop(1, shade(pal.core, -80));
  ctx.fillStyle = lg; circle(ctx, ex, ey, R); ctx.fill();
  // clip to the lens for iris + lids + sparkle
  ctx.save(); circle(ctx, ex, ey, R); ctx.clip();
    // iris (looks around)
    const ix = ex + e.look * R * 0.34, iy = ey + (e.lookY || 0) * R * 0.24;
    const ir = R * 0.60 * e.iris;
    ctx.fillStyle = 'rgba(5,15,32,.96)'; circle(ctx, ix, iy, ir); ctx.fill();
    ctx.fillStyle = pal.core; circle(ctx, ix, iy, ir * 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; circle(ctx, ix, iy, ir * 0.2); ctx.fill();
    // eyelids — body colour ellipses sliding in from top & bottom = expression
    const lid = shade(pal.body, -4);
    ctx.fillStyle = lid;
    const lidE = (cx: number, cy: number, rx: number, ry: number, rot: number) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore(); };
    const ry = R * 1.3, rx = R * 1.7;
    // UP/LO = how far each lid edge sits from centre (in R units); bigger = more open
    const UP = 0.60 - e.squint * 0.45 - (1 - e.openV) * 0.35 - e.blink * 0.72;
    const LO = 0.60 - e.blink * 0.72 - e.smile * 1.0;     // smile raises lower lid -> happy crescent
    lidE(ex, (ey - UP * R) - ry, rx, ry, e.browTilt);     // upper (bottom edge = ey-UP*R)
    lidE(ex, (ey + LO * R) + ry, rx, ry, 0);              // lower (top edge = ey+LO*R)
    // sparkles (cuteness) sit on the glass, on top of lids
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    circle(ctx, ex - R * 0.33 + e.look * R * 0.12, ey - R * 0.36, R * 0.21); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    circle(ctx, ex + R * 0.22, ey + R * 0.2, R * 0.1); ctx.fill();
  ctx.restore();
  // crisp rim
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8; circle(ctx, ex, ey, R); ctx.stroke();
  // expressive gold brow
  ctx.save(); ctx.translate(ex, ey - R - 2.2); ctx.rotate(e.browTilt * 0.7);
  ctx.fillStyle = pal.hat; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  rr(ctx, -R * 0.96, -3.4, R * 1.92, 5, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-R * 0.82, -2.4, R * 1.45, 1.4);
  ctx.restore();
  ctx.restore();
}

// ---- signature coral scarf: knot + two fluttering tails ----
function scarfTails(ctx: CanvasRenderingContext2D, kx: number, ky: number, pal: Required<RobotPalette>, facing: number, t: number, energy: number) {
  const dir = -facing;
  const wind = clamp(energy, 0, 1);    // 0 at rest -> hangs straight down; 1 -> streams back
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  for (let s = 1; s >= 0; s--) {        // far tail first, near tail on top
    const len = 18 + s * 6, w0 = 7 - s * 2, ph = t * 6.2 + s * 1.7;
    const N = 9, top: number[][] = [], bot: number[][] = [], mid: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const back = dir * len * u * (0.28 + wind * 0.95);             // leans back as it moves
      const down = len * u * (0.78 - wind * 0.46);                   // gravity: hangs down, less when streaming
      const sway = Math.sin(t * 1.5 + u * 1.8) * 2.3 * (1 - wind) * u; // gentle idle pendulum
      const flutter = Math.sin(ph + u * 4.2) * energy * (7 + s * 2.5) * u;
      const cx = kx + back + sway;
      const cy = ky + down + flutter * 0.7;
      const ww = w0 * (1 - u * 0.8);
      top.push([cx, cy - ww * 0.5]); bot.push([cx, cy + ww * 0.5]); mid.push([cx, cy]);
    }
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(top[i][0], top[i][1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    ctx.fillStyle = s ? shade(pal.accent, -26) : pal.accent; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    if (s === 0) {                      // light streak so it reads as cloth
      ctx.strokeStyle = shade(pal.accent, 42); ctx.lineWidth = 1.6;
      ctx.beginPath(); for (let i = 0; i <= N; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, mid[i][0] + 1, mid[i][1]);
      ctx.stroke(); ctx.strokeStyle = INK;
    }
  }
  ctx.restore();
}

/**
 * Draw the treaded harpoon-bot. Returns the muzzle point {x, y} at the barrel
 * tip (in canvas space) so callers can spawn a projectile with no seam.
 */
export function drawBot(ctx: CanvasRenderingContext2D, x: number, groundY: number, pose: RobotPose): { x: number; y: number } {
  const pal = withDefaults(pose.pal ?? ROBOT_P2_PALETTE);
  const t = pose.t || 0, S = pose.scale || 1;
  const facing = pose.facing || 1, vx = pose.vx || 0, dist = pose.dist || 0;
  const env = fireEnv(pose.fireT);
  const speed = Math.abs(vx);

  // ---- emotion ----
  let cheer = 0, hop = 0;
  if (pose.cheerT != null && pose.cheerT >= 0 && pose.cheerT < 0.95) {
    cheer = Math.sin(clamp(pose.cheerT / 0.95, 0, 1) * Math.PI);
    hop = Math.max(0, Math.sin(pose.cheerT * 15)) * Math.exp(-pose.cheerT * 4) * 4;
  }
  let look = Math.sin(t * 0.8) * 0.55, lookY = Math.sin(t * 0.6 + 1) * 0.16;
  if (speed > 10) look = clamp(Math.sign(vx) * 0.72, -0.85, 0.85);
  let openV = 1, squint = 0, smile = 0, iris = 1, browTilt = 0;
  if (env.charge > 0) { const c = env.charge;
    squint = c * 0.55; iris = lerp(1, 0.62, c); browTilt = -0.30 * c; openV = lerp(1, 0.8, c);
    look = lerp(look, 0, clamp((pose.fireT || 0) / 0.09, 0, 1)); lookY = lerp(lookY, -0.18, c); }
  if (cheer > 0) { smile = Math.max(smile, cheer); iris = lerp(iris, 1.12, cheer); browTilt = lerp(browTilt, 0.12, cheer); lookY = lerp(lookY, -0.08, cheer); }
  const cyc = (t % 4.6), blink = (cyc > 4.25 && env.charge < 0.1 && cheer < 0.1) ? Math.sin((cyc - 4.25) / 0.32 * Math.PI) : 0;
  const expr: EyeExpr = { look, lookY, openV, squint, smile, iris, browTilt, blink };

  // --- geometry ---
  // A WIDE, FLAT tank track (wider than tall) at the bottom, with the rounded
  // hull sitting clearly on top. Earlier this was a near-circular band as tall
  // as the hull, which read as a spiky sea-mine at game scale.
  // sep (wheel separation) controls WIDTH; R (wheel radius) controls HEIGHT.
  // Keep R small so the bot stays short enough to slip under bubbles; widen via
  // sep to expose more road wheels.
  const R = 11, sep = 52, Rt = R + 4, wy = -R;
  const susBase = -6, idleBob = Math.sin(t * 2.1) * 1.4;
  const sus = susBase - env.recoil * 0.55 + idleBob;
  const pitch = env.pitch + clamp(-vx * 0.00018, -0.05, 0.05);

  ctx.save();
  ctx.translate(x, groundY); ctx.scale(S, S);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  /* shadow */
  ctx.save(); ctx.fillStyle = 'rgba(8,16,30,.22)'; ellipse(ctx, 0, 2, sep / 2 + R + 4, 7); ctx.fill(); ctx.restore();

  /* rolling dust */
  if (speed > 4) {
    const dir = Math.sign(vx) || facing; ctx.fillStyle = 'rgba(245,235,210,.5)';
    for (let i = 0; i < 4; i++) { const p = ((t * 4 + i * 0.37) % 1), r = 2 + p * 5, dx = -dir * (sep / 2 + R + p * 22), dy = -2 - p * 8 * Math.sin(p * 3);
      ctx.globalAlpha = (1 - p) * 0.5; circle(ctx, dx, dy, r); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  /* ============ TREAD UNIT (wide flat track) ============ */
  // Neutral gunmetal track — deliberately NOT the body colour, so the track
  // reads as mechanical tracks and contrasts against the coloured hull (a navy
  // track on a navy hull just merged into one dark blob). Carries a faint tint
  // of the palette boot so it still feels part of the same machine.
  const trkPal: Required<RobotPalette> = { ...pal, boot: '#4a525f', bootHi: '#828d9e' };
  // Outer rubber band — the dark tyre edge that frames the track.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillStyle = '#2c313b';
  ctx.beginPath();
  ctx.moveTo(-sep / 2, wy - Rt); ctx.lineTo(sep / 2, wy - Rt);
  ctx.arc(sep / 2, wy, Rt, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-sep / 2, wy + Rt);
  ctx.arc(-sep / 2, wy, Rt, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Inner track surface — bright top -> mid -> shaded bottom so it reads as a
  // lit metal track rather than a flat black ring.
  const trackG = ctx.createLinearGradient(0, wy - R, 0, wy + R);
  trackG.addColorStop(0, '#7a8493');
  trackG.addColorStop(0.5, '#4e5765');
  trackG.addColorStop(1, '#343a45');
  ctx.fillStyle = trackG;
  ctx.beginPath();
  ctx.moveTo(-sep / 2, wy - R + 1); ctx.lineTo(sep / 2, wy - R + 1);
  ctx.arc(sep / 2, wy, R - 1, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-sep / 2, wy + R - 1);
  ctx.arc(-sep / 2, wy, R - 1, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
  const ang = dist / R;
  // Road wheels: two big drive sprockets at the ends + three road wheels along
  // the bottom run. The wide track gives them room to read clearly.
  drawWheel(ctx, -sep / 2, wy, R, ang, trkPal); drawWheel(ctx, sep / 2, wy, R, ang, trkPal);
  drawWheel(ctx, -sep / 4, wy + 1, 6, ang, trkPal); drawWheel(ctx, sep / 4, wy + 1, 6, ang, trkPal);
  drawWheel(ctx, 0, wy + 1, 6, ang, trkPal);
  // Tread lugs — short ridges that sit INSIDE the band (not radial spikes), so
  // the scrolling reads as a moving track.
  const L = 7.5, P = 2 * sep + 2 * Math.PI * Rt, n = Math.floor(P / L);
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) { const pt = treadPoint(i * L + dist, sep, wy, Rt), lit = pt.ny < -0.2;
    ctx.strokeStyle = lit ? '#9aa4b2' : '#23272f';
    ctx.beginPath();
    ctx.moveTo(pt.x - pt.nx * 0.6, pt.y - pt.ny * 0.6);
    ctx.lineTo(pt.x - pt.nx * (Rt - R + 1.5), pt.y - pt.ny * (Rt - R + 1.5));
    ctx.stroke(); }
  // glossy highlight along the top run of the track
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-sep / 2 + 2, wy - Rt + 1.5); ctx.lineTo(sep / 2 - 2, wy - Rt + 1.5); ctx.stroke();

  /* ============ HULL group (rides + rocks + hops) ============ */
  ctx.save();
  ctx.translate(0, wy + sus - hop);
  ctx.rotate(pitch);

  // --- main hull (round + friendly) — sits clearly ON TOP of the track ---
  const hw = 26, hh = 28, hy = -33;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  const bg = ctx.createLinearGradient(-hw, hy - 6, hw, hy + hh);
  bg.addColorStop(0, pal.bodyHi); bg.addColorStop(.5, pal.body); bg.addColorStop(1, pal.bodyDark);
  ctx.fillStyle = bg; rr(ctx, -hw, hy, hw * 2, hh, [16, 16, 13, 13]); ctx.fill(); ctx.stroke();
  ctx.save(); rr(ctx, -hw, hy, hw * 2, hh, [16, 16, 13, 13]); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(-hw, hy); ctx.lineTo(hw, hy); ctx.lineTo(hw - 12, hy + 8); ctx.lineTo(-hw + 8, hy + 8); ctx.fill();
    ctx.fillStyle = 'rgba(10,24,50,.18)'; ctx.fillRect(-hw, hy + hh * 0.66, hw * 2, hh * 0.4);
  ctx.restore();
  // side rivets
  ctx.fillStyle = 'rgba(10,24,50,.5)';
  [-hw + 7, hw - 7].forEach(px => { circle(ctx, px, hy + hh - 7, 1.6); ctx.fill(); });

  // little reactor light low on the chest
  const corePulse = 0.5 + 0.5 * Math.sin(t * 3.2), coreBright = clamp(corePulse * 0.6 + env.charge, 0, 1);
  const cy0 = hy + hh - 8;
  const cg = ctx.createRadialGradient(0, cy0, 0, 0, cy0, 8 + coreBright * 4);
  cg.addColorStop(0, pal.core); cg.addColorStop(.4, pal.core); cg.addColorStop(1, 'rgba(70,224,255,0)');
  ctx.globalAlpha = 0.3 + coreBright * 0.5; ctx.fillStyle = cg; circle(ctx, 0, cy0, 8 + coreBright * 4); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = pal.core; ctx.strokeStyle = INK; ctx.lineWidth = 2; circle(ctx, 0, cy0, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; circle(ctx, -1, cy0 - 1, 1); ctx.fill();

  // ===== THE FACE — big, centred, unobstructed =====
  eyeFace(ctx, 0, hy + hh * 0.46, 12, pal, expr);

  // cheek bolts (tiny charm)
  ctx.fillStyle = 'rgba(10,24,50,.4)';
  circle(ctx, -hw + 8, hy + hh * 0.5, 1.4); ctx.fill(); circle(ctx, hw - 8, hy + hh * 0.5, 1.4); ctx.fill();

  // ===== SIGNATURE SCARF — knotted at the rear flank =====
  const scarfEnergy = clamp(speed / 120, 0, 1) * 1.3 + env.recoil * 0.07 + cheer * 0.95;
  scarfTails(ctx, -facing * 13, hy + 9, pal, facing, t, scarfEnergy);
  ctx.fillStyle = pal.accent; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  circle(ctx, -facing * 13, hy + 9, 4.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade(pal.accent, 30); circle(ctx, -facing * 13 - 1.4, hy + 7.6, 1.8); ctx.fill();

  // ===== HARPOON CANNON — top-mounted, vertical, clear of the face =====
  const barL = 18, turY = hy + env.recoil * 0.6;
  ctx.save(); ctx.translate(0, turY);
  // mount cradle (sits at the top, above the brow) — gunmetal, part of the gun
  ctx.fillStyle = '#454d5c'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  rr(ctx, -9, -7, 18, 11, 4); ctx.fill(); ctx.stroke();
  // cable spool
  ctx.fillStyle = '#5a6472'; circle(ctx, -11, 1, 4.5); ctx.fill(); ctx.stroke();
  for (let i = 2; i < 5; i++) { ctx.strokeStyle = 'rgba(255,206,74,.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(-11, 1, i, 0, TAU); ctx.stroke(); }
  // barrel — gunmetal so it reads as a launcher (a weapon), not a body part.
  const barg = ctx.createLinearGradient(-6.5, 0, 6.5, 0);
  barg.addColorStop(0, '#363c47'); barg.addColorStop(.45, '#8b96a6'); barg.addColorStop(1, '#3a4150');
  ctx.fillStyle = barg; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  rr(ctx, -6.5, -barL - 5, 13, barL + 8, [5, 5, 3, 3]); ctx.fill(); ctx.stroke();
  // charge glow inside
  const ch = clamp(env.charge, 0, 1);
  if (ch > 0.02) { ctx.save(); rr(ctx, -6.5, -barL - 5, 13, barL + 8, [5, 5, 3, 3]); ctx.clip();
    const gg = ctx.createLinearGradient(0, -barL - 3, 0, 0); gg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * ch) + ')'); gg.addColorStop(1, 'rgba(70,224,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(-7, -barL - 5, 14, barL + 8); ctx.restore(); }
  // gold muzzle collar
  ctx.fillStyle = pal.hat; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  rr(ctx, -7.5, -barL - 9, 15, 6, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-5.5, -barL - 8, 11, 1.4);
  // loaded harpoon tip peeking out when idle — sells "harpoon launcher" and
  // retracts the instant a shot is charging/firing (env.charge > 0).
  if (env.charge <= 0.02) {
    const tipY = -barL - 9;
    ctx.fillStyle = '#e9eef5'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, tipY - 8); ctx.lineTo(3.2, tipY - 1); ctx.lineTo(-3.2, tipY - 1); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.hat;
    ctx.beginPath(); ctx.moveTo(0, tipY - 6); ctx.lineTo(1.6, tipY - 2); ctx.lineTo(-1.6, tipY - 2); ctx.closePath(); ctx.fill();
  }
  // muzzle flash
  if (env.flash > 0.02) { const fy = -barL - 9;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(0, fy, 0, 0, fy, 22 * env.flash);
    fg.addColorStop(0, 'rgba(255,255,255,' + env.flash + ')'); fg.addColorStop(.4, 'rgba(255,206,74,' + (0.8 * env.flash) + ')'); fg.addColorStop(1, 'rgba(255,93,84,0)');
    ctx.fillStyle = fg; circle(ctx, 0, fy, 22 * env.flash); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,' + env.flash + ')'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.42; ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(Math.cos(a) * 16 * env.flash, fy + Math.sin(a) * 16 * env.flash); ctx.stroke(); }
    ctx.restore(); }
  // smoke
  if (env.smoke > 0.05) { ctx.fillStyle = 'rgba(210,220,230,' + (0.4 * env.smoke) + ')'; const sy = -barL - 11 - env.smoke * 8;
    circle(ctx, 3 * Math.sin(t * 9), sy, 3 + env.smoke * 4); ctx.fill(); circle(ctx, -4, sy + 3, 2 + env.smoke * 3); ctx.fill(); }
  ctx.restore(); // cannon

  // ===== SMALL SENSOR ANTENNA — drawn AFTER the cannon so it's never hidden =====
  const sway = clamp(-vx * 0.0016, -0.45, 0.45) + env.recoil * 0.02 + cheer * Math.sin(t * 22) * 0.12;
  ctx.save(); ctx.translate(-facing * 20, hy + 6);
  ctx.fillStyle = pal.bodyDark; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 2.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const tx = Math.sin(sway) * 6, ty = -13 + Math.cos(sway) * 1.5, mx = tx * 0.4, my = -7;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  ctx.strokeStyle = shade(pal.bodyHi, 8); ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  ctx.fillStyle = shade(pal.core, -30); ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  circle(ctx, tx, ty, 2.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(ctx, tx - 0.7, ty - 0.7, 0.8); ctx.fill();
  ctx.restore();

  const muzzleLocalY = (wy + sus - hop) + (turY - barL - 9);
  ctx.restore(); // hull group
  ctx.restore(); // bot

  return { x: x, y: groundY + muzzleLocalY * S };
}

/** Resting muzzle height above the ground in unscaled bot units. Lets callers
 *  (e.g. Player.getMuzzle) resolve a spawn point synchronously, before draw. */
export const ROBOT_MUZZLE_LOCAL_Y = -77;
