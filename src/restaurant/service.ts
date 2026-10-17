/**
 * Connects the dining-floor state machine to orders and coins.
 *
 * Guests walk in, wait, sit and leave on their own. The player takes the order,
 * cooks it in the existing kitchen, carries the plate back, and picks up the tip.
 * `serveOrder` runs once, after the party has eaten. The tip is not added to the
 * wallet until `collectTipAt`. Story orders stay on the counter and pay at once.
 *
 * No Phaser and no DOM. Tick about once a second while the restaurant is visible.
 * New guests only arrive while `restaurantPhase` is open. Closing stops the door
 * and lets meals already ordered finish. Skipping a shift never fails the day.
 */
import { game } from '../core/state';
import { carryCapacity } from './carry';
import { DRINKS, DRINK_BY_ID, drinksUnlocked } from './drinkData';
import { drawCustomer } from './customers';
import type { Order } from '../core/types';
import { RECIPES_BY_ID } from '../data/recipes';
import { queueHasRoom } from './waiting';
import { mirror } from './mirror';
import { RESTAURANT_HOURS, restaurantPhase } from '../systems/schedule';
import {
  createService,
  layoutTables,
  partySizeFor,
  type DiningFloor,
  type FurnPiece,
  type PartyPhase,
  type ServiceEvent,
  type ServiceOptions,
  type TableStatus,
} from './floor';
import {
  availableRecipes,
  customerName,
  maxOrders,
  orderForCustomer,
  serveOrder,
  tipBonus,
  type ServeResult,
} from './orders';

export interface PaidMeal {
  customer: string;
  recipe: string;
  quality: 0 | 1 | 2;
  kind?: 'drink';
  variant?: string;
  result: ServeResult;
}

export interface PumpResult {
  events: ServiceEvent[];
  paid: PaidMeal[];
  /** Shown once, when the public shift closes. Null the rest of the time. */
  notice: string | null;
}

export interface ShiftSummary {
  day: number;
  arrived: number;
  served: number;
  coins: number;
  tips: number;
  pending: number;
}

export interface GuestView {
  id: string;
  customerId: string;
  phase: PartyPhase;
  size: number;
  members: import('./floor').MemberView[];
  patience: number; maxPatience: number; impatient: boolean;
  seats: { id: string; x: number; y: number; rot: number }[];
  recipe: string | null;
  orderUid: number | null;
  tableId: string | null;
}

export interface TableJob {
  tableId: string;
  status: TableStatus;
  phase: PartyPhase | null;
  customerId: string | null;
  recipe: string | null;
  orderUid: number | null;
  plated: boolean;
  members: number; patience: number; maxPatience: number; impatient: boolean;
  /** dishes of this table that have not been served yet: with none left the patience bar goes away */
  unserved: number;
  tip: number;
}

interface StagedPlate {
  quality: 0 | 1 | 2;
  variantBonus: number;
  variant?: string;
}

const EMPTY: PumpResult = { events: [], paid: [], notice: null };

interface Shift {
  day: number;
  arrived: number;
  served: number;
  coins: number;
  tips: number;
  state: 'open' | 'closed';
}

let salon: DiningFloor | null = null;
let layoutKey = '';
let opts: ServiceOptions = {};
let settled = new Set<number>();
let nextId = 1;
/** Seconds until the next party walks in. The first one should not take long. */
let arriveIn = 4;
/** Saved with the room; older saves can omit the tally. */
let shift: Shift | null = null;
let sessionSave = game.save;
let bag: string[] = [];
let lastCustomer: string | null = null;

function session() {
  if (sessionSave === game.save && (salon || !game.save.dining)) return;
  sessionSave = game.save; salon = null; layoutKey = ''; settled.clear();
  const saved = game.save.dining;
  bag = saved?.bag.slice() ?? []; lastCustomer = saved?.lastCustomer ?? null;
  nextId = saved?.nextId ?? 1; shift = saved?.shift ?? null;
  if (saved) { salon = createService([], opts); salon.restore(saved.floor); }
}
function persist() {
  if (!salon) return;
  game.save.dining = { day: game.save.time.day, floor: salon.snapshot(), bag: [...bag], lastCustomer, nextId, shift: shift ? { ...shift } : null };
  // Movement/patience snapshots need autosave without firing story/UI events every tick.
  game.revision++; game.dirty = true; game.save.updatedAt = Date.now();
}

