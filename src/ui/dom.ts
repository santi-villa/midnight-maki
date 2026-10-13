/** Tiny DOM toolkit for the HTML UI layer (menus, dialogue, minigames). */
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { clock } from '../systems/time';
import { settings } from '../core/settings';
import type { TransitionKind } from '../world/zoneTransition';

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
interface ModalRec { el: HTMLElement; onClose?: () => void; }
const stack: ModalRec[] = [];

export function modalOpen() {
  return stack.length > 0;
}

export function openModal(el: HTMLElement, onClose?: () => void): () => void {
  const rec: ModalRec = { el, onClose };
  stack.push(rec);
  uiRoot().append(el);
  clock.pause();
  bus.emit('ui:modal', { open: true });
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(rec);
    if (i >= 0) stack.splice(i, 1);
    el.remove();
    clock.resume();
    rec.onClose?.();
    bus.emit('ui:modal', { open: stack.length > 0 });
  };
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
}): { close: () => void; body: HTMLElement; root: HTMLElement } {
  const body = h('div', { class: 'panel-body' }, ...(Array.isArray(opts.body) ? opts.body : [opts.body]));
  let close = () => {};
  const head = h(
    'div',
    { class: 'panel-head' },
    h('h2', null, opts.title),
    opts.closable === false ? null : h('button', { class: 'close-x', 'aria-label': 'Cerrar', onclick: () => { audio.sfxPlay('close'); close(); } }, '✕'),
  );
  const p = h('div', { class: 'panel', style: opts.wide ? { width: 'min(820px, 100%)' } : undefined }, head, opts.tabs ?? null, body, opts.foot?.length ? h('div', { class: 'panel-foot' }, ...opts.foot) : null);
  const back = h('div', { class: 'panel-backdrop' }, p);
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back && opts.closable !== false) close();
  });
  audio.sfxPlay('open');
  close = openModal(back, opts.onClose);
  (back as any).__close = close;
  return { close, body, root: p };
}

/** Escape closes the top-most modal */
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !stack.length) return;
    const top = stack[stack.length - 1].el as any;
    if (top.__close && !top.dataset.noesc) top.__close();
  });
}

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

export function coinText(n: number) {
  return `${n.toLocaleString('es-AR')} ●`;
}

/** append children skipping null/false */
export function add(parent: HTMLElement, ...children: Child[]) {
  for (const c of children) if (c != null && c !== false) parent.append(c instanceof Node ? c : String(c));
  return parent;
}
