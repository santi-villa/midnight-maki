import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { playerBusy } from '../restaurant/claims';
import { validateSave } from '../persistence/validate';
import type { FurnPiece } from '../restaurant/floor';
import { guestViews, pickupPlate, plateState, resetService, spawnGuest, stagePlate, stepService, takeOrderAt, tableJobs } from '../restaurant/service';
import {
  COOK_SECONDS, candidates, riggCapacity, upgradeRiggTray, crew, employees, hire, orderSecondsFor, payWages, resetStaffRuntime, runtime, setCrew, staffLimit, tickStaff, trainCrew, type StaffEnv,
} from '../restaurant/staff';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };
const piece = (uid: number, kind: string, x: number, y: number, sit = false): FurnPiece => ({ uid, id: kind, kind, x, y, w: kind === 'table' ? 2 : 1, h: 1, sit, rot: sit ? 2 : 0 });
const room = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true)];

const line = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] => {
  const out: [number, number][] = [];
  let x = a.x, y = a.y;
  while (x !== b.x) { x += Math.sign(b.x - x); out.push([x, y]); }
  while (y !== b.y) { y += Math.sign(b.y - y); out.push([x, y]); }
  return out;
};
/** the raccoons teleport to where they are told: movement is the town's job, not the crew's */
const pos: Record<string, { x: number; y: number }> = { rigg: { x: 2, y: 2 }, spicy: { x: 3, y: 2 } };
const env: StaffEnv = {
  home: () => ({ x: 1, y: 1 }), tray: () => ({ x: 6, y: 5 }), stove: () => ({ x: 5, y: 3 }),
  tableSpots: () => [{ x: 4, y: 3 }], path: (a, b) => line(a, b),
  crew: { where: (id) => ({ zone: 'restaurant', ...(pos[id] ?? { x: 0, y: 0 }), settled: true }), move: (id, t) => { if (t) pos[id] = { ...t }; }, working: () => true },
};

function run(seconds: number) { for (let t = 0; t < seconds; t += 0.25) tickStaff(0.25, env); }
function hireOne(role: 'waiter' | 'cook' = 'waiter') {
  game.save.restaurant.level = 4; game.save.coins = 1000;
  expect(hire(candidates(role)[0])).toBeNull();
  return employees()[employees().length - 1];
}

beforeEach(() => {
  game.load(newSave('Salon'));
  game.setFlag('intro_done');
  game.save.recipesKnown = ['kappa'];
  game.save.time.period = 1; game.save.time.minutes = 20;
  resetService({ timing: FAST, rng: () => 0 });
  resetStaffRuntime();
  pos.rigg = { x: 2, y: 2 }; pos.spicy = { x: 3, y: 2 };
});

function seatGuest() {
  spawnGuest(room, 'c_tourist');
  stepService(1); stepService(1); stepService(1);
  expect(guestViews()[0].phase).toBe('waiting_order');
}
/** a seated guest whose kappa order was taken */
function orderTaken() {
  seatGuest();
  takeOrderAt(tableJobs()[0].tableId);
  return game.save.orders.find((o) => o.kind !== 'drink')!;
}

