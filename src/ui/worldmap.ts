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

interface Place { id: string; name: string; x: number; y: number; flag?: string; desc: string; zone?: string; }
const PLACES: Place[] = [
  { id: 'plaza', name: 'Plaza', x: 90, y: 82, desc: 'El corazón de Villa Nori: la fuente, la cartelera y las tiendas.' },
  { id: 'restaurant', name: 'Midnight Maki', x: 58, y: 62, desc: 'Tu restaurante. Arriba están las habitaciones.', zone: 'plaza' },
  { id: 'forest', name: 'Bosque Susurrante', x: 100, y: 24, flag: 'unlock_forest', desc: 'Hongos, flores, insectos, un arroyo y un santuario escondido.' },
  { id: 'market', name: 'Mercado Nocturno', x: 200, y: 26, flag: 'market_known', desc: 'Abre viernes y sábados de noche, detrás del torii.' },
  { id: 'station', name: 'Estación', x: 24, y: 88, flag: 'unlock_station', desc: 'Una estación abandonada llena de recuerdos.' },
  { id: 'garden', name: 'Jardín de los Faroles', x: 204, y: 102, flag: 'unlock_garden', desc: 'Canteros, estanque de carpas, casa de té y un huerto de cerezos.' },
  { id: 'beach', name: 'Playa de las Conchas', x: 96, y: 160, flag: 'unlock_beach', desc: 'Pesca, conchas, cabañas de pescadores y botellas con mensajes.' },
  { id: 'lighthouse', name: 'Faro', x: 34, y: 172, flag: 'unlock_lighthouse_view', desc: 'El Faro de las Tres Estrellas.' },
  { id: 'riverside', name: 'Ribera de los Cerezos', x: 148, y: 96, desc: 'Al otro lado del río: cerezos, bancos, la florería y la casa de té.', zone: 'plaza' },
  { id: 'shrine', name: 'Colina del Santuario', x: 150, y: 54, desc: 'Una escalera de piedra sube al torii y al santuario.', zone: 'plaza' },
  { id: 'harbor', name: 'Callejón del Puerto', x: 78, y: 126, desc: 'Calles de casas con la puerta al costado, faroles y la bahía con muelles.', zone: 'plaza' },
];

/** Inside the plaza, which neighbourhood the player is standing in (tile coordinates of data/plazaMap.ts). */
function plazaPlace(): string {
  const p = world?.player;
  if (!p) return 'plaza';
  if (p.tx >= 43 && p.ty < 11) return 'shrine';
  if (p.tx >= 43 && p.ty < 29) return 'riverside';
  if (p.ty >= 26) return 'harbor';
  return 'plaza';
}

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

function river(c: Ctx, pts: [number, number][], w: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      px(c, x - w / 2 - 1, y - 1, '#2b88cc', w + 2, 3);
      px(c, x - w / 2, y, '#3ea8e4', w, 2);
    }
  }
}

function bridge(c: Ctx, x: number, y: number, w = 9) {
  px(c, x - w / 2, y - 2, INK, w, 5);
  px(c, x - w / 2 + 1, y - 1, '#c48d5e', w - 2, 3);
  for (let i = 0; i < w - 2; i += 2) px(c, x - w / 2 + 1 + i, y - 1, '#8a5a3c', 1, 3);
}

function sakura(c: Ctx, x: number, y: number) {
  ellipse(c, x, y - 3, 3.6, 3, '#d98aa4');
  ellipse(c, x - 0.5, y - 3.6, 2.8, 2.3, '#f4a6c0');
  px(c, x - 1, y - 5, '#fbd3e1', 2, 1);
  px(c, x, y, '#64402a', 1, 1);
}

