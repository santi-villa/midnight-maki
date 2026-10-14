/**
 * NoriPhone: a pixel-art phone that peeks out of the bottom edge of the screen and slides up when touched.
 * This file is the controller + DOM. The body is drawn by caseArt.ts, wallpapers by wallpapers.ts, the data lives in catalog.ts / prefs.ts,
 * and the apps are the game's own screens (registered by ui/menus.ts), so nothing here knows about maps, quests or friends.
 */
import { audio } from '../../audio/audio';
import { bus } from '../../core/events';
import { haptic } from '../../core/haptics';
import { settings } from '../../core/settings';
import { actionForCode, bindingMap } from '../../input/bindings';
import { game } from '../../core/state';
import { inDialogue } from '../../dialogue/dialogue';
import { clock } from '../../systems/time';
import { runTask } from '../../core/errors';
import { h, modalOpen, openModal } from '../dom';
import { formatHudTime, hudTime } from '../hudClock';
import { skinIconEl } from '../skin';
import { caseGeometry, drawCase, SIDE_MARGIN } from './caseArt';
import { COLORS, COLOR_BY_ID, MODELS, MODEL_BY_ID, WALLPAPERS, WALLPAPER_BY_ID, type PhoneKind } from './catalog';
import { choose, isUnlocked, markDesignsSeen, noveltyCounts, phonePrefs, refreshUnlocks, unseenDesigns } from './prefs';
import { wallpaperCanvas, wallpaperTile } from './wallpapers';
import './phone.css';

export interface PhoneApp { id: string; name: string; icon: string; hint: string; run: () => void | Promise<unknown>; closePhone?: boolean }

type Phase = 'closed' | 'opening' | 'open' | 'closing';
interface Look { model: string; color: string; wallpaper: string }

let appsProvider: () => PhoneApp[] = () => [];
export function registerPhoneApps(fn: () => PhoneApp[]) { appsProvider = fn; }

let layer: HTMLElement;
let dim: HTMLElement;
let device: HTMLElement;
let caseCanvas: HTMLCanvasElement;
let screen: HTMLElement;
let wall: HTMLCanvasElement;
let view: HTMLElement;
let peek: HTMLButtonElement;
let mounted = false;
let phase: Phase = 'closed';
let screenName: 'home' | 'custom' = 'home';
let openedAt = 0;
let closeModal: (() => void) | null = null;
let guard: HTMLElement | null = null;
let look: Look = { model: 'classic', color: 'crema', wallpaper: 'crema' };
let draft: Look | null = null;
let busyTimer = 0;
let appBusy = false;
let clockOff: (() => void) | null = null;

const reduced = () => document.body.classList.contains('reduce-motion') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const saved = (): Look => { const p = phonePrefs(); return { model: p.model, color: p.color, wallpaper: p.wallpaper }; };

/** Safe-area insets in CSS pixels (the probe resolves `env()` for us). */
function safeInsets() {
  const probe = h('div', { style: { position: 'fixed', visibility: 'hidden', pointerEvents: 'none', paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)', paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' } });
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const out = { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  probe.remove();
  return out;
}

/** Sizes the device for this window: almost the full height on a phone, a calm size on a big monitor. Draws the body at a whole-number pixel scale. */
function layout() {
  if (!mounted) return;
  const m = MODEL_BY_ID[look.model] ?? MODELS[0];
  const color = COLOR_BY_ID[look.color] ?? COLORS[0];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = safeInsets();
  const availH = Math.max(300, vh - s.t - s.b - 16);
  const availW = Math.max(200, vw - s.l - s.r - 16);
  let H = Math.min(availH, 780);
  let W = H * m.aspect;
  if (W > availW) { W = availW; H = W / m.aspect; }
  const pxs = Math.max(2, Math.min(4, Math.round(H / 230)));
  const Wc = Math.max(40, Math.round(W / pxs));
  const Hc = Math.max(80, Math.round(H / pxs));
  const geo = caseGeometry(m, Wc, Hc);
  const cssH = Hc * pxs;
  const peekH = (m.bezel.top + 2) * pxs;
  device.classList.add('no-anim');
  const st = device.style;
  st.setProperty('--px', pxs + 'px');
  st.width = Wc * pxs + 'px';
  st.height = cssH + 'px';
  st.setProperty('--scr-x', geo.sx * pxs + 'px');
  st.setProperty('--scr-y', geo.sy * pxs + 'px');
  st.setProperty('--scr-w', geo.sw * pxs + 'px');
  st.setProperty('--scr-h', geo.sh * pxs + 'px');
  st.setProperty('--scr-r', m.screenRadius * pxs + 'px');
  st.setProperty('--peek', peekH + 'px');
  // centred inside the safe area; closed = only the top edge shows above the bottom of the window
  const centreY = s.t + (vh - s.t - s.b) / 2;
  st.top = centreY + 'px';
  st.setProperty('--closed-y', (vh - s.b - peekH) - (centreY - cssH / 2) + 'px');
  drawCase(caseCanvas, m, color, Wc, Hc);
  peek.style.width = Math.max(120, Math.min(Wc * pxs, 260)) + 'px';
  device.dataset.model = m.id;
  void device.offsetWidth;
  device.classList.remove('no-anim');
}

