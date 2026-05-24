import { AudioSys } from './audio';
import { W, H } from '../constants';

// ============================ INPUT =================================
export const keys: Record<string, boolean> = {};        // currently held
export const keysPressed: Record<string, boolean> = {}; // single-frame edge triggers

// Pointer (mouse/touch) state. Coordinates are in canvas logical space (W x H).
export const pointer = {
  x: 0,
  y: 0,
  down: false,
  pressed: false,        // single-frame edge trigger (consume with consumePointer)
  pressedX: 0,
  pressedY: 0,
};

// Touch device detection: true if the device reports any touch capability.
// A hybrid laptop with both touch and keyboard will be classified as touch — we
// accept this and let the controls be visible.
export const isTouchDevice =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

// On-canvas touch button rects (logical canvas coords). Public so renderer can draw them.
//
// Layout intent: keep the buttons tucked into the very bottom corners so they
// overlap minimally with the action zone (player movement / low-bouncing balls).
// Ground sits at GROUND_Y=488; the buttons start at y=454 and extend to
// y=H-6=534. That puts about 34px of overlap at the player's feet, which the
// translucent button fill (alpha 0.22 when idle) makes acceptable. The
// previous layout intruded 112px into the action zone — readable but visually
// obstructive on a phone.
export const TOUCH_BUTTONS = {
  left:  { x:  14, y: 454, w:  88, h:  80 },
  right: { x: 110, y: 454, w:  88, h:  80 },
  fire:  { x: W - 134, y: 454, w: 120, h: 80 },
  pause: { x: W - 52, y: 8, w: 44, h: 44 },
};

let canvasEl: HTMLCanvasElement | null = null;

// Active touches, keyed by Touch.identifier. Used to support multi-touch
// (player holds a direction button AND fires at the same time).
const touches = new Map<number, { x: number; y: number }>();

// Cached "is this touch-button currently held by any touch" state, so we know
// when to release the synthetic key on the rising/falling edge.
const touchKeyState = { left: false, right: false, fire: false };

// Pause button is edge-triggered (single press → single fire) to avoid spamming.
let pausePressedEdge = false;

function toCanvasCoords(clientX: number, clientY: number) {
  if (!canvasEl) return { x: 0, y: 0 };
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function pointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * Recompute synthetic keys from the current set of active touches.
 * Called whenever touches change, and once per frame from game.update().
 *
 * The "touch only owns the key while a touch is over the button" invariant
 * keeps keyboard and touch from fighting: keyboard keys remain in place
 * unless touch had been driving the key in the previous tick and is no longer.
 */
function updateTouchKeys(touchControlsEnabled: boolean) {
  if (!touchControlsEnabled) {
    // Release anything touch had been holding.
    if (touchKeyState.left)  { keys['ArrowLeft']  = false; touchKeyState.left  = false; }
    if (touchKeyState.right) { keys['ArrowRight'] = false; touchKeyState.right = false; }
    if (touchKeyState.fire)  { keys['Space']      = false; touchKeyState.fire  = false; }
    return;
  }

  let leftHeld = false, rightHeld = false, fireHeld = false, pauseTapped = false;
  for (const t of touches.values()) {
    if (pointInRect(t.x, t.y, TOUCH_BUTTONS.left))  leftHeld  = true;
    if (pointInRect(t.x, t.y, TOUCH_BUTTONS.right)) rightHeld = true;
    if (pointInRect(t.x, t.y, TOUCH_BUTTONS.fire))  fireHeld  = true;
  }

  // Apply with proper edge handling per side.
  if (leftHeld) {
    if (!keys['ArrowLeft']) keysPressed['ArrowLeft'] = true;
    keys['ArrowLeft'] = true;
  } else if (touchKeyState.left) {
    keys['ArrowLeft'] = false;
  }
  if (rightHeld) {
    if (!keys['ArrowRight']) keysPressed['ArrowRight'] = true;
    keys['ArrowRight'] = true;
  } else if (touchKeyState.right) {
    keys['ArrowRight'] = false;
  }
  if (fireHeld) {
    if (!keys['Space']) keysPressed['Space'] = true;
    keys['Space'] = true;
  } else if (touchKeyState.fire) {
    keys['Space'] = false;
  }

  touchKeyState.left  = leftHeld;
  touchKeyState.right = rightHeld;
  touchKeyState.fire  = fireHeld;
  void pauseTapped;
}

/** Bind pointer events to the game canvas. Called once at startup from main.ts. */
export function bindCanvasInput(canvas: HTMLCanvasElement) {
  canvasEl = canvas;
  // Prevent iOS double-tap zoom and rubber-band scroll on the canvas surface.
  canvas.style.touchAction = 'none';

  canvas.addEventListener('mousemove', e => {
    const p = toCanvasCoords(e.clientX, e.clientY);
    pointer.x = p.x; pointer.y = p.y;
  });
  canvas.addEventListener('mousedown', e => {
    const p = toCanvasCoords(e.clientX, e.clientY);
    pointer.x = p.x; pointer.y = p.y;
    pointer.pressedX = p.x; pointer.pressedY = p.y;
    pointer.down = true; pointer.pressed = true;
    if (isTouchDevice && pointInRect(p.x, p.y, TOUCH_BUTTONS.pause)) pausePressedEdge = true;
    AudioSys.init();
  });
  window.addEventListener('mouseup', () => { pointer.down = false; });

  const handleTouches = (touchList: TouchList) => {
    // Rebuild the active-touches map from the current TouchList. Using
    // changedTouches alone misses cases where a finger is still down but
    // moved into/out of a button; targetTouches gives us the full set.
    touches.clear();
    for (let i = 0; i < touchList.length; i++) {
      const t = touchList[i];
      const p = toCanvasCoords(t.clientX, t.clientY);
      touches.set(t.identifier, p);
    }
    // Mirror the most recent touch into `pointer` so menus / pause-button
    // hit tests keep working with the same code path as mouse clicks.
    if (touchList.length > 0) {
      const t = touchList[touchList.length - 1];
      const p = toCanvasCoords(t.clientX, t.clientY);
      pointer.x = p.x; pointer.y = p.y;
    }
    updateTouchKeys(true);
  };

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    // Per-touch press detection: any new touch can fire the pause edge and
    // synthesize a pointer-press for menus.
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const p = toCanvasCoords(t.clientX, t.clientY);
      pointer.x = p.x; pointer.y = p.y;
      pointer.pressedX = p.x; pointer.pressedY = p.y;
      pointer.down = true; pointer.pressed = true;
      if (pointInRect(p.x, p.y, TOUCH_BUTTONS.pause)) pausePressedEdge = true;
    }
    handleTouches(e.targetTouches);
    AudioSys.init();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    handleTouches(e.targetTouches);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    handleTouches(e.targetTouches);
    if (e.targetTouches.length === 0) pointer.down = false;
  }, { passive: false });
  canvas.addEventListener('touchcancel', e => {
    handleTouches(e.targetTouches);
    if (e.targetTouches.length === 0) pointer.down = false;
  });
}

