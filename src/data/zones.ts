/**
 * Zone (map) definitions. Maps are built with small drawing helpers instead of hand-typed grids,
 * which keeps them easy to edit. Coordinates are tiles.
 */
import type { Dir } from '../core/types';

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
  dark?: boolean; // always dim (station, lighthouse inside)
  walls?: string; // wall style outside decor rooms
  floor?: string; // floor style outside decor rooms
}

// ------------------------------------------------------------------ builder
class Builder {
  g: string[][];
  props: PropPlace[] = [];
  constructor(public w: number, public h: number, fill: string) {
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.g[j] && i >= 0 && i < this.w) this.g[j][i] = ch;
    return this;
  }
  set(x: number, y: number, ch: string) {
    if (this.g[y] && x >= 0 && x < this.w) this.g[y][x] = ch;
    return this;
  }
  prop(id: string, x: number, y: number, cond?: string) {
    this.props.push({ id, x, y, cond });
    return this;
  }
  /** interior box: walltop border, wall face row with windows */
  room(x: number, y: number, w: number, h: number, windows: number[] = []) {
    this.rect(x, y, w, h, '#');
    this.rect(x + 1, y, w - 2, 1, 'U');
    this.rect(x + 1, y + 1, w - 2, 1, 'W');
    for (const wx of windows) this.set(x + wx, y + 1, 'V');
    this.rect(x + 1, y + 2, w - 2, h - 3, 'f');
    return this;
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}

function zone(b: Builder, z: Omit<ZoneDef, 'w' | 'h' | 'ground' | 'props'> & { props?: PropPlace[] }): ZoneDef {
  return { ...z, w: b.w, h: b.h, ground: b.rows(), props: [...b.props, ...(z.props ?? [])] };
}

function treeBorder(b: Builder, gaps: [number, number][], kinds = ['tree', 'tree_dark', 'pine']) {
  let k = 0;
  const near = (x: number, y: number) => gaps.some(([gx, gy]) => Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1);
  // trees only grow on grass (never in water, sand or paths)
  const gap = (x: number, y: number) => near(x, y) || !'gG'.includes(b.g[y]?.[x] ?? 'x');
  for (let x = 0; x < b.w; x += 2) {
    if (!gap(x, 0)) b.prop(kinds[k++ % kinds.length], x, 0);
    if (!gap(x, b.h - 1)) b.prop(kinds[k++ % kinds.length], x, b.h - 1);
  }
  for (let y = 2; y < b.h - 1; y += 2) {
    if (!gap(0, y)) b.prop(kinds[k++ % kinds.length], 0, y);
    if (!gap(b.w - 1, y)) b.prop(kinds[k++ % kinds.length], b.w - 1, y);
  }
}

