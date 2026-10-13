/**
 * Illustrated map of Villa Nori: a pixel-art painting of the town (drawn on a canvas) with tappable
 * wooden name plates, a "you are here" marker and the raccoons' current whereabouts.
 */
import { ctx2d, ellipse, makeCanvas, px, rng, shade, type Ctx } from '../art/pixel';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { currentQuestTarget } from '../quests/quests';
import { portraitURL } from '../systems/appearance';
import { h, panel } from './dom';

const MW = 240;
const MH = 200;
const INK = '#2b1d17';

interface Place { id: string; name: string; x: number; y: number; flag?: string; desc: string; }
const PLACES: Place[] = [
  { id: 'plaza', name: 'Plaza', x: 120, y: 100, desc: 'El corazón de Villa Nori: la fuente, la cartelera y las tiendas.' },
  { id: 'restaurant', name: 'Midnight Maki', x: 84, y: 76, desc: 'Tu restaurante. Arriba están las habitaciones.' },
  { id: 'forest', name: 'Bosque Susurrante', x: 112, y: 30, flag: 'unlock_forest', desc: 'Hongos, flores, insectos y un lago escondido.' },
  { id: 'market', name: 'Mercado Nocturno', x: 200, y: 34, flag: 'market_known', desc: 'Abre viernes y sábados de noche, detrás del torii.' },
  { id: 'station', name: 'Estación', x: 32, y: 104, flag: 'unlock_station', desc: 'Una estación abandonada llena de recuerdos.' },
  { id: 'garden', name: 'Jardín de los Faroles', x: 206, y: 104, flag: 'unlock_garden', desc: 'Canteros, estanque y faroles de piedra.' },
  { id: 'beach', name: 'Playa de las Conchas', x: 132, y: 160, flag: 'unlock_beach', desc: 'Pesca, conchas y botellas con mensajes.' },
  { id: 'lighthouse', name: 'Faro', x: 38, y: 166, flag: 'unlock_lighthouse_view', desc: 'El Faro de las Tres Estrellas.' },
];

// ------------------------------------------------------------------ painting
function tree(c: Ctx, x: number, y: number, r: () => number, pine = false) {
  if (pine) {
    for (let j = 0; j < 7; j++) px(c, x - Math.floor(j / 2), y - 8 + j, j % 3 === 2 ? '#2f7a35' : '#46a846', Math.floor(j / 2) * 2 + 1, 1);
    px(c, x, y - 1, '#64402a', 1, 2);
    return;
  }
  ellipse(c, x, y - 3, 3.4, 3, '#2f7a35');
  ellipse(c, x - 0.5, y - 3.6, 2.6, 2.2, r() < 0.5 ? '#46a846' : '#55b44c');
  px(c, x - 1, y - 5, '#7ccb59', 2, 1);
  px(c, x, y, '#64402a', 1, 1);
}

function house(c: Ctx, x: number, y: number, roof: string) {
  px(c, x - 5, y - 4, INK, 11, 6);
  px(c, x - 4, y - 3, '#f3e3c3', 9, 4);
  px(c, x - 1, y - 1, '#8a5634', 2, 2);
  px(c, x - 6, y - 7, INK, 13, 4);
  px(c, x - 5, y - 7, roof, 11, 3);
  px(c, x - 5, y - 7, shade(roof, 0.2), 11, 1);
}

function path(c: Ctx, pts: [number, number][], w = 4) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      px(c, x - w / 2, y - w / 2, '#d2b47c', w + 1, w + 1);
      px(c, x - w / 2 + 1, y - w / 2 + 1, '#e6cd98', w - 1, w - 1);
    }
  }
}

