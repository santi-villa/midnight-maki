/** Turns a ZoneDef + current save into tiles, collision grid and placed objects. DOM-free. */
import { game } from '../core/state';
import type { PlacedFurniture } from '../core/types';
import { TILE_INDEX, TILE_SOLID } from '../art/tiles';
import { FURN_BY_ID, furnSize, type FurnitureDef } from '../data/furniture';
import { PROPS, type PropDef } from '../data/props';
import { PROJECTS, PROJECT_PROPS } from '../data/projects';
import { applyProjectBenefits } from '../restaurant/projects';
import { seatsApproachable } from '../restaurant/seating';
import { applyStageGrants, stageForLevel } from '../restaurant/stages';
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
  if (cond.startsWith('upgrade:')) return game.save.restaurant.upgrades.includes(cond.slice(8));
  if (cond === 'rain') return game.flag('weather') === 'rain';
  // restaurant stage: 'stage=2' exactly, 'stage>=1' from that stage on, 'stage<1' only before it
  const st = cond.match(/^stage(=|>=|<)(\d)$/);
  if (st) {
    const now = stageForLevel(game.save.restaurant.level);
    const n = Number(st[2]);
    return st[1] === '=' ? now === n : st[1] === '>=' ? now >= n : now < n;
  }
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

/** Which of the 3 look-alike water tiles sits at x,y (so the tile grid never shows). */
export function waterVariant(x: number, y: number): number {
  return hash(x, y) % 3;
}

/** 's' shallow, 'm' shallow next to deep water (a softer blue), 'd' deep. */
export function waterDepthAt(ground: string[], x: number, y: number): 's' | 'm' | 'd' {
  if (ground[y]?.[x] === 'd') return 'd';
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground[y + dy]?.[x + dx] === 'd') return 'm';
  return 's';
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
    case 'w': return TILE_INDEX[`wtc${waterDepthAt(def.ground, x, y)}${waterVariant(x, y)}_0`];
    case 'd': return TILE_INDEX[`wtcd${waterVariant(x, y)}_0`];
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
    // three tiles wide, with a gap between the chairs on each side
    ['table_long', 7, 8], ['chair_dark', 7, 9, 2], ['chair_dark', 9, 9, 2], ['chair_dark', 7, 7, 0], ['chair_dark', 9, 7, 0],
    ['table_long', 12, 7], ['chair_dark', 12, 8, 2], ['chair_dark', 14, 8, 2], ['chair_dark', 12, 6, 0], ['chair_dark', 14, 6, 0],
    ['table_low', 15, 10], ['cushion_indigo', 15, 9], ['cushion_rose', 16, 9], ['cushion_rose', 15, 11], ['cushion_indigo', 16, 11],
    ['bamboo_pot', 16, 6], ['andon', 11, 12], ['bamboo_pot', 7, 12],
  ],
  room_player: [['bed_rose', 1, 2], ['lamp_table', 2, 2], ['rug_cream', 3, 4], ['wardrobe_wood', 5, 2]],
  room_pip: [['futon_rose', 9, 3], ['plush_bear', 12, 2], ['lantern_cream', 13, 2]],
  room_spicy: [['bed_sage', 15, 2], ['shelf_kitchen', 18, 2], ['plant_herbs', 20, 2]],
  room_rigg: [['futon_indigo', 22, 2], ['shelf_books', 25, 2], ['bookstack', 27, 3], ['lamp_table', 23, 2]],
};

export function ensureDefaultDecor() {
  applyProjectBenefits();
  for (const [room, list] of Object.entries(DEFAULT_DECOR)) {
    game.once('decor_' + room, () => {
      const arr = game.room(room);
      for (const [id, x, y, rot] of list) arr.push({ uid: game.uid(), id, x, y, rot: rot ?? 0 });
    });
  }
  applyStageGrants(); // after the defaults, so the new tables never land on them
  widenSavedTables();
}

/**
 * Older halls used a 2-tile table with two chairs touching on each side.
 * When those chairs are still on the original tiles, and the wider footprint is empty,
 * swap in the long table and leave a gap between the chairs. Custom layouts are left alone.
 */
