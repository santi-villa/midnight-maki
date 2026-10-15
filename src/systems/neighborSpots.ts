/**
 * Places a neighbour can spend time, read from the current map.
 * Benches, the fountain, the shore and the paths are found where they are now,
 * so moving those things on the map moves the routines with them.
 */
import type { Dir } from '../core/types';
import type { PlacedFurniture } from '../core/types';
import { game } from '../core/state';
import type { NpcAct } from '../data/characters';
import { FURN_BY_ID, furnSize, type FurnitureDef } from '../data/furniture';
import { REN_STALL, type Neighbor } from '../data/neighbors';
import { PROPS } from '../data/props';
import { ZONES, type DoorDef } from '../data/zones';

export interface Place {
  zone: string;
  x: number;
  y: number;
  act?: NpcAct;
  dir?: Dir;
  seatLift?: number;
  kind: string;
  /** Bed or futon to lie in once they are asleep. */
  bed?: { x: number; y: number; w: number; h: number };
}

const OPEN_GROUND = new Set(['g', 'G', 'p', 'c', 's', 'h', 'f', 't', 'k', 'm', 'o', 'b']);
const WATER = new Set(['w', 'd']);
const SEAT_KIND = new Set(['chair', 'stool']);
const BED_KIND = new Set(['bed', 'futon']);

const ground = (zone: string, x: number, y: number) => ZONES[zone]?.ground[y]?.[x] ?? '';

function propCovers(zone: string, x: number, y: number): boolean {
  for (const p of ZONES[zone]?.props ?? []) {
    if (p.cond) continue;
    const d = PROPS[p.id];
    if (!d?.solid) continue;
    if (x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h) return true;
  }
  return false;
}

export function tileOpen(zone: string, x: number, y: number): boolean {
  if (!OPEN_GROUND.has(ground(zone, x, y))) return false;
  if (propCovers(zone, x, y)) return false;
  const door = ZONES[zone]?.doors.some((d) => d.x === x && d.y === y && !d.walk);
  return !door;
}

function isDoor(zone: string, x: number, y: number): boolean {
  return !!ZONES[zone]?.doors.some((d) => d.x === x && d.y === y);
}

function nearDoor(zone: string, x: number, y: number): boolean {
  return !!ZONES[zone]?.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
}

function thin<T>(spots: T[], cap: number): T[] {
  if (spots.length <= cap) return spots;
  const step = spots.length / cap;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(spots[Math.floor(i * step)]);
  return out;
}

const BENCH_ZONES = ['plaza', 'beach', 'garden', 'library'];

/** Seat just south of a bench prop. The sprite is lifted onto the bench. */
export const benchSpots = (zone: string): Place[] =>
  (ZONES[zone]?.props ?? []).filter((p) => p.id === 'bench' && !p.cond).flatMap((p) => [0, 1].flatMap((i) => {
    const x = p.x + i;
    const y = p.y + 1;
    if (!tileOpen(zone, x, y) || isDoor(zone, x, y)) return [];
    const read = zone === 'library';
    return [{ zone, x, y, act: (read ? 'read' : 'sit') as NpcAct, dir: 'down' as Dir, seatLift: 12, kind: read ? 'read' : 'bench' }];
  }));

function beside(zone: string, x: number, y: number, w: number, h: number, kind: string, act: NpcAct): Place[] {
  const spots: Place[] = [];
  const push = (tx: number, ty: number, dir: Dir) => {
    if (!tileOpen(zone, tx, ty) || isDoor(zone, tx, ty) || nearDoor(zone, tx, ty)) return;
    spots.push({ zone, x: tx, y: ty, act, dir, kind });
  };
  for (let i = 0; i < w; i++) {
    push(x + i, y - 1, 'down');
    push(x + i, y + h, 'up');
  }
  for (let j = 0; j < h; j++) {
    push(x - 1, y + j, 'right');
    push(x + w, y + j, 'left');
  }
  return spots;
}

