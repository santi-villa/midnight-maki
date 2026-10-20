/**
 * The first lesson in the physical kitchen: two different dishes, step by step. Pure: the steps look at what the kitchen holds
 * and at what has been delivered, and the view shows the current one. Progress only moves forward.
 */
import { STATIONS } from './layout';
import { PLAYER, type Galley } from './model';
import type { GItem, IngItem } from './prep';

export interface TutCtx { g: Galley; served: ReadonlySet<string> }
export interface TutStep { id: string; dish: string; text: string; done(c: TutCtx): boolean }

/** Everything the kitchen holds: the player's hands and every station. */
function everything(g: Galley): GItem[] {
  return [...g.held(PLAYER), ...STATIONS.flatMap((s) => g.station(s.id).items)];
}
const ing = (c: TutCtx, name: string, form?: (f: string) => boolean): boolean =>
  everything(c.g).some((i) => i.kind === 'ing' && i.ing === name && (!form || form(i.form)));
const dish = (c: TutCtx, recipe: string): boolean => c.served.has(recipe) || everything(c.g).some((i) => i.kind === 'dish' && i.recipe === recipe);
const cut = (f: string) => f === 'cut' || f === 'cooked_cut';
const cooked = (f: string) => f === 'cooked' || f === 'cooked_cut';

export const TUTORIAL: readonly TutStep[] = [
  { id: 'k_rice', dish: 'Kappa maki', text: 'Sacá arroz de la heladera (la de la izquierda).', done: (c) => ing(c, 'rice') || c.served.has('kappa') },
  { id: 'k_cooker', dish: 'Kappa maki', text: 'Dejalo en la arrocera: arranca solo. La barra verde es el punto perfecto.', done: (c) => c.g.station('rice').items.length > 0 || ing(c, 'rice', cooked) },
  { id: 'k_take', dish: 'Kappa maki', text: 'Cuando diga «¡Listo!», sacá el arroz antes de que la barra se ponga amarilla.', done: (c) => ing(c, 'rice', cooked) || c.served.has('kappa') },
  { id: 'k_cut', dish: 'Kappa maki', text: 'Sacá un pepino y llevalo a la tabla de cortar: son 5 cortes, frená la barra en la zona verde.', done: (c) => ing(c, 'cucumber', cut) || dish(c, 'kappa') },
  { id: 'k_table', dish: 'Kappa maki', text: 'Llevá arroz cocido, alga y pepino cortado a la mesa de armado (dejalos ahí).', done: (c) => c.g.preview().some((m) => m.recipe.id === 'kappa') || dish(c, 'kappa') },
  { id: 'k_make', dish: 'Kappa maki', text: 'En la mesa de armado elegí «Armar».', done: (c) => dish(c, 'kappa') },
  { id: 'k_serve', dish: 'Kappa maki', text: 'Agarrá el plato y dejalo en el mostrador de entrega: va al pedido de Rigg.', done: (c) => c.served.has('kappa') },
  { id: 'n_cut', dish: 'Nigiri de salmón', text: 'Segundo plato: un nigiri de salmón. Sacá salmón de la heladera y cortalo en la tabla.', done: (c) => ing(c, 'salmon', cut) || dish(c, 'sake_nigiri') },
  { id: 'n_make', dish: 'Nigiri de salmón', text: 'Armalo en la mesa con arroz cocido (el que sobró en el hangiri).', done: (c) => dish(c, 'sake_nigiri') },
  { id: 'n_serve', dish: 'Nigiri de salmón', text: 'Entregalo en el mostrador. ¡Listo!', done: (c) => c.served.has('sake_nigiri') },
];

/** Moves forward over every finished step and returns the index of the current one (TUTORIAL.length when everything is done). */
export function tutorialStep(from: number, c: TutCtx): number {
  let i = Math.max(0, Math.min(from, TUTORIAL.length));
  while (i < TUTORIAL.length && TUTORIAL[i].done(c)) i++;
  return i;
}

/** Ingredients the lesson needs, as a minimum in the backpack. */
export const TUTORIAL_STOCK: Readonly<Record<string, number>> = { rice: 2, nori: 1, cucumber: 1, salmon: 1 };
/** Recipes whose practice orders the lesson serves. */
export const TUTORIAL_DISHES = ['kappa', 'sake_nigiri'] as const;
export type { IngItem };