window.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) keysPressed[e.code] = true;
  keys[e.code] = true;
  AudioSys.init(); // user gesture unlocks audio
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  pointer.down = false;
  touches.clear();
  updateTouchKeys(isTouchDevice);
});

export function consumePressed(code: string) {
  if (keysPressed[code]) { keysPressed[code] = false; return true; }
  return false;
}

/** Consume a single-frame click/tap. Returns true once per press. */
export function consumePointer() {
  if (pointer.pressed) { pointer.pressed = false; return true; }
  return false;
}

/** Consume a single-frame tap on the on-canvas pause button. */
export function consumePauseTap() {
  if (pausePressedEdge) { pausePressedEdge = false; return true; }
  return false;
}

/** Returns true if any meaningful "go" input fired this frame: Enter/Space/click/tap. */
export function consumeAnyConfirm() {
  if (consumePointer()) return true;
  if (consumePressed('Enter')) return true;
  if (consumePressed('Space')) return true;
  return false;
}

/** Returns true if ANY key was pressed this frame, or pointer clicked. Use sparingly. */
export function consumeAnyInput() {
  if (consumePointer()) return true;
  for (const k in keysPressed) {
    if (keysPressed[k]) { keysPressed[k] = false; return true; }
  }
  return false;
}

/** Rect hit test against the most recent pointer-down position. */
export function pointerHit(x: number, y: number, w: number, h: number) {
  return pointer.pressedX >= x && pointer.pressedX <= x + w
      && pointer.pressedY >= y && pointer.pressedY <= y + h;
}

/** Rect hover test against current pointer position. */
export function pointerOver(x: number, y: number, w: number, h: number) {
  return pointer.x >= x && pointer.x <= x + w
      && pointer.y >= y && pointer.y <= y + h;
}

/** Called once per frame from game.update() while in PLAYING. */
export function tickTouchInputs(enabled: boolean) {
  updateTouchKeys(enabled);
}

/** Whether any touch is currently held over a given button id (for rendering). */
export function isTouchButtonHeld(id: 'left' | 'right' | 'fire' | 'pause') {
  if (id === 'left')  return touchKeyState.left;
  if (id === 'right') return touchKeyState.right;
  if (id === 'fire')  return touchKeyState.fire;
  // pause has no held state, only edge — return whether pointer is currently
  // over it for hover-style feedback.
  return pointInRect(pointer.x, pointer.y, TOUCH_BUTTONS.pause) && pointer.down;
}
