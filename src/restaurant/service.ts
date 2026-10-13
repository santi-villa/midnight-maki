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
import { RECIPES_BY_ID } from '../data/recipes';
import { RESTAURANT_HOURS, restaurantPhase } from '../systems/schedule';
import {
  createService,
  layoutTables,
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
  GENERIC_CUSTOMERS,
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
/** Memory only. A reload forgets the tally; the save does not need a new field. */
let shift: Shift | null = null;

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
    if (!plate || settled.has(order.uid)) continue;
    if (salon?.parties().some((p) => p.orderUid === order.uid)) continue;
    settled.add(order.uid);
    serveOrder(order.uid, plate.quality, plate.variantBonus, { rng });
  }
}

function ensure(pieces: FurnPiece[]): DiningFloor {
  const key = layoutOf(pieces);
  if (salon && key === layoutKey) return salon;
  salon = createService(layoutTables(pieces), { rng: opts.rng, timing: opts.timing });
  layoutKey = key;
  payLoosePlates();
  return salon;
}

function canSpawn(floor: DiningFloor): boolean {
  if (!game.has('intro_done') || hoursNow() !== 'open' || !availableRecipes().length) return false;
  const parties = floor.parties().filter((p) => p.phase !== 'leaving');
  const queued = parties.filter((p) => !p.tableId);
  if (queued.length >= 1) return false;
  if (game.save.orders.filter((o) => !o.special).length >= maxOrders()) return false;
  const tables = floor.tableList().filter((t) => t.capacity > 0);
  if (!tables.length) return false;
  const busy = parties.filter((p) => p.tableId);
  if (busy.length >= tables.length) return true;
  return parties.length < maxOrders();
}

/** Drop the live room. Cooked plates are paid now; unfinished orders wait for the daily clear. */
export function closeServiceForNight() {
  // Sleep ends the shift even if the clock has not reached closing time.
  // newDay() advances the calendar before this hook, so keep the shift's own day.
  const serviceDay = shift?.day;
  closeShift();
  salon = null;
  for (const order of [...game.save.orders]) {
    const plate = plateOf(order.uid);
    if (!plate || settled.has(order.uid)) continue;
    settled.add(order.uid);
    const result = serveOrder(order.uid, plate.quality, plate.variantBonus, { rng });
    if (serviceDay != null) noteBill(result, false, serviceDay);
  }
  layoutKey = '';
  arriveIn = 4;
  game.touch('orders');
}

/** Test hook. Production uses the defaults. */
export function resetService(options?: ServiceOptions) {
  salon = null;
  layoutKey = '';
  opts = options ?? {};
  settled = new Set();
  nextId = 1;
  arriveIn = 4;
  shift = null;
}

/** One line when the public shift closes, including while the player is outside. */
export function syncRestaurantHours(present: boolean): string | null {
  return applyHours(present).notice;
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
    s.arrived === 1 ? 'Llegó 1 cliente.' : `Llegaron ${s.arrived} clientes.`,
    s.served === 1 ? 'Serviste 1 plato.' : `Serviste ${s.served} platos.`,
  ];
  if (s.coins > 0) lines.push(`Cobros: ${s.coins} ●.`);
  if (s.tips > 0) lines.push(`Propinas: ${s.tips} ●.`);
  lines.push(s.pending === 0 ? 'No quedaron pedidos pendientes.' : s.pending === 1 ? 'Queda 1 pedido por terminar.' : `Quedan ${s.pending} pedidos por terminar.`);
  return lines;
}

export function guestViews(): GuestView[] {
  if (!salon) return [];
  return salon.parties().map((party) => ({
    id: party.id,
    customerId: party.customerId,
    phase: party.phase,
    size: party.size,
    seats: salon!.partySeats(party.id),
    recipe: party.recipe,
    orderUid: party.orderUid,
    tableId: party.tableId,
  }));
}

export function tableJobs(): TableJob[] {
  if (!salon || !game.has('intro_done')) return [];
  const jobs: TableJob[] = [];
  for (const table of salon.tableList()) {
    const party = table.partyId ? salon.party(table.partyId) : null;
    const waiting = party?.phase === 'waiting_order' || party?.phase === 'waiting_food';
    if (!waiting && table.status !== 'tip') continue;
    jobs.push({
      tableId: table.id,
      status: table.status,
      phase: party?.phase ?? null,
      customerId: party?.customerId ?? null,
      recipe: party?.recipe ?? null,
      orderUid: party?.orderUid ?? null,
      plated: !!party?.orderUid && !!plateOf(party.orderUid),
      tip: table.tip,
    });
  }
  return jobs;
}

/** `none` cooks and pays at the counter. `cooking` waits for the kitchen. `plated` is ready to carry. */
export function plateState(uid: number): 'none' | 'cooking' | 'plated' {
  const party = salon?.parties().find((p) => p.orderUid === uid);
  if (!party || party.phase !== 'waiting_food') return 'none';
  return plateOf(uid) ? 'plated' : 'cooking';
}

export function serviceAudit(): string[] {
  return salon?.audit() ?? [];
}

/** One party walks in from the door. Returns null when the room cannot take another group. */
export function spawnGuest(pieces: FurnPiece[], customerId?: string, partyId?: string): string | null {
  const floor = ensure(pieces);
  if (!canSpawn(floor)) return null;
  const customer = customerId ?? GENERIC_CUSTOMERS[Math.floor(rng() * GENERIC_CUSTOMERS.length)]?.id;
  if (!customer) return null;
  const id = partyId ?? 'g' + nextId++;
  const view = floor.arrive({ id, customerId: customer, tipRate: tipBonus() });
  if (!view) return null;
  openShift();
  noteArrival();
  return id;
}

