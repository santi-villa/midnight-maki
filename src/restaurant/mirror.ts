/**
 * The guest's copy of the host's dining room. While `on`, the service queries answer from the last snapshot the host sent and the
 * service actions are asked of the host instead of run here. No Phaser, no network: `coop/` fills it and reads `ask`.
 */
import type { Appearance, Order } from '../core/types';
import type { GuestView, TableJob } from './service';
import type { ActKind } from '../coop/protocol';

export interface TripSnap { z: string; x: number; y: number; m: boolean; d: 'up' | 'down' | 'left' | 'right' }
export interface PartySnap { id: string; customer: string; customers: string[]; trips: TripSnap[] }
/** a hired waiter or cook as the host sees them */
export interface StaffSnap { id: string; look: Appearance; x: number; y: number; dir: 'up' | 'down' | 'left' | 'right'; walk: boolean; talk: boolean; plate?: { kind?: 'drink'; recipe: string } }
export interface FloorSnap {
  /** guests as the host's service sees them (phase, seats, patience, orders) */
  views: GuestView[];
  /** where each member of each party is standing right now */
  parties: PartySnap[];
  jobs: TableJob[];
  staff: StaffSnap[];
  /** orders that have a finished plate and are not delivered yet */
  orders: Order[];
  /** food orders at a table that nobody is cooking yet: what a visiting friend can start */
  cookable: Order[];
  /** what the host has of the ingredients those dishes need (pantry plus what the host carries) */
  pantry: Record<string, number>;
  /** table ids in the host's order, so "Mesa 2" means the same thing on both screens */
  tables: string[];
  time: { day: number; period: number; minutes: number };
}

/** guests may carry for the host's tray, under this claim name */
export const GUEST_CLAIM = 'guest';

const empty = (): FloorSnap => ({ views: [], parties: [], jobs: [], staff: [], orders: [], cookable: [], pantry: {}, tables: [], time: { day: 1, period: 0, minutes: 0 } });

export const mirror = {
  on: false,
  snap: empty(),
  /** set by the coop module: sends the request to the host */
  ask: null as ((a: ActKind, arg: { tableId?: string; uid?: number; q?: number; b?: number; v?: string }) => void) | null,
  start() { this.on = true; this.snap = empty(); },
  stop() { this.on = false; this.snap = empty(); },
  apply(s: FloorSnap) { if (this.on) this.snap = s; },
  /**
   * Show the likely result of a request right away, so the action does not stay on screen while the host answers.
   * The next snapshot from the host replaces it with what really happened.
   */
  predict(a: ActKind, arg: { tableId?: string; uid?: number }) {
    const { jobs, orders, cookable } = this.snap;
    const job = jobs.find((j) => j.tableId === arg.tableId);
    const order = orders.find((o) => o.uid === arg.uid);
    if (a === 'take' && job) { job.phase = 'waiting_food'; job.recipe = null; job.orderUid = null; }
    else if (a === 'claim' && order?.plate) order.plate.claim = GUEST_CLAIM;
    else if (a === 'release' && order?.plate) delete order.plate.claim;
    else if (a === 'deliver' && job) {
      const i = orders.findIndex((o) => o.plate?.claim === GUEST_CLAIM && o.service?.tableId === arg.tableId);
      if (i >= 0) { orders.splice(i, 1); job.plated = false; }
    } else if (a === 'tip' && job) job.tip = 0;
    else if ((a === 'cookTake' || a === 'drink') && arg.uid !== undefined) { const i = cookable.findIndex((o) => o.uid === arg.uid); if (i >= 0) cookable.splice(i, 1); }
  },
  carried(): Order[] { return this.snap.orders.filter((o) => o.plate?.claim === GUEST_CLAIM); },
  tray(): Order[] { return this.snap.orders.filter((o) => o.plate && o.plate.claim !== GUEST_CLAIM && !['carried', 'delivered'].includes(o.plate.state ?? 'ready')); },
};

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v && typeof v === 'object' ? (Object.values(v) as T[]) : []);

/** The wire may drop empty parts; the game must never meet an undefined list. */
export function normalizeFloor(raw: unknown): FloorSnap | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<FloorSnap>;
  const t = (r.time ?? {}) as Partial<FloorSnap['time']>;
  return {
    views: asArray<GuestView>(r.views).map((v) => ({ ...v, members: asArray<GuestView['members'][number]>(v.members).map((m) => ({ ...m, items: asArray<GuestView['members'][number]['items'][number]>(m.items) })), seats: asArray<GuestView['seats'][number]>(v.seats) })),
    parties: asArray<PartySnap>(r.parties).map((p) => ({ ...p, customers: asArray<string>(p.customers), trips: asArray<TripSnap>(p.trips) })),
    jobs: asArray<TableJob>(r.jobs),
    staff: asArray<StaffSnap>(r.staff),
    orders: asArray<Order>(r.orders),
    cookable: asArray<Order>(r.cookable),
    pantry: r.pantry && typeof r.pantry === 'object' ? r.pantry : {},
    tables: asArray<string>(r.tables),
    time: { day: Number(t.day) || 1, period: Number(t.period) || 0, minutes: Number(t.minutes) || 0 },
  };
}

/** does the host's kitchen have what this recipe needs, going by the last snapshot */
export const hostHasIngredients = (req: Record<string, number>) => Object.entries(req).every(([id, q]) => (mirror.snap.pantry[id] ?? 0) >= q);
