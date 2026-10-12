/** Turns a ZoneDef + current save into tiles, collision grid and placed objects. DOM-free. */
import { game } from '../core/state';
import type { PlacedFurniture } from '../core/types';
import { TILE_INDEX, TILE_SOLID } from '../art/tiles';
import { FURN_BY_ID, type FurnitureDef } from '../data/furniture';
import { PROPS, type PropDef } from '../data/props';
import { ZONES, type RoomDef, type ZoneDef } from '../data/zones';
import { Grid } from './grid';

export interface PropInstance { key: string; def: PropDef; x: number; y: number; }
export interface FurnInstance { room: string; f: PlacedFurniture; def: FurnitureDef; }

export interface BuiltZone {
  def: ZoneDef;
  tiles: number[][];
  /** transition overlay (grass edges over paths/water); -1 = empty */
  overlay: number[][];
  grid: Grid;
  props: PropInstance[];
  furniture: FurnInstance[];
}

export function condOk(cond?: string): boolean {
  if (!cond) return true;
  if (cond === 'rain') return game.flag('weather') === 'rain';
  if (cond.startsWith('!')) return !game.has(cond.slice(1));
  return game.has(cond);
}

export function roomAt(def: ZoneDef, x: number, y: number): RoomDef | undefined {
  return def.rooms.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
}

export function roomStyle(r: RoomDef | undefined, def?: ZoneDef) {
  if (!r) return { wall: def?.walls ?? 'cream', floor: def?.floor ?? 'wood' };
  const s = game.save.roomStyle[r.id];
  return { wall: s?.wall ?? r.defWall, floor: s?.floor ?? r.defFloor };
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export function tileFor(def: ZoneDef, ch: string, x: number, y: number, night = false): number {
  const st = roomStyle(roomAt(def, x, y), def);
  switch (ch) {
    case '#': return TILE_INDEX['walltop_' + st.wall] ?? TILE_INDEX.walltop_cream;
    case 'W': return TILE_INDEX['wall_' + st.wall] ?? TILE_INDEX.wall_cream;
    case 'V': return TILE_INDEX[(night ? 'windowN_' : 'window_') + st.wall] ?? TILE_INDEX.window_cream;
    case 'f': return TILE_INDEX['floor_' + st.floor] ?? TILE_INDEX.floor_wood;
    case 'U': return TILE_INDEX['upper_' + st.wall] ?? TILE_INDEX['walltop_' + st.wall] ?? TILE_INDEX.walltop_cream;
    case 'k': return TILE_INDEX.kitchen;
    case 't': return TILE_INDEX.floor_tatami;
    case 'm': return TILE_INDEX.mat;
    case 'g': {
      const h = hash(x, y) % 10;
      return TILE_INDEX['grass' + (h < 5 ? 0 : h < 8 ? 1 : h < 9 ? 2 : 3)];
    }
    case 'G': return TILE_INDEX.dgrass;
    case 'p': return TILE_INDEX.dirt;
    case 'c': return TILE_INDEX['cobble' + (['', '1', '2'][hash(x, y) % 3])];
    case 's': return TILE_INDEX.sand;
    case 'h': return TILE_INDEX.shore;
    case 'w': return TILE_INDEX.water0;
    case 'd': return TILE_INDEX.deep0;
    case 'b': return TILE_INDEX.bridge;
    case 'r': return TILE_INDEX.bed_rose;
    case 'y': return TILE_INDEX.bed_gold;
    case 'l': return TILE_INDEX.bed_lav;
    case 'o': return TILE_INDEX.soil;
    case 'S': return TILE_INDEX.station;
    case 'R': return TILE_INDEX.rail;
    case 'x': return TILE_INDEX.void;
    default: return TILE_INDEX.void;
  }
}

/** Default furniture for each decor room the first time it's visited. */
const DEFAULT_DECOR: Record<string, [string, number, number, number?][]> = {
  dining: [
    ['table_dark', 8, 8], ['chair_dark', 8, 9, 2], ['chair_dark', 9, 9, 2], ['chair_dark', 8, 7, 0], ['chair_dark', 9, 7, 0],
    ['table_dark', 12, 7], ['chair_dark', 12, 8, 2], ['chair_dark', 13, 8, 2], ['chair_dark', 12, 6, 0], ['chair_dark', 13, 6, 0],
    ['table_low', 15, 10], ['cushion_indigo', 15, 9], ['cushion_rose', 16, 9], ['cushion_rose', 15, 11], ['cushion_indigo', 16, 11],
    ['bamboo_pot', 16, 6], ['andon', 11, 12], ['bamboo_pot', 7, 12],
  ],
  room_player: [['bed_rose', 1, 2], ['lamp_table', 2, 2], ['rug_cream', 3, 4], ['wardrobe_wood', 5, 2]],
  room_pip: [['futon_rose', 9, 3], ['plush_bear', 12, 2], ['lantern_cream', 13, 2]],
  room_spicy: [['bed_sage', 15, 2], ['shelf_kitchen', 18, 2], ['plant_herbs', 20, 2]],
  room_rigg: [['futon_indigo', 22, 2], ['shelf_books', 25, 2], ['bookstack', 27, 3], ['lamp_table', 23, 2]],
};

export function ensureDefaultDecor() {
  for (const [room, list] of Object.entries(DEFAULT_DECOR)) {
    game.once('decor_' + room, () => {
      const arr = game.room(room);
      for (const [id, x, y, rot] of list) arr.push({ uid: game.uid(), id, x, y, rot: rot ?? 0 });
    });
  }
}

export function furnitureSolidTiles(f: PlacedFurniture, def: FurnitureDef): [number, number][] {
  if (def.walkable || def.wall) return [];
  const out: [number, number][] = [];
  for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) out.push([f.x + i, f.y + j]);
  return out;
}

