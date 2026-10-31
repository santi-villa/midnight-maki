/**
 * NoriPhone: a medium-small pixel phone that peeks from the bottom-right corner and slides up to the centre when touched.
 * This file is the controller + DOM. The body is drawn by caseArt.ts, wallpapers by wallpapers.ts, the data lives in catalog.ts / prefs.ts,
 * and the apps are the game's own screens (registered by ui/menus.ts), so nothing here knows about maps, quests or friends.
 */
import { audio } from '../../audio/audio';
import { bus } from '../../core/events';
import { haptic } from '../../core/haptics';
import { settings } from '../../core/settings';
import { normalizeUiScale } from '../../core/uiScale';
import { actionForCode, bindingMap, isTypingTarget } from '../../input/bindings';
import { game } from '../../core/state';
import { inDialogue } from '../../dialogue/dialogue';
import { clock } from '../../systems/time';
import { runTask } from '../../core/errors';
import { h, modalOpen, openModal, mountModalHost } from '../dom';
import { formatHudTime, hudTime } from '../hudClock';
import { skinIconEl } from '../skin';
import { phoneAppIcon, phoneCharm, phoneDeco, phoneSignals } from './appIcons';
import { caseGeometry, drawCase, SIDE_MARGIN } from './caseArt';
import { COLORS, COLOR_BY_ID, MODELS, MODEL_BY_ID, WALLPAPERS, WALLPAPER_BY_ID, type PhoneKind } from './catalog';
import { phoneExplore, phoneKeyIntent } from './phoneKey';
import { clampPage, groupPhoneApps, orderPhoneApps } from './pages';
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
let appHost: HTMLElement;
let unmountApps: (() => void) | null = null;
let mounted = false;
let phase: Phase = 'closed';
let screenName: 'home' | 'custom' | 'app' = 'home';
let openedAt = 0;
let closeModal: (() => void) | null = null;
let guard: HTMLElement | null = null;
let look: Look = { model: 'classic', color: 'crema', wallpaper: 'crema' };
let draft: Look | null = null;
let busyTimer = 0;
let appBusy = false;
let appLaunch = 0;
let clockOff: (() => void) | null = null;
let homePage = 0;
let pageApi: { show: (page: number) => void } | null = null;

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
  const scale = normalizeUiScale(settings.uiScale);
  const logicalW = vw / scale;
  const s = safeInsets();
  const availH = Math.max(160, (vh - s.t - s.b - 16) / scale);
  const availW = Math.max(160, (vw - s.l - s.r - 16) / scale);
  let H = Math.min(availH, 780);
  let W = H * m.aspect;
  if (W > availW) { W = availW; H = W / m.aspect; }
  const pxs = Math.max(2, Math.min(4, Math.round(H / 230)));
  const Wc = Math.max(40, Math.round(W / pxs));
  const Hc = Math.max(80, Math.round(H / pxs));
  const geo = caseGeometry(m, Wc, Hc);
  const cssW = Wc * pxs;
  const cssH = Hc * pxs;
  // Closed: the same phone, scaled down and tucked under the bottom-right corner so only its top shows.
  // Open: the same art, centred. The visible part is also what the HUD keeps clear above it.
  const centreY = (s.t + (vh - s.t - s.b) / 2) / scale;
  const maxW = 128;
  const closedScale = Math.min(0.5, maxW / cssW);
  const closedW = cssW * closedScale;
  const closedH = cssH * closedScale;
  const visH = Math.round(Math.min(closedH * 0.36, 120));
  const cx = logicalW - (s.r + 12) / scale - closedW / 2;
  const cy = (vh - s.b) / scale - visH + closedH / 2;
  document.documentElement.style.setProperty('--phone-peek-h', visH + 'px');
  device.classList.add('no-anim');
  const st = device.style;
  st.setProperty('--px', pxs + 'px');
  st.width = cssW + 'px';
  st.height = cssH + 'px';
  st.setProperty('--scr-x', geo.sx * pxs + 'px');
  st.setProperty('--scr-y', geo.sy * pxs + 'px');
  st.setProperty('--scr-w', geo.sw * pxs + 'px');
  st.setProperty('--scr-h', geo.sh * pxs + 'px');
  st.setProperty('--scr-r', m.screenRadius * pxs + 'px');
  st.setProperty('--home-y', (geo.sy + geo.sh + m.bezel.bottom / 2) * pxs + 'px');
  st.setProperty('--home-size', Math.min(36, Math.max(24, (m.bezel.bottom - 5) * pxs)) + 'px');
  st.setProperty('--closed-scale', closedScale.toFixed(3));
  st.setProperty('--peek-x', Math.round(cx - logicalW / 2) + 'px');
  st.setProperty('--peek-y', Math.round(cy - centreY) + 'px');
  st.top = centreY + 'px';
  drawCase(caseCanvas, m, color, Wc, Hc);
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
  homePage = 0;
  renderHome();
  guard = h('div', { class: 'noriphone-guard' });
  (guard as any).__close = closePhone;
  closeModal = openModal(guard, undefined, { focusRoot: device });
  unmountApps = mountModalHost(appHost, device, depth => {
    const active = depth > 0;
    appHost.hidden = !active;
    view.inert = active;
    screen.classList.toggle('has-app', active);
    if (active) { appBusy = false; screenName = 'app'; }
    else if (phase === 'open' || phase === 'opening') renderHome();
  });
  const quick = reduced();
  device.classList.toggle('instant', quick);
  screen.inert = false;
  layer.classList.add('is-open');
  device.classList.add('is-open');
  device.setAttribute('role', 'dialog');
  device.setAttribute('aria-modal', 'true');
  device.setAttribute('aria-label', 'NoriPhone');
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
  appLaunch++; appBusy = false;
  unmountApps?.(); unmountApps = null;
  appHost.hidden = true; view.inert = false; screen.classList.remove('has-app');
  window.clearTimeout(busyTimer);
  closeModal?.(); // the world is released as soon as it starts to go down
  closeModal = null;
  guard = null;
  clockOff?.();
  clockOff = null;
  device.removeAttribute('role');
  device.removeAttribute('aria-modal');
  setClosedAccess(false);
  layer.classList.remove('is-open');
  device.classList.remove('is-open');
  screen.classList.add('is-busy');
  audio.sfxPlay('phone_close');
  const done = () => {
    if (phase !== 'closing') return;
    phase = 'closed';
    setClosedAccess(true);
    layer.classList.toggle('is-covered', covered(document.getElementById('ui')!));
    screen.inert = true;
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
  if (id === 'friends') return n.bonds > 0;
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
  return orderPhoneApps(list);
}

