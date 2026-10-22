/**
 * From the pass to the dining room. A finished dish is matched to the order that needs it most and handed to the existing
 * service: table orders go to the tray (stagePlate), counter orders pay at once (serveOrder). Mastery, records, energy and
 * coins keep working exactly as they did with the old minigame.
 */
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { Order } from '../core/types';
import { RECIPES_BY_ID } from '../data/recipes';
import { playerBusy } from '../restaurant/claims';
import { celebrate, showServeResult } from '../restaurant/kitchen';
import { customerName, serveOrder } from '../restaurant/orders';
import type { CookResult } from '../restaurant/cooking';
import { deliverTo, guestViews, plateState, stagePlate, tableLabel } from '../restaurant/service';
import { addEnergy, DISH_COST } from '../systems/fatigue';
import type { DishItem, DrinkItem } from './prep';
import { DRINK_BY_ID } from '../restaurant/drinkData';
import { runTask } from '../core/errors';

/** Food orders still waiting for their dish: nobody is cooking them and no plate is staged. */
export function cookableOrders(): Order[] {
  return game.save.orders.filter((o) => o.kind !== 'drink' && !o.plate && !o.cook && !playerBusy.has(o.uid) && !!RECIPES_BY_ID[o.recipe] && plateState(o.uid) !== 'plated');
}

/** The order of this recipe whose guests are the most impatient (story orders at the counter count as calm). */
export function orderFor(recipe: string): Order | null {
  const views = guestViews();
  const urgency = (o: Order) => {
    const party = o.service ? views.find((v) => v.id === o.service!.partyId) : null;
    if (o.service && (!party || party.phase !== 'waiting_food')) return Infinity; // not ready to receive it
    return party ? party.patience / Math.max(1, party.maxPatience) : 0.6;
  };
  return cookableOrders().filter((o) => o.recipe === recipe).map((o) => ({ o, u: urgency(o) })).filter((x) => x.u !== Infinity).sort((a, b) => a.u - b.u || a.o.uid - b.o.uid)[0]?.o ?? null;
}

/** The drink order of this kind that is waiting at a table, the most impatient first. */
export function drinkOrderFor(drink: string): Order | null {
  const views = guestViews();
  return game.save.orders.filter((o) => o.kind === 'drink' && o.recipe === drink && !o.plate && o.service && plateState(o.uid) === 'cooking')
    .map((o) => { const v = views.find((x) => x.id === o.service!.partyId); return { o, u: v && v.phase === 'waiting_food' ? v.patience / Math.max(1, v.maxPatience) : Infinity }; })
    .filter((x) => x.u !== Infinity).sort((a, b) => a.u - b.u || a.o.uid - b.o.uid)[0]?.o ?? null;
}

/** Who a finished dish or drink would go to right now (the same pick `deliverDish` makes). */
export function targetFor(item: DishItem | DrinkItem): { label: string; table: string | null; tableId: string | null } | null {
  const o = item.kind === 'drink' ? drinkOrderFor(item.drink) : orderFor(item.recipe);
  if (!o) return null;
  return o.service ? { label: `${tableLabel(o.service.tableId)} · ${customerName(o.customer)}`, table: tableLabel(o.service.tableId), tableId: o.service.tableId } : { label: `Mostrador · ${customerName(o.customer)}`, table: 'Mostrador', tableId: null };
}

/** Walking the finished dish to its table: it is staged and handed over in one go (no tray round trip). */
export function serveAtTable(dish: DishItem | DrinkItem, tableId: string): { ok: boolean; msg?: string } {
  const to = targetFor(dish);
  if (!to || to.tableId !== tableId) return { ok: false, msg: to ? `Ese plato es para ${to.table}.` : 'Esa mesa no pidió eso.' };
  const r = deliverDish(dish);
  if (!r.ok || r.uid === undefined) return { ok: false, msg: r.msg };
  const order = game.save.orders.find((o) => o.uid === r.uid);
  if (order?.plate) order.plate.state = 'carried'; // for the instant it takes to hand it over, so the tray size does not matter
  const msg = deliverTo(tableId);
  if (order?.plate?.state === 'carried') order.plate.state = 'ready';
  return { ok: true, msg };
}

export function deliverDish(dish: DishItem | DrinkItem): { ok: boolean; msg?: string; uid?: number } {
  if (dish.kind === 'drink') {
    const d = DRINK_BY_ID[dish.drink];
    const o = d && drinkOrderFor(dish.drink);
    if (!d || !o) return { ok: false, msg: `Nadie pidió ${d?.name.toLowerCase() ?? 'eso'} ahora. Dejalo en una mesada o tiralo.` };
    if (!stagePlate(o.uid, 1)) return { ok: false, msg: 'El pedido cambió. Probá de nuevo.' };
    game.stat('drinksPrepared'); game.stat('drink_' + d.id); game.touch('drink');
    audio.sfxPlay('plate_slide');
    return { ok: true, uid: o.uid };
  }
  const r = RECIPES_BY_ID[dish.recipe];
  if (!r) return { ok: false, msg: 'Ese plato ya no existe.' };
  const o = orderFor(dish.recipe);
  if (!o) return { ok: false, msg: `Nadie pidió ${r.name} ahora. Dejalo en una mesada o tiralo.` };
  const res: CookResult = { ok: true, quality: dish.dq, score: [55, 80, 100][dish.dq], variantBonus: dish.bonus, variant: dish.variant };
  celebrate(r, res);
  addEnergy(-DISH_COST);
  if (o.service) {
    if (!stagePlate(o.uid, res.quality, res.variantBonus, res.variant)) return { ok: false, msg: 'El pedido cambió. Probá de nuevo.' };
    audio.sfxPlay('plate_slide');
    bus.emit('galley:served', { uid: o.uid, recipe: r.id, quality: res.quality, table: o.service.tableId });
    return { ok: true, uid: o.uid };
  }
  // counter order (story): paid at once, with the customer's reaction
  const special = o.special;
  const out = serveOrder(o.uid, res.quality, res.variantBonus);
  if (!out) return { ok: false, msg: 'El cliente ya no está.' };
  audio.sfxPlay('coin');
  bus.emit('galley:served', { uid: o.uid, recipe: r.id, quality: res.quality, table: null });
  void runTask('galley:serve-result', async () => {
    await showServeResult(r, out, res.quality, customerName(o.customer), o.customer, res.variant);
    if (special === 'odd') { const { oddOrderServed } = await import('../story/story'); await oddOrderServed(); }
  });
  return { ok: true, uid: o.uid };
}