export const servingName = (order: Order) => order.kind === 'drink' ? DRINK_BY_ID[order.recipe]?.name ?? 'Bebida' : RECIPES_BY_ID[order.recipe]?.name ?? 'Plato';
export function tableLabel(id: string | null | undefined): string {
  if (mirror.on) { const i = id ? mirror.snap.tables.indexOf(id) : -1; return i >= 0 ? `Mesa ${i + 1}` : 'Mostrador'; }
  session(); const index = salon?.tableList().findIndex(t => t.id === id) ?? -1;
  return index >= 0 ? `Mesa ${index + 1}` : 'Mostrador';
}
export function carriedOrders(): Order[] { if (mirror.on) return mirror.carried(); return game.save.orders.filter(o => o.plate?.state === 'carried'); }
export function carriedOrder(tableId?: string): Order | null { return carriedOrders().find(o => tableId === undefined || o.service?.tableId === tableId) ?? null; }
export function trayOrders(): Order[] { if (mirror.on) return mirror.tray(); return game.save.orders.filter(o => o.plate && !['carried', 'delivered'].includes(o.plate.state ?? 'ready')); }

/** Draw up to four distinct faces, bounded by a real table's seats. */
export function chooseParty(pieces: FurnPiece[]): string[] {
  const floor = ensure(pieces);
  const capacity = Math.min(4, Math.max(0, ...floor.tableList().map(t => t.capacity)));
  if (!capacity) return [];
  const roll = rng();
  const desired = Math.min(capacity, roll < .5 ? 1 : roll < .8 ? 2 : roll < .95 ? 3 : 4);
  const customers: string[] = [];
  for (let i = 0; i < desired; i++) {
    const active = floor.parties().flatMap(p => p.members.map(m => m.customerId));
    const id = drawCustomer(bag, [...active, ...customers], lastCustomer, rng);
    if (!id) break;
    customers.push(id); lastCustomer = id;
  }
  persist();
  return customers;
}

function hoursNow() {
  const t = game.save.time;
  return restaurantPhase(t.period, t.minutes);
}

function pendingOrders() {
  return game.save.orders.filter((o) => !o.special).length;
}

function openShift() {
  const day = game.save.time.day;
  if (shift?.day === day) return;
  shift = { day, arrived: 0, served: 0, coins: 0, tips: 0, state: 'open' };
}

function closeShift(): string | null {
  if (!shift || shift.state !== 'open') return null;
  const sameDay = shift.day === game.save.time.day;
  shift.state = 'closed';
  // Sleep rolls the calendar before the hook runs. The day summary covers that.
  if (!sameDay) return null;
  return pendingOrders() > 0
    ? 'Midnight Maki cierra por hoy. Los pedidos ya tomados se pueden terminar. El resumen está en Pedidos.'
    : 'Midnight Maki cierra por hoy. El resumen está en Pedidos.';
}

/** Stop the door when the room is not open. Presence is what starts today's tally. */
function applyHours(present: boolean): { notice: string | null; events: ServiceEvent[] } {
  if (!game.loaded || !game.has('intro_done')) return { notice: null, events: [] };
  const phase = hoursNow();
  if (phase === 'open') {
    if (present) openShift();
    return { notice: null, events: [] };
  }
  if (phase === 'setup') return { notice: null, events: [] };
  const events = salon?.windDown() ?? [];
  return { notice: closeShift(), events };
}

function noteArrival() {
  if (shift?.state === 'open' && shift.day === game.save.time.day) shift.arrived += 1;
}

function noteBill(result: ServeResult | null, tipSeparate: boolean, day = game.save.time.day) {
  if (!shift || !result || shift.day !== day) return;
  shift.served += 1;
  if (tipSeparate) shift.coins += result.coins;
  else {
    shift.coins += Math.max(0, result.coins - result.tip);
    shift.tips += result.tip;
  }
}

function rng(): number {
  return (opts.rng ?? Math.random)();
}

function layoutOf(pieces: FurnPiece[]): string {
  return pieces.map((p) => [p.uid, p.id, p.x, p.y, p.rot ?? 0, p.w, p.h].join(':')).join('|');
}

