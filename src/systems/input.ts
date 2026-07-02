import { AudioSys } from './audio';
import { H, State, W, type GameState } from '../constants';
import { Storage } from './storage';
import type { Game } from '../game';

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

// Mark the document as touch-capable so CSS can gate the on-screen movement
// zones on the SAME signal the JS uses. We deliberately do NOT gate the zones
// on `@media (hover: none) and (pointer: coarse)` alone: that media query tests
// the device's *primary* pointer, and a large slice of Android Chrome devices
// (foldables, tablets, Samsung DeX phones, anything that ever paired a stylus /
// mouse / Bluetooth pointer) report the primary pointer as `fine` / `hover`
// even though they have a touchscreen. On those devices the media query fails
// to match, the zones never get `pointer-events: auto`, and the player can't
// move — while auto-fire (pure JS) keeps working, so the game looks alive but
// frozen in place. iOS Safari always reports coarse/no-hover, which is why the
// bug is invisible there. `maxTouchPoints` is the reliable cross-device signal.
if (typeof document !== 'undefined' && isTouchDevice) {
  document.documentElement.classList.add('is-touch');
}

let canvasEl: HTMLCanvasElement | null = null;

// Auto-fire ownership tracking. Declared up here so the window.blur handler
// (further down) can clear it without hitting the TDZ.
let _autoFireActive = false;

const GAMEPAD_AXIS_DEADZONE = 0.35;
// Player 1's controller drives the same synthetic keys as the keyboard's
// arrows/Space/etc. Players 2, 3 and 4 don't have dedicated physical
// keyboard keys of their own (their keyboard fallback — J/L/I, A/S/D/W and
// L/K/J/I — literally reuses P1's/P2's keys), so their gamepads instead
// drive dedicated synthetic codes (Gamepad2*/Gamepad3*/Gamepad4*) that
// entities/player.ts reads in addition to the keyboard letters. This is
// required, not cosmetic: if P2's controller drove the raw KeyJ/KeyL/KeyI
// codes, it would also satisfy P4's keyboard-fallback checks and silently
// puppet Player 4 too. Keeping one state map per pad means a controller
// unplugging (or simply not being present) only releases the keys IT was
// holding, never another player's.
const gamepadKeyState: Record<string, boolean> = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  Space: false,
  Escape: false,
  KeyP: false,
  KeyR: false,
  KeyM: false,
};
const gamepad2KeyState: Record<string, boolean> = {
  Gamepad2Left: false,
  Gamepad2Right: false,
  Gamepad2Shoot: false,
};
const gamepad3KeyState: Record<string, boolean> = {
  Gamepad3Left: false,
  Gamepad3Right: false,
  Gamepad3Shoot: false,
};
const gamepad4KeyState: Record<string, boolean> = {
  Gamepad4Left: false,
  Gamepad4Right: false,
  Gamepad4Shoot: false,
};

function applySyntheticKey(code: string, held: boolean, sourceState: Record<string, boolean>) {
  if (held) {
    if (!keys[code]) keysPressed[code] = true;
    keys[code] = true;
    sourceState[code] = true;
  } else if (sourceState[code]) {
    keys[code] = false;
    sourceState[code] = false;
  }
}

function releaseSyntheticKeys(sourceState: Record<string, boolean>) {
  for (const code in sourceState) applySyntheticKey(code, false, sourceState);
}

/** All connected gamepads, ordered by their stable browser-assigned index
 *  (not by array slot, which can contain gaps once a pad disconnects). The
 *  first entry drives Player 1, the second Player 2, the third Player 3, and
 *  the fourth Player 4 — this lets up to four standard-mapping controllers
 *  (e.g. PS5/DualSense) play local co-op together. */
function getConnectedGamepads(): Gamepad[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  const pads = navigator.getGamepads();
  const connected: Gamepad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad?.connected) connected.push(pad);
  }
  connected.sort((a, b) => a.index - b.index);
  return connected;
}

