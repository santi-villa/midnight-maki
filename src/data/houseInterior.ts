/**
 * Lived-in furniture for each village house.
 * A left-hand entrance opens on the left wall; a right-hand entrance opens on the right.
 * Tile (5, 5) stays empty: neighbours stand there. The two tiles inside the door stay empty too.
 */
import type { Dir } from '../core/types';
import { FURN_BY_ID } from './furniture';
import type { HouseDef } from './houses';

export type HouseSpot = [string, number, number, number?];

/** Same order as the first twelve HOUSES. The last four houses have no named resident. */
const RESIDENTS = ['ren', 'mika', 'haru', 'tomo', 'nene', 'goro', 'fuyu', 'sato', 'mame', 'kai', 'rin', 'oto'];

const LAYOUTS: Record<string, HouseSpot[]> = {
  // carpenter: chest, stool, wood
  ren: [
    ['shelf_books', 1, 2], ['wardrobe_wood', 4, 2], ['lamp_table', 6, 2], ['bed_sage', 7, 2], ['plant_fern', 8, 2],
    ['chest_wood', 3, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_cream', 2, 5], ['stool', 8, 6],
  ],
  // courier: lamp, plush, striped rug
  mika: [
    ['bed_sage', 1, 2], ['plush_cat', 2, 3], ['wardrobe_wood', 3, 2], ['lamp_rose', 5, 2], ['shelf_books', 6, 2],
    ['plant_fern', 8, 2], ['table_round', 4, 4], ['chair_rose', 4, 5, 2], ['rug_stripes', 1, 5],
  ],
  // student: desk, shelves, book piles
  haru: [
    ['bed_sage', 1, 2], ['bookstack', 2, 3], ['desk_wood', 3, 2], ['lamp_table', 5, 2], ['shelf_books', 6, 2],
    ['bookstack', 8, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_indigo', 2, 5],
  ],
  // fisherman: aquarium
  tomo: [
    ['shelf_kitchen', 1, 2], ['wardrobe_wood', 4, 2], ['lamp_table', 6, 2], ['bed_sage', 7, 2], ['plant_fern', 8, 2],
    ['aquarium', 5, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_cream', 2, 5],
  ],
  // florist: vases and a bonsai
  nene: [
    ['bed_rose', 1, 2], ['vase_tulips', 2, 2], ['wardrobe_white', 3, 2], ['lamp_cream', 5, 2], ['shelf_books', 6, 2],
    ['plant_monstera', 2, 3], ['bonsai', 8, 3], ['table_round', 4, 4], ['chair_rose', 4, 5, 2], ['rug_round', 6, 5], ['vase_lav', 8, 6],
  ],
  // elder: futon, low table, cushions, andon
  goro: [
    ['shelf_books', 1, 2], ['wardrobe_wood', 4, 2], ['andon', 6, 2], ['futon_indigo', 7, 2], ['bonsai', 8, 2],
    ['chest_wood', 3, 3], ['table_low', 5, 4], ['cushion_indigo', 4, 5], ['cushion_rose', 6, 5], ['rug_indigo', 2, 5],
  ],
  // night tea: futon, low table, tea set
  fuyu: [
    ['futon_indigo', 1, 2], ['lantern_cream', 2, 2], ['wardrobe_wood', 3, 2], ['andon', 5, 2], ['shelf_dark', 6, 2],
    ['tea_set', 2, 3], ['table_low', 3, 4], ['cushion_rose', 3, 5], ['cushion_indigo', 4, 5], ['rug_night', 6, 5],
  ],
  // postman: desk and a wall clock
  sato: [
    ['shelf_books', 1, 2], ['desk_wood', 4, 2], ['lamp_table', 6, 2], ['bed_sage', 7, 2], ['plant_fern', 8, 2],
    ['clock', 8, 1], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_cream', 2, 5], ['chest_wood', 8, 6],
  ],
  // bakery helper: kitchen shelf and tea
  mame: [
    ['bed_sage', 1, 2], ['plant_herbs', 2, 2], ['wardrobe_wood', 3, 2], ['lamp_table', 5, 2], ['shelf_kitchen', 6, 2],
    ['tea_set', 8, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_cream', 2, 5],
  ],
  // photographer: easel, frame, landscape
  kai: [
    ['shelf_books', 1, 2], ['wardrobe_wood', 4, 2], ['lamp_table', 6, 2], ['bed_sage', 7, 2], ['plant_fern', 8, 2],
    ['pt_landscape', 5, 1], ['easel', 3, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_cream', 2, 5], ['photo_frame', 8, 6],
  ],
  // runner: bed, a bench, little else
  rin: [
    ['wardrobe_wood', 4, 2], ['lamp_table', 6, 2], ['bed_sage', 7, 2], ['plant_fern', 8, 2],
    ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['bench_wood', 6, 6],
  ],
  // musician: piano and a radio
  oto: [
    ['bed_sage', 1, 2], ['plant_fern', 2, 2], ['wardrobe_wood', 3, 2], ['lamp_table', 5, 2], ['shelf_books', 6, 2],
    ['piano', 5, 3], ['radio', 8, 3], ['table_round', 4, 4], ['chair_wood', 4, 5, 2], ['rug_indigo', 2, 5],
  ],
};

/** Uninhabited houses, keyed by HOUSES index. Tea rooms and flower rooms are not copies of each other. */
const EMPTY: Record<number, HouseSpot[]> = {
  12: [
    ['shelf_kitchen', 1, 2], ['andon', 6, 2], ['futon_indigo', 7, 2], ['bamboo_pot', 8, 2],
    ['lantern_cream', 3, 3], ['tea_set', 8, 6], ['table_low', 5, 4], ['cushion_rose', 6, 5], ['rug_indigo', 2, 5],
  ],
  14: [
    ['shelf_books', 1, 2], ['lantern_cream', 6, 2], ['futon_rose', 7, 2], ['bonsai', 8, 2],
    ['tea_set', 3, 3], ['table_low', 5, 4], ['cushion_indigo', 4, 5], ['rug_cream', 2, 5],
  ],
  13: [
    ['bed_sage', 1, 2], ['vase_tulips', 2, 2], ['wardrobe_wood', 3, 2], ['lamp_cream', 5, 2], ['shelf_books', 6, 2],
    ['bonsai', 8, 3], ['table_round', 4, 4], ['chair_sage', 4, 5, 2], ['rug_round', 2, 5], ['plant_monstera', 8, 6],
  ],
  15: [
    ['bed_rose', 1, 2], ['vase_lav', 2, 2], ['wardrobe_white', 3, 2], ['lamp_rose', 5, 2], ['shelf_dark', 6, 2],
    ['bonsai', 2, 3], ['plant_fern', 8, 2], ['table_round', 4, 4], ['chair_rose', 4, 5, 2], ['rug_stripes', 1, 5], ['vase_tulips', 8, 6],
  ],
};

export function residentId(index: number): string | null {
  return RESIDENTS[index] ?? null;
}

export function houseDoorPlan(h: HouseDef): { x: number; y: number; spawnX: number; spawnY: number; dir: Dir; lane: [number, number][] } {
  if (h.side === 'l') return { x: 0, y: 4, spawnX: 1, spawnY: 4, dir: 'right', lane: [[1, 4], [2, 4]] };
  return { x: 9, y: 4, spawnX: 8, spawnY: 4, dir: 'left', lane: [[8, 4], [7, 4]] };
}

/** Tiles a gift must not cover: the step inside the door, the next tile, and the neighbour's spot. */
export function houseReserved(h: HouseDef): [number, number][] {
  return [...houseDoorPlan(h).lane, [5, 5]];
}

export function housePieces(h: HouseDef, index: number): HouseSpot[] {
  const who = residentId(index);
  const list = (who && LAYOUTS[who]) || EMPTY[index] || (h.side === 'l' ? LAYOUTS.ren : LAYOUTS.mika);
  return list.map((p) => [p[0], p[1], p[2], p[3] ?? 0]);
}

/** Two things to look at: the table, and something that belongs to the person. */
export function houseInteracts(h: HouseDef, index: number): { x: number; y: number; key: string }[] {
  const pieces = housePieces(h, index);
  const kind = (id: string) => FURN_BY_ID[id]?.kind;
  const table = pieces.find((p) => kind(p[0]) === 'table' || kind(p[0]) === 'roundtable');
  const keep = [...pieces].reverse().find((p) => p !== table && !FURN_BY_ID[p[0]]?.wall && !FURN_BY_ID[p[0]]?.walkable);
  const who = residentId(index);
  const prefix = who ? `in_${who}` : `in_${h.trade}`;
  const out: { x: number; y: number; key: string }[] = [];
  if (table) out.push({ x: table[1], y: table[2], key: prefix });
  if (keep) out.push({ x: keep[1], y: keep[2], key: prefix + '2' });
  return out;
}
