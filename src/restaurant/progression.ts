/** Total XP is never spent. The old `xp` field remains progress within the current level. */
import { BALANCE } from '../core/balance';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { SaveData } from '../core/types';

export function xpFloor(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += BALANCE.restaurantXpPerLevel(n);
  return total;
}
export function normalizeRestaurant(rs: SaveData['restaurant']) {
  rs.level = Math.max(1, Math.min(BALANCE.maxRestaurantLevel, Math.floor(Number(rs.level) || 1)));
  rs.xp = Math.max(0, Math.floor(Number.isFinite(rs.xp) ? rs.xp : 0));
  const floor = xpFloor(rs.level);
  // Old saves stored only the remainder. Recover XP used by every level they already earned.
  rs.totalXp = Number.isFinite(rs.totalXp) && rs.totalXp! >= floor ? Math.floor(rs.totalXp!) : floor + rs.xp;
  rs.xp = Math.max(0, rs.totalXp - floor);
  rs.reputation = Math.max(0, Math.floor(Number.isFinite(rs.reputation) ? rs.reputation : 0));
  if (!Array.isArray(rs.upgrades)) rs.upgrades = [];
  rs.upgrades = [...new Set(rs.upgrades.filter(id => typeof id === 'string'))];
}
export interface AdvanceCost { level: number; reputation: number; coins: number; items: Record<string, number> }
export const ADVANCES: AdvanceCost[] = [
  { level: 3, reputation: 18, coins: 100, items: { wood: 2 } },
  { level: 4, reputation: 35, coins: 160, items: { wood: 2, stone: 1 } },
  { level: 5, reputation: 55, coins: 220, items: { wood: 3, stone: 2 } },
  { level: 6, reputation: 80, coins: 280, items: { wood: 3, stone: 2 } },
  { level: 7, reputation: 105, coins: 340, items: { wood: 4, stone: 2 } },
  { level: 8, reputation: 135, coins: 400, items: { wood: 4, stone: 3 } },
  { level: 9, reputation: 165, coins: 460, items: { wood: 5, stone: 3 } },
  { level: 10, reputation: 200, coins: 520, items: { wood: 5, stone: 4 } },
];
export function nextAdvance() { return ADVANCES.find(c => c.level === game.save.restaurant.level + 1); }
export function advanceMissing(): string[] {
  const rs = game.save.restaurant, c = nextAdvance();
  if (!c) return [];
  const missing: string[] = [];
  if ((rs.totalXp ?? xpFloor(rs.level) + rs.xp) < xpFloor(c.level)) missing.push('Experiencia');
  if (rs.reputation < c.reputation) missing.push('Reputación');
  if (game.coins < c.coins) missing.push('Monedas');
  for (const [id, q] of Object.entries(c.items)) if (game.count(id) < q) missing.push(id === 'wood' ? 'Madera' : 'Piedra');
  return missing;
}

let committing = false;
/** Commit ownership and all resources before publishing any event, including synchronous listeners. */
export function payRenovation(coins: number, items: Record<string, number>, commit: () => void): boolean {
  if (committing || !Number.isFinite(coins) || coins < 0 || game.coins < coins ||
    Object.entries(items).some(([id, q]) => !Number.isInteger(q) || q < 0 || game.count(id) < q)) return false;
  committing = true;
  const save = game.save;
  try {
    save.coins -= coins;
    for (const [id, q] of Object.entries(items)) {
      save.inventory[id] -= q;
      if (!save.inventory[id]) delete save.inventory[id];
    }
    // Callers pass a synchronous in-memory commit; no events or asynchronous work here.
    commit();
    bus.emit('coins:changed', { coins: save.coins, delta: -coins });
    for (const [id, q] of Object.entries(items)) bus.emit('inventory:changed', { id, qty: save.inventory[id] ?? 0, delta: -q });
    game.touch('renovation');
    return true;
  } finally { committing = false; }
}
/** Expected level rejects stale/double taps. Each click buys exactly one ascent. */
export function advanceRestaurant(expectedLevel: number): boolean {
  normalizeRestaurant(game.save.restaurant);
  const c = nextAdvance();
  if (!c || c.level !== expectedLevel || advanceMissing().length) return false;
  return payRenovation(c.coins, c.items, () => {
    const rs = game.save.restaurant;
    rs.level = c.level;
    rs.xp = rs.totalXp! - xpFloor(rs.level);
  });
}
export function levelProgress(): number {
  const rs = game.save.restaurant;
  return rs.level >= BALANCE.maxRestaurantLevel ? 1 : Math.min(1, rs.xp / BALANCE.restaurantXpPerLevel(rs.level));
}
