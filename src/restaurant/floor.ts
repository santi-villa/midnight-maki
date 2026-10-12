/**
 * Dining-floor state machine: parties, tables, patience, orders and payment.
 *
 * This does not cook, spawn sprites, or touch the save. `orders.ts` remains
 * the economy (coins, XP, reputation, gifts). A later stage turns a ticket
 * from `takeOrder` into a real Order and pays once, when the dish is served.
 * Seating is the only automatic help. Taking the order, cooking, delivering
 * and picking up the tip stay manual.
 *
 * Tick this about once a second while the restaurant is open, not every frame.
 */
import { BALANCE } from '../core/balance';

export type PartyPhase =
  | 'outside'
  | 'reception'
  | 'queued'
  | 'walking'
  | 'seated'
  | 'waiting_order'
  | 'waiting_food'
  | 'eating'
  | 'paying'
  | 'leaving';

/** Free, reserved, occupied, waiting for the order, waiting for food, eating, tip on the table, or cleanup. */
export type TableStatus =
  | 'free'
  | 'reserved'
  | 'occupied'
  | 'waiting_order'
  | 'waiting_food'
  | 'eating'
  | 'tip'
  | 'cleanup';

export type LeaveReason = 'patience' | 'done';

export interface ServiceSeat {
  id: string;
  x: number;
  y: number;
  rot: number;
}

export interface ServiceTable {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  seats: ServiceSeat[];
  /** How many people may sit. Never larger than `seats.length`. */
  capacity: number;
}

export interface FurnPiece {
  uid: number;
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  sit?: boolean;
}

export interface PartyView {
  id: string;
  customerId: string;
  size: number;
  phase: PartyPhase;
  patience: number;
  tableId: string | null;
  seatIds: string[];
  recipe: string | null;
  reward: number;
  orderUid: number | null;
  ticket: number | null;
  quality: 0 | 1 | 2 | null;
  bill: number;
  tip: number;
  leftReason: LeaveReason | null;
}

export interface TableView {
  id: string;
  x: number;
  y: number;
  capacity: number;
  status: TableStatus;
  partyId: string | null;
  tip: number;
  seatIds: string[];
}

export interface OrderTicket {
  partyId: string;
  tableId: string;
  customer: string;
  recipe: string;
  reward: number;
  ticket: number;
}

export interface Payment {
  partyId: string;
  tableId: string | null;
  bill: number;
  tip: number;
}

export interface TipPickup {
  amount: number;
  cleared: boolean;
}

export type ServiceEvent =
  | { type: 'reception'; partyId: string }
  | { type: 'queued'; partyId: string }
  | { type: 'assigned'; partyId: string; tableId: string; seats: string[] }
  | { type: 'seated'; partyId: string; tableId: string; seats: string[] }
  | { type: 'ready'; partyId: string; tableId: string }
  | { type: 'paid'; partyId: string; bill: number; tip: number; tableId: string | null }
  | { type: 'impatient'; partyId: string }
  | { type: 'left'; partyId: string; reason: LeaveReason }
  | { type: 'cleared'; tableId: string };

export interface ArriveInput {
  id: string;
  customerId: string;
  size?: number;
  patience?: number;
  /** Charm and friendship, already summed by the caller. Clamped to 0..1. */
  tipRate?: number;
}

export interface OrderDraft {
  recipe: string;
  reward: number;
}

export interface ServiceTiming {
  approach: number;
  walk: number;
  settle: number;
  eat: number;
  pay: number;
  leave: number;
}

const DEFAULT_TIMING: ServiceTiming = {
  approach: 6,
  walk: 5,
  settle: 2,
  eat: 8,
  pay: 3,
  leave: 5,
};

const TABLE_KINDS = new Set(['table', 'roundtable', 'kotatsu']);

const PARTY_SIZE: Record<string, number> = {
  c_couple: 2,
};

/** Seconds they will queue, or wait for the player to take the order. */
const PATIENCE: Record<string, number> = {
  c_runner: 45,
  c_kid: 50,
  c_sailor: 55,
  c_student: 70,
  c_tourist: 80,
  c_fisher: 85,
  c_painter: 90,
  c_couple: 100,
  c_writer: 120,
  c_grandpa: 150,
};

const DEFAULT_PATIENCE = 90;

const HOLDS: ReadonlySet<PartyPhase> = new Set([
  'walking', 'seated', 'waiting_order', 'waiting_food', 'eating', 'paying', 'leaving',
]);

