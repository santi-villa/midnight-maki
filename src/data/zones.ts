/**
 * Zone (map) definitions. Maps are built with small drawing helpers instead of hand-typed grids,
 * which keeps them easy to edit. Coordinates are tiles.
 */
import type { Dir } from '../core/types';
import { Builder, RESTAURANT_ENTRY, treeBorder, zone } from './zoneKit';
import { plaza } from './plazaMap';
import { houseDoorDef, houseEntrancePaths, housePropId, housesIn, houseZones } from './houses';
import { installVillageWorld } from './villageWorld';
import { KITCHEN, STATIONS } from '../galley/layout';
import { exteriorsWanted } from '../art/exteriors';
export { Builder, treeBorder, zone, RESTAURANT_ENTRY };

export interface PropPlace { id: string; x: number; y: number; cond?: string; }
export interface DoorDef {
  x: number; y: number; to: string; tx: number; ty: number; dir: Dir;
  label?: string; lock?: { flag: string; msg: string }; walk?: boolean;
}
export interface InteractDef { id: string; x: number; y: number; label: string; action: string; cond?: string; }
export interface RoomDef { id: string; name: string; x: number; y: number; w: number; h: number; owner?: string; defWall: string; defFloor: string; }
export interface GatherDef { x: number; y: number; pool: string[]; }

export interface ZoneDef {
  id: string;
  name: string;
  music: string;
  outdoor: boolean;
  /** Authored position on the continuous village map, in tiles. */
  world?: { x: number; y: number };
  w: number;
  h: number;
  ground: string[];
  props: PropPlace[];
  doors: DoorDef[];
  interact: InteractDef[];
  rooms: RoomDef[];
  gather: GatherDef[];
  fishing?: 'sea' | 'lake';
  bugs?: boolean;
  dark?: boolean; // always dim (storage, and the night market)
  gloom?: boolean; // cool and dim, but the lamps still read (lighthouse)
  walls?: string; // wall style outside decor rooms
  floor?: string; // floor style outside decor rooms
}

// The restaurant's street entrance is also the arrival point after the opening pictures.
export const GARDEN_PLOT_POSITIONS = [[7, 10], [8, 10], [9, 10], [10, 10], [7, 11], [8, 11], [9, 11], [10, 11]] as const;

// ================================================================== RESTAURANT
function restaurant(): ZoneDef {
  // izakaya / sushi bar: tall dark walls (noren band on top), bar behind a sushi counter, tatami corner
  // 24 wide: the hall grew to the right so its tables keep a one-tile aisle around them (kitchen, doors and stairs stay put)
  const b = new Builder(24, 14, '#');
  b.room(0, 0, 24, 14, [11, 14, 19, 21]);
  b.rect(1, 0, 22, 1, 'U');
  b.rect(KITCHEN.x, KITCHEN.y, KITCHEN.w, KITCHEN.h, 'k');
  b.rect(15, 9, 7, 4, 't');
  b.set(8, 13, 'm').set(9, 13, 'm');
  // the kitchen is a station table (galley/layout.ts): a spot that needs an upgrade is a plain work counter until then
  for (const s of STATIONS) {
    if (s.needs) b.prop(s.prop, s.x, s.y, 'upgrade:' + s.needs).prop('k_work', s.x, s.y, '!upgrade:' + s.needs);
    else if (s.alt) b.prop(s.prop, s.x, s.y, '!upgrade:' + s.alt.needs).prop(s.alt.prop, s.x, s.y, 'upgrade:' + s.alt.needs);
    else b.prop(s.prop, s.x, s.y);
  }
  b.prop('stairs', 16, 2)
    .prop('door_storage', 13, 1, '!storage_open')
    .prop('door_storage_open', 13, 1, 'storage_open')
    .prop('wallshelf', 1, 1)
    .prop('wallshelf', 3, 1)
    .prop('mm_sign', 6, 1)
    .prop('wall_lantern_red', 5, 1)
    .prop('wall_lantern_cream', 12, 1)
    .prop('wall_lantern_red', 15, 1)
    .prop('wallshelf', 18, 1)
    .prop('wall_lantern_cream', 20, 1)
    .prop('wallshelf', 21, 1)
    .prop('bamboo', 22, 2)
    .prop('sake_barrel', 18, 3)
    .prop('sake_barrel', 19, 3)
    .prop('sake_barrel', 1, 9)
    .prop('sake_barrel', 1, 10)
    .prop('barrel', 2, 10)
    .prop('bamboo', 1, 12)
    .prop('bamboo', 6, 12)
    // the look of the restaurant grows with its level (restaurant/stages.ts): clutter goes away, comfort arrives
    .prop('crate', 1, 7, 'stage<1')
    .prop('sack', 1, 8, 'stage<1')
    .prop('barrel', 3, 12, 'stage<1')
    .prop('andon', 14, 3, 'stage>=1')
    .prop('pot_cream', 3, 12, 'stage>=1')
    .prop('wall_lantern_cream', 8, 1, 'stage>=1')
    .prop('pot_rose', 4, 12, 'stage>=2')
    .prop('wallshelf', 10, 1, 'stage>=2')
    .prop('andon', 15, 5, 'stage>=2')
    .prop('stonelantern', 15, 3, 'stage>=3')
    .prop('flowers', 14, 4, 'stage>=3')
    .prop('wall_lantern_red', 9, 1, 'stage>=3');
  return zone(b, {
    id: 'restaurant', name: 'Midnight Maki', music: 'restaurant', outdoor: false, walls: 'izakaya', floor: 'izakaya',
    doors: [
      { x: 8, y: 13, to: 'plaza', tx: 5, ty: 7, dir: 'down', walk: true },
      { x: 9, y: 13, to: 'plaza', tx: 5, ty: 7, dir: 'down', walk: true },
      { x: 16, y: 2, to: 'home', tx: 14, ty: 9, dir: 'up', walk: true, label: 'Arriba' },
      { x: 13, y: 2, to: 'storage', tx: 4, ty: 6, dir: 'up', walk: false, label: 'Depósito', lock: { flag: 'storage_open', msg: 'La puerta del depósito está cerrada con llave.' } },
    ],
    interact: [
      // classic stations: kept for guests and for "Cómo cocinar: clásico"; the host's physical kitchen hides them (WorldScene.sense)
      { id: 'cook', x: 7, y: 3, label: 'Cocinar', action: 'cook' },
      { id: 'orders', x: 7, y: 5, label: 'Pedidos', action: 'orders' },
      { id: 'orders2', x: 8, y: 5, label: 'Pedidos', action: 'orders' },
      { id: 'tray', x: 6, y: 5, label: 'Bandeja de salida', action: 'tray' },
      { id: 'drinks', x: 11, y: 3, label: 'Bebidas', action: 'drinks' },
      { id: 'fridge', x: 1, y: 3, label: 'Despensa', action: 'pantry' },
      { id: 'storage_door', x: 13, y: 2, label: 'Depósito', action: 'door:storage' },
    ],
    // the hall includes the open floor left of the old square and the tatami corner; the kitchen stays outside
    rooms: [{ id: 'dining', name: 'Salón', x: 3, y: 6, w: 20, h: 7, defWall: 'izakaya', defFloor: 'izakaya' }],
    gather: [],
  });
}