function plateOf(uid: number): StagedPlate | null {
  const order = game.save.orders.find((o) => o.uid === uid);
  const plate = order?.plate;
  if (!plate || (plate.quality !== 0 && plate.quality !== 1 && plate.quality !== 2)) return null;
  return { quality: plate.quality, variantBonus: plate.variantBonus ?? 0, variant: plate.variant };
}

/** Pay a cooked dish that no longer has a table, so a reload does not demand a second cook. */
function payLoosePlates() {
  for (const order of [...game.save.orders]) {
    const plate = plateOf(order.uid);
    if (!plate || order.service || settled.has(order.uid)) continue;
    if (salon?.parties().some((p) => p.orderUid === order.uid)) continue;
    settled.add(order.uid);
    serveOrder(order.uid, plate.quality, plate.variantBonus, { rng });
  }
}

function ensure(pieces: FurnPiece[]): DiningFloor {
  session();
  const key = layoutOf(pieces);
  if (!salon) salon = createService(layoutTables(pieces), { ...opts });
  else if (key !== layoutKey) salon.relayout(layoutTables(pieces));
  layoutKey = key;
  payLoosePlates();
  return salon;
}

function canSpawn(floor: DiningFloor): boolean {
  if (!game.has('intro_done') || hoursNow() !== 'open' || !availableRecipes().length) return false;
  const parties = floor.parties().filter((p) => p.phase !== 'leaving');
  const queued = parties.filter((p) => !p.tableId);
  if (!queueHasRoom(queued.length, queued.reduce((n, p) => n + p.size, 0))) return false;
  if (pendingOrders() >= maxOrders() * 8) return false;
  const tables = floor.tableList().filter((t) => t.capacity > 0);
  if (!tables.length) return false;
  const busy = parties.filter((p) => p.tableId);
  if (busy.length >= tables.length) return true;
  return parties.length < maxOrders();
}

/** Preserve new individual orders overnight; settle only legacy counter plates. */
export function closeServiceForNight() {
  session(); closeShift();
  // Keep individual orders and their trays overnight. No absence penalty or surprise payment.
  salon?.windDown();
  for (const order of [...game.save.orders]) {
    const plate = plateOf(order.uid);
    if (!plate || order.service || settled.has(order.uid)) continue;
    settled.add(order.uid); serveOrder(order.uid, plate.quality, plate.variantBonus, { rng });
  }
  arriveIn = 4; persist(); game.touch('orders');
}

/** Test hook. Production uses the defaults. */
export function resetService(options?: ServiceOptions) {
  salon = null;
  layoutKey = '';
  opts = options ?? {};
  settled = new Set();
  nextId = 1;
  arriveIn = 4;
  shift = null; bag = []; lastCustomer = null; sessionSave = game.save;
  if (game.save.dining) { salon = createService([], opts); salon.restore(game.save.dining.floor); bag = [...game.save.dining.bag]; lastCustomer = game.save.dining.lastCustomer; nextId = game.save.dining.nextId; shift = game.save.dining.shift; }
}

/** One line when the public shift closes, including while the player is outside. */
export function syncRestaurantHours(present: boolean): string | null {
  session(); const notice = applyHours(present).notice; if (notice) persist(); return notice;
}

export function shiftSummary(): ShiftSummary | null {
  if (!shift || shift.state !== 'closed') return null;
  return {
    day: shift.day,
    arrived: shift.arrived,
    served: shift.served,
    coins: shift.coins,
    tips: shift.tips,
    pending: pendingOrders(),
  };
}

/** Status and the last shift, for the order board. Empty summary while the door is open. */
export function serviceBoardNote(): { status: string; summary: string[] } {
  if (!game.has('intro_done')) return { status: 'Todavía no abrís al público.', summary: [] };
  const phase = hoursNow();
  const hours = RESTAURANT_HOURS.hours;
  const status = phase === 'open'
    ? `Abierto. Horario: ${hours}.`
    : phase === 'closing'
      ? `Cerrando. No entran clientes nuevos. Horario: ${hours}.`
      : phase === 'setup'
        ? `Abre pronto. Horario: ${hours}.`
        : `Cerrado al público. Horario: ${hours}.`;
  return { status, summary: summaryLines() };
}

