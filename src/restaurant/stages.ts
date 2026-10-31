/**
 * The four looks of Midnight Maki, driven by the restaurant level (the ten levels stay as they are):
 *   0 inherited (1-2)  ·  1 recovered (3-4)  ·  2 popular (5-7)  ·  3 heart of Villa Nori (8-10)
 * Pure, so the map, the lights and the tests can all ask the same question.
 */
export type RestaurantStage = 0 | 1 | 2 | 3;

export function stageForLevel(level: number): RestaurantStage {
  if (level >= 8) return 3;
  if (level >= 5) return 2;
  if (level >= 3) return 1;
  return 0;
}

export const STAGE_NAMES = ['Restaurante heredado', 'Restaurante recuperado', 'Restaurante popular', 'Corazón de Villa Nori'] as const;

// ------------------------------------------------------------------ what each stage brings into the hall
import { game } from '../core/state';
import { bus } from '../core/events';
import { FURN_BY_ID, furnSize } from '../data/furniture';

/** [furniture id, x, y, rotation]: tables with their chairs (placed once, never over the player's own furniture). */
export const STAGE_GRANTS: Record<number, [string, number, number, number?][]> = {
  // A grid of table blocks (a chair row, the table, a chair row) with a one-tile aisle between blocks; the columns
  // x = 8..9 in front of the door, row 9 and the tiles under the kitchen gates stay free on purpose.
  1: [['table_long', 3, 7], ['chair_dark', 3, 6, 0], ['chair_dark', 5, 6, 0], ['chair_dark', 3, 8, 2], ['chair_dark', 5, 8, 2]],
  2: [['table_long', 11, 11], ['chair_dark', 11, 10, 0], ['chair_dark', 13, 10, 0], ['chair_dark', 11, 12, 2], ['chair_dark', 13, 12, 2], ['lantern_red', 7, 6]],
  3: [['table_round', 4, 11], ['chair_dark', 4, 10, 0], ['chair_dark', 4, 12, 2]],
};

const DINING = { x: 3, y: 6, w: 20, h: 7 };

/** Hands the hall its new tables for every stage reached so far. Safe to call any number of times. */
export function applyStageGrants(): boolean {
  const stage = stageForLevel(game.save.restaurant.level);
  let changed = false;
  for (let s = 1; s <= stage; s++) {
    game.once('stage_grant_' + s, () => {
      const room = game.room('dining');
      const taken = new Set<string>();
      for (const f of room) {
        const d = FURN_BY_ID[f.id];
        const size = d ? furnSize(d, f.rot) : { w: 1, h: 1 };
        for (let j = 0; j < size.h; j++) for (let i = 0; i < size.w; i++) taken.add(`${f.x + i},${f.y + j}`);
      }
      for (const [id, x, y, rot] of STAGE_GRANTS[s] ?? []) {
        const d = FURN_BY_ID[id];
        if (!d) continue;
        const size = furnSize(d, rot ?? 0);
        const tiles: string[] = [];
        let ok = x >= DINING.x && y >= DINING.y && x + size.w <= DINING.x + DINING.w && y + size.h <= DINING.y + DINING.h;
        for (let j = 0; j < size.h && ok; j++) for (let i = 0; i < size.w; i++) tiles.push(`${x + i},${y + j}`);
        if (ok && tiles.some((t) => taken.has(t))) ok = false;
        if (ok) {
          room.push({ uid: game.uid(), id, x, y, rot: rot ?? 0 });
          for (const t of tiles) taken.add(t);
        } else game.save.furnitureOwned[id] = (game.save.furnitureOwned[id] ?? 0) + 1; // never lost: it waits in the storage
      }
      changed = true;
    });
  }
  if (changed) bus.emit('decor:changed', { room: 'dining' });
  return changed;
}
