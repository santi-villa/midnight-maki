/**
 * Keyboard shortcuts for exploration. Menus, dialogue and text fields keep their own keys.
 * Movement still comes from the world scene. Page scrolling is blocked after Phaser has read the key.
 */
import { settings } from '../core/settings';
import { game } from '../core/state';
import { inDialogue } from '../dialogue/dialogue';
import { world } from '../scenes/WorldScene';
import { modalOpen } from '../ui/dom';
import { setPhoneExploreCheck } from '../ui/phone/phoneKey';
import { actionForCode, bindingMap, isMoveCode, isTypingTarget, type GameAction } from './bindings';
import { consumeKeyCapture, installInputSession, isCodeSwallowed, noteKeyboard, swallowCode, type KeyPress } from './keys';

let installed = false;
let scrollGuardInstalled = false;

export function installPcControls() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  installInputSession();
  setPhoneExploreCheck(explorationActive);
  window.addEventListener('keydown', onKey, true);
}

type Bootable = { isBooted: boolean; events: { once: (event: string, fn: () => void) => void } };

/**
 * Stops arrows and WASD from scrolling the page.
 * Phaser ignores a key whose default action was already cancelled, so this listener
 * is attached once the keyboard manager is listening: after boot, and after that manager.
 */
export function installMoveScrollGuard(game?: Bootable) {
  if (game && !game.isBooted) {
    game.events.once('boot', () => armMoveScrollGuard());
    return;
  }
  armMoveScrollGuard();
}

function armMoveScrollGuard() {
  if (scrollGuardInstalled || typeof window === 'undefined') return;
  scrollGuardInstalled = true;
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || !isMoveCode(e.code)) return;
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    e.preventDefault();
  });
}

function onKey(e: KeyboardEvent) {
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !isModifierOnly(e)) noteKeyboard();
  if (e.isComposing || isTypingTarget(e.target)) return;

  if (consumeKeyCapture(toPress(e))) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (isCodeSwallowed(e.code)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (!modalOpen() && e.code === 'Escape' && closeDecor()) {
    swallowCode(e.code);
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (!explorationActive() || isMoveCode(e.code)) return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
    if (e.repeat) e.preventDefault();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && isControlTarget(e.target)) return;

  const action = actionForCode(e.code, bindingMap(settings.bindings));
  if (!action) return;
  e.preventDefault();
  e.stopPropagation();
  swallowCode(e.code);
  run(action);
}

function explorationActive(): boolean {
  if (!game.loaded || modalOpen() || inDialogue()) return false;
  if (!world?.sys?.isActive?.() || !world.player || !world.zone) return false;
  if (document.querySelector('.letter-wrap, .book')) return false;
  return world.canAct();
}

function closeDecor(): boolean {
  if (!world?.decorMode) return false;
  const sheet = document.querySelector('.decor-sheet') as (HTMLElement & { __close?: () => void }) | null;
  if (!sheet?.__close) return false;
  sheet.__close();
  return true;
}

function run(action: GameAction) {
  // Escape already closed a window or the decoration sheet before we get here.
  // With nothing to close, Esc opens the pause menu (save, load, settings).
  if (action === 'cancel') { void import('../ui/hud').then((m) => { if (!m.closeMoreMenu()) void import('../ui/menus').then((x) => x.openPauseMenu()); }); return; }
  if (action === 'interact' || action === 'confirm') {
    world.tryInteract();
    return;
  }
  if (action === 'contextAlt') {
    world.tryAlternate();
    return;
  }
  if (action === 'secondary') {
    world.trySecondary();
    return;
  }
  if (action === 'map') void import('../ui/worldmap').then((m) => m.openWorldMap());
  else if (action === 'journal') void import('../ui/menus').then((m) => m.openJournal(0));
  else if (action === 'inventory') void import('../ui/menus').then((m) => m.openBag());
  else if (action === 'recipes') void import('../ui/menus').then((m) => m.openJournal(4));
  else if (action === 'phone') void import('../ui/menus').then((m) => m.openNoriPhone());
}

function toPress(e: KeyboardEvent): KeyPress {
  return { code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey };
}

function isModifierOnly(e: KeyboardEvent): boolean {
  return e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta';
}

function isControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('button, a, [role="button"]');
}