// ================================================================== SHOP INTERIORS
function shopRoom(id: string, name: string, walls: string, floor: string, exit: [number, number], build: (b: Builder) => void, action: string, label: string): ZoneDef {
  const b = new Builder(10, 8, '#');
  b.room(0, 0, 10, 8, [2, 7]);
  b.set(5, 7, 'm');
  build(b);
  return zone(b, {
    id, name, music: 'town', outdoor: false, walls, floor,
    doors: [{ x: 5, y: 7, to: 'plaza', tx: exit[0], ty: exit[1], dir: 'down', walk: true }],
    interact: [4, 5, 6].map((x) => ({ id: id + '_c' + x, x, y: 4, label, action })),
    rooms: [],
    gather: [],
  });
}
const shopYuki = () => shopRoom('shop_yuki', 'Ropa de Yuki', 'rose', 'rose', [26, 7], (b) => {
  b.prop('wallshelf', 1, 1).prop('wallshelf', 7, 1).prop('clothes_rack', 1, 3).prop('clothes_rack_b', 7, 3)
    .prop('shop_counter_rose', 4, 4).prop('shop_counter_rose', 5, 4).prop('shop_counter_rose', 6, 4)
    .prop('pot_rose', 1, 6).prop('pot_cream', 8, 6).prop('shop_rug', 4, 6).prop('lantern_cream', 3, 2).prop('lantern_cream', 6, 2);
}, 'shop:yuki', 'Ropa de Yuki');
const shopTaro = () => shopRoom('shop_taro', 'Almacén de Taro', 'wood', 'wood', [27, 19], (b) => {
  b.prop('wallshelf', 1, 1).prop('wallshelf', 3, 1).prop('wallshelf', 6, 1).prop('crate', 1, 3).prop('crate', 1, 4).prop('barrel', 8, 3)
    .prop('barrel', 8, 4).prop('sack', 2, 6).prop('crate', 7, 6)
    .prop('shop_counter', 4, 4).prop('shop_counter_reg', 5, 4).prop('shop_counter', 6, 4).prop('shop_rug', 4, 6).prop('lantern_red', 3, 2).prop('lantern_red', 7, 2);
}, 'shop:taro', 'Almacén de Taro');
const shopBento = () => shopRoom('shop_bento', 'Panadería de Bento', 'cream', 'checker', [5, 19], (b) => {
  b.prop('wallshelf', 1, 1).prop('wallshelf', 7, 1).prop('bread_case', 1, 3).prop('flour_sack', 8, 3).prop('flour_sack', 8, 5)
    .prop('shop_counter', 4, 4).prop('shop_counter_reg', 5, 4).prop('shop_counter', 6, 4).prop('pot_cream', 1, 6).prop('shop_rug', 4, 6).prop('lantern_cream', 3, 2).prop('lantern_cream', 6, 2);
}, 'shop:bento', 'Panadería de Bento');

