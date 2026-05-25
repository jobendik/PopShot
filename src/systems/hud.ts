/**
 * Legacy stub. The HUD and touch controls are owned entirely by the DOM
 * overlay now:
 *   - HUD:            src/ui/hud/hud.html.ts
 *   - Touch buttons:  src/ui/hud/touchControls.html.ts
 *
 * Both used to live here as canvas renderers (see git history) — file kept
 * around only as a documentation anchor for new contributors who go
 * looking for "renderHUD". The exports below are intentionally empty so
 * any stale import errors out at type-check time rather than rendering
 * stale chrome over the new DOM HUD.
 */

export {};
