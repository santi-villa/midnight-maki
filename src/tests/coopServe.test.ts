import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { GUEST_TIP_CAP, buildFloor, dropGuestCooking, releaseGuestClaims, resetServe, runAct } from '../coop/serve';
import { playerBusy } from '../restaurant/claims';
import { candidates, hire, resetStaffRuntime, tickStaff, type StaffEnv } from '../restaurant/staff';
import { isMsg } from '../coop/protocol';
import type { FurnPiece } from '../restaurant/floor';
import { mirror, normalizeFloor } from '../restaurant/mirror';
import { carriedOrders, collectTipAt, collectTipForGuest, deliverTo, guestViews, pickupPlate, resetService, spawnGuest, stagePlate, stepService, tableJobs, tableLabel, trayOrders } from '../restaurant/service';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };
const piece = (uid: number, kind: string, x: number, y: number, sit = false): FurnPiece => ({ uid, id: kind, kind, x, y, w: kind === 'table' ? 2 : 1, h: 1, sit, rot: sit ? 2 : 0 });
const room = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true)];
let id = 0;
const act = (a: Parameters<typeof runAct>[0]['a'], arg: Omit<Parameters<typeof runAct>[0], 't' | 'id' | 'a'> = {}) => runAct({ t: 'act', id: ++id, a, ...arg });

beforeEach(() => {
  game.load(newSave('Salon'));
  game.setFlag('intro_done');
  game.save.recipesKnown = ['kappa'];
  game.save.time.period = 1; game.save.time.minutes = 20;
  resetService({ timing: FAST, rng: () => 0 });
  resetServe(); mirror.stop();
  spawnGuest(room, 'c_tourist');
  stepService(1); stepService(1); stepService(1);
});

describe('shared service: the host carries out what the guest asks', () => {
  it('takes an order, lets the guest carry the plate, deliver it and collect the tip', () => {
    expect(act('take', { tableId: '1' }).text).toMatch(/Kappa maki/);
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 2);
    expect(act('claim', { uid }).text).toMatch(/Llevás/);
    // the host cannot grab a plate the guest carries
    expect(pickupPlate(uid)).toMatch(/personal/);
    expect(act('deliver', { tableId: '1' }).text).toMatch(/provecho/);
    stepService(1); stepService(1);
    expect(tableJobs()[0]).toMatchObject({ status: 'tip', tip: 1 });
    const before = game.coins;
    const tip = act('tip', { tableId: '1' });
    expect(tip.coins).toBe(1);
    expect(game.coins).toBe(before); // the host did not get it
    expect(act('tip', { tableId: '1' }).text).toMatch(/No hay/);
  });

  it('refuses requests that do not fit', () => {
    expect(act('claim', { uid: 999 }).text).toMatch(/ya no está/);
    expect(act('deliver', { tableId: '1' }).text).toMatch(/Recogé primero/);
    expect(act('release', { uid: 5 }).text).toMatch(/No llevás/);
    expect(act('take', { tableId: 'nope' }).text).toMatch(/nadie esperando/);
  });

  it('gives back plates the guest was carrying when they leave', () => {
    act('take', { tableId: '1' });
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 1);
    act('claim', { uid });
    expect(game.save.orders[0].plate?.claim).toBe('guest');
    releaseGuestClaims();
    expect(game.save.orders[0].plate?.claim).toBeUndefined();
    expect(pickupPlate(uid)).toMatch(/Llevás/);
  });

  it('keeps the tip for the host once the guest has reached the daily cap', () => {
    expect(GUEST_TIP_CAP).toBeGreaterThan(0);
    act('take', { tableId: '1' });
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 2); act('claim', { uid }); act('deliver', { tableId: '1' });
    stepService(1); stepService(1);
    const before = game.coins;
    expect(collectTipForGuest('1', 0)).toEqual({ given: 0, kept: 1 });
    expect(game.coins).toBe(before + 1);
  });
});

