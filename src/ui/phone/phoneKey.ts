/** Decides what Tab and the existing NoriPhone keys do. Tab is an extra toggle, not a rebinding. */

export type PhonePhase = 'closed' | 'opening' | 'open' | 'closing';
export type PhoneKeyIntent = 'ignore' | 'open' | 'close' | 'swallow';

export interface PhoneKeyState {
  code: string;
  key: string;
  repeat: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  composing: boolean;
  typing: boolean;
  loaded: boolean;
  layerHidden: boolean;
  dialogue: boolean;
  /** A panel is sitting on top of the open phone. */
  modalOnTop: boolean;
  /** Some other window is open. Ignored while the phone itself is the open window. */
  menuOpen: boolean;
  phase: PhonePhase;
  exploring: boolean;
  /** Focus is on a control that still needs Tab. Only blocks Tab while the phone is closed. */
  focusInControl: boolean;
  boundPhone: boolean;
  phoneKey: string;
}

let explore: () => boolean = () => false;

/** World code registers this so the phone file does not import the world scene. */
export function setPhoneExploreCheck(fn: () => boolean) {
  explore = fn;
}

export function phoneExplore(): boolean {
  return explore();
}

export function phoneKeyIntent(s: PhoneKeyState): PhoneKeyIntent {
  const letter = s.key.toLowerCase() === (s.phoneKey || 'p').toLowerCase();
  const wants = s.code === 'Tab' || s.boundPhone || letter;
  if (!wants || s.composing || s.ctrl || s.meta || s.alt) return 'ignore';
  if (s.code === 'Tab' && s.shift) return 'ignore';
  if (s.typing || !s.loaded || s.layerHidden || s.dialogue) return 'ignore';
  if (s.phase === 'closing') return 'ignore';

  let intent: PhoneKeyIntent = 'ignore';
  if (s.phase === 'open' || s.phase === 'opening') {
    intent = s.modalOnTop ? 'ignore' : 'close';
  } else if (s.menuOpen || !s.exploring) {
    intent = 'ignore';
  } else {
    intent = 'open';
  }
  if (intent !== 'ignore' && s.repeat) return 'swallow';
  return intent;
}