// ================================================================== LIBRARY
function library(): ZoneDef {
  const b = new Builder(12, 9, '#');
  b.room(0, 0, 12, 9, [3, 8]).set(6, 8, 'm');
  b.prop('library_shelf', 1, 2).prop('library_shelf', 8, 2)
    .prop('library_shelf', 1, 4).prop('library_shelf', 8, 4)
    .prop('library_table', 5, 4).prop('library_books', 5, 4)
    .prop('bench', 3, 6).prop('bench', 8, 6)
    .prop('lantern_cream', 3, 2).prop('lantern_cream', 9, 2).prop('pot_cream', 1, 6);
  return zone(b, { id: 'library', name: 'Biblioteca de Villa Nori', music: 'home', outdoor: false, walls: 'wood', floor: 'wood',
    doors: [{ x: 6, y: 8, to: 'plaza', tx: 11, ty: 25, dir: 'down', walk: true }],
    interact: [{ id: 'library', x: 5, y: 3, label: 'Leer en la biblioteca', action: 'library' }], rooms: [], gather: [],
  });
}

// ================================================================== HOME (upstairs)
function home(): ZoneDef {
  const b = new Builder(29, 12, '#');
  b.room(0, 0, 8, 9, [3]);
  b.room(7, 0, 8, 9, [3]);
  b.room(14, 0, 8, 9, [4]);
  b.room(21, 0, 8, 9, [4]);
  b.rect(1, 8, 27, 1, '#');
  for (const dx of [4, 11, 18, 25]) b.set(dx, 8, 'f');
  b.rect(0, 8, 29, 4, '#');
  b.rect(1, 9, 27, 2, 'f');
  for (const dx of [4, 11, 18, 25]) b.set(dx, 8, 'f');
  b.prop('stairs_down', 14, 10);
  return zone(b, {
    id: 'home', name: 'Habitaciones', music: 'home', outdoor: false,
    doors: [{ x: 14, y: 10, to: 'restaurant', tx: 16, ty: 3, dir: 'down', walk: true, label: 'Abajo' }],
    interact: [
      { id: 'mirror', x: 6, y: 2, label: 'Ropero', action: 'wardrobe' },
      { id: 'pip_corner', x: 13, y: 5, label: 'Rincón de Pip', action: 'corner:pip', cond: 'upgrade:pip_corner' },
      { id: 'spicy_corner', x: 18, y: 5, label: 'Rincón de Spicy', action: 'corner:spicy', cond: 'upgrade:spicy_corner' },
      { id: 'rigg_corner', x: 25, y: 5, label: 'Rincón de Rigg', action: 'corner:rigg', cond: 'upgrade:rigg_corner' },
    ],
    rooms: [
      { id: 'room_player', name: 'Tu habitación', x: 0, y: 0, w: 8, h: 8, owner: 'player', defWall: 'rose', defFloor: 'wood' },
      { id: 'room_pip', name: 'Cuarto de Pip', x: 7, y: 0, w: 8, h: 8, owner: 'pip', defWall: 'lav', defFloor: 'lavcarpet' },
      { id: 'room_spicy', name: 'Cuarto de Spicy', x: 14, y: 0, w: 8, h: 8, owner: 'spicy', defWall: 'sage', defFloor: 'checker' },
      { id: 'room_rigg', name: 'Cuarto de Rigg', x: 21, y: 0, w: 8, h: 8, owner: 'rigg', defWall: 'wood', defFloor: 'darkwood' },
      { id: 'hall', name: 'Pasillo', x: 0, y: 8, w: 29, h: 4, defWall: 'cream', defFloor: 'wood' },
    ],
    gather: [],
  });
}

// ================================================================== STORAGE
function storage(): ZoneDef {
  const b = new Builder(9, 8, '#');
  b.room(0, 0, 9, 8, [2]);
  b.set(4, 7, 'm');
  b.prop('crate', 1, 2).prop('crate', 2, 2).prop('barrel', 6, 2).prop('crate', 7, 2).prop('barrel', 1, 5).prop('crate', 7, 5);
  return zone(b, {
    id: 'storage', name: 'Depósito', music: 'mystery', outdoor: false, dark: true,
    doors: [{ x: 4, y: 7, to: 'restaurant', tx: 13, ty: 3, dir: 'down', walk: true }],
    interact: [
      { id: 'st_shelf', x: 4, y: 2, label: 'Estante viejo', action: 'story:storage_shelf' },
      { id: 'st_sort', x: 2, y: 3, label: 'Cajones', action: 'minigame:sort' },
      { id: 'st_hidden', x: 7, y: 3, label: 'Tabla floja', action: 'story:hidden_compartment' },
    ],
    rooms: [],
    gather: [],
  });
}

