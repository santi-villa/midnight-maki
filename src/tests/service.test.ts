import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import type { FurnPiece } from '../restaurant/floor';
import { refreshOrders, serveOrder } from '../restaurant/orders';
import {
  closeServiceForNight,
  collectTipAt,
  deliverTo,
  guestViews,
  plateState,
  pumpService,
  resetService,
  serviceAudit,
  spawnGuest,
  stagePlate,
  stepService,
  tableJobs,
  takeOrderAt,
} from '../restaurant/service';

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
    expect(plateState(uid)).toBe('none');
    expect(stepService(1).paid).toEqual([]);
    expect(game.coins).toBe(138);
    expect(tableJobs()).toEqual([expect.objectContaining({ tableId: '1', status: 'tip', tip: 1 })]);
    expect(collectTipAt('1')).toMatch(/1/);
    expect(game.coins).toBe(139);
    expect(collectTipAt('1')).toMatch(/No hay/);
    expect(game.coins).toBe(139);
    expect(guestViews()).toEqual([]);
    expect(serviceAudit()).toEqual([]);
  });

  it('lets an ignored guest leave without an order or a bill', () => {
    seatOne();
    stepService(80);
    expect(guestViews()[0]?.phase).toBe('leaving');
    stepService(1);
    expect(guestViews()).toEqual([]);
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

  it('drops unfinished visits at dawn and still pays a plate that was already cooked', () => {
    game.addOrder({ recipe: 'kappa', customer: 'rigg', reward: 20, special: 'tutorial' });
    seatOne();
    takeOrderAt('1');
    const uid = game.save.orders.find((o) => !o.special)!.uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    closeServiceForNight();
    refreshOrders(true);
    expect(game.save.orders.map((o) => o.special)).toEqual(['tutorial']);
    expect(game.save.restaurant.served).toBe(1);
    expect(game.coins).toBe(139);
    expect(guestViews()).toEqual([]);
  });

  it('pays a cooked plate if the room is gone when you come back', () => {
    seatOne();
    takeOrderAt('1');
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    expect(game.save.orders[0].plate?.quality).toBe(2);
    resetService({ timing: FAST, rng: () => 0 });
    pumpService(0, room);
    expect(game.save.orders).toEqual([]);
    expect(game.save.restaurant.served).toBe(1);
    expect(game.coins).toBe(139);
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