describe('restaurant crew', () => {
  it('hires within the limit, one cook from level 4, and keeps the same candidates all day', () => {
    expect(staffLimit(2)).toBe(0);
    game.save.coins = 1000;
    expect(hire(candidates()[0])).toMatch(/no necesita/);
    hireOne('waiter');
    expect(game.coins).toBe(850);
    expect(candidates().map((c) => c.name)).toEqual(candidates().map((c) => c.name));
    hireOne('cook');
    expect(employees().map((e) => e.role)).toEqual(['waiter', 'cook']);
    expect(hire(candidates('cook')[1])).toMatch(/no necesita/);
  });

  it('a new waiter walks to the table and takes the order, slowly', () => {
    hireOne(); seatGuest();
    run(2);
    expect(runtime.get(employees()[0].id)!.claim).toEqual({ kind: 'order', tableId: tableJobs()[0].tableId });
    run(30);
    expect(game.save.orders.length).toBeGreaterThan(0);
    expect(guestViews()[0].phase).toBe('waiting_food');
    expect(orderSecondsFor(0) / orderSecondsFor(4)).toBeGreaterThan(2);
  });

  it('serves a finished dish once, and the player cannot take what is already claimed', () => {
    const e = hireOne(); seatGuest();
    takeOrderAt(tableJobs()[0].tableId);
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2)).toBe(true);
    run(1);
    expect(pickupPlate(uid)).toMatch(/personal/);
    run(40);
    expect(plateState(uid)).toBe('delivered');
    expect(runtime.get(e.id)!.claim).toBeNull();
  });

  it('a cook uses the pantry once and takes at least 45 seconds a dish at the start', () => {
    hireOne('cook'); seatGuest();
    const order = orderTaken();
    game.save.inventory = {}; game.setPantry('rice', 1); game.setPantry('nori', 1); game.setPantry('cucumber', 1);
    run(COOK_SECONDS.hired[0] - 10);
    expect(plateState(order.uid)).not.toBe('plated');
    run(30);
    expect(plateState(order.uid)).toBe('plated');
    expect(game.pantryCount('rice')).toBe(0);
  });

  it('does not cook what the player is already cooking, nor without ingredients', () => {
    hireOne('cook'); seatGuest();
    const order = orderTaken();
    game.save.inventory = {};
    run(5);
    expect(order.cook).toBeUndefined();
    game.setPantry('rice', 1); game.setPantry('nori', 1); game.setPantry('cucumber', 1);
    playerBusy.add(order.uid);
    run(5);
    expect(order.cook).toBeUndefined();
    playerBusy.delete(order.uid);
  });

  it('Spicy cooks a dish every 34 s or more at first and gets quicker with training; she only helps when asked', () => {
    seatGuest();
    const order = orderTaken();
    game.save.inventory = { rice: 1, nori: 1, cucumber: 1 };
    game.addFriendship('spicy', 300);
    run(40);
    expect(plateState(order.uid)).not.toBe('plated'); // not asked yet
    setCrew('spicy', true);
    run(30);
    expect(plateState(order.uid)).not.toBe('plated');
    run(30);
    expect(plateState(order.uid)).toBe('plated');
    game.save.coins = 5000;
    trainCrew('spicy'); trainCrew('spicy'); trainCrew('spicy'); trainCrew('spicy');
    expect(crew('spicy').level).toBe(4);
    expect(COOK_SECONDS.crew[0]).toBeGreaterThanOrEqual(30);
    expect(COOK_SECONDS.crew[0] / COOK_SECONDS.crew[4]).toBeGreaterThan(2.5);
  });

  it('Rigg takes the order at his own slow pace', () => {
    seatGuest();
    game.addFriendship('rigg', 300);
    setCrew('rigg', true);
    run(5);
    expect(game.save.orders).toHaveLength(0);
    run(15);
    expect(game.save.orders.length).toBeGreaterThan(0);
  });

  it('Rigg carries plates from the tray one at a time, and two after the tray upgrade', () => {
    const two = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true), piece(3, 'table', 9, 4), piece(4, 'chair', 9, 5, true)];
    game.save.restaurant.level = 4; game.save.restaurant.upgrades = ['tables2', 'second_room'];
    spawnGuest(two, 'c_tourist'); stepService(1);
    expect(spawnGuest(two, 'c_student')).toBeTruthy();
    for (let i = 0; i < 14; i++) stepService(1);
    const jobs = tableJobs().filter((j) => j.phase === 'waiting_order');
    expect(jobs.length).toBe(2);
    for (const j of jobs) takeOrderAt(j.tableId);
    for (const o of game.save.orders.filter((x) => x.kind !== 'drink')) stagePlate(o.uid, 1);
    game.addFriendship('rigg', 300);
    setCrew('rigg', true);
    expect(riggCapacity()).toBe(1);
    /** the most plates he holds at once during a minute of work */
    const peak = () => { let best = 0; for (let t = 0; t < 60; t += 0.25) { tickStaff(0.25, env); const r = runtime.get('rigg'); if (r) best = Math.max(best, r.queue.length + (r.carrying != null ? 1 : 0)); } return best; };
    expect(peak()).toBe(1);
    expect(game.save.orders.filter((o) => o.plate?.state === 'delivered')).toHaveLength(2);
  });

  it('Rigg with the bigger tray takes both plates in one trip', () => {
    const two = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true), piece(3, 'table', 9, 4), piece(4, 'chair', 9, 5, true)];
    game.save.restaurant.level = 4; game.save.restaurant.upgrades = ['tables2', 'second_room'];
    spawnGuest(two, 'c_tourist'); stepService(1);
    spawnGuest(two, 'c_student');
    for (let i = 0; i < 14; i++) stepService(1);
    for (const j of tableJobs().filter((x) => x.phase === 'waiting_order')) takeOrderAt(j.tableId);
    for (const o of game.save.orders.filter((x) => x.kind !== 'drink')) stagePlate(o.uid, 1);
    game.addFriendship('rigg', 300);
    setCrew('rigg', true);
    game.save.coins = 5000;
    expect(upgradeRiggTray()).toBeNull();
    expect(riggCapacity()).toBe(2);
    let best = 0;
    for (let t = 0; t < 60; t += 0.25) { tickStaff(0.25, env); const r = runtime.get('rigg'); if (r) best = Math.max(best, r.queue.length + (r.carrying != null ? 1 : 0)); }
    expect(best).toBe(2);
    expect(game.save.orders.filter((o) => o.plate?.state === 'delivered')).toHaveLength(2);
  });

  it('pays wages daily, leaves unpaid staff idle, and keeps the crew when the game is saved and loaded', () => {
    const e = hireOne();
    setCrew('spicy', true);
    game.save.coins = 10;
    const day = game.save.time.day + 1;
    expect(payWages(day).unpaid).toEqual([e.name]);
    seatGuest(); run(10);
    expect(game.save.orders).toHaveLength(0);
    game.save.coins = 500;
    expect(payWages(day + 1).paid).toBe(16);
    const back = validateSave(JSON.parse(JSON.stringify(game.save)));
    expect(back.staff?.employees[0].name).toBe(e.name);
    expect(back.staff?.crew?.spicy?.on).toBe(true);
    const older = JSON.parse(JSON.stringify(game.save)); delete older.staff;
    expect(validateSave(older).staff).toBeUndefined();
  });
});