async function paintWallpaper() {
  const id = (draft ?? look).wallpaper;
  const src = await wallpaperCanvas(id);
  if (id !== (draft ?? look).wallpaper) return;
  wall.width = src.width;
  wall.height = src.height;
  const g = wall.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
}

function applyLook(l: Look) {
  look = l;
  layout();
  void paintWallpaper();
}

// ------------------------------------------------------------------ opening and closing
export function isPhoneOpen() { return phase === 'open' || phase === 'opening'; }

export function openPhone() {
  if (!mounted || phase !== 'closed' || !game.loaded) return;
  if (modalOpen() || inDialogue()) return;
  phase = 'opening';
  openedAt = performance.now();
  applyLook(saved());
  draft = null;
  screenName = 'home';
  renderHome();
  guard = h('div', { class: 'noriphone-guard' });
  (guard as any).__close = closePhone;
  closeModal = openModal(guard); // pauses the clock, blocks the character, and lets Escape close it
  const quick = reduced();
  device.classList.toggle('instant', quick);
  screen.inert = false;
  layer.classList.add('is-open');
  device.classList.add('is-open');
  device.setAttribute('role', 'dialog');
  device.setAttribute('aria-modal', 'true');
  device.setAttribute('aria-label', 'NoriPhone');
  peek.tabIndex = -1;
  screen.classList.add('is-busy'); // no stray taps while it is still moving
  window.clearTimeout(busyTimer);
  busyTimer = window.setTimeout(settleOpen, quick ? 30 : 340);
  audio.sfxPlay('phone_open');
  haptic('tap');
  clockOff?.();
  clockOff = bus.on('time:changed', () => { if (screenName === 'home') renderStatus(); });
  void refreshBadges();
}

function settleOpen() {
  if (phase !== 'opening') return;
  phase = 'open';
  screen.classList.remove('is-busy');
  view.querySelector<HTMLElement>('.pn-app, .pn-tab')?.focus({ preventScroll: true });
}

export function closePhone() {
  if (phase === 'closed' || phase === 'closing') return;
  if (draft) revertDraft();
  phase = 'closing';
  window.clearTimeout(busyTimer);
  closeModal?.(); // the world is released as soon as it starts to go down
  closeModal = null;
  guard = null;
  clockOff?.();
  clockOff = null;
  device.removeAttribute('role');
  device.removeAttribute('aria-modal');
  layer.classList.remove('is-open');
  device.classList.remove('is-open');
  screen.classList.add('is-busy');
  audio.sfxPlay('phone_close');
  const done = () => {
    if (phase !== 'closing') return;
    phase = 'closed';
    screen.inert = true;
    peek.tabIndex = 0;
    screenName = 'home';
  };
  window.setTimeout(done, reduced() ? 30 : 260);
}

export function togglePhone() { phase === 'open' ? closePhone() : openPhone(); }

// ------------------------------------------------------------------ home screen
function renderStatus() {
  const el = view.querySelector<HTMLElement>('.pn-clock');
  if (!el) return;
  const t = game.save.time;
  el.innerHTML = '';
  el.append(h('b', null, formatHudTime(hudTime(t.period, t.minutes))), h('small', null, clock.dateLabel()));
}

function bar(title: string | null, back: (() => void) | null) {
  return h('header', { class: 'pn-bar' },
    back ? h('button', { type: 'button', class: 'pn-back', 'aria-label': 'Volver al inicio', onclick: back }, '‹') : null,
    title ? h('b', { class: 'pn-title' }, title) : h('div', { class: 'pn-clock' }),
    h('button', { type: 'button', class: 'pn-close', 'aria-label': 'Cerrar NoriPhone', onclick: () => closePhone() }, '✕'));
}

function badgeFor(id: string, n = noveltyCounts()): boolean {
  const seen = phonePrefs().seen;
  if (id === 'recipes') return n.recipes > (seen.recipes ?? n.recipes);
  if (id === 'quests') return n.quests > (seen.quests ?? n.quests);
  if (id === 'customize') return n.designs > 0;
  return false;
}

function markSeen(id: string) {
  const p = phonePrefs();
  const n = noveltyCounts();
  if (id === 'recipes') p.seen.recipes = n.recipes;
  if (id === 'quests') p.seen.quests = n.quests;
  if (id === 'customize') markDesignsSeen();
}

