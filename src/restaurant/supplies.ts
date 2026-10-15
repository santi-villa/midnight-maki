/**
 * Restaurant supplies: ingredients come from shops in units, packs or boxes (or from gathering and fishing),
 * are carried in the backpack and kept in the kitchen pantry, which has a capacity. Cooking uses the pantry first.
 */
import { game } from '../core/state';
import { ITEMS_BY_ID, PACKS, PACKS_BY_ID } from '../data/items';
import { RECIPES } from '../data/recipes';
import type { RecipeDef } from '../data/recipes';

export const BASE_CAPACITY = 60;
export const UPGRADED_CAPACITY = 140;

export const SUPPLY_GROUPS: { id: string; name: string; items: string[] }[] = [
  { id: 'base', name: 'Base', items: ['rice', 'nori', 'sesame', 'wasabi', 'ginger', 'tempura', 'umeboshi'] },
  { id: 'fish', name: 'Pescado y mar', items: ['salmon', 'tuna', 'shrimp', 'crab', 'eel', 'roe'] },
  { id: 'veg', name: 'Verduras y frutas', items: ['cucumber', 'avocado', 'carrot', 'scallion', 'mango', 'chili', 'shiitake', 'berry'] },
  { id: 'other', name: 'Huevos, lácteos y bebidas', items: ['egg', 'cream', 'milk', 'tea_leaves', 'ramune_bottle'] },
];
const STOCKABLE = new Set(SUPPLY_GROUPS.flatMap((g) => g.items));

export const pantryCapacity = () => (game.save.restaurant.upgrades.includes('pantry') ? UPGRADED_CAPACITY : BASE_CAPACITY);
export const pantryTotal = () => Object.values(game.save.pantry ?? {}).reduce((n, q) => n + q, 0);
export const pantryFree = () => Math.max(0, pantryCapacity() - pantryTotal());

function stock(id: string, qty: number): number {
  const n = Math.min(qty, pantryFree());
  if (n > 0) game.setPantry(id, game.pantryCount(id) + n);
  return n;
}

/** Opens every pack and box she carries into the pantry, as far as there is room. Returns units stored. */
export function storePacks(): { stored: number; left: number } {
  let stored = 0, left = 0;
  for (const pk of PACKS) {
    let have = game.count(pk.id);
    while (have > 0 && pantryFree() >= pk.qty) {
      if (!game.removeItem(pk.id, 1)) break;
      stored += stock(pk.item, pk.qty);
      have--;
    }
    left += have;
  }
  return { stored, left };
}

/** Moves loose ingredients from the backpack to the pantry (as far as there is room). */
export function storeLoose(): number {
  let stored = 0;
  for (const id of STOCKABLE) {
    const have = game.count(id);
    const n = Math.min(have, pantryFree());
    if (n > 0 && game.removeItem(id, n)) stored += stock(id, n);
  }
  return stored;
}

export interface Shortage { id: string; need: number }
export function shortages(r: { ingredients: Record<string, number> }): Shortage[] {
  return Object.entries(r.ingredients).map(([id, q]) => ({ id, need: q - game.countUsable(id) })).filter((s) => s.need > 0);
}

const FISH = new Set(['salmon', 'tuna', 'shrimp', 'crab', 'eel', 'roe']);
/** where to get an ingredient, for the "faltan" message */
export function whereToGet(id: string): string {
  const it = ITEMS_BY_ID[id];
  if (!it) return '';
  if (FISH.has(id)) return 'Almacén de Taro o puesto de Nami';
  if (it.buy > 0) return id === 'egg' || id === 'berry' ? 'Almacén de Taro o panadería de Bento' : 'Almacén de Taro';
  return it.where ?? 'se recolecta';
}
export function shortageText(r: { ingredients: Record<string, number> }): string {
  return shortages(r).map((s) => `${ITEMS_BY_ID[s.id]?.name ?? s.id} ×${s.need} (${whereToGet(s.id)})`).join(' · ');
}

/** Packs of one ingredient, cheapest first, for the shop tab. */
export const packsFor = (ids?: string[]) => PACKS.filter((p) => !ids || ids.includes(p.item));
export const isPack = (id: string) => !!PACKS_BY_ID[id];

/**
 * Safety net for the first days: with no way to cook anything and almost no coins, a morning bundle
 * of basics keeps her from getting stuck. Returns true when it gave one.
 */
export function starterBundleNeeded(recipes: RecipeDef[] = RECIPES): boolean {
  if (game.coins >= 30) return false;
  const known = recipes.filter((r) => game.save.recipesKnown.includes(r.id));
  return !known.some((r) => Object.entries(r.ingredients).every(([id, q]) => game.countUsable(id) >= q));
}
export function giveStarterBundle(): boolean {
  if (!starterBundleNeeded()) return false;
  for (const [id, q] of Object.entries({ rice: 3, nori: 3, cucumber: 2 })) game.addItem(id, q, 'bundle');
  return true;
}
