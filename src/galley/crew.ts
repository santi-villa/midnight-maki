/**
 * Kitchen hands: employees that work at the same stations, with the same verbs, as the player. A role is a small brain
 * that looks at the kitchen and names the next thing to do; the view walks the worker there and performs it through the model.
 * Only the rice-maker exists for now. The next roles (cutter, assistant, cook) are new entries in ROLES with their own `next`.
 */
import { ITEMS_BY_ID } from '../data/items';
import { COOK, type Galley, type Verb } from './model';

export type HandRole = 'rice';

/** One thing to do: go to a station and use a verb (or take an ingredient out of the fridge). */
export interface Step {
  station: string;
  verb: Verb | 'fetch';
  arg?: string;
  /** what the speech/label says while it happens */
  doing: string;
}

export interface HandDef {
  role: HandRole;
  /** the upgrade that brings this worker in */
  upgrade: string;
  name: string;
  job: string;
  /** seconds a station action takes (walking not included) */
  pace: number;
  next(g: Galley, who: string, stock: (id: string) => number): Step | null;
}

/** how many cooked portions the rice-maker tries to keep ready in the hangiri */
export const RICE_RESERVE = 4;

function riceNext(g: Galley, who: string, stock: (id: string) => number): Step | null {
  const held = g.held(who)[0];
  const cooker = g.station('rice');
  const hangiri = g.station('hangiri');
  const roomInHangiri = hangiri.items.length < g.slots('hangiri');
  if (held) {
    if (held.kind === 'ing' && held.ing === 'rice' && held.form === 'raw') return { station: 'rice', verb: 'put', doing: 'Carga la arrocera' };
    if (held.kind === 'ing' && held.ing === 'rice' && (held.form === 'cooked' || held.form === 'cooked_cut')) {
      return roomInHangiri ? { station: 'hangiri', verb: 'put', doing: 'Guarda el arroz' } : { station: 'counter_a', verb: 'put', doing: 'Deja el arroz' };
    }
    return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
  }
  if (cooker.phase === 'done' && cooker.items.length && roomInHangiri) return { station: 'rice', verb: 'take', doing: 'Saca el arroz' };
  if (cooker.phase === 'done') return null;
  // loading: it starts by itself with the first portion, and takes more for a few seconds
  const loading = cooker.phase === 'idle' || cooker.t < COOK.rice.grace - 3;
  const deficit = RICE_RESERVE - hangiri.items.length - cooker.items.length;
  if (loading && cooker.items.length < g.slots('rice') && deficit > 0 && stock('rice') > 0) return { station: 'fridge', verb: 'fetch', arg: 'rice', doing: 'Busca arroz' };
  return null;
}

export const HANDS: Record<HandRole, HandDef> = {
  rice: { role: 'rice', upgrade: 'rice_hand', name: 'Ayudante arrocero', job: 'Mantiene el arroz cocido listo en la cocina.', pace: 0.6, next: riceNext },
};

export const handName = (item: string) => ITEMS_BY_ID[item]?.name ?? item;

/** The workers the restaurant has, from its upgrades. */
export function handsFor(upgrades: readonly string[]): HandDef[] {
  return Object.values(HANDS).filter((h) => upgrades.includes(h.upgrade));
}
