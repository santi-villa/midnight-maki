/**
 * Furniture gifts for neighbours and the three raccoons.
 * A piece is placed by its kind, or stored with an explanation when the room has no spot.
 * Only the first two liked gifts give friendship, and only one gift of any kind per day.
 */
import { BALANCE } from '../core/balance';
import { bus } from '../core/events';
import { game } from '../core/state';
import { FURN_BY_ID, furnSize, type FurnitureDef } from '../data/furniture';
import { HOUSES } from '../data/houses';
import { houseDoorPlan, houseReserved } from '../data/houseInterior';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { ZONES, type RoomDef } from '../data/zones';
import { Grid } from './grid';
import { buildZone } from './zoneRuntime';

const NEUTRAL_AT = 40;
const BOND_CAP = 2;
const LOVE_POINTS = 6;
const LIKE_POINTS = 3;

const RACCOON_DOOR: Record<string, [number, number]> = {
  pip: [11, 7],
  spicy: [18, 7],
  rigg: [25, 7],
};

interface Taste { love: string[]; like: string[]; dislike: string[] }

const TASTE: Record<string, Taste> = {
  ren: { love: ['chest_wood', 'stool', 'wardrobe_wood', 'desk_wood', 'shelf_kitchen'], like: ['shelf', 'wardrobe', 'chest', 'desk', 'stool'], dislike: [] },
  haru: { love: ['bookstack', 'shelf_books', 'shelf_dark', 'desk_wood', 'lamp_table'], like: ['shelf', 'bookstack', 'desk', 'tablelamp'], dislike: ['aquarium'] },
  tomo: { love: ['aquarium'], like: ['aquarium', 'plant', 'tallplant', 'cactus', 'bonsai', 'vase', 'bamboo'], dislike: ['piano'] },
  nene: { love: ['vase_tulips', 'vase_lav', 'bonsai', 'plant_fern', 'plant_monstera'], like: ['plant', 'tallplant', 'vase', 'bonsai', 'cactus', 'bamboo'], dislike: [] },
  goro: { love: ['futon_indigo', 'futon_rose', 'table_low', 'cushion_rose', 'cushion_indigo', 'andon'], like: ['futon', 'cushion', 'table', 'andon'], dislike: ['easel'] },
  fuyu: { love: ['tea_set', 'table_low', 'futon_indigo', 'cushion_rose', 'andon', 'lantern_cream'], like: ['tea', 'table', 'futon', 'cushion', 'andon', 'paperlantern'], dislike: ['aquarium'] },
  sato: { love: ['desk_wood', 'desk_dark', 'clock'], like: ['desk', 'clock'], dislike: [] },
  mame: { love: ['shelf_kitchen', 'tea_set', 'table_round'], like: ['shelf', 'tea', 'table', 'roundtable'], dislike: [] },
  kai: { love: ['easel', 'photo_frame', 'pt_landscape'], like: ['easel', 'frame', 'painting'], dislike: [] },
  rin: { love: ['bench_wood', 'plant_fern'], like: ['bench', 'plant', 'tallplant', 'cactus', 'bonsai', 'vase', 'bamboo'], dislike: ['piano', 'aquarium'] },
  oto: { love: ['piano', 'radio'], like: ['piano', 'radio'], dislike: [] },
  mika: { love: ['lamp_rose', 'plush_cat', 'rug_stripes'], like: ['plush', 'floorlamp', 'rug'], dislike: [] },
  pip: { love: [], like: ['plush', 'cushion', 'bed', 'futon'], dislike: [] },
  spicy: { love: [], like: ['plant', 'tallplant', 'vase', 'bonsai', 'bamboo', 'cactus', 'shelf', 'table', 'roundtable'], dislike: [] },
  rigg: { love: [], like: ['shelf', 'bookstack', 'desk', 'floorlamp'], dislike: [] },
};

