/**
 * Minimal analytics + error reporting surface.
 *
 * Pre-launch, this writes events to the console so we can verify in DevTools
 * which events fire in what order. The exported `emit` function is the single
 * choke-point that should be swapped to a real sink (PostHog, Plausible,
 * CrazyGames-provided analytics, etc.) before launch — all call sites already
 * use it.
 *
 * Every event carries:
 *   - the game build hash (set by Vite at build time)
 *   - ms since page load (for funnel time-to-X analysis)
 *   - any caller-provided payload
 *
 * Errors are routed through the same emitter so they show up alongside funnel
 * events. The plan's §10.7 / §16 explicitly call this out as required for any
 * post-launch debugging.
 */

const SESSION_START = (typeof performance !== 'undefined' && performance.now)
  ? performance.now()
  : Date.now();

/** Replaced by Vite at build time. Falls back to 'dev' under `npm run dev`. */
const BUILD_HASH = (() => {
  try {
    const env = (import.meta as any).env;
    return env?.MODE === 'production' ? env.VITE_BUILD_HASH || 'prod' : 'dev';
  } catch { return 'unknown'; }
})();

export interface AnalyticsEvent {
  name: string;
  /** Milliseconds since page load. Useful for funnel time-to-X analysis. */
  tMs: number;
  build: string;
  data?: Record<string, unknown>;
}

type Sink = (event: AnalyticsEvent) => void;

const sinks: Sink[] = [];

/** Add a sink. Default sink (console.debug) is registered at module load. */
export function addSink(sink: Sink) { sinks.push(sink); }

/** Emit an event. Always synchronous and never throws. */
export function emit(name: string, data?: Record<string, unknown>) {
  const tMs = ((typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()) - SESSION_START;
  const event: AnalyticsEvent = { name, tMs: Math.round(tMs), build: BUILD_HASH };
  if (data) event.data = data;
  for (const s of sinks) {
    try { s(event); } catch { /* never let a sink crash the game */ }
  }
}

// Default sink: structured console.debug. Dev-only — a production build on
// CrazyGames must keep the console clean (reviewers check for console noise).
if ((import.meta as any).env?.DEV) {
  addSink(evt => {
    // eslint-disable-next-line no-console
    console.debug('[evt]', evt.name, evt.tMs + 'ms', evt.data ?? '');
  });
}

/** Install global error + unhandled-rejection handlers. Call once at startup. */
export function installErrorHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    emit('error.uncaught', {
      message: String(e.message || e.error?.message || 'unknown'),
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack?.toString().slice(0, 500),
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    emit('error.unhandled_rejection', {
      message: String(reason?.message || reason || 'unknown'),
      stack: reason?.stack?.toString().slice(0, 500),
    });
  });
}