export function buildZone(id: string, night = false): BuiltZone {
  const def = ZONES[id];
  if (!def) throw new Error('Unknown zone ' + id);
  const tiles: number[][] = [];
  const grid = new Grid(def.w, def.h);
  for (let y = 0; y < def.h; y++) {
    const row: number[] = [];
    for (let x = 0; x < def.w; x++) {
      const t = tileFor(def, def.ground[y][x], x, y, night);
      row.push(t);
      grid.setSolid(x, y, TILE_SOLID[t]);
    }
    tiles.push(row);
  }
  const props: PropInstance[] = [];
  for (const p of def.props) {
    if (!condOk(p.cond)) continue;
    const pd = PROPS[p.id];
    if (!pd) {
      console.warn('[zone] missing prop', p.id);
      continue;
    }
    props.push({ key: p.id, def: pd, x: p.x, y: p.y });
    if (pd.solid) for (let j = 0; j < pd.h; j++) for (let i = 0; i < pd.w; i++) grid.setSolid(p.x + i, p.y + j, true);
  }
  const furniture: FurnInstance[] = [];
  for (const r of def.rooms) {
    for (const f of game.save.decor[r.id] ?? []) {
      const fd = FURN_BY_ID[f.id];
      if (!fd) continue;
      furniture.push({ room: r.id, f, def: fd });
      for (const [x, y] of furnitureSolidTiles(f, fd)) grid.setSolid(x, y, true);
    }
  }
  // doors are always walkable
  for (const d of def.doors) grid.setSolid(d.x, d.y, false);
  return { def, tiles, overlay: buildOverlay(def), grid, props, furniture };
}

const GRASSY = 'gG';
const EDGED = 'pcsohryl';
const WATERY = 'wd';

/** Grass edges that soften the borders between lawn and paths / water (outdoor zones only). */
export function buildOverlay(def: ZoneDef): number[][] {
  const out = def.ground.map((row) => [...row].map(() => -1));
  if (!def.outdoor) return out;
  const at = (x: number, y: number) => def.ground[y]?.[x] ?? '';
  for (let y = 0; y < def.h; y++)
    for (let x = 0; x < def.w; x++) {
      const ch = at(x, y);
      const water = WATERY.includes(ch);
      if (!water && !EDGED.includes(ch)) continue;
      let m = 0;
      if (GRASSY.includes(at(x, y - 1) || '.')) m |= 1;
      if (GRASSY.includes(at(x + 1, y) || '.')) m |= 2;
      if (GRASSY.includes(at(x, y + 1) || '.')) m |= 4;
      if (GRASSY.includes(at(x - 1, y) || '.')) m |= 8;
      if (m) out[y][x] = TILE_INDEX[(water ? 'bk' : 'fr') + m];
    }
  return out;
}

/** Checks whether placing furniture keeps every essential tile reachable (doors, interactables, spawn). */
export function placementKeepsPaths(zoneId: string, room: string, candidate: PlacedFurniture, ignoreUid?: number): boolean {
  const def = ZONES[zoneId];
  const fd = FURN_BY_ID[candidate.id];
  if (!fd) return false;
  const built = buildZoneWithout(zoneId, ignoreUid);
  const g = built.grid;
  for (const [x, y] of furnitureSolidTiles(candidate, fd)) {
    if (g.isSolid(x, y)) return false;
    g.setSolid(x, y, true);
  }
  // essential points: doors (walk tiles), interactables' neighbourhood
  const essentials: [number, number][] = def.doors.filter((d) => d.walk).map((d) => [d.x, d.y]);
  const start = essentials[0] ?? [Math.floor(def.w / 2), def.h - 2];
  const total = g.reachableCount(start[0], start[1]);
  if (total === 0) return false;
  const reach = (x: number, y: number) => {
    // any walkable tile next to (x,y) reachable from start
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!g.isSolid(nx, ny) && g.path(start[0], start[1], nx, ny, 6000) !== null) return true;
    }
    return false;
  };
  for (const [x, y] of essentials) if (!reach(x, y)) return false;
  for (const i of def.interact) if (!reach(i.x, i.y)) return false;
  for (const d of def.doors) if (!d.walk && !reach(d.x, d.y)) return false;
  void room;
  return true;
}

function buildZoneWithout(zoneId: string, ignoreUid?: number): BuiltZone {
  const b = buildZone(zoneId);
  if (ignoreUid == null) return b;
  const inst = b.furniture.find((f) => f.f.uid === ignoreUid);
  if (inst) {
    for (const [x, y] of furnitureSolidTiles(inst.f, inst.def)) {
      const t = b.tiles[y]?.[x];
      b.grid.setSolid(x, y, t == null ? true : TILE_SOLID[t]);
    }
  }
  return b;
}
