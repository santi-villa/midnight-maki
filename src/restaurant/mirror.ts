/**
 * The guest's copy of the host's dining room. While `on`, the service queries answer from the last snapshot the host sent and the
 * service actions are asked of the host instead of run here. No Phaser, no network: `coop/` fills it and reads `ask`.
 */
import type { Order } from '../core/types';
import type { GuestView, TableJob } from './service';
import type { ActKind } from '../coop/protocol';

export interface TripSnap { z: string; x: number; y: number; m: boolean; d: 'up' | 'down' | 'left' | 'right' }
export interface PartySnap { id: string; customer: string; customers: string[]; trips: TripSnap[] }
export interface FloorSnap {
  /** guests as the host's service sees them (phase, seats, patience, orders) */
  views: GuestView[];
  /** where each member of each party is standing right now */
  parties: PartySnap[];
  jobs: TableJob[];
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

const empty = (): FloorSnap => ({ views: [], parties: [], jobs: [], orders: [], cookable: [], pantry: {}, tables: [], time: { day: 1, period: 0, minutes: 0 } });

export const mirror = {
  on: false,
  snap: empty(),
  /** set by the coop module: sends the request to the host */
  ask: null as ((a: ActKind, arg: { tableId?: string; uid?: number; q?: number; b?: number; v?: string }) => void) | null,
  start() { this.on = true; this.snap = empty(); },
  stop() { this.on = false; this.snap = empty(); },
  apply(s: FloorSnap) { if (this.on) this.snap = s; },
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
    orders: asArray<Order>(r.orders),
    cookable: asArray<Order>(r.cookable),
    pantry: r.pantry && typeof r.pantry === 'object' ? r.pantry : {},
    tables: asArray<string>(r.tables),
    time: { day: Number(t.day) || 1, period: Number(t.period) || 0, minutes: Number(t.minutes) || 0 },
  };
}

/** does the host's kitchen have what this recipe needs, going by the last snapshot */
export const hostHasIngredients = (req: Record<string, number>) => Object.entries(req).every(([id, q]) => (mirror.snap.pantry[id] ?? 0) >= q);
