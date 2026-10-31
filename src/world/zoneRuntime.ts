/** Turns a ZoneDef + current save into tiles, collision grid and placed objects. DOM-free. */
import { game } from '../core/state';
import type { PlacedFurniture } from '../core/types';
import { TILE_INDEX, TILE_SOLID } from '../art/tiles';
import { hasExteriors } from '../art/exteriors';
import { FURN_BY_ID, furnSize, type FurnitureDef } from '../data/furniture';
import { PROPS, type PropDef } from '../data/props';
import { PROJECTS, PROJECT_PROPS } from '../data/projects';
import { applyProjectBenefits } from '../restaurant/projects';
import { seatsApproachable } from '../restaurant/seating';
import { applyStageGrants, stageForLevel } from '../restaurant/stages';
import { HOUSES } from '../data/houses';
import { EXTRA_HOMES } from '../data/residentHomes';
import { housePieces } from '../data/houseInterior';
import { ZONES, type RoomDef, type ZoneDef } from '../data/zones';
import { Grid } from './grid';
import { bridgeMask } from './bridge';
import { settleStoredGifts } from './furnGift';
import { hasLimezuFloor } from '../art/interiors';
import { hasJpPaths } from '../art/japaneseBuildings';

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
  if (cond.startsWith('!upgrade:')) return !game.save.restaurant.upgrades.includes(cond.slice(9));
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

/** Pick one of `n` pre-drawn tiles. The same coordinates always return the same one. */
function varied(base: string, x: number, y: number, n: number): number {
  const i = hash(x, y) % n;
  return TILE_INDEX[i ? base + i : base] ?? TILE_INDEX[base];
}

