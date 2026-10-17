/**
 * A visiting friend cooking in the host's kitchen. It is the same kitchen session the host uses, with different hooks: the dishes
 * come from the host's snapshot, the ingredients are spent on the host's side, and a finished dish goes to the host's tray.
 * Nothing is paid to the guest for cooking (only tips come to them), and no recipe progress is written for them.
 */
import type { Order } from '../core/types';
import { RECIPES_BY_ID } from '../data/recipes';
import { kitchenOpen, openKitchenSession, type KitchenHooks, type SessionOrder } from '../restaurant/kitchenSession';
import { hostHasIngredients, mirror } from '../restaurant/mirror';
import { WANT_TEXT, customerName } from '../restaurant/orders';
import { tableLabel } from '../restaurant/service';
import { addEnergy, DISH_COST, tooTiredToCook } from '../systems/fatigue';
import { toast } from '../ui/dom';

export async function enterGuestKitchen(firstUid?: number) {
  if (kitchenOpen() || !mirror.on) return;
  if (tooTiredToCook()) { toast('Estás muy cansada para cocinar. Dormí o descansá un rato en tu cama.'); return; }
  const taken = new Set<number>();
  const mine = new Map<number, Order>();
  const listed = (): Order[] => [...mirror.snap.cookable, ...[...mine.values()].filter((o) => !mirror.snap.cookable.some((c) => c.uid === o.uid))];
  const hooks: KitchenHooks = {
    orders: () => listed().filter((o) => RECIPES_BY_ID[o.recipe]).map((o): SessionOrder => ({
      uid: o.uid, recipe: RECIPES_BY_ID[o.recipe], who: customerName(o.customer), reward: o.reward,
      ready: taken.has(o.uid) || hostHasIngredients(RECIPES_BY_ID[o.recipe].ingredients),
      note: o.service ? tableLabel(o.service.tableId) + (o.want ? ` · pide ${WANT_TEXT[o.want]}` : '') : undefined,
    })),
    take: (uid) => {
      const o = mirror.snap.cookable.find((x) => x.uid === uid);
      const r = o && RECIPES_BY_ID[o.recipe];
      if (!o || !r || taken.has(uid) || !hostHasIngredients(r.ingredients)) return false;
      taken.add(uid); mine.set(uid, o);
      mirror.ask?.('cookTake', { uid });
      return true;
    },
    cancel: (uid) => {
      if (!taken.delete(uid)) return;
      mine.delete(uid);
      mirror.ask?.('cookCancel', { uid });
    },
    done: (uid, res) => {
      if (!taken.delete(uid)) return null;
      mine.delete(uid);
      addEnergy(-DISH_COST);
      mirror.ask?.('plate', { uid, q: res.quality, b: res.variantBonus, v: res.variant });
      return null;
    },
  };
  await openKitchenSession(hooks, firstUid);
}