interface Party {
  id: string;
  customerId: string;
  size: number;
  phase: PartyPhase;
  phaseT: number;
  patience: number;
  tableId: string | null;
  seatIds: string[];
  recipe: string | null;
  reward: number;
  orderUid: number | null;
  ticket: number | null;
  quality: 0 | 1 | 2 | null;
  tipRate: number;
  variantBonus: number;
  bill: number;
  tip: number;
  leftReason: LeaveReason | null;
}

interface TableState {
  id: string;
  x: number;
  y: number;
  capacity: number;
  seats: ServiceSeat[];
  status: TableStatus;
  partyId: string | null;
  tip: number;
}

export function partySizeFor(customerId: string, size?: number): number {
  const raw = size ?? PARTY_SIZE[customerId] ?? 1;
  const n = Math.round(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, n));
}

export function patienceFor(customerId: string): number {
  return PATIENCE[customerId] ?? DEFAULT_PATIENCE;
}

/** Same quality math as a served dish, without adding coins. */
export function quoteBill(reward: number, quality: 0 | 1 | 2, tipRate: number, variantBonus = 0): number {
  const rate = clamp01(tipRate);
  return Math.round(reward * (1 + BALANCE.qualityBonus[quality] + rate)) + variantBonus;
}

/**
 * Tip roll, matching the odds in `serveOrder`: 55% perfect, 25% good, none otherwise.
 * `portion` is 0..1 and maps to 10%..30% of the reward. No coins are paid here.
 */
export function rollTip(reward: number, quality: 0 | 1 | 2, chanceRoll: number, portionRoll: number): number {
  const chance = quality === 2 ? 0.55 : quality === 1 ? 0.25 : 0;
  if (chanceRoll >= chance) return 0;
  const portion = Math.max(0, Math.min(1, portionRoll));
  return Math.round(reward * (0.1 + portion * 0.2));
}

export function layoutTables(pieces: FurnPiece[]): ServiceTable[] {
  const tables = pieces.filter((p) => TABLE_KINDS.has(p.kind));
  const seats = pieces.filter((p) => p.sit && p.kind !== 'bench' && !TABLE_KINDS.has(p.kind));
  const used = new Set<number>();
  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
  const out: ServiceTable[] = [];
  for (const table of sorted) {
    const mine = seats.filter((seat) => {
      if (used.has(seat.uid) || !touches(seat, table)) return false;
      let best = manhattan(seat, table);
      let bestUid = table.uid;
      for (const other of tables) {
        if (!touches(seat, other)) continue;
        const dist = manhattan(seat, other);
        if (dist < best || (dist === best && other.uid < bestUid)) {
          best = dist;
          bestUid = other.uid;
        }
      }
      return bestUid === table.uid;
    });
    mine.sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
    for (const seat of mine) used.add(seat.uid);
    const seatDefs = mine.map((seat) => ({ id: String(seat.uid), x: seat.x, y: seat.y, rot: seat.rot ?? 0 }));
    out.push({
      id: String(table.uid),
      x: table.x,
      y: table.y,
      w: table.w,
      h: table.h,
      seats: seatDefs,
      capacity: seatDefs.length,
    });
  }
  return out;
}

export interface ServiceOptions {
  rng?: () => number;
  timing?: Partial<ServiceTiming>;
}

export class DiningFloor {
  private readonly tables: TableState[];
  private readonly guests: Party[] = [];
  private readonly rng: () => number;
  private readonly timing: ServiceTiming;
  private nextTicket = 1;

  constructor(tables: ServiceTable[], opts: ServiceOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.timing = { ...DEFAULT_TIMING, ...opts.timing };
    const seen = new Set<string>();
    this.tables = [];
    for (const table of tables) {
      if (seen.has(table.id)) continue;
      seen.add(table.id);
      const seats = table.seats.filter((seat) => seat.id).map((seat) => ({ ...seat }));
      const declared = Number.isFinite(table.capacity) ? table.capacity : seats.length;
      this.tables.push({
        id: table.id,
        x: table.x,
        y: table.y,
        seats,
        capacity: Math.max(0, Math.min(declared, seats.length)),
        status: 'free',
        partyId: null,
        tip: 0,
      });
    }
  }