function summaryLines(): string[] {
  const s = shiftSummary();
  if (!s) return [];
  const head = s.day === game.save.time.day ? 'Turno de hoy' : 'Último turno';
  if (s.arrived === 0 && s.served === 0 && s.pending === 0) return [head, 'No hubo clientes en este turno.'];
  const lines = [
    head,
    s.arrived === 1 ? 'Llegó 1 grupo.' : `Llegaron ${s.arrived} grupos.`,
    s.served === 1 ? 'Serviste 1 pedido.' : `Serviste ${s.served} pedidos.`,
  ];
  if (s.coins > 0) lines.push(`Cobros: ${s.coins} ●.`);
  if (s.tips > 0) lines.push(`Propinas: ${s.tips} ●.`);
  lines.push(s.pending === 0 ? 'No quedaron pedidos pendientes.' : s.pending === 1 ? 'Queda 1 pedido por terminar.' : `Quedan ${s.pending} pedidos por terminar.`);
  return lines;
}

export function guestViews(): GuestView[] {
  if (mirror.on) return mirror.snap.views;
  session();
  if (!salon) return [];
  return salon.parties().map((party) => ({
    id: party.id,
    customerId: party.customerId,
    phase: party.phase,
    size: party.size, members: party.members, patience: party.patience, maxPatience: party.maxPatience, impatient: party.impatient,
    seats: salon!.partySeats(party.id),
    recipe: party.recipe,
    orderUid: party.orderUid,
    tableId: party.tableId,
  }));
}

/**
 * Where the "serve orders" objective points. Nothing while the restaurant is closed and empty; once a party is
 * seated and ready to order, their table; while dishes wait to be cooked or carried, the counter.
 */
export function serviceGuide(): { tableId: string } | 'counter' | null {
  if (mirror.on) { const take = mirror.snap.jobs.find((j) => j.phase === 'waiting_order'); return take ? { tableId: take.tableId } : mirror.snap.orders.length ? 'counter' : null; }
  session();
  if (!salon || !game.has('intro_done')) return null;
  const take = tableJobs().find((j) => j.phase === 'waiting_order');
  if (take) return { tableId: take.tableId };
  const phase = hoursNow();
  const busy = (phase === 'open' || phase === 'closing') && game.save.orders.some((o) => !o.special && plateState(o.uid) !== 'delivered');
  if (busy) return 'counter';
  return null;
}

export function tableJobs(): TableJob[] {
  if (mirror.on) return mirror.snap.jobs;
  session();
  if (!salon || !game.has('intro_done')) return [];
  const jobs: TableJob[] = [];
  for (const table of salon.tableList()) {
    const party = table.partyId ? salon.party(table.partyId) : null;
    const waiting = party?.phase === 'waiting_order' || party?.phase === 'waiting_food';
    if (!waiting && table.status !== 'tip') continue;
    const pending = party?.members.flatMap(m => m.items).filter(i => i.quality === null) ?? [];
    const item = pending.find(i => i.orderUid === carriedOrder(table.id)?.uid) ?? pending.find(i => i.orderUid && plateOf(i.orderUid)) ?? pending[0];
    jobs.push({
      members: party?.size ?? 0, patience: party?.patience ?? 0, maxPatience: party?.maxPatience ?? 1, impatient: party?.impatient ?? false,
      tableId: table.id,
      status: table.status,
      phase: party?.phase ?? null,
      customerId: party?.members.find(m => m.items.some(i => i.orderUid === item?.orderUid))?.customerId ?? party?.customerId ?? null,
      recipe: item?.recipe ?? party?.recipe ?? null,
      orderUid: item?.orderUid ?? party?.orderUid ?? null,
      plated: !!item?.orderUid && !!plateOf(item.orderUid),
      unserved: pending.length,
      tip: table.tip,
    });
  }
  return jobs;
}

