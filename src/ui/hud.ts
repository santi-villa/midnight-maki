/** Minimal exploration HUD: time, coins, bag/journal/menu buttons, contextual action, suggestions. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { idleOffer, type ContextAction, type ContextOffer } from '../world/contextActions';
import { h, uiRoot } from './dom';
import { skinIconEl } from './skin';

let root: HTMLElement | null = null;
let timeEl: HTMLElement;
let dateEl: HTMLElement;
let coinEl: HTMLElement;
let timeIcon: HTMLElement;
let questEl: HTMLElement;
let suggestEl: HTMLElement;
let joyEl: HTMLElement | null = null;
let dock: HTMLElement | null = null;
let tagEl: HTMLElement | null = null;
let menuEl: HTMLElement | null = null;
let menuOpen = false;
let overflowKey = '';
const actionBtns = new Map<string, HTMLButtonElement>();

export interface HudHandlers {
  bag: () => void;
  journal: () => void;
  menu: () => void;
  questText: () => string | null;
  suggestions: () => { label: string; run: () => void }[];
}
let handlers: HudHandlers;

const PERIOD_ICON = ['sun', 'afternoon', 'dusk', 'moon'];

export function mountHud(hd: HudHandlers) {
  handlers = hd;
  if (root) root.remove();
  timeEl = h('span');
  dateEl = h('div', { class: 'hint', style: { fontSize: '.78em' } });
  coinEl = h('span', { class: 'coin' });
  timeIcon = h('span');
  const status = h('div', { class: 'hud-status' }, h('div', { class: 'time' }, timeIcon, timeEl), dateEl, h('div', { class: 'row', style: { gap: '4px' } }, iconElement({ type: 'coin' }), coinEl));
  status.querySelector('canvas')!.setAttribute('style', 'width:18px;height:18px;image-rendering:pixelated');
  const btn = (icon: string, label: string, fn: () => void) => {
    const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick: () => { audio.sfxPlay('open'); fn(); } }, skinIconEl(icon), h('span', { class: 'lbl' }, label));
    return b;
  };
  const buttons = h('div', { class: 'hud-buttons' }, btn('bag', 'Mochila', () => handlers.bag()), btn('scroll', 'Misiones', () => handlers.journal()), btn('map', 'Mapa', () => import('./worldmap').then((m) => m.openWorldMap())), btn('gear', 'Menú', () => handlers.menu()));
  questEl = h('div', { class: 'hud-quest', title: 'Tocá para achicar', onclick: () => { questEl.classList.toggle('mini'); try { localStorage.setItem('mm_questmini', questEl.classList.contains('mini') ? '1' : ''); } catch { /* ignore */ } } });
  try { if (localStorage.getItem('mm_questmini')) questEl.classList.add('mini'); } catch { /* ignore */ }
  suggestEl = h('div', { class: 'hud-suggest' });
  tagEl = h('div', { class: 'room-tag' });
  tagEl.style.display = 'none';
  menuEl = h('div', { class: 'ctx-menu' });
  dock = h('div', { class: 'ctx-dock' });
  actionBtns.clear();
  menuOpen = false;
  overflowKey = '';
  root = h('div', { class: 'passthrough' }, h('div', { class: 'hud-top' }, status, buttons), questEl, tagEl, dock, suggestEl);
  uiRoot().append(root);
  refresh();
  renderContext();
  setupJoystick();
}

export function showHud(v: boolean) {
  if (root) root.style.display = v ? '' : 'none';
  if (joyEl) joyEl.style.display = v && settings.joystick ? '' : 'none';
}

let lastIcon = -1;
export function refresh() {
  if (!root || !game.loaded) return;
  const t = game.save.time;
  timeEl.textContent = clock.label();
  dateEl.textContent = clock.dateLabel() + (game.flag('weather') === 'rain' ? ' · lluvia' : '');
  coinEl.textContent = game.coins.toLocaleString('es-AR');
  if (lastIcon !== t.period) {
    lastIcon = t.period;
    timeIcon.innerHTML = '';
    timeIcon.append(iconElement({ type: PERIOD_ICON[t.period] }));
  }
  const q = handlers.questText();
  questEl.style.display = q ? '' : 'none';
  if (q) questEl.innerHTML = q;
}