/** First time: remember the current counts so only genuinely new things get a dot. */
async function refreshBadges() {
  const p = phonePrefs();
  const n = noveltyCounts();
  if (p.seen.recipes == null) p.seen.recipes = n.recipes;
  if (p.seen.quests == null) p.seen.quests = n.quests;
}

function allApps(): PhoneApp[] {
  const apps = appsProvider();
  const mine: PhoneApp = { id: 'customize', name: 'Personalizar', icon: 'decor', hint: 'Modelo, color y fondo de tu NoriPhone', run: () => openCustomize() };
  const at = apps.findIndex((a) => a.id === 'settings');
  const list = [...apps];
  list.splice(at < 0 ? list.length : at, 0, mine);
  return list;
}

function renderHome() {
  screenName = 'home';
  view.innerHTML = '';
  const grid = h('div', { class: 'pn-apps' });
  const n = noveltyCounts();
  for (const app of allApps())
    grid.append(h('button', {
      type: 'button', class: 'pn-app', 'data-app': app.id, title: app.hint, 'aria-label': `${app.name}: ${app.hint}`,
      onclick: () => {
        if (appBusy || phase !== 'open') return;
        audio.sfxPlay('phone_tap');
        markSeen(app.id);
        if (app.id === 'customize') { app.run(); return; }
        appBusy = true;
        if (app.closePhone) closePhone();
        void runTask('phone:' + app.id, app.run).finally(() => { appBusy = false; if (screenName === 'home' && phase === 'open') renderHome(); });
      },
    }, h('span', { class: 'pn-icon', 'aria-hidden': 'true' }, skinIconEl(app.icon), badgeFor(app.id, n) ? h('i', { class: 'pn-badge' }) : null), h('span', { class: 'pn-label' }, app.name)));
  view.append(bar(null, null), h('main', { class: 'pn-main' }, h('p', { class: 'pn-hello' }, 'Un pueblo, tres mapaches y vos.'), grid), h('footer', { class: 'pn-home-bar', 'aria-hidden': 'true' }, h('i')));
  renderStatus();
}

// ------------------------------------------------------------------ "Personalizar"
function revertDraft() {
  draft = null;
  applyLook(saved());
}

function openCustomize() {
  screenName = 'custom';
  draft = { ...look };
  markDesignsSeen();
  renderCustomize('model');
}

function renderCustomize(tab: PhoneKind) {
  const d = draft!;
  view.innerHTML = '';
  const tabs = h('div', { class: 'pn-tabs', role: 'tablist' });
  for (const [kind, label] of [['model', 'Modelo'], ['color', 'Color'], ['wallpaper', 'Fondo']] as const)
    tabs.append(h('button', { type: 'button', role: 'tab', class: 'pn-tab' + (kind === tab ? ' on' : ''), 'aria-selected': String(kind === tab), onclick: () => { audio.sfxPlay('phone_tap'); renderCustomize(kind); } }, label));
  const hint = h('p', { class: 'pn-hint' }, 'Tocá una opción para ver cómo queda. Guardá para quedártela.');
  const grid = h('div', { class: 'pn-opts ' + tab });
  const items = tab === 'model' ? MODELS : tab === 'color' ? COLORS : WALLPAPERS;
  for (const it of items) {
    const open = isUnlocked(tab, it.id);
    const on = d[tab] === it.id;
    const thumb = h('span', { class: 'pn-thumb' });
    const b = h('button', {
      type: 'button', class: 'pn-opt' + (on ? ' on' : '') + (open ? '' : ' locked'), 'aria-pressed': String(on),
      'aria-label': open ? it.name : `${it.name}, bloqueado. ${it.unlock?.how ?? ''}`,
      onclick: () => {
        if (!open) { hint.textContent = `${it.name}: ${it.unlock?.how ?? 'Todavía no está disponible.'}`; audio.sfxPlay('error'); return; }
        d[tab] = it.id;
        audio.sfxPlay(tab === 'color' ? 'phone_tap' : 'phone_swap');
        haptic('tap');
        applyLook({ ...d });
        renderCustomize(tab);
      },
    }, thumb, h('span', { class: 'pn-opt-name' }, open ? it.name : '???'));
    if (tab === 'color') thumb.style.background = (COLOR_BY_ID[it.id]?.body ?? '#999');
    if (tab === 'model') {
      const cv = document.createElement('canvas');
      drawCase(cv, it as never, COLOR_BY_ID[d.color] ?? COLORS[0], 24, Math.round(24 / (it as never as { aspect: number }).aspect));
      thumb.append(cv);
    }
    if (tab === 'wallpaper') void wallpaperTile(it.id).then((c) => thumb.append(c));
    grid.append(b);
    if (!open && it.unlock) b.title = it.unlock.how;
  }
  const dirty = d.model !== saved().model || d.color !== saved().color || d.wallpaper !== saved().wallpaper;
  const foot = h('div', { class: 'pn-foot' },
    h('button', { type: 'button', class: 'pn-btn', onclick: () => { revertDraft(); renderHome(); } }, 'Cancelar'),
    h('button', { type: 'button', class: 'pn-btn primary', disabled: !dirty, onclick: () => {
      for (const kind of ['model', 'color', 'wallpaper'] as const) if (d[kind] !== saved()[kind]) choose(kind, d[kind]);
      draft = null;
      audio.sfxPlay('success');
      haptic('unlock');
      bus.emit('toast', { text: 'Listo: tu NoriPhone tiene su nuevo look.' });
      applyLook(saved());
      renderHome();
    } }, 'Guardar'));
  view.append(bar('Personalizar', () => { revertDraft(); renderHome(); }), tabs, h('main', { class: 'pn-main' }, hint, grid), foot);
}

