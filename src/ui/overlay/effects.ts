/**
 * Effects overlay — ephemeral DOM elements for juice (score popups,
 * combo chips, level-start banners, damage flashes, pickup bursts) AND
 * the broader notification systems borrowed from ricochet.html:
 *
 *   - Medal callouts (right-side slide-in panels, 5 tier colors)
 *   - Toast notifications (top-center pills, 4 kind colors)
 *   - Score-delta pulse (small "+N" floating next to the HUD score)
 *   - Rich center banner (WAVE 02 / GO! / LEVEL CLEAR with pretitle + sub)
 *   - Vignette overlay (always-on radial darken at corners)
 *   - Chromatic-aberration flash (full-stage screen-blend on death / big crits)
 *
 * Architecture: initEffects() returns a single wrapper containing all the
 * layer divs. Each layer is pointer-events: none so gameplay clicks pass
 * through. The vignette is mounted once; everything else is spawned on
 * demand with auto-cleanup.
 *
 * The FX namespace is the single public API; gameplay code calls
 * FX.score() / FX.combo() / FX.medal() / FX.toast() / etc. and never
 * touches the DOM directly.
 */

import { W, H } from '../../constants';
import { isTouchDevice } from '../../systems/input';

let popupLayer: HTMLElement | null = null;
let medalsLayer: HTMLElement | null = null;
let toastsLayer: HTMLElement | null = null;
let chromAbHost:  HTMLElement | null = null;

// Queue + concurrency for medals so they don't stack into an unreadable wall
// during a chain. Up to 3 visible at once; the rest wait their turn.
const MEDAL_CONCURRENT_MAX = 3;
const MEDAL_INTERVAL_MS = 280;
const medalQueue: MedalSpec[] = [];
let medalsActive = 0;
let medalPumpTimer: number | null = null;

// Soft cap on visible toasts so a burst doesn't carpet the screen. Phones
// have far less room (a 16:9 stage letterboxed inside browser chrome), so we
// keep only two stacked at once there — more than that buries the play field.
const TOAST_VISIBLE_MAX = isTouchDevice ? 2 : 4;

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'plat' | 'mythic';
export type ToastKind  = 'success' | 'warn' | 'info' | 'danger';

interface MedalSpec {
  title: string;
  sub: string;
  tier: MedalTier;
  reward?: string;
  icon?: string;
}

const MEDAL_ICONS: Record<MedalTier, string> = {
  bronze: '◆',
  silver: '◆',
  gold:   '★',
  plat:   '✦',
  mythic: '✪',
};

const TOAST_ICONS: Record<ToastKind, string> = {
  success: '✓',
  warn:    '!',
  info:    'i',
  danger:  '×',
};

export function initEffects(): HTMLElement {
  // Wrapper hosts every effect layer as a sibling so each can have its
  // own z-index/positioning without stacking-context bleed.
  const wrap = document.createElement('div');
  wrap.className = 'fx-host';
  wrap.style.position = 'absolute';
  wrap.style.inset = '0';
  wrap.style.pointerEvents = 'none';

  // Existing popup layer — popups, combo chips, banners, damage flashes.
  popupLayer = document.createElement('div');
  popupLayer.className = 'fx-layer';
  wrap.appendChild(popupLayer);

  // Vignette — always mounted, costs nothing per frame (pure CSS).
  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  wrap.appendChild(vignette);

  // Chromatic-aberration host — kept as a child of the wrapper so we can
  // re-trigger by removing and re-adding the element (cheap, no listeners).
  chromAbHost = document.createElement('div');
  chromAbHost.style.position = 'absolute';
  chromAbHost.style.inset = '0';
  chromAbHost.style.pointerEvents = 'none';
  wrap.appendChild(chromAbHost);

  // Medals: right-side slide-in stack.
  medalsLayer = document.createElement('div');
  medalsLayer.className = 'medals-layer';
  wrap.appendChild(medalsLayer);

  // Toasts: top-center pill stack.
  toastsLayer = document.createElement('div');
  toastsLayer.className = 'toasts-layer';
  wrap.appendChild(toastsLayer);

  return wrap;
}

function toPct(x: number, axis: 'x' | 'y'): string {
  const d = axis === 'x' ? W : H;
  return ((x / d) * 100).toFixed(2) + '%';
}

function spawnInLayer(layer: HTMLElement | null, el: HTMLElement, lifespanMs: number) {
  if (!layer) return;
  layer.appendChild(el);
  setTimeout(() => { el.remove(); }, lifespanMs);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;' : '&#39;'
  ));
}

// ---- Medal pump ----------------------------------------------------------
function pumpMedals() {
  if (medalsActive >= MEDAL_CONCURRENT_MAX || !medalsLayer) {
    medalPumpTimer = null;
    return;
  }
  const spec = medalQueue.shift();
  if (!spec) { medalPumpTimer = null; return; }
  medalsActive++;
  const el = document.createElement('div');
  el.className = 'medal medal--' + spec.tier;
  const icon = spec.icon || MEDAL_ICONS[spec.tier];
  el.innerHTML = `
    <div class="medal__icon">${escapeHtml(icon)}</div>
    <div class="medal__info">
      <div class="medal__tier">${spec.tier.toUpperCase()}</div>
      <div class="medal__title">${escapeHtml(spec.title)}</div>
      ${spec.sub ? `<div class="medal__sub">${escapeHtml(spec.sub)}</div>` : ''}
    </div>
    ${spec.reward ? `<div class="medal__reward">${escapeHtml(spec.reward)}</div>` : ''}
  `;
  medalsLayer.appendChild(el);
  // Medal animation total = entry 0.5s + hold 2.1s + exit 0.5s ≈ 3.1s.
  setTimeout(() => {
    el.remove();
    medalsActive--;
    if (medalQueue.length && !medalPumpTimer) {
      medalPumpTimer = window.setTimeout(pumpMedals, MEDAL_INTERVAL_MS);
    }
  }, 3200);
  // Chain another medal in if the queue still has more — staggered so the
  // entries don't pile up on the same frame.
  if (medalQueue.length && !medalPumpTimer) {
    medalPumpTimer = window.setTimeout(pumpMedals, MEDAL_INTERVAL_MS);
  }
}

