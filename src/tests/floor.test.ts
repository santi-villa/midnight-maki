import { describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { FURN_BY_ID } from '../data/furniture';
import {
  createService,
  layoutTables,
  partySizeFor,
  patienceFor,
  quoteBill,
  rollTip,
  type DiningFloor,
  type FurnPiece,
  type ServiceTable,
  type ServiceTiming,
} from '../restaurant/floor';

const FAST: Partial<ServiceTiming> = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };

function seats(id: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, x: i, y: 1, rot: 0 }));
}

function table(id: string, capacity: number, seatCount = capacity): ServiceTable {
  return { id, x: 0, y: 0, w: 2, h: 1, capacity, seats: seats(id, seatCount) };
}

function floor(tables: ServiceTable[], rng: () => number = () => 0): DiningFloor {
  return createService(tables, { timing: FAST, rng });
}

/** One phase per tick, so crossing the room takes several short steps. */
function steps(svc: DiningFloor, n: number) {
  for (let i = 0; i < n; i++) svc.tick(1);
}

function piece(uid: number, id: string, x: number, y: number, rot = 0): FurnPiece {
  const def = FURN_BY_ID[id];
  return { uid, id, kind: def.kind, x, y, w: def.w, h: def.h, rot, sit: def.sit };
}

describe('table layout', () => {
  it('builds the default dining room into three tables of four', () => {
    const placed: [string, number, number, number?][] = [
      ['table_dark', 8, 8], ['chair_dark', 8, 9, 2], ['chair_dark', 9, 9, 2], ['chair_dark', 8, 7, 0], ['chair_dark', 9, 7, 0],
      ['table_dark', 12, 7], ['chair_dark', 12, 8, 2], ['chair_dark', 13, 8, 2], ['chair_dark', 12, 6, 0], ['chair_dark', 13, 6, 0],
      ['table_low', 15, 10], ['cushion_indigo', 15, 9], ['cushion_rose', 16, 9], ['cushion_rose', 15, 11], ['cushion_indigo', 16, 11],
      ['bamboo_pot', 16, 6], ['andon', 11, 12],
    ];
    const tables = layoutTables(placed.map(([id, x, y, rot], i) => piece(i + 1, id, x, y, rot ?? 0)));
    expect(tables.map((t) => [t.x, t.y, t.capacity])).toEqual([[12, 7, 4], [8, 8, 4], [15, 10, 4]]);
    const north = tables[1].seats.find((s) => s.x === 8 && s.y === 7);
    expect(north?.rot).toBe(0);
    const south = tables[1].seats.find((s) => s.x === 8 && s.y === 9);
    expect(south?.rot).toBe(2);
  });

  it('ignores benches and gives a shared chair to the nearer table', () => {
    const pieces: FurnPiece[] = [
      { uid: 1, id: 'a', kind: 'table', x: 0, y: 0, w: 1, h: 1 },
      { uid: 2, id: 'b', kind: 'table', x: 1, y: 0, w: 1, h: 1 },
      { uid: 9, id: 'chair', kind: 'chair', x: 0, y: 1, w: 1, h: 1, sit: true, rot: 1 },
      { uid: 10, id: 'bench', kind: 'bench', x: 1, y: 1, w: 2, h: 1, sit: true },
    ];
    const tables = layoutTables(pieces);
    expect(tables.find((t) => t.id === '1')?.capacity).toBe(1);
    expect(tables.find((t) => t.id === '2')?.capacity).toBe(0);
    expect(tables.find((t) => t.id === '1')?.seats[0]).toMatchObject({ id: '9', rot: 1 });
  });

  it('does not treat a kotatsu as its own chair', () => {
    const tables = layoutTables([piece(1, 'kotatsu', 3, 3)]);
    expect(tables).toEqual([expect.objectContaining({ id: '1', capacity: 0 })]);
  });
});