  arrive(input: ArriveInput): PartyView | null {
    if (!input.id || this.guests.some((p) => p.id === input.id)) return null;
    const party: Party = {
      id: input.id,
      customerId: input.customerId,
      size: partySizeFor(input.customerId, input.size),
      phase: 'outside',
      phaseT: 0,
      patience: Math.max(0, input.patience ?? patienceFor(input.customerId)),
      tableId: null,
      seatIds: [],
      recipe: null,
      reward: 0,
      orderUid: null,
      ticket: null,
      quality: null,
      tipRate: clamp01(input.tipRate ?? 0),
      variantBonus: 0,
      bill: 0,
      tip: 0,
      leftReason: null,
    };
    this.guests.push(party);
    return viewParty(party);
  }

  /**
   * Advance automatic phases and seat whoever fits.
   * One phase change per party per call, so a long stall cannot eat and leave in the same step.
   */
  tick(dt: number): ServiceEvent[] {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const events: ServiceEvent[] = [];
    for (const party of [...this.guests]) this.advance(party, step, events);
    this.seatQueued(events);
    return events;
  }

  /** Player takes the order at the table. Does not create a saved Order. */
  takeOrder(partyId: string, draft: OrderDraft): OrderTicket | null {
    const party = this.guests.find((p) => p.id === partyId);
    if (!party || party.phase !== 'waiting_order' || !party.tableId) return null;
    if (!draft.recipe || !Number.isFinite(draft.reward)) return null;
    const ticket = this.nextTicket++;
    party.recipe = draft.recipe;
    party.reward = Math.max(0, Math.round(draft.reward));
    party.ticket = ticket;
    party.phase = 'waiting_food';
    party.phaseT = 0;
    this.syncTable(party);
    return {
      partyId: party.id,
      tableId: party.tableId,
      customer: party.customerId,
      recipe: party.recipe,
      reward: party.reward,
      ticket,
    };
  }

  /** Attach the uid from `game.addOrder` once the kitchen owns the ticket. */
  linkOrder(partyId: string, uid: number): boolean {
    const party = this.guests.find((p) => p.id === partyId);
    if (!party || party.phase !== 'waiting_food' || party.ticket === null) return false;
    if (!Number.isFinite(uid) || uid <= 0 || this.guests.some((p) => p.orderUid === uid)) return false;
    party.orderUid = uid;
    return true;
  }

  /** Dish arrives. Quality is remembered for the bill. Still no coins. */
  deliver(partyId: string, quality: 0 | 1 | 2, variantBonus = 0): { partyId: string; tableId: string; quality: 0 | 1 | 2 } | null {
    const party = this.guests.find((p) => p.id === partyId);
    if (!party || party.phase !== 'waiting_food' || !party.tableId || party.ticket === null) return null;
    if (quality !== 0 && quality !== 1 && quality !== 2) return null;
    party.quality = quality;
    party.variantBonus = Number.isFinite(variantBonus) ? variantBonus : 0;
    party.phase = 'eating';
    party.phaseT = 0;
    this.syncTable(party);
    return { partyId: party.id, tableId: party.tableId, quality };
  }