export const FX = {
  /** "+150" rising and fading at the pop site. */
  score(x: number, y: number, value: number, variant: 'normal' | 'big' | 'mint' | 'pink' = 'normal') {
    const el = document.createElement('div');
    el.className = 'fx-score' + (variant !== 'normal' ? ' fx-score--' + variant : '');
    el.style.left = toPct(x, 'x');
    el.style.top  = toPct(y, 'y');
    el.textContent = '+' + value;
    spawnInLayer(popupLayer, el, 1000);
  },

  /** Combo chip label ("DOUBLE POP", "WILD!"). */
  combo(x: number, y: number, label: string, hot = false) {
    const el = document.createElement('div');
    el.className = 'fx-combo' + (hot ? ' fx-combo--hot' : '');
    el.style.left = toPct(x, 'x');
    el.style.top  = toPct(y, 'y');
    el.textContent = label;
    spawnInLayer(popupLayer, el, 1200);
  },

  /** Level-start banner — appears for ~3s then fades. Plain variant. */
  banner(title: string, sub = '') {
    const el = document.createElement('div');
    el.className = 'fx-banner';
    el.innerHTML = `
      <div class="fx-banner__title">${escapeHtml(title)}</div>
      ${sub ? `<span class="fx-banner__sub">${escapeHtml(sub)}</span>` : ''}
    `;
    spawnInLayer(popupLayer, el, 3300);
  },

  /** Rich center banner — three-line hierarchy with pretitle / main / sub.
   *  Used for WAVE intros, GO!, LEVEL CLEAR, GAME OVER moments. Supports
   *  inline <em> tags in `main` to accent-color part of the title. */
  bannerRich(main: string, pre?: string, sub?: string) {
    const el = document.createElement('div');
    el.className = 'fx-banner-rich';
    el.innerHTML = `
      ${pre ? `<div class="fx-banner-rich__pretitle">${escapeHtml(pre)}</div>` : ''}
      <div class="fx-banner-rich__main">${main /* allows <em> for accent */}</div>
      ${sub ? `<div class="fx-banner-rich__sub">${escapeHtml(sub)}</div>` : ''}
    `;
    spawnInLayer(popupLayer, el, 2500);
  },

  /** Full-screen red flash on damage. */
  damageFlash() {
    const el = document.createElement('div');
    el.className = 'fx-damage';
    spawnInLayer(popupLayer, el, 400);
  },

  /** Ring burst at a position — for pickup grabs / explosions. */
  burst(x: number, y: number, variant: 'yellow' | 'mint' | 'cyan' = 'yellow') {
    const el = document.createElement('div');
    el.className = 'fx-burst' + (variant !== 'yellow' ? ' fx-burst--' + variant : '');
    el.style.left = toPct(x, 'x');
    el.style.top  = toPct(y, 'y');
    spawnInLayer(popupLayer, el, 600);
  },

  /** Slide-in medal callout. Tier color is one of bronze/silver/gold/plat/
   *  mythic. Queues if there are already 3 visible — never drops a medal
   *  silently. */
  medal(title: string, sub: string, tier: MedalTier, reward?: string, icon?: string) {
    medalQueue.push({ title, sub, tier, reward, icon });
    if (!medalPumpTimer && medalsActive < MEDAL_CONCURRENT_MAX) pumpMedals();
  },

  /** Top-center toast notification. Kind drives the icon + accent color.
   *  Soft-capped at 4 visible — additional toasts replace the oldest. */
  toast(kind: ToastKind, label: string, text: string) {
    if (!toastsLayer) return;
    // Trim oldest if we're at the visible cap.
    while (toastsLayer.children.length >= TOAST_VISIBLE_MAX) {
      toastsLayer.firstChild?.remove();
    }
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.innerHTML = `
      <div class="toast__icon">${TOAST_ICONS[kind]}</div>
      <div class="toast__text"><b>${escapeHtml(label)}</b>${escapeHtml(text)}</div>
    `;
    spawnInLayer(toastsLayer, el, 4000);
  },

  /** Trigger the chromatic-aberration flash. Restricted to high-impact
   *  moments (player death, screen-clear bubble, mega multi-pop) to keep
   *  the signal meaningful. Reduced-motion users see a no-op (CSS handles
   *  the animation disable). */
  chromAb() {
    if (!chromAbHost) return;
    // Re-spawn pattern: remove + re-add an element so the CSS animation
    // restarts cleanly even if fired in quick succession.
    chromAbHost.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'chrom-ab';
    chromAbHost.appendChild(el);
    setTimeout(() => { el.remove(); }, 360);
  },
};