/** Lawn variants. The flower tile (grass3) stays uncommon. */
function grassAt(x: number, y: number): number {
  const which = [0, 4, 1, 5, 2, 0, 1, 3][hash(x, y) % 8];
  return TILE_INDEX['grass' + which];
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

/** Outdoor water (sea, rivers and ponds) is drawn with the Modern Exteriors water (8 frames, a 2x2 pattern) when its atlas is installed. */
export const usesSea = (def: ZoneDef) => !!def.outdoor && hasExteriors();
export const seaParity = (x: number, y: number) => (x % 2) + 2 * (y % 2);

const seaWater = (ch: string | undefined) => ch === undefined || 'wdhb'.includes(ch);
/** Sea depth by distance to land (piers count as water): a light band along the coast, deep water further out. */
export function seaDepthAt(ground: string[], x: number, y: number): 's' | 'm' | 'd' {
  let near = 25;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (!seaWater(ground[y + dy]?.[x + dx])) near = Math.min(near, dx * dx + dy * dy);
  // round distances keep the bands as soft curves instead of square steps
  return near <= 4 ? 's' : near <= 16 ? 'm' : 'd';
}
/** The waterline tile family of a sea cell that touches sand (its base key without the frame), or null for open water. */
export function seaEdge(ground: string[], x: number, y: number): string | null {
  if (ground[y]?.[x] === 'h') return `seashore${x % 2}`;
  const sand = (dx: number, dy: number) => ground[y + dy]?.[x + dx] === 's';
  const n = sand(0, -1), w = sand(-1, 0), e = sand(1, 0);
  if (n && w) return 'seashoreNW0';
  if (n && e) return 'seashoreNE0';
  if (n) return `seashore${x % 2}`;
  if (w) return `seashoreW${y % 2}`;
  if (e) return `seashoreE${y % 2}`;
  if (sand(-1, -1)) return 'seashoreIW0';
  if (sand(1, -1)) return 'seashoreIE0';
  return null;
}

export function tileFor(def: ZoneDef, ch: string, x: number, y: number, night = false): number {
  if (usesSea(def)) {
    if (ch === 'p' && def.fishing === 'sea') return TILE_INDEX.sandpath; // the coast's walks are packed sand
    if (ch === 'h' || ch === 'w' || ch === 'd') {
      const edge = seaEdge(def.ground, x, y);
      return TILE_INDEX[edge ? `${edge}_0` : `seac${seaDepthAt(def.ground, x, y)}${seaParity(x, y)}_0`];
    }
  }
  const st = roomStyle(roomAt(def, x, y), def);
  switch (ch) {
    case '#': return TILE_INDEX['walltop_' + st.wall] ?? TILE_INDEX.walltop_cream;
    case 'W': return TILE_INDEX['wall_' + st.wall] ?? TILE_INDEX.wall_cream;
    case 'V': return TILE_INDEX[(night ? 'windowN_' : 'window_') + st.wall] ?? TILE_INDEX.window_cream;
    case 'f': return hasLimezuFloor(st.floor) ? TILE_INDEX[`lzfloor_${st.floor}_${(x % 2) + 2 * (y % 2)}`] : varied('floor_' + st.floor, x, y, 3) || TILE_INDEX.floor_wood;
    case 'U': return TILE_INDEX['upper_' + st.wall] ?? TILE_INDEX['walltop_' + st.wall] ?? TILE_INDEX.walltop_cream;
    case 'k': return hasLimezuFloor('checker') ? TILE_INDEX[`lzfloor_checker_${(x % 2) + 2 * (y % 2)}`] : varied('kitchen', x, y, 3);
    case 't': return hasLimezuFloor('tatami') ? TILE_INDEX[`lzfloor_tatami_${(x % 2) + 2 * (y % 2)}`] : varied('floor_tatami', x, y, 3);
    case 'm': return TILE_INDEX.mat;
    case 'g': return grassAt(x, y);
    case 'G': return varied('dgrass', x, y, 2);
    case 'p': {
      if (!def.outdoor || !hasJpPaths()) return varied('dirt', x, y, 3);
      // the path's edges grow grass only against grass: never toward paving, decks, sand or the district's border
      const along = (i: number, j: number) => { const ch = def.ground[y + j]?.[x + i]; return ch === undefined || 'pcbshCS'.includes(ch); };
      return TILE_INDEX['jpath' + ((along(0, -1) ? 1 : 0) | (along(1, 0) ? 2 : 0) | (along(0, 1) ? 4 : 0) | (along(-1, 0) ? 8 : 0))];
    }
    case 'c': return varied(def.id === 'plaza' && x >= 15 && x < 33 && y >= 8 && y < 21 ? 'civic' : 'cobble', x, y, 3);
    case 's': return varied('sand', x, y, 3);
    case 'h': return TILE_INDEX.shore;
    case 'w': return TILE_INDEX[`wtc${waterDepthAt(def.ground, x, y)}${waterVariant(x, y)}_0`];
    case 'd': return TILE_INDEX[`wtcd${waterVariant(x, y)}_0`];
    case 'b': return TILE_INDEX['bridge_' + bridgeMask(def.ground, x, y)];
    case 'r': return TILE_INDEX.bed_rose;
    case 'y': return TILE_INDEX.bed_gold;
    case 'l': return TILE_INDEX.bed_lav;
    case 'o': return varied('soil', x, y, 2);
    case 'S': return TILE_INDEX.station;
    case 'R': return TILE_INDEX.rail;
    case 'C': return TILE_INDEX[def.ground[y - 1]?.[x] !== 'C' ? 'cliff_top' : def.ground[y + 1]?.[x] !== 'C' ? 'cliff_foot' : 'cliff_face'];
    case 'x': return TILE_INDEX.void;
    default: return TILE_INDEX.void;
  }
}

/** Default furniture for each decor room the first time it's visited. */
const DEFAULT_DECOR: Record<string, [string, number, number, number?][]> = {
  dining: [
    // three tiles wide, with a gap between the chairs on each side, on the hall's grid (restaurant/stages.ts)
    ['table_long', 13, 7], ['chair_dark', 13, 8, 2], ['chair_dark', 15, 8, 2], ['chair_dark', 13, 6, 0], ['chair_dark', 15, 6, 0],
    ['table_long', 17, 7], ['chair_dark', 17, 8, 2], ['chair_dark', 19, 8, 2], ['chair_dark', 17, 6, 0], ['chair_dark', 19, 6, 0],
    ['table_low', 17, 11], ['cushion_indigo', 17, 10], ['cushion_rose', 18, 10], ['cushion_rose', 17, 12], ['cushion_indigo', 18, 12],
    ['bamboo_pot', 22, 7], ['andon', 14, 12], ['bamboo_pot', 7, 12],
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
  for (let i = 0; i < HOUSES.length; i++) {
    const h = HOUSES[i];
    game.once('decor_' + h.id, () => {
      const arr = game.room(h.id);
      if (arr.length) return;
      for (const [id, x, y, rot] of housePieces(h, i)) arr.push({ uid: game.uid(), id, x, y, rot: rot ?? 0 });
    });
  }
  // An extra fold-out bed for shared residences. Append only; never move existing furniture.
  for (const [id, home] of Object.entries(EXTRA_HOMES)) {
    if (game.has('resident_futon_' + id)) continue;
    const pieces = game.room(home), zone = ZONES[home];
    if (!zone || !pieces.length) continue;
    const g = new Grid(zone.w, zone.h);
    for (let y = 0; y < zone.h; y++) for (let x = 0; x < zone.w; x++) g.setSolid(x, y, !'ftkm'.includes(zone.ground[y][x]));
    for (const f of pieces) {
      const d = FURN_BY_ID[f.id]; if (!d || d.wall || d.walkable) continue;
      const s = furnSize(d, f.rot);
      for (let y = f.y; y < f.y + s.h; y++) for (let x = f.x; x < f.x + s.w; x++) g.setSolid(x, y, true);
    }
    const size = furnSize(FURN_BY_ID.futon_indigo, 1);
    let placed = false;
    for (let y = 4; y >= 2 && !placed; y--) for (let x = 1; x <= 7 && !placed; x++) {
      const tiles: [number, number][] = [];
      for (let dy = 0; dy < size.h; dy++) for (let dx = 0; dx < size.w; dx++) tiles.push([x + dx, y + dy]);
      if (tiles.some(([tx, ty]) => g.isSolid(tx, ty)) || g.isSolid(x, y + size.h)) continue;
      if (tiles.some(([tx, ty]) => tx === 5 && ty === 5)) continue;
      if (zone.doors.some(d => tiles.some(([tx, ty]) => Math.abs(d.x - tx) + Math.abs(d.y - ty) <= 1))) continue;
      const trial = g.clone(); for (const [tx, ty] of tiles) trial.setSolid(tx, ty, true);
      const door = zone.doors[0];
      if (!trial.path(door.x, door.y, x, y + size.h)) continue;
      if (pieces.some(f => {
        const d = FURN_BY_ID[f.id]; if (!d || !['bed', 'futon'].includes(d.kind)) return false;
        const s = furnSize(d, f.rot), fy = f.y + s.h;
        return !g.isSolid(f.x, fy) && (trial.isSolid(f.x, fy) || !trial.path(door.x, door.y, f.x, fy));
      })) continue;
      const uid = game.uid(); pieces.push({ uid, id: 'futon_indigo', x, y, rot: 1 });
      game.setFlag('resident_futon_' + id, uid); placed = true;
    }
  }
  widenSavedTables();
  spreadSavedTables();
  applyStageGrants(); // after the defaults (and the moves of older halls), so the new tables never land on them
  settleStoredGifts();
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

/**
 * The hall grew to 24 tiles and its tables moved onto a grid with aisles. In older saves, every group the game placed
 * (default tables, stage tables, the tatami) that is still exactly where the game left it moves to its new place;
 * anything the player arranged stays where it is.
 */
type Piece = [id: string, x: number, y: number];
const SPREAD: { from: Piece[]; to: Piece[] }[] = [
  { from: [['table_long', 12, 7], ['chair_dark', 12, 6], ['chair_dark', 14, 6], ['chair_dark', 12, 8], ['chair_dark', 14, 8]],
    to: [['table_long', 17, 7], ['chair_dark', 17, 6], ['chair_dark', 19, 6], ['chair_dark', 17, 8], ['chair_dark', 19, 8]] },
  { from: [['table_long', 7, 8], ['chair_dark', 7, 7], ['chair_dark', 9, 7], ['chair_dark', 7, 9], ['chair_dark', 9, 9]],
    to: [['table_long', 13, 7], ['chair_dark', 13, 6], ['chair_dark', 15, 6], ['chair_dark', 13, 8], ['chair_dark', 15, 8]] },
  { from: [['table_low', 15, 10], ['cushion_indigo', 15, 9], ['cushion_rose', 16, 9], ['cushion_rose', 15, 11], ['cushion_indigo', 16, 11]],
    to: [['table_low', 17, 11], ['cushion_indigo', 17, 10], ['cushion_rose', 18, 10], ['cushion_rose', 17, 12], ['cushion_indigo', 18, 12]] },
  { from: [['table_dark', 10, 10], ['chair_dark', 10, 9], ['chair_dark', 11, 9], ['chair_dark', 10, 11], ['chair_dark', 11, 11]],
    to: [['table_long', 3, 7], ['chair_dark', 3, 6], ['chair_dark', 5, 6], ['chair_dark', 3, 8], ['chair_dark', 5, 8]] },
  { from: [['table_dark', 13, 10], ['chair_dark', 13, 9], ['chair_dark', 14, 9], ['chair_dark', 13, 11], ['chair_dark', 14, 11]],
    to: [['table_long', 11, 11], ['chair_dark', 11, 10], ['chair_dark', 13, 10], ['chair_dark', 11, 12], ['chair_dark', 13, 12]] },
  { from: [['table_round', 15, 7], ['chair_dark', 15, 6], ['chair_dark', 15, 8]], to: [['table_round', 4, 11], ['chair_dark', 4, 10], ['chair_dark', 4, 12]] },
  { from: [['lantern_red', 10, 6]], to: [['lantern_red', 22, 12]] },
  { from: [['bamboo_pot', 16, 6]], to: [['bamboo_pot', 22, 7]] },
  { from: [['andon', 11, 12]], to: [['andon', 14, 12]] },
];
function spreadSavedTables() {
  game.once('dining_spread_v1', () => {
    const room = game.room('dining');
    const covers = (f: PlacedFurniture, x: number, y: number) => {
      const d = FURN_BY_ID[f.id];
      if (!d) return false;
      const s = furnSize(d, f.rot);
      return x >= f.x && x < f.x + s.w && y >= f.y && y < f.y + s.h;
    };
    // every group found intact moves together; each target is checked against what stays in place
    const found = SPREAD.map((g) => g.from.map(([id, x, y]) => room.find((f) => f.id === id && f.x === x && f.y === y && (f.rot ?? 0) % 2 === 0)));
    const moving = new Set(found.filter((fs) => fs.every(Boolean)).flat() as PlacedFurniture[]);
    found.forEach((fs, i) => {
      if (!fs.every(Boolean)) return;
      const to = SPREAD[i].to;
      const clear = to.every(([id, x, y]) => {
        const s = furnSize(FURN_BY_ID[id], 0);
        for (let j = 0; j < s.h; j++) for (let k = 0; k < s.w; k++) if (room.some((f) => !moving.has(f) && covers(f, x + k, y + j))) return false;
        return true;
      });
      if (!clear) { fs.forEach((f) => moving.delete(f!)); return; }
      fs.forEach((f, n) => { f!.id = to[n][0]; f!.x = to[n][1]; f!.y = to[n][2]; });
      syncWideDining(fs[0]!.uid, fs[0]!.x, fs[0]!.y, fs.slice(1) as PlacedFurniture[]);
    });
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
      // Chairs can be walked through. Tables, walls and every other solid piece stay blocked.
      if (fd.kind === 'chair') continue;
      for (const [x, y] of furnitureSolidTiles(f, fd)) grid.setSolid(x, y, true);
    }
  }
  // only walk-through doors are cleared; interactable/wall doors remain solid
  for (const d of def.doors) {
    if (d.walk) grid.setSolid(d.x, d.y, !!d.lock && !game.has(d.lock.flag));
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

  const queue = [{ zone: fromZone, first: null as null | { x: number; y: number; to: string } }];
  const seen = new Set([fromZone]);
  for (let n = 0; n < queue.length; n++) for (const d of ZONES[queue[n].zone]?.doors ?? []) {
    if (seen.has(d.to)) continue;
    const first = queue[n].first ?? { x: d.x, y: d.y, to: d.to };
    if (d.to === toZone) return first;
    seen.add(d.to); queue.push({ zone: d.to, first });
  }
  return null;
}
