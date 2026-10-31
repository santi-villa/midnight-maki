/** Tiny DOM toolkit for the HTML UI layer (menus, dialogue, minigames). */
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { isTypingTarget, stepIndex } from '../input/bindings';
import { cancelKeyCapture, isCapturingKey, isCodeSwallowed, swallowCode } from '../input/keys';
import { clock } from '../systems/time';
import { settings } from '../core/settings';
import type { TransitionKind } from '../world/zoneTransition';
import { followActionPanel, type ActionAnchor } from './actionPanel';

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const uiRoot = () => document.getElementById('ui')!;

// ------------------------------------------------------------------ modal stack
interface ModalRec { el: HTMLElement; onClose?: () => void; close?: () => void; host?: ModalHost; focusRoot?: HTMLElement; }
interface ModalHost { element: HTMLElement; focusRoot: HTMLElement; changed: (depth: number) => void; }
const stack: ModalRec[] = [];
let panelSeq = 0;
let modalHost: ModalHost | undefined;

/** Apps and their nested screens share the phone's viewport and the normal modal lifecycle. */
export function mountModalHost(element: HTMLElement, focusRoot: HTMLElement, changed: (depth: number) => void): () => void {
  const host: ModalHost = { element, focusRoot, changed };
  modalHost = host;
  return () => {
    if (modalHost === host) modalHost = undefined;
    for (const rec of [...stack].reverse()) if (rec.host === host) rec.close?.();
  };
}
function refreshModalHost(host: ModalHost) {
  const records = stack.filter(r => r.host === host);
  records.forEach((r, i) => { r.el.hidden = i !== records.length - 1; r.el.inert = r.el.hidden; });
  host.changed(records.length);
}

export function modalOpen() {
  return stack.length > 0;
}

/** `keepTime`: the window does not stop the game clock (the kitchen: cooking takes time). */
export function openModal(el: HTMLElement, onClose?: () => void, opts?: { keepTime?: boolean; focusRoot?: HTMLElement }): () => void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const host = modalHost;
  const rec: ModalRec = { el, onClose, host, focusRoot: opts?.focusRoot ?? host?.focusRoot };
  stack.push(rec);
  (host?.element ?? uiRoot()).append(el);
  if (host) refreshModalHost(host);
  const stopsTime = !opts?.keepTime;
  if (stopsTime) clock.pause();
  bus.emit('ui:modal', { open: true });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(rec);
    if (i >= 0) stack.splice(i, 1);
    el.remove();
    if (stopsTime) clock.resume();
    cancelKeyCapture();
    rec.onClose?.();
    if (host && modalHost === host) refreshModalHost(host);
    bus.emit('ui:modal', { open: stack.length > 0 });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };
  rec.close = close;
  return close;
}

/** Standard panel: header with title + close, scrollable body, optional footer. */
export function panel(opts: {
  title: string;
  body: HTMLElement | HTMLElement[];
  foot?: HTMLElement[];
  tabs?: HTMLElement;
  wide?: boolean;
  onClose?: () => void;
  closable?: boolean;
  anchor?: ActionAnchor;
}): { close: () => void; body: HTMLElement; root: HTMLElement } {
  const body = h('div', { class: 'panel-body' }, ...(Array.isArray(opts.body) ? opts.body : [opts.body]));
  let close = () => {};
  const titleId = `mm-panel-${++panelSeq}`;
  const head = h(
    'div',
    { class: 'panel-head' },
    h('h2', { id: titleId }, opts.title),
    opts.closable === false ? null : h('button', { type: 'button', class: 'close-x', 'aria-label': 'Cerrar', onclick: () => { audio.sfxPlay('close'); close(); } }, '✕'),
  );
  const p = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, style: opts.wide ? { width: 'min(820px, 100%)' } : undefined }, head, opts.tabs ?? null, body, opts.foot?.length ? h('div', { class: 'panel-foot' }, ...opts.foot) : null);
  const back = h('div', { class: 'panel-backdrop' }, p);
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back && opts.closable !== false) close();
  });
  audio.sfxPlay('open');
  let stopAnchor: (() => void) | undefined;
  close = openModal(back, () => { stopAnchor?.(); opts.onClose?.(); });
  if (opts.anchor && !modalHost) { back.classList.add('action-backdrop'); stopAnchor = followActionPanel(p, opts.anchor); }
  if (modalHost) {
    p.classList.add('pn-app-panel');
    p.removeAttribute('aria-modal');
    p.setAttribute('role', 'region');
    const backButton = head.querySelector<HTMLButtonElement>('.close-x');
    if (backButton) { backButton.classList.replace('close-x', 'pn-app-back'); backButton.textContent = '‹'; backButton.setAttribute('aria-label', 'Volver'); head.prepend(backButton); }
  }
  (back as any).__close = close;
  queueMicrotask(() => {
    if (!back.isConnected || p.contains(document.activeElement)) return;
    focusables(p).find((el) => !el.classList.contains('close-x'))?.focus({ preventScroll: true });
  });
  return { close, body, root: p };
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true' || el.closest('[inert], [hidden]')) return false;
    return el.getClientRects().length > 0;
  });
}