describe('table assignment', () => {
  it('seats a couple in two chairs and keeps the rest of the table exclusive', () => {
    const svc = floor([table('t', 4)]);
    expect(partySizeFor('c_couple')).toBe(2);
    svc.arrive({ id: 'p', customerId: 'c_couple' });
    svc.tick(1);
    const party = svc.party('p');
    expect(party).toMatchObject({ phase: 'walking', size: 2, tableId: 't' });
    expect(party?.seatIds).toEqual(['t-0', 't-1']);
    svc.arrive({ id: 'q', customerId: 'c_tourist' });
    svc.tick(1);
    expect(svc.party('q')?.phase).toBe('queued');
    expect(svc.party('q')?.tableId).toBeNull();
    expect(svc.table('t')?.partyId).toBe('p');
    expect(svc.audit()).toEqual([]);
  });

  it('prefers the smallest table and does not let a large party block a solo', () => {
    const svc = floor([table('big', 4), table('small', 1)]);
    svc.arrive({ id: 'group', customerId: 'c_tourist', size: 4 });
    svc.arrive({ id: 'solo', customerId: 'c_runner' });
    svc.tick(1);
    expect(svc.party('group')).toMatchObject({ phase: 'walking', tableId: 'big' });
    expect(svc.party('solo')).toMatchObject({ phase: 'walking', tableId: 'small' });
    expect(svc.audit()).toEqual([]);
  });

  it('holds a party that fits no table, then seats them when one frees', () => {
    const svc = floor([table('a', 2), table('b', 1)]);
    svc.arrive({ id: 'trio', customerId: 'c_tourist', size: 3, patience: 100 });
    svc.tick(1);
    expect(svc.party('trio')?.phase).toBe('queued');
    expect(svc.table('a')?.status).toBe('free');

    svc.arrive({ id: 'one', customerId: 'c_kid', patience: 100 });
    svc.tick(1);
    expect(svc.party('one')?.tableId).toBe('b');
    expect(svc.party('trio')?.phase).toBe('queued');

    const wide = floor([table('wide', 4)]);
    wide.arrive({ id: 'first', customerId: 'c_writer', patience: 100 });
    steps(wide, 3);
    expect(wide.party('first')?.phase).toBe('waiting_order');
    wide.arrive({ id: 'second', customerId: 'c_student', patience: 100 });
    wide.tick(1);
    expect(wide.party('second')?.phase).toBe('queued');
    wide.deliver('first', 0);
    expect(wide.deliver('first', 0)).toBeNull();
    const ticket = wide.takeOrder('first', { recipe: 'onigiri', reward: 40 });
    expect(ticket).toMatchObject({ customer: 'c_writer', recipe: 'onigiri', reward: 40 });
    expect(wide.takeOrder('first', { recipe: 'onigiri', reward: 40 })).toBeNull();
    expect(wide.deliver('first', 0)).toMatchObject({ quality: 0 });
    wide.tick(1);
    wide.tick(1);
    expect(wide.party('first')?.phase).toBe('leaving');
    expect(wide.table('wide')?.status).toBe('cleanup');
    wide.tick(1);
    expect(wide.party('first')).toBeNull();
    expect(wide.party('second')?.phase).toBe('walking');
    expect(wide.table('wide')?.partyId).toBe('second');
    expect(wide.audit()).toEqual([]);
  });

  it('rejects a duplicate party and a second claim on the same order uid', () => {
    const svc = floor([table('t', 2)]);
    expect(svc.arrive({ id: 'p', customerId: 'c_fisher' })).not.toBeNull();
    expect(svc.arrive({ id: 'p', customerId: 'c_fisher' })).toBeNull();
    expect(svc.parties()).toHaveLength(1);
    steps(svc, 3);
    const ticket = svc.takeOrder('p', { recipe: 'sake_nigiri', reward: 80 });
    expect(ticket?.ticket).toBe(1);
    expect(svc.linkOrder('p', 0)).toBe(false);
    expect(svc.linkOrder('p', 7)).toBe(true);
    expect(svc.linkOrder('p', 7)).toBe(false);
    expect(svc.party('p')?.orderUid).toBe(7);
    expect(svc.audit()).toEqual([]);
  });

  it('caps a table at its declared capacity even if more chairs are listed', () => {
    const svc = floor([table('t', 1, 4)]);
    svc.arrive({ id: 'two', customerId: 'c_couple', patience: 30 });
    svc.tick(1);
    expect(svc.party('two')?.phase).toBe('queued');
    svc.arrive({ id: 'one', customerId: 'c_grandpa', patience: 30 });
    svc.tick(1);
    expect(svc.party('one')).toMatchObject({ phase: 'walking', size: 1, seatIds: ['t-0'] });
    expect(svc.audit()).toEqual([]);
  });
});

