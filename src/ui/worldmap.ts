/**
 * Illustrated map of Villa Nori: a pixel-art painting of the town (drawn on a canvas) with tappable
 * place icons, a "you are here" marker and the raccoons' current whereabouts.
 */
import { ctx2d, drawTemplate, makeCanvas } from '../art/pixel';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { currentQuestTarget } from '../quests/quests';
import { portraitURL } from '../systems/appearance';
import { h, panel } from './dom';
import { PLACE_ICON_PALETTE, placeIconGrid } from './mapIcons';

/** The illustration is the village as it is laid out: coordinates below are pixels of public/mapa/villa-nori.webp. */
const MW = 1024;
const MH = 572;
const MAP_URL = import.meta.env.BASE_URL + 'mapa/villa-nori.webp';

interface Place { id: string; name: string; x: number; y: number; flag?: string; desc: string; zone?: string; }
const PLACES: Place[] = [
  { id: 'plaza', name: 'Plaza', x: 520, y: 150, desc: 'El corazón de Villa Nori: la fuente, la cartelera y las tiendas.' },
  { id: 'restaurant', name: 'Midnight Maki', x: 412, y: 100, desc: 'Tu restaurante. Arriba están las habitaciones.', zone: 'plaza' },
  { id: 'forest', name: 'Bosque Susurrante', x: 190, y: 120, flag: 'unlock_forest', desc: 'Hongos, flores, insectos, un arroyo y un santuario escondido.' },
  { id: 'market', name: 'Mercado Nocturno', x: 945, y: 62, flag: 'market_known', desc: 'Abre viernes y sábados de noche, detrás del torii.' },
  { id: 'station', name: 'Estación', x: 105, y: 268, flag: 'unlock_station', desc: 'Una estación abandonada llena de recuerdos.' },
  { id: 'garden', name: 'Jardín de los Faroles', x: 940, y: 305, flag: 'unlock_garden', desc: 'Canteros, estanque de carpas, casa de té y un huerto de cerezos.' },
  { id: 'beach', name: 'Playa de las Conchas', x: 790, y: 470, flag: 'unlock_beach', desc: 'Pesca, conchas, cabañas de pescadores y botellas con mensajes.' },
  { id: 'lighthouse', name: 'Faro', x: 95, y: 470, flag: 'unlock_lighthouse_view', desc: 'El Faro de las Tres Estrellas.' },
  { id: 'riverside', name: 'Ribera de los Cerezos', x: 880, y: 235, desc: 'Al otro lado del río: cerezos, bancos, la florería y la casa de té.', zone: 'plaza' },
  { id: 'shrine', name: 'Colina del Santuario', x: 830, y: 85, desc: 'Una escalera de piedra sube al torii y al santuario.', zone: 'plaza' },
  { id: 'harbor', name: 'Callejón del Puerto', x: 530, y: 480, desc: 'Calles de casas con la puerta al costado, faroles y la bahía con muelles.', zone: 'plaza' },
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

function placeIcon(id: string): HTMLCanvasElement {
  const rows = placeIconGrid(id);
  const cv = makeCanvas(16, 16);
  drawTemplate(ctx2d(cv), rows, PLACE_ICON_PALETTE);
  cv.setAttribute('aria-hidden', 'true');
  return cv;
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
  const img = h('img', { class: 'wmap-art', src: MAP_URL, alt: 'Mapa de Villa Nori', draggable: 'false' });
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
    const label = open ? (isTarget ? `${p.name}, misión` : p.name) : 'Lugar sin descubrir';
    const plate = h('button', {
      type: 'button',
      class: 'wmap-plate' + (open ? '' : ' locked') + (p.id === here ? ' here' : '') + (isTarget ? ' target' : ''),
      'aria-label': label,
      title: label,
      style: {
        left: (p.x / MW) * 100 + '%',
        top: (p.y / MH) * 100 + '%',
      },
      onclick: () => {
        info.innerHTML = '';
        info.append(h('b', null, (open ? p.name : '???') + (isTarget ? ' ✦ Misión' : '')), h('div', { class: 'hint' }, open ? p.desc : 'Todavía no descubriste este lugar.'));
      },
    }, placeIcon(open ? p.id : 'unknown'), isTarget ? h('span', { class: 'wmap-mark', 'aria-hidden': 'true' }, '✦') : null);
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
