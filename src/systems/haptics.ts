/**
 * Thin wrapper over navigator.vibrate. All entry points are no-ops when:
 *   - the device doesn't support vibrate (iOS Safari, desktop browsers)
 *   - the user has disabled mobileHaptics in pause settings
 *
 * Patterns are tuned short on purpose — long vibration feels like a
 * notification, not a tactile confirmation. ~10ms reads as a "click."
 */

import { Storage } from './storage';
import { isTouchDevice } from './input';

const supported =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

function fire(pattern: number | number[]) {
  if (!supported) return;
  if (!isTouchDevice) return;
  if (!Storage.data.mobileHaptics) return;
  try { navigator.vibrate(pattern); } catch { /* swallow — iOS throws on rejected gestures */ }
}

export const Haptics = {
  /** A button press transition (idle → held). */
  tap()    { fire(8); },
  /** A successful shot fired. */
  shoot()  { fire(6); },
  /** A ball pop. Slightly stronger than shoot so chains feel meaty. */
  pop()    { fire(12); },
  /** Player took damage / lost a life. */
  damage() { fire([0, 18, 40, 24]); },
  /** Player died. */
  death()  { fire([0, 40, 60, 80]); },
};
