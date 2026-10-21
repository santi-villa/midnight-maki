/**
 * The order tickets shown while cooking: one per table (or the counter), with each dish, how many, and which are ready.
 * Built from the dining floor and the order list, so it needs nothing of its own in the save.
 */
import { game } from '../core/state';
import { RECIPES_BY_ID } from '../data/recipes';
import { DRINK_BY_ID } from '../restaurant/drinkData';
import { billOfMaterials, type Need } from './prep';
import type { Galley } from './model';
import { guestViews, plateState, tableLabel } from '../restaurant/service';
import { customerName } from '../restaurant/orders';

export interface TicketLine {
  recipe: string;
  name: string;
  /** dishes of this recipe still to make / already on the pass */
  waiting: number;
  ready: number;
  /** what each needs on the assembly table, e.g. "Salmón cortado"; `have`: how many of the pieces for all the dishes of this line are already prepared (on the table, the counters, the boards or the hangiri) */
  needs: (Need & { have?: number })[];
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
  /** the player chose to cook this one first */
  pinned?: boolean;
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

/** The ticket the player picked to cook first (cleared when it is served or its guests leave). Not saved: it is a hint for the next minutes. */
let pinnedId: string | null = null;
export const pinnedTicket = (): string | null => pinnedId;
export function pinTicket(id: string | null) { pinnedId = pinnedId === id ? null : id; }

/** Prepared pieces lying around the kitchen, by `ing|form`: what the next dishes can use without more work. */
export function stagedPieces(g: Pick<Galley, 'station'>): Map<string, number> {
  const pool = new Map<string, number>();
  const add = (ing: string, form: string) => pool.set(`${ing}|${form}`, (pool.get(`${ing}|${form}`) ?? 0) + 1);
  for (const id of ['assembly', 'counter_a', 'counter_b', 'hangiri', 'board_1', 'board_2']) {
    const st = g.station(id);
    if (!st) continue;
    for (const i of st.items) if (i.kind === 'ing' && !(st.pending && i.form !== 'cut' && i.form !== 'cooked_cut')) add(i.ing, i.form);
  }
  const cooker = g.station('rice');
  if (cooker?.phase === 'done') for (const i of cooker.items) if (i.kind === 'ing') add(i.ing, i.form === 'raw' ? 'cooked' : i.form);
  return pool;
}

/** Gives each unfinished ticket, in order, the staged pieces it can use (a piece counts for one ticket only). */
export function allocateStaged(list: Ticket[], pool: Map<string, number>) {
  for (const t of list) {
    if (t.done) continue;
    for (const l of t.lines) for (const n of l.needs) {
      const key = `${n.ing}|${n.form}`, free = pool.get(key) ?? 0, total = n.count * l.waiting;
      const give = Math.min(free, total);
      n.have = give;
      if (give) pool.set(key, free - give);
    }
  }
}

/** All tickets, the most urgent first (or the one the player pinned). */
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
  if (pinnedId && !out.some((t) => t.id === pinnedId && !t.done)) pinnedId = null;
  for (const t of out) t.pinned = t.id === pinnedId;
  return out.sort((a, b) => Number(a.done) - Number(b.done) || Number(!!b.pinned) - Number(!!a.pinned) || a.patience - b.patience);
}
