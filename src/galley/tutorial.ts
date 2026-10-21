/**
 * The first lesson in the physical kitchen: two different dishes, step by step. Pure: the steps look at what the kitchen holds
 * and at what has been delivered, and the view shows the current one. Progress only moves forward.
 */
import { STATIONS } from './layout';
import { PLAYER, type Galley } from './model';
import type { GItem, IngItem } from './prep';

/** `did`: things the player has done at least once this session: 'scoop', 'return' (put an ingredient back in the fridge), 'trash' */
export interface TutCtx { g: Galley; served: ReadonlySet<string>; did?: ReadonlySet<string> }
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
  // free practice, one small task at a time (the card can be skipped at any moment)
  { id: 'p_scoop', dish: 'Práctica', text: 'Práctica 1 de 3: parada en la arrocera, tocá «Echar arroz». Sale directo de la despensa, sin viajar a la heladera. Después podés sacarlo otra vez.', done: (c) => !!c.did?.has('scoop') },
  { id: 'p_return', dish: 'Práctica', text: 'Práctica 2 de 3: sacá un ingrediente de la heladera y devolvelo con «Guardar». Equivocarte no cuesta nada.', done: (c) => !!c.did?.has('return') },
  { id: 'p_trash', dish: 'Práctica', text: 'Práctica 3 de 3: lo que sale mal va al tacho, junto a la mesa de armado. Sacá algo de la heladera y tiralo.', done: (c) => !!c.did?.has('trash') },
];

const heldIng = (c: TutCtx, ing: string, form?: (f: string) => boolean): boolean => {
  const h = c.g.held(PLAYER)[0];
  return !!h && h.kind === 'ing' && h.ing === ing && (!form || form(h.form));
};
const on = (c: TutCtx, station: string, ing: string, form?: (f: string) => boolean): boolean =>
  c.g.station(station).items.some((i) => i.kind === 'ing' && i.ing === ing && (!form || form(i.form)));

/**
 * Where the arrow points at this step: the station to walk to next, given what the player is carrying and what is already
 * on the tables (so the arrow follows the work: fridge, then cooker, then board…).
 */
export function tutorialStation(i: number, c: TutCtx): string | null {
  const step = TUTORIAL[i];
  if (!step) return null;
  const held = c.g.held(PLAYER)[0];
  switch (step.id) {
    case 'k_rice': return 'fridge';
    case 'k_cooker': return heldIng(c, 'rice') ? 'rice' : 'fridge';
    case 'k_take': return 'rice';
    case 'k_cut':
    case 'n_cut':
      if (held) return 'board_1';
      return c.g.station('board_1').items.length ? 'board_1' : 'fridge';
    case 'k_table':
    case 'n_make': {
      if (held) return 'assembly';
      const fish = step.id === 'n_make' ? 'salmon' : 'cucumber';
      const at = (ing: string, f?: (x: string) => boolean) => on(c, 'assembly', ing, f);
      if (!at('rice', cooked)) return c.g.station('hangiri').items.length ? 'hangiri' : 'rice';
      if (!at(fish, cut)) return on(c, 'board_1', fish, cut) ? 'board_1' : 'fridge';
      if (step.id === 'k_table' && !at('nori')) return 'fridge';
      return 'assembly';
    }
    case 'k_make': return 'assembly';
    case 'p_scoop': return 'rice';
    case 'p_return': return 'fridge';
    case 'p_trash': return held ? 'bin' : 'fridge';
    case 'k_serve':
    case 'n_serve': return held?.kind === 'dish' ? 'pass' : 'assembly';
    default: return null;
  }
}

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
