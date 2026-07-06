/**
 * HTML/CSS main menu — replaces renderMainMenu in src/state/mainMenu.ts.
 *
 * Public API:
 *   buildMainMenu(game): HTMLElement — constructs the screen, wires events,
 *                                       returns the root element (caller mounts).
 *   syncMainMenu(game, root): void   — per-frame sync of dynamic bits (welcome
 *                                       banner, daily-hot state, idle hints,
 *                                       resume label, title chip, sound icon).
 *
 * The screen is built once at boot and lives in #ui-root. Visibility is
 * toggled by domRoot.ts via the `.is-active` class. Per-frame sync runs only
 * while the menu is active — it touches the DOM only when state actually
 * changes (cached previous values) to keep the cost trivial.
 */

import { LEVELS } from '../../data/levels';
import { State } from '../../constants';
import { AudioSys } from '../../systems/audio';
import {
  dismissWelcomeBack,
  getWelcomeBackBanner,
  hasPlayedToday,
  liveStreak,
  todayUTC,
} from '../../systems/daily';
import { Storage } from '../../systems/storage';
import { computeAccountLevel } from '../../systems/progression';
import { activeMissions, getWeeklyEvent, nextUnlockHint, weeklyBestScore } from '../../systems/retention';
import { fmtCompact } from '../../utils';
import { FX } from '../overlay/effects';
import type { Game } from '../../game';

/** Once-per-session guard for menu-entry toasts. Reset on page load so
 *  refreshing the page re-fires them; preserved across menu↔gameplay
 *  navigation so they don't spam every time the player returns to menu. */
let menuToastsFired = false;

/** Fire a SINGLE welcome-back/streak toast a beat after the menu becomes
 *  visible. We intentionally do NOT also fire a "daily ready" toast — the
 *  Daily hero CTA already advertises readiness via its `is-hot` state + NEW
 *  badge, so a second OS-style pill would just be chatter. Diegetic feedback
 *  over notification spam. Guarded by menuToastsFired (once per session). */
function fireMenuEntryToasts(): void {
  if (menuToastsFired) return;
  menuToastsFired = true;
  const streak = liveStreak();
  const welcome = getWelcomeBackBanner();
  if (welcome) {
    setTimeout(() => FX.toast('success', 'WELCOME BACK', welcome.subtitle), 800);
  } else if (streak > 0) {
    setTimeout(() => FX.toast('success', 'STREAK', streak + '-day streak alive'), 800);
  }
}

const IDLE_HINTS = [
  '🔥 Daily streaks grow over consecutive days — don\'t miss a day.',
  'Local co-op: a second player can join with I / K / U on desktop.',
  'Chain pops fast — your combo decays if you wait too long.',
  'Each level has bronze, silver, and gold medals to chase.',
  'Score Attack and Panic Mode live under Modes — try them once.',
  'Pickups change your weapon. Try the laser, flamethrower, and bomb.',
];
const IDLE_DELAY  = 6;
const IDLE_PERIOD = 5;

// Hybrid menu: the heavy meta (profile/rank detail, weekly detail, mastery)
// now lives in the Hub, so the front-screen nav stays short and arcade-like.
const SECONDARY: { key: string; label: string; target: string }[] = [
  { key: 'levels',   label: 'Levels',   target: State.LEVEL_SELECT },
  { key: 'modes',    label: 'Modes',    target: State.MODE_SELECT  },
  { key: 'hub',      label: 'Hub',      target: State.HUB          },
  { key: 'controls', label: 'Controls', target: State.CONTROLS     },
  { key: 'credits',  label: 'Credits',  target: State.CREDITS      },
];

function getResumeLevel(game: Game) {
  return Math.min(game.unlockedLevel, LEVELS.length - 1);
}

