/**
 * The host's half of shared service. The guest asks (take an order, carry a plate, deliver, collect a tip); the host runs the
 * same functions the staff use and answers. Nothing here trusts the guest: every request is checked against the host's own game.
 * The only coins that ever go to the guest are tips, and only up to a daily cap.
 */
import { game } from '../core/state';
import { RECIPES_BY_ID } from '../data/recipes';
import { DRINK_BY_ID, drinksUnlocked } from '../restaurant/drinkData';
import { employees, runtime as staffRuntime } from '../restaurant/staff';
import { carryCapacity } from '../restaurant/carry';
import { playerBusy } from '../restaurant/claims';
import { GUEST_CLAIM, type FloorSnap, type PartySnap, type StaffSnap } from '../restaurant/mirror';
import { customerName } from '../restaurant/orders';
import { claimPlate, collectTipForGuest, guestViews, servingName, stagePlate, staffDeliver, tableIds, tableJobs, takeOrderAt } from '../restaurant/service';
import type { ActMsg, ResMsg } from './protocol';

/** Most tip coins a visiting friend can take home per game day. */
export const GUEST_TIP_CAP = 120;
let ledger = { day: -1, given: 0 };

export function resetServe() { ledger = { day: -1, given: 0 }; releaseGuestClaims(); dropGuestCooking(); }

/** Dishes the guest started: the host's ingredients are already spent, and the crew must not start the same order. */
const guestCooking = new Set<number>();
const refund = (uid: number) => {
  const o = game.save.orders.find((x) => x.uid === uid);
  const r = o && (RECIPES_BY_ID[o.recipe] ?? DRINK_BY_ID[o.recipe]);
  if (r) for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
};
/** The guest left in the middle of a dish: the ingredients go back to the host. */
export function dropGuestCooking() {
  for (const uid of guestCooking) { refund(uid); playerBusy.delete(uid); }
  guestCooking.clear();
}

/** An order a friend may start: a dish or a drink at a table whose party waits for it, that nobody is making. */
const cookableOrders = () => {
  const waiting = new Set(guestViews().filter((v) => v.phase === 'waiting_food').map((v) => v.id));
  return game.save.orders.filter((o) => o.service && !o.plate && !o.cook && !playerBusy.has(o.uid) && waiting.has(o.service.partyId) && !!(o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe]));
};

/** Plates the guest was carrying go back to the tray (the guest left, or never finished). */
export function releaseGuestClaims() {
  for (const o of game.save.orders) if (o.plate?.claim === GUEST_CLAIM) delete o.plate.claim;
}

const guestCarrying = () => game.save.orders.filter((o) => o.plate?.claim === GUEST_CLAIM && o.plate.state !== 'delivered');

const DELIVER_WHY: Record<string, string> = {
  claim: 'Ese pedido ya no es tuyo. Recogelo de nuevo en la bandeja.',
  table: 'Esa mesa no está esperando este pedido.',
  done: 'Ese pedido ya se entregó.',
};

