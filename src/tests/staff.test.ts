import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave } from '../persistence/validate';
import type { FurnPiece } from '../restaurant/floor';
import { guestViews, pickupPlate, plateState, resetService, spawnGuest, stagePlate, stepService, takeOrderAt, tableJobs } from '../restaurant/service';
import { candidates, employees, hire, payWages, resetStaffRuntime, runtime, staffLimit, tickStaff, train, workSeconds, type StaffEnv } from '../restaurant/staff';

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
const env: StaffEnv = { home: () => ({ x: 1, y: 1 }), tray: () => ({ x: 6, y: 5 }), tableSpots: () => [{ x: 4, y: 3 }], path: (a, b) => line(a, b) };

function run(seconds: number) { for (let t = 0; t < seconds; t += 0.25) tickStaff(0.25, env); }
function hireOne() {
  game.save.restaurant.level = 3; game.save.coins = 1000;
  expect(hire(candidates()[0])).toBeNull();
  return employees()[0];
}

beforeEach(() => {
  game.load(newSave('Salon'));
  game.setFlag('intro_done');
  game.save.recipesKnown = ['kappa'];
  game.save.time.period = 1; game.save.time.minutes = 20;
  resetService({ timing: FAST, rng: () => 0 });
  resetStaffRuntime();
});

function seatGuest() {
  spawnGuest(room, 'c_tourist');
  stepService(1); stepService(1); stepService(1);
  expect(guestViews()[0].phase).toBe('waiting_order');
}

describe('restaurant staff', () => {
  it('hires within the level limit and keeps the same candidates all day', () => {
    expect(staffLimit(2)).toBe(0);
    game.save.coins = 1000;
    expect(hire(candidates()[0])).toMatch(/no necesita/);
    const e = hireOne();
    expect(game.coins).toBe(1000 - 150);
    expect(candidates().map((c) => c.name)).toEqual(candidates().map((c) => c.name));
    expect(e.level).toBe(0);
    game.save.restaurant.level = 3;
    expect(hire(candidates()[1])).toMatch(/no necesita/);
  });

  it('walks to the table, takes the order and goes back, much slower than the player at first', () => {
    hireOne(); seatGuest();
    run(2);
    expect(runtime.get(employees()[0].id)!.claim).toEqual({ kind: 'order', tableId: tableJobs()[0].tableId });
    run(30);
    expect(game.save.orders.length).toBeGreaterThan(0);
    expect(guestViews()[0].phase).toBe('waiting_food');
    expect(runtime.get(employees()[0].id)!.act).toBe('idle');
    const e = employees()[0];
    const slow = workSeconds(e, 3.5);
    train(e.id); train(e.id); train(e.id); train(e.id);
    expect(slow / workSeconds(e, 3.5)).toBeGreaterThan(2);
  });

  it('serves a finished dish once, and the player cannot take what is already claimed', () => {
    const e = hireOne(); seatGuest();
    takeOrderAt(tableJobs()[0].tableId);
    const uid = game.save.orders[0].uid;
    expect(stagePlate(uid, 2)).toBe(true);
    run(1);
    expect(pickupPlate(uid)).toMatch(/personal/);
    run(40);
    expect(game.save.orders[0].plate?.state).toBe('delivered');
    expect(plateState(uid)).toBe('delivered');
    expect(runtime.get(e.id)!.claim).toBeNull();
  });

  it('pays wages daily, leaves unpaid staff idle, and keeps the staff when the game is saved and loaded', () => {
    const e = hireOne();
    game.save.coins = 10;
    const day = game.save.time.day + 1;
    expect(payWages(day).unpaid).toEqual([e.name]);
    seatGuest(); run(10);
    expect(game.save.orders).toHaveLength(0);
    game.save.coins = 500;
    expect(payWages(day + 1).paid).toBe(16);
    game.save.orders = [];
    const back = validateSave(JSON.parse(JSON.stringify(game.save)));
    expect(back.staff?.employees[0].name).toBe(e.name);
    const older = JSON.parse(JSON.stringify(game.save)); delete older.staff;
    expect(validateSave(older).staff).toBeUndefined();
  });
});
