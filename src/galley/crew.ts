/**
 * Kitchen hands: crew members who work at the same stations, with the same verbs, as the player. A role is a small brain that
 * looks at the kitchen and names the next thing to do; the view walks the worker there and performs it through the model.
 * Spicy is the kitchen's worker: with the rice upgrade he keeps cooked rice ready, with the cutting upgrade he also cuts what
 * the tickets ask for. Rigg serves (the pass bell) and Pip seats guests; those live in restaurant/staff.ts.
 */
import { COOKABLE, CUTTABLE, type Need } from './prep';
import { PLAYER_REF, floorSeconds } from '../restaurant/perks';
import { COOK, type Galley, type Verb } from './model';

export type HandRole = 'spicy' | 'cook';

/** One thing to do: go to a station and use a verb (or take an ingredient out of the fridge). */
export interface Step {
  station: string;
  verb: Verb | 'fetch';
  arg?: string;
  /** what the speech/label says while it happens */
  doing: string;
}

export interface HandCtx {
  stock(id: string): number;
  ups: readonly string[];
  /** cut ingredients the open tickets still need, summed per ingredient */
  wanted: Need[];
  /** cooked ingredients (egg, shrimp, eel; cooked or cooked and cut) the open tickets still need */
  wantedCooked?: Need[];
  /** cooked rice portions to keep in the hangiri (Spicy's skills can raise it) */
  reserve?: number;
}

export interface HandDef {
  role: HandRole;
  /** who does it: `spicy` or the id of a hired cook */
  crew: string;
  /** the upgrades that give Spicy each job (hired cooks have none: their post decides) */
  rice?: string;
  cut?: string;
  name: string;
  job: string;
  next(g: Galley, who: string, ctx: HandCtx): Step | null;
}

/** how many cooked portions the rice job tries to keep ready in the hangiri */
export const RICE_RESERVE = 4;
/**
 * Seconds a helper takes to cut one piece and to do any other station action, from the player's own times (`PLAYER_REF`):
 * slower at low levels, and never faster than 1.2× the player whatever the skills (see restaurant/perks.ts).
 */
export const cutSecondsFor = (level: number, speedMul = 1): number => floorSeconds(PLAYER_REF.cut, level, speedMul);
export const paceFor = (level: number, speedMul = 1): number => floorSeconds(PLAYER_REF.step, level, speedMul);
export const BOARDS = ['board_1', 'board_2'] as const;
const SUPPORT = ['counter_a', 'counter_b'] as const;

function riceNext(g: Galley, who: string, ctx: HandCtx): Step | null {
  const held = g.held(who)[0];
  const cooker = g.station('rice');
  const hangiri = g.station('hangiri');
  const roomInHangiri = hangiri.items.length < g.slots('hangiri');
  if (held) {
    if (held.kind !== 'ing' || held.ing !== 'rice') return null;
    if (held.form === 'raw') return { station: 'rice', verb: 'put', doing: 'Carga la arrocera' };
    return roomInHangiri ? { station: 'hangiri', verb: 'put', doing: 'Guarda el arroz' } : { station: 'counter_a', verb: 'put', doing: 'Deja el arroz' };
  }
  if (cooker.phase === 'done' && cooker.items.length && roomInHangiri) return { station: 'rice', verb: 'take', doing: 'Saca el arroz' };
  if (cooker.phase === 'done') return null;
  // loading: it starts by itself with the first portion, and takes more for a few seconds
  const loading = cooker.phase === 'idle' || cooker.t < COOK.rice.grace - 3;
  const deficit = Math.min(g.slots('hangiri'), ctx.reserve ?? RICE_RESERVE) - hangiri.items.length - cooker.items.length;
  if (loading && cooker.items.length < g.slots('rice') && deficit > 0 && ctx.stock('rice') > 0) return { station: 'fridge', verb: 'fetch', arg: 'rice', doing: 'Busca arroz' };
  return null;
}