describe('patience', () => {
  it('sends a queued guest home without freeing a table they never had', () => {
    expect(patienceFor('c_runner')).toBeLessThan(patienceFor('c_grandpa'));
    const svc = floor([]);
    svc.arrive({ id: 'rush', customerId: 'c_runner', patience: 5 });
    svc.tick(1);
    expect(svc.party('rush')).toMatchObject({ phase: 'queued', patience: 5 });
    svc.tick(4);
    expect(svc.party('rush')?.patience).toBe(1);
    const left = svc.tick(1);
    expect(left.some((e) => e.type === 'impatient' && e.partyId === 'rush')).toBe(true);
    expect(svc.party('rush')?.phase).toBe('leaving');
    svc.tick(1);
    expect(svc.party('rush')).toBeNull();
    expect(svc.parties()).toEqual([]);
    expect(svc.audit()).toEqual([]);
  });

  it('frees the table when the order is ignored, and seats the next guest on that tick', () => {
    const svc = floor([table('t', 1)]);
    svc.arrive({ id: 'a', customerId: 'c_tourist', patience: 3 });
    steps(svc, 3);
    expect(svc.party('a')?.phase).toBe('waiting_order');
    expect(svc.party('a')?.patience).toBe(3);
    svc.arrive({ id: 'b', customerId: 'c_painter', patience: 50 });
    svc.tick(1);
    expect(svc.party('b')?.phase).toBe('queued');
    const events = svc.tick(3);
    expect(events.some((e) => e.type === 'impatient' && e.partyId === 'a')).toBe(true);
    expect(events.some((e) => e.type === 'assigned' && e.partyId === 'b')).toBe(true);
    expect(svc.party('a')).toMatchObject({ phase: 'leaving', tableId: null, bill: 0, tip: 0 });
    expect(svc.party('b')).toMatchObject({ phase: 'walking', tableId: 't' });
    expect(svc.table('t')?.partyId).toBe('b');
    expect(svc.audit()).toEqual([]);
  });

  it('stops the clock once the order is in the kitchen', () => {
    const svc = floor([table('t', 1)]);
    svc.arrive({ id: 'a', customerId: 'c_sailor', patience: 9 });
    steps(svc, 3);
    svc.takeOrder('a', { recipe: 'onigiri', reward: 20 });
    const left = svc.party('a')?.patience;
    svc.tick(40);
    expect(svc.party('a')).toMatchObject({ phase: 'waiting_food', patience: left });
    expect(svc.table('t')?.status).toBe('waiting_food');
    expect(svc.audit()).toEqual([]);
  });
});

