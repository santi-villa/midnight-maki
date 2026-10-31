/**
 * Villa Nori: the village centre, grown into a river town. The old plaza (x 0-31, y 0-25) keeps its coordinates so every
 * quest, shop sign and routine still lines up; the new land lies east (river, cherry bank, shrine hill) and south (lanes, harbour).
 * Exits that are still closed are shut by visible obstacles (props with a `!flag` condition) and open when the flag is set.
 */
import { Builder, RESTAURANT_ENTRY, treeBorder, zone } from './zoneKit';
import type { DoorDef, InteractDef, ZoneDef } from './zones';
import { houseDoorDef, houseEntrancePaths, housePropId, housesIn } from './houses';
import { REN_STALL } from './neighbors';
import { EAST, buildEastTerrain } from './plazaEast';

export const PLAZA_SIZE = { w: EAST.W, h: 44 } as const;
export function plaza(): ZoneDef {
  const { w: W, h: H } = PLAZA_SIZE;
  const b = new Builder(W, H, 'g');

  // ---------------------------------------------------------------- streets (old centre keeps its layout)
  // A smaller civic square leaves green edges between the shops instead of one huge stone apron.
  b.rect(11, 8, 10, 9, 'c');
  b.rect(9, 11, 14, 3, 'c');
  b.rect(15, 7, 2, 12, 'c');
  b.rect(3, 7, 7, 2, 'c'); // to the restaurant
  b.rect(15, 0, 2, 7, 'p'); // north
  b.rect(15, 19, 2, 24, 'p'); // south, all the way down to the harbour lanes and the beach
  b.rect(0, 12, 9, 2, 'p'); // west
  b.rect(23, 7, 8, 1, 'p');
  b.rect(25, 7, 2, 5, 'c');
  b.rect(4, 19, 2, 1, 'c');
  b.rect(4, 13, 2, 3, 'p');
  b.rect(10, 19, 3, 2, 'c');
  b.rect(5, 20, 23, 2, 'p'); // daily shopping loop: Bento -> Taro, with the library just below
  b.rect(26, 13, 2, 8, 'c'); // Taro's forecourt links directly to the river crossing
  b.rect(9, 9, 2, 1, 'r').rect(21, 9, 2, 1, 'y').rect(9, 16, 2, 1, 'l').rect(21, 16, 2, 1, 'r');
  b.rect(8, 25, 8, 1, 'p'); // library step
  // lanes of the harbour quarter
  b.rect(0, 30, 36, 3, 'c');
  b.rect(0, 39, 30, 3, 'c');
  // ---------------------------------------------------------------- the east: river, mill, hill, grove and coast (see plazaEast.ts)
  buildEastTerrain(b);

  // ---------------------------------------------------------------- trees around the edges, with exits kept narrow
  treeBorder(b, [[15, 0], [16, 0], [EAST.market.x, 0], [EAST.market.x + 1, 0], [15, 43], [16, 43], [EAST.garden.x, 12], [EAST.garden.x, 13], [0, 12], [0, 13]]);
  const wall = (id: string, ...at: [number, number][]) => at.forEach(([x, y]) => b.prop(id, x, y));
  // flanks of the five exits, so a closed path cannot be walked around
  wall('pine', [14, 0], [14, 1], [17, 0], [17, 1]); // forest
  wall('pine', [EAST.market.x - 1, 0], [EAST.market.x - 1, 1], [EAST.market.x + 2, 0], [EAST.market.x + 2, 1]); // market
  wall('rock', [0, 11], [1, 11], [0, 14], [1, 14]); // station
  wall('pine', [14, 43], [14, 42], [17, 43], [17, 42]); // beach

  // ---------------------------------------------------------------- obstacles: each one disappears when its flag is set
  b.prop('block_logs', 15, 1, '!unlock_forest');
  b.prop('block_rope', EAST.market.x, 1, '!market_open');
  b.prop('block_gate_iron', 1, 12, '!unlock_station').prop('block_gate_iron', 1, 13, '!unlock_station');
  b.prop('block_gate_wood', EAST.garden.x - 1, 12, '!unlock_garden').prop('block_gate_wood', EAST.garden.x - 1, 13, '!unlock_garden');
  b.prop('block_works', 15, 42, '!unlock_beach');
  b.prop('sawhorse', 13, 42, '!unlock_beach').prop('sawhorse', 18, 42, '!unlock_beach');

  // ---------------------------------------------------------------- the old centre
  b.prop('bld_restaurant_s0', 2, 4, 'stage=0')
    .prop('bld_restaurant_s1', 2, 4, 'stage=1')
    .prop('bld_restaurant_s2', 2, 4, 'stage=2')
    .prop('bld_restaurant_s3', 2, 4, 'stage=3')
    .prop('sake_barrel', 1, 6, 'stage>=2')
    .prop('sake_barrel', 1, 5, 'stage>=2')
    .prop('bamboo', 1, 8, 'stage>=3')
    .prop('bamboo', 1, 7, 'stage>=3')
    .prop('flowers', 6, 6, 'stage>=1')
    // All shop doors retain their original tiles; Bento and Taro use the new frontage kit.
    .prop('bld_clothes', 22, 4)
    .prop('bld_store', 23, 16)
    .prop('bld_bakery', 4, 16)
    .prop('bld_library', 8, 22)
    .prop('fountain', 14, 11)
    .prop('board', 11, 7)
    .prop('mailbox', 9, 5)
    .prop('bench', 12, 14)
    .prop('bench', 18, 14)
    // two benches on the north side of the fountain, facing it
    .prop('bench', 14, 9)
    .prop('bench', 16, 9)
    // shop fronts: bread and a pot by the bakery, sacks and crates by the grocer, plants by the clothes shop and the library
    .prop('crate', 7, 19).prop('sack', 8, 19).prop('pot_cream', 9, 19)
    .prop('sack', 24, 19).prop('crate', 25, 19)
    .prop('pot_rose', 21, 6).prop('pot_cream', 28, 6)
    .prop('library_books', 9, 25).prop('library_books', 10, 25)
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
    .prop('flowers', 6, 10)
    .prop('flowers_lav', 18, 21)
    .prop('stall_wood', REN_STALL.x, REN_STALL.y).prop('deco_woodpile', REN_STALL.x + 3, REN_STALL.y)
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

  // ---------------------------------------------------------------- the east's fixed pieces (the rest is plain data in plazaEast.ts)
  b.prop('village_bridge', 38, 12).prop('village_bridge_e', 56, 30).prop('village_bridge_n', 46, 16);
  b.prop('torii_w4', EAST.market.x - 1, 2).prop('shrine', EAST.shrine.x, EAST.shrine.y);
  for (const [x, y0, y1] of [[EAST.stairsA, 7, 9], [EAST.stairsB, 7, 9], [EAST.stairsB, 14, 15]] as const) for (let y = y0; y <= y1; y++) b.prop('stonestairs', x, y).prop('stonestairs', x + 1, y);
  b.prop('sign_riverside', 33, 10);

  // ---------------------------------------------------------------- side-entrance houses
  for (const h of housesIn('plaza')) b.prop(housePropId(h), h.x, h.y);
  houseEntrancePaths(b, 'plaza');
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

  // ---------------------------------------------------------------- harbour: the old bay, its piers and the west quays
  b.prop('village_pier_e', 30, 39).prop('village_pier_n', 36, 35);
  b.prop('village_net', 30, 37);
  b.prop('crate', 30, 38).prop('barrel', 31, 38).prop('crate', 35, 35).prop('barrel', 35, 34).prop('sack', 29, 40).prop('lantern_cream', 36, 34).prop('lantern_cream', 37, 34);
  wall('lamppost', [32, 38]);
  b.prop('sign_harbor', 17, 24).prop('sign_beach', 13, 40);
  for (const y of [34, 38]) b.prop('puddle', 20 + y / 2, y, 'rain');

  const doors: DoorDef[] = [
    { x: 26, y: 6, to: 'shop_yuki', tx: 9, ty: 6, dir: 'up', walk: true, label: 'Ropa de Yuki' },
    { x: 27, y: 18, to: 'shop_taro', tx: 9, ty: 6, dir: 'up', walk: true, label: 'Almacén de Taro' },
    { x: 5, y: 18, to: 'shop_bento', tx: 9, ty: 6, dir: 'up', walk: true, label: 'Panadería' },
    { x: 11, y: 24, to: 'library', tx: 6, ty: 7, dir: 'up', walk: true, label: 'Biblioteca' },
    { x: 5, y: 6, to: RESTAURANT_ENTRY.zone, tx: RESTAURANT_ENTRY.x, ty: RESTAURANT_ENTRY.y, dir: RESTAURANT_ENTRY.dir, walk: true, label: 'Midnight Maki' },
    { x: 15, y: 0, to: 'forest', tx: 14, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Un montón de troncos caídos tapa el sendero. Kiki dice que todavía hay que despejarlo.' } },
    { x: 16, y: 0, to: 'forest', tx: 15, ty: 22, dir: 'up', walk: true, lock: { flag: 'unlock_forest', msg: 'Un montón de troncos caídos tapa el sendero. Kiki dice que todavía hay que despejarlo.' } },
    { x: 15, y: 43, to: 'beach', tx: 14, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Una valla de obras cierra el camino a la playa. Nami lo está arreglando: ¡pronto!' } },
    { x: 16, y: 43, to: 'beach', tx: 15, ty: 1, dir: 'down', walk: true, lock: { flag: 'unlock_beach', msg: 'Una valla de obras cierra el camino a la playa. Nami lo está arreglando: ¡pronto!' } },
    { x: EAST.garden.x, y: 12, to: 'garden', tx: 1, ty: 10, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado con una soga. Momo tiene la llave.' } },
    { x: EAST.garden.x, y: 13, to: 'garden', tx: 1, ty: 11, dir: 'right', walk: true, lock: { flag: 'unlock_garden', msg: 'El portón del jardín está cerrado con una soga. Momo tiene la llave.' } },
    { x: 0, y: 12, to: 'station', tx: 22, ty: 10, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un portón oxidado, cubierto de enredaderas: "Estación clausurada". Tiene un candado viejo.' } },
    { x: 0, y: 13, to: 'station', tx: 22, ty: 11, dir: 'left', walk: true, lock: { flag: 'unlock_station', msg: 'Un portón oxidado, cubierto de enredaderas: "Estación clausurada". Tiene un candado viejo.' } },
    { x: EAST.market.x, y: 0, to: 'market', tx: 12, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'Una soga de bambú cierra el torii. Dicen que algunas noches aparece un mercado del otro lado.' } },
    { x: EAST.market.x + 1, y: 0, to: 'market', tx: 13, ty: 16, dir: 'up', walk: true, lock: { flag: 'market_open', msg: 'Una soga de bambú cierra el torii. Dicen que algunas noches aparece un mercado del otro lado.' } },
    ...housesIn('plaza').map(houseDoorDef),
  ];

  const interact: InteractDef[] = [
    { id: 'board', x: 11, y: 8, label: 'Cartelera', action: 'board' },
    { id: 'board2', x: 12, y: 8, label: 'Cartelera', action: 'board' },
    { id: 'mailbox', x: 9, y: 6, label: 'Buzón', action: 'mail' },
    { id: 'fountain', x: 15, y: 13, label: 'Fuente', action: 'fountain' },
    { id: 'sign', x: 4, y: 7, label: 'Cartel del restaurante', action: 'story:sign', cond: '!sign_restored' },
    { id: 'ren_stall', x: REN_STALL.x + 1, y: REN_STALL.y + 1, label: 'Carpintería de Ren', action: 'shop:ren' },
    { id: 'sumi_stall', x: 20, y: 20, label: 'Puesto de Sumi', action: 'shop:sumi' },
    // obstacles
    { id: 'blk_forest', x: 15, y: 1, label: 'Troncos caídos', action: 'blocked:forest', cond: '!unlock_forest' },
    { id: 'blk_forest2', x: 16, y: 1, label: 'Troncos caídos', action: 'blocked:forest', cond: '!unlock_forest' },
    { id: 'blk_beach', x: 15, y: 42, label: 'Valla de obras', action: 'blocked:beach', cond: '!unlock_beach' },
    { id: 'blk_beach2', x: 16, y: 42, label: 'Valla de obras', action: 'blocked:beach', cond: '!unlock_beach' },
    { id: 'blk_garden', x: EAST.garden.x - 1, y: 12, label: 'Portón cerrado', action: 'blocked:garden', cond: '!unlock_garden' },
    { id: 'blk_garden2', x: EAST.garden.x - 1, y: 13, label: 'Portón cerrado', action: 'blocked:garden', cond: '!unlock_garden' },
    { id: 'blk_station', x: 1, y: 12, label: 'Portón oxidado', action: 'blocked:station', cond: '!unlock_station' },
    { id: 'blk_station2', x: 1, y: 13, label: 'Portón oxidado', action: 'blocked:station', cond: '!unlock_station' },
    { id: 'blk_market', x: EAST.market.x, y: 1, label: 'Soga del torii', action: 'blocked:market', cond: '!market_open' },
    { id: 'blk_market2', x: EAST.market.x + 1, y: 1, label: 'Soga del torii', action: 'blocked:market', cond: '!market_open' },
    // places
    { id: 'shrine', x: EAST.shrine.x + 1, y: EAST.shrine.y + 1, label: 'Santuario', action: 'note:shrine' },
    // the bridge by the mill, the peninsula channel, both harbour piers, and the cherry pond
    { id: 'river_fish1', x: 40, y: 11, label: 'Pescar', action: 'fish:lake' },
    { id: 'river_fish2', x: 48, y: 19, label: 'Pescar', action: 'fish:lake' },
    { id: 'pier_fish1', x: 35, y: 40, label: 'Pescar', action: 'fish:sea' },
    { id: 'pier_fish2', x: 35, y: 36, label: 'Pescar', action: 'fish:sea' },
    { id: 'grove_fish', x: 67, y: 26, label: 'Pescar', action: 'fish:lake' },
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
      { x: 6, y: 23, pool: ['wood', 'stone', 'fl_daisy'] },
      { x: 44, y: 20, pool: ['fl_tulip', 'sakura'] },
      { x: 57, y: 1, pool: ['sakura', 'fl_daisy'] },
      { x: 10, y: 33, pool: ['fl_daisy', 'fl_bell'] },
      { x: 27, y: 35, pool: ['berry', 'wood'] },
      { x: 55, y: 36, pool: ['sh_scallop', 'st_seaglass'] },
      { x: 34, y: 14, pool: ['fl_bell', 'fl_daisy'] },
    ],
    fishing: 'lake',
    bugs: true,
  });
}
