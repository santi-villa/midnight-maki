/**
 * The side-entrance houses of the village (harbour lanes, cherry bank, east cove, eastern garden) and their small interiors.
 * Each house is a real zone: the door on the porch leads into a 10x8 room furnished for its trade.
 */
import { Builder, zone } from './zoneKit';
import type { DoorDef, InteractDef, ZoneDef } from './zones';

export type Trade = 'home' | 'tea' | 'fish' | 'flower';
export interface HouseDef { id: string; zone: 'plaza' | 'beach' | 'garden'; trade: Trade; side: 'l' | 'r'; x: number; y: number; name: string }

const NAMES: Record<Trade, string[]> = {
  home: ['Casa de los Sato', 'Casa Hayashi', 'Casa de la abuela Fuyu', 'Casa Kimura', 'Casa de los Mori', 'Casa Tanabe'],
  tea: ['Casa de té Brisa', 'Casa de té Luna de Cebada', 'Casa de té El Rincón', 'Casa de té Nube'],
  fish: ['Pescadería Marea', 'Pescadería El Atún Feliz', 'Cabaña del pescador Goro', 'Pescadería Ola'],
  flower: ['Florería Pétalo', 'Florería Tulipán', 'Florería Rocío', 'Florería Girasol'],
};

const RAW: [HouseDef['zone'], Trade, 'l' | 'r', number, number][] = [
  // Villa Nori: south row, then the harbour row, then the cherry bank
  ['plaza', 'home', 'l', 1, 27], ['plaza', 'flower', 'r', 18, 27], ['plaza', 'home', 'r', 24, 27], ['plaza', 'fish', 'l', 30, 27],
  ['plaza', 'tea', 'r', 1, 36], ['plaza', 'home', 'l', 8, 36], ['plaza', 'fish', 'r', 18, 36], ['plaza', 'flower', 'l', 24, 36],
  ['plaza', 'tea', 'r', 46, 15], ['plaza', 'flower', 'l', 50, 20],
  // east cove of the beach
  ['beach', 'fish', 'l', 32, 3], ['beach', 'home', 'r', 40, 3], ['beach', 'tea', 'l', 33, 9], ['beach', 'flower', 'r', 40, 9],
  // eastern garden
  ['garden', 'tea', 'l', 25, 4], ['garden', 'flower', 'r', 31, 4],
];
const used: Record<Trade, number> = { home: 0, tea: 0, fish: 0, flower: 0 };
export const HOUSES: HouseDef[] = RAW.map(([zone, trade, side, x, y]) => ({ id: `house_${zone}_${x}_${y}`, zone, trade, side, x, y, name: NAMES[trade][used[trade]++ % NAMES[trade].length] }));

export const housesIn = (zone: HouseDef['zone']) => HOUSES.filter((h) => h.zone === zone);
export const houseDoorTile = (h: HouseDef): [number, number] => [h.x + (h.side === 'l' ? 1 : 4), h.y + 2];
export const housePropId = (h: HouseDef) => `bld_th_${h.trade}_${h.side}`;
export const houseDoorDef = (h: HouseDef): DoorDef => { const [x, y] = houseDoorTile(h); return { x, y, to: h.id, tx: 5, ty: 6, dir: 'up', walk: true, label: h.name }; };

const LOOK: Record<Trade, { walls: string; floor: string; music: string }> = {
  home: { walls: 'cream', floor: 'wood', music: 'home' },
  tea: { walls: 'shoji', floor: 'tatami', music: 'home' },
  fish: { walls: 'wood', floor: 'darkwood', music: 'town' },
  flower: { walls: 'rose', floor: 'checker', music: 'garden' },
};

function furnish(b: Builder, trade: Trade): { at: [number, number]; key: string }[] {
  if (trade === 'home') {
    b.prop('wallshelf', 1, 1).prop('wallshelf', 7, 1).prop('k_stove', 3, 2).prop('k_sink', 4, 2).prop('k_fridge', 8, 2)
      .prop('library_table', 6, 4).prop('bar_stool', 6, 5).prop('bar_stool', 7, 5).prop('andon', 1, 4).prop('pot_rose', 1, 6).prop('shop_rug', 3, 5).prop('lantern_cream', 5, 2);
    return [{ at: [6, 4], key: 'in_home' }, { at: [3, 2], key: 'in_home2' }];
  }
  if (trade === 'tea') {
    b.prop('wallshelf', 1, 1).prop('wallshelf', 4, 1).prop('wallshelf', 7, 1).prop('library_table', 2, 4).prop('library_table', 6, 4)
      .prop('bar_stool', 2, 5).prop('bar_stool', 3, 5).prop('bar_stool', 6, 5).prop('bar_stool', 7, 5).prop('bamboo', 1, 3).prop('bamboo', 8, 3)
      .prop('andon', 8, 5).prop('sake_barrel', 1, 6).prop('lantern_cream', 3, 2).prop('lantern_cream', 6, 2);
    return [{ at: [2, 4], key: 'in_tea' }, { at: [6, 4], key: 'in_tea2' }];
  }
  if (trade === 'fish') {
    b.prop('k_sink', 2, 3).prop('k_counter', 3, 3).prop('k_counter', 4, 3).prop('k_board', 5, 3).prop('k_rice', 6, 3).prop('wallshelf', 1, 1).prop('wallshelf', 7, 1)
      .prop('crate', 1, 5).prop('crate', 1, 6).prop('barrel', 8, 5).prop('barrel', 8, 6).prop('sack', 7, 6).prop('lantern_red', 3, 2).prop('lantern_red', 6, 2).prop('shop_rug', 4, 6);
    return [{ at: [4, 3], key: 'in_fish' }, { at: [1, 5], key: 'in_fish2' }];
  }
  b.prop('wallshelf', 1, 1).prop('wallshelf', 7, 1).prop('shop_counter_rose', 4, 3).prop('shop_counter_rose', 5, 3).prop('shop_counter_rose', 6, 3)
    .prop('pot_rose', 1, 3).prop('pot_cream', 1, 5).prop('pot_rose', 8, 5).prop('pot_cream', 8, 3).prop('bamboo', 8, 6).prop('flowers', 2, 6).prop('flowers_lav', 3, 6).prop('shop_rug', 4, 5).prop('lantern_cream', 3, 2).prop('lantern_cream', 6, 2);
  return [{ at: [5, 3], key: 'in_flower' }, { at: [1, 3], key: 'in_flower2' }];
}

/** Interior zones for every house, door back to the porch it belongs to. */
export function houseZones(): ZoneDef[] {
  return HOUSES.map((h) => {
    const look = LOOK[h.trade];
    const b = new Builder(10, 8, '#');
    b.room(0, 0, 10, 8, [2, 7]);
    b.set(5, 7, 'm');
    const spots = furnish(b, h.trade);
    const [dx, dy] = houseDoorTile(h);
    const interact: InteractDef[] = spots.map((s, i) => ({ id: `${h.id}_n${i}`, x: s.at[0], y: s.at[1], label: i === 0 ? h.name : 'Mirar', action: 'note:' + s.key }));
    return zone(b, {
      id: h.id, name: h.name, music: look.music, outdoor: false, walls: look.walls, floor: look.floor,
      doors: [{ x: 5, y: 7, to: h.zone, tx: dx, ty: dy + 1, dir: 'down', walk: true }],
      interact, rooms: [], gather: [],
    });
  });
}
