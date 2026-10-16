/**
 * The map (key M): drawn from the real zones. Every outdoor zone is placed where its doors connect it to its neighbours,
 * with its real ground, paths, water and buildings; locked zones stay hidden behind a veil until they open. Tap a zone to
 * zoom into it (buildings and doors named), and see where you, the raccoons and the current objective are.
 */
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { PROPS } from '../data/props';
import { ZONES, type DoorDef, type ZoneDef } from '../data/zones';
import { layout, outdoorSpot } from '../world/mapLayout';
import { world } from '../scenes/WorldScene';
import { currentQuestTarget } from '../quests/quests';
import { portraitURL } from '../systems/appearance';
import { h, panel } from './dom';

const COLOR: Record<string, string> = {
  g: '#78b255', G: '#5f9c45', p: '#d8b985', c: '#c8b8a2', s: '#ecd8a3', h: '#cdbb92', w: '#62aedb', d: '#3f86c4',
  b: '#9b6b44', C: '#8c8c96', o: '#8b5e3c', t: '#b79b6c', k: '#b79b6c', f: '#b79b6c',
};
const FALLBACK = '#9aab6c';
const DESC: Record<string, string> = {
  plaza: 'El corazón de Villa Nori: la fuente, la cartelera, las tiendas, el restaurante y las casas del barrio.',
  forest: 'Hongos, flores, insectos, un arroyo y un santuario escondido.',
  market: 'Abre viernes y sábados de noche, detrás del torii.',
  station: 'Una estación abandonada llena de recuerdos.',
  garden: 'Canteros, estanque de carpas, casa de té y un huerto de cerezos.',
  beach: 'Pesca, conchas, cabañas de pescadores y botellas con mensajes.',
};
/** the flag that opens a zone, read from the door that leads in from the plaza */
function lockOf(id: string): string | null {
  if (id === 'market') return 'market_known';
  const d = ZONES.plaza.doors.find((x) => x.to === id && x.lock);
  return d?.lock?.flag ?? null;
}
const isOpen = (id: string) => { const f = lockOf(id); return !f || game.has(f) || (id === 'market' && game.has('market_open')); };

function drawZone(g: CanvasRenderingContext2D, z: ZoneDef, ox: number, oy: number, S: number, open: boolean) {
  if (!open) {
    g.fillStyle = '#4b4a5c';
    g.fillRect(ox * S, oy * S, z.w * S, z.h * S);
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = -z.h; i < z.w; i += 3) for (let y = 0; y < z.h; y++) { const x = i + y; if (x >= 0 && x < z.w) g.fillRect((ox + x) * S, (oy + y) * S, S, S); }
    return;
  }
  for (let y = 0; y < z.h; y++) {
    const row = z.ground[y] ?? '';
    for (let x = 0; x < z.w; x++) {
      g.fillStyle = COLOR[row[x]] ?? FALLBACK;
      g.fillRect((ox + x) * S, (oy + y) * S, S, S);
    }
  }
  // buildings and stalls from the real props
  for (const p of z.props) {
    const d = PROPS[p.id];
    if (!d || (d.kind !== 'building' && d.kind !== 'stall')) continue;
    g.fillStyle = '#2b1d17';
    g.fillRect((ox + p.x) * S - 1, (oy + p.y) * S - 1, d.w * S + 2, d.h * S + 2);
    g.fillStyle = d.kind === 'stall' ? '#e2a96b' : d.c1 || '#b9764b';
    g.fillRect((ox + p.x) * S, (oy + p.y) * S, d.w * S, d.h * S);
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.fillRect((ox + p.x) * S, (oy + p.y) * S, d.w * S, Math.max(1, Math.floor(S / 2)));
  }
  for (const d of z.doors) {
    g.fillStyle = '#f2c66d';
    const big = d.to.startsWith('shop_') || d.to === 'restaurant' || d.to === 'library';
    g.fillRect((ox + d.x) * S, (oy + d.y) * S, S * (big ? 1.6 : 1), S * (big ? 1.6 : 1));
  }
}

