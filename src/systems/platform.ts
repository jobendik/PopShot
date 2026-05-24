/**
 * CrazyGames platform adapter.
 *
 * Two responsibilities:
 *   1. Bridge the in-game state machine to the CrazyGames SDK (gameplay
 *      events, happy time, ad requests).
 *   2. Degrade gracefully when the SDK is absent — local dev, offline, or
 *      a player with an aggressive adblocker. In that case every method
 *      becomes a no-op that resolves immediately so the game still works.
 *
 * Nothing else in the codebase should reference `window.CrazyGames` directly.
 */

type AdType = 'midgame' | 'rewarded';
interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (err: unknown) => void;
}

interface CrazyGamesSDK {
  init(): Promise<void>;
  game?: {
    gameplayStart?(): void;
    gameplayStop?(): void;
    happytime?(): void;
    loadingStart?(): void;
    loadingStop?(): void;
  };
  ad?: {
    requestAd?(type: AdType, callbacks?: AdCallbacks): void;
    hasAdblock?(): Promise<boolean>;
  };
  data?: {
    getItem?(key: string): Promise<string | null>;
    setItem?(key: string, value: string): Promise<void>;
    removeItem?(key: string): Promise<void>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazyGamesSDK };
  }
}

function getSDK(): CrazyGamesSDK | null {
  if (typeof window === 'undefined') return null;
  const sdk = window.CrazyGames?.SDK;
  return sdk || null;
}

/** Per-session ad pacing. CrazyGames itself enforces minimum spacing, but we
 *  add a safety floor so we never spam requests during rapid level cycling. */
const MIDGAME_MIN_INTERVAL_MS = 60_000;
let lastMidgameAdAt = 0;

export const Platform = {
  ready: false,
  hasSDK: false,
  adsBlocked: false,

  /** Boot — call once at startup. Resolves whether or not the SDK is present. */
  async init(): Promise<void> {
    const sdk = getSDK();
    if (!sdk) {
      this.ready = true;
      this.hasSDK = false;
      return;
    }
    try {
      await sdk.init();
      this.hasSDK = true;
      // Best-effort adblock detection — purely informational.
      if (sdk.ad?.hasAdblock) {
        try { this.adsBlocked = await sdk.ad.hasAdblock(); } catch { /* ignore */ }
      }
    } catch (err) {
      // SDK present but init failed: still safe, just no platform features.
      // eslint-disable-next-line no-console
      console.warn('[Platform] CrazyGames SDK init failed:', err);
      this.hasSDK = false;
    }
    this.ready = true;
  },

  /** Player has just entered active gameplay. Mutes ads during the run. */
  gameplayStart(): void {
    const g = getSDK()?.game;
    try { g?.gameplayStart?.(); } catch { /* never throw to the game */ }
  },

  /** Player has just left active gameplay. Allows ad pre-roll, etc. */
  gameplayStop(): void {
    const g = getSDK()?.game;
    try { g?.gameplayStop?.(); } catch { /* swallow */ }
  },

  /** Signal a moment of player satisfaction (level clear, boss defeat). */
  happytime(): void {
    const g = getSDK()?.game;
    try { g?.happytime?.(); } catch { /* swallow */ }
  },

  /**
   * Request a midgame ad. Resolves when the ad completes, errors out, or is
   * skipped due to pacing / no SDK. Always resolves — never rejects.
   */
  requestMidgameAd(): Promise<void> {
    const now = Date.now();
    if (now - lastMidgameAdAt < MIDGAME_MIN_INTERVAL_MS) return Promise.resolve();
    const ad = getSDK()?.ad;
    if (!ad?.requestAd) return Promise.resolve();
    lastMidgameAdAt = now;
    return new Promise<void>(resolve => {
      // 10-second hard timeout: if the SDK never fires a callback for any
      // reason (network hang, broken ad), we proceed rather than freeze.
      let settled = false;
      const settle = () => { if (!settled) { settled = true; resolve(); } };
      const timeout = window.setTimeout(settle, 10_000);
      try {
        ad.requestAd!('midgame', {
          adFinished: () => { window.clearTimeout(timeout); settle(); },
          adError:    () => { window.clearTimeout(timeout); settle(); },
        });
      } catch {
        window.clearTimeout(timeout);
        settle();
      }
    });
  },

  /**
   * Request a rewarded ad. Resolves to true if the reward should be granted
   * (ad completed). Resolves to false on error, no SDK, or user-aborted.
   */
  requestRewardedAd(): Promise<boolean> {
    const ad = getSDK()?.ad;
    if (!ad?.requestAd) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      let settled = false;
      const settle = (granted: boolean) => { if (!settled) { settled = true; resolve(granted); } };
      const timeout = window.setTimeout(() => settle(false), 30_000);
      try {
        ad.requestAd!('rewarded', {
          adFinished: () => { window.clearTimeout(timeout); settle(true); },
          adError:    () => { window.clearTimeout(timeout); settle(false); },
        });
      } catch {
        window.clearTimeout(timeout);
        settle(false);
      }
    });
  },

  /** Cloud save (best-effort). Always resolves. */
  async save(key: string, data: string): Promise<void> {
    const d = getSDK()?.data;
    if (!d?.setItem) return;
    try { await d.setItem(key, data); } catch { /* swallow */ }
  },

  /** Cloud load. Returns null if no SDK, no entry, or any error. */
  async load(key: string): Promise<string | null> {
    const d = getSDK()?.data;
    if (!d?.getItem) return null;
    try { return await d.getItem(key); } catch { return null; }
  },
};