export function buildMainMenu(game: Game): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ui-screen menu menu-backdrop';
  root.setAttribute('data-screen', 'main_menu');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Main menu');

  // Brand strap above the title
  const brand = document.createElement('div');
  brand.className = 'menu__brand';
  brand.innerHTML = `<span class="menu__brand-tag">Arcade Edition</span>`;
  root.appendChild(brand);

  // --- Rank badge (top-left) ---
  // The full profile/rank card moved to the Hub to keep the menu an
  // attract-style screen. A compact account-level badge keeps progression
  // glanceable and doubles as the entry point into the Hub.
  const rankBadge = document.createElement('button');
  rankBadge.type = 'button';
  rankBadge.className = 'menu__rank-badge';
  rankBadge.dataset.role = 'rank-badge';
  rankBadge.setAttribute('aria-label', 'Open hub');
  rankBadge.innerHTML = `
    <span class="menu__rank-badge-lvl" data-role="rank-lvl">1</span>
    <span class="menu__rank-badge-meta">
      <span class="menu__rank-badge-label">LEVEL</span>
      <span class="menu__rank-badge-hint">View Hub ›</span>
    </span>
  `;
  rankBadge.addEventListener('click', () => {
    AudioSys.menu();
    game.state = State.HUB;
  });
  root.appendChild(rankBadge);

  // --- Sound toggle (top-right) ---
  const soundBtn = document.createElement('button');
  soundBtn.type = 'button';
  soundBtn.className = 'menu__sound';
  soundBtn.setAttribute('aria-label', 'Toggle sound');
  soundBtn.dataset.role = 'sound-toggle';
  soundBtn.textContent = '🔊';
  soundBtn.addEventListener('click', () => {
    AudioSys.toggle();
    Storage.data.muted = AudioSys.muted;
    Storage.save();
    soundBtn.textContent = AudioSys.muted ? '🔇' : '🔊';
  });
  root.appendChild(soundBtn);

  // NOTE: no custom fullscreen button — CrazyGames provides its own iframe
  // fullscreen control and rejects games that ship a second one.

  // --- Drifting bubbles (12 of them, positions/scales derived from --i) ---
  const bubbles = document.createElement('div');
  bubbles.className = 'menu__bubbles';
  bubbles.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.setProperty('--i', String(i));
    bubbles.appendChild(b);
  }
  root.appendChild(bubbles);

  // --- Title block ---
  const titleWrap = document.createElement('div');
  titleWrap.className = 'menu__title-wrap';
  titleWrap.innerHTML = `
    <h1 class="menu__title">PopShot</h1>
  `;
  root.appendChild(titleWrap);

  // --- Welcome-back banner (populated on sync, click to dismiss) ---
  const welcome = document.createElement('button');
  welcome.type = 'button';
  welcome.className = 'menu__welcome';
  welcome.hidden = true;
  welcome.dataset.role = 'welcome';
  welcome.innerHTML = `
    <div>
      <div class="menu__welcome-title" data-role="welcome-title"></div>
      <div class="menu__welcome-sub"   data-role="welcome-sub"></div>
    </div>
    <span class="menu__welcome-dismiss">Tap to dismiss</span>
  `;
  welcome.addEventListener('click', () => {
    AudioSys.menu();
    dismissWelcomeBack();
    welcome.hidden = true;
  });
  root.appendChild(welcome);

  // --- CTA stack ---
  const cta = document.createElement('div');
  cta.className = 'menu__cta-stack';
  root.appendChild(cta);

  // PLAY / CONTINUE
  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'menu__play';
  playBtn.dataset.role = 'play';
  playBtn.innerHTML = `
    <span class="menu__play-label" data-role="play-label">▶  PLAY</span>
    <span class="menu__play-sub"   data-role="play-sub">Start the adventure</span>
  `;
  playBtn.addEventListener('click', () => {
    AudioSys.confirm();
    game.startTour(getResumeLevel(game));
  });
  cta.appendChild(playBtn);

  // Daily Challenge
  const dailyBtn = document.createElement('button');
  dailyBtn.type = 'button';
  dailyBtn.className = 'menu__daily';
  dailyBtn.dataset.role = 'daily';
  dailyBtn.innerHTML = `
    <div>
      <span class="menu__daily-title">TODAY'S CHALLENGE</span>
      <span class="menu__daily-sub" data-role="daily-sub">New challenge every day.</span>
    </div>
    <span class="menu__daily-streak" data-role="daily-streak" hidden></span>
    <span class="menu__daily-badge"  data-role="daily-badge"  hidden>NEW</span>
  `;
  dailyBtn.addEventListener('click', () => {
    AudioSys.confirm();
    game.openDaily();
  });
  cta.appendChild(dailyBtn);

  // Weekly event (Panic / Score Attack / Combo — rotates each week)
  const weeklyBtn = document.createElement('button');
  weeklyBtn.type = 'button';
  weeklyBtn.className = 'menu__daily menu__weekly';
  weeklyBtn.dataset.role = 'weekly';
  weeklyBtn.innerHTML = `
    <div>
      <span class="menu__daily-title" data-role="weekly-title">WEEKLY EVENT</span>
      <span class="menu__daily-sub" data-role="weekly-sub">New target every week.</span>
    </div>
    <span class="menu__daily-streak" data-role="weekly-best"></span>
    <span class="menu__daily-badge" data-role="weekly-badge">EVENT</span>
  `;
  weeklyBtn.addEventListener('click', () => {
    AudioSys.confirm();
    const { mode } = getWeeklyEvent();
    if (mode === 'panic') game.startPanic();
    else game.startScoreAttack();
  });
  cta.appendChild(weeklyBtn);

  const missions = document.createElement('div');
  missions.className = 'menu__missions';
  missions.innerHTML = `
    <div class="menu__missions-head">
      <span>Daily Missions</span>
      <b data-role="mission-stars">0 stars</b>
    </div>
    <div class="menu__missions-list" data-role="missions"></div>
    <div class="menu__next-unlock" data-role="next-unlock"></div>
  `;
  cta.appendChild(missions);

  // --- Secondary nav ---
  const secondary = document.createElement('nav');
  secondary.className = 'menu__secondary';
  secondary.setAttribute('aria-label', 'More');
  for (const item of SECONDARY) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn';
    b.textContent = item.label;
    b.addEventListener('click', () => {
      AudioSys.menu();
      game.state = item.target as Game['state'];
    });
    secondary.appendChild(b);
  }
  root.appendChild(secondary);

  // --- Footer ---
  const footer = document.createElement('div');
  footer.className = 'menu__footer';
  footer.innerHTML = `
    <div class="menu__footer-default">Click &nbsp;•&nbsp; Tap &nbsp;•&nbsp; Enter to play</div>
    <div class="menu__footer-hint" data-role="footer-hint"></div>
  `;
  root.appendChild(footer);

  // Cache the dynamic refs so syncMainMenu doesn't re-query every frame.
  const refs = {
    rankBadge,
    rankLvl:     rankBadge.querySelector('[data-role="rank-lvl"]') as HTMLElement,
    soundBtn,
    welcome,
    welcomeTitle: welcome.querySelector('[data-role="welcome-title"]') as HTMLElement,
    welcomeSub:   welcome.querySelector('[data-role="welcome-sub"]')   as HTMLElement,
    playBtn,
    playLabel:   playBtn.querySelector('[data-role="play-label"]')     as HTMLElement,
    playSub:     playBtn.querySelector('[data-role="play-sub"]')       as HTMLElement,
    dailyBtn,
    dailySub:    dailyBtn.querySelector('[data-role="daily-sub"]')     as HTMLElement,
    dailyStreak: dailyBtn.querySelector('[data-role="daily-streak"]')  as HTMLElement,
    dailyBadge:  dailyBtn.querySelector('[data-role="daily-badge"]')   as HTMLElement,
    weeklyBtn,
    weeklyTitle: weeklyBtn.querySelector('[data-role="weekly-title"]') as HTMLElement,
    weeklySub:   weeklyBtn.querySelector('[data-role="weekly-sub"]')   as HTMLElement,
    weeklyBest:  weeklyBtn.querySelector('[data-role="weekly-best"]')  as HTMLElement,
    missions,
    missionStars: missions.querySelector('[data-role="mission-stars"]') as HTMLElement,
    missionsList: missions.querySelector('[data-role="missions"]') as HTMLElement,
    nextUnlock: missions.querySelector('[data-role="next-unlock"]') as HTMLElement,
    footerHint:  footer.querySelector('[data-role="footer-hint"]')     as HTMLElement,
  };
  (root as any).__refs = refs;
  (root as any).__lastInputT = 0;
  (root as any).__cachedHintIndex = -1;
  return root;
}

