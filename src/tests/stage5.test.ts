import { describe, expect, it } from 'vitest';
import { hudSuggestionLabels, type HudSuggestionInput } from '../ui/hudSuggestions';
import { phoneKeyIntent, type PhoneKeyState } from '../ui/phone/phoneKey';

function key(over: Partial<PhoneKeyState> = {}): PhoneKeyState {
  return {
    code: 'Tab',
    key: 'Tab',
    repeat: false,
    shift: false,
    ctrl: false,
    meta: false,
    alt: false,
    composing: false,
    typing: false,
    loaded: true,
    layerHidden: false,
    dialogue: false,
    modalOnTop: false,
    menuOpen: false,
    phase: 'closed',
    exploring: true,
    focusInControl: false,
    boundPhone: false,
    phoneKey: 'p',
    ...over,
  };
}

describe('NoriPhone Tab toggle', () => {
  it('opens and closes with Tab while exploring', () => {
    expect(phoneKeyIntent(key())).toBe('open');
    expect(phoneKeyIntent(key({ phase: 'open', exploring: false, menuOpen: true }))).toBe('close');
    expect(phoneKeyIntent(key({ phase: 'opening' }))).toBe('close');
  });

  it('leaves dialogue, menus, typing and other focus alone', () => {
    expect(phoneKeyIntent(key({ dialogue: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ typing: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ menuOpen: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ exploring: false }))).toBe('ignore');
    // a HUD button that kept focus after a click must not stop Tab from opening the phone
    expect(phoneKeyIntent(key({ focusInControl: true }))).toBe('open');
    expect(phoneKeyIntent(key({ shift: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ ctrl: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ alt: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ meta: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ composing: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ loaded: false }))).toBe('ignore');
    expect(phoneKeyIntent(key({ layerHidden: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ phase: 'closing' }))).toBe('ignore');
    expect(phoneKeyIntent(key({ phase: 'open', modalOnTop: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ phase: 'open', typing: true }))).toBe('ignore');
  });

  it('still closes with Tab when a phone button has focus', () => {
    expect(phoneKeyIntent(key({ phase: 'open', focusInControl: true, exploring: false, menuOpen: true }))).toBe('close');
  });

  it('swallows a held Tab without toggling again', () => {
    expect(phoneKeyIntent(key({ repeat: true }))).toBe('swallow');
    expect(phoneKeyIntent(key({ repeat: true, dialogue: true }))).toBe('ignore');
  });

  it('keeps the letter and the bound key, with the same guards', () => {
    expect(phoneKeyIntent(key({ code: 'KeyP', key: 'p', boundPhone: true }))).toBe('open');
    expect(phoneKeyIntent(key({ code: 'KeyN', key: 'n', boundPhone: false, phoneKey: 'n' }))).toBe('open');
    expect(phoneKeyIntent(key({ code: 'KeyP', key: 'p', boundPhone: true, dialogue: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ code: 'KeyP', key: 'p', boundPhone: true, menuOpen: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ code: 'KeyP', key: 'p', boundPhone: true, typing: true }))).toBe('ignore');
    expect(phoneKeyIntent(key({ code: 'KeyP', key: 'P', boundPhone: false, shift: true }))).toBe('open');
    expect(phoneKeyIntent(key({ code: 'KeyM', key: 'm' }))).toBe('ignore');
    expect(phoneKeyIntent(key({ code: 'Tab', key: 'Tab', phoneKey: 't' }))).toBe('open');
  });
});

function hints(over: Partial<HudSuggestionInput> = {}): string[] {
  return hudSuggestionLabels({
    introDone: true,
    pendingOrders: false,
    beachUnlocked: false,
    period: 1,
    atBeach: false,
    ...over,
  });
}

describe('HUD suggestion chips', () => {
  it('does not offer cooking, fishing, visit or collection shortcuts', () => {
    expect(hints({ pendingOrders: true })).toEqual([]);
    expect(hints({ beachUnlocked: true, period: 1, atBeach: false })).toEqual([]);
    expect(hints({ beachUnlocked: true, period: 3 })).toEqual([]);
    expect(hints({ beachUnlocked: true, atBeach: true })).toEqual([]);
    expect(hints({ introDone: false, pendingOrders: true })).toEqual([]);
    const all = hints({ pendingOrders: true, beachUnlocked: true });
    expect(all.some((label) => label.startsWith('Visitar a') || label.startsWith('Ver colección') || label === 'Preparar sushi' || label === 'Ir a pescar')).toBe(false);
  });
});
