export interface Rect { x: number; y: number; w: number; h: number; }

// ============================ UTILITIES =============================
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const sign = v => (v < 0 ? -1 : 1);

/** Circle vs axis-aligned rectangle collision.
 *  Returns penetration normal+depth if overlapping, else null. */
export function collideCircleRect(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX, dy = cy - closestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  const d = Math.sqrt(d2) || 0.0001;
  return { nx: dx / d, ny: dy / d, depth: r - d };
}

export function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True if a point moving vertically from y0 to y1 (in either direction), at
 *  horizontal position x with half-width padding, sweeps through an
 *  axis-aligned rect. Unlike a single end-of-frame point/circle check, this
 *  catches fast-moving projectiles/balls whose per-frame step is larger than
 *  a thin platform is thick — without it, a shot can "teleport" from one
 *  side of a platform to the other within a single physics tick and never
 *  register a hit. */
export function sweepHitsRect(x: number, y0: number, y1: number, halfW: number, rx: number, ry: number, rw: number, rh: number): boolean {
  if (x + halfW < rx || x - halfW > rx + rw) return false;
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  return bottom >= ry && top <= ry + rh;
}

/** Compact number formatter for stat readouts — 12480 → "12.5k", 2_400_000 → "2.4m". */
export function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
}