/** Escape closes the top modal. Tab and arrows stay inside it. */
function onModalKey(e: KeyboardEvent) {
  if (!stack.length || isCodeSwallowed(e.code)) return;
  if (e.key === 'Escape' && isCapturingKey()) return;
  const rec = stack[stack.length - 1];
  const top = rec.el;
  const focusRoot = rec.focusRoot ?? top;
  if (e.key === 'Escape') {
    const closer = top as HTMLElement & { __close?: () => void };
    if (closer.__close && !top.dataset.noesc) {
      swallowCode(e.code);
      e.preventDefault();
      e.stopPropagation();
      closer.__close();
    }
    return;
  }
  if (isTypingTarget(e.target) && e.key !== 'Tab') return;
  if (e.key === 'Tab') {
    const items = focusables(focusRoot);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const dir: 1 | -1 = e.shiftKey ? -1 : 1;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = i < 0 ? items[dir === 1 ? 0 : items.length - 1] : items[stepIndex(i, items.length, dir)];
    next.focus({ preventScroll: true });
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  if (top.classList.contains('noriphone-guard')) return; // the home screen owns horizontal paging
  const items = focusables(focusRoot).filter((el) => el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  if (items.length < 2) return;
  e.preventDefault();
  e.stopPropagation();
  const dir: 1 | -1 = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = i < 0 ? items[dir === 1 ? 0 : items.length - 1] : items[stepIndex(i, items.length, dir)];
  next.focus({ preventScroll: true });
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onModalKey, true);

export function confirmBox(text: string, yes = 'Sí', no = 'Cancelar'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      p.close();
      resolve(v);
    };
    const p = panel({
      title: 'Confirmar',
      body: h('p', { style: { margin: '4px 0', lineHeight: '1.4' } }, text),
      foot: [h('button', { class: 'btn', onclick: () => finish(false) }, no), h('button', { class: 'btn primary', onclick: () => finish(true) }, yes)],
      onClose: () => finish(false),
    });
  });
}

// ------------------------------------------------------------------ toasts (discrete, rate-limited)
let toastWrap: HTMLElement | null = null;
const recent: string[] = [];
export function toast(text: string, icon?: HTMLCanvasElement) {
  if (!text) return;
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap' });
    uiRoot().append(toastWrap);
  }
  if (recent.includes(text)) return;
  recent.push(text);
  setTimeout(() => recent.splice(recent.indexOf(text), 1), 1500);
  while (toastWrap.children.length >= 3) toastWrap.firstElementChild?.remove();
  const t = h('div', { class: 'toast' }, icon ?? null, text);
  toastWrap.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .4s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 450);
  }, 2600);
}
bus.on('toast', ({ text }) => toast(text));

