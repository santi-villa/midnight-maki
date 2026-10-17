import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { GUEST_TIP_CAP, buildFloor, releaseGuestClaims, resetServe, runAct } from '../coop/serve';
import { isMsg } from '../coop/protocol';
import type { FurnPiece } from '../restaurant/floor';
import { mirror, normalizeFloor } from '../restaurant/mirror';
import { carriedOrders, collectTipAt, collectTipForGuest, deliverTo, guestViews, pickupPlate, resetService, spawnGuest, stagePlate, stepService, tableJobs, tableLabel, trayOrders } from '../restaurant/service';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };
const piece = (uid: number, kind: string, x: number, y: number, sit = false): FurnPiece => ({ uid, id: kind, kind, x, y, w: kind === 'table' ? 2 : 1, h: 1, sit, rot: sit ? 2 : 0 });
const room = [piece(1, 'table', 4, 4), piece(2, 'chair', 4, 5, true)];
let id = 0;
const act = (a: Parameters<typeof runAct>[0]['a'], arg: { tableId?: string; uid?: number } = {}) => runAct({ t: 'act', id: ++id, a, ...arg });

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