describe('shared kitchen: the guest cooks with the host ingredients', () => {
  const ordered = () => { act('take', { tableId: '1' }); return game.save.orders[0].uid; };
  const stock = () => { game.save.inventory = { rice: 3, nori: 3, cucumber: 3, salmon: 3 }; };

  it('lists what can be cooked and what the host has for it', () => {
    stock(); const uid = ordered();
    const snap = buildFloor([]);
    expect(snap.cookable.map((o) => o.uid)).toEqual([uid]);
    expect(snap.pantry.rice).toBe(3);
    game.setFlag('weather', 'rain');
    expect(normalizeFloor(buildFloor([]))?.weather).toBe('rain');
    expect(normalizeFloor({})?.weather).toBeUndefined();
    expect(normalizeFloor({ weather: 'invalid' })?.weather).toBeUndefined();
  });

  it('spends the ingredients when the guest starts and puts the finished plate on the host tray', () => {
    stock(); const uid = ordered();
    expect(act('cookTake', { uid }).text).toBe('');
    expect(game.count('rice')).toBe(2);
    expect(playerBusy.has(uid)).toBe(true);
    // nobody else can start the same order, and the guest cannot start it twice
    expect(buildFloor([]).cookable).toEqual([]);
    expect(act('cookTake', { uid }).text).toMatch(/ya no está/);
    expect(act('plate', { uid, q: 2, b: 5000, v: 'con sésamo' }).text).toMatch(/Listo/);
    expect(game.save.orders[0].plate).toMatchObject({ quality: 2, variant: 'con sésamo' });
    // the bonus is capped to the price of the dish
    expect(game.save.orders[0].plate!.variantBonus).toBeLessThanOrEqual(30);
    expect(playerBusy.has(uid)).toBe(false);
    expect(trayOrders()).toHaveLength(1);
  });

  it('refuses a plate that was never started, and a start without ingredients', () => {
    const uid = ordered();
    game.save.inventory = {};
    expect(act('cookTake', { uid }).text).toMatch(/Faltan ingredientes/);
    expect(act('plate', { uid, q: 2 }).text).toMatch(/cambió/);
    expect(game.save.orders[0].plate).toBeUndefined();
  });

  it('gives the ingredients back when the guest drops the dish or leaves', () => {
    stock(); const uid = ordered();
    act('cookTake', { uid });
    act('cookCancel', { uid });
    expect(game.count('rice')).toBe(3);
    expect(playerBusy.has(uid)).toBe(false);
    act('cookTake', { uid });
    expect(game.count('rice')).toBe(2);
    dropGuestCooking();
    expect(game.count('rice')).toBe(3);
    expect(playerBusy.has(uid)).toBe(false);
  });
});

describe('shared drinks, staff and bubbles', () => {
  it('lets the guest make a drink from the host ingredients', () => {
    game.save.restaurant.level = 2; game.save.inventory = { tea_leaves: 2 };
    act('take', { tableId: '1' });
    const drink = game.save.orders.find((o) => o.kind === 'drink')!;
    expect(drink).toBeTruthy();
    expect(buildFloor([]).cookable.some((o) => o.uid === drink.uid)).toBe(true);
    expect(buildFloor([]).pantry.tea_leaves).toBe(2);
    expect(act('cookTake', { uid: drink.uid }).text).toMatch(/ya no está/); // a drink is not a dish
    expect(act('drink', { uid: drink.uid }).text).toMatch(/lista en la bandeja/);
    expect(game.count('tea_leaves')).toBe(1);
    expect(drink.plate?.quality).toBe(1);
    expect(act('drink', { uid: drink.uid }).text).toMatch(/ya no está/);
  });

  it('refuses a drink without ingredients and reports staff in the snapshot', () => {
    game.save.restaurant.level = 2; game.save.inventory = {};
    act('take', { tableId: '1' });
    const drink = game.save.orders.find((o) => o.kind === 'drink')!;
    expect(act('drink', { uid: drink.uid }).text).toMatch(/Faltan ingredientes/);
    expect(buildFloor([]).staff).toEqual([]);
  });

  it('shows the hired staff where the host sees them', () => {
    game.save.restaurant.level = 4; game.save.coins = 1000;
    expect(hire(candidates('waiter')[0])).toBeNull();
    resetStaffRuntime();
    const env: StaffEnv = {
      home: () => ({ x: 1, y: 1 }), tray: () => ({ x: 6, y: 5 }), stove: () => ({ x: 5, y: 3 }), pantry: () => ({ x: 2, y: 3 }),
      tableSpots: () => [{ x: 4, y: 3 }], path: () => [],
      crew: { where: () => null, move: () => undefined, working: () => true },
    };
    tickStaff(0.25, env);
    const staff = buildFloor([]).staff;
    expect(staff).toHaveLength(1);
    expect(staff[0]).toMatchObject({ walk: expect.any(Boolean), dir: expect.any(String) });
    expect(staff[0].look).toBeTruthy();
    // survives the wire
    expect(normalizeFloor(JSON.parse(JSON.stringify(buildFloor([]))))!.staff).toHaveLength(1);
  });

  it('accepts only well-formed lines for customers', () => {
    expect(isMsg({ t: 'say', who: 'guest:v1:0', text: 'Hola', s: 4 })).toBe(true);
    expect(isMsg({ t: 'say', who: 'guest:v1:0', text: '', s: 1, c: 12 })).toBe(true);
    expect(isMsg({ t: 'say', who: 'pip', text: 'Hola', s: 4 })).toBe(false);
    expect(isMsg({ t: 'say', who: 'guest:v1:0', text: 'x'.repeat(300), s: 4 })).toBe(false);
  });
});