// ------------------------------------------------------------------ gestures
/** Swiping down on the frame (never on the screen, where apps scroll) closes the phone. */
function setupGrip(el: HTMLElement) {
  let startY: number | null = null;
  let id = -1;
  el.addEventListener('pointerdown', (e) => {
    if (phase !== 'open') return;
    startY = e.clientY;
    id = e.pointerId;
    try { el.setPointerCapture(id); } catch { /* ignore */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (startY == null || e.pointerId !== id) return;
    if (e.clientY - startY > 48) { startY = null; closePhone(); }
  });
  const end = () => { startY = null; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ------------------------------------------------------------------ mounting
export function setPhoneVisible(v: boolean) {
  if (!mounted) return;
  layer.style.display = v ? '' : 'none';
  if (!v && phase !== 'closed') closePhone();
}

export function mountPhone() {
  if (mounted) return;
  mounted = true;
  const ui = document.getElementById('ui')!;
  caseCanvas = h('canvas', { class: 'noriphone-case', 'aria-hidden': 'true' });
  wall = h('canvas', { class: 'pn-wall', 'aria-hidden': 'true' });
  view = h('div', { class: 'pn-view' });
  screen = h('div', { class: 'noriphone-screen is-busy' }, wall, h('div', { class: 'pn-shade' }), view);
  peek = h('button', { type: 'button', class: 'noriphone-peek', 'aria-label': 'Abrir NoriPhone', onclick: () => openPhone() });
  const gripTop = h('div', { class: 'noriphone-grip top' });
  const gripBottom = h('div', { class: 'noriphone-grip bottom' });
  device = h('div', { class: 'noriphone-device' }, caseCanvas, screen, gripTop, gripBottom, peek);
  screen.inert = true;
  dim = h('div', { class: 'noriphone-dim' });
  dim.addEventListener('pointerdown', () => { if (phase === 'open' && performance.now() - openedAt > 450 && !modalOpen_top()) closePhone(); });
  layer = h('div', { class: 'noriphone-layer' }, dim, device);
  ui.append(layer);
  setupGrip(gripTop);
  setupGrip(gripBottom);
  look = game.loaded ? saved() : look;
  layout();
  void paintWallpaper();
  window.addEventListener('resize', () => { layout(); });
  window.visualViewport?.addEventListener('resize', () => layout());
  window.addEventListener('keydown', onKey);
  bus.on('phone:changed', () => { if (phase === 'closed') applyLook(saved()); });
  // new designs are announced once (the first pass after loading stays silent)
  refreshUnlocks();
  let timer = 0;
  bus.on('state:changed', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!game.loaded) return;
      const fresh = refreshUnlocks();
      if (fresh.length) {
        audio.sfxPlay('phone_unlock');
        haptic('unlock');
        bus.emit('toast', { text: `Nuevo diseño para tu NoriPhone: ${fresh.join(', ')}.` });
      }
    }, 1200);
  });
}

/** True when another window (an app opened from the phone) is on top of it. */
function modalOpen_top(): boolean {
  return !!guard && document.querySelector('#ui > .panel-backdrop, #ui > .cook, #ui > .mg') != null;
}

function onKey(e: KeyboardEvent) {
  const key = (settings.phoneKey ?? 'p').toLowerCase();
  const bound = actionForCode(e.code, bindingMap(settings.bindings)) === 'phone';
  if ((!bound && e.key.toLowerCase() !== key) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!game.loaded || layer.style.display === 'none') return;
  if (phase === 'open' && !modalOpen_top()) { e.preventDefault(); closePhone(); }
  else if (phase === 'closed') { e.preventDefault(); openPhone(); }
}

export function phoneState() { return { phase, screen: screenName, look }; }
void WALLPAPER_BY_ID;
void unseenDesigns;
void SIDE_MARGIN;