// ------------------------------------------------------------------ fade
let fadeEl: HTMLElement | null = null;
const LOAD_TIPS = [
  'Los pedidos se renuevan cada día y por la tarde.',
  'Tocá el suelo para caminar; tocá a alguien para hablar.',
  'Las plantas nunca se mueren: te esperan.',
  'Regalale a Pip algo brillante y vas a ver.',
  'Spicy guarda recetas secretas en su laboratorio.',
  'Rigg anota todo en su cuaderno. Vos también: revisá el Diario.',
  'El Mercado Nocturno abre los viernes y sábados a la noche.',
  'Podés descansar un rato en tu cama para pasar la hora.',
];

/** Screen fade; with a label it becomes a small loading card (zone changes). */
export function fade(on: boolean, ms = 250, label?: string): Promise<void> {
  if (!fadeEl) {
    fadeEl = h('div', { class: 'fade' });
    uiRoot().append(fadeEl);
  }
  if (on && label) {
    fadeEl.innerHTML = '';
    fadeEl.append(
      h('div', { class: 'load-card' },
        h('div', { class: 'load-paws' }, h('i'), h('i'), h('i')),
        h('div', { class: 'load-name' }, label),
        h('div', { class: 'load-tip' }, LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)])),
    );
  } else if (on) fadeEl.innerHTML = '';
  const duration = reducedMotion() ? 0 : ms;
  fadeEl.style.transitionDuration = duration + 'ms';
  if (fadeEl.classList.contains('on') === on) return Promise.resolve();
  void getComputedStyle(fadeEl).opacity;
  return waitTransition(fadeEl, 'opacity', duration, () => fadeEl!.classList.toggle('on', on));
}

function reducedMotion(): boolean {
  return settings.reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Wait for the actual CSS transition, with a bounded fallback for interrupted/hidden pages. */
function waitTransition(el: HTMLElement, property: string, ms: number, change: () => void): Promise<void> {
  if (ms <= 0) { change(); return Promise.resolve(); }
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); el.removeEventListener('transitionend', end); resolve(); };
    const end = (e: TransitionEvent) => { if (e.target === el && e.propertyName === property) finish(); };
    const timer = window.setTimeout(finish, ms + 80);
    el.addEventListener('transitionend', end);
    change();
  });
}

let curtains: HTMLElement | null = null;
let leftCurtain: HTMLElement;
async function curtain(on: boolean) {
  if (!curtains) {
    leftCurtain = h('div', { class: 'door-panel door-left' });
    curtains = h('div', { class: 'door-curtain', 'aria-hidden': 'true' }, leftCurtain, h('div', { class: 'door-panel door-right' }));
    uiRoot().append(curtains);
  }
  curtains.classList.add('active');
  curtains.classList.remove('settled');
  // Commit the off-screen starting position before asking CSS to close the panels.
  void getComputedStyle(leftCurtain).transform;
  curtains.dataset.phase = on ? 'closing' : 'opening';
  await waitTransition(leftCurtain, 'transform', 240, () => curtains!.classList.toggle('closed', on));
  if (on) {
    // A busy/hidden browser can deliver the deadline before a compositor transition
    // finishes. Commit both panels' closed positions before mounting any new scene.
    curtains.classList.add('settled');
    void getComputedStyle(leftCurtain).transform;
  }
  curtains.dataset.phase = on ? 'covered' : 'idle';
  if (!on) curtains.classList.remove('active');
}

/** Covers the old frame, loads/renders while covered, and always releases the overlay on failure. */
export async function screenTransition<T>(kind: TransitionKind, load: () => Promise<T>): Promise<T> {
  const panels = kind === 'doors' && !reducedMotion();
  if (panels) await curtain(true);
  else { await fade(true, 200); fadeEl!.classList.add('busy'); }
  try { return await load(); }
  finally {
    if (panels) await curtain(false);
    else { try { await fade(false, 200); } finally { fadeEl!.classList.remove('busy'); } }
  }
}

