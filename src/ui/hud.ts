/** Minimal exploration HUD: time, coins, bag/journal/menu buttons, contextual action, suggestions. */
import { iconElement } from '../art/icons';
import { haptic } from '../core/haptics';
import { audio } from '../audio/audio';
import { getEnergy, TIRED_LIMIT, WARN_LIMIT } from '../systems/fatigue';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { bindingMap, keyLabel, type GameAction } from '../input/bindings';
import { inputMethod } from '../input/keys';
import { dayOfSeason, WEEKDAYS, weekday } from '../core/balance';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { idleOffer, needsMore, secondaryActions, type ContextAction, type ContextOffer } from '../world/contextActions';
import { h, uiRoot } from './dom';
import { skinIconEl } from './skin';
import { formatHudTime, hudTime, paintHudClock } from './hudClock';
import './hud.css';
import { mountPhone, setPhoneVisible } from './phone/phone';

let root: HTMLElement | null = null;
let timeEl: HTMLElement;
let digitalEl: HTMLTimeElement;
let dateEl: HTMLElement;
let coinEl: HTMLElement;
let energyEl: HTMLElement;
let clockEl: HTMLCanvasElement;
let questEl: HTMLElement;
let suggestEl: HTMLElement;
let phoneBtn: HTMLButtonElement | null = null;
let joyEl: HTMLElement | null = null;
let dock: HTMLElement | null = null;
let tagEl: HTMLElement | null = null;
let menuEl: HTMLElement | null = null;
let menuOpen = false;
let overflowKey = '';
const actionBtns = new Map<string, HTMLButtonElement>();
const chrome: { el: HTMLButtonElement; action: GameAction; name: string }[] = [];

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
  energyEl = h('div', { class: 'hud-energy', role: 'img' }, h('i'));
  const status = h('div', { class: 'hud-status' }, h('div', { class: 'hud-time-row' }, clockEl, digitalEl), h('div', { class: 'time' }, timeEl), dateEl, h('div', { class: 'hud-coins' }, iconElement({ type: 'coin' }), coinEl), energyEl);
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
  const btn = (icon: string, label: string, action: GameAction, fn: () => void) => {
    const b = h('button', { type: 'button', class: 'icon-btn', onclick: () => { audio.sfxPlay('open'); fn(); } }, skinIconEl(icon));
    chrome.push({ el: b, action, name: label });
    return b;
  };
  chrome.length = 0;
  const buttons = h('div', { class: 'hud-buttons' }, btn('bag', 'Mochila', 'inventory', () => handlers.bag()), btn('clipboard', 'Misiones', 'journal', () => handlers.journal()), btn('map', 'Mapa', 'map', () => import('./worldmap').then((m) => m.openWorldMap())));
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
  phoneBtn = h('button', {
    type: 'button',
    class: 'hud-phone',
    onclick: () => { audio.sfxPlay('open'); void import('./menus').then((m) => m.openNoriPhone()); },
  }, skinIconEl('phone'), h('span', { class: 'lbl' }, 'NoriPhone'));
  const corner = h('div', { class: 'hud-corner' }, suggestEl, phoneBtn);
  tagEl = h('div', { class: 'room-tag' });
  tagEl.style.display = 'none';
  menuEl = h('div', { class: 'ctx-menu' });
  dock = h('div', { class: 'ctx-dock' });
  actionBtns.clear();
  menuOpen = false;
  overflowKey = '';
  root = h('div', { class: 'passthrough game-hud' }, h('div', { class: 'hud-top' }, statusWrap, buttons), questEl, tagEl, dock, corner);
  uiRoot().append(root);
  refresh();
  refreshSuggestions();
  renderContext();
  paintChrome();
  setupJoystick();
  mountPhone();
}