// ================================================================== BEACH
function beach(): ZoneDef {
  const b = new Builder(48, 26, 's');
  b.rect(0, 0, 48, 3, 'g');
  b.rect(14, 0, 2, 4, 'p');
  b.rect(0, 15, 48, 1, 'h');
  b.rect(0, 16, 48, 10, 'w');
  b.rect(0, 19, 48, 7, 'd');
  b.rect(19, 12, 2, 8, 'b'); // pier
  b.rect(19, 15, 2, 1, 'b');
  // the east cove: a boardwalk, a second pier and a row of fishermen's shacks
  b.rect(30, 3, 18, 4, 'g').rect(31, 7, 15, 1, 'p').rect(34, 8, 2, 4, 'p').rect(41, 8, 2, 4, 'p').rect(31, 12, 15, 1, 'p');
  b.rect(38, 12, 2, 8, 'b'); // second pier
  b.rect(44, 8, 4, 7, 'G');
  treeBorder(b, [[14, 0], [15, 0]], ['tree', 'pine']);
  b.prop('stall_sage', 5, 7).prop('stall_rose', 9, 7).prop('boat', 23, 14)
    .prop('crate', 21, 11).prop('barrel', 18, 11).prop('lantern_cream', 18, 12).prop('lantern_cream', 21, 12)
    .prop('rock', 2, 12).prop('reeds', 1, 14).prop('reeds', 12, 14)
    .prop('bld_house', 24, 3).prop('lamppost', 13, 4).prop('lamppost', 17, 4)
    .prop('lighthouse', 2, 2, 'unlock_lighthouse_view')
    .prop('vending_red', 23, 5)
    .prop('bicycle', 20, 5)
    .prop('pot_cream', 29, 5)
    .prop('lanternstring', 4, 9)
    .prop('puddle', 12, 9, 'rain');
  // east cove: shacks with their door on the side, boats pulled up on the sand, nets and rocks
  for (const h of housesIn('beach')) b.prop(housePropId(h), h.x, h.y);
  houseEntrancePaths(b, 'beach');
  if (exteriorsWanted()) {
    // One quiet sunbathing corner; leave the central shoreline open for walking and shells.
    // Sea landmarks sit at the edges instead of scattering across the swimming/fishing view.
    b.prop('beach_umbrella_blue', 27, 12).prop('beach_towel_sky', 28, 13)
      .prop('beach_grass', 11, 5)
      .prop('sea_rock_big', 2, 20).prop('buoy_red', 40, 20);
  }
  b.prop('boat', 31, 14).prop('boat', 44, 13).prop('bigrock', 42, 15).prop('rock', 46, 14)
    .prop('crate', 37, 13).prop('barrel', 38, 13).prop('sack', 39, 11).prop('lanternstring', 34, 12).prop('lanternstring', 41, 12)
    .prop('lamppost', 31, 8).prop('lamppost', 44, 8).prop('lamppost', 37, 8).prop('lantern_cream', 37, 12).prop('lantern_cream', 40, 12)
    .prop('bench', 33, 7).prop('bench', 44, 7).prop('reeds', 30, 14).prop('reeds', 47, 14).prop('flowers', 36, 6).prop('pot_rose', 39, 7)
    .prop('bush_flower', 30, 4).prop('bush', 46, 7).prop('sakura', 47, 3).prop('pot_cream', 35, 8)
    .prop('lantern_cream', 37, 14).prop('lantern_cream', 40, 14);
  return zone(b, {
    id: 'beach', name: 'Playa de las Conchas', music: 'beach', outdoor: true,
    doors: [
      { x: 14, y: 0, to: 'plaza', tx: 15, ty: 41, dir: 'up', walk: true },
      { x: 15, y: 0, to: 'plaza', tx: 16, ty: 41, dir: 'up', walk: true },
      ...housesIn('beach').map(houseDoorDef),
      { x: 3, y: 4, to: 'lighthouse', tx: 6, ty: 10, dir: 'up', walk: false, label: 'Faro', lock: { flag: 'lighthouse_open', msg: 'La puerta del faro tiene tres huecos con forma de estrella.' } },
    ],
    interact: [
      // pier tip, the water beside that pier, and the open shoreline (the wet sand, not the dry beach)
      { id: 'fish1', x: 20, y: 19, label: 'Pescar', action: 'fish:sea' },
      { id: 'fish2', x: 18, y: 17, label: 'Pescar', action: 'fish:sea' },
      { id: 'fish3', x: 8, y: 15, label: 'Pescar', action: 'fish:sea' },
      { id: 'market_stall', x: 6, y: 8, label: 'Puesto de pescado', action: 'shop:nami' },
      { id: 'market_stall2', x: 10, y: 8, label: 'Puesto de conchas', action: 'shop:shells' },
      { id: 'lh_door', x: 3, y: 4, label: 'Faro', action: 'door:lighthouse', cond: 'unlock_lighthouse_view' },
      { id: 'sunset', x: 16, y: 13, label: 'Mirar el mar', action: 'sunset' },
      { id: 'fish4', x: 26, y: 15, label: 'Pescar', action: 'fish:sea' },
      { id: 'fish5', x: 39, y: 19, label: 'Pescar', action: 'fish:sea' },
    ],
    rooms: [],
    gather: [
      { x: 4, y: 13, pool: ['sh_scallop', 'sh_spiral', 'sh_cowrie', 'st_seaglass'] },
      { x: 10, y: 12, pool: ['sh_scallop', 'sh_pink', 'sh_cowrie'] },
      { x: 15, y: 14, pool: ['sh_spiral', 'sh_blue', 'st_seaglass'] },
      { x: 26, y: 13, pool: ['sh_scallop', 'sh_blue', 'sh_pearl', 'bottle_msg'] },
      { x: 7, y: 12, pool: ['sh_cowrie', 'st_seaglass'] },
      { x: 23, y: 9, pool: ['sh_spiral', 'sh_pink'] },
      { x: 35, y: 13, pool: ['sh_cowrie', 'sh_scallop', 'st_seaglass'] },
      { x: 41, y: 14, pool: ['sh_pink', 'sh_spiral', 'sh_blue'] },
      { x: 45, y: 13, pool: ['sh_pearl', 'sh_cowrie', 'bottle_msg'] },
    ],
    fishing: 'sea',
    bugs: false,
  });
}

