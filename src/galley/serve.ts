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
import { guestViews, plateState, stagePlate } from '../restaurant/service';
import { addEnergy, DISH_COST } from '../systems/fatigue';
import type { DishItem } from './prep';
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

export function deliverDish(dish: DishItem): { ok: boolean; msg?: string; uid?: number } {
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
