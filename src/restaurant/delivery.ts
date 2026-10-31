/**
 * Groceries by phone: order what the kitchen lacks from Taro's store while it is open, and his helper brings it to the
 * restaurant a little later (straight into the pantry; what does not fit goes to the bag). One order at a time.
 */
import { bus } from '../core/events';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES_BY_ID } from '../data/recipes';
import { dayMinutes } from '../systems/daytime';
import { shopGate } from '../systems/npcs';
import { SUPPLY_GROUPS, pantryFree } from './supplies';

export const DELIVERY_FEE = 8;
/** Game minutes from the call to the knock on the door. */
export const DELIVERY_MINUTES = 45;
/** The quick order tops every ingredient a known recipe uses up to this many. */
const TOP_UP = 6;

export interface DeliveryOrder { items: Record<string, number>; at: number }

const nowMinutes = () => (game.save.time.day - 1) * 1440 + dayMinutes(game.save.time.period, game.save.time.minutes);

/** What Taro's store can bring: every stockable ingredient with a shop price. */
export function deliverable(): string[] {
  return SUPPLY_GROUPS.flatMap((g) => g.items).filter((id) => (ITEMS_BY_ID[id]?.buy ?? 0) > 0);
}

export function pendingOrder(): DeliveryOrder | null {
  const raw = game.flag('delivery_order');
  if (typeof raw !== 'string' || !raw) return null;
  try { return JSON.parse(raw) as DeliveryOrder; } catch { return null; }
}

export function minutesLeft(): number {
  const o = pendingOrder();
  return o ? Math.max(0, o.at - nowMinutes()) : 0;
}

export function orderCost(items: Record<string, number>): number {
  const goods = Object.entries(items).reduce((n, [id, q]) => n + (ITEMS_BY_ID[id]?.buy ?? 0) * q, 0);
  return goods ? goods + DELIVERY_FEE : 0;
}

/** The usual order: every buyable ingredient of the recipes she knows, topped up to a handful. */
export function suggestedOrder(): Record<string, number> {
  const used = new Set(game.save.recipesKnown.flatMap((r) => Object.keys(RECIPES_BY_ID[r]?.ingredients ?? {})));
  const out: Record<string, number> = {};
  for (const id of deliverable()) {
    if (!used.has(id)) continue;
    const need = TOP_UP - game.countUsable(id);
    if (need > 0) out[id] = need;
  }
  return out;
}

/** Places the order and charges it. Returns why it could not, or null when it is on its way. */
export function placeOrder(items: Record<string, number>): string | null {
  if (pendingOrder()) return 'Ya hay un pedido en camino.';
  const gate = shopGate('taro');
  if (!gate.open) return `El almacén de Taro está cerrado ahora (${gate.hours}).`;
  const clean = Object.fromEntries(Object.entries(items).filter(([id, q]) => q > 0 && deliverable().includes(id)).map(([id, q]) => [id, Math.floor(q)]));
  const cost = orderCost(clean);
  if (!cost) return 'Elegí algo para pedir.';
  if (!game.spend(cost, 'delivery')) return `Te faltan monedas: el pedido sale ${cost}.`;
  game.setFlag('delivery_order', JSON.stringify({ items: clean, at: nowMinutes() + DELIVERY_MINUTES }));
  game.stat('deliveries');
  return null;
}

/** Hands over a due order. Returns true when it arrived now. */
export function checkDelivery(): boolean {
  const o = pendingOrder();
  if (!o || nowMinutes() < o.at) return false;
  game.setFlag('delivery_order', '');
  let units = 0, toBag = 0;
  for (const [id, q] of Object.entries(o.items)) {
    const room = Math.max(0, Math.min(q, pantryFree()));
    if (room) game.setPantry(id, game.pantryCount(id) + room);
    if (q > room) { game.addItem(id, q - room, 'delivery'); toBag += q - room; }
    units += q;
  }
  bus.emit('delivery:arrived', { units, toBag });
  bus.emit('toast', { text: toBag ? `Llegó el pedido del almacén: ${units - toBag} a la despensa y ${toBag} a tu mochila (no entraba más).` : `Llegó el pedido del almacén: ${units} ingredientes en la despensa.` });
  return true;
}

let timer = 0;
/** Watches the clock for the knock on the door (cheap: one look every two seconds). */
export function startDeliveries() {
  if (timer) return;
  timer = window.setInterval(() => {
    if (game.loaded) checkDelivery();
  }, 2000);
}
