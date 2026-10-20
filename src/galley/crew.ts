/**
 * Kitchen hands: crew members who work at the same stations, with the same verbs, as the player. A role is a small brain that
 * looks at the kitchen and names the next thing to do; the view walks the worker there and performs it through the model.
 * Spicy is the kitchen's worker: with the rice upgrade he keeps cooked rice ready, with the cutting upgrade he also cuts what
 * the tickets ask for. Rigg serves (the pass bell) and Pip seats guests; those live in restaurant/staff.ts.
 */
import { CUTTABLE, type Need } from './prep';
import { COOK, type Galley, type Verb } from './model';

export type HandRole = 'spicy';

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
}

export interface HandDef {
  role: HandRole;
  /** the crew member who does it */
  crew: 'spicy';
  /** the upgrades that give him each job */
  rice: string;
  cut: string;
  name: string;
  job: string;
  /** seconds a station action takes (walking not included) */
  pace: number;
  next(g: Galley, who: string, ctx: HandCtx): Step | null;
}

/** how many cooked portions the rice job tries to keep ready in the hangiri */
export const RICE_RESERVE = 4;
/** seconds Spicy takes to cut one piece (the player does five reflex cuts) */
export const CUT_SECONDS = 4.5;
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
  const deficit = RICE_RESERVE - hangiri.items.length - cooker.items.length;
  if (loading && cooker.items.length < g.slots('rice') && deficit > 0 && ctx.stock('rice') > 0) return { station: 'fridge', verb: 'fetch', arg: 'rice', doing: 'Busca arroz' };
  return null;
}

function cutNext(g: Galley, who: string, ctx: HandCtx): Step | null {
  const held = g.held(who)[0];
  const boards = BOARDS.filter((b) => g.kind(b) === 'board');
  const freeBoard = boards.find((b) => !g.station(b).items.length);
  if (held) {
    if (held.kind !== 'ing') return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    if (held.form === 'cut') {
      const spot = SUPPORT.find((s) => g.station(s).items.length < g.slots(s));
      return spot ? { station: spot, verb: 'put', doing: 'Deja lo cortado' } : { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
    }
    if (held.form === 'raw' && CUTTABLE.has(held.ing) && freeBoard) return { station: freeBoard, verb: 'chop', doing: 'Corta' };
    if (held.form === 'raw' && CUTTABLE.has(held.ing)) return null; // waits for a board
    return { station: 'bin', verb: 'trash', doing: 'Tira lo que sobra' };
  }
  const done = boards.find((b) => { const it = g.station(b).items[0]; return it && it.kind === 'ing' && it.form === 'cut' && !g.station(b).pending; });
  if (done) return { station: done, verb: 'take', doing: 'Retira lo cortado' };
  if (!freeBoard) return null;
  const have = new Map<string, number>();
  for (const id of [...SUPPORT, ...BOARDS, 'assembly']) for (const i of g.station(id).items) if (i.kind === 'ing') have.set(i.ing, (have.get(i.ing) ?? 0) + 1);
  for (const n of ctx.wanted) {
    if ((have.get(n.ing) ?? 0) < n.count && ctx.stock(n.ing) > 0 && CUTTABLE.has(n.ing)) return { station: 'fridge', verb: 'fetch', arg: n.ing, doing: 'Busca ingredientes' };
  }
  return null;
}

export const HANDS: Record<HandRole, HandDef> = {
  spicy: {
    role: 'spicy', crew: 'spicy', rice: 'rice_hand', cut: 'cut_hand', name: 'Spicy en la cocina',
    job: 'Cocina el arroz y deja una reserva lista; con la mejora de corte también corta lo que piden los tickets.',
    pace: 0.7,
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
  return Object.values(HANDS).filter((h) => upgrades.includes(h.rice) || upgrades.includes(h.cut));
}