function refreshSuggestions() {
  if (!suggestEl) return;
  suggestEl.innerHTML = '';
  for (const s of handlers.suggestions().slice(0, 3))
    suggestEl.append(h('button', { onclick: () => { audio.sfxPlay('tap'); s.run(); } }, s.label));
}

bus.on('coins:changed', () => refresh());
bus.on('time:changed', () => {
  refresh();
  refreshSuggestions();
});
bus.on('quest:changed', () => refresh());
bus.on('zone:enter', () => {
  refresh();
  refreshSuggestions();
});
bus.on('flag:set', () => refresh());
bus.on('interact:available', () => renderContext());
bus.on('dialogue:start', () => showHud(false));
bus.on('dialogue:end', () => showHud(true));
bus.on('settings:changed', () => setupJoystick());
setInterval(() => refresh(), 1000);

// ------------------------------------------------------------------ contextual actions
interface BtnSpec {
  id: string;
  label: string;
  detail: string;
  icon: string;
  cls: string;
  primary?: boolean;
  run: () => void;
}

function renderContext() {
  if (!dock || !tagEl || !menuEl) return;
  const offer = world?.contextOffer ?? idleOffer(null);
  paintTag(offer.roomTag);
  const nextOverflow = offer.overflow.map((a) => a.id).join();
  if (nextOverflow !== overflowKey) {
    menuOpen = false;
    overflowKey = nextOverflow;
  }
  const specs = buttonSpecs(offer);
  const keep = new Set(specs.map((s) => s.id));
  for (const [id, el] of actionBtns) if (!keep.has(id)) removeAction(id, el);
  for (const spec of specs) {
    let el = actionBtns.get(spec.id);
    if (!el) {
      el = makeAction(spec);
      actionBtns.set(spec.id, el);
    } else fillAction(el, spec);
    dock.append(el);
  }
  paintMenu(offer);
  if (suggestEl) suggestEl.style.display = offer.primary ? 'none' : '';
}

function buttonSpecs(offer: ContextOffer): BtnSpec[] {
  const specs: BtnSpec[] = [];
  if (offer.chip) specs.push(actionSpec(offer.chip, 'btn ctx-chip'));
  if (offer.overflow.length) {
    specs.push({
      id: '__more',
      label: menuOpen ? 'Cerrar' : 'Más',
      detail: menuOpen ? 'Cerrar acciones' : 'Más acciones',
      icon: 'act',
      cls: 'btn ctx-chip ctx-more',
      run: () => {
        menuOpen = !menuOpen;
        renderContext();
      },
    });
  }
  if (offer.primary) specs.push(actionSpec(offer.primary, 'hud-interact', true));
  return specs;
}

function actionSpec(a: ContextAction, cls: string, primary = false): BtnSpec {
  return {
    id: a.id,
    label: a.label,
    detail: a.detail,
    icon: a.icon,
    cls,
    primary,
    run: () => {
      menuOpen = false;
      world?.perform(a);
    },
  };
}

function makeAction(spec: BtnSpec) {
  const el = h('button', { type: 'button', class: spec.cls + (settings.reduceMotion ? '' : ' ctx-pop') }) as HTMLButtonElement;
  fillAction(el, spec);
  return el;
}

