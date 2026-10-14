import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave } from '../persistence/validate';
import type { FurnPiece } from '../restaurant/floor';
import { refreshOrders, serveOrder } from '../restaurant/orders';
import {
  closeServiceForNight,
  collectTipAt,
  deliverTo,
  guestViews,
  pickupPlate,
  pumpService,
  resetService,
  serviceAudit,
  serviceBoardNote,
  shiftSummary,
  spawnGuest,
  stagePlate,
  stepService,
  syncRestaurantHours,
  takeOrderAt,
} from '../restaurant/service';
import { RESTAURANT_HOURS, restaurantPhase } from '../systems/schedule';
import { shopGate, stopFor, whereIs } from '../systems/npcs';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };

function piece(uid: number, kind: string, x: number, y: number, sit = false): FurnPiece {
  return { uid, id: kind, kind, x, y, w: kind === 'table' ? 2 : 1, h: 1, sit, rot: sit ? 2 : 0 };
}

const room = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true)];

function at(period: number, minutes: number, day = 4) {
  game.save.time.period = period;
  game.save.time.minutes = minutes;
  game.save.time.day = day;
}

function boot() {
  resetService({ timing: FAST, rng: () => 0 });
}

/** Sit the guest the pump just walked in. One tick only changes one phase. */
function seatArrived() {
  stepService(1);
  stepService(1);
  stepService(1);
}

beforeEach(() => {
  game.load(newSave('Horas'));
  game.setFlag('intro_done');
  game.save.recipesKnown = ['kappa'];
  game.save.quests.done = ['prologue'];
  boot();
  at(1, 20);
});

