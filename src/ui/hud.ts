/** Minimal exploration HUD: time, coins, bag/journal/menu buttons, contextual action, suggestions. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { h, uiRoot } from './dom';
import { skinIconEl } from './skin';

let root: HTMLElement | null = null;
let timeEl: HTMLElement;
let dateEl: HTMLElement;
let coinEl: HTMLElement;
let timeIcon: HTMLElement;
let actBtn: HTMLButtonElement;
let questEl: HTMLElement;
let suggestEl: HTMLElement;
let joyEl: HTMLElement | null = null;

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
  actBtn = h('button', { class: 'hud-interact', onclick: () => world?.tryInteract() }) as HTMLButtonElement;
  actBtn.style.display = 'none';
  questEl = h('div', { class: 'hud-quest', title: 'Tocá para achicar', onclick: () => { questEl.classList.toggle('mini'); try { localStorage.setItem('mm_questmini', questEl.classList.contains('mini') ? '1' : ''); } catch { /* ignore */ } } });
  try { if (localStorage.getItem('mm_questmini')) questEl.classList.add('mini'); } catch { /* ignore */ }
  suggestEl = h('div', { class: 'hud-suggest' });
  root = h('div', { class: 'passthrough' }, h('div', { class: 'hud-top' }, status, buttons), questEl, actBtn, suggestEl);
  uiRoot().append(root);
  refresh();
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
bus.on('interact:available', ({ label, kind }) => {
  if (!actBtn) return;
  actBtn.style.display = label ? '' : 'none';
  actBtn.innerHTML = '';
  if (label) actBtn.append(skinIconEl(kind === 'npc' ? 'talk' : 'act'), h('span', { class: 'lbl' }, label));
  actBtn.setAttribute('aria-label', label ?? '');
  if (suggestEl) suggestEl.style.display = label ? 'none' : '';
});
bus.on('dialogue:start', () => showHud(false));
bus.on('dialogue:end', () => showHud(true));
bus.on('settings:changed', () => setupJoystick());
setInterval(() => refresh(), 1000);

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
