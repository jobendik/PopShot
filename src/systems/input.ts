import { AudioSys } from './audio';

// ============================ INPUT =================================
export const keys: Record<string, boolean> = {};        // currently held
export const keysPressed: Record<string, boolean> = {}; // single-frame edge triggers
window.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) keysPressed[e.code] = true;
  keys[e.code] = true;
  AudioSys.init(); // user gesture unlocks audio
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

export function consumePressed(code) {
  if (keysPressed[code]) { keysPressed[code] = false; return true; }
  return false;
}
