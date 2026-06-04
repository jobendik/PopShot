// ============================================================================
// Fullscreen — standard Fullscreen API with legacy WebKit fallbacks.
// ============================================================================
// CrazyGames embeds the game in an <iframe allowfullscreen>, so requesting
// fullscreen on the document element fills the player's screen — a recommended
// CrazyGames feature. iOS Safari has NO element-fullscreen support (only
// <video>), so callers should hide their control when isFullscreenSupported()
// is false rather than show a button that does nothing.

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as FsDocument;

export function isFullscreenSupported(): boolean {
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** Enter fullscreen if not in it, otherwise exit. Must be called from a user
 *  gesture (the menu button's click handler satisfies that). Never throws. */
export function toggleFullscreen(): void {
  try {
    if (isFullscreen()) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    } else {
      const el = document.documentElement as FsElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  } catch { /* permission / gesture issues are non-fatal */ }
}

/** Reflect current fullscreen state onto every registered toggle button. The
 *  expand glyph (⛶) means "enter"; the compress glyph means "exit". Driven by a
 *  single document-level listener so Esc-to-exit also updates the icon, and so
 *  rebuilding the menu can't leak per-button listeners. */
export function syncFullscreenButtons(): void {
  const fs = isFullscreen();
  document.querySelectorAll<HTMLElement>('[data-role="fullscreen-toggle"]').forEach((el) => {
    el.textContent = fs ? '🗗' : '⛶';
    el.setAttribute('aria-pressed', String(fs));
    el.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Enter fullscreen');
  });
}

document.addEventListener('fullscreenchange', syncFullscreenButtons);
document.addEventListener('webkitfullscreenchange', syncFullscreenButtons);
