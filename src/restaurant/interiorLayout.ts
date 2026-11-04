import { game } from '../core/state';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import type { PlacedFurniture } from '../core/types';

export type InteriorPiece = [string, number, number, number?];
export const MAIN_TABLE: InteriorPiece[] = [['table_long', 11, 7], ['chair_dark', 11, 6], ['chair_dark', 13, 6], ['chair_dark', 11, 8, 2], ['chair_dark', 13, 8, 2]];
export const WINDOW_TABLE: InteriorPiece[] = [['table_long', 19, 6, 1], ['chair_dark', 18, 6, 1], ['chair_dark', 18, 8, 1], ['chair_dark', 20, 6, 3], ['chair_dark', 20, 8, 3]];
export const TATAMI_TABLE: InteriorPiece[] = [['table_low', 18, 11], ['cushion_indigo', 18, 10], ['cushion_rose', 19, 10], ['cushion_rose', 18, 12], ['cushion_indigo', 19, 12]];
export const LEFT_TABLE: InteriorPiece[] = [['table_long', 3, 8], ['chair_dark', 3, 7], ['chair_dark', 5, 7], ['chair_dark', 3, 9, 2], ['chair_dark', 5, 9, 2]];
export const DINING_DEFAULTS: InteriorPiece[] = [...MAIN_TABLE, ...WINDOW_TABLE, ...TATAMI_TABLE, ['bamboo_pot', 22, 7], ['andon', 22, 10], ['bamboo_pot', 7, 12]];

const old = (x: number, y: number): InteriorPiece[] => [['table_long', x, y], ['chair_dark', x, y - 1], ['chair_dark', x + 2, y - 1], ['chair_dark', x, y + 1, 2], ['chair_dark', x + 2, y + 1, 2]];
const moves: { from: InteriorPiece[]; to: InteriorPiece[] }[] = [
  { from: old(13, 7), to: MAIN_TABLE }, { from: old(17, 7), to: WINDOW_TABLE },
  { from: [['table_low', 17, 11], ['cushion_indigo', 17, 10], ['cushion_rose', 18, 10], ['cushion_rose', 17, 12], ['cushion_indigo', 18, 12]], to: TATAMI_TABLE },
  { from: old(3, 7), to: LEFT_TABLE }, { from: [['andon', 14, 12]], to: [['andon', 22, 10]] },
];

/** Only complete untouched sets move, atomically, retaining UID and ownership.
 * Occupied services wait until a later visit. Custom layouts are never inferred.
 */
export function restyleDining() {
  if (game.save.dining?.floor.parties.some(p => p.phase !== 'leaving')) return;
  game.once('dining_izakaya_v2', () => {
    const room = game.room('dining');
    const tiles = (f: Pick<PlacedFurniture, 'id' | 'x' | 'y' | 'rot'>) => {
      const d = FURN_BY_ID[f.id];
      if (!d || d.walkable || d.wall) return [];
      const s = furnSize(d, f.rot);
      return Array.from({ length: s.w * s.h }, (_, i) => `${f.x + i % s.w},${f.y + Math.floor(i / s.w)}`);
    };
    for (const move of moves) {
      const found = move.from.map(([id, x, y, rot = 0]) => room.find(f => f.id === id && f.x === x && f.y === y && f.rot === rot));
      if (found.some(f => !f)) continue;
      const pieces = found as PlacedFurniture[];
      const targets = move.to.map(([id, x, y, rot = 0], i) => ({ ...pieces[i], id, x, y, rot }));
      const occupied = new Set(room.filter(f => !pieces.includes(f)).flatMap(tiles));
      if (targets.some(f => tiles(f).some(t => occupied.has(t)))) continue;
      pieces.forEach((f, i) => Object.assign(f, targets[i]));
      const saved = game.save.dining?.floor.tables.find(t => t.id === String(pieces[0].uid));
      if (saved) {
        saved.x = pieces[0].x; saved.y = pieces[0].y;
        for (const seat of saved.seats) {
          const f = pieces.find(p => String(p.uid) === seat.id);
          if (f) { seat.x = f.x; seat.y = f.y; seat.rot = f.rot; }
        }
      }
    }
  });
}