const LOVE_LINE: Record<string, string> = {
  ren: 'Esto lo voy a usar. Se nota que está bien hecho.',
  mika: '¡Ay, qué lindo! Queda perfecto en mi casa.',
  haru: '¿En serio es para mí? Gracias. Lo voy a cuidar.',
  tomo: '¡Mirá eso! Me va a acompañar después de la marea.',
  nene: '¡Qué color! Mis plantas van a estar celosas.',
  goro: 'En mis tiempos un regalo así era para toda la vida. Gracias.',
  fuyu: 'Shh... qué lindo. De noche se va a ver mejor.',
  sato: '¡Lo dejo en el camino y ya está en su lugar! Gracias.',
  mame: 'Huele a casa. Gracias, de verdad.',
  kai: 'La luz le queda bien. Me diste ganas de sacarle una foto.',
  rin: 'Liviano y útil. Me gusta.',
  oto: 'Mm... ya le estoy buscando la melodía.',
  pip: '¡Es para mi cuarto! Lo voy a mirar todo el día.',
  spicy: 'Esto sí que tiene carácter. Va en mi cocina.',
  rigg: 'Interesante. Le busco el lugar exacto.',
};

const STORED = 'Ahora no entra. Lo guardo y lo pongo cuando haya lugar.';

export type FurnGiftReason = 'unknown' | 'missing' | 'not_close' | 'daily' | 'dislike' | 'style' | 'placed' | 'stored';

export interface FurnGiftResult {
  ok: boolean;
  reason: FurnGiftReason;
  line: string;
  points: number;
  levelUp: number;
}

export interface GiftSpot { x: number; y: number; rot: number }

interface GiftHome {
  zone: string;
  room: string;
  reserved: [number, number][];
  start: [number, number];
  /** Neighbour stand tile. Raccoon rooms have none. */
  home: [number, number] | null;
  door: [number, number];
}

const fail = (reason: FurnGiftReason, line: string): FurnGiftResult => ({ ok: false, reason, line, points: 0, levelUp: 0 });

export function giftHome(id: string): GiftHome | null {
  const door = RACCOON_DOOR[id];
  if (door) {
    return { zone: 'home', room: 'room_' + id, reserved: [door], start: door, home: null, door };
  }
  const n = NEIGHBOR_BY_ID[id];
  const h = n && HOUSES.find((house) => house.id === n.home);
  if (!h) return null;
  const plan = houseDoorPlan(h);
  return {
    zone: h.id,
    room: h.id,
    reserved: houseReserved(h),
    start: [plan.spawnX, plan.spawnY],
    home: [5, 5],
    door: [plan.x, plan.y],
  };
}

export function furnitureWelcome(npcId: string, furnId: string): 'love' | 'like' | 'dislike' | 'neutral' | null {
  const def = FURN_BY_ID[furnId];
  if (!def || !giftHome(npcId)) return null;
  const taste = TASTE[npcId] ?? { love: [], like: [], dislike: [] };
  if (def.likes?.includes(npcId) || taste.love.includes(furnId)) return 'love';
  if (taste.dislike.includes(def.kind)) return 'dislike';
  if (taste.like.includes(def.kind)) return 'like';
  return 'neutral';
}

function reactionLine(npcId: string, reaction: 'love' | 'like' | 'neutral', stored: boolean): string {
  const base = reaction === 'love' ? (LOVE_LINE[npcId] ?? 'Esto me encanta.')
    : reaction === 'like' ? 'Me gusta. Le busco un lugar.'
      : 'No es muy de mi estilo, pero lo acepto.';
  return stored ? `${base} ${STORED}` : base;
}

function takeOwned(id: string): boolean {
  const n = game.save.furnitureOwned[id] ?? 0;
  if (n <= 0) return false;
  if (n === 1) delete game.save.furnitureOwned[id];
  else game.save.furnitureOwned[id] = n - 1;
  return true;
}

function bondCount(id: string): number {
  const raw = game.flag('furn_bond_' + id);
  return typeof raw === 'number' ? raw : 0;
}