function appButton(app: PhoneApp, n: ReturnType<typeof noveltyCounts>) {
  return h('button', {
    type: 'button', class: 'pn-app', 'data-app': app.id, title: app.hint, 'aria-label': `${app.name}. ${app.hint}`,
    onclick: () => {
      if (appBusy || phase !== 'open') return;
      audio.sfxPlay('phone_tap');
      markSeen(app.id);
      if (app.id === 'customize') { app.run(); return; }
      appBusy = true;
      const launch = ++appLaunch;
      if (app.closePhone) closePhone();
      void runTask('phone:' + app.id, app.run).finally(() => { if (launch === appLaunch) appBusy = false; });
    },
  }, h('span', { class: 'pn-icon', 'aria-hidden': 'true' }, phoneAppIcon(app.id) ?? skinIconEl(app.icon), badgeFor(app.id, n) ? h('i', { class: 'pn-badge' }) : null), h('span', { class: 'pn-label' }, app.name));
}

function deco(kind: 'paw' | 'leaf' | 'cherry', place: string) {
  const canvas = phoneDeco(kind);
  canvas.classList.add('pn-deco', place);
  return canvas;
}

function renderHome() {
  screenName = 'home';
  view.className = 'pn-view is-home';
  view.innerHTML = '';
  const apps = allApps();
  const pages = groupPhoneApps(apps);
  homePage = clampPage(homePage, pages.length);
  const n = noveltyCounts();
  const track = h('div', { class: 'pn-track' });
  pages.forEach((page, i) => {
    const grid = h('div', { class: 'pn-page', role: 'group', 'aria-label': `${page.title}, página ${i + 1} de ${pages.length}` });
    grid.append(h('div', { class: 'pn-section' }, page.title));
    for (const app of page.apps) grid.append(appButton(app, n));
    track.append(grid);
  });
  const pager = h('div', { class: 'pn-pager' });
  pager.append(track);
  const dots = h('div', { class: 'pn-dots', role: 'tablist', 'aria-label': 'Páginas de aplicaciones' });
  const apply = (page: number, animate: boolean) => {
    homePage = page;
    track.style.transition = !animate || reduced() ? 'none' : '';
    if (animate && !reduced()) void track.offsetWidth;
    track.style.transform = `translateX(${-page * 100}%)`;
    [...track.children].forEach((el, i) => {
      const node = el as HTMLElement;
      const on = i === page;
      node.inert = !on;
      if (on) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', 'true');
    });
    [...dots.children].forEach((el, i) => {
      el.classList.toggle('on', i === page);
      el.setAttribute('aria-selected', String(i === page));
    });
  };
  const show = (next: number, animate = true) => {
    const page = clampPage(next, pages.length);
    const changed = page !== homePage;
    apply(page, animate);
    if (!changed) return;
    audio.sfxPlay('phone_swap');
    haptic('tap');
    const active = document.activeElement;
    const current = track.children[page];
    if (active instanceof HTMLElement && track.contains(active) && current && !current.contains(active)) {
      current.querySelector<HTMLElement>('.pn-app')?.focus({ preventScroll: true });
    }
  };
  pages.forEach((page, i) => {
    const alert = page.apps.some((app) => badgeFor(app.id, n));
    dots.append(h('button', {
      type: 'button',
      class: 'pn-dot' + (i === homePage ? ' on' : '') + (alert ? ' has-badge' : ''),
      role: 'tab',
      'aria-selected': String(i === homePage),
      'aria-label': `${page.title}, página ${i + 1} de ${pages.length}`,
      onclick: () => { if (i !== homePage) show(i); },
    }));
  });
  const signals = phoneSignals();
  signals.classList.add('pn-signals');
  const main = h('main', { class: 'pn-main pn-home' },
    h('p', { class: 'pn-hello' }, h('span', null, 'Un pueblo, tres mapaches y vos.')),
    pager);
  view.append(
    h('header', { class: 'pn-homehead' },
      signals,
      h('div', { class: 'pn-plaque' }, h('div', { class: 'pn-clock' })),
      h('button', { type: 'button', class: 'pn-close', 'aria-label': 'Cerrar NoriPhone', onclick: () => closePhone() }, '✕')),
    main,
    h('footer', { class: 'pn-foot-home' }, dots),
    h('div', { class: 'pn-decos', 'aria-hidden': 'true' }, deco('leaf', 'a'), deco('cherry', 'b'), deco('paw', 'c'), deco('leaf', 'd'), deco('paw', 'e')),
  );
  renderStatus();
  apply(homePage, false);
  setupHomePager(main, track, show);
  pageApi = { show };
  if (phase === 'open') track.children[homePage]?.querySelector<HTMLElement>('.pn-app')?.focus({ preventScroll: true });
}