function paint(): HTMLCanvasElement {
  const cv = makeCanvas(MW, MH);
  const c = ctx2d(cv);
  const r = rng(4242);
  // grass
  px(c, 0, 0, '#5db449', MW, MH);
  for (let i = 0; i < 900; i++) px(c, Math.floor(r() * MW), Math.floor(r() * MH), r() < 0.5 ? '#43963c' : '#7ccb59');
  // sea + beach (wavy shore)
  for (let x = 0; x < MW; x++) {
    const shore = 168 + Math.round(Math.sin(x / 13) * 3 + Math.sin(x / 5) * 1);
    px(c, x, shore - 12, '#f2deaa', 1, 12);
    px(c, x, shore, '#3ea8e4', 1, MH - shore);
    px(c, x, shore, '#c9f0ff', 1, 1);
  }
  for (let i = 0; i < 40; i++) px(c, Math.floor(r() * MW), 176 + Math.floor(r() * 22), '#78cdf4', 3, 1);
  // lighthouse rocks + tower
  ellipse(c, 38, 172, 11, 5, '#6f6a72');
  ellipse(c, 37, 171, 9, 3.5, '#a8a2a8');
  for (let y = 148; y < 170; y++) {
    const hw = 2 + Math.floor((y - 148) / 7);
    px(c, 38 - hw, y, INK, hw * 2 + 1, 1);
    px(c, 38 - hw + 1, y, Math.floor((y - 148) / 5) % 2 ? '#b8524f' : '#f6ecd6', hw * 2 - 1, 1);
  }
  px(c, 36, 145, '#f2c66d', 5, 3);
  px(c, 35, 144, INK, 7, 1);
  // forest (north)
  for (let i = 0; i < 70; i++) {
    const x = 50 + Math.floor(r() * 140);
    const y = 8 + Math.floor(r() * 50);
    if (Math.abs(x - 120) < 7 && y > 30) continue;
    tree(c, x, y, r, r() < 0.3);
  }
  // forest lake
  ellipse(c, 150, 24, 12, 6, '#2b88cc');
  ellipse(c, 150, 23, 11, 5, '#3ea8e4');
  px(c, 144, 21, '#c9f0ff', 4, 1);
  // tree line on the edges
  for (let y = 60; y < 150; y += 6) {
    tree(c, 4 + Math.floor(r() * 6), y, r, r() < 0.5);
    tree(c, MW - 6 - Math.floor(r() * 6), y, r, r() < 0.5);
  }
  // roads
  path(c, [[120, 100], [120, 40]]);
  path(c, [[120, 100], [128, 150]]);
  path(c, [[120, 100], [40, 104]]);
  path(c, [[120, 100], [196, 104]]);
  path(c, [[134, 92], [168, 70], [196, 44]], 3);
  path(c, [[60, 158], [40, 160]], 3);
  path(c, [[128, 150], [60, 158]], 3);
  // plaza square + fountain
  px(c, 104, 86, INK, 33, 29);
  px(c, 105, 87, '#e0d3be', 31, 27);
  for (let i = 0; i < 40; i++) px(c, 105 + Math.floor(r() * 31), 87 + Math.floor(r() * 27), '#cdbfa8');
  ellipse(c, 120, 100, 5, 3.5, '#6f6a72');
  ellipse(c, 120, 100, 4, 2.5, '#3ea8e4');
  px(c, 120, 96, '#a8a2a8', 1, 3);
  // houses around the plaza (restaurant has the navy roof)
  house(c, 84, 82, '#2f4f7a');
  house(c, 152, 82, '#c25a6a');
  house(c, 154, 124, '#2f6b4f');
  house(c, 88, 124, '#b0533f');
  house(c, 108, 132, '#45507f');
  // station: rails + platform
  px(c, 6, 96, '#a8a2a8', 46, 4);
  for (let x = 6; x < 52; x += 3) px(c, x, 112, '#7a4c30', 2, 6);
  px(c, 6, 113, '#6f6a72', 46, 1);
  px(c, 6, 116, '#6f6a72', 46, 1);
  house(c, 28, 100, '#5d5864');
  // market: torii + stalls
  px(c, 190, 22, '#b8524f', 2, 12);
  px(c, 200, 22, '#b8524f', 2, 12);
  px(c, 187, 20, INK, 18, 2);
  px(c, 188, 25, '#b8524f', 16, 1);
  for (const [sx, col] of [[206, '#e04a4a'], [216, '#3fae55'], [210, '#f2c66d']] as const) {
    px(c, sx, 36, INK, 8, 6);
    px(c, sx + 1, 37, col, 6, 2);
    px(c, sx + 1, 39, '#c48d5e', 6, 2);
  }
  // garden: flower beds + pond + lanterns
  for (let i = 0; i < 26; i++) px(c, 190 + Math.floor(r() * 40), 92 + Math.floor(r() * 26), ['#f4a6c0', '#ffd36a', '#b9a0ec', '#ffffff'][i % 4]);
  ellipse(c, 222, 96, 7, 4, '#2b88cc');
  ellipse(c, 222, 95, 6, 3, '#3ea8e4');
  // beach details: pier + umbrella
  px(c, 150, 166, '#7a4c30', 3, 16);
  for (let y = 166; y < 182; y += 3) px(c, 149, y, '#a8714a', 5, 2);
  ellipse(c, 110, 158, 5, 2, '#e04a4a');
  px(c, 110, 158, '#5a3726', 1, 6);
  // compass
  const cx = 222;
  const cy = 150;
  ellipse(c, cx, cy, 7, 7, INK);
  ellipse(c, cx, cy, 6, 6, '#f6ead0');
  px(c, cx, cy - 5, '#e0424f', 1, 5);
  px(c, cx, cy, '#2b1d17', 1, 5);
  px(c, cx - 5, cy, '#2b1d17', 10, 1);
  return cv;
}

