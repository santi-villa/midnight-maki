/**
 * What an upgrade looks like, for the renovation list and the purchase celebration: a small pixel thumbnail of the object that
 * appears in the restaurant (or an Antes → Después pair when it replaces something), built from the same art the map uses.
 */
import { h } from '../ui/dom';
import { skinIconEl } from '../ui/skin';
import { iconCanvas } from '../art/icons';
import { drawCookingKnife } from '../art/cooking';
import { furnitureCanvas } from '../art/furniture';
import { FURN_BY_ID } from '../data/furniture';
import { ITEMS_BY_ID } from '../data/items';
import { PROPS } from '../data/props';
import { propCanvas } from '../scenes/textures';
import { CORNERS } from './corners';

type Piece = { furn: string } | { prop: string } | { knife: true } | { icon: string };
interface Preview { after: Piece[]; before?: Piece[] }

const cornerOf = (id: string) => CORNERS.find((c) => c.first === id || c.second === id);

/** Pieces of a thumbnail for an upgrade; `null` pieces fall back to a generic icon. */
export function previewOf(id: string): Preview {
  const corner = cornerOf(id);
  if (corner) return { after: (id === corner.first ? corner.base : corner.extra).map(([f]) => ({ furn: f })) };
  switch (id) {
    case 'tables2': return { after: [{ furn: 'table_round' }, { furn: 'chair_wood' }] };
    case 'knife': case 'knife2': return { after: [{ knife: true }] };
    case 'lights': return { after: [{ furn: 'lantern_red' }, { furn: 'lantern_red' }] };
    case 'display': return { after: [{ furn: 'display_case' }] };
    case 'board2': return { before: [{ prop: 'k_work' }], after: [{ prop: 'k_board' }] };
    case 'rice_big': return { before: [{ prop: 'k_ricepot' }], after: [{ prop: 'k_ricepot2' }] };
    case 'second_room': return { after: [{ furn: 'table_low' }, { furn: 'cushion_rose' }, { furn: 'cushion_indigo' }] };
    case 'garden_patio': return { after: [{ prop: 'pot_rose' }, { prop: 'lantern_red' }] };
    case 'pantry': return { after: [{ icon: 'rice' }, { icon: 'nori' }] };
    default: return { after: [] };
  }
}

function drawPiece(g: CanvasRenderingContext2D, p: Piece, x: number, size: number): number {
  let src: HTMLCanvasElement | null = null;
  try {
    if ('furn' in p) src = FURN_BY_ID[p.furn] ? furnitureCanvas(p.furn) : null;
    else if ('prop' in p) src = PROPS[p.prop] ? propCanvas(p.prop) : null;
    else if ('icon' in p) src = iconCanvas(ITEMS_BY_ID[p.icon]?.icon ?? { type: 'blob', c1: '#d9c7a3' });
    else if ('knife' in p) { src = document.createElement('canvas'); src.width = 10; src.height = 44; drawCookingKnife(src.getContext('2d')!, 1, 2); }
  } catch { src = null; }
  if (!src) return 0;
  const k = Math.min(size / src.height, size / src.width);
  const w = Math.max(1, Math.round(src.width * k)), hh = Math.max(1, Math.round(src.height * k));
  g.imageSmoothingEnabled = false;
  g.drawImage(src, x, size - hh, w, hh);
  return w;
}

function strip(pieces: Piece[], size: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = size * 3; c.height = size;
  const g = c.getContext('2d')!;
  let x = 0;
  for (const p of pieces) { const w = drawPiece(g, p, x, size); if (w) x += w + 2; }
  if (!x) return null;
  const out = document.createElement('canvas');
  out.width = x - 2; out.height = size;
  out.getContext('2d')!.drawImage(c, 0, 0);
  out.className = 'up-prev-img';
  return out;
}

/** The thumbnail element for an upgrade (an icon when there is nothing drawable). */
export function upgradePreview(id: string, fallbackIcon = 'act'): HTMLElement {
  const pv = previewOf(id);
  const after = strip(pv.after, 32);
  const before = pv.before ? strip(pv.before, 32) : null;
  if (!after) return h('div', { class: 'up-prev fallback', 'aria-hidden': 'true' }, skinIconEl(fallbackIcon, 'skin-icon'));
  return h('div', { class: 'up-prev' + (before ? ' pair' : ''), role: 'img', 'aria-label': before ? 'Antes y después' : 'Cómo se ve' },
    before ? h('figure', null, before, h('figcaption', null, 'Antes')) : null,
    before ? h('span', { class: 'up-arrow', 'aria-hidden': 'true' }, '→') : null,
    before ? h('figure', null, after, h('figcaption', null, 'Después')) : after);
}