function cutNext(g: Galley, who: string, ctx: HandCtx): Step | null {
  const held = g.held(who)[0];
  const boards = BOARDS.filter((b) => g.kind(b) === 'board');
  const freeBoard = boards.find((b) => !g.station(b).items.length);
  if (held) {
    if (held.kind !== 'ing') return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    if (held.form === 'cut' || held.form === 'cooked_cut') {
      const spot = SUPPORT.find((s) => g.station(s).items.length < g.slots(s));
      return spot ? { station: spot, verb: 'put', doing: 'Deja lo cortado' } : { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    }
    // a cooked piece goes under the knife only when a ticket wants it cooked and cut (egg, shrimp, eel)
    const cookedForKnife = held.form === 'cooked' && (ctx.wantedCooked ?? []).some((n) => n.form === 'cooked_cut' && n.ing === held.ing);
    if ((held.form === 'raw' || cookedForKnife) && CUTTABLE.has(held.ing) && freeBoard) return { station: freeBoard, verb: 'chop', doing: 'Corta' };
    if ((held.form === 'raw' || cookedForKnife) && CUTTABLE.has(held.ing)) return null; // waits for a board
    return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
  }
  const done = boards.find((b) => { const it = g.station(b).items[0]; return it && it.kind === 'ing' && (it.form === 'cut' || it.form === 'cooked_cut') && !g.station(b).pending; });
  if (done) return { station: done, verb: 'take', doing: 'Retira lo cortado' };
  if (!freeBoard) return null;
  // cooked pieces waiting on the counters for the knife
  const waiting = SUPPORT.find((c) => g.station(c).items.some((i) => i.kind === 'ing' && i.form === 'cooked' && (ctx.wantedCooked ?? []).some((n) => n.form === 'cooked_cut' && n.ing === i.ing)));
  if (waiting) return { station: waiting, verb: 'take', doing: 'Busca lo cocido para cortar' };
  const have = new Map<string, number>();
  for (const id of [...SUPPORT, ...BOARDS, 'assembly']) for (const i of g.station(id).items) if (i.kind === 'ing') have.set(i.ing, (have.get(i.ing) ?? 0) + 1);
  for (const n of ctx.wanted) {
    if ((have.get(n.ing) ?? 0) < n.count && ctx.stock(n.ing) > 0 && CUTTABLE.has(n.ing)) return { station: 'fridge', verb: 'fetch', arg: n.ing, doing: 'Busca ingredientes' };
  }
  return null;
}

/** The stove: cooks what the tickets ask cooked (egg, shrimp, eel) and leaves it on the support counters. */
function stoveNext(g: Galley, who: string, ctx: HandCtx): Step | null {
  const held = g.held(who)[0];
  const stove = g.station('stove');
  const loading = stove.phase === 'idle' || (stove.phase === 'cooking' && stove.t < COOK.stove.grace - 1);
  if (held) {
    if (held.kind !== 'ing') return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    if (held.form === 'raw' && COOKABLE.has(held.ing)) return loading && stove.items.length < g.slots('stove') ? { station: 'stove', verb: 'put', doing: 'Carga el fogón' } : null;
    if (held.form === 'cooked') {
      const spot = SUPPORT.find((c) => g.station(c).items.length < g.slots(c));
      return spot ? { station: spot, verb: 'put', doing: 'Deja lo cocido' } : { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    }
    return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
  }
  if (stove.phase === 'done' && stove.items.length) return { station: 'stove', verb: 'take', doing: 'Retira del fogón' };
  if (stove.phase === 'done' || !loading || stove.items.length >= g.slots('stove')) return null;
  // what is already cooked or on its way (counters, boards, table, the stove itself), so nothing is cooked twice
  const have = new Map<string, number>();
  for (const id of [...SUPPORT, ...BOARDS, 'assembly', 'stove']) for (const i of g.station(id).items) if (i.kind === 'ing' && (i.form === 'cooked' || i.form === 'cooked_cut' || id === 'stove')) have.set(i.ing, (have.get(i.ing) ?? 0) + 1);
  for (const n of ctx.wantedCooked ?? []) {
    if ((have.get(n.ing) ?? 0) < n.count && ctx.stock(n.ing) > 0 && COOKABLE.has(n.ing)) return { station: 'fridge', verb: 'fetch', arg: n.ing, doing: 'Busca algo para el fogón' };
  }
  return null;
}

/** A hired cook in the physical kitchen: at the stove or, as a second knife, at the boards. */
export function cookHand(e: { id: string; name?: string; job?: 'stove' | 'cut' }): HandDef {
  const stove = (e.job ?? 'stove') === 'stove';
  return {
    role: 'cook', crew: e.id,
    name: stove ? 'Cocinero de fogón' : 'Cocinero de cortes',
    job: stove ? 'Cocina en el fogón lo que piden los tickets (huevo, camarón, anguila) y lo deja en las mesadas.' : 'Corta junto a vos lo que piden los tickets (también lo cocido) y lo deja en las mesadas.',
    next: (g, who, ctx) => (stove ? stoveNext(g, who, ctx) : cutNext(g, who, ctx)),
  };
}

export const HANDS: Record<'spicy', HandDef> = {
  spicy: {
    role: 'spicy', crew: 'spicy', rice: 'rice_hand', cut: 'cut_hand', name: 'Spicy en la cocina',
    job: 'Cocina el arroz y deja una reserva lista; con la mejora de corte también corta lo que piden los tickets.',
    next(g, who, ctx) {
      const held = g.held(who)[0];
      const rice = ctx.ups.includes('rice_hand');
      const cut = ctx.ups.includes('cut_hand');
      // what he carries decides which job he is in the middle of
      if (held) return held.kind === 'ing' && held.ing === 'rice' ? (rice ? riceNext(g, who, ctx) : { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' }) : cut ? cutNext(g, who, ctx) : { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
      return (rice ? riceNext(g, who, ctx) : null) ?? (cut ? cutNext(g, who, ctx) : null);
    },
  },
};

/** The workers the restaurant has, from its upgrades. */
export function handsFor(upgrades: readonly string[]): HandDef[] {
  return Object.values(HANDS).filter((h) => upgrades.includes(h.rice!) || upgrades.includes(h.cut!));
}