function toCanvasCoords(clientX: number, clientY: number) {
  if (!canvasEl) return { x: 0, y: 0 };
  const rect = canvasEl.getBoundingClientRect();

  // Portrait auto-rotate (see `.is-rotated #stage` in base.css /
  // installViewportSizing() in viewport.ts): the stage is spun 90° in place
  // via `transform: rotate(90deg)` so the fixed 16:9 world fills a portrait
  // viewport. getBoundingClientRect() reports the rotated (visual) box, so
  // its width/height come back swapped relative to the canvas's own
  // pre-rotation layout box. Undo the rotation around the box's center to
  // recover the pre-rotation local point before scaling into world units.
  if (document.documentElement.classList.contains('is-rotated')) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const localW = rect.height; // canvas's own (pre-rotation) CSS width
    const localH = rect.width;  // canvas's own (pre-rotation) CSS height
    const localX = localW / 2 + dy;
    const localY = localH / 2 - dx;
    return {
      x: localX * (W / localW),
      y: localY * (H / localH),
    };
  }

  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/** Bind pointer/touch events to the game canvas. Called once at startup from
 *  main.ts. Maintains the `pointer` struct used by menu hit-tests and the
 *  intro-dismiss path. Touch button input is owned by the DOM controls in
 *  src/ui/hud/touchControls.html.ts — that path runs over the top of these
 *  listeners since the buttons sit above the canvas with pointer-events: auto. */
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
    AudioSys.init();
  });
  window.addEventListener('mouseup', () => { pointer.down = false; });

  const syncFromTouchList = (touchList: TouchList) => {
    // Mirror the most recent touch into `pointer` so menus / on-canvas
    // hit-tests keep working with the same code path as mouse clicks.
    if (touchList.length === 0) return;
    const t = touchList[touchList.length - 1];
    const p = toCanvasCoords(t.clientX, t.clientY);
    pointer.x = p.x; pointer.y = p.y;
  };

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const p = toCanvasCoords(t.clientX, t.clientY);
      pointer.x = p.x; pointer.y = p.y;
      pointer.pressedX = p.x; pointer.pressedY = p.y;
      pointer.down = true; pointer.pressed = true;
    }
    syncFromTouchList(e.targetTouches);
    AudioSys.init();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    syncFromTouchList(e.targetTouches);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    syncFromTouchList(e.targetTouches);
    if (e.targetTouches.length === 0) pointer.down = false;
  }, { passive: false });
  canvas.addEventListener('touchcancel', e => {
    syncFromTouchList(e.targetTouches);
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
  _autoFireActive = false;
  // Touch controls have their own blur recovery in touchControls.html.ts —
  // they listen on window pointerup which fires during a tab-out blur.
});

// ---- Mobile zoom suppression ------------------------------------------------
// iOS Safari ignores the `user-scalable=no` viewport flag, so double-tap-to-zoom
// and pinch-zoom still fire on top of the game. Because the player taps rapidly
// to move, the screen kept zooming in mid-game. `touch-action: manipulation`
// (set in base.css) kills the double-tap zoom on compliant browsers; these
// listeners are the belt-and-suspenders path for iOS Safari, which needs an
// explicit preventDefault on its non-standard gesture events and on the second
// tap of a rapid pair. Interactive HTML controls (pause, menu buttons) are
// exempted so their tap → synthetic click still fires.
if (typeof document !== 'undefined') {
  // Max gap (ms) between two taps for the pair to count as a double-tap.
  const DOUBLE_TAP_MS = 300;
  const stopGesture = (e: Event) => e.preventDefault();
  for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(evt, stopGesture, { passive: false });
  }
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e: TouchEvent) => {
    const now = Date.now();
    const target = e.target as HTMLElement | null;
    const interactive = !!target?.closest('button, a, input, select, textarea, [role="button"]');
    // Two taps within DOUBLE_TAP_MS are what browsers treat as a double-tap
    // (the same window used for the legacy 300ms click delay); cancelling the
    // second one suppresses the zoom without affecting normal single taps.
    if (now - lastTouchEnd <= DOUBLE_TAP_MS && !interactive) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('dblclick', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('button, a, input, select, textarea, [role="button"]')) e.preventDefault();
  }, { passive: false });
}

export function consumePressed(code: string) {
  if (keysPressed[code]) { keysPressed[code] = false; return true; }
  return false;
}