describe('orders, payment and leaving', () => {
  it('bills a perfect dish, leaves a tip, and frees the table only after the tip is taken', () => {
    const rolls = [0, 0];
    let i = 0;
    const svc = floor([table('t', 1)], () => rolls[i++] ?? 0);
    svc.arrive({ id: 'p', customerId: 'c_grandpa', tipRate: 0.2, patience: 100 });
    expect(svc.takeOrder('p', { recipe: 'tamago', reward: 100 })).toBeNull();
    expect(svc.deliver('p', 2)).toBeNull();
    expect(svc.collectTip('t')).toEqual({ amount: 0, cleared: false });

    svc.tick(1);
    expect(svc.table('t')?.status).toBe('reserved');
    svc.tick(1);
    expect(svc.table('t')?.status).toBe('occupied');
    svc.tick(1);
    expect(svc.table('t')?.status).toBe('waiting_order');
    expect(svc.takeOrder('p', { recipe: 'tamago', reward: 100 })).toMatchObject({ ticket: 1, reward: 100 });
    expect(svc.table('t')?.status).toBe('waiting_food');
    expect(svc.deliver('p', 2, 5)).toMatchObject({ tableId: 't', quality: 2 });
    expect(svc.table('t')?.status).toBe('eating');

    svc.tick(1);
    expect(svc.party('p')?.phase).toBe('paying');
    const paid = svc.tick(1);
    expect(paid).toContainEqual({ type: 'paid', partyId: 'p', bill: quoteBill(100, 2, 0.2, 5), tip: rollTip(100, 2, 0, 0), tableId: 't' });
    expect(svc.party('p')).toMatchObject({ phase: 'leaving', bill: 150, tip: 10 });
    expect(svc.table('t')?.status).toBe('tip');

    const early = svc.collectTip('t');
    expect(early).toEqual({ amount: 10, cleared: false });
    expect(svc.table('t')?.status).toBe('cleanup');
    expect(svc.collectTip('t').amount).toBe(0);

    svc.tick(1);
    expect(svc.party('p')).toBeNull();
    expect(svc.table('t')).toMatchObject({ status: 'free', partyId: null, tip: 0 });
    expect(svc.audit()).toEqual([]);
  });

  it('keeps the tip on an empty table until it is picked up', () => {
    const svc = floor([table('t', 1)], () => 0);
    svc.arrive({ id: 'p', customerId: 'c_tourist', patience: 100 });
    steps(svc, 3);
    svc.takeOrder('p', { recipe: 'onigiri', reward: 50 });
    svc.deliver('p', 2);
    steps(svc, 3);
    expect(svc.party('p')).toBeNull();
    expect(svc.table('t')).toMatchObject({ status: 'tip', tip: 5, partyId: null });

    svc.arrive({ id: 'next', customerId: 'c_kid', patience: 20 });
    svc.tick(1);
    expect(svc.party('next')?.phase).toBe('queued');
    expect(svc.collectTip('t')).toEqual({ amount: 5, cleared: true });
    svc.tick(1);
    expect(svc.party('next')?.phase).toBe('walking');
    expect(svc.audit()).toEqual([]);
  });

  it('frees a table with no tip as soon as the guest is gone', () => {
    const svc = floor([table('t', 2)], () => 0.9);
    svc.arrive({ id: 'p', customerId: 'c_writer', patience: 100 });
    steps(svc, 3);
    svc.takeOrder('p', { recipe: 'miso', reward: 30 });
    svc.deliver('p', 0);
    steps(svc, 2);
    expect(svc.party('p')).toMatchObject({ phase: 'leaving', tip: 0, bill: quoteBill(30, 0, 0) });
    expect(svc.table('t')?.status).toBe('cleanup');
    const done = svc.tick(1);
    expect(done.some((e) => e.type === 'left' && e.reason === 'done')).toBe(true);
    expect(done.some((e) => e.type === 'cleared' && e.tableId === 't')).toBe(true);
    expect(svc.table('t')?.status).toBe('free');
    expect(svc.collectTip('t').amount).toBe(0);
    expect(svc.audit()).toEqual([]);
  });

  it('does not create a saved order or pay coins', () => {
    game.load(newSave('Floor'));
    const coins = game.coins;
    const svc = floor([table('t', 1)], () => 0);
    svc.arrive({ id: 'p', customerId: 'momo', tipRate: 0.1, patience: 100 });
    steps(svc, 3);
    svc.takeOrder('p', { recipe: 'onigiri', reward: 80 });
    svc.linkOrder('p', 4);
    svc.deliver('p', 1);
    steps(svc, 2);
    expect(svc.party('p')?.bill).toBe(quoteBill(80, 1, 0.1));
    expect(svc.party('p')?.tip).toBeGreaterThan(0);
    svc.tick(1);
    svc.collectTip('t');
    expect(game.coins).toBe(coins);
    expect(game.save.orders).toEqual([]);
    expect(game.save.restaurant.served).toBe(0);
    expect(svc.audit()).toEqual([]);
  });
});

describe('bill math', () => {
  it('matches the kitchen quality bonus and the tip odds', () => {
    expect(quoteBill(100, 0, 0)).toBe(100);
    expect(quoteBill(100, 1, 0)).toBe(110);
    expect(quoteBill(100, 2, 0.2, 5)).toBe(150);
    expect(rollTip(100, 2, 0, 0)).toBe(10);
    expect(rollTip(100, 2, 0.55, 0)).toBe(0);
    expect(rollTip(100, 1, 0.24, 1)).toBe(30);
    expect(rollTip(80, 1, 0.25, 0)).toBe(0);
    expect(rollTip(100, 0, 0, 0)).toBe(0);
  });
});