export function giftFurniture(npcId: string, furnId: string): FurnGiftResult {
  const home = giftHome(npcId);
  const def = FURN_BY_ID[furnId];
  if (!home || !def) return fail('unknown', 'No sabría qué hacer con eso.');
  const welcome = furnitureWelcome(npcId, furnId)!;
  const points = game.save.relationships[npcId]?.points ?? 0;
  if (points < BALANCE.talkPoints) return fail('not_close', 'Recién nos conocemos. Mejor otro día.');
  const rel = game.save.relationships[npcId];
  if (rel && rel.lastGiftDay === game.save.time.day) return fail('daily', 'Hoy ya me diste algo. Mañana, si querés.');
  if (welcome === 'dislike') return fail('dislike', 'No, eso no va conmigo. Quedátelo.');
  if (welcome === 'neutral' && points < NEUTRAL_AT) return fail('style', 'No es muy de mi estilo.');
  if (!takeOwned(furnId)) return fail('missing', 'Parece que ya no lo tenés.');

  const r = game.rel(npcId);
  r.lastGiftDay = game.save.time.day;
  game.stat('gifts');
  let gained = 0;
  if ((welcome === 'love' || welcome === 'like') && bondCount(npcId) < BOND_CAP) {
    gained = welcome === 'love' ? LOVE_POINTS : LIKE_POINTS;
    game.setFlag('furn_bond_' + npcId, bondCount(npcId) + 1);
  }
  const levelUp = gained ? game.addFriendship(npcId, gained) : 0;
  settleStoredGifts();
  const spot = findGiftSpot(npcId, furnId);
  if (spot) {
    game.room(home.room).push({ uid: game.uid(), id: furnId, x: spot.x, y: spot.y, rot: spot.rot });
    bus.emit('decor:changed', { room: home.room });
    game.touch('furn-gift');
    return { ok: true, reason: 'placed', line: reactionLine(npcId, welcome, false), points: gained, levelUp };
  }
  const bag = (game.save.storedGifts ??= {});
  (bag[npcId] ??= []).push(furnId);
  game.touch('furn-gift');
  return { ok: true, reason: 'stored', line: reactionLine(npcId, welcome, true), points: gained, levelUp };
}

/** Put away gifts that were waiting for a free tile. Safe to call on every boot. */
export function settleStoredGifts() {
  const bag = game.save.storedGifts;
  if (!bag) return;
  for (const [npc, ids] of Object.entries(bag)) {
    if (!Array.isArray(ids) || !ids.length) {
      delete bag[npc];
      continue;
    }
    const home = giftHome(npc);
    const left: string[] = [];
    let placed = false;
    for (const id of ids) {
      if (!home || !FURN_BY_ID[id]) {
        left.push(id);
        continue;
      }
      const spot = findGiftSpot(npc, id);
      if (!spot) {
        left.push(id);
        continue;
      }
      game.room(home.room).push({ uid: game.uid(), id, x: spot.x, y: spot.y, rot: spot.rot });
      placed = true;
    }
    if (left.length) bag[npc] = left;
    else delete bag[npc];
    if (placed && home) bus.emit('decor:changed', { room: home.room });
  }
}

const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x: number, y: number) => `${x},${y}`;

interface PlaceCtx {
  roomId: string;
  room: RoomDef;
  ground: string[];
  reserved: Set<string>;
  occupied: Set<string>;
  grid: Grid;
  start: [number, number];
  home: [number, number] | null;
  door: [number, number];
  minFloorY: number;
  floor: [number, number][];
}

function placeKind(def: FurnitureDef): 'wall' | 'bed' | 'storage' | 'table' | 'chair' | 'plant' | 'rug' | 'small' {
  if (def.wall) return 'wall';
  if (def.kind === 'bed' || def.kind === 'futon') return 'bed';
  if (def.kind === 'rug') return 'rug';
  if (def.kind === 'chair' || def.kind === 'stool' || def.kind === 'cushion') return 'chair';
  if (['shelf', 'wardrobe', 'desk', 'piano', 'aquarium', 'display', 'bench'].includes(def.kind)) return 'storage';
  if (def.kind === 'table' || def.kind === 'roundtable' || def.kind === 'kotatsu') return 'table';
  if (['plant', 'tallplant', 'cactus', 'bonsai', 'vase', 'bamboo'].includes(def.kind)) return 'plant';
  return 'small';
}

