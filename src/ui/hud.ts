/** Minimal exploration HUD: time, coins, bag/journal/menu buttons, contextual action, suggestions. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { dayOfSeason, WEEKDAYS, weekday } from '../core/balance';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { idleOffer, type ContextAction, type ContextOffer } from '../world/contextActions';
import { h, uiRoot } from './dom';
import { skinIconEl } from './skin';
import { formatHudTime, hudTime, paintHudClock } from './hudClock';
import './hud.css';

let root: HTMLElement | null = null;
let timeEl: HTMLElement;
let digitalEl: HTMLTimeElement;
let dateEl: HTMLElement;
let coinEl: HTMLElement;
let clockEl: HTMLCanvasElement;
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

export function mountHud(hd: HudHandlers) {
  handlers = hd;
  if (root) root.remove();
  timeEl = h('span');
  dateEl = h('div', { class: 'hud-date' });
  coinEl = h('span', { class: 'coin' });
  clockEl = h('canvas', { class: 'hud-clock', width: 32, height: 32, role: 'img', 'aria-label': 'Hora del juego' });
  digitalEl = h('time', { class: 'hud-digital' });
  const status = h('div', { class: 'hud-status' }, h('div', { class: 'hud-time-row' }, clockEl, digitalEl), h('div', { class: 'time' }, timeEl), dateEl, h('div', { class: 'hud-coins' }, iconElement({ type: 'coin' }), coinEl));
  const toggle = h('button', {
    type: 'button', class: 'hud-status-toggle', 'aria-label': 'Contraer fecha y monedas', 'aria-expanded': 'true',
    onclick: () => {
      const collapsed = status.classList.toggle('is-collapsed');
      root?.classList.toggle('hud-status-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Mostrar fecha y monedas' : 'Contraer fecha y monedas');
      toggle.textContent = collapsed ? '→' : '←';
    },
  }, '←');
  const statusWrap = h('div', { class: 'hud-status-wrap' }, status, toggle);
  const btn = (icon: string, label: string, fn: () => void) => {
    const b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick: () => { audio.sfxPlay('open'); fn(); } }, skinIconEl(icon));
    return b;
  };
  const menuButton = btn('menu', 'Menú', () => handlers.menu());
  menuButton.firstElementChild!.classList.add('hud-menu-mobile');
  menuButton.append(skinIconEl('wood_gear', 'skin-icon hud-menu-desktop'));
  const buttons = h('div', { class: 'hud-buttons' }, btn('bag', 'Mochila', () => handlers.bag()), btn('clipboard', 'Misiones', () => handlers.journal()), btn('map', 'Mapa', () => import('./worldmap').then((m) => m.openWorldMap())), menuButton);
  questEl = h('div', {
    class: 'hud-quest', role: 'button', tabindex: 0, title: 'Ver detalles de la misión',
    onclick: () => {
      const mini = questEl.classList.toggle('mini');
      questEl.setAttribute('aria-expanded', String(!mini));
      try { localStorage.setItem('mm_questmini', mini ? '1' : '0'); } catch { /* ignore */ }
    },
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); questEl.click(); }
    },
  });
  questEl.classList.add('mini');
  try { if (localStorage.getItem('mm_questmini') === '0') questEl.classList.remove('mini'); } catch { /* ignore */ }
  questEl.setAttribute('aria-expanded', String(!questEl.classList.contains('mini')));
  suggestEl = h('div', { class: 'hud-suggest' });
  tagEl = h('div', { class: 'room-tag' });
  tagEl.style.display = 'none';
  menuEl = h('div', { class: 'ctx-menu' });
  dock = h('div', { class: 'ctx-dock' });
  actionBtns.clear();
  menuOpen = false;
  overflowKey = '';
  root = h('div', { class: 'passthrough game-hud' }, h('div', { class: 'hud-top' }, statusWrap, buttons), questEl, tagEl, dock, suggestEl);
  uiRoot().append(root);
  refresh();
  refreshSuggestions();
  renderContext();
  setupJoystick();
}

export function showHud(v: boolean) {
  if (root) root.style.display = v ? '' : 'none';
  if (joyEl) joyEl.style.display = v && settings.joystick ? '' : 'none';
}

export function refresh() {
  if (!root || !game.loaded) return;
  const t = game.save.time;
  timeEl.textContent = clock.label();
  dateEl.textContent = `${WEEKDAYS[weekday(t.day)]} ${dayOfSeason(t.day)}`;
  dateEl.title = clock.dateLabel() + (game.flag('weather') === 'rain' ? ' · lluvia' : '');
  coinEl.textContent = game.coins.toLocaleString('es-AR');
  const minute = hudTime(t.period, t.minutes);
  const label = formatHudTime(minute);
  digitalEl.textContent = label;
  digitalEl.dateTime = label;
  digitalEl.setAttribute('aria-label', `Hora del juego: ${label}`);
  paintHudClock(clockEl, minute);
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
  joyEl = h('div', { class: 'joystick game-joystick' }, knob);
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