/** Saved states distinguish kitchen work, ready dishes, transport and completed deliveries. */
export function plateState(uid: number): 'none' | 'cooking' | 'plated' | 'carried' | 'delivered' {
  if (mirror.on) { const o = mirror.snap.orders.find((x) => x.uid === uid); return o?.plate ? (o.plate.state === 'carried' || o.plate.state === 'delivered' ? o.plate.state : 'plated') : 'none'; }
  session();
  const order = game.save.orders.find(o => o.uid === uid);
  if (order?.plate) return order.plate.state === 'carried' || order.plate.state === 'delivered' ? order.plate.state : 'plated';
  return salon?.parties().some(p => p.members.some(m => m.items.some(i => i.orderUid === uid))) ? 'cooking' : 'none';
}

/** Ids of the dining tables in a stable order: "Mesa 2" must mean the same table for both players. */
export function tableIds(): string[] { session(); return salon?.tableList().map((t) => t.id) ?? []; }

export function serviceAudit(): string[] {
  return salon?.audit() ?? [];
}

/** One party walks in from the door. Returns null when the room cannot take another group. */
export function spawnGuest(pieces: FurnPiece[], customerId?: string, partyId?: string, customers?: string[]): string | null {
  const floor = ensure(pieces);
  if (!canSpawn(floor)) return null;
  let group = customers;
  if (!group) {
    if (!customerId) group = chooseParty(pieces);
    else {
      const size = partySizeFor(customerId);
      if (!floor.tableList().some(t => t.capacity >= size)) return null;
      group = [customerId];
      while (group.length < size) {
        const companion = drawCustomer(bag, group, lastCustomer, rng);
        if (!companion) return null;
        group.push(companion); lastCustomer = companion;
      }
    }
  }
  const customer = group[0];
  const waiting = floor.parties().filter((p) => !p.tableId && p.phase !== 'leaving');
  if (!customer || !floor.tableList().some(t => t.capacity >= group.length)) return null;
  if (!queueHasRoom(waiting.length, waiting.reduce((n, p) => n + p.size, 0), group.length)) return null;
  const id = partyId ?? 'g' + nextId++;
  const view = floor.arrive({ id, customerId: customer, customers: group, tipRate: tipBonus() });
  if (!view) return null;
  openShift();
  noteArrival(); game.stat('groupsReceived'); game.stat('customersReceived', view.size); persist();
  return id;
}

/** Advance phases only. Spawning is `pumpService`, so a test can move one party without a crowd. */
export function stepService(dt: number): PumpResult {
  if (!salon) return EMPTY;
  const result = settle(salon.tick(dt)); persist(); return result;
}

/** Spawn, then advance. Call about once a second while the restaurant is on screen. */
export function pumpService(dt: number, pieces: FurnPiece[], control?: { physical?: boolean; arrivals?: boolean; present?: boolean; relaxed?: boolean }): PumpResult {
  const floor = ensure(pieces);
  if (control?.physical != null) floor.setPhysical(control.physical);
  if (control?.relaxed != null) { floor.setRelaxed(control.relaxed); opts.relaxed = control.relaxed; }
  if (!game.has('intro_done')) return EMPTY;
  const hours = applyHours(control?.present ?? true);
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if (hoursNow() === 'open' && control?.arrivals !== false) {
    arriveIn -= step;
    if (arriveIn <= 0) {
      arriveIn = 22 + Math.floor(rng() * 8);
      if (canSpawn(floor)) spawnGuest(pieces);
    }
  }
  const moved = step > 0 ? floor.tick(step) : [];
  const result = settle([...hours.events, ...moved]);
  result.notice = hours.notice; persist();
  return result;
}

export function canAcceptGuest(pieces: FurnPiece[]): boolean { return canSpawn(ensure(pieces)); }
export function receiveGuest(id: string) { const out = salon?.reachReception(id) ?? []; persist(); return out; }
export function hostGuest(id: string) { const out = salon?.hostParty(id) ?? []; persist(); return out; }
export function seatGuest(id: string) { const out = salon?.reachSeats(id) ?? []; persist(); return out; }
export function exitGuest(id: string) { const out = salon?.reachExit(id) ?? []; persist(); return out; }

function settle(events: ServiceEvent[]): PumpResult {
  const paid: PaidMeal[] = [];
  for (const ev of events) {
    if (ev.type !== 'paid') continue;
    const meal = payParty(ev.partyId);
    paid.push(...meal);
  }
  return { events, paid, notice: null };
}