function widenSavedTables() {
  game.once('dining_wide_v1', () => {
    const room = game.room('dining');
    const plans: { from: [number, number]; chairs: [number, number][]; next: { x: number; y: number; chairs: [number, number][] } }[] = [
      { from: [8, 8], chairs: [[8, 7], [9, 7], [8, 9], [9, 9]], next: { x: 7, y: 8, chairs: [[7, 7], [9, 7], [7, 9], [9, 9]] } },
      { from: [12, 7], chairs: [[12, 6], [13, 6], [12, 8], [13, 8]], next: { x: 12, y: 7, chairs: [[12, 6], [14, 6], [12, 8], [14, 8]] } },
    ];
    const covers = (f: PlacedFurniture, x: number, y: number) => {
      const d = FURN_BY_ID[f.id];
      if (!d) return false;
      const s = furnSize(d, f.rot);
      return x >= f.x && x < f.x + s.w && y >= f.y && y < f.y + s.h;
    };
    for (const plan of plans) {
      const table = room.find((f) => (f.id === 'table_dark' || f.id === 'table_wood') && f.x === plan.from[0] && f.y === plan.from[1] && (f.rot ?? 0) % 2 === 0);
      if (!table) continue;
      const chairs = plan.chairs.map(([x, y]) => room.find((f) => f.x === x && f.y === y && !!FURN_BY_ID[f.id]?.sit && !FURN_BY_ID[f.id]?.walkable));
      if (chairs.some((c) => !c)) continue;
      const moving = new Set([table, ...chairs]);
      const need: [number, number][] = [[plan.next.x, plan.next.y], [plan.next.x + 1, plan.next.y], [plan.next.x + 2, plan.next.y], ...plan.next.chairs];
      const blocked = need.some(([x, y]) => x < 3 || y < 6 || x > 16 || y > 12 || ((x === 8 || x === 9) && y >= 10) || room.some((f) => !moving.has(f) && covers(f, x, y)));
      if (blocked) continue;
      table.id = 'table_long';
      table.x = plan.next.x;
      table.y = plan.next.y;
      table.rot = 0;
      chairs.forEach((chair, i) => {
        chair!.x = plan.next.chairs[i][0];
        chair!.y = plan.next.chairs[i][1];
      });
      syncWideDining(table.uid, table.x, table.y, chairs.filter((c): c is PlacedFurniture => !!c));
    }
  });
}

/** A mid-service save still points guests at the chairs. Move those seats with the furniture. */
function syncWideDining(tableUid: number, x: number, y: number, chairs: PlacedFurniture[]) {
  const saved = game.save.dining?.floor.tables.find((t) => t.id === String(tableUid));
  if (!saved) return;
  const ids = new Set(saved.seats.map((s) => s.id));
  if (!chairs.every((c) => ids.has(String(c.uid)))) return;
  saved.x = x;
  saved.y = y;
  for (const chair of chairs) {
    const seat = saved.seats.find((s) => s.id === String(chair.uid));
    if (seat) {
      seat.x = chair.x;
      seat.y = chair.y;
    }
  }
}

export function furnitureSolidTiles(f: PlacedFurniture, def: FurnitureDef): [number, number][] {
  if (def.walkable || def.wall) return [];
  const size = furnSize(def, f.rot);
  const out: [number, number][] = [];
  for (let j = 0; j < size.h; j++) for (let i = 0; i < size.w; i++) out.push([f.x + i, f.y + j]);
  return out;
}

export function buildZone(id: string, night = false): BuiltZone {
  applyProjectBenefits();
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
  // restoration projects add props once their phase is paid for
  const projectProps = PROJECTS.filter((pr) => pr.zone === def.id).flatMap((pr) => (PROJECT_PROPS[pr.id] ?? []).flatMap((list, i) => list.filter(([, , , until]) => !until || !game.has(`proj_${pr.id}_${until}`)).map(([id, x, y]) => ({ id, x, y, cond: `proj_${pr.id}_${i + 1}` }))));
  for (const p of [...def.props, ...projectProps]) {
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
  // only walk-through doors are cleared; interactable/wall doors remain solid
  for (const d of def.doors) {
    if (d.walk) grid.setSolid(d.x, d.y, false);
    else grid.setSolid(d.x, d.y, true);
  }
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

/** Why a piece cannot be placed, or null when the doors, stations and seats stay usable. */
export function placementBlock(zoneId: string, room: string, candidate: PlacedFurniture, ignoreUid?: number): string | null {
  const def = ZONES[zoneId];
  const fd = FURN_BY_ID[candidate.id];
  if (!def || !fd) return 'Ese mueble no existe.';
  const built = buildZoneWithout(zoneId, ignoreUid);
  const g = built.grid;
  if (!fd.walkable && !fd.wall) {
    for (const [x, y] of furnitureSolidTiles(candidate, fd)) {
      if (g.isSolid(x, y)) return 'Ahí no entra.';
      g.setSolid(x, y, true);
    }
  }
  const essentials: [number, number][] = def.doors.filter((d) => d.walk).map((d) => [d.x, d.y]);
  const start = essentials[0] ?? [Math.floor(def.w / 2), def.h - 2];
  if (g.reachableCount(start[0], start[1]) === 0) return 'Ahí no entra.';
  const reach = (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!g.isSolid(nx, ny) && g.path(start[0], start[1], nx, ny, 6000) !== null) return true;
    }
    return false;
  };
  for (const [x, y] of essentials) if (!reach(x, y)) return 'Bloquea una puerta.';
  for (const i of def.interact) if (condOk(i.cond) && !reach(i.x, i.y)) return 'Bloquea una estación.';
  for (const d of def.doors) if (!d.walk && !reach(d.x, d.y)) return 'Bloquea una puerta.';
  if (zoneId === 'restaurant' && !fd.wall && !fd.walkable && !diningSeatsApproachable(g, candidate, ignoreUid, start[0], start[1])) {
    return 'Los clientes no llegan a esa silla.';
  }
  void room;
  return null;
}

