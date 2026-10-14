/** Small additions to the existing bedrooms. No furniture is removed or moved. */
import { game } from '../core/state';
import { bus } from '../core/events';
import type { PlacedFurniture } from '../core/types';
import type { RoutineStop } from '../data/characters';
import { FURN_BY_ID } from '../data/furniture';
import { ZONES } from '../data/zones';
import { buildZone, ensureDefaultDecor, placementKeepsPaths } from '../world/zoneRuntime';

export const CORNERS = [
  { id: 'pip', title: 'Rincón de tesoros de Pip', first: 'pip_corner', second: 'pip_corner2', act: 'play' as const,
    base: [['cushion_rose', 12, 5], ['chest_wood', 13, 5]], extra: [['plush_cat', 12, 4], ['photo_frame', 13, 4]], at: [12, 5], more: [[11, 5], [12, 6]] },
  { id: 'spicy', title: 'Rincón de sabores de Spicy', first: 'spicy_corner', second: 'spicy_corner2', act: 'drink' as const,
    base: [['table_round', 18, 5], ['plant_herbs', 19, 4]], extra: [['tea_set', 20, 5], ['pt_sushi', 17, 1]], at: [18, 6], more: [[17, 6], [19, 6]] },
  { id: 'rigg', title: 'Rincón de lectura de Rigg', first: 'rigg_corner', second: 'rigg_corner2', act: 'read' as const,
    base: [['desk_wood', 24, 5], ['cushion_indigo', 24, 6]], extra: [['photo_frame', 26, 5], ['pt_stars', 24, 1]], at: [24, 6], more: [[23, 6], [25, 6]] },
] as const;
export function cornerForUpgrade(id: string) { return CORNERS.find(c => c.first === id || c.second === id); }
export function hasCorner(id: string) { const c = CORNERS.find(c => c.id === id); return !!c && game.save.restaurant.upgrades.includes(c.first); }
export function cornerStop(id: string): RoutineStop | undefined {
  const c = CORNERS.find(c => c.id === id);
  if (!c || !hasCorner(id)) return;
  return { zone: 'home', x: c.at[0], y: c.at[1], alternatives: c.more.map(([x, y]) => [x, y]), wander: 0, act: c.act, dir: 'up' };
}

/** Prepare a footprint-safe plan before any payment. An occupied old room keeps all its contents. */
export function planCorner(id: string): Omit<PlacedFurniture, 'uid'>[] | null {
  const c = cornerForUpgrade(id);
  if (!c) return [];
  ensureDefaultDecor();
  const list = id === c.first ? c.base : c.extra;
  const planned: PlacedFurniture[] = [];
  const room = game.room('room_' + c.id), def = ZONES.home.rooms.find(r => r.id === 'room_' + c.id)!;
  const original = [...room];
  try {
    for (const [fid, x, y] of list) {
      const f = FURN_BY_ID[fid];
      if (x <= def.x || x + f.w >= def.x + def.w || y < 1 || y + f.h >= def.h) return null;
      const cand = { id: fid, x, y, rot: 0, uid: -1 - planned.length };
      if (room.some(p => { const d = FURN_BY_ID[p.id]; return d && x < p.x + d.w && x + f.w > p.x && y < p.y + d.h && y + f.h > p.y; })) return null;
      if (!placementKeepsPaths('home', def.id, cand)) return null;
      planned.push(cand); room.push(cand);
    }
    const grid = buildZone('home').grid;
    if (grid.isSolid(c.at[0], c.at[1]) || !grid.path(14, 9, c.at[0], c.at[1])) return null;
    return planned.map(({ uid: _, ...p }) => p);
  } finally { room.splice(0, room.length, ...original); }
}
export function installCorner(id: string, plan: Omit<PlacedFurniture, 'uid'>[]) {
  const c = cornerForUpgrade(id); if (!c) return;
  for (const p of plan) {
    const placed = { ...p, uid: game.uid() };
    game.room('room_' + c.id).push(placed);
    const target = c.id === 'pip' ? c.base[0] : c.base[1];
    if (id === c.first && p.x === target[1] && p.y === target[2]) game.save.flags['corner_accent_uid_' + c.id] = placed.uid;
  }
}

/** Accent chooses only a furniture addition owned by this renovation. Old room decor stays intact. */
export function setCornerAccent(id: string, accent: 'rose' | 'indigo'): boolean {
  const c = CORNERS.find(c => c.id === id);
  if (!c || !hasCorner(id) || !['rose', 'indigo'].includes(accent)) return false;
  const piece = game.room('room_' + id).find(f => f.uid === game.flag('corner_accent_uid_' + id));
  if (!piece) return false;
  piece.id = id === 'spicy' ? accent === 'rose' ? 'plant_herbs' : 'bonsai' : 'cushion_' + accent;
  game.touch('corner:accent'); bus.emit('decor:changed', { room: 'room_' + id });
  return true;
}