function payParty(partyId: string): PaidMeal[] {
  const party = salon?.party(partyId);
  if (!party) return [];
  const meals: PaidMeal[] = []; let tip = 0;
  for (const member of party.members) for (const item of member.items) {
    if (!item.orderUid || item.quality === null || settled.has(item.orderUid)) continue;
    const order = game.save.orders.find(o => o.uid === item.orderUid);
    const plate = plateOf(item.orderUid); if (!order || !plate) continue;
    settled.add(item.orderUid);
    const result = serveOrder(item.orderUid, item.quality, plate.variantBonus, { holdTip: true, noTip: member.impatient && !opts.relaxed, rng });
    noteBill(result, true); tip += result?.tip ?? 0;
    if (result) meals.push({ customer: member.customerId, recipe: item.recipe, kind: order.kind, quality: item.quality, variant: plate.variant, result });
  }
  salon?.setHeldTip(partyId, tip, meals.reduce((n, m) => n + m.result.coins, 0));
  return meals;
}

/** Write a real order for the party at this table. */
export function takeOrderAt(tableId: string): string {
  if (mirror.on) { mirror.ask?.('take', { tableId }); return ''; }
  session();
  const table = salon?.table(tableId);
  const party = table?.partyId ? salon?.party(table.partyId) : null;
  if (!party || party.phase !== 'waiting_order') return 'Ahora no hay nadie esperando el pedido.';
  const drafts = party.members.flatMap((m, index) => {
    const food = orderForCustomer(m.customerId, rng);
    if (!food) return [];
    const drink = drinksUnlocked() && rng() < .45 ? DRINKS[Math.min(DRINKS.length - 1, Math.floor(rng() * DRINKS.length))] : null;
    const service = { partyId: party.id, memberId: m.id, tableId, seatId: party.seatIds[index], day: game.save.time.day };
    const list: Omit<Order, 'uid'>[] = [{ ...food, service }];
    if (drink) list.push({ kind: 'drink', recipe: drink.id, customer: m.customerId, reward: drink.price, service });
    return list;
  });
  if (!drafts.length) return 'Todavía no conocés recetas.';
  if (pendingOrders() + drafts.length > maxOrders() * 8) return 'La cocina está llena de pedidos. Serví alguno primero.';
  for (const draft of drafts) {
    const ticket = salon!.takeOrder(party.id, { recipe: draft.recipe, reward: draft.reward, kind: draft.kind ?? 'food' }, draft.service!.memberId);
    if (!ticket) throw new Error('Cannot attach member ticket');
    game.addOrder(draft);
    const order = game.save.orders[game.save.orders.length - 1];
    if (!salon!.linkOrder(party.id, order.uid, draft.service!.memberId, draft.kind ?? 'food')) throw new Error('Cannot link member order');
  }
  persist();
  return party.size > 1 ? `Anotaste los pedidos de ${party.size} personas. Cada plato tiene su destinatario.` : `${customerName(party.customerId)} pidió ${servingName(drafts[0] as Order)}. Preparalo en la cocina.`;
}

/** Remember a finished dish until the player carries it to the table. */
export function stagePlate(uid: number, quality: 0 | 1 | 2, variantBonus = 0, variant?: string): boolean {
  if (!salon) return false;
  const party = salon.parties().find(p => p.phase === 'waiting_food' && p.members.some(m => m.items.some(i => i.orderUid === uid && i.quality === null)));
  if (!party) return false;
  if (quality !== 0 && quality !== 1 && quality !== 2) return false;
  const order = game.save.orders.find((o) => o.uid === uid);
  if (!order || order.plate) return false;
  order.plate = { quality, variantBonus: Number.isFinite(variantBonus) ? variantBonus : 0, variant };
  persist(); game.touch('order');
  return true;
}

