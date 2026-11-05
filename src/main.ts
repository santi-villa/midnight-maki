import Phaser from 'phaser';
import { installPackSkin } from './ui/packSkin';
import './ui/styles.css';
import { applySettings } from './core/settings';
import { backingScale, LOW_SCALE_CAP, onRefitViewport, SCALE_CAP, setGamePx, viewportFor } from './core/pixelRatio';
import { lowPower } from './core/perf';
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
// the Sprout Lands skin, only where the local packs are present (src/art/packs.ts)
import.meta.glob('./assets/packs/ui/*.css', { eager: true });

installPackSkin();
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
// painted character sheets from an earlier visit, read while the title screen comes up
void import('./art/sheetCache').then((m) => m.loadSheetCache());
void import('./restaurant/delivery').then((m) => m.startDeliveries());
installSkin();

/** Boot only once the container has a real size (hidden tabs / iOS standalone can report 0 at first). */
function whenSized(cb: () => void) {
  const el = document.getElementById('game')!;
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) cb();
  else setTimeout(() => whenSized(cb), 100);
}

whenSized(boot);

/** The canvas size for the #game box: `gamePx()` canvas pixels per CSS pixel (core/pixelRatio.ts). */
function viewport() {
  const r = document.getElementById('game')!.getBoundingClientRect();
  const scale = backingScale(window.devicePixelRatio || 1, lowPower() ? LOW_SCALE_CAP : SCALE_CAP);
  return { ...viewportFor(Math.max(1, r.width), Math.max(1, r.height), scale), scale };
}

function boot() {
const first = viewport();
setGamePx(first.scale);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f2440',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  // The canvas is sized here, not by Phaser: whole device pixels per game pixel on any screen (core/pixelRatio.ts).
  scale: { mode: Phaser.Scale.NONE, width: first.width, height: first.height, zoom: first.zoom },
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
    const v = viewport();
    if (v.width === game.scale.width && v.height === game.scale.height && v.zoom === game.scale.zoom) return;
    setGamePx(v.scale);
    game.scale.zoom = v.zoom;
    game.scale.resize(v.width, v.height);
  });
};
// battery mode lowers the canvas resolution (and raises it back): same path as a resize
onRefitViewport(resizeViewport);
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