export function runAct(msg: ActMsg): ResMsg {
  const done = (text: string, coins?: number): ResMsg => ({ t: 'res', id: msg.id, text, ...(coins ? { coins } : {}) });
  switch (msg.a) {
    case 'take':
      return done(msg.tableId ? takeOrderAt(msg.tableId) : 'Ahora no hay nadie esperando el pedido.');
    case 'claim': {
      const o = game.save.orders.find((x) => x.uid === msg.uid);
      if (!o) return done('Ese pedido ya no está disponible.');
      if (guestCarrying().length >= carryCapacity(game.save)) return done('La bandeja está llena. Entregá un pedido o dejalo en la bandeja de salida.');
      return done(claimPlate(o.uid, GUEST_CLAIM) ? `Llevás ${servingName(o)} para ${customerName(o.customer)}.` : 'Ese pedido ya no está disponible.');
    }
    case 'release': {
      const o = guestCarrying().find((x) => x.uid === msg.uid);
      if (!o) return done('No llevás ese pedido.');
      claimPlate(o.uid, null);
      return done('Dejaste el pedido en la bandeja.');
    }
    case 'deliver': {
      const o = guestCarrying().find((x) => x.service?.tableId === msg.tableId);
      if (!o) return done(guestCarrying().length ? 'Ese pedido es para otra mesa. Seguí el marcador.' : 'Recogé primero el pedido en la bandeja de salida.');
      const why = staffDeliver(o.uid, GUEST_CLAIM);
      return done(why ? DELIVER_WHY[why] ?? 'No se pudo entregar.' : `¡Buen provecho, ${customerName(o.customer)}!`);
    }
    case 'cookTake': {
      const o = cookableOrders().find((x) => x.uid === msg.uid && x.kind !== 'drink');
      const r = o && RECIPES_BY_ID[o.recipe];
      if (!o || !r) return done('Ese pedido ya no está disponible.');
      if (!game.consumeIngredients(r.ingredients)) return done('Faltan ingredientes en la cocina de tu amigo.');
      guestCooking.add(o.uid); playerBusy.add(o.uid);
      return done('');
    }
    case 'cookCancel': {
      if (!msg.uid || !guestCooking.delete(msg.uid)) return done('');
      refund(msg.uid); playerBusy.delete(msg.uid);
      return done('');
    }
    case 'drink': {
      const o = cookableOrders().find((x) => x.uid === msg.uid && x.kind === 'drink');
      const d = o && DRINK_BY_ID[o.recipe];
      if (!o || !d || !drinksUnlocked()) return done('Ese pedido ya no está disponible.');
      if (!game.consumeIngredients(d.ingredients)) return done('Faltan ingredientes en la cocina de tu amigo.');
      if (!stagePlate(o.uid, 1)) { refund(o.uid); return done('El pedido cambió. Los ingredientes volvieron a la cocina.'); }
      game.stat('drinksPrepared'); game.stat('drink_' + d.id); game.touch('drink');
      return done(`${d.name} lista en la bandeja de salida.`);
    }
    case 'plate': {
      const uid = msg.uid ?? -1;
      const o = game.save.orders.find((x) => x.uid === uid);
      const r = o && RECIPES_BY_ID[o.recipe];
      if (!o || !r || !guestCooking.has(uid)) return done('El pedido cambió. No se pudo dejar el plato.');
      const q = msg.q === 0 || msg.q === 1 || msg.q === 2 ? msg.q : 0;
      const bonus = Math.max(0, Math.min(Number(msg.b) || 0, r.price));
      guestCooking.delete(uid); playerBusy.delete(uid);
      if (!stagePlate(uid, q, bonus, typeof msg.v === 'string' ? msg.v.slice(0, 40) : undefined)) { refund(uid); return done('El pedido cambió. Los ingredientes volvieron a la cocina.'); }
      return done(`Listo. Recogé ${r.name} en la bandeja de salida.`);
    }
    case 'tip': {
      const day = game.save.time.day;
      if (ledger.day !== day) ledger = { day, given: 0 };
      const { given, kept } = collectTipForGuest(msg.tableId ?? '', GUEST_TIP_CAP - ledger.given);
      ledger.given += given;
      if (given > 0) return done(`Recogiste ${given} de propina.${kept > 0 ? ' Llegaste al tope de hoy: el resto va para el restaurante.' : ''}`, given);
      return done(kept > 0 ? 'Hoy ya juntaste el máximo de propinas: ésta va para el restaurante.' : 'No hay propina en esta mesa.');
    }
  }
}

export function buildFloor(parties: PartySnap[]): FloorSnap {
  const t = game.save.time;
  const cookable = cookableOrders();
  const pantry: Record<string, number> = {};
  for (const o of cookable) for (const id of Object.keys((o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe]).ingredients)) pantry[id] = game.countUsable(id);
  const staff: StaffSnap[] = [];
  for (const e of employees()) {
    const r = staffRuntime.get(e.id);
    if (!r) continue;
    const carried = r.carrying != null ? game.save.orders.find((o) => o.uid === r.carrying) : undefined;
    staff.push({ id: e.id, look: e.look, x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, dir: r.dir, walk: r.act === 'walk', talk: r.act === 'work' && r.step === 'ordering', ...(carried ? { plate: { ...(carried.kind === 'drink' ? { kind: 'drink' as const } : {}), recipe: carried.recipe } } : {}) });
  }
  return {
    views: guestViews(),
    parties,
    jobs: tableJobs(),
    orders: game.save.orders.filter((o) => o.plate && o.plate.state !== 'delivered'),
    cookable, pantry, staff,
    tables: tableIds(),
    time: { day: t.day, period: t.period, minutes: Math.round(t.minutes * 10) / 10 },
  };
}