export function pickupPlate(uid: number): string {
  if (mirror.on) {
    if (mirror.carried().length >= carryCapacity(game.save)) return 'La bandeja está llena. Entregá un pedido o dejalo en la bandeja de salida.';
    mirror.ask?.('claim', { uid }); return '';
  }
  if (game.save.orders.find(o => o.uid === uid)?.plate?.claim) return 'Alguien del personal ya lo está llevando.';
  if (carriedOrders().length >= carryCapacity(game.save)) return 'La bandeja está llena. Entregá un pedido o dejalo en la bandeja de salida.';
  const order = game.save.orders.find(o => o.uid === uid);
  if (!order?.plate || plateState(uid) !== 'plated') return 'Ese pedido todavía no está listo.';
  order.plate.state = 'carried'; persist(); game.touch('carry');
  return `Llevás ${servingName(order)} para ${customerName(order.customer)}.`;
}
/** Reserves a plate in the tray for an employee (null releases it). False when it is no longer available. */
export function claimPlate(uid: number, empId: string | null): boolean {
  const order = game.save.orders.find(o => o.uid === uid);
  if (!order?.plate) return false;
  if (empId === null) { delete order.plate.claim; return true; }
  if (order.plate.claim && order.plate.claim !== empId) return false;
  if (plateState(uid) !== 'plated') return false;
  order.plate.claim = empId;
  return true;
}
/** An employee serves the plate they claimed. Returns null on success or the reason it failed. */
export function staffDeliver(uid: number, empId: string): string | null {
  const order = game.save.orders.find(o => o.uid === uid);
  if (!order?.plate || order.plate.claim !== empId || !order.service) return 'claim';
  const party = salon?.party(order.service.partyId);
  if (!party || party.phase !== 'waiting_food') return 'table';
  if (!salon!.deliver(party.id, order.plate.quality, order.plate.variantBonus, order.uid)) return 'done';
  order.plate.state = 'delivered'; delete order.plate.claim; persist(); game.touch('delivery');
  return null;
}
export function returnPlate(uid?: number): string {
  if (mirror.on) { const o = uid === undefined ? mirror.carried()[0] : mirror.carried().find((x) => x.uid === uid); if (!o) return 'No llevás ese pedido.'; mirror.ask?.('release', { uid: o.uid }); return ''; }
  const order = uid === undefined ? carriedOrder() : carriedOrders().find(o => o.uid === uid); if (!order?.plate) return 'No llevás ese pedido.';
  order.plate.state = 'ready'; persist(); game.touch('tray'); return 'Dejaste el pedido en la bandeja.';
}
export function deliverTo(tableId: string): string {
  if (mirror.on) { mirror.ask?.('deliver', { tableId }); return ''; }
  const order = carriedOrder(tableId);
  if (!order?.plate || !order.service) return carriedOrders().length ? 'Ese pedido es para otra mesa. Seguí el marcador.' : 'Recogé primero el pedido en la bandeja de salida.';
  const party = salon?.party(order.service.partyId);
  if (!party || party.phase !== 'waiting_food') return 'Esa mesa no está esperando este pedido.';
  if (!salon!.deliver(party.id, order.plate.quality, order.plate.variantBonus, order.uid)) return 'Ese pedido ya se entregó.';
  order.plate.state = 'delivered'; persist(); game.touch('delivery');
  return `¡Buen provecho, ${customerName(order.customer)}!`;
}

export function collectTipAt(tableId: string): string {
  if (mirror.on) { mirror.ask?.('tip', { tableId }); return ''; }
  if (!salon) return 'No hay propina en esta mesa.';
  const tip = salon.collectTip(tableId);
  if (tip.amount <= 0) return 'No hay propina en esta mesa.';
  if (shift && shift.day === game.save.time.day) shift.tips += tip.amount;
  game.addCoins(tip.amount, 'tip'); persist();
  return `Recogiste ${tip.amount} de propina.`;
}

/**
 * The host's side of a guest collecting a tip: the guest gets up to `room` coins, any excess stays with the host (daily cap).
 * Returns what the guest got and what the host kept. Nothing happens when the table holds no tip.
 */
export function collectTipForGuest(tableId: string, room: number): { given: number; kept: number } {
  if (!salon) return { given: 0, kept: 0 };
  const tip = salon.collectTip(tableId);
  if (tip.amount <= 0) return { given: 0, kept: 0 };
  const given = Math.max(0, Math.min(tip.amount, Math.floor(room)));
  const kept = tip.amount - given;
  if (kept > 0) { if (shift && shift.day === game.save.time.day) shift.tips += kept; game.addCoins(kept, 'tip'); }
  persist();
  return { given, kept };
}
