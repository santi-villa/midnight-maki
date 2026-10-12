/** Order generation, serving and restaurant progression. DOM-free logic. */
import { BALANCE } from '../core/balance';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { Order } from '../core/types';
import { CHARACTERS } from '../data/characters';
import { RECIPES, RECIPES_BY_ID, type RecipeDef } from '../data/recipes';
import { FURN_BY_ID } from '../data/furniture';

export interface GenericCustomer {
  id: string;
  name: string;
  line: string;
  /** extra ways to ask for food (picked per order) */
  asks?: string[];
  /** reactions by quality: 0 ok, 1 good, 2 perfect */
  react?: [string, string, string];
  /** chance to leave a little gift on a perfect dish */
  gift?: string;
}

export const GENERIC_CUSTOMERS: GenericCustomer[] = [
  { id: 'c_tourist', name: 'Turista con mapa', line: '¡Me dijeron que acá hacen el mejor sushi de la costa!',
    asks: ['Vine siguiendo un mapa dibujado a mano. Decía "sushi acá" con una flecha.', '¿Esto es Villa Nori? Tengo hambre de viaje.'],
    react: ['Rico. Lo anoto en mi diario de viaje.', '¡Valió la pena el viaje!', '¡ESTO va en la tapa de mi álbum de fotos!'], gift: 'sh_cowrie' },
  { id: 'c_student', name: 'Estudiante', line: 'Algo rico para estudiar toda la noche, por favor.',
    asks: ['Mañana tengo examen de matemática. Necesito energía en forma de arroz.', 'Si como bien, apruebo. Es ciencia.'],
    react: ['Gracias... ya puedo memorizar dos fórmulas más.', '¡Me iluminé! Creo que entendí las ecuaciones.', '¡Perfecto! Voy a sacar un diez, lo presiento.'], gift: 'g_candy' },
  { id: 'c_fisher', name: 'Pescador del muelle', line: 'Hoy no pesqué nada... así que vengo a comer pescado.',
    asks: ['El mar estuvo tranquilo hoy. Yo no. Dame algo rico.', 'Si el pescado no viene a mí, voy yo a buscarlo. Al plato.'],
    react: ['Mmm, está bien. El mar me debe una.', '¡Esto sí es pescado bien tratado!', 'Ni yo lo hubiera pescado mejor. Tomá, para vos.'], gift: 'f_sardine' },
  { id: 'c_grandpa', name: 'Señor del sombrero', line: 'Como en los viejos tiempos, ¿eh?',
    asks: ['Hace años venía acá con mi esposa. Pedíamos siempre lo mismo.', 'Tranquilo, sin apuro. A mi edad, todo se disfruta lento.'],
    react: ['Rico, rico. Como antes, casi.', 'Me hiciste acordar a cosas lindas. Gracias.', 'Igualito que hace cuarenta años. No... mejor.'], gift: 'fl_daisy' },
  { id: 'c_couple', name: 'Pareja paseando', line: 'Venimos por el aniversario. ¡Sorpréndannos!',
    asks: ['Es nuestra primera cita. No le digas que estoy nerviosa.', '¿Tienen algo para compartir? Nos gusta compartir.'],
    react: ['Qué lindo lugar. Volveremos.', '¡Nos encantó! Somos fans de los mapaches ahora.', '¡Perfecto! Esto va a ser nuestro restaurante oficial.'], gift: 'fl_camellia' },
  { id: 'c_kid', name: 'Nene curioso', line: '¿Es verdad que los cocineros son mapaches?',
    asks: ['¿Puedo ver al mapache chiquito? ¿El del pañuelo?', 'Quiero sushi pero sin cosas verdes. Bueno, un poquito de verde.'],
    react: ['Rico. ¿Puedo saludar a los mapaches?', '¡Mamá, el sushi de los mapaches es el mejor!', '¡Es el mejor sushi del UNIVERSO! Te regalo mi caracol.'], gift: 'sh_pink' },
  { id: 'c_painter', name: 'Pintora viajera', line: 'Quiero algo con muchos colores.',
    asks: ['Estoy pintando el puerto. Necesito comida que inspire.', 'El atardecer de acá tiene colores que no tengo en mi paleta.'],
    react: ['Bonito. Le falta un poquito de violeta.', '¡Qué composición! Parece un cuadro.', '¡Una obra maestra! La voy a pintar antes de comerla.'], gift: 'st_seaglass' },
  { id: 'c_runner', name: 'Corredora matutina', line: '¡Diez kilómetros! Ahora me merezco un sushi.',
    asks: ['Corrí hasta el faro y volví. Tengo hambre de faro.', 'Algo liviano. Pero rico. Pero liviano.'],
    react: ['Bien, recargando energía.', '¡Esto me da para otros diez kilómetros!', '¡Récord personal de sabor!'], gift: 'berry' },
  { id: 'c_writer', name: 'Escritor misterioso', line: 'Estoy escribiendo una novela sobre un restaurante de mapaches...',
    asks: ['Mi personaje principal pide sushi en el capítulo tres. Necesito investigar.', 'Shh. Estoy observando. Para la novela. Y comiendo.'],
    react: ['Interesante. Lo voy a describir como "correcto".', '"Un bocado que sabía a mar y a hogar". Lo anoto.', 'Este plato merece su propio capítulo.'], gift: 'g_book' },
  { id: 'c_sailor', name: 'Marinera de paso', line: '¡Tierra firme y sushi! ¿Qué más se puede pedir?',
    asks: ['Tres semanas en el barco comiendo galletas. Sálvame.', 'El capitán dice que acá cocinan unos mapaches. Pensé que era broma.'],
    react: ['Mejor que las galletas del barco, eso seguro.', '¡Le voy a contar a toda la tripulación!', '¡Por todos los mares! ¡Esto es un tesoro!'], gift: 'sh_scallop' },
];