export function showHud(v: boolean) {
  setPhoneVisible(v);
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
  paintEnergy();
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

/** "+12 🪙" next to the counter; gains that arrive close together add up into one pop */
let popEl: HTMLElement | null = null, popTotal = 0, popTimer = 0;
function paintEnergy() {
  if (!energyEl) return;
  const e = Math.round(getEnergy());
  (energyEl.firstElementChild as HTMLElement).style.width = `${e}%`;
  energyEl.dataset.level = e <= TIRED_LIMIT ? 'empty' : e <= WARN_LIMIT ? 'low' : 'ok';
  const text = `Energía ${e}/100${e <= TIRED_LIMIT ? ': muy cansada, no podés cocinar' : ''}`;
  energyEl.setAttribute('aria-label', text); energyEl.title = text;
}
bus.on('energy:changed', () => paintEnergy());

/** A mission pays: the coins burst loose in the middle of the screen, no box, with sparkles and a coin shower sound. */
bus.on('reward:coins', ({ coins }) => {
  const host = uiRoot();
  const el = h('div', { class: 'big-reward', 'aria-live': 'polite' }, h('span', { class: 'br-plus' }, `+${coins.toLocaleString('es-AR')}`), iconElement({ type: 'coin' }, 'br-coin'));
  const sparks = settings.reduceMotion ? 0 : 14;
  for (let i = 0; i < sparks; i++) {
    const a = (i / sparks) * Math.PI * 2 + Math.random() * 0.4, d = 90 + Math.random() * 90;
    el.append(h('i', { class: 'br-spark', style: { '--dx': `${Math.round(Math.cos(a) * d)}px`, '--dy': `${Math.round(Math.sin(a) * d - 20)}px`, animationDelay: `${Math.round(Math.random() * 180)}ms` } }));
  }
  host.append(el);
  audio.sfxPlay('success');
  [0, 110, 220, 330].forEach((ms) => window.setTimeout(() => audio.sfxPlay('coin'), ms));
  haptic('reward');
  window.setTimeout(() => el.remove(), 2600);
});

function coinPop(delta: number) {
  const host = coinEl?.parentElement;
  if (!host || !root?.isConnected) return;
  if (!popEl || !popEl.isConnected) { popEl = h('span', { class: 'coin-pop', 'aria-hidden': 'true' }); host.append(popEl); popTotal = 0; }
  popTotal += delta;
  popEl.textContent = `+${popTotal.toLocaleString('es-AR')} 🪙`;
  popEl.classList.remove('go'); void popEl.offsetWidth; popEl.classList.add('go');
  clearTimeout(popTimer);
  popTimer = window.setTimeout(() => { popEl?.remove(); popEl = null; popTotal = 0; }, 1700);
}
bus.on('coins:changed', ({ delta }) => { refresh(); if (delta > 0) coinPop(delta); });
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
bus.on('settings:changed', syncInputChrome);
bus.on('input:method', syncInputChrome);
setInterval(() => refresh(), 1000);

// ------------------------------------------------------------------ contextual actions
interface BtnSpec {
  id: string;
  label: string;
  detail: string;
  icon: string;
  cls: string;
  primary?: boolean;
  keyAction?: GameAction;
  run: () => void;
}

/** The main action floats right over what it is about: "[E] Hablar" above the raccoon, the door, the counter. */
let promptEl: HTMLButtonElement | null = null;
let promptKey = '';
function promptLoop() {
  requestAnimationFrame(promptLoop);
  const offer = world?.contextOffer;
  const a = offer?.primary;
  const pos = a && root?.isConnected && root.style.display !== 'none' && !document.body.classList.contains('cook-focus') ? world.promptScreenPos(a) : null;
  if (!a || !pos) { if (promptEl) promptEl.hidden = true; return; }
  if (!promptEl) {
    promptEl = h('button', { type: 'button', class: 'world-prompt', onclick: (e: Event) => { e.stopPropagation(); const cur = world?.contextOffer?.primary; if (cur) { audio.sfxPlay('tap'); world.perform(cur); } } }) as HTMLButtonElement;
    uiRoot().append(promptEl);
  }
  const key = inputMethod() === 'touch' ? null : keyLabel(bindingMap(settings.bindings)['interact']);
  const text = `${key ? `[${key}] ` : ''}${a.label}`;
  if (text !== promptKey) { promptKey = text; promptEl.textContent = text; }
  promptEl.hidden = false;
  promptEl.style.left = `${Math.round(pos.x)}px`;
  promptEl.style.top = `${Math.round(pos.y)}px`;
}
promptLoop();

function renderContext() {
  if (!dock || !tagEl || !menuEl) return;
  const offer = world?.contextOffer ?? idleOffer(null);
  paintTag(offer.roomTag);
  const nextOverflow = secondaryActions(offer).map((a) => a.id).join();
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
  phoneBtn?.classList.toggle('is-parked', !!offer.primary);
}

function buttonSpecs(offer: ContextOffer): BtnSpec[] {
  const specs: BtnSpec[] = [];
  // one action: E. Two: E and F. More: E is the main one and F opens "Más acciones…" (touch gets the same two buttons)
  if (needsMore(offer)) {
    specs.push({
      id: '__more',
      label: menuOpen ? 'Cerrar' : 'Más acciones…',
      detail: menuOpen ? 'Cerrar acciones' : 'Más acciones',
      icon: 'act',
      cls: 'btn ctx-chip ctx-more',
      keyAction: 'secondary',
      run: () => {
        menuOpen = !menuOpen;
        renderContext();
      },
    });
  } else if (offer.chip) specs.push(actionSpec(offer.chip, 'btn ctx-chip', false, 'secondary'));
  if (offer.primary) specs.push(actionSpec(offer.primary, 'hud-interact', true, 'interact'));
  return specs;
}

function actionSpec(a: ContextAction, cls: string, primary = false, keyAction?: GameAction): BtnSpec {
  return {
    id: a.id,
    label: a.label,
    detail: a.detail,
    icon: a.icon,
    cls,
    primary,
    keyAction,
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

function hintKey(spec: BtnSpec): string | null {
  if (!spec.keyAction || inputMethod() === 'touch') return null;
  return keyLabel(bindingMap(settings.bindings)[spec.keyAction]);
}

function paintActionLabel(span: HTMLElement, spec: BtnSpec, key: string | null) {
  span.className = spec.primary ? 'lbl' : 'ctx-txt';
  span.replaceChildren();
  if (key && inputMethod() === 'keyboard') span.append(h('kbd', null, key), document.createTextNode(` ${spec.label}`));
  else span.textContent = spec.label;
}

function fillAction(el: HTMLButtonElement, spec: BtnSpec) {
  const key = hintKey(spec);
  el.classList.toggle('hud-interact', !!spec.primary);
  el.classList.toggle('ctx-chip', !spec.primary);
  el.title = key ? `${spec.detail} [${key}]` : spec.detail;
  el.setAttribute('aria-label', key ? `${spec.detail} (${key})` : spec.detail);
  if (spec.id === '__more') el.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
  if (el.dataset.icon !== spec.icon || el.childElementCount < 2) {
    el.dataset.icon = spec.icon;
    el.innerHTML = '';
    const span = h('span');
    paintActionLabel(span, spec, key);
    el.append(skinIconEl(spec.icon), span);
  } else {
    const span = el.querySelector('span');
    if (span) paintActionLabel(span, spec, key);
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
  if (!menuOpen || !needsMore(offer)) {
    if (menuEl.isConnected) menuEl.remove();
    return;
  }
  menuEl.innerHTML = '';
  for (const a of secondaryActions(offer)) {
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
function paintPhoneButton() {
  if (!phoneBtn) return;
  const keyboard = inputMethod() === 'keyboard';
  const span = phoneBtn.querySelector('span');
  if (span) {
    span.replaceChildren();
    if (keyboard) span.append(h('kbd', null, 'Tab'), document.createTextNode(' NoriPhone'));
    else span.textContent = 'NoriPhone';
  }
  const title = keyboard ? 'NoriPhone [Tab]' : 'NoriPhone';
  phoneBtn.title = title;
  phoneBtn.setAttribute('aria-label', title);
}

function paintChrome() {
  paintPhoneButton();
  for (const item of chrome) {
    const key = inputMethod() === 'touch' ? null : keyLabel(bindingMap(settings.bindings)[item.action]);
    const title = key ? `${item.name} [${key}]` : item.name;
    item.el.title = title;
    item.el.setAttribute('aria-label', title);
  }
}

function syncInputChrome() {
  document.body.classList.toggle('kbd-input', inputMethod() === 'keyboard');
  setupJoystick();
  renderContext();
  paintChrome();
}

function setupJoystick() {
  if (joyEl) {
    joyEl.remove();
    joyEl = null;
    if (world) world.joy = { x: 0, y: 0 };
  }
  // The on-screen stick is for touch. Mouse and keyboard keep the ground tap and WASD.
  if (!settings.joystick || !root || inputMethod() !== 'touch') return;
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

/** F with more than two actions: open or close the "Más acciones…" list. Returns whether the list is open now. */
export function toggleMoreMenu(): boolean {
  const offer = world?.contextOffer;
  if (!offer || !needsMore(offer)) return false;
  menuOpen = !menuOpen;
  renderContext();
  return menuOpen;
}
/** Escape closes the list first. Returns whether something was closed. */
export function closeMoreMenu(): boolean {
  if (!menuOpen) return false;
  menuOpen = false;
  renderContext();
  return true;
}
