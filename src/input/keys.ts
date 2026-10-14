/** Last input method and keys swallowed by the interface until they are released. */
import { bus } from '../core/events';

export type InputMethod = 'touch' | 'mouse' | 'keyboard';

export interface KeyPress {
  code: string;
  key: string;
  repeat: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
}

type CaptureResult = 'done' | 'again' | 'ignore';
type Capture = (press: KeyPress) => CaptureResult;

const swallowed = new Set<string>();
let capture: Capture | null = null;
let method: InputMethod = 'mouse';
let installed = false;

export function inputMethod(): InputMethod {
  return method;
}

export function swallowCode(code: string) {
  if (code) swallowed.add(code);
}

export function isCodeSwallowed(code: string): boolean {
  return swallowed.has(code);
}

export function releaseCode(code: string) {
  swallowed.delete(code);
}

export function resetInputSession() {
  swallowed.clear();
  capture = null;
  method = 'mouse';
  paintBody();
}

export function isCapturingKey(): boolean {
  return capture !== null;
}

export function cancelKeyCapture() {
  capture = null;
}

export function armKeyCapture(fn: Capture): () => void {
  capture = fn;
  return () => {
    if (capture === fn) capture = null;
  };
}

/** True when the rebind listener ate the key. */
export function consumeKeyCapture(press: KeyPress): boolean {
  if (!capture) return false;
  const result = capture(press);
  if (result === 'ignore') return false;
  if (result === 'done') capture = null;
  return true;
}

export function notePointer(pointerType: string) {
  setMethod(pointerType === 'touch' ? 'touch' : 'mouse');
}

export function noteKeyboard() {
  setMethod('keyboard');
}

function setMethod(next: InputMethod) {
  if (next === method) return;
  method = next;
  paintBody();
  bus.emit('input:method', { method });
}

function paintBody() {
  if (typeof document === 'undefined') return;
  document.body?.classList.remove('input-touch', 'input-mouse', 'input-keyboard');
  document.body?.classList.add(`input-${method}`);
}

function initialMethod(): InputMethod {
  if (typeof matchMedia !== 'function') return 'mouse';
  try {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const hover = matchMedia('(hover: hover)').matches;
    if (coarse && !hover) return 'touch';
  } catch {
    /* matchMedia can throw in odd embeds */
  }
  return 'mouse';
}

export function installInputSession() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  method = initialMethod();
  paintBody();
  window.addEventListener('keyup', (e) => releaseCode(e.code));
  window.addEventListener('blur', () => swallowed.clear());
  window.addEventListener('pointerdown', (e) => notePointer(e.pointerType || 'mouse'), true);
}
