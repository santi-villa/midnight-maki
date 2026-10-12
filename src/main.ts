import Phaser from 'phaser';
import './ui/styles.css';
import { applySettings } from './core/settings';
import { installSkin } from './ui/skin';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { CinematicScene } from './scenes/CinematicScene';
import { showTitle } from './ui/title';
import { installErrorGuard } from './core/errors';
import { registerSW } from './core/pwa';
import { installAppShell, onBack } from './core/appShell';

installErrorGuard();
installAppShell();
onBack(async () => {
  const { modalOpen } = await import('./ui/dom');
  if (modalOpen()) {
    // the same as pressing Escape: closes the top-most window
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return;
  }
  const { game } = await import('./core/state');
  const { inDialogue } = await import('./dialogue/dialogue');
  if (game.loaded && !inDialogue()) (await import('./ui/menus')).openMenu();
});

if (new URLSearchParams(location.search).has('debug')) {
  // test hooks: inspect state from the console / automated checks
  Promise.all([import('./core/state'), import('./scenes/WorldScene'), import('./systems/time'), import('./persistence/storage')]).then(([s, w, t, st]) => {
    (window as any).mmDebug = { game: s.game, get world() { return w.world; }, clock: t.clock, storage: st };
  });
}
applySettings();
installSkin();

/** Boot only once the container has a real size (hidden tabs / iOS standalone can report 0 at first). */
function whenSized(cb: () => void) {
  const el = document.getElementById('game')!;
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) cb();
  else setTimeout(() => whenSized(cb), 100);
}

whenSized(boot);

function boot() {
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f2440',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.RESIZE, width: Math.max(320, window.innerWidth), height: Math.max(320, window.innerHeight) },
  // ?st forces a setTimeout loop (useful for automated tests in background tabs)
  fps: { target: 60, min: 30, forceSetTimeOut: new URLSearchParams(location.search).has('st') },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, WorldScene, CinematicScene],
  disableContextMenu: true,
});

(window as any).__mm = game; // handy for debugging & e2e tests

game.events.once('booted', () => showTitle(game));
}
if (!(window as any).Capacitor?.isNativePlatform?.()) registerSW();
