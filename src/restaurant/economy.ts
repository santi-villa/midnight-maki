import { BALANCE } from '../core/balance';
import type { RecipeDef } from '../data/recipes';

/** Same walk-in payout for the preview and settlement; service remains its own path. */
export function freeCookCoins(recipe: Pick<RecipeDef, 'price'>, quality: 0 | 1 | 2, variantBonus = 0): number {
  return Math.round(recipe.price * BALANCE.freeCookMultiplier[quality]) + variantBonus;
}
