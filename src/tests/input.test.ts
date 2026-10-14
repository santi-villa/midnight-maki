import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_LABEL,
  ACTIONS,
  DEFAULT_BINDINGS,
  actionForCode,
  bindingConflict,
  bindingMap,
  isTypingTarget,
  keyLabel,
  normalizeStick,
  sanitizeBindings,
  stepIndex,
} from '../input/bindings';
import { armKeyCapture, consumeKeyCapture, isCodeSwallowed, releaseCode, resetInputSession, swallowCode } from '../input/keys';
import { loadSettings } from '../persistence/storage';

afterEach(() => {
  resetInputSession();
  vi.unstubAllGlobals();
});

describe('keyboard action map', () => {
  it('gives every default a distinct key', () => {
    const codes = Object.values(DEFAULT_BINDINGS);
    expect(new Set(codes).size).toBe(codes.length);
    expect(ACTIONS.every((action) => ACTION_LABEL[action])).toBe(true);
  });

  it('resolves defaults and a saved override', () => {
    const map = bindingMap({ map: 'KeyU' });
    expect(actionForCode('KeyM', map)).toBeNull();
    expect(actionForCode('KeyU', map)).toBe('map');
    expect(actionForCode('KeyE', map)).toBe('interact');
    expect(actionForCode('KeyW', map)).toBeNull();
  });

  it('rejects movement, Escape and duplicates while keeping the first owner', () => {
    expect(bindingConflict(DEFAULT_BINDINGS, 'map', 'KeyW')).toBe('el movimiento');
    expect(bindingConflict(DEFAULT_BINDINGS, 'map', 'Escape')).toBe('cerrar ventanas');
    expect(bindingConflict(DEFAULT_BINDINGS, 'map', 'KeyE')).toBe('Interactuar');
    expect(bindingConflict(DEFAULT_BINDINGS, 'interact', 'KeyE')).toBeNull();
    expect(sanitizeBindings({ map: 'KeyU', journal: 'KeyU', interact: 'KeyW', cancel: 'KeyQ', extra: 'Digit1' })).toEqual({ map: 'KeyU' });
  });

  it('labels keys for the HUD and the settings list', () => {
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('Space')).toBe('Espacio');
    expect(keyLabel('Digit4')).toBe('4');
  });

  it('normalizes diagonal movement and ignores a resting stick', () => {
    expect(normalizeStick(1, 0)).toEqual({ x: 1, y: 0 });
    expect(normalizeStick(0.1, 0)).toEqual({ x: 0, y: 0 });
    expect(normalizeStick(0, 0)).toEqual({ x: 0, y: 0 });
    const diagonal = normalizeStick(1, 1);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(normalizeStick(2, 0)).toEqual({ x: 1, y: 0 });
  });

  it('knows when the player is typing', () => {
    const field = (value: { tagName: string; isContentEditable?: boolean }) => value as unknown as EventTarget;
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(field({ tagName: 'textarea' }))).toBe(true);
    expect(isTypingTarget(field({ tagName: 'BUTTON' }))).toBe(false);
    expect(isTypingTarget(field({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
  });

  it('walks a focus ring without leaving the list', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
  });
});

describe('key capture and saved bindings', () => {
  it('swallows a key only until it is released', () => {
    swallowCode('Escape');
    expect(isCodeSwallowed('Escape')).toBe(true);
    releaseCode('Escape');
    expect(isCodeSwallowed('Escape')).toBe(false);
  });

  it('keeps listening when a rebind is rejected and stops when it is accepted', () => {
    const stop = armKeyCapture((press) => (press.code === 'KeyM' ? 'again' : 'done'));
    expect(consumeKeyCapture({ code: 'KeyM', key: 'm', repeat: false, ctrl: false, meta: false, alt: false })).toBe(true);
    expect(consumeKeyCapture({ code: 'KeyU', key: 'u', repeat: false, ctrl: false, meta: false, alt: false })).toBe(true);
    expect(consumeKeyCapture({ code: 'KeyU', key: 'u', repeat: false, ctrl: false, meta: false, alt: false })).toBe(false);
    stop();
  });

  it('stores bindings beside the audio settings and never inside the save', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    store.set('mm_settings', JSON.stringify({ music: 0.2, haptics: false, bindings: { map: 'KeyU', interact: 'KeyA' } }));
    const loaded = loadSettings();
    expect(loaded.music).toBe(0.2);
    expect(loaded.haptics).toBe(false);
    expect(loaded.bindings).toEqual({ map: 'KeyU' });
    expect(loaded.joystick).toBe(true);
  });
});