/** Horizontal drag, like a phone home screen. A small move does not open the app underneath. */
function setupHomePager(pager: HTMLElement, track: HTMLElement, show: (page: number) => void) {
  let pid = -1;
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let axis: 'x' | 'y' | null = null;
  let blockClick = false;
  const damp = (delta: number) => (homePage === 0 && delta > 0) || (homePage === track.children.length - 1 && delta < 0) ? delta * 0.32 : delta;
  pager.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || screenName !== 'home') return;
    pid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    dx = 0;
    axis = null;
    blockClick = false;
  });
  pager.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    const mx = e.clientX - sx;
    const my = e.clientY - sy;
    if (!axis && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (axis === 'x') { try { pager.setPointerCapture(pid); } catch { /* ignore */ } }
    }
    if (axis !== 'x') return;
    dx = mx;
    e.preventDefault();
    track.style.transition = 'none';
    track.style.transform = `translateX(calc(${-homePage * 100}% + ${damp(dx)}px))`;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    if (axis !== 'x') { axis = null; return; }
    const flip = Math.abs(dx) > Math.max(36, pager.clientWidth * 0.18);
    if (Math.abs(dx) > 12) blockClick = true;
    const dir = dx < 0 ? 1 : -1;
    axis = null;
    dx = 0;
    show(flip ? homePage + dir : homePage);
  };
  pager.addEventListener('pointerup', end);
  pager.addEventListener('pointercancel', end);
  pager.addEventListener('click', (e) => {
    if (!blockClick) return;
    blockClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  let wheel = 0;
  let wheelTimer = 0;
  pager.addEventListener('wheel', (e) => {
    if (screenName !== 'home' || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 4) return;
    e.preventDefault();
    wheel += e.deltaX;
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheel = 0; }, 160);
    if (Math.abs(wheel) < 48) return;
    const dir = wheel > 0 ? 1 : -1;
    wheel = 0;
    show(homePage + dir);
  }, { passive: false });
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
  pageApi = null;
  view.className = 'pn-view';
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
  appHost = h('div', { class: 'pn-app-host', hidden: true });
  screen = h('div', { class: 'noriphone-screen is-busy' }, wall, h('div', { class: 'pn-shade' }), view, appHost);
  const gripTop = h('div', { class: 'noriphone-grip top' });
  const gripBottom = h('div', { class: 'noriphone-grip bottom' });
  const charm = phoneCharm();
  charm.classList.add('pn-charm');
  const homeButton = h('button', { type: 'button', class: 'noriphone-home-button', 'aria-label': 'Cerrar celular', title: 'Cerrar celular', onclick: (e: Event) => { e.stopPropagation(); closePhone(); } }, h('span', { 'aria-hidden': 'true' }));
  device = h('div', { class: 'noriphone-device' }, caseCanvas, screen, charm, gripTop, gripBottom, homeButton);
  screen.inert = true;
  dim = h('div', { class: 'noriphone-dim' });
  dim.addEventListener('pointerdown', () => { if (phase === 'open' && performance.now() - openedAt > 450 && !modalOpen_top()) closePhone(); });
  layer = h('div', { class: 'noriphone-layer' }, dim, device);
  ui.append(layer);
  setupGrip(gripTop);
  setupGrip(gripBottom);
  // closed, the whole phone is the launcher: tap or Enter on the visible top opens it
  device.addEventListener('click', () => { if (phase === 'closed') openPhone(); });
  device.addEventListener('keydown', (e) => {
    if (phase === 'closed' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPhone(); }
  });
  setClosedAccess(true);
  // a menu, dialogue or scene on top hides the closed phone (it comes back by itself)
  const covers = () => layer.classList.toggle('is-covered', phase === 'closed' && covered(ui));
  new MutationObserver(covers).observe(ui, { childList: true });
  covers();
  look = game.loaded ? saved() : look;
  layout();
  void paintWallpaper();
  window.addEventListener('resize', () => { layout(); });
  window.visualViewport?.addEventListener('resize', () => layout());
  let lastScale = normalizeUiScale(settings.uiScale);
  bus.on('settings:changed', () => {
    const scale = normalizeUiScale(settings.uiScale);
    if (scale !== lastScale) { lastScale = scale; layout(); }
  });
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