interface Refs {
  rankBadge: HTMLElement; rankLvl: HTMLElement;
  soundBtn: HTMLElement;
  welcome: HTMLElement; welcomeTitle: HTMLElement; welcomeSub: HTMLElement;
  playBtn: HTMLElement; playLabel: HTMLElement; playSub: HTMLElement;
  dailyBtn: HTMLElement; dailySub: HTMLElement; dailyStreak: HTMLElement; dailyBadge: HTMLElement;
  weeklyBtn: HTMLElement; weeklyTitle: HTMLElement; weeklySub: HTMLElement; weeklyBest: HTMLElement;
  missions: HTMLElement; missionStars: HTMLElement; missionsList: HTMLElement; nextUnlock: HTMLElement;
  footerHint: HTMLElement;
}

/** Per-frame sync — runs only while the menu is the active screen. Cheap:
 *  every DOM write is guarded by a value-changed check stored on the node. */
export function syncMainMenu(game: Game, root: HTMLElement) {
  const refs = (root as any).__refs as Refs;
  if (!refs) return;

  // Fire the once-per-session entry toasts (welcome-back, daily-ready).
  // Cheap to call every frame — guarded by an internal flag.
  fireMenuEntryToasts();

  // --- PLAY / CONTINUE label ---
  const resume = getResumeLevel(game);
  const hasProgress = game.unlockedLevel > 0;
  const playLabel = hasProgress ? '▶  CONTINUE' : '▶  PLAY';
  const playSub   = hasProgress
    ? 'Level ' + (resume + 1) + ' — ' + LEVELS[resume].name
    : 'Start the adventure';
  setText(refs.playLabel, playLabel);
  setText(refs.playSub, playSub);

  // --- Daily state ---
  const playedToday = hasPlayedToday();
  const streak      = liveStreak();
  const isHot       = !playedToday;
  toggleClass(refs.dailyBtn, 'is-hot', isHot);
  toggleClass(refs.playBtn,  'is-calm', isHot);   // calm down PLAY when daily is the hero
  setText(refs.dailySub, playedToday
    ? 'Played today — best ' + (Storage.data.dailyBest[todayUTC()] || 0)
    : (streak > 0 ? 'Keep your streak alive!' : 'New challenge every day.'));
  refs.dailyBadge.hidden  = !isHot;
  refs.dailyStreak.hidden = streak <= 0;
  if (streak > 0) setText(refs.dailyStreak, '🔥 ' + streak);

  // --- New-player declutter ---
  // Until the player has cleared their first level, the front screen keeps a
  // single loud CTA: PLAY. The weekly-event card and daily-missions widget
  // are meta a newcomer can't parse yet — hiding them stops six widgets from
  // competing for a second-session player's attention. (Daily stays visible:
  // it is the game's core retention hook and self-explains.)
  const isNewPlayer = game.unlockedLevel <= 0;
  refs.weeklyBtn.hidden = isNewPlayer;
  refs.missions.hidden = isNewPlayer;

  // --- Weekly event (mode-aware) ---
  const weekly = getWeeklyEvent();
  const modeTag = weekly.mode === 'panic' ? 'WEEKLY PANIC' : weekly.mode === 'score_attack' ? 'WEEKLY SCORE ATTACK' : 'WEEKLY COMBO';
  setText(refs.weeklyTitle, modeTag + ' · ' + weekly.label.toUpperCase());
  setText(refs.weeklySub, weekly.goalLabel);
  const weekBest = weeklyBestScore();
  setText(refs.weeklyBest, weekBest > 0 ? (weekly.mode === 'combo' ? '×' + weekBest : fmtCompact(weekBest)) : 'NEW');

  // --- Missions and next unlock ---
  setText(refs.missionStars, (Storage.data.missionStars || 0) + ' stars');
  const missionHtml = activeMissions().map(m => {
    const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
    return `<div class="menu__mission ${m.complete ? 'is-complete' : ''}">
      <div class="menu__mission-top"><span>${m.label}</span><b>${m.progress}/${m.target}</b></div>
      <div class="menu__mission-bar"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
  if (refs.missionsList.innerHTML !== missionHtml) refs.missionsList.innerHTML = missionHtml;
  setText(refs.nextUnlock, nextUnlockHint());

  // --- Welcome banner ---
  const welcome = getWelcomeBackBanner();
  if (welcome) {
    refs.welcome.hidden = false;
    setText(refs.welcomeTitle, welcome.title);
    setText(refs.welcomeSub,   welcome.subtitle);
  } else {
    refs.welcome.hidden = true;
  }

  // --- Rank badge (account level → entry to the Hub) ---
  setText(refs.rankLvl, String(computeAccountLevel(Storage.data).level));

  // --- Sound icon ---
  setText(refs.soundBtn, AudioSys.muted ? '🔇' : '🔊');

  // --- Idle-hint rotation (footer cross-fade) ---
  // Idle clock: track last activity via a bubbling listener attached in
  // mountIdleResetOnce(); read game.t as the canonical timebase.
  mountIdleResetOnce(root);
  const lastInput = (root as any).__lastInputT as number;
  const idle = game.t - lastInput;
  const isIdle = idle > IDLE_DELAY;
  toggleClass(root, 'is-idle', isIdle);
  if (isIdle) {
    const phase = Math.floor((idle - IDLE_DELAY) / IDLE_PERIOD) % IDLE_HINTS.length;
    if ((root as any).__cachedHintIndex !== phase) {
      (root as any).__cachedHintIndex = phase;
      setText(refs.footerHint, IDLE_HINTS[phase]);
    }
  }
}

// ---- helpers ----
function setText(el: HTMLElement, value: string) {
  if (el.textContent !== value) el.textContent = value;
}
function toggleClass(el: HTMLElement, cls: string, on: boolean) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}
function mountIdleResetOnce(root: HTMLElement) {
  if ((root as any).__idleBound) return;
  (root as any).__idleBound = true;
  const reset = () => {
    // Game's `t` is the canonical clock; UIRoot.sync passes the game in.
    // We stash a setter on the root so we can update __lastInputT from the
    // bubble handler without re-entrancy.
    (root as any).__needsIdleReset = true;
  };
  root.addEventListener('pointermove', reset, { passive: true });
  root.addEventListener('pointerdown', reset, { passive: true });
  root.addEventListener('keydown',     reset, { passive: true });
}

/** Called by sync() so the menu knows the current game.t to apply the idle reset. */
export function tickMainMenuIdleClock(game: Game, root: HTMLElement) {
  if ((root as any).__needsIdleReset) {
    (root as any).__lastInputT = game.t;
    (root as any).__needsIdleReset = false;
  }
}