/** Checks whether placing furniture keeps every essential tile reachable (doors, interactables, spawn). */
export function placementKeepsPaths(zoneId: string, room: string, candidate: PlacedFurniture, ignoreUid?: number): boolean {
  return placementBlock(zoneId, room, candidate, ignoreUid) === null;
}

function diningSeatsApproachable(grid: Grid, candidate: PlacedFurniture, ignoreUid: number | undefined, fromX: number, fromY: number): boolean {
  const placed = (game.save.decor.dining ?? []).filter((f) => f.uid !== ignoreUid && f.uid !== candidate.uid);
  const pieces = [...placed, candidate].flatMap((f) => {
    const d = FURN_BY_ID[f.id];
    if (!d) return [];
    const size = furnSize(d, f.rot);
    return [{ x: f.x, y: f.y, w: size.w, h: size.h, sit: !!d.sit, walkable: !!d.walkable, kind: d.kind }];
  });
  const tables = pieces.filter((p) => p.kind === 'table' || p.kind === 'roundtable' || p.kind === 'kotatsu');
  const seats = pieces.filter((p) => p.sit && p.kind !== 'bench' && p.kind !== 'table' && p.kind !== 'kotatsu');
  return seatsApproachable(grid, seats, tables, fromX, fromY);
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

/** Returns the door in fromZone that guides the player towards toZone. */
export function doorLeadingTo(fromZone: string, toZone: string): { x: number; y: number; to: string } | null {
  if (fromZone === toZone) return null;
  const def = ZONES[fromZone];
  if (!def || !def.doors.length) return null;

  // Direct door
  const direct = def.doors.find((d) => d.to === toZone);
  if (direct) return { x: direct.x, y: direct.y, to: direct.to };

  // Interiors routing
  if (fromZone === 'home' || fromZone === 'storage') {
    const d = def.doors.find((dd) => dd.to === 'restaurant');
    if (d) return { x: d.x, y: d.y, to: d.to };
  }
  if (fromZone === 'restaurant') {
    if (toZone === 'home' || toZone === 'storage') {
      const d = def.doors.find((dd) => dd.to === toZone);
      if (d) return { x: d.x, y: d.y, to: d.to };
    }
    const d = def.doors.find((dd) => dd.to === 'plaza');
    if (d) return { x: d.x, y: d.y, to: d.to };
  }
  if (fromZone === 'lighthouse') {
    const d = def.doors.find((dd) => dd.to === 'beach');
    if (d) return { x: d.x, y: d.y, to: d.to };
  }
  if (toZone === 'restaurant' || toZone === 'home' || toZone === 'storage') {
    if (fromZone === 'plaza') {
      const d = def.doors.find((dd) => dd.to === 'restaurant');
      if (d) return { x: d.x, y: d.y, to: d.to };
    }
  }
  if (toZone === 'lighthouse' && fromZone === 'plaza') {
    const d = def.doors.find((dd) => dd.to === 'beach');
    if (d) return { x: d.x, y: d.y, to: d.to };
  }
  // From any outdoor zone to another outdoor zone: head to plaza
  const toPlaza = def.doors.find((dd) => dd.to === 'plaza');
  if (toPlaza) return { x: toPlaza.x, y: toPlaza.y, to: toPlaza.to };

  return { x: def.doors[0].x, y: def.doors[0].y, to: def.doors[0].to };
}