/** Advance phases only. Spawning is `pumpService`, so a test can move one party without a crowd. */
export function stepService(dt: number): PumpResult {
  if (!salon) return EMPTY;
  return settle(salon.tick(dt));
}

/** Spawn, then advance. Call about once a second while the restaurant is on screen. */
export function pumpService(dt: number, pieces: FurnPiece[], control?: { physical?: boolean; arrivals?: boolean; present?: boolean }): PumpResult {
  const floor = ensure(pieces);
  if (control?.physical != null) floor.setPhysical(control.physical);
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
  result.notice = hours.notice;
  return result;
}

export function canAcceptGuest(pieces: FurnPiece[]): boolean { return canSpawn(ensure(pieces)); }
export function receiveGuest(id: string) { return salon?.reachReception(id) ?? []; }
export function hostGuest(id: string) { return salon?.hostParty(id) ?? []; }
export function seatGuest(id: string) { return salon?.reachSeats(id) ?? []; }
export function exitGuest(id: string) { return salon?.reachExit(id) ?? []; }

function settle(events: ServiceEvent[]): PumpResult {
  const paid: PaidMeal[] = [];
  for (const ev of events) {
    if (ev.type !== 'paid') continue;
    const meal = payParty(ev.partyId);
    if (meal) paid.push(meal);
  }
  return { events, paid, notice: null };
}

function payParty(partyId: string): PaidMeal | null {
  if (!salon) return null;
  const party = salon.party(partyId);
  if (!party?.orderUid || !party.recipe || party.quality === null) return null;
  if (settled.has(party.orderUid)) return null;
  const plate = plateOf(party.orderUid);
  const quality = plate?.quality ?? party.quality;
  const variantBonus = plate?.variantBonus ?? 0;
  settled.add(party.orderUid);
  const result = serveOrder(party.orderUid, quality, variantBonus, { holdTip: true, rng });
  noteBill(result, true);
  const tip = result?.tip ?? 0;
  salon.setHeldTip(party.id, tip);
  if (!result) return null;
  return { customer: party.customerId, recipe: party.recipe, quality, variant: plate?.variant, result };
}

/** Write a real order for the party at this table. */
export function takeOrderAt(tableId: string): string {
  if (!salon) return 'No hay nadie en esa mesa.';
  const table = salon.table(tableId);
  const party = table?.partyId ? salon.party(table.partyId) : null;
  if (!party || party.phase !== 'waiting_order') return 'Ahora no hay nadie esperando el pedido.';
  if (game.save.orders.filter((o) => !o.special).length >= maxOrders()) return 'La cocina está llena de pedidos. Serví alguno primero.';
  const draft = orderForCustomer(party.customerId, rng);
  if (!draft) return 'Todavía no conocés recetas.';
  const ticket = salon.takeOrder(party.id, { recipe: draft.recipe, reward: draft.reward });
  if (!ticket) return 'No pude tomar el pedido.';
  game.addOrder(draft);
  const uid = game.save.orders[game.save.orders.length - 1]?.uid ?? 0;
  if (!salon.linkOrder(party.id, uid)) {
    const idx = game.save.orders.findIndex((o) => o.uid === uid);
    if (idx >= 0) game.save.orders.splice(idx, 1);
    salon.cancelTicket(party.id);
    game.touch('orders');
    return 'No pude anotar el pedido.';
  }
  const dish = RECIPES_BY_ID[draft.recipe]?.name ?? 'un plato';
  return `${customerName(party.customerId)} pidió ${dish}. Preparalo en la cocina.`;
}

/** Remember a finished dish until the player carries it to the table. */
export function stagePlate(uid: number, quality: 0 | 1 | 2, variantBonus = 0, variant?: string): boolean {
  if (!salon) return false;
  const party = salon.parties().find((p) => p.orderUid === uid && p.phase === 'waiting_food');
  if (!party) return false;
  if (quality !== 0 && quality !== 1 && quality !== 2) return false;
  const order = game.save.orders.find((o) => o.uid === uid);
  if (!order) return false;
  order.plate = { quality, variantBonus: Number.isFinite(variantBonus) ? variantBonus : 0, variant };
  game.touch('order');
  return true;
}

export function deliverTo(tableId: string): string {
  if (!salon) return 'No hay nadie en esa mesa.';
  const table = salon.table(tableId);
  const party = table?.partyId ? salon.party(table.partyId) : null;
  if (!party || party.phase !== 'waiting_food' || !party.orderUid) return 'Esa mesa no está esperando la comida.';
  const plate = plateOf(party.orderUid);
  if (!plate) return 'Todavía no cocinaste ese pedido.';
  const done = salon.deliver(party.id, plate.quality, plate.variantBonus);
  if (!done) return 'No pude dejar el plato.';
  return '¡Buen provecho!';
}

export function collectTipAt(tableId: string): string {
  if (!salon) return 'No hay propina en esta mesa.';
  const tip = salon.collectTip(tableId);
  if (tip.amount <= 0) return 'No hay propina en esta mesa.';
  if (shift && shift.day === game.save.time.day) shift.tips += tip.amount;
  game.addCoins(tip.amount, 'tip');
  return `Recogiste ${tip.amount} de propina.`;
}