// ================================================================== FOREST
function forest(): ZoneDef {
  const b = new Builder(48, 24, 'G');
  b.rect(14, 16, 2, 8, 'p');
  b.rect(6, 12, 42, 2, 'p');
  b.rect(36, 1, 2, 13, 'w'); // stream into a pond
  b.rect(33, 14, 8, 6, 'w').rect(35, 15, 4, 4, 'd');
  b.rect(36, 12, 2, 2, 'b');
  b.rect(42, 2, 5, 6, 'g').rect(41, 8, 2, 4, 'p').rect(30, 15, 3, 5, 'g');
  b.rect(6, 6, 2, 7, 'p');
  b.rect(19, 3, 9, 7, 'w');
  b.rect(21, 4, 5, 4, 'd');
  b.rect(19, 10, 9, 1, 'g');
  b.rect(2, 2, 7, 4, 'g');
  treeBorder(b, [[14, 23], [15, 23]], ['tree_dark', 'pine', 'tree']);
  const trees: [number, number][] = [[3, 9], [10, 8], [12, 4], [16, 7], [4, 17], [9, 18], [11, 15], [20, 17], [24, 19], [26, 14], [17, 20], [2, 21], [13, 9], [27, 2]];
  trees.forEach(([x, y], i) => b.prop(i % 3 ? 'tree_dark' : 'pine', x, y));
  b.prop('bld_cabin', 2, 3).prop('stump', 10, 11).prop('bigrock', 22, 14).prop('reeds', 19, 10).prop('reeds', 27, 10)
    .prop('mushroom', 8, 16).prop('mushroom', 18, 19).prop('bush_berry', 12, 18).prop('bush_berry', 23, 21)
    .prop('stonelantern', 9, 13).prop('stonelantern', 17, 11).prop('flowers_lav', 6, 15).prop('rock', 25, 16);
  // east: the stream, the pond, a hunter's cabin and an old shrine in a clearing
  const east: [string, number, number][] = [
    ['pine', 30, 3], ['tree_dark', 32, 5], ['pine', 33, 8], ['tree_dark', 31, 10], ['pine', 40, 4], ['tree_dark', 39, 8], ['pine', 34, 21], ['tree_dark', 40, 21],
    ['pine', 44, 15], ['tree_dark', 46, 18], ['pine', 43, 20], ['tree_dark', 30, 18], ['pine', 45, 11], ['tree_autumn', 42, 16], ['tree_dark', 31, 14],
  ];
  for (const [id, x, y] of east) b.prop(id, x, y);
  b.prop('bld_cabin', 42, 2).prop('shrine', 44, 8).prop('torii_w4', 40, 10).prop('stonelantern', 39, 10).prop('stonelantern', 44, 10).prop('stonelantern', 41, 14).prop('stonelantern', 45, 14)
    .prop('reeds', 35, 12).prop('reeds', 38, 12).prop('reeds', 33, 13).prop('reeds', 40, 14).prop('reeds', 35, 2).prop('reeds', 38, 6)
    .prop('mushroom', 32, 16).prop('mushroom', 33, 17).prop('mushroom', 31, 17).prop('flowers_lav', 44, 5).prop('flowers', 46, 6).prop('flowers_lav', 43, 12)
    .prop('stump', 38, 20).prop('bigrock', 44, 17).prop('rock', 32, 11).prop('bush_berry', 46, 6).prop('bush_berry', 31, 20).prop('sign', 40, 11);
  return zone(b, {
    id: 'forest', name: 'Bosque Susurrante', music: 'forest', outdoor: true,
    doors: [
      { x: 14, y: 23, to: 'plaza', tx: 15, ty: 1, dir: 'down', walk: true },
      { x: 15, y: 23, to: 'plaza', tx: 16, ty: 1, dir: 'down', walk: true },
    ],
    interact: [
      { id: 'cabin', x: 4, y: 6, label: 'Cabaña', action: 'story:cabin' },
      // south edge of the lake, and the pond's west and south banks
      { id: 'lake1', x: 21, y: 9, label: 'Pescar', action: 'fish:lake' },
      { id: 'lake2', x: 25, y: 9, label: 'Pescar', action: 'fish:lake' },
      { id: 'stump', x: 10, y: 12, label: 'Tocón tallado', action: 'puzzle:stump' },
      { id: 'kiki_path', x: 28, y: 20, label: 'Sendero oculto', action: 'secret:forest_path' },
      { id: 'pond_fish1', x: 33, y: 16, label: 'Pescar', action: 'fish:lake' },
      { id: 'pond_fish2', x: 36, y: 19, label: 'Pescar', action: 'fish:lake' },
      { id: 'forest_shrine', x: 44, y: 8, label: 'Santuario del bosque', action: 'note:shrine' },
      { id: 'hunter_cabin', x: 45, y: 4, label: 'Cabaña vieja', action: 'note:house' },
    ],
    rooms: [],
    gather: [
      { x: 8, y: 17, pool: ['shiitake', 'berry'] },
      { x: 18, y: 18, pool: ['shiitake', 'wood'] },
      { x: 12, y: 19, pool: ['berry', 'fl_bell'] },
      { x: 24, y: 20, pool: ['berry', 'shiitake', 'st_amethyst'] },
      { x: 5, y: 10, pool: ['wood', 'stone', 'st_quartz'] },
      { x: 15, y: 10, pool: ['fl_bell', 'shiitake'] },
      { x: 27, y: 16, pool: ['wood', 'fl_camellia'] },
      { x: 32, y: 6, pool: ['wood', 'shiitake'] },
      { x: 42, y: 17, pool: ['fl_bell', 'shiitake'] },
      { x: 44, y: 14, pool: ['berry', 'st_amethyst'] },
      { x: 31, y: 19, pool: ['berry', 'fl_bell'] },
    ],
    fishing: 'lake',
    bugs: true,
  });
}

