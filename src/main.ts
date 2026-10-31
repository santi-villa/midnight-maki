import Phaser from 'phaser';
import './ui/styles.css';
import { applySettings } from './core/settings';
import { installSkin } from './ui/skin';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { showTitle } from './ui/title';
import { errorReports, installErrorGuard, runTask } from './core/errors';
import { registerSW } from './core/pwa';
import { installAppShell, onBack } from './core/appShell';
import { installMoveScrollGuard, installPcControls } from './input/shortcuts';
import './ui/unify.css';
import './ui/uiScale.css';
import './ui/sproutUi.css';

installErrorGuard();
installAppShell();
installPcControls();
onBack(async () => {
  const { modalOpen } = await import('./ui/dom');
  if (modalOpen()) {
    // the same as pressing Escape: closes the top-most window
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return;
  }
  const { game } = await import('./core/state');
  const { inDialogue } = await import('./dialogue/dialogue');
  if (game.loaded && !inDialogue()) (await import('./ui/menus')).openNoriPhone();
});

if (new URLSearchParams(location.search).has('debug')) {
  // test hooks: inspect state from the console / automated checks
  void runTask('boot:debug', () => Promise.all([import('./core/state'), import('./scenes/WorldScene'), import('./systems/time'), import('./persistence/storage'), import('./audio/audio'), import('./restaurant/service'), import('./restaurant/kitchen'), import('./decoration/editor'), import('./minigames/fishing'), import('./coop'), import('./restaurant/mirror')]).then(([s, w, t, st, a, sv, kt, de, fs, cp, mr]) => {
    (window as any).mmDebug = { game: s.game, get world() { return w.world; }, clock: t.clock, storage: st, audio: a.audio, service: sv, kitchen: kt, decor: de, fishing: fs, coop: cp.coop, mirror: mr.mirror, errorReports };
  }));
}
applySettings();
void import('./ui/account').then((m) => m.initAccountUi());
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
  scene: [BootScene, TitleScene, WorldScene],
  disableContextMenu: true,
});

// On mobile an orientation event can precede the new container geometry. Phaser
// records the new parent bounds after applying the old size, then misses the change.
// Observe the actual container and reconcile once per frame, only when size differs.
let viewportFrame = 0;
const host = document.getElementById('game')!;
const resizeViewport = () => {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    const bounds = host.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    if (Math.abs(game.scale.width - bounds.width) < 1 && Math.abs(game.scale.height - bounds.height) < 1) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  });
};
const viewportObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeViewport);
viewportObserver?.observe(host);
window.addEventListener('resize', resizeViewport);
game.events.once('destroy', () => {
  cancelAnimationFrame(viewportFrame);
  viewportObserver?.disconnect();
  window.removeEventListener('resize', resizeViewport);
});

(window as any).__mm = game; // handy for debugging & e2e tests
if (import.meta.env.DEV) void import('./kitchen/board').then((m) => { (window as any).__cook = m.cook; });
if (import.meta.env.DEV) void import('./data/recipes').then((m) => { (window as any).__recipes = m.RECIPES_BY_ID; });
installMoveScrollGuard(game);

game.events.once('booted', () => void runTask('boot:title', () => showTitle(game)));
}
if (!(window as any).Capacitor?.isNativePlatform?.()) registerSW();