describe('restaurant hours', () => {
  it('uses the displayed 08:00–23:00 interval across all four periods', () => {
    expect(RESTAURANT_HOURS).toMatchObject({ openAt: 480, closeAt: 1380, hours: '08:00–23:00' });
    for (const [period, minutes, phase] of [[0, 0, 'closed'], [0, 29.75, 'setup'], [0, 30, 'open'], [0, 89, 'open'], [1, 0, 'open'], [2, 89, 'open'], [3, 59.5, 'open'], [3, 60, 'closing'], [3, 65, 'closed'], [3, 90, 'closed']] as const) {
      expect(restaurantPhase(period, minutes)).toBe(phase);
    }
    expect(restaurantPhase(Number.NaN, Number.NaN)).toBe('closed');
  });

  it('lets guests in only while the door is open', () => {
    const arrive = (period: number, minutes: number) => {
      delete game.save.dining;
      boot();
      at(period, minutes);
      pumpService(4, room);
      return guestViews().length;
    };
    expect(arrive(0, 29.75)).toBe(0);
    expect(arrive(0, 30)).toBe(1);
    expect(arrive(1, 0)).toBe(1);
    expect(arrive(1, 80)).toBe(1);
    expect(arrive(2, 10)).toBe(1);
    expect(arrive(2, 85)).toBe(1);
    expect(arrive(3, 10)).toBe(1);
    expect(arrive(3, 59.5)).toBe(1);
    expect(arrive(3, 60)).toBe(0);
    expect(arrive(3, 90)).toBe(0);
  });

  it('does not keep spawning after the night clock freezes', () => {
    at(3, 90);
    for (let i = 0; i < 8; i++) pumpService(30, room);
    expect(guestViews()).toEqual([]);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(shiftSummary()).toBeNull();
  });

  it('sends guests who have not ordered home at closing, without a bill', () => {
    pumpService(0, room);
    expect(spawnGuest(room, 'c_tourist')).toBeTruthy();
    seatArrived();
    expect(guestViews()[0]?.phase).toBe('waiting_order');
    at(3, 60);
    expect(pumpService(1, room).notice).toMatch(/cierra/);
    expect(guestViews()).toEqual([]);
    expect(game.save.orders).toEqual([]);
    expect(game.coins).toBe(120);
    expect(game.save.restaurant.served).toBe(0);
    expect(shiftSummary()).toMatchObject({ arrived: 1, served: 0, pending: 0, day: 4 });
    expect(syncRestaurantHours(true)).toBeNull();
    expect(serviceAudit()).toEqual([]);
  });

  it('lets a taken order finish after the door closes and keeps the tally', () => {
    pumpService(0, room);
    spawnGuest(room, 'c_tourist');
    seatArrived();
    expect(takeOrderAt('1')).toMatch(/Kappa/);
    at(3, 60);
    expect(pumpService(3, room).notice).toMatch(/pedidos ya tomados/);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    expect(deliverTo('1')).toMatch(/bandeja/);
    pickupPlate(uid);
    expect(deliverTo('1')).toMatch(/provecho/);
    expect(stepService(1).paid).toEqual([]);
    expect(stepService(1).paid).toHaveLength(1);
    expect(collectTipAt('1')).toMatch(/1/);
    expect(game.coins).toBe(139);
    expect(game.save.restaurant.served).toBe(1);
    expect(shiftSummary()).toMatchObject({ arrived: 1, served: 1, coins: 18, tips: 1, pending: 0 });
    expect(serviceBoardNote().status).toMatch(/Cerrando/);
    expect(serviceBoardNote().summary.join(' ')).toMatch(/1 pedido/);
    at(3, 90);
    pumpService(40, room);
    expect(game.save.restaurant.served).toBe(1);
    expect(guestViews()).toEqual([]);
    expect(serviceAudit()).toEqual([]);
  });

  it('plays a full day and still allows skipping the next one', () => {
    at(0, 15, 2);
    expect(pumpService(8, room).notice).toBeNull();
    expect(guestViews()).toEqual([]);
    expect(serviceBoardNote().status).toMatch(/Cerrado/);

    at(1, 0, 2);
    expect(pumpService(4, room).notice).toBeNull();
    expect(guestViews()).toHaveLength(1);
    seatArrived();
    expect(guestViews()[0]?.phase).toBe('waiting_order');

    at(2, 40, 2);
    expect(pumpService(1, room).notice).toBeNull();
    expect(guestViews()).toHaveLength(1);
    expect(whereIs('rigg')).toBe('restaurant');

    at(3, 20, 2);
    expect(restaurantPhase(3, 20)).toBe('open');
    expect(whereIs('spicy')).toBe('restaurant');
    takeOrderAt('1');
    expect(game.save.orders).toHaveLength(1);

    at(3, 60, 2);
    expect(pumpService(1, room).notice).toMatch(/cierra/);
    expect(guestViews()[0]?.phase).toBe('waiting_food');

    at(3, 90, 2);
    pumpService(25, room);
    expect(game.save.orders).toHaveLength(1);
    expect(guestViews()).toHaveLength(1);

    game.save.time.day = 3;
    game.save.time.period = 0;
    game.save.time.minutes = 0;
    closeServiceForNight();
    refreshOrders(true);
    expect(game.save.orders).toHaveLength(1);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    expect(serviceBoardNote().status).toMatch(/Cerrado/);

    at(1, 30, 3);
    expect(syncRestaurantHours(false)).toBeNull();
    pumpService(0, room);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
  });

  it('does not punish a day spent entirely away from the restaurant', () => {
    at(0, 10);
    expect(syncRestaurantHours(false)).toBeNull();
    at(1, 30);
    expect(syncRestaurantHours(false)).toBeNull();
    at(2, 40);
    expect(syncRestaurantHours(false)).toBeNull();
    at(3, 80);
    expect(syncRestaurantHours(false)).toBeNull();
    expect(shiftSummary()).toBeNull();
    const saved = JSON.parse(JSON.stringify(game.save));
    expect(validateSave(saved).coins).toBe(120);
    game.save.time.day += 1;
    game.save.time.period = 0;
    game.save.time.minutes = 0;
    closeServiceForNight();
    refreshOrders(true);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(guestViews()).toEqual([]);
    expect(shiftSummary()).toBeNull();
  });

  it('keeps the dusk prologue in the restaurant and off the guest list', () => {
    game.load(newSave('Prologo'));
    game.save.recipesKnown = ['kappa'];
    game.save.time = { day: 1, period: 2, minutes: 0 };
    boot();
    expect(restaurantPhase(2, 0)).toBe('open');
    expect(whereIs('spicy')).toBe('restaurant');
    expect(whereIs('pip')).toBe('restaurant');
    expect(whereIs('rigg')).toBe('restaurant');
    pumpService(30, room);
    expect(guestViews()).toEqual([]);
    game.addOrder({ recipe: 'kappa', customer: 'rigg', reward: 20, special: 'tutorial' });
    const uid = game.save.orders[0].uid;
    expect(serveOrder(uid, 2, 0, { rng: () => 0.99 })?.coins).toBeGreaterThan(0);
    expect(game.save.restaurant.served).toBe(1);
    expect(shiftSummary()).toBeNull();
    expect(serviceBoardNote().status).toMatch(/Todavía no abrís/);
  });

  it('keeps plated and uncooked table orders overnight without charging them', () => {
    pumpService(0, room);
    spawnGuest(room, 'c_tourist');
    seatArrived();
    takeOrderAt('1');
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2, 0)).toBe(true);
    const saved = JSON.parse(JSON.stringify(game.save));
    expect(validateSave(saved).orders[0].plate?.quality).toBe(2);
    game.save.time.day += 1;
    game.save.time.period = 0;
    game.save.time.minutes = 0;
    closeServiceForNight();
    refreshOrders(true);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    expect(game.save.orders.map((o) => o.uid)).toEqual([uid]);
    expect(game.save.orders[0].plate?.quality).toBe(2);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    closeServiceForNight();
    expect(game.coins).toBe(120);
    expect(game.save.restaurant.served).toBe(0);
    expect(shiftSummary()).toMatchObject({ day: 4, served: 0, coins: 0, tips: 0, pending: 1 });

    delete game.save.dining;
    game.save.orders = [];
    boot();
    at(1, 20, 6);
    pumpService(0, room);
    spawnGuest(room, 'c_tourist');
    seatArrived();
    takeOrderAt('1');
    expect(game.save.orders).toHaveLength(1);
    expect(game.save.orders[0].plate).toBeUndefined();
    game.save.time.day += 1;
    closeServiceForNight();
    refreshOrders(true);
    expect(game.save.orders).toHaveLength(1);
    expect(game.save.orders[0].service).toBeTruthy();
    expect(game.coins).toBe(120);
    expect(game.save.restaurant.served).toBe(0);
  });

  it('saves and reloads a live plate without a second bill or a new guest', () => {
    pumpService(0, room);
    spawnGuest(room, 'c_tourist');
    seatArrived();
    takeOrderAt('1');
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 2, 0);
    at(3, 70);
    expect(syncRestaurantHours(false)).toMatch(/pedidos ya tomados/);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    expect(serviceAudit()).toEqual([]);
    const saved = JSON.parse(JSON.stringify(game.save));
    expect(validateSave(saved).orders).toHaveLength(1);
    boot();
    at(3, 80);
    pumpService(10, room);
    expect(guestViews()[0]?.phase).toBe('waiting_food');
    expect(game.save.orders).toHaveLength(1);
    expect(game.save.orders[0].plate?.quality).toBe(2);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    pumpService(10, room);
    expect(game.save.restaurant.served).toBe(0);
    expect(game.coins).toBe(120);
    expect(guestViews()).toHaveLength(1);
    expect(serviceAudit()).toEqual([]);
  });

  it('keeps Pip hosting until closing, then sends him home without changing other shifts', () => {
    at(0, 20);
    expect(restaurantPhase(0, 20)).toBe('closed');
    expect(whereIs('spicy')).toBe('restaurant');
    expect(whereIs('pip')).toBe('plaza');
    at(1, 30);
    expect(restaurantPhase(1, 30)).toBe('open');
    expect(whereIs('pip')).toBe('restaurant');
    at(3, 15);
    expect(restaurantPhase(3, 15)).toBe('open');
    expect(whereIs('pip')).toBe('restaurant');
    expect(whereIs('spicy')).toBe('restaurant');
    expect(whereIs('rigg')).toBe('restaurant');
    at(3, 70);
    expect(whereIs('pip')).toBe('home');
    expect(whereIs('spicy')).toBe('home');
    expect(whereIs('rigg')).toBe('restaurant'); // stays to clean for a while
    expect(stopFor('rigg', 3)).toMatchObject({ zone: 'restaurant', act: 'clean' });
    at(3, 85);
    expect(whereIs('rigg')).toBe('home');
    expect(stopFor('rigg', 3)).toMatchObject({ act: 'sleep' });
    at(3, 70);
    expect(restaurantPhase(3, 70)).toBe('closed');
    expect(shopGate('taro').open).toBe(false);
    expect(shopGate('midnight').tracked).toBe(false);
    expect(serviceBoardNote().status).toMatch(/Cerrado/);
  });
});
