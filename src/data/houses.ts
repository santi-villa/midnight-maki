/**
 * The side-entrance houses of the village (harbour lanes, cherry bank, east cove, eastern garden) and their small interiors.
 * Each house is a real zone: the porch door leads into a 10x8 room, and the interior exit is on the same side as the porch.
 */
import { houseDoorPlan, houseInteracts } from './houseInterior';
import { Builder, zone } from './zoneKit';
import type { DoorDef, InteractDef, ZoneDef } from './zones';
import { VILLAGE_HOME_SITES, type VillageZone } from './villageGeography';

export type Trade = 'home' | 'tea' | 'fish' | 'flower';
/** `front`: seen from the front with a porch at one side. `side`: the whole house seen from the side, entrance on its gable end. */
export interface HouseDef { id: string; zone: VillageZone; trade: Trade; side: 'l' | 'r'; view: 'front' | 'side'; x: number; y: number; name: string }

const NAMES: Record<Trade, string[]> = {
  home: ['Casa de los Sato', 'Casa Hayashi', 'Casa de la abuela Fuyu', 'Casa Kimura', 'Casa de los Mori', 'Casa Tanabe'],
  tea: ['Casa de té Brisa', 'Casa de té Luna de Cebada', 'Casa de té El Rincón', 'Casa de té Nube'],
  fish: ['Pescadería Marea', 'Pescadería El Atún Feliz', 'Cabaña del pescador Goro', 'Pescadería Ola'],
  flower: ['Florería Pétalo', 'Florería Tulipán', 'Florería Rocío', 'Florería Girasol'],
};

const RAW: [HouseDef['zone'], Trade, 'l' | 'r', number, number, ('front' | 'side')?][] = [
  // Villa Nori: south row, then the harbour row, then the cherry bank
  ['plaza', 'home', 'l', 1, 27], ['plaza', 'flower', 'r', 18, 27], ['plaza', 'home', 'r', 24, 27], ['plaza', 'fish', 'l', 30, 27],
  ['plaza', 'tea', 'r', 1, 36], ['plaza', 'home', 'l', 8, 36, 'side'], ['plaza', 'fish', 'r', 18, 36, 'side'], ['plaza', 'flower', 'l', 24, 36],
  ['plaza', 'tea', 'r', 46, 15, 'side'], ['plaza', 'flower', 'l', 50, 20, 'side'],
  // east cove of the beach
  ['beach', 'fish', 'l', 32, 3, 'side'], ['beach', 'home', 'r', 40, 3, 'side'], ['beach', 'tea', 'l', 33, 9, 'side'], ['beach', 'flower', 'r', 40, 9, 'side'],
  // eastern garden
  ['garden', 'tea', 'l', 25, 4, 'side'], ['garden', 'flower', 'r', 31, 4, 'side'],
];
const used: Record<Trade, number> = { home: 0, tea: 0, fish: 0, flower: 0 };
/** Sign text. IDs stay historical (saves and visits). A shared house names everyone who sleeps there. */
const WHO: Record<string, string> = {
  house_plaza_1_27: 'Casa de Ren y Taro',
  house_plaza_18_27: 'Casa de Mika y Sumi',
  house_plaza_24_27: 'Casa de Haru y Kumo',
  house_plaza_30_27: 'Pescadería de Tomo y Kiki',
  house_plaza_1_36: 'Casa de Nene',
  house_plaza_8_36: 'Casa de Goro y Bento',
  house_plaza_18_36: 'Casa de Fuyu y Hoshi',
  house_plaza_24_36: 'Casa de Sato y Sora',
  house_plaza_46_15: 'Casa de Mame',
  house_plaza_50_20: 'Casa de Kai y Akio',
  house_beach_32_3: 'Cabaña de Rin',
  house_beach_40_3: 'Casa de Oto',
  house_garden_31_4: 'Florería del Jardín',
};
// These IDs are addresses used by saved visits and neighbours. Keep the original ID even
// when its building moves: the coordinates in the ID are historical, not a location parser.
export const HOUSES: HouseDef[] = RAW.map(([zone, trade, side, x, y, view], index) => {
  const id = `house_${zone}_${x}_${y}`;
  const generated = NAMES[trade][used[trade]++ % NAMES[trade].length];
  const [newZone, nx, ny] = VILLAGE_HOME_SITES[index];
  return { id, zone: newZone, trade, side, view: view ?? 'front', x: nx, y: ny,
    name: WHO[id] ?? generated };
});

export const housesIn = (zone: HouseDef['zone']) => HOUSES.filter((h) => h.zone === zone);
/** the porch door of a front house; the outer end of the gable for a house seen from the side */
export const houseDoorTile = (h: HouseDef): [number, number] => h.view === 'side' ? [h.x + (h.side === 'l' ? 0 : 5), h.y + 2] : [h.x + (h.side === 'l' ? 1 : 4), h.y + 2];
export const housePropId = (h: HouseDef) => `bld_${h.view === 'side' ? 'sh' : 'th'}_${h.trade}_${h.side}`;

/** a short cobbled path from the entrance of every side house, so it is clear where to go in */
export function houseEntrancePaths(b: { g: string[][]; set(x: number, y: number, ch: string): unknown }, zone: HouseDef['zone']) {
  for (const h of housesIn(zone)) {
    const [dx, dy] = houseDoorTile(h);
    for (const y of [dy + 1, dy + 2]) if ('gGsp'.includes(b.g[y]?.[dx] ?? 'x')) b.set(dx, y, 'c');
  }
}
export const houseDoorDef = (h: HouseDef): DoorDef => {
  const [x, y] = houseDoorTile(h);
  const plan = houseDoorPlan(h);
  return { x, y, to: h.id, tx: plan.spawnX, ty: plan.spawnY, dir: plan.dir, walk: true, label: h.name };
};

const LOOK: Record<Trade, { walls: string; floor: string; music: string }> = {
  home: { walls: 'cream', floor: 'wood', music: 'home' },
  tea: { walls: 'shoji', floor: 'tatami', music: 'home' },
  fish: { walls: 'wood', floor: 'darkwood', music: 'town' },
  flower: { walls: 'rose', floor: 'checker', music: 'garden' },
};

/** Interior zones for every house. The exit is on the same wall as the porch, and the room can hold saved furniture. */
export function houseZones(): ZoneDef[] {
  return HOUSES.map((h, index) => {
    const look = LOOK[h.trade];
    const plan = houseDoorPlan(h);
    const b = new Builder(10, 8, '#');
    b.room(0, 0, 10, 8, [2, 7]);
    b.set(plan.x, plan.y, 'm');
    const [dx, dy] = houseDoorTile(h);
    const interact: InteractDef[] = houseInteracts(h, index).map((s, i) => ({
      id: `${h.id}_n${i}`, x: s.x, y: s.y, label: i === 0 ? h.name : 'Mirar', action: 'note:' + s.key,
    }));
    return zone(b, {
      id: h.id, name: h.name, music: look.music, outdoor: false, walls: look.walls, floor: look.floor,
      doors: [{ x: plan.x, y: plan.y, to: h.zone, tx: dx, ty: dy + 1, dir: 'down', walk: true }],
      interact,
      rooms: [{ id: h.id, name: h.name, x: 1, y: 2, w: 8, h: 5, defWall: look.walls, defFloor: look.floor }],
      gather: [],
    });
  });
}