export function fountainSpots(zone = 'plaza'): Place[] {
  const spots: Place[] = [];
  for (const p of ZONES[zone]?.props ?? []) {
    if (p.cond || p.id !== 'fountain') continue;
    const d = PROPS[p.id];
    if (!d) continue;
    spots.push(...beside(zone, p.x, p.y, d.w, d.h, 'fountain', 'look'));
  }
  return thin(spots, 6);
}

/** Walkable tiles that touch the water, facing it. */
export function shoreSpots(zone: string): Place[] {
  const z = ZONES[zone];
  if (!z?.outdoor) return [];
  const spots: Place[] = [];
  for (let y = 1; y < z.h - 1; y++) for (let x = 1; x < z.w - 1; x++) {
    const ch = ground(zone, x, y);
    if (!'shpcb'.includes(ch) || !tileOpen(zone, x, y) || isDoor(zone, x, y)) continue;
    let dir: Dir | null = null;
    if (WATER.has(ground(zone, x, y - 1))) dir = 'up';
    else if (WATER.has(ground(zone, x, y + 1))) dir = 'down';
    else if (WATER.has(ground(zone, x - 1, y))) dir = 'left';
    else if (WATER.has(ground(zone, x + 1, y))) dir = 'right';
    if (!dir) continue;
    spots.push({ zone, x, y, act: 'look', dir, kind: 'sea' });
  }
  return thin(spots, 8);
}

/** Open path tiles, then grass if the zone has few paths. Spread out, away from doors. */
export function clearings(zone: string, kind: string, cap: number): Place[] {
  const z = ZONES[zone];
  if (!z) return [];
  const take = (chars: string) => {
    const spots: Place[] = [];
    const gap = 4;
    for (let y = 2; y < z.h - 2 && spots.length < cap; y += gap) {
      for (let x = 2; x < z.w - 2 && spots.length < cap; x += gap) {
        let found: Place | null = null;
        for (let dy = 0; dy < gap && !found; dy++) for (let dx = 0; dx < gap && !found; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (!chars.includes(ground(zone, tx, ty)) || !tileOpen(zone, tx, ty) || nearDoor(zone, tx, ty)) continue;
          found = { zone, x: tx, y: ty, act: 'look', dir: 'down', kind };
        }
        if (found) spots.push(found);
      }
    }
    return spots;
  };
  const paths = take('pcsohb');
  if (paths.length >= Math.min(4, cap)) return paths;
  const seen = new Set(paths.map((p) => `${p.x}:${p.y}`));
  const grass = take('gG').filter((p) => !seen.has(`${p.x}:${p.y}`));
  return [...paths, ...grass].slice(0, cap);
}

export const FOUNTAIN = fountainSpots('plaza');
export const SHORE = shoreSpots('beach');
export const GARDEN = clearings('garden', 'garden', 6);
export const FOREST = clearings('forest', 'forest', 6);
export const MARKET = clearings('market', 'market', 6);
export const STROLL = [...clearings('plaza', 'stroll', 12), ...clearings('beach', 'stroll', 4)];

/** One walkable look-around tile in a zone. Skips the tile they are already on. */
export function lookAround(zone: string, salt: number, avoid?: { x: number; y: number }): { x: number; y: number } | null {
  const pool = [...fountainSpots(zone), ...shoreSpots(zone), ...clearings(zone, 'stroll', 12)]
    .filter((p) => !avoid || p.x !== avoid.x || p.y !== avoid.y);
  if (!pool.length) return null;
  const p = pool[Math.abs(salt) % pool.length];
  return { x: p.x, y: p.y };
}

function entryDoor(zone: string): DoorDef | null {
  const fromPlaza = ZONES.plaza?.doors.find((d) => d.to === zone && d.walk !== false);
  if (fromPlaza) return fromPlaza;
  for (const z of Object.values(ZONES)) {
    const d = z.doors.find((door) => door.to === zone && door.walk !== false);
    if (d) return d;
  }
  return null;
}