let painting: string | null = null;
function paintingURL() {
  if (!painting) painting = paint().toDataURL();
  return painting;
}

// ------------------------------------------------------------------ panel
function hereZone(): string {
  const z = world?.zoneId ?? 'plaza';
  if (z === 'home' || z === 'storage') return 'restaurant';
  if (z.startsWith('shop_') || z === 'library') return 'plaza';
  return z;
}

export function openWorldMap() {
  const wrap = h('div', { class: 'wmap' });
  const img = h('img', { class: 'wmap-art', src: paintingURL(), alt: 'Mapa de Villa Nori', draggable: 'false' });
  wrap.append(img);
  const info = h('div', { class: 'wmap-info card' }, 'Tocá un lugar para ver qué hay.');
  const qTarget = currentQuestTarget();
  let questTargetZone: string | null = null;
  if (qTarget) {
    if (qTarget.kind === 'npc') {
      questTargetZone = world.characterZone(qTarget.npc);
    } else if (qTarget.kind === 'interior') {
      questTargetZone = qTarget.fromZone;
    } else if (qTarget.kind === 'location' || qTarget.kind === 'object') {
      questTargetZone = qTarget.zone;
    }
    if (questTargetZone === 'home' || questTargetZone === 'storage') {
      questTargetZone = 'restaurant';
    }
  }

  const here = hereZone();
  for (const p of PLACES) {
    const open = !p.flag || game.has(p.flag);
    const isTarget = p.id === questTargetZone;
    const plate = h('button', {
      class: 'wmap-plate' + (open ? '' : ' locked') + (p.id === here ? ' here' : '') + (isTarget ? ' target' : ''),
      style: {
        left: (p.x / MW) * 100 + '%',
        top: (p.y / MH) * 100 + '%',
        borderColor: isTarget ? '#d97d27' : undefined,
      },
      onclick: () => {
        info.innerHTML = '';
        info.append(h('b', null, (open ? p.name : '???') + (isTarget ? ' ✦ Misión' : '')), h('div', { class: 'hint' }, open ? p.desc : 'Todavía no descubriste este lugar.'));
      },
    }, (open ? p.name : '???') + (isTarget && p.id !== here ? ' ✦' : ''));
    wrap.append(plate);
    if (p.id === here) {
      wrap.append(h('div', { class: 'wmap-you', style: { left: (p.x / MW) * 100 + '%', top: (p.y / MH) * 100 + '%' } }, h('img', { src: portraitURL('player', 'happy'), alt: '' }), h('span', null, 'Estás acá')));
    }
  }
  // raccoons, gathered per zone
  const byZone = new Map<string, string[]>();
  for (const id of ['spicy', 'rigg', 'pip']) {
    const z = world.characterZone(id);
    if (!z) continue;
    const key = z === 'home' || z === 'storage' ? 'restaurant' : (z.startsWith('shop_') || z === 'library') ? 'plaza' : z;
    byZone.set(key, [...(byZone.get(key) ?? []), id]);
  }
  for (const [z, ids] of byZone) {
    const p = PLACES.find((q) => q.id === z);
    if (!p) continue;
    const row = h('div', { class: 'wmap-friends', style: { left: (p.x / MW) * 100 + '%', top: (p.y / MH) * 100 + '%' } });
    for (const id of ids) row.append(h('img', { src: portraitURL(id), alt: CHARACTERS.find((c) => c.id === id)?.name ?? '' }));
    wrap.append(row);
  }
  const legend = h('div', { class: 'hint', style: { marginTop: '6px' } }, 'Mapaches: ' + ['pip', 'spicy', 'rigg'].map((r) => `${CHARACTERS.find((c) => c.id === r)!.name} — ${ZONES[world.characterZone(r) ?? '']?.name ?? 'paseando'}`).join(' · '));
  const qHint = qTarget?.label ? h('div', { class: 'hint', style: { marginTop: '4px', color: '#b85d19', fontWeight: 'bold' } }, `✦ Objetivo actual: ${qTarget.label}`) : null;
  panel({ title: 'Mapa de Villa Nori', body: h('div', null, wrap, info, legend, qHint) });
}
