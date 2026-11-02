/**
 * Villa Nori outdoors as ONE live map. The districts (plaza, playa, bosque, ...) stay what the data and the save speak
 * about: every routine, quest, door and saved position still says "beach, tile 10,5". This module turns those into
 * the village's world tiles and back, and builds the whole village at once by putting the districts side by side, each
 * built exactly as before (so every tile, prop and edge looks the same).
 *
 * The merged definition is NOT registered in ZONES, so searches over the zones (where is this interaction, which zone
 * leads to that door) keep answering with the district.
 */
import { VILLAGE_BOUNDS, type VillageZone } from '../data/villageGeography';
import { ZONES, type DoorDef, type ZoneDef } from '../data/zones';
import { game } from '../core/state';
import { Grid } from './grid';
import { buildZoneSingle, type BuiltZone } from './zoneRuntime';

export const VILLAGE = 'village';
export const DISTRICTS = Object.keys(VILLAGE_BOUNDS) as VillageZone[];
export const VILLAGE_W = Math.max(...DISTRICTS.map((d) => VILLAGE_BOUNDS[d].x + VILLAGE_BOUNDS[d].w));
export const VILLAGE_H = Math.max(...DISTRICTS.map((d) => VILLAGE_BOUNDS[d].y + VILLAGE_BOUNDS[d].h));

export function isDistrict(id: string | null | undefined): id is VillageZone {
  return !!id && Object.prototype.hasOwnProperty.call(VILLAGE_BOUNDS, id);
}

/** Where a district starts on the village map (0,0 for any other zone). */
export function originOf(id: string): { x: number; y: number } {
  return isDistrict(id) ? { x: VILLAGE_BOUNDS[id].x, y: VILLAGE_BOUNDS[id].y } : { x: 0, y: 0 };
}

/** The zone a place is drawn in: the village for any district, the place itself otherwise. */
export function liveZoneOf(id: string): string {
  return isDistrict(id) ? VILLAGE : id;
}

/** A district tile (or pixel offset in tiles) in the village's own tiles. Other zones are returned as they are. */
export function toLive(zone: string, x: number, y: number): { zone: string; x: number; y: number } {
  if (!isDistrict(zone)) return { zone, x, y };
  const o = VILLAGE_BOUNDS[zone];
  return { zone: VILLAGE, x: x + o.x, y: y + o.y };
}

/** The district under a village tile, with the tile in that district's coordinates. Off the map, the nearest district. */
export function districtAt(wx: number, wy: number): { zone: VillageZone; x: number; y: number } {
  const fx = Math.floor(wx), fy = Math.floor(wy);
  let zone = DISTRICTS.find((d) => { const b = VILLAGE_BOUNDS[d]; return fx >= b.x && fy >= b.y && fx < b.x + b.w && fy < b.y + b.h; });
  if (!zone) {
    // past the edge (a step outside while walking): the closest district
    let best = Infinity;
    for (const d of DISTRICTS) {
      const b = VILLAGE_BOUNDS[d];
      const dx = Math.max(b.x - fx, 0, fx - (b.x + b.w - 1)), dy = Math.max(b.y - fy, 0, fy - (b.y + b.h - 1));
      if (dx + dy < best) { best = dx + dy; zone = d; }
    }
  }
  const b = VILLAGE_BOUNDS[zone!];
  return { zone: zone!, x: wx - b.x, y: wy - b.y };
}

/** Doors between two districts are just the street going on: the merged map drops them (locks are kept, see below). */
function seamDoor(from: string, d: DoorDef) {
  return isDistrict(from) && isDistrict(d.to) && !!d.walk;
}

let defCache: ZoneDef | null = null;
/** The whole village as one zone definition, in village tiles. Props keep their conditions; doors lead to interiors only. */
export function villageDef(): ZoneDef {
  if (defCache) return defCache;
  const ground: string[] = Array.from({ length: VILLAGE_H }, () => ' '.repeat(VILLAGE_W));
  const rows = ground.map((r) => [...r]);
  const def: ZoneDef = { id: VILLAGE, name: 'Villa Nori', music: 'town', outdoor: true, w: VILLAGE_W, h: VILLAGE_H, ground, props: [], doors: [], interact: [], rooms: [], gather: [], bugs: true };
  for (const id of DISTRICTS) {
    const z = ZONES[id], o = VILLAGE_BOUNDS[id];
    z.ground.forEach((row, y) => [...row].forEach((ch, x) => { rows[y + o.y][x + o.x] = ch; }));
    for (const p of z.props) def.props.push({ ...p, x: p.x + o.x, y: p.y + o.y });
    for (const d of z.doors) if (!seamDoor(id, d)) def.doors.push({ ...d, x: d.x + o.x, y: d.y + o.y });
    for (const i of z.interact) def.interact.push({ ...i, x: i.x + o.x, y: i.y + o.y });
    for (const g of z.gather) def.gather.push({ ...g, x: g.x + o.x, y: g.y + o.y });
  }
  def.ground = rows.map((r) => r.join(''));
  defCache = def;
  return def;
}

/**
 * Districts that are still closed (a lock on the way in): their rim is a wall from every side, as the borders used to be.
 * Only the rim tiles that touch an open district are closed, so nothing inside changes.
 */
export function closedDistricts(): VillageZone[] {
  const closed = new Set<VillageZone>();
  for (const id of DISTRICTS) for (const d of ZONES[id].doors) {
    if (isDistrict(d.to) && d.walk && d.lock && !game.has(d.lock.flag)) closed.add(d.to);
  }
  return [...closed];
}

/**
 * Builds the whole village: each district exactly as it is built alone, copied into place. The seam doors are not doors
 * any more; a locked one still closes its district's edge.
 */
export function buildVillage(night = false): BuiltZone {
  const def = villageDef();
  const tiles = Array.from({ length: VILLAGE_H }, () => new Array<number>(VILLAGE_W).fill(-1));
  const overlay = Array.from({ length: VILLAGE_H }, () => new Array<number>(VILLAGE_W).fill(-1));
  const grid = new Grid(VILLAGE_W, VILLAGE_H);
  for (let y = 0; y < VILLAGE_H; y++) for (let x = 0; x < VILLAGE_W; x++) grid.setSolid(x, y, true);
  const props: BuiltZone['props'] = [];
  for (const id of DISTRICTS) {
    const b = buildZoneSingle(id, night), o = VILLAGE_BOUNDS[id];
    for (let y = 0; y < b.def.h; y++) for (let x = 0; x < b.def.w; x++) {
      tiles[y + o.y][x + o.x] = b.tiles[y][x];
      overlay[y + o.y][x + o.x] = b.overlay[y][x];
      grid.setSolid(x + o.x, y + o.y, b.grid.isSolid(x, y));
    }
    // (a seam door's tile comes over as it was built: open street, or closed while its lock holds)
    for (const p of b.props) props.push({ ...p, x: p.x + o.x, y: p.y + o.y });
  }
  for (const id of closedDistricts()) {
    const b = VILLAGE_BOUNDS[id];
    const inside = (x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside(x + dx, y + dy) && grid.inside(x + dx, y + dy));
      if (rim) grid.setSolid(x, y, true);
    }
  }
  return { def, tiles, overlay, grid, props, furniture: [] };
}
