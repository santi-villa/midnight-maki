/** Authored study 02: a civic square, private plots and streets that connect their actual door positions. */
import { PROPS } from './props';
import { exteriorsWanted } from '../art/exteriors';
import { buildingLayout } from '../art/nature';
import { villageShopLayout } from '../art/village';
import { restaurantFacadeLayout } from '../art/restaurantFacade';
import { homeLayout } from '../art/homes';

export type Point = [number, number];
export interface Plot { id: string; x: number; y: number; w: number; h: number; door: Point; gate: Point; hedge?: boolean; building: { x: number; y: number; w: number; h: number }; }
export interface WaterArea { points: Point[]; }
export const W = 104, H = 80;
export const plaza = { x: 46, y: 31, w: 18, h: 13 };

export const coastPoints: Point[] = [[0, 55], [5, 58], [13, 62], [22, 63], [29, 61], [35, 58], [44, 60], [54, 61.5], [67, 60], [78, 58], [88, 59.5], [96, 57], [104, 55]];
export function shoreAt(x: number) {
  const i = Math.max(0, coastPoints.findIndex((p, n) => n < coastPoints.length - 1 && x >= p[0] && x <= coastPoints[n + 1][0]));
  const a = coastPoints[i], b = coastPoints[i + 1];
  const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0]))), smooth = t * t * (3 - 2 * t);
  return a[1] + (b[1] - a[1]) * smooth + Math.sin(x * 1.8) * .08;
}
export function createVillageTerrain() {
  const grid: string[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => y <= Math.ceil(shoreAt(x + .5)) ? 'g' : '~'));
  const placements: { id: string; x: number; y: number }[] = [];
  const plots: Plot[] = [];
  const waterAreas: WaterArea[] = [];
  const rails: { x: number; y: number; span: number; axis: 'h' | 'v' }[] = [];
  const crops: Point[] = [];
  const prop = (id: string, x: number, y: number) => placements.push({ id, x, y });
  function rect(x: number, y: number, w: number, h: number, ch: string, landOnly = false) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (grid[j]?.[i] !== undefined && (!landOnly || !'w~b'.includes(grid[j][i]))) grid[j][i] = ch;
  }
  function path(points: Point[], width = 2, ch = 'p') {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      let previousY = a[1];
      for (let s = 0; s <= steps; s++) {
        const t = steps ? s / steps : 0;
        const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t);
        if (width === 1) rect(x, previousY, 1, Math.abs(y - previousY) + 1, ch, ch !== 'b');
        rect(x, y, width, width, ch, ch !== 'b'); previousY = y;
      }
    }
  }
  function water(points: Point[]) {
    waterAreas.push({ points });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a[1] > y + .5) !== (b[1] > y + .5) && x + .5 < (b[0] - a[0]) * (y + .5 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside && grid[y][x] !== '~') grid[y][x] = 'w';
    }
  }
  function river(nodes: Point[], radius: number, start = 0, end = 63) {
    const centre = (y: number) => {
      const i = Math.max(0, nodes.findIndex((n, i) => i < nodes.length - 1 && y >= n[1] && y <= nodes[i + 1][1]));
      const a = nodes[i], b = nodes[i + 1], t = Math.max(0, Math.min(1, (y - a[1]) / (b[1] - a[1])));
      return a[0] + (b[0] - a[0]) * (t * t * (3 - 2 * t));
    };
    const left: Point[] = [], right: Point[] = [];
    for (let y = start; y <= end; y += .25) { const mid = centre(y), r = radius + Math.sin(y * .25) * .25; left.push([mid - r, y]); right.push([mid + r, y]); }
    const cap: Point[] = [];
    if (start > 0) for (let angle = 0; angle >= -Math.PI; angle -= Math.PI / 12) cap.push([centre(start) + radius * Math.cos(angle), start + radius * Math.sin(angle)]);
    water([...left, ...right.reverse(), ...cap]);
  }
  function bridge(x: number, y: number, w: number, h = 3) {
    rect(x, y, w, h, 'b'); rails.push({ x, y, span: w, axis: 'h' });
  }
  function doorOf(id: string, x: number, y: number): Point {
    const d = PROPS[id], base = (y + d.h) * 16 - d.sh;
    let dx: number, dy: number;
    if (id.startsWith('bld_restaurant')) { const r = restaurantFacadeLayout(d.sw, d.sh, d.stage ?? 0).door; dx = r.x + r.w / 2; dy = r.y + r.h; }
    else if (d.kind === 'townhouse' || d.kind === 'sidehouse') { const r = homeLayout(d.sw, d.sh, d.variant ?? 0, d.kind === 'sidehouse').door; dx = r.x + r.w / 2; dy = r.y + r.h; }
    else { const r = (d.variant ?? 0) >= 20 ? villageShopLayout(d.sw, d.sh, d.variant!) : buildingLayout(d.sw, d.sh); dx = r.dx + r.doorW / 2; dy = r.doorY + r.doorH; }
    return [Math.floor(x + dx / 16), Math.floor((base + dy) / 16)];
  }
  function house(id: string, x: number, y: number, bounds: [number, number, number, number], gate: Point, join: Point, hedge = true) {
    const [px, py, w, h] = bounds, d = PROPS[id], door = doorOf(id, x, y);
    rect(px, py, w, h, 'g', true);
    rect(x, y + d.h - 1, d.w, 2, 'c', true); // contact stones and an apron belong to this frontage only
    path([door, [door[0], gate[1]], gate, join], 1);
    plots.push({ id, x: px, y: py, w, h, door, gate, hedge, building: { x, y: y + d.h - d.sh / 16, w: d.sw / 16, h: d.sh / 16 } });
    prop(id, x, y);
    // Short returns define the plot; openings and front paths stay visibly clear.
    for (let xx = px; xx < px + w; xx++) if (Math.abs(xx - gate[0]) > 1 && !'pcb'.includes(grid[py + h - 1]?.[xx] ?? '')) prop(hedge ? 'bush' : 'fence', xx, py + h - 1);
    prop('flowers', px + 1, py + h - 3);
    prop('bush_flower', px + w - 2, py + h - 3);
  }

  // A beach cut into a curved coastline, with a wooded scarp above the sand.
  for (let x = 0; x < 31; x++) {
    const scarp = 46 + Math.round(Math.sin(x * .16) * 1.4);
    rect(x, scarp, 1, 2, 'C');
    for (let y = scarp + 2; y <= Math.ceil(shoreAt(x + .5)); y++) grid[y][x] = 's';
  }
  // Curving channels make the town's centre and residential district distinct pieces of land.
  river([[35, 0], [34, 10], [33, 19], [36, 27], [33, 37], [34, 47], [32, 56], [35, 63]], 1.8);
  river([[74, 23], [76, 28], [75, 35], [78, 42], [80, 48], [88, 53], [94, 59], [95, 63]], 2.0, 23, 63);
  water([[6, 10], [9, 8.7], [13, 9.5], [15, 12], [13, 15], [9, 15.8], [5, 14], [4.5, 11.5]]);
  water([[9, 39], [12, 37.7], [15, 38.5], [17, 40.7], [14, 43.3], [10, 43], [8, 41]]);

  // A rocky, rounded terrace for the shrine. The rise is crossed by one short stair.
  for (let x = 39; x <= 66; x++) {
    const edge = 18 + Math.round(Math.sqrt(Math.max(0, 1 - ((x - 53) / 14) ** 2)) * 4);
    rect(x, 2, 1, edge - 2, 'G'); rect(x, edge, 1, 2, 'C');
  }
  path([[53, 11], [53, 27]], 3);
  rect(53, 21, 3, 4, 'c'); for (let y = 21; y < 25; y++) for (let x = 53; x < 56; x++) prop('stonestairs', x, y);
  rect(72, 4, 32, 14, 'G');
  for (let x = 72; x < W; x++) rect(x, 18 + Math.round(Math.sin(x * .13)), 1, 2, 'C');
  rect(73, 13, 31, 3, 'S'); rect(72, 15, 32, 1, 'R');
  path([[90, 17], [90, 25]], 2); for (let y = 18; y < 21; y++) for (let x = 90; x < 92; x++) prop('stonestairs', x, y);

  // Public streets, then the plaza. There is no blanket of paving under the surrounding houses.
  path([[18, 3], [18, 22], [21, 25], [21, 43], [22, 48], [22, 54]], 2);
  path([[18, 23], [38, 23], [43, 28], [54, 28]], 2); bridge(31, 23, 9);
  path([[21, 38], [43, 38], [46, 38]], 3); bridge(29, 38, 10);
  path([[23, 53], [42, 53], [45, 52]], 2); bridge(29, 53, 11);
  path([[43, 28], [66, 28]], 2); // ends at the ring road, not in the river
  path([[44, 29], [44, 46], [46, 56], [63, 56], [66, 46], [66, 29]], 2);
  path([[64, 37], [83, 37], [90, 37]], 3); bridge(72, 37, 9);
  path([[90, 24], [90, 49], [98, 49], [98, 53]], 2);
  path([[79, 36], [102, 36]], 2); path([[80, 47], [101, 47]], 2);
  path([[67, 42], [69, 49], [70, 57], [74, 60]], 2);
  path([[52, 56], [52, 62]], 3);
  rect(plaza.x, plaza.y, plaza.w, plaza.h, 'c', true);
  // Clearly bounded public square: fountain, planting beds and seating belong here.
  if (exteriorsWanted()) {
    // Modern Exteriors: raised planters on the paving instead of flat beds (pigeons come as a flock, see data/flocks.ts).
    prop('planter_pink', 48, 34); prop('planter_white', 60, 34);
    prop('planter_red', 48, 41); prop('planter_pink', 60, 41);
  } else {
    rect(48, 33, 2, 2, 'r'); rect(60, 33, 2, 2, 'y');
    rect(48, 40, 2, 2, 'l'); rect(60, 40, 2, 2, 'r');
  }
  prop('fountain', 53, 36);
  prop('bench', 50, 37); prop('bench', 58, 37);
  prop('bench', 52, 41); prop('board', 47, 31);
  for (const [x, y] of [[50, 32], [58, 32], [50, 42], [58, 42]]) prop('street_lamp_l', x, y);

  // Shops stand on their own small front gardens. All paths begin at the actual texture's doorway.
  house('bld_bakery', 43, 26, [41, 21, 10, 9], [47, 29], [48, 31]);
  house('bld_clothes', 63, 26, [61, 21, 11, 9], [65, 29], [63, 31]);
  house('bld_library', 36, 34, [35, 30, 10, 12], [43, 41], [46, 41]);
  house('bld_store', 66, 32, [65, 29, 9, 9], [68, 37], [64, 38]);
  house('bld_restaurant_s2', 49, 49, [46, 44, 18, 13], [53, 56], [52, 58]);
  prop('sakura', 47, 46); prop('sakura', 61, 47);
  prop('mailbox', 47, 54); prop('pot_cream', 48, 53); prop('pot_rose', 57, 53);
  // Restaurant terrace is an outdoor room attached to its frontage, inside its garden.
  rect(58, 51, 5, 4, 'b'); rails.push({ x: 58, y: 55, span: 5, axis: 'h' });
  prop('project_teatable', 59, 52); prop('project_teagames', 59, 54);
  prop('jc_shop_display', 69, 38); prop('vending_blue', 72, 40);

  // Four residential plots, arranged around streets and gates instead of directly on the civic paving.
  house('bld_th_home_l', 82, 30, [80, 26, 10, 11], [87, 36], [90, 36], false);
  house('bld_sh_home_r', 95, 30, [93, 26, 10, 11], [94, 36], [91, 36], false);
  house('bld_th_home_r', 82, 41, [80, 39, 10, 10], [87, 48], [90, 49], false);
  house('bld_sh_home_l', 95, 41, [93, 39, 10, 10], [94, 48], [91, 49], false);
  // Streets run outside the private boundaries and remain continuous around the restaurant block.
  path([[44, 41], [44, 58], [66, 58], [66, 41], [63, 41]], 2);
  path([[64, 38], [72, 38]], 2);
  path([[79, 37], [102, 37]], 2);
  path([[39, 24], [39, 30], [46, 30], [46, 31]], 2);
  prop('sakura', 101, 35); prop('bench', 89, 39);

  // Compact garden rooms: pond, cultivation, florist and separate walks.
  path([[5, 30], [21, 30]], 2); path([[5, 30], [5, 44], [20, 44]], 2);
  rect(6, 32, 7, 4, 'o'); rect(24, 41, 5, 4, 'o');
  for (const [x, y] of [[7, 33], [10, 33], [7, 35], [10, 35], [25, 42], [27, 44]]) crops.push([x, y]);
  for (let x = 6; x < 13; x++) prop('fence', x, 36);
  house('bld_th_flower_l', 24, 29, [22, 25, 8, 10], [23, 34], [21, 34]);
  prop('well', 7, 28); prop('farm_hay', 14, 34); prop('farm_crate', 28, 37);
  prop('bench', 12, 44); prop('sakura', 4, 43); prop('sakura', 28, 44);
  for (const [x, y] of [[7, 38], [16, 42], [18, 40], [8, 44], [26, 35], [12, 29]]) prop('flowers', x, y);

  // Sanctuary, old station and a forest cabin retain their own forecourts.
  rect(48, 10, 11, 7, 'c'); prop('bld_house', 50, 8); prop('shrine', 54, 13); prop('torii_w6', 51, 17);
  for (const [x, y] of [[48, 13], [59, 13], [50, 18], [58, 18]]) prop('stonelantern', x, y);
  for (const [x, y] of [[44, 9], [47, 6], [58, 6], [62, 9], [45, 15], [62, 15]]) prop('sakura', x, y);
  prop('bld_station', 82, 9); prop('block_vines', 90, 16); prop('crate', 94, 11); prop('barrel', 95, 11);
  if (exteriorsWanted()) {
    // Modern Exteriors: the waiting bench where the 'sit' spot already was, luggage and a trolley on the back row of the
    // platform (the front row stays a clear walk), and two potted trees flanking the building.
    prop('station_bench', 90, 13); prop('station_suitcase', 78, 13); prop('station_baggage', 79, 13);
    prop('station_trolley', 100, 13); prop('station_plant', 81, 11); prop('station_plant', 90, 11);
  }
  house('bld_cabin', 7, 20, [5, 17, 10, 8], [13, 24], [18, 24], false);
  prop('waterfall', 32, 4); prop('stump', 23, 18); prop('bigrock', 5, 8);

  // Forest edges and wooded banks form coherent groves, leaving paths, plots and ponds visible.
  function treeAllowed(x: number, y: number) {
    if (grid[y]?.[x] !== 'g' && grid[y]?.[x] !== 'G') return false;
    if (plots.some(p => x >= p.x - 1 && x <= p.x + p.w && y >= p.y - 1 && y <= p.y + p.h)) return false;
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if ('pcb'.includes(grid[yy]?.[xx] ?? '')) return false;
    return true;
  }
  for (let y = 1; y < 47; y += 2) for (let x = 0; x < 32; x += 2) {
    const seed = (x * 13 + y * 37) % 17;
    const xx = x + seed % 2, yy = y + (seed % 3 === 0 ? 1 : 0);
    const forest = yy < 26, fringe = xx < 3 || xx > 29 || yy > 44;
    if ((forest || fringe) && seed > (forest ? 2 : 5) && treeAllowed(xx, yy)) prop(seed % 4 === 0 ? 'pine' : seed % 3 ? 'tree_dark' : 'tree', xx, yy);
  }
  for (let x = 38; x < W; x += 2) for (const y of [2, 5]) if (treeAllowed(x, y)) prop(x % 3 ? 'tree_dark' : 'pine', x, y);
  for (let y = 9; y < 27; y += 3) for (const x of [39, 65, 68, 71, 102]) if (treeAllowed(x, y)) prop(x % 2 ? 'pine' : 'tree_dark', x, y);
  for (const [x, y] of [[39, 28], [37, 44], [42, 46], [73, 43], [77, 24], [99, 23], [80, 49], [72, 52]]) if (treeAllowed(x, y)) prop('tree', x, y);

  // A quiet crescent beach below the garden; everything stays comfortably above the foam line.
  rect(21, 46, 3, 3, 's'); for (let y = 46; y < 49; y++) for (let x = 21; x < 24; x++) prop('stonestairs', x, y);
  prop('beach_umbrella_blue', 10, 53); prop('beach_towel_sky', 11, 54);
  prop('boat_rope', 27, 56); prop('bigrock', 3, 57); prop('beach_grass', 5, 50);
  prop('bench', 24, 49);
  if (exteriorsWanted()) {
    // Modern Exteriors: a second shade below the pier walk, castles on the wet sand, and the sea's own landmarks offshore.
    // Shell spots, the stalls, the sunset view and the fishing spots stay clear.
    prop('beach_umbrella_green', 29, 60); prop('beach_towel_lilac', 27, 60);
    prop('sandcastle_wide', 13, 59); prop('sandcastle_tower', 16, 60);
    prop('beach_grass', 1, 50); prop('beach_grass', 28, 52); prop('beach_grass', 19, 49);
    prop('sea_rock_big', 2, 68); prop('sea_rock_tall', 25, 67); prop('sea_rock_small', 12, 66); prop('sea_rock_arch', 28, 72);
    prop('buoy', 10, 70); prop('buoy_orange', 18, 69); prop('buoy_red', 6, 74);
  }

  // The night market is one street: six stalls side by side along the north edge (one per stall interaction in
  // villageWorld.ts), the aisle in front of them, garlands over it and a lantern at each end.
  rect(44, 59, 25, 4, 'p', true); rect(45, 62, 29, 3, 'b');
  prop('jc_market_blue', 45, 60); prop('stall_gold', 49, 60); prop('stall_night', 52, 60);
  prop('stall_sage', 55, 60); prop('jc_market_red', 58, 60); prop('stall_rose', 62, 60);
  prop('lanternstring', 47, 62); prop('lanternstring', 57, 62); prop('lantern_red', 44, 62); prop('lantern_cream', 66, 62);
  // Segmented wharves, two moorings and a separate lighthouse promontory.
  rect(55, 65, 36, 5, 'b'); rect(55, 69, 3, 8, 'b'); rect(69, 69, 3, 7, 'b'); rect(83, 69, 3, 6, 'b');
  bridge(89, 67, 9, 2);
  rect(95, 64, 8, 8, 'g'); rect(95, 71, 8, 1, 'C');
  prop('bld_sh_fish_l', 74, 63); prop('village_fish_crate', 60, 67); prop('barrel', 79, 67);
  prop('lighthouse', 98, 67); prop('boat', 59, 74); prop('boat_rope', 74, 73); prop('boat', 87, 72);
  rails.push({ x: 57, y: 69, span: 32, axis: 'h' });
  if (exteriorsWanted()) {
    // Modern Exteriors: carts between the market stalls, cargo and benches against the south rail.
    // The aisle, the stall counters, both pier mouths and the house doors stay open.
    prop('wharf_flower_cart', 65, 60); prop('wharf_candy_cart', 41, 60);
    prop('wharf_flower_box', 44, 68); prop('wharf_barrel', 52, 68); prop('wharf_barrel', 53, 68);
    prop('wharf_flower_box', 60, 68); prop('wharf_bench', 64, 68);
    prop('wharf_boxes', 75, 68); prop('wharf_box', 77, 68); prop('wharf_barrel', 78, 68);
    prop('wharf_bench', 86, 68);
  }
  // lanterns stand at the rail on both sides of each pier's mouth and by the lighthouse door, never mid-deck
  for (const [x, y] of [[54, 68], [58, 68], [68, 68], [72, 68], [82, 68], [97, 75]]) prop('lantern_cream', x, y);
  // River walk remains on the residential bank, with a bridge to the wharf.
  path([[90, 49], [100, 49], [100, 52]], 2);
  rect(94, 52, 3, 13, 'b'); path([[94, 64], [90, 65]], 2, 'b');
  prop('bench', 93, 49); prop('bench', 100, 51); prop('sakura', 101, 48);

  const zones = [
    { n: 1, name: 'Centro del pueblo', x: 55, y: 29, focus: [55, 37] },
    { n: 2, name: 'Barrio residencial', x: 91, y: 24, focus: [91, 37] },
    { n: 3, name: 'Puerto', x: 74, y: 75, focus: [73, 69] },
    { n: 4, name: 'Playa', x: 17, y: 59, focus: [17, 54] },
    { n: 5, name: 'Bosque', x: 15, y: 6, focus: [15, 15] },
    { n: 6, name: 'Jardín', x: 15, y: 27, focus: [16, 37] },
    { n: 7, name: 'Mercado nocturno', x: 55, y: 62, focus: [55, 62] },
    { n: 8, name: 'Estación abandonada', x: 87, y: 4, focus: [87, 12] },
    { n: 9, name: 'Ribera del río', x: 93, y: 54, focus: [92, 51] },
    { n: 10, name: 'Colina del santuario', x: 54, y: 1, focus: [54, 13] },
  ];
  return { grid, placements, plots, waterAreas, rails, crops, zones };
}