export function customerAsk(id: string, seed: number): string | null {
  const c = GENERIC_CUSTOMERS.find((x) => x.id === id);
  if (!c) return null;
  const all = [c.line, ...(c.asks ?? [])];
  return all[Math.abs(seed) % all.length];
}


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

/** A dish for one customer who is already sitting. Does not pick a random guest. */
export function orderForCustomer(customer: string, r: () => number = Math.random): Omit<Order, 'uid'> | null {
  const recipes = availableRecipes();
  if (!recipes.length || !customer) return null;
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

export function makeOrder(r: () => number = Math.random): Omit<Order, 'uid'> | null {
  const customer = pickCustomer(r);
  return orderForCustomer(customer, r);
}

/**
 * Story orders stay on the counter. Regular orders are written when a seated
 * party is asked, so a new day only clears the ones nobody finished.
 */
export function refreshOrders(newDay: boolean) {
  if (!newDay) return;
  const s = game.save;
  const next = s.orders.filter((o) => o.special);
  if (next.length === s.orders.length) return;
  s.orders = next;
  game.touch('orders');
}

export interface ServeResult {
  coins: number;
  xp: number;
  rep: number;
  levelUp: number;
  firstTime: boolean;
  newRecipes: string[];
  tip: number;
  gift: string | null;
}

export interface ServeOptions {
  /** Keep the tip out of the wallet. The table holds it until the player picks it up. */
  holdTip?: boolean;
  rng?: () => number;
}

/** Deliver a cooked dish for an order. quality: 0 ok, 1 good, 2 perfect. Idempotent per order uid. */
export function serveOrder(uid: number, quality: 0 | 1 | 2, variantBonus = 0, opts?: ServeOptions): ServeResult | null {
  const s = game.save;
  const idx = s.orders.findIndex((o) => o.uid === uid);
  if (idx < 0) return null;
  const o = s.orders[idx];
  s.orders.splice(idx, 1);
  const r = RECIPES_BY_ID[o.recipe];
  const roll = opts?.rng ?? Math.random;
  let coins = Math.round(o.reward * (1 + BALANCE.qualityBonus[quality] + tipBonus())) + variantBonus;
  // happy customers sometimes leave a tip, and a perfect dish may earn a little present
  const tip = quality >= 1 && roll() < (quality === 2 ? 0.55 : 0.25) ? Math.round(o.reward * (0.1 + roll() * 0.2)) : 0;
  if (!opts?.holdTip) coins += tip;
  game.addCoins(coins, 'serve');
  const gc = GENERIC_CUSTOMERS.find((c) => c.id === o.customer);
  const gift = quality === 2 && gc?.gift && roll() < 0.35 ? gc.gift : null;
  if (gift) game.addItem(gift, 1, 'tip');
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
  return { coins, xp, rep, levelUp, firstTime, newRecipes, tip, gift };
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
