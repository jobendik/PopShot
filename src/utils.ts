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