/** Just inside a shop, on a free tile off the mat, facing the way the door leaves them. */
export function shopSpot(zone: string): Place | null {
  if (zone === 'plaza_ren') return { zone: 'plaza', x: REN_STALL.x + 1, y: REN_STALL.y + 1, act: 'work', dir: 'up', kind: 'shop' };
  const door = entryDoor(zone);
  if (!door || !ZONES[zone]) return null;
  const opts: [number, number][] = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0]];
  let x = door.tx;
  let y = door.ty;
  for (const [dx, dy] of opts) {
    const tx = door.tx + dx;
    const ty = door.ty + dy;
    if (tileOpen(zone, tx, ty) && !isDoor(zone, tx, ty)) { x = tx; y = ty; break; }
  }
  return { zone, x, y, act: zone === 'library' ? 'read' : 'work', dir: door.dir, kind: 'shop' };
}

export const homeSpot = (n: Neighbor): Place => ({ zone: n.home, x: 5, y: 5, kind: 'home' });

interface Piece { f: PlacedFurniture; d: FurnitureDef }

function piecesIn(zone: string): Piece[] {
  const out: Piece[] = [];
  for (const f of game.save.decor?.[zone] ?? []) {
    const d = FURN_BY_ID[f.id];
    if (d) out.push({ f, d });
  }
  return out;
}

function covered(pieces: Piece[], x: number, y: number): boolean {
  for (const { f, d } of pieces) {
    if (d.walkable || d.wall) continue;
    const s = furnSize(d, f.rot);
    if (x >= f.x && x < f.x + s.w && y >= f.y && y < f.y + s.h) return true;
  }
  return false;
}

function standSouth(zone: string, pieces: Piece[], x: number, y: number, w: number, h: number): { x: number; y: number } | null {
  for (let i = 0; i < w; i++) {
    const tx = x + i;
    const ty = y + h;
    if (tileOpen(zone, tx, ty) && !covered(pieces, tx, ty) && !isDoor(zone, tx, ty)) return { x: tx, y: ty };
  }
  return null;
}

/** At home: sleep by the bed at night, sit or read by a chair during the day. */
export function homeActivity(n: Neighbor, period: number): Place {
  const sleepy = period === 3 || (period === 0 && n.traits.includes('nocturnal'));
  const base: Place = {
    zone: n.home, x: 5, y: 5, kind: 'home', dir: 'down',
    act: sleepy ? 'sleep' : n.likes.includes('read') ? 'read' : 'look',
  };
  const pieces = piecesIn(n.home);
  if (sleepy) {
    const bed = pieces.find((p) => BED_KIND.has(p.d.kind));
    if (bed) {
      const s = furnSize(bed.d, bed.f.rot);
      const feet = standSouth(n.home, pieces, bed.f.x, bed.f.y, s.w, s.h);
      if (feet) return { ...base, ...feet, act: 'sleep', dir: 'up', bed: { x: bed.f.x, y: bed.f.y, w: s.w, h: s.h } };
    }
    return base;
  }
  const seats = pieces.filter((p) => SEAT_KIND.has(p.d.kind) || p.d.kind === 'bench');
  for (const seat of seats) {
    const s = furnSize(seat.d, seat.f.rot);
    const feet = standSouth(n.home, pieces, seat.f.x, seat.f.y, s.w, s.h);
    if (!feet) continue;
    const reading = n.likes.includes('read');
    return { ...base, ...feet, act: reading ? 'read' : 'sit', dir: 'up', seatLift: 10 };
  }
  const mark = pieces.find((p) => !p.d.wall);
  if (!mark) return base;
  const dx = mark.f.x - base.x;
  const dy = mark.f.y - base.y;
  const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  return { ...base, dir };
}

export const allBenches = () => BENCH_ZONES.flatMap(benchSpots);

/** A free tile one or two steps from a stroll anchor. The same id always picks the same step. */
export function lingerTile(id: string, x: number, y: number, open: (x: number, y: number) => boolean): [number, number] | null {
  const opts: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  const free = opts.filter(([dx, dy]) => open(x + dx, y + dy));
  if (!free.length) return null;
  let h = 17;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  const [dx, dy] = free[h % free.length];
  return [x + dx, y + dy];
}

export const LINGER_KIND = new Set(['stroll']);