function cells(def: FurnitureDef, x: number, y: number, rot: number): [number, number][] {
  const size = furnSize(def, rot);
  const out: [number, number][] = [];
  for (let j = 0; j < size.h; j++) for (let i = 0; i < size.w; i++) out.push([x + i, y + j]);
  return out;
}

function contextFor(home: GiftHome): PlaceCtx | null {
  const def = ZONES[home.zone];
  const room = def?.rooms.find((r) => r.id === home.room);
  if (!def || !room) return null;
  const floor: [number, number][] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const ch = def.ground[y]?.[x];
      if (ch && 'ftk'.includes(ch)) floor.push([x, y]);
    }
  }
  if (!floor.length) return null;
  const occupied = new Set<string>();
  for (const f of game.save.decor[home.room] ?? []) {
    const fd = FURN_BY_ID[f.id];
    if (!fd) continue;
    for (const [x, y] of cells(fd, f.x, f.y, f.rot)) occupied.add(key(x, y));
  }
  return {
    roomId: home.room,
    room,
    ground: def.ground,
    reserved: new Set(home.reserved.map(([x, y]) => key(x, y))),
    occupied,
    grid: buildZone(home.zone).grid,
    start: home.start,
    home: home.home,
    door: home.door,
    minFloorY: Math.min(...floor.map(([, y]) => y)),
    floor,
  };
}

function freeFloor(ctx: PlaceCtx, x: number, y: number): boolean {
  const ch = ctx.ground[y]?.[x];
  if (!ch || !'ftk'.includes(ch)) return false;
  if (ctx.grid.isSolid(x, y) || ctx.occupied.has(key(x, y)) || ctx.reserved.has(key(x, y))) return false;
  return true;
}

function freeWall(ctx: PlaceCtx, x: number, y: number): boolean {
  if (y !== ctx.minFloorY - 1) return false;
  if (ctx.ground[y]?.[x] !== 'W') return false;
  if (ctx.occupied.has(key(x, y))) return false;
  return x >= ctx.room.x && x < ctx.room.x + ctx.room.w;
}

function keepsPaths(ctx: PlaceCtx, solids: [number, number][]): boolean {
  const g = ctx.grid.clone();
  for (const [x, y] of solids) g.setSolid(x, y, true);
  if (g.isSolid(ctx.start[0], ctx.start[1])) return false;
  const goals = [ctx.door];
  if (ctx.home) goals.push(ctx.home);
  for (const goal of goals) {
    if (g.isSolid(goal[0], goal[1])) return false;
    if (g.path(ctx.start[0], ctx.start[1], goal[0], goal[1], 4000) === null) return false;
  }
  const covered = new Set(solids.map(([x, y]) => key(x, y)));
  for (const [x, y] of ctx.floor) {
    if (covered.has(key(x, y)) || ctx.grid.isSolid(x, y)) continue;
    if (g.path(ctx.start[0], ctx.start[1], x, y, 4000) === null) return false;
  }
  return true;
}

function tablesIn(ctx: PlaceCtx): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (const f of game.save.decor[ctx.roomId] ?? []) {
    const d = FURN_BY_ID[f.id];
    if (!d || (d.kind !== 'table' && d.kind !== 'roundtable' && d.kind !== 'kotatsu')) continue;
    const size = furnSize(d, f.rot);
    out.push({ x: f.x, y: f.y, w: size.w, h: size.h });
  }
  return out;
}

function cornerScore(ctx: PlaceCtx, x: number, y: number): number {
  let n = 0;
  for (const [dx, dy] of ORTH) {
    const ch = ctx.ground[y + dy]?.[x + dx];
    if (!ch || !'ftk'.includes(ch) || ctx.grid.isSolid(x + dx, y + dy)) n++;
  }
  return n;
}