/** Removes the initial loader once the title is mounted; no synthetic progress or extra hold. */
export function hideBoot() {
  const b = document.getElementById('boot');
  if (!b || b.classList.contains('out')) return;
  clearInterval((window as any).__bootTips);
  const ms = reducedMotion() ? 0 : 320;
  b.setAttribute('aria-busy', 'false');
  b.style.transitionDuration = ms + 'ms';
  void waitTransition(b, 'opacity', ms, () => b.classList.add('out')).then(() => b.remove());
}
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const START_TIPS = [
  'Encendiendo los faroles del muelle…',
  'Pip busca la llave del restaurante…',
  'El arroz ya está en el fuego…',
  'Rigg dobla el mapa de Villa Nori…',
  'Spicy deja el wasabi a un lado…',
];
const START_LANTERN = '<svg viewBox="0 0 16 24" shape-rendering="crispEdges" aria-hidden="true"><path fill="#3b2930" d="M7 0h2v4H7zM4 4h8v2H4zM2 6h12v14H2zM4 20h8v2H4zM7 22h2v2H7z"/><path fill="#b8524f" d="M4 5h8v2H4zM3 7h10v12H3zM4 19h8v2H4z"/><path fill="#f2c66d" d="M5 7h6v12H5zM4 9h8v8H4z"/><path fill="#f9df9b" d="M7 8h2v10H7z"/><path fill="#a8714a" d="M3 10h10v1H3zM3 15h10v1H3z"/></svg>';

/** Wood card shown while a playthrough is starting. Real sheet progress, then a short fade. */
export function openStartLoad(): { set: (done: number, total: number, text?: string) => void; close: () => Promise<void> } {
  if (typeof document === 'undefined') return { set() {}, async close() {} };
  const fill = h('i');
  const label = h('div', { class: 'start-load-label' }, 'Preparando Villa Nori…');
  const count = h('div', { class: 'start-load-count' }, '');
  const tip = h('div', { class: 'start-load-tip' }, START_TIPS[0]);
  const root = h('div', { class: 'start-load', role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' },
    h('div', { class: 'load-petals', 'aria-hidden': 'true' }, ...Array.from({ length: 28 }, (_, i) => h('i', { style: { left: `${i * 37 % 100}%`, animationDuration: `${8 + i % 7}s`, animationDelay: `${-(i * 1.73 % (8 + i % 7))}s` } }))),
    h('div', { class: 'start-load-card' },
      h('div', { class: 'start-load-lantern', 'aria-hidden': 'true', html: START_LANTERN }),
      h('div', { class: 'start-load-title' }, 'Maki & Mapaches'),
      label,
      h('div', { class: 'start-load-bar', 'aria-hidden': 'true' }, fill),
      count,
      tip,
    ),
  );
  document.body.append(root);
  const shown = performance.now();
  let tipIndex = 0;
  const timer = reducedMotion() ? 0 : window.setInterval(() => {
    tipIndex = (tipIndex + 1) % START_TIPS.length;
    tip.textContent = START_TIPS[tipIndex];
  }, 1600);
  let closed = false;
  return {
    set(done, total, text) {
      const ratio = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
      fill.style.width = `${Math.round(ratio * 100)}%`;
      if (text) label.textContent = text;
      count.textContent = total > 0 ? `${Math.min(done, total)} / ${total}` : '';
    },
    async close() {
      if (closed) return;
      closed = true;
      window.clearInterval(timer);
      fill.style.width = '100%';
      const hold = reducedMotion() ? 0 : Math.max(0, 280 - (performance.now() - shown));
      if (hold) await sleep(hold);
      root.setAttribute('aria-busy', 'false');
      const ms = reducedMotion() ? 0 : 380;
      root.style.transitionDuration = `${ms}ms`;
      await waitTransition(root, 'opacity', ms, () => root.classList.add('out'));
      root.remove();
    },
  };
}

export function coinText(n: number) {
  return `${n.toLocaleString('es-AR')} ●`;
}

/** append children skipping null/false */
export function add(parent: HTMLElement, ...children: Child[]) {
  for (const c of children) if (c != null && c !== false) parent.append(c instanceof Node ? c : String(c));
  return parent;
}
