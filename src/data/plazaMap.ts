/**
 * Villa Nori: the village centre, grown into a river town. The old plaza (x 0-31, y 0-25) keeps its coordinates so every
 * quest, shop sign and routine still lines up; the new land lies east (river, cherry bank, shrine hill) and south (lanes, harbour).
 * Exits that are still closed are shut by visible obstacles (props with a `!flag` condition) and open when the flag is set.
 */
import { Builder, RESTAURANT_ENTRY, treeBorder, zone } from './zoneKit';
import type { DoorDef, InteractDef, ZoneDef } from './zones';
import { houseDoorDef, housePropId, housesIn } from './houses';

export const PLAZA_SIZE = { w: 58, h: 44 } as const;
/** River centre column for each row (the water is 4 tiles wide: cx-2 .. cx+1). */
export const riverX = (y: number) => 40 + Math.round(2.2 * Math.sin(y / 5.5));
export const BRIDGE_ROWS = [[12, 13], [30, 32]] as const;

export function plaza(): ZoneDef {
  const { w: W, h: H } = PLAZA_SIZE;
  const b = new Builder(W, H, 'g');

  // ---------------------------------------------------------------- streets (old centre keeps its layout)
  b.rect(9, 7, 14, 12, 'c'); // square
  b.rect(3, 7, 7, 2, 'c'); // to the restaurant
  b.rect(15, 0, 2, 7, 'p'); // north
  b.rect(15, 19, 2, 24, 'p'); // south, all the way down to the harbour lanes and the beach
  b.rect(0, 12, 9, 2, 'p'); // west
  b.rect(23, 12, 35, 2, 'p'); // east: over the river to the garden
  b.rect(29, 0, 2, 7, 'p'); // market path
  b.rect(23, 7, 8, 1, 'p');
  b.rect(25, 7, 2, 5, 'c');
  b.rect(4, 19, 2, 1, 'c');
  b.rect(4, 13, 2, 3, 'p');
  b.rect(10, 19, 3, 2, 'c');
  b.rect(9, 9, 2, 1, 'r').rect(21, 9, 2, 1, 'y').rect(9, 16, 2, 1, 'l').rect(21, 16, 2, 1, 'r');
  b.rect(8, 25, 8, 1, 'p'); // library step
  // lanes of the harbour quarter
  b.rect(0, 30, 36, 3, 'c');
  b.rect(0, 39, 30, 3, 'c');
  b.rect(40, 30, 18, 3, 'c'); // promenade across the lower bridge
  // river bank promenade and the shrine stairs
  b.rect(43, 11, 2, 20, 'p');
  b.rect(47, 2, 2, 10, 'c');
  b.rect(43, 0, 15, 11, 'G');
  b.rect(47, 2, 2, 10, 'c');
  b.rect(46, 11, 4, 1, 'c');
    // flower beds beside the cherry bank
  b.rect(53, 15, 3, 1, 'y').rect(53, 17, 3, 1, 'l').rect(45, 24, 3, 1, 'r');

  // ---------------------------------------------------------------- river, bridges, bay
  for (let y = 0; y < H; y++) {
    const cx = riverX(y);
    for (let x = cx - 2; x <= cx + 1; x++) b.set(x, y, y >= 2 && (x === cx - 1 || x === cx) ? 'd' : 'w');
  }
  b.rect(33, 36, 15, 8, 'w').rect(35, 38, 11, 6, 'd');
  for (const [r0, r1] of BRIDGE_ROWS) for (let y = r0; y <= r1; y++) { const cx = riverX(y); for (let x = cx - 2; x <= cx + 1; x++) b.set(x, y, 'b'); }
  b.rect(30, 39, 7, 2, 'b').rect(36, 35, 2, 5, 'b'); // piers

  // ---------------------------------------------------------------- trees around the edges, with exits kept narrow
  treeBorder(b, [[15, 0], [16, 0], [29, 0], [30, 0], [15, 43], [16, 43], [57, 12], [57, 13], [0, 12], [0, 13]]);
  const wall = (id: string, ...at: [number, number][]) => at.forEach(([x, y]) => b.prop(id, x, y));
  // flanks of the five exits, so a closed path cannot be walked around
  wall('pine', [14, 0], [14, 1], [17, 0], [17, 1]); // forest
  wall('tree_dark', [28, 0], [28, 1], [31, 0], [31, 1]); // market
  wall('rock', [0, 11], [1, 11], [0, 14], [1, 14]); // station
  wall('stonelantern', [56, 11], [56, 14]);
  wall('bush_flower', [57, 11], [57, 14]); // garden
  wall('pine', [14, 43], [14, 42], [17, 43], [17, 42]); // beach

  // ---------------------------------------------------------------- obstacles: each one disappears when its flag is set
  b.prop('block_logs', 15, 1, '!unlock_forest');
  b.prop('block_rope', 29, 1, '!market_open');
  b.prop('block_gate_iron', 1, 12, '!unlock_station').prop('block_gate_iron', 1, 13, '!unlock_station');
  b.prop('block_gate_wood', 56, 12, '!unlock_garden').prop('block_gate_wood', 56, 13, '!unlock_garden');
  b.prop('block_works', 15, 42, '!unlock_beach');
  b.prop('sawhorse', 13, 42, '!unlock_beach').prop('sawhorse', 18, 42, '!unlock_beach');

  // ---------------------------------------------------------------- the old centre
  b.prop('bld_restaurant_s0', 2, 4, 'stage=0')
    .prop('bld_restaurant_s1', 2, 4, 'stage=1')
    .prop('bld_restaurant_s2', 2, 4, 'stage=2')
    .prop('bld_restaurant_s3', 2, 4, 'stage=3')
    .prop('sake_barrel', 1, 6, 'stage>=2')
    .prop('sake_barrel', 1, 5, 'stage>=2')
    .prop('bamboo', 8, 5, 'stage>=3')
    .prop('bamboo', 1, 7, 'stage>=3')
    .prop('flowers', 6, 6, 'stage>=1')
    // the three shops now have their door on the side, at the same tile as before
    .prop('bld_th_clothes_r', 22, 4)
    .prop('bld_th_store_r', 23, 16)
    .prop('bld_th_bakery_l', 4, 16)
    .prop('bld_library', 8, 22)
    .prop('fountain', 14, 11)
    .prop('board', 11, 7)
    .prop('mailbox', 9, 5)
    .prop('bench', 12, 14)
    .prop('bench', 18, 14)
    .prop('lamppost', 9, 8)
    .prop('lamppost', 22, 8)
    .prop('lamppost', 10, 19)
    .prop('lamppost', 22, 18)
    .prop('sakura', 13, 8)
    .prop('sakura', 19, 8)
    .prop('tree', 5, 11)
    .prop('tree', 27, 21)
    .prop('bush_flower', 2, 9)
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
    .prop('vending_blue', 22, 19)
    .prop('vending_red', 30, 18)
    .prop('bicycle', 10, 5)
    .prop('bicycle_rose', 20, 23)
    .prop('lanternstring', 14, 4)
    .prop('lanternstring', 14, 20)
    .prop('puddle', 12, 10, 'rain')
    .prop('puddle', 19, 12, 'rain')
    .prop('puddle', 6, 13, 'rain')
    .prop('puddle', 16, 17, 'rain');

  // ---------------------------------------------------------------- east of the plaza, down to the river
  wall('tree', [33, 3], [35, 5], [32, 9], [34, 16], [33, 20], [35, 22]);
  wall('bush_flower', [32, 15], [34, 18], [33, 23]);
  wall('bush', [35, 9], [32, 19]);
  wall('lamppost', [33, 11], [33, 14], [39, 11], [44, 14]);
  b.prop('bench', 31, 16).prop('flowers_lav', 34, 20).prop('flowers', 32, 21).prop('pot_cream', 33, 17);
  b.prop('sign_riverside', 33, 10);
  // reeds along both banks
  for (const y of [4, 8, 17, 21, 25, 33]) { const cx = riverX(y); b.prop('reeds', cx - 3, y).prop('reeds', cx + 2, y + 1); }

  // ---------------------------------------------------------------- cherry bank (east of the river)
  wall('sakura', [45, 9], [52, 14], [55, 17], [45, 27], [52, 25], [56, 25], [46, 22], [54, 27], [49, 25]);
  b.prop('bench', 44, 16).prop('bench', 44, 23).prop('bench', 53, 12 + 3 + 0);
  b.prop('stonelantern', 45, 14).prop('stonelantern', 45, 20).prop('stonelantern', 45, 26);
  b.prop('lantern_cream', 43, 17).prop('lantern_cream', 43, 24).prop('lantern_red', 49, 14);
  b.prop('flowers', 52, 16).prop('flowers_lav', 53, 19).prop('flowers', 47, 23).prop('flowers_lav', 55, 26).prop('pot_rose', 49, 19).prop('pot_cream', 46, 19);
  b.prop('bush_flower', 54, 24).prop('bush_flower', 56, 20).prop('bush', 56, 24).prop('bush', 48, 27);

  // ---------------------------------------------------------------- shrine hill
  b.prop('torii', 46, 3).prop('shrine', 47, 1);
  wall('stonelantern', [45, 5], [50, 5], [45, 8], [50, 8]);
  wall('sakura', [44, 2], [52, 2], [54, 5], [44, 6], [53, 9], [55, 3]);
  wall('pine', [56, 1], [44, 10], [56, 7]);
  b.prop('flowers_lav', 51, 3).prop('flowers', 51, 8).prop('flowers', 44, 4).prop('bush_flower', 54, 8);
  b.prop('sign_shrine', 45, 10);

  // ---------------------------------------------------------------- side-entrance houses
  for (const h of housesIn('plaza')) b.prop(housePropId(h), h.x, h.y);
  // lane details
  for (const x of [6, 13, 19, 25, 34]) b.prop('lamppost', x, 30);
  for (const x of [4, 12, 21, 27]) b.prop('lamppost', x, 39);
  wall('lantern_red', [3, 33], [10, 33], [19, 33], [26, 33], [33, 33], [6, 41], [20, 41], [27, 41]);
  b.prop('bench', 5, 34).prop('bench', 22, 34).prop('pot_rose', 7, 34).prop('pot_cream', 17, 34).prop('flowers', 11, 34).prop('flowers_lav', 26, 34).prop('flowers', 3, 35);
  b.prop('bicycle', 20, 34).prop('bicycle_rose', 29, 34).prop('pot_rose', 14, 30).prop('pot_cream', 17, 30);
  b.prop('bush_flower', 12, 35).prop('bush', 6, 35).prop('bush_berry', 31, 35).prop('tree', 33, 34).prop('sakura', 13, 34).prop('sakura', 31, 33);
  b.prop('lanternstring', 8, 30).prop('lanternstring', 16, 30);
  // the library forecourt: no house here, so its door stays in view
  b.prop('bench', 6, 26).prop('flowers_lav', 3, 25).prop('pot_cream', 13, 25).prop('bush_flower', 1, 24).prop('bush', 14, 27);

  // ---------------------------------------------------------------- harbour: bay, piers, boats, stalls
  b.prop('boat', 43, 40).prop('boat', 34, 42).prop('boat', 38, 38);
  b.prop('crate', 30, 38).prop('barrel', 31, 38).prop('crate', 35, 35).prop('barrel', 35, 34).prop('sack', 29, 40).prop('lantern_cream', 36, 34).prop('lantern_cream', 37, 34);
  b.prop('stall_rose', 44, 34).prop('stall_sage', 49, 34).prop('crate', 48, 33).prop('barrel', 53, 34).prop('sack', 47, 34).prop('lantern_red', 44, 33).prop('lantern_red', 52, 33);
  wall('tree', [51, 37], [54, 38], [56, 41], [50, 41]);
  wall('bush_flower', [52, 35], [55, 37]);
  wall('bush', [49, 40], [55, 40]);
  wall('lamppost', [40, 29], [47, 33], [54, 29], [32, 38]);
  b.prop('sign_harbor', 17, 24).prop('sign_beach', 13, 40);
  b.prop('bench', 41, 33).prop('flowers', 50, 38).prop('flowers_lav', 53, 39);
  for (const y of [34, 38]) b.prop('puddle', 20 + y / 2, y, 'rain');

  const doors: DoorDef[] = [
    { x: 26, y: 6, to: 'shop_yuki', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Ropa de Yuki' },
    { x: 27, y: 18, to: 'shop_taro', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Almacén de Taro' },
    { x: 5, y: 18, to: 'shop_bento', tx: 5, ty: 6, dir: 'up', walk: true, label: 'Panadería' },
    { x: 11, y: 24, to: 'library', tx: 6, ty: 7, dir: 'up', walk: true, label: 'Biblioteca' },
    { x: 5, y: 6, to: RESTAURANT_ENTRY.zone, tx: RESTAURANT_ENTRY.x, ty: RESTAURANT_ENTRY.y, dir: RESTAURANT_ENTRY.dir, walk: true, label: 'Midnight Maki' },
    { x: 15, y: 0, to: 'forest', tx: 14, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Un montón de troncos caídos tapa el sendero. Kiki dice que todavía hay que despejarlo.' } },
    { x: 16, y: 0, to: 'forest', tx: 15, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Un montón de troncos caídos tapa el sendero. Kiki dice que todavía hay que despejarlo.' } },
    { x: 15, y: 43, to: 'beach', tx: 14, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Una valla de obras cierra el camino a la playa. Nami lo está arreglando: ¡pronto!' } },
    { x: 16, y: 43, to: 'beach', tx: 15, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Una valla de obras cierra el camino a la playa. Nami lo está arreglando: ¡pronto!' } },
    { x: 57, y: 12, to: 'garden', tx: 1, ty: 10, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado con una soga. Momo tiene la llave.' } },
    { x: 57, y: 13, to: 'garden', tx: 1, ty: 11, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado con una soga. Momo tiene la llave.' } },
    { x: 0, y: 12, to: 'station', tx: 22, ty: 10, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un portón oxidado, cubierto de enredaderas: "Estación clausurada". Tiene un candado viejo.' } },
    { x: 0, y: 13, to: 'station', tx: 22, ty: 11, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un portón oxidado, cubierto de enredaderas: "Estación clausurada". Tiene un candado viejo.' } },
    { x: 29, y: 0, to: 'market', tx: 12, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'Una soga de bambú cierra el torii. Dicen que algunas noches aparece un mercado del otro lado.' } },
    { x: 30, y: 0, to: 'market', tx: 13, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'Una soga de bambú cierra el torii. Dicen que algunas noches aparece un mercado del otro lado.' } },
    ...housesIn('plaza').map(houseDoorDef),
  ];

  const interact: InteractDef[] = [
    { id: 'board', x: 11, y: 8, label: 'Cartelera', action: 'board' },
    { id: 'board2', x: 12, y: 8, label: 'Cartelera', action: 'board' },
    { id: 'mailbox', x: 9, y: 6, label: 'Buzón', action: 'mail' },
    { id: 'fountain', x: 15, y: 13, label: 'Fuente', action: 'fountain' },
    { id: 'sign', x: 4, y: 7, label: 'Cartel del restaurante', action: 'story:sign', cond: '!sign_restored' },
    { id: 'sumi_stall', x: 20, y: 20, label: 'Puesto de Sumi', action: 'shop:sumi' },
    // obstacles
    { id: 'blk_forest', x: 15, y: 1, label: 'Troncos caídos', action: 'blocked:forest', cond: '!unlock_forest' },
    { id: 'blk_forest2', x: 16, y: 1, label: 'Troncos caídos', action: 'blocked:forest', cond: '!unlock_forest' },
    { id: 'blk_beach', x: 15, y: 42, label: 'Valla de obras', action: 'blocked:beach', cond: '!unlock_beach' },
    { id: 'blk_beach2', x: 16, y: 42, label: 'Valla de obras', action: 'blocked:beach', cond: '!unlock_beach' },
    { id: 'blk_garden', x: 56, y: 12, label: 'Portón cerrado', action: 'blocked:garden', cond: '!unlock_garden' },
    { id: 'blk_garden2', x: 56, y: 13, label: 'Portón cerrado', action: 'blocked:garden', cond: '!unlock_garden' },
    { id: 'blk_station', x: 1, y: 12, label: 'Portón oxidado', action: 'blocked:station', cond: '!unlock_station' },
    { id: 'blk_station2', x: 1, y: 13, label: 'Portón oxidado', action: 'blocked:station', cond: '!unlock_station' },
    { id: 'blk_market', x: 29, y: 1, label: 'Soga del torii', action: 'blocked:market', cond: '!market_open' },
    { id: 'blk_market2', x: 30, y: 1, label: 'Soga del torii', action: 'blocked:market', cond: '!market_open' },
    // places
    { id: 'shrine', x: 47, y: 1, label: 'Santuario', action: 'note:shrine' },
    { id: 'river_fish1', x: 36, y: 20, label: 'Pescar', action: 'fish:lake' },
    { id: 'river_fish2', x: 43, y: 20, label: 'Pescar', action: 'fish:lake' },
    { id: 'pier_fish1', x: 35, y: 40, label: 'Pescar', action: 'fish:sea' },
    { id: 'pier_fish2', x: 36, y: 40, label: 'Pescar', action: 'fish:sea' },
  ];
  return zone(b, {
    id: 'plaza', name: 'Villa Nori', music: 'town', outdoor: true,
    doors,
    interact,
    rooms: [],
    gather: [
      { x: 3, y: 10, pool: ['fl_daisy', 'fl_tulip'] },
      { x: 28, y: 9, pool: ['fl_daisy', 'fl_sun'] },
      { x: 20, y: 23, pool: ['berry', 'fl_bell'] },
      { x: 7, y: 20, pool: ['wood', 'stone', 'fl_daisy'] },
      { x: 46, y: 21, pool: ['fl_tulip', 'sakura'] },
      { x: 54, y: 10, pool: ['sakura', 'fl_daisy'] },
      { x: 10, y: 33, pool: ['fl_daisy', 'fl_bell'] },
      { x: 28, y: 35, pool: ['berry', 'wood'] },
      { x: 52, y: 39, pool: ['sh_scallop', 'st_seaglass'] },
      { x: 34, y: 14, pool: ['fl_bell', 'fl_daisy'] },
    ],
    fishing: 'lake',
    bugs: true,
  });
}
