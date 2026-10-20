/**
 * The order tickets shown while cooking: one per table (or the counter), with each dish, how many, and which are ready.
 * Built from the dining floor and the order list, so it needs nothing of its own in the save.
 */
import { game } from '../core/state';
import { RECIPES_BY_ID } from '../data/recipes';
import { DRINK_BY_ID } from '../restaurant/drinkData';
import { billOfMaterials, type Need } from './prep';
import { guestViews, plateState, tableLabel } from '../restaurant/service';
import { customerName } from '../restaurant/orders';

export interface TicketLine {
  recipe: string;
  name: string;
  /** dishes of this recipe still to make / already on the pass */
  waiting: number;
  ready: number;
  /** what each needs on the assembly table, e.g. "Salmón cortado" */
  needs: Need[];
  /** a drink: it also needs a glass in the blender */
  cup?: boolean;
}

export interface Ticket {
  id: string;
  label: string;
  who: string;
  lines: TicketLine[];
  /** 0..1 of the guests' patience left (1 for the counter, which never runs out) */
  patience: number;
  impatient: boolean;
  /** every dish of the ticket is on the pass */
  done: boolean;
}

export const MAX_TICKETS = 3;

function lines(uids: number[]): TicketLine[] {
  const byRecipe = new Map<string, TicketLine>();
  for (const uid of uids) {
    const o = game.save.orders.find((x) => x.uid === uid);
    const r = o && (o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe]);
    if (!o || !r) continue;
    const needs: Need[] = o.kind === 'drink' ? Object.entries(DRINK_BY_ID[o.recipe].ingredients).map(([ing, count]) => ({ ing, form: 'raw' as const, count })) : billOfMaterials(r as import('../data/recipes').RecipeDef);
    const line = byRecipe.get(r.id) ?? { recipe: r.id, name: r.name, waiting: 0, ready: 0, needs, cup: o.kind === 'drink' };
    const state = plateState(uid);
    if (state === 'plated' || state === 'carried' || state === 'delivered') line.ready++; else line.waiting++;
    byRecipe.set(r.id, line);
  }
  return [...byRecipe.values()];
}

/** All tickets, the most urgent first. */
export function tickets(): Ticket[] {
  const out: Ticket[] = [];
  for (const view of guestViews()) {
    if (view.phase !== 'waiting_food') continue;
    const uids = view.members.flatMap((m) => m.items).filter((i) => (i.kind === 'food' || i.kind === 'drink') && i.orderUid != null && i.quality === null).map((i) => i.orderUid as number);
    const ls = lines(uids);
    if (!ls.length) continue;
    out.push({
      id: view.id, label: view.tableId ? tableLabel(view.tableId) : 'Mesa', who: customerName(view.customerId) + (view.size > 1 ? ` y ${view.size - 1} más` : ''),
      lines: ls, patience: Math.max(0, Math.min(1, view.patience / Math.max(1, view.maxPatience))), impatient: view.impatient,
      done: ls.every((l) => l.waiting === 0),
    });
  }
  const counter = game.save.orders.filter((o) => o.kind !== 'drink' && !o.service && RECIPES_BY_ID[o.recipe]).map((o) => o.uid);
  if (counter.length) {
    const ls = lines(counter);
    out.push({ id: 'counter', label: 'Mostrador', who: 'Especial', lines: ls, patience: 1, impatient: false, done: ls.every((l) => l.waiting === 0) });
  }
  return out.sort((a, b) => Number(a.done) - Number(b.done) || a.patience - b.patience);
}