const doorName = (d: DoorDef) => ZONES[d.to]?.name ?? d.to;
const isLandmark = (d: DoorDef) => d.to.startsWith('shop_') || d.to === 'restaurant' || d.to === 'library';

export function openWorldMap() {
  const placed = layout();
  const minX = Math.min(...placed.map((p) => p.x)) - 2, minY = Math.min(...placed.map((p) => p.y)) - 2;
  const maxX = Math.max(...placed.map((p) => p.x + p.z.w)) + 2, maxY = Math.max(...placed.map((p) => p.y + p.z.h)) + 2;
  const body = h('div', { class: 'wm' });
  let zoomed: string | null = null;
  const info = h('div', { class: 'wm-info card' });
  const qTarget = currentQuestTarget();
  const qSpot = (() => {
    if (!qTarget) return null;
    if (qTarget.kind === 'npc') { const z = world.characterZone(qTarget.npc); return z ? outdoorSpot(z, 0, 0) : null; }
    if (qTarget.kind === 'interior') return outdoorSpot(qTarget.fromZone, qTarget.door.x, qTarget.door.y);
    return outdoorSpot(qTarget.zone, qTarget.x ?? 0, qTarget.y ?? 0);
  })();
  const here = world?.player ? outdoorSpot(world.zoneId, world.player.tx, world.player.ty) : null;

  const show = (id: string | null) => { zoomed = id; render(); };

  function setInfo(title: string, text: string, links: HTMLElement[] = []) {
    info.replaceChildren(h('b', null, title), h('div', { class: 'hint' }, text), ...(links.length ? [h('div', { class: 'wm-links' }, ...links)] : []));
  }
  function connections(id: string): HTMLElement[] {
    const out: HTMLElement[] = [];
    const seen = new Set<string>();
    let locked = 0;
    for (const z of Object.values(ZONES)) for (const d of z.doors) {
      const [a, b] = z.id === id ? [z.id, d.to] : d.to === id ? [d.to, z.id] : [null, null];
      if (!a || !b || !ZONES[b]?.outdoor || seen.has(b)) continue;
      seen.add(b);
      const open = isOpen(b);
      if (open) out.push(h('button', { type: 'button', class: 'btn small', onclick: () => show(b) }, `→ ${ZONES[b].name}`));
      else locked++;
    }
    if (locked) out.push(h('span', { class: 'hint' }, locked === 1 ? '+ 1 camino cerrado' : `+ ${locked} caminos cerrados`));
    return out;
  }

  /** Zoom buttons, ctrl+wheel and pinch resize the map itself, so labels keep their size and the scroll area pans it. */
  function zoomView(stage: HTMLElement): HTMLElement {
    let k = 1;
    const view = h('div', { class: 'wm-scroll wm-zoomable' }, stage);
    const apply = (next: number, cx = 0.5, cy = 0.5) => {
      const nk = Math.max(1, Math.min(4, next));
      if (nk === k) return;
      const before = { w: stage.offsetWidth, h: stage.offsetHeight };
      const px = (view.scrollLeft + view.clientWidth * cx) / Math.max(1, before.w), py = (view.scrollTop + view.clientHeight * cy) / Math.max(1, before.h);
      k = nk; stage.style.setProperty('--k', String(k));
      view.scrollLeft = px * stage.offsetWidth - view.clientWidth * cx;
      view.scrollTop = py * stage.offsetHeight - view.clientHeight * cy;
      view.classList.toggle('zoomed', k > 1);
      label.textContent = `${Math.round(k * 100)}%`;
    };
    const label = h('span', { class: 'wm-zoom-pct' }, '100%');
    const btn = (t: string, aria: string, fn: () => void) => h('button', { type: 'button', class: 'btn small', 'aria-label': aria, onclick: fn }, t);
    const bar = h('div', { class: 'wm-zoombar' }, btn('−', 'Alejar', () => apply(k / 1.4)), label, btn('+', 'Acercar', () => apply(k * 1.4)), btn('⟲', 'Vista completa', () => { apply(1); view.scrollTo(0, 0); }));
    view.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = view.getBoundingClientRect(); apply(k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
    // pinch on touch screens; one finger keeps scrolling natively
    const pts = new Map<number, { x: number; y: number }>();
    let d0 = 0, k0 = 1;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    view.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { d0 = dist(); k0 = k; } });
    view.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && d0 > 0) { const r = view.getBoundingClientRect(); const [a, b] = [...pts.values()]; apply(k0 * (dist() / d0), ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height); }
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); d0 = 0; };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    return h('div', { class: 'wm-zoomwrap' }, bar, view);
  }

  function overview() {
    const S = 3, W = (maxX - minX) * S, H = (maxY - minY) * S;
    const cv = h('canvas', { class: 'wm-canvas', width: W, height: H, role: 'img', 'aria-label': 'Mapa de Villa Nori' }) as HTMLCanvasElement;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#2d3b4a'; g.fillRect(0, 0, W, H);
    for (const p of placed) drawZone(g, p.z, p.x - minX, p.y - minY, S, isOpen(p.z.id));
    const wrap = h('div', { class: 'wm-stage', style: { aspectRatio: `${W} / ${H}` } }, cv);
    const pct = (x: number, y: number) => ({ left: ((x - minX) / (maxX - minX)) * 100 + '%', top: ((y - minY) / (maxY - minY)) * 100 + '%' });
    for (const p of placed) {
      const open = isOpen(p.z.id);
      const target = qSpot?.zone === p.z.id;
      const youHere = here?.zone === p.z.id;
      wrap.append(h('button', {
        type: 'button', class: 'wm-zone' + (open ? '' : ' locked') + (youHere ? ' here' : '') + (target ? ' target' : ''),
        style: pct(p.x + p.z.w / 2, p.y + Math.min(p.z.h * 0.2, 5)),
        'aria-label': open ? p.z.name + (youHere ? ', estás acá' : '') + (target ? ', objetivo' : '') : 'Zona sin descubrir',
        onclick: () => {
          if (!open) { setInfo('???', 'Todavía no descubriste este lugar.'); return; }
          setInfo(p.z.name, DESC[p.z.id] ?? '', connections(p.z.id));
          info.append(h('button', { type: 'button', class: 'btn small primary', onclick: () => show(p.z.id) }, 'Ver de cerca'));
        },
      }, open ? p.z.name : '???', target ? h('span', { class: 'wm-star', 'aria-hidden': 'true' }, ' ✦') : null));
    }
    markers(wrap, (x, y, zone) => { const p = placed.find((q) => q.z.id === zone); return p ? pct(p.x + x, p.y + y) : null; });
    return zoomView(wrap);
  }

  function detail(id: string) {
    const p = placed.find((q) => q.z.id === id)!;
    const S = 8, z = p.z;
    const cv = h('canvas', { class: 'wm-canvas', width: z.w * S, height: z.h * S, role: 'img', 'aria-label': 'Mapa de ' + z.name }) as HTMLCanvasElement;
    const g = cv.getContext('2d')!;
    drawZone(g, z, 0, 0, S, true);
    const wrap = h('div', { class: 'wm-stage wm-detail', style: { aspectRatio: `${z.w} / ${z.h}`, '--base': `min(100%, calc(60vh * ${z.w / z.h}))` } }, cv);
    const pct = (x: number, y: number) => ({ left: ((x + 0.5) / z.w) * 100 + '%', top: ((y + 0.5) / z.h) * 100 + '%' });
    const seen = new Set<string>();
    for (const d of z.doors) {
      const key = d.to + (isLandmark(d) ? '' : `:${d.x}:${d.y}`);
      if (seen.has(key)) continue;
      seen.add(key);
      const outdoor = ZONES[d.to]?.outdoor;
      if (outdoor && !isOpen(d.to)) { wrap.append(h('div', { class: 'wm-door locked', style: pct(d.x, d.y), title: 'Camino cerrado' }, '🔒')); continue; }
      if (!isLandmark(d) && !outdoor) { wrap.append(h('button', { type: 'button', class: 'wm-dot', style: pct(d.x, d.y), 'aria-label': doorName(d), title: doorName(d), onclick: () => setInfo(doorName(d), 'Una puerta del barrio.') })); continue; }
      wrap.append(h('button', {
        type: 'button', class: 'wm-door' + (outdoor ? ' road' : ''), style: pct(d.x, d.y),
        onclick: () => (outdoor ? show(d.to) : setInfo(doorName(d), d.to === 'restaurant' ? 'Tu restaurante. Arriba están las habitaciones.' : 'Un local del pueblo. Mirá sus horarios en el cartel de la puerta.')),
      }, outdoor ? `→ ${doorName(d)}` : doorName(d)));
    }
    markers(wrap, (x, y, zone) => (zone === id ? pct(x, y) : null));
    // zoomed zones are wide: on a phone they pan sideways instead of squeezing the labels
    return zoomView(wrap);
  }

  /** you, the raccoons and the objective, placed with the given projection */
  function markers(wrap: HTMLElement, project: (x: number, y: number, zone: string) => Record<string, string> | null) {
    if (qSpot) {
      const at = project(qSpot.x, qSpot.y, qSpot.zone);
      if (at) wrap.append(h('div', { class: 'wm-goal', style: at, 'aria-label': 'Objetivo' }, '✦'));
    }
    for (const id of ['spicy', 'rigg', 'pip']) {
      const z = world.characterZone(id);
      const spot = z ? outdoorSpot(z, 0, 0) : null;
      const at = spot ? project(spot.x, spot.y, spot.zone) : null;
      if (at) wrap.append(h('img', { class: 'wm-friend', src: portraitURL(id), alt: CHARACTERS.find((c) => c.id === id)?.name ?? '', style: at }));
    }
    if (here) {
      const at = project(here.x, here.y, here.zone);
      if (at) wrap.append(h('div', { class: 'wm-you', style: at }, h('img', { src: portraitURL('player', 'happy'), alt: '' }), h('span', null, 'Estás acá')));
    }
  }

  function render() {
    body.replaceChildren();
    requestAnimationFrame(() => body.closest('.panel-body')?.scrollTo(0, 0));
    if (zoomed && ZONES[zoomed]) {
      const z = ZONES[zoomed];
      body.append(h('div', { class: 'wm-bar' }, h('button', { type: 'button', class: 'btn small', onclick: () => show(null) }, '← Todo el pueblo'), h('b', null, z.name)), detail(zoomed));
      setInfo(z.name, DESC[z.id] ?? '', connections(z.id));
    } else {
      body.append(overview());
      setInfo('Villa Nori', 'Tocá una zona para ver qué hay y cómo se llega. Las zonas con candado todavía están cerradas.');
    }
    body.append(info);
    const legend = h('div', { class: 'wm-legend' },
      h('span', null, h('i', { class: 'sw you' }), 'Vos'), h('span', null, h('i', { class: 'sw door' }), 'Puertas'), h('span', null, h('i', { class: 'sw path' }), 'Caminos'),
      h('span', null, h('i', { class: 'sw water' }), 'Agua'), h('span', null, h('i', { class: 'sw lock' }), 'Sin descubrir'), qTarget ? h('span', null, '✦ Objetivo') : null);
    body.append(legend);
    if (qTarget?.label) body.append(h('div', { class: 'hint wm-goal-text' }, `✦ Objetivo actual: ${qTarget.label}`));
    const friends = ['pip', 'spicy', 'rigg'].map((r) => `${CHARACTERS.find((c) => c.id === r)!.name} — ${ZONES[world.characterZone(r) ?? '']?.name ?? 'paseando'}`).join(' · ');
    body.append(h('div', { class: 'hint' }, 'Mapaches: ' + friends));
  }
  render();
  panel({ title: 'Mapa de Villa Nori', body, wide: true });
}