function paint(): HTMLCanvasElement {
  const cv = makeCanvas(MW, MH);
  const c = ctx2d(cv);
  const r = rng(4242);
  // grass
  px(c, 0, 0, '#5db449', MW, MH);
  for (let i = 0; i < 1100; i++) px(c, Math.floor(r() * MW), Math.floor(r() * MH), r() < 0.5 ? '#43963c' : '#7ccb59');
  // sea + beach (wavy shore)
  for (let x = 0; x < MW; x++) {
    const shore = 176 + Math.round(Math.sin(x / 13) * 3 + Math.sin(x / 5) * 1);
    px(c, x, shore - 20, '#f2deaa', 1, 20);
    px(c, x, shore, '#3ea8e4', 1, MH - shore);
    px(c, x, shore, '#c9f0ff', 1, 1);
  }
  for (let i = 0; i < 40; i++) px(c, Math.floor(r() * MW), 182 + Math.floor(r() * 16), '#78cdf4', 3, 1);
  // lighthouse rocks + tower
  ellipse(c, 30, 180, 11, 5, '#6f6a72');
  ellipse(c, 29, 179, 9, 3.5, '#a8a2a8');
  for (let y = 156; y < 178; y++) {
    const hw = 2 + Math.floor((y - 156) / 7);
    px(c, 30 - hw, y, INK, hw * 2 + 1, 1);
    px(c, 30 - hw + 1, y, Math.floor((y - 156) / 5) % 2 ? '#b8524f' : '#f6ecd6', hw * 2 - 1, 1);
  }
  px(c, 28, 153, '#f2c66d', 5, 3);
  px(c, 27, 152, INK, 7, 1);
  // forest (north) with its lake, stream and shrine
  for (let i = 0; i < 80; i++) {
    const x = 46 + Math.floor(r() * 150);
    const y = 6 + Math.floor(r() * 38);
    if (Math.abs(x - 107) < 7 && y > 26) continue;
    tree(c, x, y, r, r() < 0.3);
  }
  ellipse(c, 70, 22, 12, 6, '#2b88cc');
  ellipse(c, 70, 21, 11, 5, '#3ea8e4');
  px(c, 64, 19, '#c9f0ff', 4, 1);
  river(c, [[134, 8], [134, 30], [137, 44]], 3);
  // trees on the western and eastern edges
  for (let y = 50; y < 160; y += 6) {
    if (y > 78 && y < 96) continue;
    tree(c, 3 + Math.floor(r() * 6), y, r, r() < 0.5);
  }
  // the river that crosses the village, down to the bay
  river(c, [[137, 44], [136, 60], [139, 74], [137, 92], [133, 106], [135, 120], [138, 134]], 5);
  ellipse(c, 134, 134, 12, 6, '#2b88cc');
  ellipse(c, 134, 133, 11, 5, '#3ea8e4');
  px(c, 126, 131, '#c9f0ff', 4, 1);
  // roads
  path(c, [[88, 84], [107, 48]], 3);
  path(c, [[88, 84], [88, 138], [96, 160]], 3);
  path(c, [[88, 84], [46, 86]], 3);
  path(c, [[88, 84], [136, 74], [172, 84]], 3);
  path(c, [[107, 48], [160, 44], [196, 32]], 3);
  path(c, [[56, 111], [128, 111]], 3);
  path(c, [[56, 132], [120, 132]], 3);
  path(c, [[136, 111], [170, 111]], 3);
  // plaza square + fountain
  px(c, 66, 63, INK, 29, 28);
  px(c, 67, 64, '#e0d3be', 27, 26);
  for (let i = 0; i < 36; i++) px(c, 67 + Math.floor(r() * 25), 64 + Math.floor(r() * 24), '#cdbfa8');
  ellipse(c, 80, 76, 5, 3.5, '#6f6a72');
  ellipse(c, 80, 76, 4, 2.5, '#3ea8e4');
  px(c, 80, 72, '#a8a2a8', 1, 3);
  bridge(c, 137, 74);
  bridge(c, 136, 113, 11);
  // houses around the plaza (restaurant has the navy roof)
  house(c, 56, 62, '#2f4f7a');
  house(c, 116, 62, '#c25a6a');
  house(c, 112, 84, '#2f6b4f');
  house(c, 54, 90, '#b0533f');
  house(c, 74, 100, '#45507f');
  // the harbour quarter: rows of small houses on both lanes
  for (const [hx, col] of [[58, '#5d6b7a'], [100, '#2f4f7a'], [110, '#b0533f'], [76, '#9a3f4a'], [64, '#2f6b4f']] as const) house(c, hx, 107, col);
  for (const [hx, col] of [[58, '#9a3f4a'], [72, '#5d6b7a'], [100, '#45507f'], [108, '#7a5fb0']] as const) house(c, hx, 129, col);
  // cherry bank, shrine hill and the east road
  for (let i = 0; i < 20; i++) sakura(c, 142 + Math.floor(r() * 24), 76 + Math.floor(r() * 32));
  for (let i = 0; i < 8; i++) sakura(c, 140 + Math.floor(r() * 24), 48 + Math.floor(r() * 18));
  px(c, 150, 48, '#b8524f', 2, 9);
  px(c, 158, 48, '#b8524f', 2, 9);
  px(c, 148, 46, INK, 14, 2);
  px(c, 149, 50, '#b8524f', 12, 1);
  px(c, 153, 44, '#a8a2a8', 4, 3);
  for (let y = 56; y < 70; y += 2) px(c, 153, y, '#e0d3be', 4, 1);
  house(c, 152, 90, '#2f6b4f');
  house(c, 162, 100, '#7a5fb0');
  // station: rails + platform
  px(c, 4, 82, '#a8a2a8', 40, 4);
  for (let x = 4; x < 44; x += 3) px(c, x, 96, '#7a4c30', 2, 6);
  px(c, 4, 97, '#6f6a72', 40, 1);
  px(c, 4, 100, '#6f6a72', 40, 1);
  house(c, 26, 88, '#5d5864');
  // market: torii + stalls
  px(c, 190, 14, '#b8524f', 2, 12);
  px(c, 200, 14, '#b8524f', 2, 12);
  px(c, 187, 12, INK, 18, 2);
  px(c, 188, 17, '#b8524f', 16, 1);
  for (const [sx, col] of [[206, '#e04a4a'], [216, '#3fae55'], [210, '#f2c66d'], [224, '#3b4470']] as const) {
    px(c, sx, 30, INK, 8, 6);
    px(c, sx + 1, 31, col, 6, 2);
    px(c, sx + 1, 33, '#c48d5e', 6, 2);
  }
  // garden: flower beds + koi pond + lanterns
  for (let i = 0; i < 34; i++) px(c, 176 + Math.floor(r() * 58), 86 + Math.floor(r() * 30), ['#f4a6c0', '#ffd36a', '#b9a0ec', '#ffffff'][i % 4]);
  ellipse(c, 214, 108, 9, 5, '#2b88cc');
  ellipse(c, 214, 107, 8, 4, '#3ea8e4');
  px(c, 213, 102, '#c48d5e', 3, 11);
  house(c, 196, 94, '#9a3f4a');
  // beach details: pier + shacks + boats
  px(c, 100, 166, '#7a4c30', 3, 18);
  for (let y = 166; y < 184; y += 3) px(c, 99, y, '#a8714a', 5, 2);
  px(c, 154, 166, '#7a4c30', 3, 18);
  for (let y = 166; y < 184; y += 3) px(c, 153, y, '#a8714a', 5, 2);
  for (const hx of [150, 168, 186]) house(c, hx, 160, '#2f4f7a');
  ellipse(c, 78, 164, 5, 2, '#e04a4a');
  px(c, 78, 164, '#5a3726', 1, 6);
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
  if (z === 'plaza') return plazaPlace();
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
