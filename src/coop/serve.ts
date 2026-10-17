/**
 * The host's half of shared service. The guest asks (take an order, carry a plate, deliver, collect a tip); the host runs the
 * same functions the staff use and answers. Nothing here trusts the guest: every request is checked against the host's own game.
 * The only coins that ever go to the guest are tips, and only up to a daily cap.
 */
import { game } from '../core/state';
import { carryCapacity } from '../restaurant/carry';
import { GUEST_CLAIM, type FloorSnap, type PartySnap } from '../restaurant/mirror';
import { customerName } from '../restaurant/orders';
import { claimPlate, collectTipForGuest, guestViews, servingName, staffDeliver, tableIds, tableJobs, takeOrderAt } from '../restaurant/service';
import type { ActMsg, ResMsg } from './protocol';

/** Most tip coins a visiting friend can take home per game day. */
export const GUEST_TIP_CAP = 120;
let ledger = { day: -1, given: 0 };

export function resetServe() { ledger = { day: -1, given: 0 }; releaseGuestClaims(); }

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
  return {
    views: guestViews(),
    parties,
    jobs: tableJobs(),
    orders: game.save.orders.filter((o) => o.plate && o.plate.state !== 'delivered'),
    tables: tableIds(),
    time: { day: t.day, period: t.period, minutes: Math.round(t.minutes * 10) / 10 },
  };
}