  /** Pick up the tip after the party has paid. The table stays dirty until they are gone. */
  collectTip(tableId: string): TipPickup {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table || table.status !== 'tip' || table.tip <= 0) return { amount: 0, cleared: false };
    const amount = table.tip;
    table.tip = 0;
    table.status = table.partyId ? 'cleanup' : 'free';
    return { amount, cleared: table.status === 'free' };
  }

  party(id: string): PartyView | null {
    const party = this.guests.find((p) => p.id === id);
    return party ? viewParty(party) : null;
  }

  parties(): PartyView[] {
    return this.guests.map(viewParty);
  }

  table(id: string): TableView | null {
    const table = this.tables.find((t) => t.id === id);
    return table ? viewTable(table) : null;
  }

  tableList(): TableView[] {
    return this.tables.map(viewTable);
  }

  /** Empty when no party is duplicated, stuck on a table, or sharing a seat. */
  audit(): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    const seenSeats = new Set<string>();
    for (const party of this.guests) {
      if (ids.has(party.id)) problems.push(`duplicate party ${party.id}`);
      ids.add(party.id);
      if (party.seatIds.length > 0 && party.seatIds.length !== party.size) problems.push(`seat count ${party.id}`);
      for (const seat of party.seatIds) {
        if (seenSeats.has(seat)) problems.push(`shared seat ${seat}`);
        seenSeats.add(seat);
      }
      const holds = HOLDS.has(party.phase) && party.phase !== 'leaving';
      if ((party.phase === 'queued' || party.phase === 'outside' || party.phase === 'reception') && party.tableId) {
        problems.push(`queued with a table ${party.id}`);
      }
      if (holds && !party.tableId) problems.push(`missing table ${party.id}`);
      if (!party.tableId) continue;
      const table = this.tables.find((t) => t.id === party.tableId);
      if (!table) {
        problems.push(`unknown table ${party.tableId}`);
        continue;
      }
      if (table.partyId === party.id) {
        const expected = expectedStatus(party.phase, table.tip);
        if (expected && table.status !== expected) problems.push(`status ${table.id} ${table.status} != ${expected}`);
      } else if (party.phase !== 'leaving') {
        problems.push(`table ${table.id} is not held by ${party.id}`);
      }
    }
    for (const table of this.tables) {
      const holders = this.guests.filter((p) => p.tableId === table.id && p.phase !== 'leaving');
      if (holders.length > 1) problems.push(`shared table ${table.id}`);
      if (table.partyId) {
        const holder = this.guests.find((p) => p.id === table.partyId);
        if (!holder || holder.tableId !== table.id) problems.push(`dangling party ${table.id}`);
      }
      if (table.status === 'free' && (table.partyId || table.tip > 0)) problems.push(`dirty free ${table.id}`);
      if (table.status === 'tip' && table.tip <= 0) problems.push(`empty tip ${table.id}`);
      if (table.status !== 'free' && table.status !== 'tip' && !table.partyId) problems.push(`empty ${table.status} ${table.id}`);
    }
    return problems;
  }

  private advance(party: Party, dt: number, events: ServiceEvent[]) {
    if (dt > 0 && (party.phase === 'queued' || party.phase === 'waiting_order')) {
      party.patience -= dt;
      if (party.patience <= 0) {
        this.abandon(party, events);
        return;
      }
    }
    if (party.phase === 'queued') return;
    if (party.phase === 'reception') {
      this.receive(party, events);
      return;
    }
    const limit = this.limit(party.phase);
    if (limit === null) return;
    party.phaseT += dt;
    if (party.phaseT < limit) return;
    this.complete(party, events);
  }

  private complete(party: Party, events: ServiceEvent[]) {
    switch (party.phase) {
      case 'outside':
        party.phase = 'reception';
        party.phaseT = 0;
        events.push({ type: 'reception', partyId: party.id });
        this.receive(party, events);
        return;
      case 'walking':
        party.phase = 'seated';
        party.phaseT = 0;
        this.syncTable(party);
        events.push({ type: 'seated', partyId: party.id, tableId: party.tableId ?? '', seats: [...party.seatIds] });
        return;
      case 'seated':
        party.phase = 'waiting_order';
        party.phaseT = 0;
        this.syncTable(party);
        events.push({ type: 'ready', partyId: party.id, tableId: party.tableId ?? '' });
        return;
      case 'eating':
        party.phase = 'paying';
        party.phaseT = 0;
        this.syncTable(party);
        return;
      case 'paying':
        this.finishPay(party, events);
        return;
      case 'leaving':
        this.finishLeave(party, events);
        return;
      default:
        return;
    }
  }

  private receive(party: Party, events: ServiceEvent[]) {
    if (party.phase !== 'reception') return;
    if (!this.trySeat(party, events)) {
      party.phase = 'queued';
      party.phaseT = 0;
      events.push({ type: 'queued', partyId: party.id });
    }
  }

  private seatQueued(events: ServiceEvent[]) {
    for (const party of this.guests) {
      if (party.phase === 'queued') this.trySeat(party, events);
    }
  }

  private trySeat(party: Party, events: ServiceEvent[]): boolean {
    if (party.phase !== 'queued' && party.phase !== 'reception') return false;
    if (party.tableId) return false;
    const table = this.bestTable(party.size);
    if (!table) return false;
    const seats = table.seats.slice(0, party.size);
    if (seats.length < party.size) return false;
    table.partyId = party.id;
    table.status = 'reserved';
    table.tip = 0;
    party.tableId = table.id;
    party.seatIds = seats.map((seat) => seat.id);
    party.phase = 'walking';
    party.phaseT = 0;
    events.push({ type: 'assigned', partyId: party.id, tableId: table.id, seats: [...party.seatIds] });
    return true;
  }

  private bestTable(size: number): TableState | null {
    const open = this.tables.filter((table) =>
      table.status === 'free' && !table.partyId && table.tip <= 0 && table.capacity >= size && table.seats.length >= size);
    open.sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
    return open[0] ?? null;
  }

  private abandon(party: Party, events: ServiceEvent[]) {
    const table = this.tables.find((t) => t.id === party.tableId);
    if (table && table.partyId === party.id) {
      table.partyId = null;
      table.tip = 0;
      table.status = 'free';
      events.push({ type: 'cleared', tableId: table.id });
    }
    party.tableId = null;
    party.seatIds = [];
    party.patience = 0;
    party.phase = 'leaving';
    party.phaseT = 0;
    party.leftReason = 'patience';
    events.push({ type: 'impatient', partyId: party.id });
  }

  private finishPay(party: Party, events: ServiceEvent[]) {
    const quality = party.quality ?? 0;
    party.bill = quoteBill(party.reward, quality, party.tipRate, party.variantBonus);
    const chanceRoll = this.rng();
    party.tip = quality >= 1 && chanceRoll < (quality === 2 ? 0.55 : 0.25)
      ? rollTip(party.reward, quality, 0, this.rng())
      : 0;
    party.phase = 'leaving';
    party.phaseT = 0;
    party.leftReason = 'done';
    const table = this.tables.find((t) => t.id === party.tableId);
    if (table && table.partyId === party.id) {
      table.tip = party.tip;
      table.status = party.tip > 0 ? 'tip' : 'cleanup';
    }
    events.push({ type: 'paid', partyId: party.id, bill: party.bill, tip: party.tip, tableId: party.tableId });
  }

  private finishLeave(party: Party, events: ServiceEvent[]) {
    const table = this.tables.find((t) => t.id === party.tableId);
    if (table && table.partyId === party.id) {
      table.partyId = null;
      if (table.tip > 0) table.status = 'tip';
      else {
        table.tip = 0;
        table.status = 'free';
        events.push({ type: 'cleared', tableId: table.id });
      }
    }
    events.push({ type: 'left', partyId: party.id, reason: party.leftReason ?? 'done' });
    const index = this.guests.findIndex((p) => p.id === party.id);
    if (index >= 0) this.guests.splice(index, 1);
  }

  private syncTable(party: Party) {
    const table = this.tables.find((t) => t.id === party.tableId);
    if (!table || table.partyId !== party.id) return;
    const status = expectedStatus(party.phase, table.tip);
    if (status) table.status = status;
  }

  private limit(phase: PartyPhase): number | null {
    switch (phase) {
      case 'outside': return this.timing.approach;
      case 'walking': return this.timing.walk;
      case 'seated': return this.timing.settle;
      case 'eating': return this.timing.eat;
      case 'paying': return this.timing.pay;
      case 'leaving': return this.timing.leave;
      default: return null;
    }
  }
}