// ================================================================== GARDEN
function garden(): ZoneDef {
  const b = new Builder(38, 26, 'g');
  b.rect(0, 10, 12, 2, 'p');
  b.rect(22, 10, 16, 2, 'p'); // path on to the eastern garden
  b.rect(26, 16, 10, 8, 'w').rect(28, 17, 6, 6, 'd').rect(30, 15, 2, 10, 'b'); // koi pond and its bridge
  b.rect(24, 3, 12, 6, 'g').rect(3, 19, 18, 1, 'p').rect(10, 16, 2, 4, 'p');
  b.rect(26, 13, 9, 1, 'y').rect(26, 14, 9, 1, 'l');
  b.rect(10, 4, 2, 12, 'p');
  b.rect(14, 3, 7, 4, 'w');
  b.rect(16, 4, 3, 2, 'd');
  b.rect(3, 4, 6, 2, 'o'); // soil plots (6)
  b.rect(14, 10, 2, 1, 'r').rect(17, 10, 2, 1, 'y').rect(20, 10, 2, 1, 'l');
  b.rect(14, 13, 8, 1, 'r');
  treeBorder(b, [[0, 10], [0, 11]], ['sakura', 'tree', 'sakura']);
  b.prop('bench', 13, 8).prop('stonelantern', 12, 3).prop('stonelantern', 21, 7).prop('lantern_red', 2, 8).prop('lantern_cream', 8, 8)
    .prop('lantern_red', 14, 15).prop('lantern_cream', 20, 15).prop('sakura', 6, 14).prop('flowers', 3, 14).prop('flowers_lav', 18, 2)
    .prop('reeds', 21, 5).prop('fence', 2, 6).prop('fence', 3, 6).prop('fence', 4, 6).prop('fence', 6, 6).prop('fence', 7, 6).prop('fence', 8, 6)
    .prop('well', 3, 1)
    .prop('farm_barrel', 2, 4).prop('farm_crate', 9, 4).prop('farm_hay', 9, 5).prop('farm_flowers', 1, 5).prop('farm_bush', 10, 3).prop('farm_rock', 1, 3)
    .prop('pot_rose', 9, 8)
    .prop('lanternstring', 13, 16)
    .prop('puddle', 7, 11, 'rain');
  // eastern garden: a tea house with its door on the side, wisteria lanterns and an orchard of cherry trees
  for (const h of housesIn('garden')) b.prop(housePropId(h), h.x, h.y);
  houseEntrancePaths(b, 'garden');
  const orchard: [number, number][] = [[3, 21], [6, 22], [9, 21], [13, 22], [16, 21], [19, 22], [4, 24], [8, 24], [12, 24], [17, 24], [22, 22], [23, 19]];
  for (const [x, y] of orchard) b.prop('sakura', x, y);
  b.prop('stonelantern', 29, 15).prop('stonelantern', 32, 15).prop('stonelantern', 29, 24).prop('stonelantern', 32, 24)
    .prop('lantern_red', 25, 9).prop('lantern_cream', 35, 9).prop('lantern_red', 24, 12).prop('lantern_cream', 36, 12)
    .prop('bench', 25, 15).prop('bench', 35, 15).prop('bench', 14, 20).prop('reeds', 26, 20).prop('reeds', 35, 18).prop('reeds', 27, 23)
    .prop('flowers', 22, 14).prop('flowers_lav', 23, 15).prop('flowers', 36, 11).prop('flowers_lav', 20, 18).prop('pot_rose', 24, 8).prop('pot_cream', 36, 8)
    .prop('bush_flower', 22, 7).prop('bush', 37, 5).prop('fence', 22, 20).prop('fence', 23, 20).prop('fence', 24, 20)
    .prop('lanternstring', 26, 12).prop('lanternstring', 31, 12).prop('lanternstring', 8, 20);
  return zone(b, {
    id: 'garden', name: 'Jardín de los Faroles', music: 'garden', outdoor: true,
    doors: [
      { x: 0, y: 10, to: 'plaza', tx: 70, ty: 12, dir: 'left', walk: true },
      { x: 0, y: 11, to: 'plaza', tx: 70, ty: 13, dir: 'left', walk: true },
      ...housesIn('garden').map(houseDoorDef),
    ],
    interact: [
      ...GARDEN_PLOT_POSITIONS.map(([x, y], i) => ({ id: 'plot' + i, x, y, label: 'Parcela', action: 'plot:' + i, ...(i >= 6 ? { cond: 'proj_garden_lanterns_4' } : {}) })),
      { id: 'pond', x: 17, y: 6, label: 'Estanque', action: 'fish:lake' },
      { id: 'merge', x: 13, y: 9, label: 'Banco de macetas', action: 'minigame:merge' },
      // opposite banks of the koi pond, not the middle of the bridge
      { id: 'koi_fish1', x: 26, y: 18, label: 'Pescar', action: 'fish:lake' },
      { id: 'koi_fish2', x: 35, y: 16, label: 'Pescar', action: 'fish:lake' },
    ],
    rooms: [],
    gather: [
      { x: 15, y: 9, pool: ['fl_tulip', 'sakura'] },
      { x: 19, y: 14, pool: ['fl_sun', 'fl_daisy'] },
      { x: 5, y: 16, pool: ['sakura', 'fl_tulip'] },
      { x: 20, y: 8, pool: ['fl_lily'] },
      { x: 23, y: 17, pool: ['sakura', 'fl_tulip'] },
      { x: 33, y: 12, pool: ['fl_sun', 'fl_daisy'] },
      { x: 12, y: 23, pool: ['sakura', 'fl_tulip'] },
    ],
    fishing: 'lake',
    bugs: true,
  });
}

