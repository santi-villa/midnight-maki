/** Central action map for keyboard play. Movement stays on WASD and arrows. */

export const ACTIONS = [
  'interact',
  'confirm',
  'contextAlt',
  'secondary',
  'more',
  'cancel',
  'map',
  'journal',
  'inventory',
  'recipes',
  'phone',
] as const;

export type GameAction = (typeof ACTIONS)[number];
export type KeyBindings = Partial<Record<GameAction, string>>;

export const ACTION_LABEL: Record<GameAction, string> = {
  interact: 'Interactuar',
  confirm: 'Confirmar',
  contextAlt: 'Hablar',
  secondary: 'Segunda acción',
  more: 'Más acciones',
  cancel: 'Cerrar',
  map: 'Mapa',
  journal: 'Diario',
  inventory: 'Mochila',
  recipes: 'Recetario',
  phone: 'NoriPhone',
};

export const EDITABLE_ACTIONS = ACTIONS.filter((action) => action !== 'cancel');

export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  interact: 'KeyE',
  confirm: 'Enter',
  contextAlt: 'Space',
  secondary: 'KeyF',
  more: 'KeyQ',
  cancel: 'Escape',
  map: 'KeyM',
  journal: 'KeyJ',
  inventory: 'KeyI',
  recipes: 'KeyR',
  phone: 'KeyP',
};

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const BINDABLE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Space|Enter|Backspace|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|Home|End|Page(Up|Down)|Insert|Delete|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Enter|Decimal))$/;

const KEY_NAMES: Record<string, string> = {
  Space: 'Espacio',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Retroceso',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadEnter: 'Enter',
};

export function isMoveCode(code: string): boolean {
  return MOVE_CODES.has(code);
}

export function isBindableCode(code: string): boolean {
  return BINDABLE.test(code) && !isMoveCode(code) && code !== 'Escape' && code !== 'Tab';
}

export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return code.slice(6);
  return code;
}

/** Drop broken, duplicate and movement codes. Defaults are not stored. */
export function sanitizeBindings(raw: unknown): KeyBindings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const out: KeyBindings = {};
  const used = new Set<string>();
  for (const action of ACTIONS) {
    const code = source[action];
    if (action === 'cancel' || typeof code !== 'string' || !isBindableCode(code) || used.has(code)) continue;
    used.add(code);
    if (code !== DEFAULT_BINDINGS[action]) out[action] = code;
  }
  return Object.keys(out).length ? out : undefined;
}

export function bindingMap(custom?: KeyBindings | null): Record<GameAction, string> {
  const map = { ...DEFAULT_BINDINGS };
  const clean = sanitizeBindings(custom);
  if (!clean) return map;
  for (const action of ACTIONS) {
    const code = clean[action];
    if (code) map[action] = code;
  }
  return map;
}

export function actionForCode(code: string, map: Record<GameAction, string>): GameAction | null {
  if (isMoveCode(code)) return null;
  for (const action of ACTIONS) if (map[action] === code) return action;
  return null;
}

/** Spanish name of the action that already owns this code, or null when it is free. */
export function bindingConflict(map: Record<GameAction, string>, action: GameAction, code: string): string | null {
  if (isMoveCode(code)) return 'el movimiento';
  if (code === 'Escape' || code === 'Tab') return 'cerrar ventanas';
  if (!isBindableCode(code)) return 'una tecla que no se puede asignar';
  for (const other of ACTIONS) {
    if (other !== action && map[other] === code) return ACTION_LABEL[other];
  }
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/** Keep diagonal movement at the same speed as a cardinal, and ignore a tiny stick. */
export function normalizeStick(x: number, y: number): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag <= 0.15) return { x: 0, y: 0 };
  const scale = Math.max(1, mag);
  return { x: x / scale, y: y / scale };
}

/** Next index in a ring. `current` must already point at an item. */
export function stepIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  const i = ((current % count) + count) % count;
  return (i + direction + count) % count;
}