function origins(ctx: PlaceCtx, def: FurnitureDef): GiftSpot[] {
  const kind = placeKind(def);
  const rots = def.rotatable ? [0, 1, 2, 3] : [0];
  if (kind === 'chair') {
    const spots: GiftSpot[] = [];
    for (const t of tablesIn(ctx)) {
      for (let i = 0; i < t.w; i++) {
        spots.push({ x: t.x + i, y: t.y + t.h, rot: 2 });
        spots.push({ x: t.x + i, y: t.y - def.h, rot: 0 });
      }
      for (let j = 0; j < t.h; j++) {
        spots.push({ x: t.x + t.w, y: t.y + j, rot: 3 });
        spots.push({ x: t.x - def.w, y: t.y + j, rot: 1 });
      }
    }
    return spots;
  }
  if (kind === 'wall') {
    const spots: GiftSpot[] = [];
    for (let x = ctx.room.x; x < ctx.room.x + ctx.room.w; x++) spots.push({ x, y: ctx.minFloorY - 1, rot: 0 });
    return spots;
  }
  const floorYs = kind === 'bed' || kind === 'storage' ? [ctx.minFloorY] : [...new Set(ctx.floor.map(([, y]) => y))];
  const xs = [...new Set(ctx.floor.map(([x]) => x))];
  if (kind === 'bed' || kind === 'storage') xs.sort((a, b) => Math.abs(b - ctx.start[0]) - Math.abs(a - ctx.start[0]) || a - b);
  const spots: GiftSpot[] = [];
  for (const y of floorYs) for (const x of xs) for (const rot of rots) spots.push({ x, y, rot });
  if (kind === 'table' || kind === 'rug') {
    const cx = ctx.room.x + ctx.room.w / 2;
    const cy = ctx.room.y + ctx.room.h / 2;
    spots.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)));
  }
  if (kind === 'plant' || kind === 'small') {
    spots.sort((a, b) => cornerScore(ctx, b.x, b.y) - cornerScore(ctx, a.x, a.y) || a.y - b.y || a.x - b.x);
  }
  return spots;
}

/** First tile where this piece can live without sealing the door or the neighbour's spot. */
export function findGiftSpot(npcId: string, furnId: string): GiftSpot | null {
  const def = FURN_BY_ID[furnId];
  const home = giftHome(npcId);
  if (!def || !home) return null;
  const ctx = contextFor(home);
  if (!ctx) return null;
  if (placeKind(def) === 'chair' && !tablesIn(ctx).length) return null;
  const seen = new Set<string>();
  for (const spot of origins(ctx, def)) {
    const stamp = `${spot.x},${spot.y},${spot.rot}`;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    const footprint = cells(def, spot.x, spot.y, spot.rot);
    const open = def.wall ? footprint.every(([x, y]) => freeWall(ctx, x, y)) : footprint.every(([x, y]) => freeFloor(ctx, x, y));
    if (!open) continue;
    if (!def.wall && !def.walkable && !keepsPaths(ctx, footprint)) continue;
    return spot;
  }
  return null;
}

/** The pieces waiting in `furnitureOwned`. Resolves null when the player closes the list. */
export function pickFurnitureGift(): Promise<string | null> {
  return import('../ui/dom').then(({ h, panel }) => new Promise((resolve) => {
    const owned = Object.entries(game.save.furnitureOwned)
      .filter(([id, n]) => n > 0 && !!FURN_BY_ID[id])
      .sort((a, b) => (FURN_BY_ID[a[0]]?.name ?? a[0]).localeCompare(FURN_BY_ID[b[0]]?.name ?? b[0], 'es'));
    let chosen: string | null = null;
    const grid = h('div', { class: 'grid' });
    if (!owned.length) {
      grid.append(h('p', { class: 'muted', style: { padding: '16px', textAlign: 'center', gridColumn: '1 / -1' } }, 'No tenés muebles guardados.'));
    }
    for (const [id, n] of owned) {
      const furn = FURN_BY_ID[id];
      grid.append(h('button', {
        class: 'slot',
        onclick: () => {
          chosen = id;
          p.close();
        },
      }, h('span', null, furn?.name ?? id), h('span', { class: 'qty' }, n)));
    }
    const p = panel({ title: 'Regalar un mueble', body: grid, onClose: () => resolve(chosen) });
  }));
}