// ================================================================== STATION
function station(): ZoneDef {
  const b = new Builder(24, 26, 'G');
  b.rect(0, 9, 24, 4, 'p');
  b.rect(9, 13, 3, 9, 'p').rect(0, 22, 24, 2, 'R').rect(2, 16, 5, 3, 'p'); // depot yard and a siding
  b.rect(2, 4, 18, 4, 'S');
  b.rect(0, 2, 24, 2, 'R');
  b.prop('bld_station', 4, 4).prop('tree_dark', 1, 13).prop('tree_dark', 21, 14).prop('bigrock', 20, 5).prop('bush', 22, 6)
    .prop('sign', 15, 9).prop('crate', 3, 8).prop('barrel', 13, 8).prop('lamppost', 18, 8);
  b.prop('bld_cabin', 14, 15).prop('crate', 3, 17).prop('crate', 4, 17).prop('barrel', 6, 18).prop('sack', 2, 18).prop('lamppost', 8, 14).prop('lamppost', 12, 20)
    .prop('tree_dark', 1, 15).prop('tree_dark', 21, 17).prop('pine', 18, 21).prop('pine', 22, 13).prop('tree_dark', 4, 24).prop('tree_dark', 20, 24).prop('bush', 7, 21)
    .prop('bush', 12, 15).prop('rock', 13, 23).prop('bigrock', 2, 21).prop('reeds', 16, 19).prop('mushroom', 5, 20).prop('flowers_lav', 10, 22).prop('stonelantern', 8, 17);
  return zone(b, {
    id: 'station', name: 'Estación Abandonada', music: 'mystery', outdoor: true,
    doors: [
      { x: 23, y: 10, to: 'plaza', tx: 1, ty: 12, dir: 'right', walk: true },
      { x: 23, y: 11, to: 'plaza', tx: 1, ty: 13, dir: 'right', walk: true },
    ],
    interact: [
      { id: 'st_office', x: 8, y: 7, label: 'Boletería', action: 'story:station_office' },
      { id: 'st_clock', x: 11, y: 7, label: 'Reloj detenido', action: 'puzzle:clock' },
      { id: 'st_bench', x: 15, y: 9, label: 'Cartel', action: 'story:station_sign' },
      { id: 'st_crate', x: 3, y: 9, label: 'Cajón', action: 'story:station_crate' },
    ],
    rooms: [],
    gather: [{ x: 19, y: 13, pool: ['wood', 'stone', 'st_amethyst'] }, { x: 6, y: 15, pool: ['fl_camellia', 'stone'] }],
    bugs: true,
  });
}

