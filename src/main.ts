import './styles.css';
import { Game } from './game';
import { AudioSys } from './systems/audio';
import { Storage } from './systems/storage';
import { bindCanvasInput } from './systems/input';
import { Platform } from './systems/platform';
import { emit, installErrorHandlers } from './systems/analytics';
import { captureWelcomeBack } from './systems/daily';

// Wire global error handlers as early as possible so a bug during the rest of
// boot still gets reported.
installErrorHandlers();
emit('boot.start');

const hydrationStart = performance.now();
Storage.load();
emit('save.hydrate', {
  ms: Math.round(performance.now() - hydrationStart),
  hasProgress: (Storage.data.unlockedLevel || 0) > 0,
  dailyStreak: Storage.data.dailyStreak || 0,
  schemaVersion: Storage.data.schemaVersion,
});
AudioSys.muted = !!Storage.data.muted;

// Kick off platform/SDK init in the background.
emit('sdk.init.start');
Platform.init().then(() => {
  emit('sdk.init.done', { hasSDK: Platform.hasSDK, adsBlocked: Platform.adsBlocked });
}).catch(err => {
  emit('sdk.init.error', { message: String(err) });
});

const game = new Game();
game.unlockedLevel = Storage.data.unlockedLevel || 0;
bindCanvasInput(game.canvas);

// First-ever visit: skip the menu and drop the player straight into Level 1.
const isFirstVisit = !Storage.data.unlockedLevel
  && Object.keys(Storage.data.bestTour || {}).length === 0
  && !Storage.data.bestScoreAttack
  && !Storage.data.bestPanicWave;

emit('boot.ready', { firstVisit: isFirstVisit });

if (isFirstVisit) {
  game.startTour(0);
}

// Snapshot any welcome-back greeting against the previous lastSessionDate,
// then update lastSessionDate to today. The main menu reads the cached
// snapshot, so the banner stays stable for the session.
captureWelcomeBack();

game.start();
