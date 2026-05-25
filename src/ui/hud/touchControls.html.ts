/**
 * DOM touch controls — Left / Right movement + Fire.
 *
 * Multi-touch model:
 *   - pointerdown on a button starts tracking that pointerId.
 *   - pointermove / pointerup / pointercancel are bound to WINDOW so a
 *     finger can move between buttons (and off the screen edge) without
 *     losing tracking. On every move we hit-test the current xy against
 *     all three buttons and update which (if any) that pointer is over.
 *   - The union of "held by any pointer" drives the synthetic `keys[]`
 *     entries the rest of the game already reads.
 *
 * This eliminates the slide-off bug in the old `pointerleave`-based code,
 * where a finger sliding from Left → Right left a frame with neither held.
 *
 * Visuals: the three buttons live in a flex row anchored to the bottom of
 * the stage. Left+Right pair on the movement side, Fire on the action
 * side. `body.is-lefty` swaps movement to the right via CSS.
 */

import { keys, keysPressed, isTouchDevice } from '../../systems/input';
import { Haptics } from '../../systems/haptics';
import { Storage } from '../../systems/storage';
import { AudioSys } from '../../systems/audio';

type BtnId = 'left' | 'right' | 'fire';

const KEY_FOR: Record<BtnId, string> = {
  left:  'ArrowLeft',
  right: 'ArrowRight',
  fire:  'Space',
};

const buttons: Record<BtnId, HTMLElement | null> = { left: null, right: null, fire: null };
const activePointer = new Map<number, BtnId | null>();
const held: Record<BtnId, boolean> = { left: false, right: false, fire: false };

function hitTest(clientX: number, clientY: number): BtnId | null {
  // Hit-test in priority order — fire wins over left/right if rects overlap
  // (they don't today, but cheaper to be explicit than to rely on layout).
  for (const id of ['fire', 'left', 'right'] as const) {
    const el = buttons[id];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return id;
  }
  return null;
}

function applyHeld(next: Record<BtnId, boolean>) {
  for (const id of ['left', 'right', 'fire'] as const) {
    if (next[id] === held[id]) continue;
    const key = KEY_FOR[id];
    const el = buttons[id];
    if (next[id]) {
      if (!keys[key]) keysPressed[key] = true;
      keys[key] = true;
      el?.classList.add('is-held');
      Haptics.tap();
    } else {
      keys[key] = false;
      el?.classList.remove('is-held');
    }
    held[id] = next[id];
  }
}

function recompute() {
  const next: Record<BtnId, boolean> = { left: false, right: false, fire: false };
  for (const id of activePointer.values()) if (id) next[id] = true;
  applyHeld(next);
}

function onPointerDown(e: PointerEvent) {
  const btn = hitTest(e.clientX, e.clientY);
  if (!btn) return;
  // Prevent the browser from synthesizing a long-press context menu / drag
  // image, and from sending duplicate mouse events to the canvas underneath.
  e.preventDefault();
  activePointer.set(e.pointerId, btn);
  recompute();
  AudioSys.init();   // user gesture — unlock audio if still locked
}

function onPointerMove(e: PointerEvent) {
  if (!activePointer.has(e.pointerId)) return;
  const next = hitTest(e.clientX, e.clientY);
  if (next !== activePointer.get(e.pointerId)) {
    activePointer.set(e.pointerId, next);
    recompute();
  }
}

function releasePointer(e: PointerEvent) {
  if (!activePointer.has(e.pointerId)) return;
  activePointer.delete(e.pointerId);
  recompute();
}

/** Called from input.ts on window blur — drop everything cleanly so no key
 *  ends up stuck in the held state after a tab-out. */
export function releaseAllTouchControls() {
  if (activePointer.size === 0 && !held.left && !held.right && !held.fire) return;
  activePointer.clear();
  applyHeld({ left: false, right: false, fire: false });
}

/** Apply the current saved scale + lefty preferences to the controls. Idempotent
 *  — safe to call on any settings change or at boot. */
export function applyTouchControlSettings() {
  const scale = Math.max(0.6, Math.min(1.4, Storage.data.mobileTouchScale || 1));
  document.body.style.setProperty('--touch-scale', String(scale));
  document.body.classList.toggle('is-lefty', !!Storage.data.mobileLefty);
}

export function buildTouchControls(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  // Built but hidden on desktop. CSS gates display on pointer:coarse + state.
  if (!isTouchDevice) {
    root.style.display = 'none';
    return root;
  }

  root.innerHTML = `
    <div class="touch-controls__pad touch-controls__pad--move">
      <button class="touch-btn touch-btn--left"  type="button" aria-label="Move left"  data-role="left">
        <svg class="touch-btn__icon" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M20 6 L8 16 L20 26 Z" fill="currentColor"/>
        </svg>
      </button>
      <button class="touch-btn touch-btn--right" type="button" aria-label="Move right" data-role="right">
        <svg class="touch-btn__icon" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M12 6 L24 16 L12 26 Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
    <div class="touch-controls__pad touch-controls__pad--fire">
      <button class="touch-btn touch-btn--fire" type="button" aria-label="Fire" data-role="fire">
        <svg class="touch-btn__icon" viewBox="0 0 32 32" aria-hidden="true">
          <!-- Harpoon: shaft + arrowhead, oriented up like the in-game projectile. -->
          <rect x="14" y="14" width="4" height="14" rx="1.5" fill="currentColor"/>
          <path d="M16 3 L7 14 L13 14 L13 18 L19 18 L19 14 L25 14 Z" fill="currentColor"/>
        </svg>
        <span class="touch-btn__label">FIRE</span>
      </button>
    </div>
  `;

  buttons.left  = root.querySelector('[data-role="left"]')  as HTMLElement;
  buttons.right = root.querySelector('[data-role="right"]') as HTMLElement;
  buttons.fire  = root.querySelector('[data-role="fire"]')  as HTMLElement;

  for (const id of ['left', 'right', 'fire'] as const) {
    const el = buttons[id]!;
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // Window listeners catch finger-slide and lost-touch cases regardless of
  // which element the pointer originally landed on.
  window.addEventListener('pointermove',   onPointerMove);
  window.addEventListener('pointerup',     releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  // Tab-out / focus-loss: drop all internal state. input.ts's blur handler
  // also clears `keys`, but without this our local `held` and
  // `activePointer` go stale, and a subsequent pointermove wouldn't see a
  // diff to re-sync the keys table.
  window.addEventListener('blur', releaseAllTouchControls);
  // Page hidden (tab switch on mobile) is the same kind of event.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllTouchControls();
  });

  applyTouchControlSettings();

  return root;
}
