/**
 * What a dish needs, in the physical kitchen: every ingredient of a recipe must arrive at the assembly table in the right
 * form (raw, cut, cooked, cooked and cut), and the rice comes cooked from the cooker. Pure data and rules, no Phaser, no DOM.
 * Recipes are not duplicated: the bill of materials is derived from `RECIPES` (ingredients + steps).
 */
import { RECIPES_BY_ID, type RecipeDef } from '../data/recipes';

/** raw → cut → (ready); raw → cooked → cooked_cut for things that are cooked and then sliced */
export type Form = 'raw' | 'cooked' | 'cut' | 'cooked_cut';

/** quality of a preparation: 0 failed, 1 regular, 2 good, 3 perfect. Raw ingredients count as good. */
export type Grade = 0 | 1 | 2 | 3;

export interface IngItem { kind: 'ing'; uid: number; ing: string; form: Form; q: Grade }
export interface DishItem { kind: 'dish'; uid: number; recipe: string; dq: 0 | 1 | 2; variant?: string; bonus: number }
/** an empty glass (free: the rack never runs out) and a finished drink in its glass */
export interface CupItem { kind: 'cup'; uid: number }
export interface DrinkItem { kind: 'drink'; uid: number; drink: string; dq: 0 | 1 | 2 }
export type GItem = IngItem | DishItem | CupItem | DrinkItem;

/** Fish, vegetables and fruit that are cut on the board before they go in a dish. */
export const CUTTABLE: ReadonlySet<string> = new Set([
  'salmon', 'tuna', 'cucumber', 'avocado', 'carrot', 'mango', 'scallion', 'shiitake', 'crab', 'eel', 'egg', 'shrimp', 'chili', 'starfruit', 'f_carp',
]);
/** Things that go to the stove first (only where the recipe has a cooking step for them). */
export const COOKABLE: ReadonlySet<string> = new Set(['egg', 'shrimp', 'eel']);

export type Prep = 'none' | 'cut' | 'cook' | 'cook_cut';

/** How `ing` must be prepared for this recipe. */
export function prepFor(r: RecipeDef, ing: string): Prep {
  if (ing === 'rice') return 'cook';
  const cooked = r.steps.some((s) => s.t === 'cook' && s.item === ing);
  const sliced = r.steps.some((s) => s.t === 'slice' && s.item === ing);
  const cut = sliced || CUTTABLE.has(ing);
  if (cooked && cut) return 'cook_cut';
  if (cooked) return 'cook';
  return cut ? 'cut' : 'none';
}

/** The form a prepared ingredient must have. */
export const formFor = (p: Prep): Form => (p === 'none' ? 'raw' : p === 'cut' ? 'cut' : p === 'cook' ? 'cooked' : 'cooked_cut');

export interface Need { ing: string; form: Form; count: number }

/** Everything a recipe needs on the assembly table. */
export function billOfMaterials(r: RecipeDef): Need[] {
  return Object.entries(r.ingredients).map(([ing, count]) => ({ ing, form: formFor(prepFor(r, ing)), count }));
}

export interface Match { recipe: RecipeDef; variant?: { item: string; name: string; bonus: number } }

const key = (i: { ing: string; form: Form }) => `${i.ing}|${i.form}`;

/**
 * Recipes the pieces on the table make exactly. Extra pieces only count when they are the recipe's optional variant
 * ingredient (raw, one unit). `known`: only recipes the player knows.
 */
export function recipesFor(pieces: readonly IngItem[], known: (id: string) => boolean = () => true, recipes: readonly RecipeDef[] = Object.values(RECIPES_BY_ID)): Match[] {
  if (!pieces.length) return [];
  const have = new Map<string, number>();
  for (const p of pieces) have.set(key(p), (have.get(key(p)) ?? 0) + 1);
  const out: Match[] = [];
  for (const r of recipes) {
    if (!known(r.id)) continue;
    const left = new Map(have);
    let ok = true;
    for (const n of billOfMaterials(r)) {
      const k = key(n);
      if ((left.get(k) ?? 0) < n.count) { ok = false; break; }
      left.set(k, (left.get(k) ?? 0) - n.count);
    }
    if (!ok) continue;
    const rest = [...left.entries()].filter(([, c]) => c > 0);
    if (!rest.length) { out.push({ recipe: r }); continue; }
    const variant = rest.length === 1 && rest[0][1] === 1 ? r.variants?.find((v) => `${v.item}|raw` === rest[0][0]) : undefined;
    if (variant) out.push({ recipe: r, variant });
  }
  return out;
}

/**
 * What is still missing for the recipe the pieces on the table are closest to (every piece must belong to it).
 * `ready` when the pieces make it already. Null when the pieces fit no known recipe.
 */
export function closestRecipe(pieces: readonly IngItem[], known: (id: string) => boolean = () => true, recipes: readonly RecipeDef[] = Object.values(RECIPES_BY_ID)): { recipe: RecipeDef; missing: Need[]; ready: boolean } | null {
  if (!pieces.length) return null;
  const have = new Map<string, number>();
  for (const p of pieces) have.set(key(p), (have.get(key(p)) ?? 0) + 1);
  let best: { recipe: RecipeDef; missing: Need[]; ready: boolean; score: number } | null = null;
  for (const r of recipes) {
    if (!known(r.id)) continue;
    const bom = billOfMaterials(r);
    const allowed = new Set(bom.map(key));
    if ([...have.keys()].some((k) => !allowed.has(k))) continue;
    const missing = bom.map((n) => ({ ...n, count: n.count - Math.min(n.count, have.get(key(n)) ?? 0) })).filter((n) => n.count > 0);
    const score = bom.length - missing.length;
    if (!best || missing.length < best.missing.length || (missing.length === best.missing.length && score > best.score)) best = { recipe: r, missing, ready: !missing.length, score };
  }
  return best ? { recipe: best.recipe, missing: best.missing, ready: best.ready } : null;
}

/** Quality of the finished dish from the preparations that went into it. */
export function judgeDish(r: RecipeDef, used: readonly IngItem[]): 0 | 1 | 2 {
  const graded = used.filter((i) => prepFor(r, i.ing) !== 'none');
  if (!graded.length) return 1;
  if (graded.some((i) => i.q === 0)) return 0; // one ruined piece: acceptable at best
  const mean = graded.reduce((n, i) => n + i.q, 0) / graded.length;
  return mean >= 2.5 ? 2 : mean >= 1.5 ? 1 : 0;
}

export const GRADE_NAME: Record<Grade, string> = { 0: 'Fallido', 1: 'Regular', 2: 'Bueno', 3: '¡Perfecto!' };
export const DISH_NAME = ['Aceptable', 'Muy bueno', 'Perfecto'] as const;
