/** Order generation, serving and restaurant progression. DOM-free logic. */
import { BALANCE } from '../core/balance';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { Order } from '../core/types';
import { CHARACTERS } from '../data/characters';
import { RECIPES, RECIPES_BY_ID, type RecipeDef } from '../data/recipes';
import { FURN_BY_ID } from '../data/furniture';

export const GENERIC_CUSTOMERS = [
  { id: 'c_tourist', name: 'Turista con mapa', line: '¡Me dijeron que acá hacen el mejor sushi de la costa!' },
  { id: 'c_student', name: 'Estudiante', line: 'Algo rico para estudiar toda la noche, por favor.' },
  { id: 'c_fisher', name: 'Pescador del muelle', line: 'Hoy no pesqué nada... así que vengo a comer pescado.' },
  { id: 'c_grandpa', name: 'Señor del sombrero', line: 'Como en los viejos tiempos, ¿eh?' },
  { id: 'c_couple', name: 'Pareja paseando', line: 'Venimos por el aniversario. ¡Sorpréndannos!' },
  { id: 'c_kid', name: 'Nene curioso', line: '¿Es verdad que los cocineros son mapaches?' },
  { id: 'c_painter', name: 'Pintora viajera', line: 'Quiero algo con muchos colores.' },
];

export function customerName(id: string): string {
  return CHARACTERS.find((c) => c.id === id)?.name ?? GENERIC_CUSTOMERS.find((c) => c.id === id)?.name ?? 'Cliente';
}

export function maxOrders(): number {
  return BALANCE.maxOrders + (game.save.restaurant.upgrades.includes('tables2') ? 1 : 0) + (game.save.restaurant.upgrades.includes('second_room') ? 1 : 0);
}

export function availableRecipes(): RecipeDef[] {
  return game.save.recipesKnown.map((id) => RECIPES_BY_ID[id]).filter(Boolean);
}

/** Restaurant ambience from furniture in the dining room (decor connects to income). */
export function charm(): number {
  let c = 0;
  for (const f of game.save.decor.dining ?? []) c += FURN_BY_ID[f.id]?.charm ?? 0;
  for (const u of game.save.restaurant.upgrades) if (['lights', 'display'].includes(u)) c += 5;
  return c;
}

export function tipBonus(): number {
  // charm 0..40 => up to +20%; Pip's friendship adds attentive service
  const pipLvl = game.friendLevel('pip');
  return Math.min(0.2, charm() / 200) + pipLvl * 0.02;
}

function pickCustomer(r: () => number): string {
  const villagers = CHARACTERS.filter((c) => !c.raccoon && (!c.needsFlag || game.has(c.needsFlag)) && game.rel(c.id).points > 0);
  if (villagers.length && r() < 0.45) return villagers[Math.floor(r() * villagers.length)].id;
  return GENERIC_CUSTOMERS[Math.floor(r() * GENERIC_CUSTOMERS.length)].id;
}

function favoriteOf(customer: string): string | null {
  const fav: Record<string, string> = {
    momo: 'veggie_roll', taro: 'rainbow', yuki: 'sakura_roll', kumo: 'tamago', nami: 'sake_nigiri', hoshi: 'moonlight',
    bento: 'futomaki', sumi: 'rainbow', mika: 'rainbow', kiki: 'onigiri', sora: 'california', ume: 'onigiri',
  };
  return fav[customer] ?? null;
}

export function makeOrder(r: () => number = Math.random): Omit<Order, 'uid'> | null {
  const recipes = availableRecipes();
  if (!recipes.length) return null;
  const customer = pickCustomer(r);
  let recipe = recipes[Math.floor(r() * recipes.length)];
  const fav = favoriteOf(customer);
  if (fav && game.save.recipesKnown.includes(fav) && r() < 0.6) recipe = RECIPES_BY_ID[fav];
  // newer, pricier recipes appear a bit more often as the restaurant grows
  if (r() < 0.3) {
    const best = [...recipes].sort((a, b) => b.price - a.price).slice(0, 3);
    recipe = best[Math.floor(r() * best.length)];
  }
  const variance = 0.9 + r() * 0.2;
  return { recipe: recipe.id, customer, reward: Math.round(recipe.price * variance) };
}

export function refreshOrders(newDay: boolean) {
  const s = game.save;
  if (newDay) s.orders = s.orders.filter((o) => o.special); // regular orders refresh daily, story ones stay
  let guard = 0;
  while (s.orders.filter((o) => !o.special).length < maxOrders() && guard++ < 10) {
    const o = makeOrder();
    if (!o) break;
    if (s.orders.some((x) => x.recipe === o.recipe && x.customer === o.customer)) continue;
    game.addOrder(o);
  }
  game.touch('orders');
}

export interface ServeResult {
  coins: number;
  xp: number;
  rep: number;
  levelUp: number;
  firstTime: boolean;
  newRecipes: string[];
}

/** Deliver a cooked dish for an order. quality: 0 ok, 1 good, 2 perfect. Idempotent per order uid. */
export function serveOrder(uid: number, quality: 0 | 1 | 2, variantBonus = 0): ServeResult | null {
  const s = game.save;
  const idx = s.orders.findIndex((o) => o.uid === uid);
  if (idx < 0) return null;
  const o = s.orders[idx];
  s.orders.splice(idx, 1);
  const r = RECIPES_BY_ID[o.recipe];
  const coins = Math.round(o.reward * (1 + BALANCE.qualityBonus[quality] + tipBonus())) + variantBonus;
  game.addCoins(coins, 'serve');
  const firstTime = !s.recipesCooked[o.recipe];
  s.recipesCooked[o.recipe] = (s.recipesCooked[o.recipe] ?? 0) + 1;
  s.restaurant.served++;
  const rep = BALANCE.reputationPerServe + quality;
  s.restaurant.reputation += rep;
  const xp = r.xp + quality * 2;
  const levelUp = addRestaurantXp(xp);
  const newRecipes = levelUp ? unlockLevelRecipes() : [];
  if (CHARACTERS.some((c) => c.id === o.customer)) game.addFriendship(o.customer, 6 + quality * 3);
  if (r.spicy) game.stat('spicyServed');
  game.stat('served');
  bus.emit('recipe:cooked', { id: o.recipe, quality });
  game.touch('serve');
  return { coins, xp, rep, levelUp, firstTime, newRecipes };
}

export function addRestaurantXp(xp: number): number {
  const rs = game.save.restaurant;
  rs.xp += xp;
  let up = 0;
  while (rs.level < BALANCE.maxRestaurantLevel && rs.xp >= BALANCE.restaurantXpPerLevel(rs.level)) {
    rs.xp -= BALANCE.restaurantXpPerLevel(rs.level);
    rs.level++;
    up = rs.level;
  }
  return up;
}

export function unlockLevelRecipes(): string[] {
  const out: string[] = [];
  for (const r of RECIPES) {
    if (r.unlock.level && r.unlock.level <= game.save.restaurant.level && !game.save.recipesKnown.includes(r.id)) {
      game.save.recipesKnown.push(r.id);
      out.push(r.id);
    }
  }
  return out;
}

export function learnRecipe(id: string): boolean {
  if (!RECIPES_BY_ID[id] || game.save.recipesKnown.includes(id)) return false;
  game.save.recipesKnown.push(id);
  game.touch('recipe');
  return true;
}

export function canCook(recipeId: string): boolean {
  const r = RECIPES_BY_ID[recipeId];
  if (!r) return false;
  return Object.entries(r.ingredients).every(([id, q]) => game.countUsable(id) >= q);
}