export function createService(tables: ServiceTable[], opts?: ServiceOptions): DiningFloor {
  return new DiningFloor(tables, opts);
}

function expectedStatus(phase: PartyPhase, tip: number): TableStatus | null {
  switch (phase) {
    case 'walking': return 'reserved';
    case 'seated': return 'occupied';
    case 'waiting_order': return 'waiting_order';
    case 'waiting_food': return 'waiting_food';
    case 'eating': return 'eating';
    case 'paying': return 'eating';
    case 'leaving': return tip > 0 ? 'tip' : 'cleanup';
    default: return null;
  }
}

function viewParty(party: Party): PartyView {
  return {
    id: party.id,
    customerId: party.customerId,
    size: party.size,
    phase: party.phase,
    patience: party.patience,
    tableId: party.tableId,
    seatIds: [...party.seatIds],
    recipe: party.recipe,
    reward: party.reward,
    orderUid: party.orderUid,
    ticket: party.ticket,
    quality: party.quality,
    bill: party.bill,
    tip: party.tip,
    leftReason: party.leftReason,
  };
}

function viewTable(table: TableState): TableView {
  return {
    id: table.id,
    x: table.x,
    y: table.y,
    capacity: table.capacity,
    status: table.status,
    partyId: table.partyId,
    tip: table.tip,
    seatIds: table.seats.map((seat) => seat.id),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function touches(seat: FurnPiece, table: FurnPiece): boolean {
  for (let j = 0; j < table.h; j++) {
    for (let i = 0; i < table.w; i++) {
      if (Math.max(Math.abs(seat.x - (table.x + i)), Math.abs(seat.y - (table.y + j))) <= 1) return true;
    }
  }
  return false;
}

function manhattan(seat: FurnPiece, table: FurnPiece): number {
  let best = Infinity;
  for (let j = 0; j < table.h; j++) {
    for (let i = 0; i < table.w; i++) {
      const dist = Math.abs(seat.x - (table.x + i)) + Math.abs(seat.y - (table.y + j));
      if (dist < best) best = dist;
    }
  }
  return best;
}
