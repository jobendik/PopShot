import './styles.css';
import { Game } from './game';
import { AudioSys } from './systems/audio';
import { Storage } from './systems/storage';

Storage.load();
AudioSys.muted = !!Storage.data.muted;

const game = new Game();
game.unlockedLevel = Storage.data.unlockedLevel || 0;
game.start();
