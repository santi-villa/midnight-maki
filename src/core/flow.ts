/** Game lifecycle: new game, continue, world start, autosave. */
import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { game, newSave } from './state';
import type { Appearance, SaveData } from './types';
import { saveGame } from '../persistence/storage';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { installActions } from '../systems/actions';
import { installDaily } from '../systems/daily';
import { mountHud, showHud } from '../ui/hud';
import { hudHandlers } from '../ui/menus';
import { ensureDefaultDecor } from '../world/zoneRuntime';
import { bus } from './events';

let phaser: Phaser.Game;
let autosaveTimer = 0;

export function setPhaser(g: Phaser.Game) {
  phaser = g;
}

export async function startNewGame(a: Appearance, name: string, restaurant: string) {
  const s = newSave(name, a, restaurant);
  s.time = { day: 1, period: 2, minutes: 0 };
  game.load(s);
  await startWorld(true);
}

export async function continueGame(s: SaveData) {
  game.load(s);
  await startWorld(false);
}

async function startWorld(isNew: boolean) {
  clock.resetPause();
  ensureDefaultDecor();
  installDaily();
  phaser.scene.stop('title');
  phaser.scene.start('world');
  await new Promise<void>((r) => {
    const check = () => (world && world.sys.isActive() ? r() : setTimeout(check, 30));
    check();
  });
  await import('../systems/handlers');
  installActions();
  const story = await import('../story/story');
  world.lockHook = (to) => story.onLockedDoor(to);
  world.onEnterZone = (z) => {
    story.onEnterZone(z);
  };
  mountHud(hudHandlers());
  const p = game.save.player;
  if (isNew) {
    showHud(false);
    const { playIntro } = await import('../story/intro');
    await playIntro();
  } else {
    let zone = p.zone;
    if (zone === 'arrival' || !zone) zone = 'restaurant';
    await world.enterZone(zone, p.x || 8, p.y || 10, p.dir, false);
    const { onContinue } = await import('../story/story');
    onContinue();
  }
  startAutosave();
}

function startAutosave() {
  clearInterval(autosaveTimer);
  autosaveTimer = window.setInterval(() => {
    if (game.dirty && !clock.paused) {
      syncPlayerPos();
      saveGame('interval');
    }
  }, 20000);
  const flush = () => {
    if (!game.loaded) return;
    syncPlayerPos();
    saveGame('hide');
  };
  document.addEventListener('visibilitychange', () => document.hidden && flush());
  window.addEventListener('pagehide', flush);
  // safe points: zone changes, new day, closing menus
  bus.on('zone:enter', () => saveSoon());
  bus.on('time:changed', () => saveSoon());
  bus.on('dialogue:end', () => saveSoon());
  bus.on('ui:modal', ({ open }) => !open && saveSoon());
  // the first gesture unlocks audio
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
}

let soon = 0;
export function saveSoon() {
  clearTimeout(soon);
  soon = window.setTimeout(() => {
    syncPlayerPos();
    saveGame('safe');
  }, 400);
}

function syncPlayerPos() {
  if (!world?.player || !world.zoneId) return;
  const p = game.save.player;
  p.zone = world.zoneId;
  p.x = world.player.tx;
  p.y = world.player.ty;
  p.dir = world.player.dir;
}
