/**
 * Test kit for the current save. Opens roads and fills the pantry.
 * Story chapters stay where they are, so dialogue and quests can still be played.
 */
import { BALANCE } from '../core/balance';
import type { Dir } from '../core/types';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { ZONES } from '../data/zones';
import { SHOP_PLACES } from './schedule';

/** Flags that remove gates, show late neighbors, and let the restaurant run. */
export const DEV_PLACE_FLAGS = [
  'intro_done',
  'unlock_beach',
  'unlock_forest',
  'unlock_garden',
  'unlock_station',
  'unlock_lighthouse_view',
  'lighthouse_open',
  'storage_open',
  'market_known',
  'market_force',
  'sign_restored',
  'met_hoshi',
  'akio_visit',
] as const;

const COIN_FLOOR = 8000;
const QTY: Partial<Record<string, number>> = { ingredient: 12, seed: 6, gift: 3, material: 20 };

function topUp(id: string, qty: number) {
  const have = game.count(id);
  if (have < qty) game.addItem(id, qty - have, 'dev');
}

/** Where a normal door would drop the player, so a warp lands on a real entrance. */
export function devArrival(id: string): { x: number; y: number; dir: Dir } | null {
  const zone = ZONES[id];
  if (!zone) return null;
  for (const from of Object.values(ZONES)) {
    const door = from.doors.find((d) => d.to === id);
    if (door) return { x: door.tx, y: door.ty, dir: door.dir };
  }
  const own = zone.doors[0];
  if (own) return { x: own.x, y: own.y, dir: 'down' };
  return { x: 1, y: 1, dir: 'down' };
}

export function devZoneGroups(): { title: string; ids: string[] }[] {
  const all = Object.values(ZONES);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
  const ids = (list: typeof all) => [...list].sort(byName).map((z) => z.id);
  return [
    { title: 'Afuera', ids: ids(all.filter((z) => z.outdoor)) },
    { title: 'Locales', ids: ids(all.filter((z) => !z.outdoor && !z.id.startsWith('house_'))) },
    { title: 'Casas', ids: ids(all.filter((z) => z.id.startsWith('house_'))) },
  ];
}

/** Opens every road, the lighthouse, the storeroom and the counters. Does not finish chapters. */
export function openPlaces() {
  for (const flag of DEV_PLACE_FLAGS) game.setFlag(flag);
  game.setFlag('market_open', true);
  for (const shop of SHOP_PLACES) game.setFlag('shop_force_' + shop.id);
}

/** Coins, every recipe, a fishing rod and a backpack of ingredients. Restaurant level goes to the cap. */
export function giveTestKit() {
  if (game.coins < COIN_FLOOR) game.addCoins(COIN_FLOOR - game.coins, 'dev');
  if (game.save.restaurant.level < BALANCE.maxRestaurantLevel) {
    game.save.restaurant.level = BALANCE.maxRestaurantLevel;
    game.touch('dev-level');
  }
  let learned = false;
  for (const recipe of RECIPES) {
    if (game.save.recipesKnown.includes(recipe.id)) continue;
    game.save.recipesKnown.push(recipe.id);
    learned = true;
  }
  if (learned) game.touch('dev-recipes');
  for (const item of ITEMS) {
    const qty = QTY[item.cat];
    if (qty) topUp(item.id, qty);
  }
  for (const id of ['rod_basic', 'rod_better', 'rod_advanced', 'k_storage', 'k_station', 'k_lighthouse', 'star1', 'star2', 'star3']) topUp(id, 1);
}

/** Every named villager, including the ones who appear late, likes you already. */
export function maxFriendships() {
  for (const c of CHARACTERS) {
    const rel = game.rel(c.id);
    if (rel.points < BALANCE.maxFriendship) rel.points = BALANCE.maxFriendship;
  }
  game.touch('dev-friends');
}

export function prepareEverything() {
  openPlaces();
  giveTestKit();
  maxFriendships();
}