/** Consume a single-frame click/tap. Returns true once per press. */
export function consumePointer() {
  if (pointer.pressed) { pointer.pressed = false; return true; }
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

/** Rect hover test against current pointer position. As a side effect, records
 *  the hovered rect so flushHoverSound() (called once per render frame) can
 *  fire a single hover SFX when the cursor crosses into a different button. */
export function pointerOver(x: number, y: number, w: number, h: number) {
  const over = pointer.x >= x && pointer.x <= x + w
            && pointer.y >= y && pointer.y <= y + h;
  if (over) _frameHoverKey = x + ',' + y + ',' + w + ',' + h;
  return over;
}

let _frameHoverKey: string | null = null;
let _lastHoverKey: string | null = null;

/** Call once per render frame, after the state's draw runs. Fires AudioSys.hover()
 *  on the frame the cursor transitions onto a new button (or back onto one after
 *  leaving). No-op on touch / when nothing is hovered. */
export function flushHoverSound() {
  if (_frameHoverKey && _frameHoverKey !== _lastHoverKey) {
    AudioSys.hover();
  }
  _lastHoverKey = _frameHoverKey;
  _frameHoverKey = null;
}

/**
 * When auto-fire is active, this module drives `keys.Space = true`. When it
 * deactivates (state change, setting flip, player dies, onboarding overlay
 * shown), we release Space only if auto-fire was the one holding it down —
 * never stomp on a manual keypress.
 */
/**
 * Mobile-only auto-fire driver. Called once per frame from game.update().
 *
 * Active iff: touch device AND user opted in (Storage.mobileAutoFire)
 *          AND state === PLAYING
 *          AND there is a live (non-dead) player
 *          AND the intro banner has dismissed
 *          AND the first-play onboarding overlay has been seen.
 *
 * Last condition matters: we don't want the player's harpoon firing into
 * the ceiling while the "tap LEFT/RIGHT to move" overlay is still up.
 */
export function tickAutoFire(game: Game) {
  const active =
    isTouchDevice &&
    game.state === State.PLAYING &&
    !!game.player &&
    !game.player.dead &&
    game.introTimer <= 0 &&
    !!Storage.data.mobileOnboardingSeen;

  if (active) {
    if (!keys['Space']) keysPressed['Space'] = true;
    keys['Space'] = true;
    _autoFireActive = true;
  } else if (_autoFireActive) {
    // We previously owned Space; release it now. Manual fire (DOM Fire
    // button, keyboard Space) will set keys.Space = true again on its
    // own this frame or the next.
    keys['Space'] = false;
    _autoFireActive = false;
  }
}

/** Poll the browser Gamepad API and synthesize the keyboard codes the rest of
 *  the game already understands. This keeps controller support centralized in
 *  one place instead of teaching every game state about buttons.
 *
 *  Supports up to four simultaneous controllers for local co-op: the first
 *  connected pad drives Player 1 (arrows/Space/menu buttons), the second
 *  drives Player 2 (JKL + I, mirroring the keyboard co-op scheme), and the
 *  third/fourth drive Players 3/4 via dedicated synthetic keys (see
 *  entities/player.ts). Plugging in a second PS5/standard-mapping controller
 *  while in PLAYING will join Player 2 the same way pressing I/K/U on the
 *  keyboard does, since both paths just set the same synthetic keys — and
 *  likewise for a third/fourth controller joining Players 3/4. */
export function tickGamepadInputs(state: GameState) {
  const [pad1, pad2, pad3, pad4] = getConnectedGamepads();
  let anyActivity = false;

  if (!pad1) {
    releaseSyntheticKeys(gamepadKeyState);
  } else {
    const axisX = pad1.axes[0] ?? 0;
    const axisY = pad1.axes[1] ?? 0;
    const horizontalLeft = axisX <= -GAMEPAD_AXIS_DEADZONE || !!pad1.buttons[14]?.pressed;
    const horizontalRight = axisX >= GAMEPAD_AXIS_DEADZONE || !!pad1.buttons[15]?.pressed;
    const verticalEnabled = state !== State.PLAYING;
    const verticalUp = verticalEnabled && (axisY <= -GAMEPAD_AXIS_DEADZONE || !!pad1.buttons[12]?.pressed);
    const verticalDown = verticalEnabled && (axisY >= GAMEPAD_AXIS_DEADZONE || !!pad1.buttons[13]?.pressed);

    applySyntheticKey('ArrowLeft', horizontalLeft && !horizontalRight, gamepadKeyState);
    applySyntheticKey('ArrowRight', horizontalRight && !horizontalLeft, gamepadKeyState);
    applySyntheticKey('ArrowUp', verticalUp && !verticalDown, gamepadKeyState);
    applySyntheticKey('ArrowDown', verticalDown && !verticalUp, gamepadKeyState);

    // Standard-mapped PS5/DualSense buttons in browsers:
    // Cross = 0, Circle = 1, Square = 2, Triangle = 3, Options = 9.
    applySyntheticKey('Space', !!pad1.buttons[0]?.pressed, gamepadKeyState);
    applySyntheticKey('Escape', !!pad1.buttons[1]?.pressed, gamepadKeyState);
    applySyntheticKey('KeyR', !!pad1.buttons[2]?.pressed, gamepadKeyState);
    applySyntheticKey('KeyM', !!pad1.buttons[3]?.pressed, gamepadKeyState);
    applySyntheticKey('KeyP', !!pad1.buttons[9]?.pressed, gamepadKeyState);

    if (
      horizontalLeft || horizontalRight || verticalUp || verticalDown
      || pad1.buttons[0]?.pressed || pad1.buttons[1]?.pressed || pad1.buttons[2]?.pressed
      || pad1.buttons[3]?.pressed || pad1.buttons[9]?.pressed
    ) {
      anyActivity = true;
    }
  }

  if (!pad2) {
    releaseSyntheticKeys(gamepad2KeyState);
  } else {
    const axisX = pad2.axes[0] ?? 0;
    const horizontalLeft = axisX <= -GAMEPAD_AXIS_DEADZONE || !!pad2.buttons[14]?.pressed;
    const horizontalRight = axisX >= GAMEPAD_AXIS_DEADZONE || !!pad2.buttons[15]?.pressed;
    // Cross/Circle/Square (buttons 0/1/2) all fire for P2. Note: this used to
    // drive the raw KeyJ/KeyL/KeyI codes, which entities/player.ts's P4
    // branch ALSO reads as its keyboard fallback — so plugging in a second
    // controller silently drove Player 4 too (one person "playing two
    // players"). Using dedicated Gamepad2* synthetic codes (mirroring how
    // pads 3/4 already work) keeps P2's controller from leaking into P4.
    const shoot = !!pad2.buttons[0]?.pressed || !!pad2.buttons[1]?.pressed || !!pad2.buttons[2]?.pressed;

    applySyntheticKey('Gamepad2Left', horizontalLeft && !horizontalRight, gamepad2KeyState);
    applySyntheticKey('Gamepad2Right', horizontalRight && !horizontalLeft, gamepad2KeyState);
    applySyntheticKey('Gamepad2Shoot', shoot, gamepad2KeyState);

    if (horizontalLeft || horizontalRight || shoot) anyActivity = true;
  }

  if (!pad3) {
    releaseSyntheticKeys(gamepad3KeyState);
  } else {
    const axisX = pad3.axes[0] ?? 0;
    const horizontalLeft = axisX <= -GAMEPAD_AXIS_DEADZONE || !!pad3.buttons[14]?.pressed;
    const horizontalRight = axisX >= GAMEPAD_AXIS_DEADZONE || !!pad3.buttons[15]?.pressed;
    const shoot = !!pad3.buttons[0]?.pressed || !!pad3.buttons[1]?.pressed || !!pad3.buttons[2]?.pressed;

    applySyntheticKey('Gamepad3Left', horizontalLeft && !horizontalRight, gamepad3KeyState);
    applySyntheticKey('Gamepad3Right', horizontalRight && !horizontalLeft, gamepad3KeyState);
    applySyntheticKey('Gamepad3Shoot', shoot, gamepad3KeyState);

    if (horizontalLeft || horizontalRight || shoot) anyActivity = true;
  }

  if (!pad4) {
    releaseSyntheticKeys(gamepad4KeyState);
  } else {
    const axisX = pad4.axes[0] ?? 0;
    const horizontalLeft = axisX <= -GAMEPAD_AXIS_DEADZONE || !!pad4.buttons[14]?.pressed;
    const horizontalRight = axisX >= GAMEPAD_AXIS_DEADZONE || !!pad4.buttons[15]?.pressed;
    const shoot = !!pad4.buttons[0]?.pressed || !!pad4.buttons[1]?.pressed || !!pad4.buttons[2]?.pressed;

    applySyntheticKey('Gamepad4Left', horizontalLeft && !horizontalRight, gamepad4KeyState);
    applySyntheticKey('Gamepad4Right', horizontalRight && !horizontalLeft, gamepad4KeyState);
    applySyntheticKey('Gamepad4Shoot', shoot, gamepad4KeyState);

    if (horizontalLeft || horizontalRight || shoot) anyActivity = true;
  }

  if (anyActivity) AudioSys.init();
}


