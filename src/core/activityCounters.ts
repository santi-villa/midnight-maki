/** Shared progress counters for optional errands and restoration activities. */
import { game } from './state';

export function activityCount(key: string): number {
  if (key === 'handCooked') return Object.values(game.save.recipeMastery ?? {}).reduce((sum, m) => sum + (m.n || 0), 0);
  if (key === 'variantsPrepared') return Object.values(game.save.recipeRecords ?? {}).reduce((sum, r) => sum + Object.values(r.variants).reduce((n, v) => n + v.count, 0), 0);
  return game.save.stats[key] ?? 0;
}