function fillAction(el: HTMLButtonElement, spec: BtnSpec) {
  el.classList.toggle('hud-interact', !!spec.primary);
  el.classList.toggle('ctx-chip', !spec.primary);
  el.setAttribute('aria-label', spec.detail);
  if (spec.id === '__more') el.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
  if (el.dataset.icon !== spec.icon || el.childElementCount < 2) {
    el.dataset.icon = spec.icon;
    el.innerHTML = '';
    el.append(skinIconEl(spec.icon), h('span', { class: spec.primary ? 'lbl' : 'ctx-txt' }, spec.label));
  } else {
    const span = el.querySelector('span');
    if (span) {
      span.className = spec.primary ? 'lbl' : 'ctx-txt';
      span.textContent = spec.label;
    }
  }
  el.onclick = (e) => {
    e.stopPropagation();
    audio.sfxPlay('tap');
    spec.run();
    if (spec.id !== '__more') renderContext();
  };
}

function removeAction(id: string, el: HTMLButtonElement) {
  actionBtns.delete(id);
  if (settings.reduceMotion) {
    el.remove();
    return;
  }
  el.classList.add('ctx-leave');
  const done = () => el.remove();
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, 220);
}

function paintMenu(offer: ContextOffer) {
  if (!menuEl || !dock) return;
  if (!menuOpen || !offer.overflow.length) {
    if (menuEl.isConnected) menuEl.remove();
    return;
  }
  menuEl.innerHTML = '';
  for (const a of offer.overflow) {
    menuEl.append(h('button', {
      type: 'button',
      class: 'btn ctx-row' + (settings.reduceMotion ? '' : ' ctx-pop'),
      'aria-label': a.detail,
      onclick: (e: Event) => {
        e.stopPropagation();
        audio.sfxPlay('tap');
        menuOpen = false;
        world?.perform(a);
        renderContext();
      },
    }, skinIconEl(a.icon), h('span', null, a.detail)));
  }
  dock.prepend(menuEl);
}

function paintTag(name: string | null) {
  if (!tagEl) return;
  if (!name) {
    if (tagEl.style.display === 'none' || tagEl.dataset.leaving === '1') return;
    tagEl.dataset.name = '';
    if (settings.reduceMotion) {
      tagEl.style.display = 'none';
      return;
    }
    tagEl.dataset.leaving = '1';
    tagEl.classList.add('ctx-leave');
    const hide = () => {
      if (!tagEl || tagEl.dataset.name) return;
      tagEl.style.display = 'none';
      tagEl.dataset.leaving = '';
      tagEl.classList.remove('ctx-leave');
    };
    tagEl.addEventListener('animationend', hide, { once: true });
    setTimeout(hide, 220);
    return;
  }
  const show = tagEl.dataset.name !== name || tagEl.style.display === 'none';
  tagEl.dataset.name = name;
  tagEl.dataset.leaving = '';
  tagEl.textContent = name;
  tagEl.style.display = '';
  tagEl.classList.remove('ctx-leave');
  if (show && !settings.reduceMotion) {
    tagEl.classList.remove('ctx-fade');
    void tagEl.offsetWidth;
    tagEl.classList.add('ctx-fade');
  }
}

// ------------------------------------------------------------------ optional virtual joystick
function setupJoystick() {
  if (joyEl) {
    joyEl.remove();
    joyEl = null;
  }
  if (!settings.joystick || !root) return;
  const knob = h('i');
  joyEl = h('div', { class: 'joystick' }, knob);
  uiRoot().append(joyEl);
  let id: number | null = null;
  let cx = 0;
  let cy = 0;
  const set = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.min(45, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const kx = Math.cos(a) * d;
    const ky = Math.sin(a) * d;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    if (world) world.joy = { x: kx / 45, y: ky / 45 };
  };
  joyEl.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    const r = joyEl!.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    try { joyEl!.setPointerCapture(e.pointerId); } catch { /* synthetic or released pointer */ }
    set(e.clientX, e.clientY);
  });
  joyEl.addEventListener('pointermove', (e) => e.pointerId === id && set(e.clientX, e.clientY));
  const end = () => {
    id = null;
    knob.style.transform = '';
    if (world) world.joy = { x: 0, y: 0 };
  };
  joyEl.addEventListener('pointerup', end);
  joyEl.addEventListener('pointercancel', end);
}
