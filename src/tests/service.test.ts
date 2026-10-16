import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import type { FurnPiece } from '../restaurant/floor';
import { refreshOrders, serveOrder } from '../restaurant/orders';
import {
  closeServiceForNight,
  collectTipAt,
  deliverTo,
  guestViews,
  pickupPlate,
  plateState,
  pumpService,
  resetService,
  serviceAudit,
  spawnGuest,
  stagePlate,
  stepService,
  tableJobs,
  takeOrderAt,
  serviceGuide,
} from '../restaurant/service';
import { questTarget } from '../world/guide';
import { defineQuests } from '../quests/quests';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };

function piece(uid: number, kind: string, x: number, y: number, sit = false): FurnPiece {
  return { uid, id: kind, kind, x, y, w: kind === 'table' ? 2 : 1, h: 1, sit, rot: sit ? 2 : 0 };
}

const room = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true)];

beforeEach(() => {
  game.load(newSave('Salon'));
  game.setFlag('intro_done');
  game.save.recipesKnown = ['kappa'];
  game.save.time.period = 1;
  game.save.time.minutes = 20;
  resetService({ timing: FAST, rng: () => 0 });
});

function seatOne() {
  const id = spawnGuest(room, 'c_tourist');
  expect(id).toBeTruthy();
  expect(guestViews()[0]?.phase).toBe('outside');
  stepService(1);
  stepService(1);
  stepService(1);
  expect(guestViews()[0]?.phase).toBe('waiting_order');
  return id!;
}

describe('dining service', () => {
  it('takes the order at the table and does not pay yet', () => {
    seatOne();
    expect(game.save.orders).toEqual([]);
    expect(takeOrderAt('1')).toMatch(/Kappa maki/);
    expect(game.save.orders).toEqual([expect.objectContaining({ customer: 'c_tourist', recipe: 'kappa', reward: 14 })]);
    expect(game.coins).toBe(120);
    expect(game.save.restaurant.served).toBe(0);
    expect(plateState(game.save.orders[0].uid)).toBe('cooking');
    expect(tableJobs()[0]).toMatchObject({ tableId: '1', phase: 'waiting_food', plated: false });
    stepService(40);
    expect(guestViews()).toHaveLength(1);
    expect(game.coins).toBe(120);
    expect(serviceAudit()).toEqual([]);
  });

  it('pays the meal once when they finish eating and leaves the tip on the table', () => {
    seatOne();
    takeOrderAt('1');
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2, 0, 'con sésamo')).toBe(true);
    expect(plateState(uid)).toBe('plated');
    expect(deliverTo('1')).toMatch(/bandeja/);
    expect(pickupPlate(uid)).toMatch(/Llevás/);
    expect(plateState(uid)).toBe('carried');
    expect(deliverTo('1')).toMatch(/provecho/);
    expect(stepService(1).paid).toEqual([]);
    const paid = stepService(1).paid;
    expect(paid).toHaveLength(1);
    expect(paid[0].result.coins).toBe(18);
    expect(paid[0].result.tip).toBe(1);
    expect(paid[0].variant).toBe('con sésamo');
    expect(game.coins).toBe(138);
    expect(game.save.orders).toEqual([]);
    expect(game.save.restaurant.served).toBe(1);
    expect(stepService(1).paid).toEqual([]);
    expect(game.coins).toBe(138);
    expect(tableJobs()).toEqual([expect.objectContaining({ tableId: '1', status: 'tip', tip: 1 })]);
    expect(collectTipAt('1')).toMatch(/1/);
    expect(game.coins).toBe(139);
    expect(collectTipAt('1')).toMatch(/No hay/);
    expect(game.coins).toBe(139);
    expect(guestViews()).toEqual([]);
    expect(plateState(uid)).toBe('none');
    expect(serviceAudit()).toEqual([]);
  });

  it('keeps an ignored guest seated without an order or a bill', () => {
    seatOne();
    stepService(80);
    expect(guestViews()[0]).toMatchObject({ phase: 'waiting_order', impatient: true, patience: 0 });
    expect(game.save.orders).toEqual([]);
    expect(game.coins).toBe(120);
    expect(game.save.restaurant.served).toBe(0);
    expect(serviceAudit()).toEqual([]);
  });

  it('keeps a second group waiting and refuses a third at the door', () => {
    spawnGuest(room, 'c_tourist');
    stepService(1);
    expect(spawnGuest(room, 'c_student')).toBeTruthy();
    expect(spawnGuest(room, 'c_kid')).toBeNull();
    expect(serviceAudit()).toEqual([]);
  });

  it('keeps a plated table order overnight and does not charge it by surprise', () => {
    game.addOrder({ recipe: 'kappa', customer: 'rigg', reward: 20, special: 'tutorial' });
    seatOne();
    takeOrderAt('1');
    const uid = game.save.orders.find((o) => !o.special)!.uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    closeServiceForNight();
    refreshOrders(true);
    expect(game.save.orders.map((o) => o.special)).toEqual(['tutorial', undefined]);
    expect(game.save.orders.find((o) => o.uid === uid)?.plate?.quality).toBe(2);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
  });

  it('keeps a cooked plate when the room is rebuilt', () => {
    seatOne();
    takeOrderAt('1');
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    expect(game.save.orders[0].plate?.quality).toBe(2);
    resetService({ timing: FAST, rng: () => 0 });
    pumpService(0, room);
    expect(game.save.orders.map((o) => o.uid)).toEqual([uid]);
    expect(game.save.orders[0].plate?.quality).toBe(2);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
  });

  it('walks a guest in on the service timer', () => {
    expect(guestViews()).toEqual([]);
    pumpService(4, room);
    expect(guestViews().length).toBe(1);
    expect(serviceAudit()).toEqual([]);
  });

  it('still pays a counter order immediately, tip included', () => {
    game.addOrder({ recipe: 'kappa', customer: 'rigg', reward: 20, special: 'tutorial' });
    const uid = game.save.orders[0].uid;
    const out = serveOrder(uid, 2, 0, { rng: () => 0.99 });
    expect(out?.tip).toBe(0);
    expect(out?.coins).toBe(25);
    expect(game.coins).toBe(145);
    expect(game.save.restaurant.served).toBe(1);
    expect(stagePlate(uid, 2, 0)).toBe(false);
  });
});

describe('serve-orders arrow', () => {
  it('stays off until a guest is seated and ready, then points at their table, then at the counter', () => {
    expect(serviceGuide()).toBeNull();
    seatOne();
    expect(serviceGuide()).toEqual({ tableId: '1' });
    takeOrderAt('1');
    expect(serviceGuide()).toBe('counter');
  });
  it('shows nothing before the restaurant opens even with an order waiting', () => {
    seatOne(); takeOrderAt('1');
    game.save.time.period = 0; game.save.time.minutes = 5; // early morning, doors still closed
    expect(serviceGuide()).toBeNull();
  });
  it('the quest step follows it', () => {
    defineQuests([{ id: 't_serve', kind: 'main', title: 't', desc: 't', steps: [{ text: 'Serví pedidos', done: () => false, target: { kind: 'object', zone: 'restaurant', x: 7, y: 5, service: true } }] }]);
    game.save.quests.tracked = 't_serve';
    game.save.quests.active.t_serve = { step: 0, progress: {} };
    expect(questTarget()).toBeNull(); // closed and empty: no arrow
    seatOne();
    expect(questTarget()).toEqual({ zone: 'restaurant', tableId: '1' });
  });
});