// ================================================================== NIGHT MARKET
function market(): ZoneDef {
  const b = new Builder(40, 18, 'c');
  b.rect(0, 0, 40, 2, 'G');
  b.rect(11, 16, 4, 2, 'p');
  treeBorder(b, [[12, 17], [13, 17]], ['sakura', 'tree_dark']);
  b.prop('stall_night', 3, 4).prop('stall_gold', 9, 4).prop('stall_rose', 15, 4).prop('stall_sage', 20, 4)
    .prop('stall_night', 4, 11).prop('stall_gold', 18, 11)
    .prop('torii_w6', 10, 16)
    .prop('lantern_red', 2, 7).prop('lantern_red', 7, 7).prop('lantern_cream', 13, 7).prop('lantern_red', 19, 7).prop('lantern_cream', 24, 7)
    .prop('lantern_cream', 9, 13).prop('lantern_red', 16, 13).prop('bench', 11, 10)
    .prop('lamppost', 1, 5).prop('lamppost', 24, 5).prop('lamppost', 1, 12).prop('lamppost', 24, 12)
    .prop('bush_flower', 1, 8).prop('bush', 24, 9).prop('bush_berry', 2, 14).prop('bush_flower', 23, 14)
    .prop('pot_rose', 8, 9).prop('pot_cream', 17, 9).prop('lanternstring', 3, 9).prop('lanternstring', 19, 9)
    .prop('crate', 7, 12).prop('barrel', 22, 12).prop('vending_red', 14, 12);
  // the market runs on to the east: more stalls, a second row of lanterns and a small tea corner
  b.prop('jc_market_blue', 27, 4).prop('jc_market_red', 32, 4).prop('stall_gold', 37, 4).prop('stall_night', 28, 11).prop('stall_rose', 34, 11)
    .prop('lantern_red', 26, 7).prop('lantern_cream', 31, 7).prop('lantern_red', 36, 7).prop('lantern_cream', 27, 13).prop('lantern_red', 33, 13).prop('lantern_cream', 38, 13)
    .prop('lamppost', 26, 5).prop('lamppost', 38, 7).prop('lamppost', 26, 12).prop('lamppost', 38, 12)
    .prop('bench', 31, 10).prop('pot_rose', 30, 9).prop('pot_cream', 36, 9).prop('crate', 29, 15).prop('barrel', 36, 15).prop('bamboo', 38, 15).prop('bamboo', 25, 15)
    .prop('lanternstring', 28, 9).prop('lanternstring', 33, 9).prop('bush_flower', 38, 3).prop('bush', 25, 3).prop('sakura', 39, 9).prop('sakura', 25, 9);
  return zone(b, {
    id: 'market', name: 'Mercado Nocturno', music: 'market', outdoor: true,
    doors: [
      { x: 12, y: 17, to: 'plaza', tx: 63, ty: 1, dir: 'down', walk: true },
      { x: 13, y: 17, to: 'plaza', tx: 64, ty: 1, dir: 'down', walk: true },
    ],
    interact: [
      { id: 'mk_food', x: 4, y: 5, label: 'Puesto de dulces', action: 'shop:market_food' },
      { id: 'mk_rare', x: 10, y: 5, label: 'Objetos raros', action: 'shop:market_rare' },
      { id: 'mk_clothes', x: 16, y: 5, label: 'Ropa de luna', action: 'shop:market_clothes' },
      { id: 'mk_furn', x: 21, y: 5, label: 'Decoración nocturna', action: 'shop:market_furn' },
      { id: 'mk_game', x: 5, y: 12, label: 'Juego de memoria', action: 'minigame:memory' },
      { id: 'mk_fortune', x: 19, y: 12, label: 'Adivina estelar', action: 'fortune' },
    ],
    rooms: [],
    gather: [],
  });
}

// ================================================================== LIGHTHOUSE (interior)
function lighthouse(): ZoneDef {
  const b = new Builder(13, 12, '#');
  b.room(0, 0, 13, 12, [6]);
  b.set(6, 11, 'm');
  b.rect(1, 2, 11, 9, 'f');
  return zone(b, {
    id: 'lighthouse', name: 'Faro de las Tres Estrellas', music: 'stars', outdoor: false,
    doors: [{ x: 6, y: 11, to: 'beach', tx: 3, ty: 5, dir: 'down', walk: true }],
    interact: [{ id: 'mechanism', x: 6, y: 3, label: 'Mecanismo', action: 'story:mechanism' }],
    props: [
      { id: 'mechanism', x: 5, y: 2 },
      { id: 'wallshelf', x: 2, y: 1 }, { id: 'wallshelf', x: 9, y: 1 },
      { id: 'lantern_cream', x: 1, y: 2 }, { id: 'lantern_cream', x: 11, y: 2 },
      { id: 'andon', x: 2, y: 4 }, { id: 'andon', x: 10, y: 4 },
      { id: 'stars', x: 1, y: 5 }, { id: 'stars', x: 10, y: 5 },
      { id: 'library_shelf', x: 1, y: 6 }, { id: 'library_shelf', x: 9, y: 6 },
      { id: 'crate', x: 1, y: 8 }, { id: 'crate', x: 2, y: 8 }, { id: 'crate', x: 10, y: 8 }, { id: 'barrel', x: 11, y: 8 },
      { id: 'sack', x: 1, y: 9 }, { id: 'stonelantern', x: 2, y: 9 }, { id: 'stonelantern', x: 10, y: 9 }, { id: 'barrel', x: 11, y: 9 },
      { id: 'stars', x: 5, y: 7, cond: 'story_done' },
    ],
    rooms: [{ id: 'lighthouse_room', name: 'Faro', x: 0, y: 0, w: 13, h: 12, defWall: 'night', defFloor: 'stone' }],
    gather: [],
    gloom: true,
  });
}

// ================================================================== REGISTERED WORLD ZONES
export const ZONES: Record<string, ZoneDef> = {};
for (const z of [plaza(), shopYuki(), shopTaro(), shopBento(), restaurant(), library(), home(), storage(), beach(), forest(), garden(), station(), market(), lighthouse(), ...houseZones()]) ZONES[z.id] = z;

/** Wooden signposts next to each exit, so every place says where it leads. */
const SIGNPOSTS: Record<string, [string, number, number][]> = {
  plaza: [['sign_forest', 17, 3], ['sign_garden', 28, 11], ['sign_station', 2, 10], ['sign_market', 26, 2]],
  beach: [['sign_plaza_up', 16, 2], ['sign_lighthouse', 5, 6]],
  forest: [['sign_plaza_down', 16, 21]],
  garden: [['sign_plaza_left', 1, 8]],
  station: [['sign_plaza_right', 20, 8]],
  market: [['sign_plaza_down', 14, 15]],
};
for (const [zid, list] of Object.entries(SIGNPOSTS)) for (const [id, x, y] of list) ZONES[zid]?.props.push({ id, x, y });
installVillageWorld(ZONES, GARDEN_PLOT_POSITIONS);

export const ZONE_LIST = Object.keys(ZONES);