describe('the guest sees the result of a request at once', () => {
  it('predicts take, claim, deliver and tip until the host confirms', () => {
    act('take', { tableId: '1' });
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 2);
    const wire = normalizeFloor(JSON.parse(JSON.stringify(buildFloor([]))))!;
    mirror.start(); mirror.apply(wire);
    mirror.predict('claim', { uid });
    expect(carriedOrders()).toHaveLength(1);
    mirror.predict('deliver', { tableId: '1' });
    expect(carriedOrders()).toHaveLength(0);
    expect(tableJobs()[0].plated).toBe(false);
    mirror.predict('take', { tableId: '1' });
    expect(tableJobs()[0].phase).toBe('waiting_food');
    mirror.stop();
  });
});

describe('the guest copy of the dining room', () => {
  it('describes the host room and answers from it while mirroring', () => {
    act('take', { tableId: '1' });
    const uid = game.save.orders[0].uid;
    stagePlate(uid, 2);
    const snap = buildFloor([{ id: 'g1', customer: 'c_tourist', customers: ['c_tourist'], trips: [{ z: 'restaurant', x: 4, y: 5, m: false, d: 'up' }] }]);
    const wire = normalizeFloor(JSON.parse(JSON.stringify(snap)))!;
    expect(wire.tables).toEqual(['1']);
    expect(wire.orders).toHaveLength(1);
    // same game, as the guest: its own service is untouched, the mirror answers
    mirror.start(); mirror.apply(wire);
    expect(guestViews()).toHaveLength(1);
    expect(tableJobs()[0]).toMatchObject({ tableId: '1', plated: true });
    expect(trayOrders()).toHaveLength(1);
    expect(tableLabel('1')).toBe('Mesa 1');
    const asked: string[] = [];
    mirror.ask = (a, arg) => { asked.push(`${a}:${arg.tableId ?? arg.uid}`); };
    expect(pickupPlate(uid)).toBe('');
    expect(deliverTo('1')).toBe('');
    expect(collectTipAt('1')).toBe('');
    expect(asked).toEqual([`claim:${uid}`, 'deliver:1', 'tip:1']);
    // once the host marks the plate as the guest's, it is "carried"
    wire.orders[0].plate!.claim = 'guest';
    mirror.apply(wire);
    expect(carriedOrders()).toHaveLength(1);
    expect(trayOrders()).toHaveLength(0);
    mirror.stop(); mirror.ask = null;
  });

  it('repairs a snapshot that lost its empty parts on the wire', () => {
    const s = normalizeFloor({ views: undefined, jobs: { 0: { tableId: '1' } } })!;
    expect(s.views).toEqual([]);
    expect(s.jobs).toHaveLength(1);
    expect(s.orders).toEqual([]);
    expect(normalizeFloor(null)).toBeNull();
  });

  it('only accepts well-formed requests', () => {
    expect(isMsg({ t: 'act', id: 1, a: 'take', tableId: '1' })).toBe(true);
    expect(isMsg({ t: 'act', id: 1, a: 'steal' })).toBe(false);
    expect(isMsg({ t: 'act', id: 'x', a: 'tip' })).toBe(false);
    expect(isMsg({ t: 'res', id: 2, text: 'ok', coins: 3 })).toBe(true);
    expect(isMsg({ t: 'res', id: 2 })).toBe(false);
  });
});
