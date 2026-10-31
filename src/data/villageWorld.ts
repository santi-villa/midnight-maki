/** The approved map, authored once in world coordinates and split at real district boundaries. */
import type { DoorDef, InteractDef, PropPlace, ZoneDef } from './zones';
import { createVillageTerrain, plaza as civicSquare, shoreAt } from './villageTerrain';
import { VILLAGE_BOUNDS, villageSpot, type VillageZone } from './villageGeography';
import { HOUSES, houseDoorDef, houseDoorTile, housePropId } from './houses';
import { PROPS } from './props';
import { PROJECT_AMENITIES, PROJECT_PROPS, PROJECTS, PROJECT_GATHER } from './projects';
import { RESTAURANT_ENTRY } from './zoneKit';
import { exteriorsWanted } from '../art/exteriors';

export const VILLAGE_SQUARE = civicSquare;
export const VILLAGE_WIDTH = 120, VILLAGE_HEIGHT = 80;
export const VILLAGE_LOCKS: Partial<Record<VillageZone, { flag: string; msg: string }>> = {
  forest: { flag: 'unlock_forest', msg: 'Los troncos cierran el sendero del bosque. Kiki puede ayudar a despejarlo.' },
  garden: { flag: 'unlock_garden', msg: 'El jardín sigue cerrado. Momo tiene la llave.' },
  beach: { flag: 'unlock_beach', msg: 'Nami está terminando el acceso a la playa.' },
  station: { flag: 'unlock_station', msg: 'El portón de la estación tiene un candado viejo.' },
  market: { flag: 'unlock_beach', msg: 'Nami está terminando el acceso al paseo del puerto.' },
  harbor: { flag: 'unlock_beach', msg: 'Nami está terminando el acceso al puerto.' },
};
type Point = [number, number];
export function installVillageWorld(zones: Record<string, ZoneDef>, gardenPlots: readonly (readonly [number, number])[]) {
  const study = createVillageTerrain();
  const terrain = study.grid.map((row, y) => Array.from({ length: VILLAGE_WIDTH }, (_, x) => {
    const tile = row[x] ?? (y <= shoreAt(x + .5) ? 'g' : 'd');
    return tile === '~' ? 'd' : tile;
  }));
  const bounds = VILLAGE_BOUNDS;
  const old = { ...zones };
  let props: PropPlace[] = study.placements.filter(p => !['bld_th_home_l', 'bld_th_home_r', 'bld_sh_home_l', 'bld_sh_home_r', 'bld_th_flower_l', 'bld_sh_fish_l', 'project_teatable', 'project_teagames'].includes(p.id));
  // Remove the sample residential fences/flowers before plotting the full resident roster.
  props = props.filter(p => !(p.x >= 80 && p.y >= 25 && p.y < 60) && !(p.x >= 22 && p.x < 31 && p.y >= 25 && p.y < 36));
  const set = (x: number, y: number, ch: string) => { if (terrain[y]?.[x] !== undefined) terrain[y][x] = ch; };
  function rect(x: number, y: number, w: number, h: number, ch: string, keepWater = false) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!keepWater || !'wdCb'.includes(terrain[j]?.[i] ?? 'w')) set(i, j, ch);
  }
  function street(points: Point[], width = 2, ch = 'p') {
    for (let n = 1; n < points.length; n++) {
      let [x, y] = points[n - 1]; const [tx, ty] = points[n];
      rect(x, y, width, width, ch, ch !== 'b');
      while (x !== tx || y !== ty) {
        if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        rect(x, y, width, width, ch, ch !== 'b');
      }
    }
  }
  const prop = (id: string, x: number, y: number, cond?: string) => props.push({ id, x, y, cond });
  // The extra residential row sits on mainland, with its front street above the coastal edge.
  for (let y = 53; y < 60; y++) for (let x = 97; x < VILLAGE_WIDTH; x++) if (terrain[y][x] === 'd') set(x, y, 'g');
  // Regular two-tile public lanes, wide bridge landings and a separate garden gate.
  street([[18, 21], [21, 21], [21, 38]], 2);
  street([[21, 38], [29, 38]], 3);
  street([[39, 24], [39, 30], [46, 30]], 2);
  street([[39, 39], [45, 39]], 3);
  street([[40, 53], [44, 53]], 2);
  rect(21, 46, 3, 3, 'c'); street([[21, 48], [22, 48], [22, 53]], 2);
  street([[66, 40], [64, 40]], 2);
  street([[52, 57], [52, 64]], 3);
  street([[64, 37], [72, 37]], 3);
  street([[79, 37], [119, 37]], 3);
  street([[89, 24], [89, 58], [119, 58]], 2);
  for (const x of [99, 109, 118]) street([[x, 37], [x, 58]], 2);
  street([[81, 47], [119, 47]], 3);
  street([[90, 20], [90, 27]], 2);
  // A footpath round the lakeshore leads to the abandoned station, never through the shrine cliff.
  street([[67, 22], [71, 22], [71, 25], [89, 25]], 2);
  street([[54, 23], [54, 30]], 3);
  // Real agricultural plots replace the illustrative carrots, below the tea-house frontage.
  rect(6, 32, 7, 4, 'g'); rect(6, 35, 7, 3, 'o');
  props = props.filter(p => !(p.id === 'fence' && p.y === 36 && p.x < 14));
  for (const [x, y] of gardenPlots) set(x, y + bounds.garden.y, 'o');
  street([[5, 32], [5, 39], [7, 39]], 2);
  // All sixteen existing homes retain their IDs and interiors. The residential district grows eastward.
  for (const h of HOUSES) {
    const b = bounds[h.zone], x = b.x + h.x, y = b.y + h.y;
    if (h.zone === 'residential') rect(x - 1, y - 4, 8, 10, 'g', true);
    if (h.zone === 'market') rect(x - 1, y - 3, 8, 8, 'b');
    if (h.zone === 'harbor') rect(x - 1, y - 3, 8, 7, 'b');
    prop(housePropId(h), x, y);
    const [dx, dy] = houseDoorTile(h), gx = b.x + dx, gy = b.y + dy;
    rect(x, y + 3, 6, 1, h.zone === 'harbor' || h.zone === 'market' ? 'b' : 'c');
    const roadY = h.zone === 'residential' ? (y < 35 ? 37 : y < 46 ? 47 : 58) : h.zone === 'garden' ? 34 : 67;
    street([[gx, gy], [gx, roadY]], 1, h.zone === 'harbor' || h.zone === 'market' ? 'b' : 'p');
    if (h.zone === 'garden') street([[gx, roadY], [21, roadY]], 2);
    for (const xx of [x - 1, x + 6]) {
      prop('flowers', xx, y + 4);
      if (h.zone === 'residential') prop('bush', xx, y + 5);
    }
    if (h.zone === 'residential') for (let xx = x; xx < x + 6; xx++) if (Math.abs(xx - gx) > 1) prop('fence', xx, roadY - 1);
  }
  if (exteriorsWanted()) {
    // Modern Exteriors in the garden: a statue looking over the pond, a planter bench on the lawn by the paths,
    // a flower cart beside the east beds, bird houses and a watering can left by the west bed.
    prop('garden_statue', 17, 38); prop('garden_flower_bench', 14, 32); prop('garden_cart', 24, 36);
    prop('birdhouse_pink', 18, 29); prop('birdhouse_blue', 19, 44); prop('watering_can', 13, 37);
  }
  // Restore streets after lawns are drawn. These strips lie between the private lots.
  street([[79, 37], [119, 37]], 3); street([[81, 47], [119, 47]], 3);
  street([[89, 24], [89, 58], [119, 58]], 2);
  for (const x of [99, 109, 118]) street([[x, 37], [x, 58]], 2);
  if (exteriorsWanted()) {
    // Modern Exteriors: each home gets a mailbox and a bin on the first free lawn cells beside its entrance path
    // (after the streets, so no street cell is taken); every other lawn gets a bird house, in turn three colours.
    const free = (x: number, y: number) => terrain[y]?.[x] === 'g' && !props.some(p => {
      const d = PROPS[p.id]; return x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h;
    });
    HOUSES.filter(h => h.zone === 'residential').forEach((h, n) => {
      const b = bounds.residential, x = b.x + h.x, y = b.y + h.y, gx = b.x + houseDoorTile(h)[0];
      const roadY = y < 35 ? 37 : y < 46 ? 47 : 58;
      const spots = [[gx + 1, roadY - 2], [gx - 1, roadY - 2], [gx + 2, roadY - 2], [gx - 2, roadY - 2], [gx + 1, roadY - 3], [gx - 1, roadY - 3]];
      for (const id of ['mailbox', 'street_bin']) {
        const at = spots.find(([sx, sy]) => free(sx, sy));
        if (at) prop(id, at[0], at[1]);
      }
      if (n % 2 === 0 && free(x - 1, y + 3)) prop(['birdhouse_blue', 'birdhouse_pink', 'birdhouse_brown'][(n / 2) % 3], x - 1, y + 3);
    });
  }
  // Street lamps where people walk at night: crossings, both ends of every bridge, the ring round the restaurant and
  // the corners of the residential streets. Each one stands on the grass right beside the street, never on it, so the
  // main streets stay open across their full width.
  const onStreet = (x: number, y: number) => 'pc'.includes(terrain[y]?.[x] ?? '!');
  // a tile is taken by a prop's footprint or by the part of a tall sprite above it (roofs)
  const taken = (x: number, y: number) => props.some(p => {
    const d = PROPS[p.id]; if (!d) return false;
    const top = p.y + d.h - Math.ceil(d.sh / 16);
    return x >= p.x && x < p.x + d.w && y >= Math.min(p.y, top) && y < p.y + d.h;
  });
  for (const [ax, ay] of [
    [21, 32], [21, 44], [30, 22], [40, 22], [28, 37], [40, 37], [28, 52], [41, 52],
    [48, 27], [60, 27], [50, 57], [60, 57], [66, 34], [66, 46], [71, 36], [82, 36],
    [88, 30], [88, 42], [88, 54], [99, 39], [109, 39], [118, 39], [99, 49], [109, 49], [118, 49], [104, 57], [114, 57],
  ] as Point[]) {
    let at: Point | null = null;
    for (let r = 0; r <= 2 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) {
      const x = ax + dx, y = ay + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !'gG'.includes(terrain[y]?.[x] ?? '!') || taken(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => onStreet(x + i, y + j))) at = [x, y];
    }
    if (at) prop('street_lamp_l', ...at);
  }
  // Wooden promenade and working quay connect the coast, fish houses and lighthouse.
  rect(37, 65, 54, 5, 'b'); street([[44, 63], [55, 63], [55, 68]], 2, 'b');
  rect(94, 52, 3, 13, 'b'); street([[94, 64], [90, 65], [90, 68]], 2, 'b');
  street([[99, 51], [94, 51], [94, 54]], 2, 'b');
  street([[89, 58], [99, 58]], 2, 'b');
  // The lighthouse's land is rounded at tile resolution instead of a square grass platform.
  // With Modern Exteriors the pack's 7x16 lighthouse needs open sky above it: its islet moves south into open water,
  // clear of the riverside homes and the quay, and the jetty runs on to reach it.
  const tallLighthouse = exteriorsWanted();
  const islet = tallLighthouse ? { cx: 100.5, cy: 72, r: 5 } : { cx: 99, cy: 68, r: 4.5 };
  rect(95, 63, 9, 10, 'd');
  for (let y = 60; y < 80; y++) for (let x = 92; x < 110; x++) if (((x + .5 - islet.cx) / islet.r) ** 2 + ((y + .5 - islet.cy) / islet.r) ** 2 < 1) set(x, y, 'g');
  if (tallLighthouse) {
    street([[90, 67], [96, 67], [96, 72]], 2, 'b');
    props = props.filter(p => p.id !== 'lighthouse');
    prop('lighthouse_tall', 98, 72);
  } else street([[90, 67], [99, 67], [99, 69]], 2, 'b');
  props = props.filter(p => p.id !== 'bld_restaurant_s2');
  // every stage keeps its doorway on the same street tile, whatever its width (the inn is wider than the houses)
  for (let stage = 0; stage < 4; stage++) prop(`bld_restaurant_s${stage}`, Math.round(52.5 - PROPS[`bld_restaurant_s${stage}`].w / 2), 49, `stage=${stage}`);
  prop('menuboard', 48, 54); prop('stall_wood', 69, 46); prop('stall_rose', 68, 53);
  prop('stall_sage', 6, 50); prop('stall_rose', 15, 50);
  prop('sign_forest', 28, 23); prop('sign_garden', 39, 41); prop('sign_beach', 40, 55);
  prop('sign_station', 92, 22); prop('sign_harbor', 67, 57); prop('sign_riverside', 92, 50);
  // Frontages join the nearest public lane with two-tile approaches where space permits.
  for (const p of study.plots.filter(p => ['bld_bakery', 'bld_clothes', 'bld_library', 'bld_store'].includes(p.id))) {
    const [x, y] = p.door;
    street([[x, y], [x, p.gate[1]], p.gate], 2);
  }
  for (let y = civicSquare.y; y < civicSquare.y + civicSquare.h; y++) for (let x = civicSquare.x; x < civicSquare.x + civicSquare.w; x++) if (terrain[y][x] === 'p') set(x, y, 'c');
  for (const id of Object.keys(bounds) as VillageZone[]) {
    const b = bounds[id];
    zones[id] = { id, name: b.name, music: b.music, outdoor: true, world: { x: b.x, y: b.y },
      w: b.w, h: b.h, ground: [], props: [], doors: [], interact: [], rooms: [], gather: [],
      ...(id === 'beach' || id === 'market' || id === 'harbor' ? { fishing: 'sea' as const } : { fishing: 'lake' as const }), bugs: id !== 'market' && id !== 'harbor' };
  }
  function interaction(oldZone: string, id: string, x: number, y: number, fallback?: Omit<InteractDef, 'x' | 'y' | 'id'>) {
    const source = old[oldZone]?.interact.find(i => i.id === id) ?? fallback;
    if (!source) throw new Error(`Missing village interaction ${oldZone}/${id}`);
    const at = villageSpot(x, y);
    zones[at.zone].interact.push({ ...source, id, x: at.x, y: at.y });
  }
  const civic: [string, number, number][] = [['board', 47, 32], ['board2', 48, 32], ['mailbox', 47, 55], ['fountain', 54, 38], ['sign', 48, 55], ['ren_stall', 70, 47], ['sumi_stall', 69, 54], ['river_fish1', 39, 26], ['river_fish2', 70, 38], ['grove_fish', 75, 44], ['shrine', 55, 14], ['pier_fish1', 70, 73], ['pier_fish2', 84, 72]];
  for (const [id, x, y] of civic) interaction('plaza', id, x, y);
  for (const [id, x, y] of [['fish1', 56, 75], ['fish2', 84, 73], ['fish3', 20, 60], ['market_stall', 7, 51], ['market_stall2', 16, 51], ['sunset', 18, 59], ['fish4', 26, 59], ['fish5', 70, 74]] as [string, number, number][]) interaction('beach', id, x, y);
  for (const [id, x, y] of [['st_office', 86, 12], ['st_clock', 88, 12], ['st_bench', 91, 14], ['st_crate', 94, 12]] as [string, number, number][]) interaction('station', id, x, y);
  for (const [id, x, y] of [['lake1', 14, 15], ['lake2', 6, 15], ['stump', 23, 19], ['kiki_path', 22, 20], ['pond_fish1', 14, 10], ['pond_fish2', 5, 13], ['forest_shrine', 55, 14], ['hunter_cabin', 9, 23]] as [string, number, number][]) interaction('forest', id, x, y);
  interaction('forest', 'cabin', 9, 23);
  for (const [id, x, y] of [['pond', 13, 43], ['merge', 15, 34], ['koi_fish1', 8, 41], ['koi_fish2', 17, 41]] as [string, number, number][]) interaction('garden', id, x, y);
  for (const [i, [x, y]] of gardenPlots.entries()) zones.garden.interact.push({ id: 'plot' + i, x, y, label: 'Parcela', action: 'plot:' + i, ...(i >= 6 ? { cond: 'proj_garden_lanterns_4' } : {}) });
  // in front of the six stalls of the market street (villageTerrain.ts): sweets, rare things, clothes, decoration, memory game, fortune
  const marketPositions: Point[] = [[47, 61], [50, 61], [63, 61], [59, 61], [56, 61], [53, 61]];
  old.market.interact.filter(i => !i.id.startsWith('project_')).forEach((i, n) => {
    const [x, y] = marketPositions[n]; interaction('market', i.id, x, y);
    const at = villageSpot(x, y); zones[at.zone].interact.find(it => it.id === i.id)!.cond = 'market_open';
  });
  // Existing interiors return to their actual new doorstep, not their historic coordinates.
  function entrance(to: string, x: number, y: number, tx: number, ty: number, label: string, walk = true, lock?: DoorDef['lock']) {
    const at = villageSpot(x, y);
    zones[at.zone].doors.push({ x: at.x, y: at.y, to, tx, ty, label, walk, dir: 'up', lock });
    for (const back of zones[to].doors.filter(d => old[d.to]?.outdoor || d.to === 'plaza' || d.to === 'beach')) Object.assign(back, { to: at.zone, tx: at.x, ty: at.y + 1 });
  }
  for (const [id, to, tx, ty, name] of [['bld_bakery', 'shop_bento', 9, 6, 'Panadería'], ['bld_clothes', 'shop_yuki', 9, 6, 'Ropa de Yuki'], ['bld_library', 'library', 6, 7, 'Biblioteca'], ['bld_store', 'shop_taro', 9, 6, 'Almacén de Taro'], ['bld_restaurant_s2', 'restaurant', RESTAURANT_ENTRY.x, RESTAURANT_ENTRY.y, 'Midnight Maki']] as const) {
    const p = study.plots.find(p => p.id === id)!; entrance(to, ...p.door, tx, ty, name);
  }
  for (const h of HOUSES) zones[h.zone].doors.push(houseDoorDef(h));
  const lhDoor: Point = tallLighthouse ? [100, 75] : [99, 69];
  entrance('lighthouse', ...lhDoor, 6, 10, 'Faro', false, { flag: 'lighthouse_open', msg: 'La puerta del faro tiene tres huecos con forma de estrella.' });
  interaction('beach', 'lh_door', ...lhDoor);
  // Seam crossings follow the actual continuous streets. Arrival is one tile inside, avoiding a return-door loop.
  const open = (x: number, y: number) => 'pcb'.includes(terrain[y]?.[x] ?? '!');
  const solidAt = (x: number, y: number) => props.some(p => {
    const d = PROPS[p.id]; return d.solid && d.kind !== 'boat' && x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h;
  });
  function seam(a: VillageZone, b: VillageZone, x: number, y: number, dx: number, dy: number) {
    const aa = bounds[a], bb = bounds[b], target = zones[b];
    if (!open(x, y) || !open(x + dx, y + dy) || !open(x - dx, y - dy) || !open(x + dx * 2, y + dy * 2)) return;
    if ([0, 1, 2, -1].some(n => solidAt(x + dx * n, y + dy * n))) return;
    const dir = dx ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    zones[a].doors.push({ x: x - aa.x, y: y - aa.y, to: b, tx: x + dx * 2 - bb.x, ty: y + dy * 2 - bb.y, dir, walk: true, label: target.name, lock: VILLAGE_LOCKS[b] });
    const flag = VILLAGE_LOCKS[b]?.flag;
    if (flag) {
      const obstacle = b === 'forest' ? 'block_gate_wood' : b === 'station' ? 'block_gate_iron' : 'block_gate_wood';
      zones[a].props.push({ id: obstacle, x: x - aa.x, y: y - aa.y, cond: '!' + flag });
      zones[a].interact.push({ id: `blk_${b}_${x}_${y}`, x: x - aa.x, y: y - aa.y, label: 'Camino cerrado', action: 'blocked:' + b, cond: '!' + flag });
    }
  }
  for (const a of Object.keys(bounds) as VillageZone[]) for (const b of Object.keys(bounds) as VillageZone[]) {
    if (a === b) continue;
    const aa = bounds[a], bb = bounds[b];
    if (aa.x + aa.w === bb.x) for (let y = Math.max(aa.y, bb.y); y < Math.min(aa.y + aa.h, bb.y + bb.h); y++) seam(a, b, aa.x + aa.w - 1, y, 1, 0);
    if (aa.x === bb.x + bb.w) for (let y = Math.max(aa.y, bb.y); y < Math.min(aa.y + aa.h, bb.y + bb.h); y++) seam(a, b, aa.x, y, -1, 0);
    if (aa.y + aa.h === bb.y) for (let x = Math.max(aa.x, bb.x); x < Math.min(aa.x + aa.w, bb.x + bb.w); x++) seam(a, b, x, aa.y + aa.h - 1, 0, 1);
    if (aa.y === bb.y + bb.h) for (let x = Math.max(aa.x, bb.x); x < Math.min(aa.x + aa.w, bb.x + bb.w); x++) seam(a, b, x, aa.y, 0, -1);
  }
  // Preserve all resource pools, on open grass/sand beside the district's walks.
  const gathering: Partial<Record<VillageZone, Point[]>> = {
    plaza: [[42, 32], [41, 43], [68, 43], [68, 55]], forest: [[16, 5], [20, 9], [16, 18], [24, 20], [25, 13], [22, 7], [27, 22], [3, 17], [12, 18], [25, 3], [28, 9]],
    garden: [[18, 31], [18, 35], [19, 42], [4, 44]], beach: [[6, 55], [14, 56], [21, 57], [26, 55], [10, 58], [18, 54], [24, 58], [8, 53], [4, 52]], station: [[96, 14], [93, 17]],
  };
  for (const [id, points] of Object.entries(gathering)) {
    const source = old[id].gather;
    points.forEach(([x, y], n) => { const at = villageSpot(x, y); zones[id].gather.push({ x: at.x, y: at.y, pool: source[n % source.length].pool }); });
  }
  // Reserve gameplay targets before placing scenery; no trunk, crate or planter blocks a threshold.
  const reserved = new Set<string>();
  for (const project of PROJECTS) {
    const b = bounds[project.zone as VillageZone]; if (!b) continue;
    for (const phase of PROJECT_PROPS[project.id] ?? []) for (const [id, x, y] of phase) {
      const d = PROPS[id];
      for (let yy = -1; yy <= d.h; yy++) for (let xx = -1; xx <= d.w; xx++) reserved.add(`${b.x + x + xx},${b.y + y + yy}`);
    }
  }
  for (const a of [...PROJECT_AMENITIES, ...PROJECT_GATHER]) {
    const b = bounds[a.zone as VillageZone]; if (b) reserved.add(`${b.x + a.x},${b.y + a.y}`);
  }
  for (const [id, z] of Object.entries(zones)) {
    const b = bounds[id as VillageZone]; if (!b) continue;
    for (const d of z.doors) { reserved.add(`${b.x + d.x},${b.y + d.y}`); reserved.add(`${b.x + d.x},${b.y + d.y + 1}`); }
    for (const i of z.interact) if (!i.id.startsWith('blk_')) reserved.add(`${b.x + i.x},${b.y + i.y + 1}`);
    for (const p of z.gather) reserved.add(`${b.x + p.x},${b.y + p.y}`);
  }
  const occupied = new Set<string>();
  const structural = (p: PropPlace) => ['building', 'townhouse', 'sidehouse', 'lighthouse', 'fountain', 'stall', 'torii', 'shrine'].includes(PROPS[p.id].kind);
  props.sort((a, b) => Number(structural(b)) - Number(structural(a)));
  // one kind of tree per district, so a swaying dark tree never stands beside a still light one (cherries stay as accents)
  const ZONE_TREE: Partial<Record<VillageZone, string>> = { forest: 'tree_dark', station: 'tree_dark', shrine: 'pine' };
  const TREES = new Set(['tree', 'tree_dark', 'tree_autumn', 'pine', 'village_pine']);
  for (const p of props) if (TREES.has(p.id)) p.id = ZONE_TREE[villageSpot(p.x, p.y).zone] ?? 'tree';
  for (const p of props) {
    const d = PROPS[p.id]; if (!d) throw new Error(`Unknown prop ${p.id}`);
    const at = villageSpot(p.x, p.y), z = zones[at.zone], b = bounds[at.zone];
    if (p.x + d.w > b.x + b.w || p.y + d.h > b.y + b.h) continue;
    const cells: string[] = [];
    for (let y = p.y; y < p.y + d.h; y++) for (let x = p.x; x < p.x + d.w; x++) cells.push(`${x},${y}`);
    // wharf_* pieces are authored against the deck's rails and the market's edges, so decks and paths do not reject them
    const paved = p.id.startsWith('wharf_') ? 'wdC' : 'wdCpb';
    if (d.solid && d.kind !== 'boat' && !structural(p) && cells.some(key => occupied.has(key) || reserved.has(key) || (() => { const [x, y] = key.split(',').map(Number); return paved.includes(terrain[y][x]); })())) continue;
    if (d.solid && d.kind !== 'boat' && cells.some(key => occupied.has(key)) && !p.cond?.startsWith('stage=')) continue;
    z.props.push({ ...p, x: at.x, y: at.y });
    if (d.solid && d.kind !== 'boat') cells.forEach(key => occupied.add(key));
  }
  for (const [id, z] of Object.entries(zones)) {
    const b = bounds[id as VillageZone]; if (!b) continue;
    z.ground = terrain.slice(b.y, b.y + b.h).map(row => row.slice(b.x, b.x + b.w).join(''));
    for (const a of PROJECT_AMENITIES.filter(a => a.zone === id)) z.interact.push({ id: 'project_' + a.id, x: a.x, y: a.y, label: a.title, action: 'project:' + a.id, cond: `proj_${a.project}_${a.phase}` });
  }
  // Fishing spots stand on the nearest walkable tile that touches the water (several had drifted inland or into the
  // water when the map was reworked); two spots on the same stretch of shore become one.
  const water = (x: number, y: number) => 'wd'.includes(terrain[y]?.[x] ?? '!');
  for (const [id, z] of Object.entries(zones)) {
    const b = bounds[id as VillageZone]; if (!b) continue;
    const solid = new Set<string>();
    for (const p of z.props) {
      const d = PROPS[p.id]; if (!d?.solid || d.kind === 'boat') continue;
      for (let y = p.y; y < p.y + d.h; y++) for (let x = p.x; x < p.x + d.w; x++) solid.add(`${x + b.x},${y + b.y}`);
    }
    const ok = (x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h && !'wdhC'.includes(terrain[y]?.[x] ?? 'w')
      && !solid.has(`${x},${y}`) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => water(x + i, y + j));
    const kept: [number, number][] = [];
    z.interact = z.interact.filter(i => {
      if (!i.action.startsWith('fish')) return true;
      const wx = i.x + b.x, wy = i.y + b.y;
      let best: [number, number] | null = null;
      for (let r = 0; r <= 6 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(wx + dx, wy + dy)) best = [wx + dx, wy + dy];
      }
      if (!best || kept.some(([x, y]) => Math.abs(x - best![0]) + Math.abs(y - best![1]) <= 2)) return false;
      kept.push(best);
      i.x = best[0] - b.x; i.y = best[1] - b.y;
      return true;
    });
  }
}