/** Windows that cover the closed phone: menus, dialogues, minigames, cooking, the title. */
const COVER_SELECTOR = ':scope > .panel-backdrop, :scope > .dlg-wrap, :scope > .cook, :scope > .mg, :scope > .title-screen';
const covered = (ui: HTMLElement) => ui.querySelector(COVER_SELECTOR) != null;

/** The closed phone is a button for keyboard and screen readers too; the open one is a dialog. */
function setClosedAccess(on: boolean) {
  if (on) { device.setAttribute('role', 'button'); device.setAttribute('aria-label', 'Abrir NoriPhone'); device.tabIndex = 0; }
  else { device.removeAttribute('role'); device.removeAttribute('aria-label'); device.tabIndex = -1; }
}

/** True when another window (an app opened from the phone) is on top of it. */
function modalOpen_top(): boolean {
  return !!guard && document.querySelector('#ui > .panel-backdrop, #ui > .cook, #ui > .mg') != null;
}

function tabKeepsFocus(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el === document.body || el === document.documentElement || el.tagName === 'CANVAS') return false;
  return !!el.closest('a, button, input, select, textarea, [role="button"], [tabindex]');
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (phase === 'open' && screenName === 'home' && !modalOpen_top() && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      if (!e.repeat) pageApi?.show(homePage + (e.key === 'ArrowRight' ? 1 : -1));
    }
    return;
  }
  const intent = phoneKeyIntent({
    code: e.code,
    key: e.key,
    repeat: e.repeat,
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
    composing: e.isComposing,
    typing: isTypingTarget(e.target) || isTypingTarget(document.activeElement),
    loaded: game.loaded,
    layerHidden: layer.style.display === 'none',
    dialogue: inDialogue(),
    modalOnTop: modalOpen_top(),
    menuOpen: modalOpen(),
    phase,
    exploring: phoneExplore(),
    focusInControl: tabKeepsFocus(document.activeElement) || tabKeepsFocus(e.target),
    boundPhone: actionForCode(e.code, bindingMap(settings.bindings)) === 'phone',
    phoneKey: settings.phoneKey ?? 'p',
  });
  if (intent === 'ignore') return;
  e.preventDefault();
  if (intent === 'open') openPhone();
  else if (intent === 'close') closePhone();
}

export function phoneState() { return { phase, screen: screenName, look }; }
void WALLPAPER_BY_ID;
void unseenDesigns;
void SIDE_MARGIN;