// ================================================================== PLAZA
function plaza(): ZoneDef {
  const b = new Builder(32, 26, 'g');
  b.rect(9, 7, 14, 12, 'c'); // square
  b.rect(3, 7, 7, 2, 'c'); // to restaurant
  b.rect(15, 0, 2, 7, 'p'); // north
  b.rect(15, 19, 2, 7, 'p'); // south
  b.rect(23, 12, 9, 2, 'p'); // east
  b.rect(0, 12, 9, 2, 'p'); // west
  b.rect(29, 0, 2, 7, 'p'); // market path
  b.rect(23, 7, 8, 1, 'p');
  b.rect(25, 7, 2, 5, 'c');
  b.rect(4, 19, 2, 1, 'c');
  b.rect(4, 13, 2, 3, 'p');
  b.rect(10, 19, 3, 2, 'c');
  b.rect(9, 9, 2, 1, 'r').rect(21, 9, 2, 1, 'y').rect(9, 16, 2, 1, 'l').rect(21, 16, 2, 1, 'r');
  treeBorder(b, [[15, 0], [16, 0], [29, 0], [30, 0], [15, 25], [16, 25], [31, 12], [31, 13], [0, 12], [0, 13]]);
  b.prop('bld_restaurant', 2, 4)
    .prop('bld_clothes', 23, 4)
    .prop('bld_store', 24, 16)
    .prop('bld_bakery', 2, 16)
    .prop('bld_library', 8, 22)
    .prop('fountain', 14, 11)
    .prop('board', 11, 7)
    .prop('mailbox', 9, 5)
    .prop('bench', 12, 14)
    .prop('bench', 18, 14)
    .prop('lamppost', 9, 8)
    .prop('lamppost', 22, 8)
    .prop('lamppost', 9, 18)
    .prop('lamppost', 22, 18)
    .prop('sakura', 13, 8)
    .prop('sakura', 19, 8)
    .prop('tree', 5, 11)
    .prop('tree', 27, 21)
    .prop('bush_flower', 2, 9)
    .prop('bush', 8, 4)
    .prop('bush_berry', 20, 22)
    .prop('lantern_red', 3, 8)
    .prop('lantern_red', 8, 8)
    .prop('torii', 28, 3)
    .prop('flowers', 6, 10)
    .prop('flowers_lav', 18, 21)
    .prop('crate', 30, 15)
    .prop('barrel', 22, 20)
    .prop('pot_rose', 3, 7)
    .prop('pot_cream', 7, 7)
    .prop('menuboard', 8, 7)
    .prop('awning_rose', 25, 5)
    .prop('awning_sage', 26, 17)
    .prop('vending_blue', 23, 18)
    .prop('vending_red', 30, 18)
    .prop('bicycle', 10, 5)
    .prop('bicycle_rose', 20, 23)
    .prop('lanternstring', 14, 2)
    .prop('lanternstring', 14, 20)
    .prop('poster_a', 2, 18)
    .prop('poster_b', 7, 18)
    .prop('pot_rose', 8, 23)
    .prop('puddle', 12, 10, 'rain')
    .prop('puddle', 19, 12, 'rain')
    .prop('puddle', 6, 13, 'rain')
    .prop('puddle', 16, 17, 'rain');
  return zone(b, {
    id: 'plaza', name: 'Plaza de Villa Nori', music: 'town', outdoor: true,
    doors: [
      { x: 26, y: 6, to: 'shop_yuki', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Ropa de Yuki' },
      { x: 27, y: 18, to: 'shop_taro', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Almacén de Taro' },
      { x: 5, y: 18, to: 'shop_bento', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Panadería' },
      { x: 5, y: 6, to: 'restaurant', tx: 8, ty: 12, dir: 'up', walk: true, label: 'Midnight Maki' },
      { x: 15, y: 0, to: 'forest', tx: 14, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Kiki dice que el sendero al bosque todavía está lleno de ramas.' } },
      { x: 16, y: 0, to: 'forest', tx: 15, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Kiki dice que el sendero al bosque todavía está lleno de ramas.' } },
      { x: 15, y: 25, to: 'beach', tx: 14, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Nami está arreglando el camino a la playa. ¡Pronto!' } },
      { x: 16, y: 25, to: 'beach', tx: 15, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Nami está arreglando el camino a la playa. ¡Pronto!' } },
      { x: 31, y: 12, to: 'garden', tx: 1, ty: 10, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado. Momo tiene la llave.' } },
      { x: 31, y: 13, to: 'garden', tx: 1, ty: 11, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado. Momo tiene la llave.' } },
      { x: 0, y: 12, to: 'station', tx: 22, ty: 10, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un cartel viejo: "Estación clausurada". El camino está tapado por enredaderas.' } },
      { x: 0, y: 13, to: 'station', tx: 22, ty: 11, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un cartel viejo: "Estación clausurada". El camino está tapado por enredaderas.' } },
      { x: 29, y: 0, to: 'market', tx: 12, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'El torii está en silencio. Dicen que algunas noches aparece un mercado del otro lado.' } },
      { x: 30, y: 0, to: 'market', tx: 13, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'El torii está en silencio. Dicen que algunas noches aparece un mercado del otro lado.' } },
    ],
    interact: [
      { id: 'library', x: 11, y: 24, label: 'Biblioteca', action: 'library' },
      { id: 'board', x: 11, y: 8, label: 'Cartelera', action: 'board' },
      { id: 'board2', x: 12, y: 8, label: 'Cartelera', action: 'board' },
      { id: 'mailbox', x: 9, y: 6, label: 'Buzón', action: 'mail' },
      { id: 'fountain', x: 15, y: 13, label: 'Fuente', action: 'fountain' },
      { id: 'sign', x: 4, y: 7, label: 'Cartel del restaurante', action: 'story:sign', cond: '!sign_restored' },
      { id: 'mika_stall', x: 20, y: 20, label: 'Puesto de Mika', action: 'shop:mika' },
    ],
    rooms: [],
    gather: [
      { x: 3, y: 10, pool: ['fl_daisy', 'fl_tulip'] },
      { x: 28, y: 9, pool: ['fl_daisy', 'fl_sun'] },
      { x: 20, y: 23, pool: ['berry', 'fl_bell'] },
      { x: 7, y: 20, pool: ['wood', 'stone', 'fl_daisy'] },
    ],
    bugs: true,
  });
}

// ================================================================== RESTAURANT
function restaurant(): ZoneDef {
  // izakaya / sushi bar: tall dark walls (noren band on top), bar behind a sushi counter, tatami corner
  const b = new Builder(18, 14, '#');
  b.room(0, 0, 18, 14, [11, 14]);
  b.rect(1, 0, 16, 1, 'U');
  b.rect(1, 2, 6, 4, 'k');
  b.rect(12, 9, 5, 4, 't');
  b.set(8, 13, 'm').set(9, 13, 'm');
  // fixed kitchen props are furniture-like props
  b.prop('k_fridge', 1, 2).prop('k_stove', 2, 2).prop('k_sink', 3, 2).prop('k_rice', 4, 2).prop('k_board', 5, 2)
    .prop('k_counter', 1, 5).prop('k_counter', 2, 5).prop('k_counter', 3, 5).prop('k_counter', 4, 5)
    .prop('k_register', 7, 4).prop('k_register2', 8, 4)
    .prop('bar_stool', 1, 6).prop('bar_stool', 2, 6).prop('bar_stool', 3, 6).prop('bar_stool', 4, 6)
    .prop('stairs', 16, 2)
    .prop('door_storage', 13, 1, '!storage_open')
    .prop('door_storage_open', 13, 1, 'storage_open')
    .prop('wallshelf', 1, 1)
    .prop('wallshelf', 3, 1)
    .prop('mm_sign', 6, 1)
    .prop('wall_lantern_red', 5, 1)
    .prop('wall_lantern_cream', 12, 1)
    .prop('wall_lantern_red', 15, 1)
    .prop('sake_barrel', 1, 9)
    .prop('sake_barrel', 1, 10)
    .prop('barrel', 2, 10)
    .prop('bamboo', 1, 12)
    .prop('bamboo', 6, 12);
  return zone(b, {
    id: 'restaurant', name: 'Midnight Maki', music: 'restaurant', outdoor: false, walls: 'izakaya', floor: 'izakaya',
    doors: [
      { x: 8, y: 13, to: 'plaza', tx: 5, ty: 7, dir: 'down', walk: true },
      { x: 9, y: 13, to: 'plaza', tx: 5, ty: 7, dir: 'down', walk: true },
      { x: 16, y: 2, to: 'home', tx: 14, ty: 9, dir: 'up', walk: true, label: 'Arriba' },
      { x: 13, y: 2, to: 'storage', tx: 4, ty: 6, dir: 'up', walk: false, label: 'Depósito', lock: { flag: 'storage_open', msg: 'La puerta del depósito está cerrada con llave.' } },
    ],
    interact: [
      { id: 'cook', x: 5, y: 3, label: 'Cocinar', action: 'cook' },
      { id: 'cook2', x: 4, y: 3, label: 'Cocinar', action: 'cook' },
      { id: 'orders', x: 7, y: 5, label: 'Pedidos', action: 'orders' },
      { id: 'orders2', x: 8, y: 5, label: 'Pedidos', action: 'orders' },
      { id: 'fridge', x: 1, y: 3, label: 'Despensa', action: 'pantry' },
      { id: 'storage_door', x: 13, y: 2, label: 'Depósito', action: 'door:storage' },
    ],
    rooms: [{ id: 'dining', name: 'Salón', x: 7, y: 6, w: 10, h: 7, defWall: 'izakaya', defFloor: 'izakaya' }],
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
  const b = new Builder(30, 22, 's');
  b.rect(0, 0, 30, 3, 'g');
  b.rect(14, 0, 2, 4, 'p');
  b.rect(0, 15, 30, 1, 'h');
  b.rect(0, 16, 30, 6, 'w');
  b.rect(0, 19, 30, 3, 'd');
  b.rect(19, 12, 2, 8, 'b'); // pier
  b.rect(19, 15, 2, 1, 'b');
  treeBorder(b, [[14, 0], [15, 0]], ['tree', 'pine']);
  b.prop('stall_sage', 5, 7).prop('stall_rose', 9, 7).prop('boat', 23, 14)
    .prop('crate', 21, 11).prop('barrel', 18, 11).prop('lantern_cream', 18, 12).prop('lantern_cream', 21, 12)
    .prop('rock', 2, 12).prop('bigrock', 27, 10).prop('reeds', 1, 14).prop('reeds', 12, 14)
    .prop('bld_house', 24, 3).prop('lamppost', 13, 4).prop('lamppost', 17, 4)
    .prop('lighthouse', 2, 2, 'unlock_lighthouse_view')
    .prop('vending_red', 23, 5)
    .prop('bicycle', 20, 5)
    .prop('pot_cream', 29, 5)
    .prop('lanternstring', 4, 9)
    .prop('puddle', 12, 9, 'rain');
  return zone(b, {
    id: 'beach', name: 'Playa de las Conchas', music: 'beach', outdoor: true,
    doors: [
      { x: 14, y: 0, to: 'plaza', tx: 15, ty: 24, dir: 'up', walk: true },
      { x: 15, y: 0, to: 'plaza', tx: 16, ty: 24, dir: 'up', walk: true },
      { x: 3, y: 4, to: 'lighthouse', tx: 6, ty: 10, dir: 'up', walk: false, label: 'Faro', lock: { flag: 'lighthouse_open', msg: 'La puerta del faro tiene tres huecos con forma de estrella.' } },
    ],
    interact: [
      { id: 'fish1', x: 19, y: 19, label: 'Pescar', action: 'fish:sea' },
      { id: 'fish2', x: 20, y: 19, label: 'Pescar', action: 'fish:sea' },
      { id: 'fish3', x: 8, y: 14, label: 'Pescar', action: 'fish:sea' },
      { id: 'market_stall', x: 6, y: 8, label: 'Puesto de pescado', action: 'shop:nami' },
      { id: 'market_stall2', x: 10, y: 8, label: 'Puesto de conchas', action: 'shop:shells' },
      { id: 'lh_door', x: 3, y: 4, label: 'Faro', action: 'door:lighthouse', cond: 'unlock_lighthouse_view' },
      { id: 'sunset', x: 16, y: 13, label: 'Mirar el mar', action: 'sunset' },
    ],
    rooms: [],
    gather: [
      { x: 4, y: 13, pool: ['sh_scallop', 'sh_spiral', 'sh_cowrie', 'st_seaglass'] },
      { x: 10, y: 12, pool: ['sh_scallop', 'sh_pink', 'sh_cowrie'] },
      { x: 15, y: 14, pool: ['sh_spiral', 'sh_blue', 'st_seaglass'] },
      { x: 26, y: 13, pool: ['sh_scallop', 'sh_blue', 'sh_pearl', 'bottle_msg'] },
      { x: 7, y: 11, pool: ['sh_cowrie', 'st_seaglass'] },
      { x: 23, y: 9, pool: ['sh_spiral', 'sh_pink'] },
    ],
    fishing: 'sea',
    bugs: false,
  });
}

// ================================================================== FOREST
function forest(): ZoneDef {
  const b = new Builder(30, 24, 'G');
  b.rect(14, 16, 2, 8, 'p');
  b.rect(6, 12, 20, 2, 'p');
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
  return zone(b, {
    id: 'forest', name: 'Bosque Susurrante', music: 'forest', outdoor: true,
    doors: [
      { x: 14, y: 23, to: 'plaza', tx: 15, ty: 1, dir: 'down', walk: true },
      { x: 15, y: 23, to: 'plaza', tx: 16, ty: 1, dir: 'down', walk: true },
    ],
    interact: [
      { id: 'cabin', x: 4, y: 6, label: 'Cabaña', action: 'story:cabin' },
      { id: 'lake1', x: 21, y: 11, label: 'Pescar', action: 'fish:lake' },
      { id: 'lake2', x: 24, y: 11, label: 'Pescar', action: 'fish:lake' },
      { id: 'stump', x: 10, y: 12, label: 'Tocón tallado', action: 'puzzle:stump' },
      { id: 'kiki_path', x: 28, y: 20, label: 'Sendero oculto', action: 'secret:forest_path' },
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
    ],
    fishing: 'lake',
    bugs: true,
  });
}

// ================================================================== GARDEN
function garden(): ZoneDef {
  const b = new Builder(24, 18, 'g');
  b.rect(0, 10, 12, 2, 'p');
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
    .prop('pot_rose', 9, 8)
    .prop('lanternstring', 13, 16)
    .prop('puddle', 7, 11, 'rain');
  return zone(b, {
    id: 'garden', name: 'Jardín de los Faroles', music: 'garden', outdoor: true,
    doors: [
      { x: 0, y: 10, to: 'plaza', tx: 30, ty: 12, dir: 'left', walk: true },
      { x: 0, y: 11, to: 'plaza', tx: 30, ty: 13, dir: 'left', walk: true },
    ],
    interact: [
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: 'plot' + i, x: 3 + i, y: 4 + 0, label: 'Parcela', action: 'plot:' + i })),
      { id: 'pond', x: 17, y: 7, label: 'Estanque', action: 'fish:lake' },
      { id: 'merge', x: 13, y: 9, label: 'Banco de macetas', action: 'minigame:merge' },
    ],
    rooms: [],
    gather: [
      { x: 15, y: 11, pool: ['fl_tulip', 'sakura'] },
      { x: 19, y: 12, pool: ['fl_sun', 'fl_daisy'] },
      { x: 5, y: 16, pool: ['sakura', 'fl_tulip'] },
      { x: 20, y: 8, pool: ['fl_lily'] },
    ],
    fishing: 'lake',
    bugs: true,
  });
}

// ================================================================== STATION
function station(): ZoneDef {
  const b = new Builder(24, 16, 'G');
  b.rect(0, 9, 24, 4, 'p');
  b.rect(2, 4, 18, 4, 'S');
  b.rect(0, 2, 24, 2, 'R');
  b.prop('bld_station', 4, 4).prop('tree_dark', 1, 13).prop('tree_dark', 21, 14).prop('bigrock', 20, 5).prop('bush', 22, 6)
    .prop('sign', 15, 9).prop('crate', 3, 8).prop('barrel', 13, 8).prop('lamppost', 18, 8);
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
    gather: [{ x: 19, y: 13, pool: ['wood', 'stone', 'st_amethyst'] }, { x: 6, y: 13, pool: ['fl_camellia', 'stone'] }],
    bugs: true,
  });
}

// ================================================================== NIGHT MARKET
function market(): ZoneDef {
  const b = new Builder(26, 18, 'c');
  b.rect(0, 0, 26, 2, 'G');
  b.rect(11, 16, 4, 2, 'p');
  treeBorder(b, [[12, 17], [13, 17]], ['sakura', 'tree_dark']);
  b.prop('stall_night', 3, 4).prop('stall_gold', 9, 4).prop('stall_rose', 15, 4).prop('stall_sage', 20, 4)
    .prop('stall_night', 4, 11).prop('stall_gold', 18, 11)
    .prop('torii', 11, 16)
    .prop('lantern_red', 2, 7).prop('lantern_red', 7, 7).prop('lantern_cream', 13, 7).prop('lantern_red', 19, 7).prop('lantern_cream', 24, 7)
    .prop('lantern_cream', 9, 13).prop('lantern_red', 16, 13).prop('bench', 11, 10)
    .prop('lamppost', 1, 5).prop('lamppost', 24, 5).prop('lamppost', 1, 12).prop('lamppost', 24, 12)
    .prop('bush_flower', 1, 8).prop('bush', 24, 9).prop('bush_berry', 2, 14).prop('bush_flower', 23, 14)
    .prop('pot_rose', 8, 9).prop('pot_cream', 17, 9).prop('lanternstring', 3, 9).prop('lanternstring', 19, 9)
    .prop('crate', 7, 12).prop('barrel', 22, 12).prop('vending_red', 14, 12);
  return zone(b, {
    id: 'market', name: 'Mercado Nocturno', music: 'market', outdoor: true,
    doors: [
      { x: 12, y: 17, to: 'plaza', tx: 29, ty: 1, dir: 'down', walk: true },
      { x: 13, y: 17, to: 'plaza', tx: 30, ty: 1, dir: 'down', walk: true },
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
    props: [{ id: 'mechanism', x: 5, y: 2 }, { id: 'stars', x: 1, y: 5 }, { id: 'stars', x: 10, y: 5 }, { id: 'lantern_cream', x: 1, y: 2 }, { id: 'lantern_cream', x: 11, y: 2 }, { id: 'stonelantern', x: 2, y: 9 }, { id: 'stonelantern', x: 10, y: 9 }, { id: 'stars', x: 5, y: 7, cond: 'story_done' }],
    rooms: [{ id: 'lighthouse_room', name: 'Faro', x: 0, y: 0, w: 13, h: 12, defWall: 'night', defFloor: 'stone' }],
    gather: [],
    dark: true,
  });
}

// ================================================================== ARRIVAL (intro cutscene in plaza at night)
export const ZONES: Record<string, ZoneDef> = {};
for (const z of [plaza(), shopYuki(), shopTaro(), shopBento(), restaurant(), home(), storage(), beach(), forest(), garden(), station(), market(), lighthouse()]) ZONES[z.id] = z;

/** Wooden signposts next to each exit, so every place says where it leads. */
const SIGNPOSTS: Record<string, [string, number, number][]> = {
  plaza: [['sign_forest', 17, 3], ['sign_beach', 17, 23], ['sign_garden', 28, 11], ['sign_station', 2, 10], ['sign_market', 26, 2]],
  beach: [['sign_plaza_up', 16, 2], ['sign_lighthouse', 5, 6]],
  forest: [['sign_plaza_down', 16, 21]],
  garden: [['sign_plaza_left', 1, 8]],
  station: [['sign_plaza_right', 20, 8]],
  market: [['sign_plaza_down', 14, 15]],
};
for (const [zid, list] of Object.entries(SIGNPOSTS)) for (const [id, x, y] of list) ZONES[zid]?.props.push({ id, x, y });

export const ZONE_LIST = Object.keys(ZONES);
