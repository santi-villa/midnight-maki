import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import {
  createService,
  layoutTables,
  tipPending,
  type FurnPiece,
  type ServiceTable,
} from '../restaurant/floor';
import { seatDrawOffset, seatsApproachable, standApart } from '../restaurant/seating';
import { planWaitSpots, queueHasRoom, RECEPTION_SPOTS, scanWaitSpots, WAITING_SPOTS } from '../restaurant/waiting';
import { ensureDefaultDecor, placementBlock } from '../world/zoneRuntime';
import { Grid } from '../world/grid';

const FAST = { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 };

function piece(uid: number, id: string, x: number, y: number, rot = 0): FurnPiece {
  const def = FURN_BY_ID[id];
  return { uid, id, kind: def.kind, x, y, w: def.w, h: def.h, rot, sit: def.sit };
}

function table(id: string, capacity: number): ServiceTable {
  return { id, x: 0, y: 0, w: 2, h: 1, capacity, seats: [{ id: `${id}-0`, x: 0, y: 1, rot: 0 }] };
}

function steps(svc: ReturnType<typeof createService>, n: number) {
  for (let i = 0; i < n; i++) svc.tick(1);
}

function linked(tiles: { x: number; y: number }[]) {
  if (tiles.length <= 1) return true;
  const set = new Set(tiles.map((t) => `${t.x},${t.y}`));
  const seen = new Set<string>([`${tiles[0].x},${tiles[0].y}`]);
  const queue = [tiles[0]];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${cur.x + dx},${cur.y + dy}`;
      if (!set.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: cur.x + dx, y: cur.y + dy });
    }
  }
  return seen.size === tiles.length;
}

beforeEach(() => {
  game.load(newSave('Salon'));
});

describe('table proportions', () => {
  it('turns a long table sideways and leaves squares alone', () => {
    expect(furnSize(FURN_BY_ID.table_long, 1)).toEqual({ w: 1, h: 3 });
    expect(furnSize(FURN_BY_ID.table_long, 2)).toEqual({ w: 3, h: 1 });
    expect(furnSize(FURN_BY_ID.table_family, 1)).toEqual({ w: 2, h: 2 });
    expect(furnSize(FURN_BY_ID.chair_dark, 3)).toEqual({ w: 1, h: 1 });
  });

  it('seats four around a long table with a gap on each side', () => {
    const tables = layoutTables([
      piece(1, 'table_long', 7, 8),
      piece(2, 'chair_dark', 7, 7, 0),
      piece(3, 'chair_dark', 9, 7, 0),
      piece(4, 'chair_dark', 7, 9, 2),
      piece(5, 'chair_dark', 9, 9, 2),
    ]);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ x: 7, y: 8, w: 3, h: 1, capacity: 4 });
    expect(tables[0].seats.filter((s) => s.y === 7).map((s) => s.x)).toEqual([7, 9]);
  });

  it('uses the rotated footprint when the long table stands on its end', () => {
    const vertical = piece(1, 'table_long', 4, 4, 1);
    vertical.w = 1;
    vertical.h = 3;
    const tables = layoutTables([
      vertical,
      piece(2, 'chair_dark', 3, 5, 1),
      piece(3, 'chair_dark', 5, 5, 3),
    ]);
    expect(tables[0]).toMatchObject({ w: 1, h: 3, capacity: 2 });
    expect(tables[0].seats.map((s) => s.x).sort()).toEqual([3, 5]);
  });

  it('slides only the guests who are still sharing a tile edge', () => {
    const narrow = { x: 8, y: 8, w: 2, h: 1 };
    const tight = [{ x: 8, y: 7 }, { x: 9, y: 7 }];
    expect(seatDrawOffset(tight[0], tight, narrow)).toEqual({ dx: -8, dy: 0 });
    expect(seatDrawOffset(tight[1], tight, narrow)).toEqual({ dx: 8, dy: 0 });
    const wide = { x: 7, y: 8, w: 3, h: 1 };
    const apart = [{ x: 7, y: 7 }, { x: 9, y: 7 }];
    expect(seatDrawOffset(apart[0], apart, wide)).toEqual({ dx: 0, dy: 0 });
    expect(seatDrawOffset(apart[1], apart, wide)).toEqual({ dx: 0, dy: 0 });
  });

  it('steps standing neighbours apart without pushing more than half a tile', () => {
    const pair = [{ x: 5, y: 10 }, { x: 6, y: 10 }];
    expect(standApart(0, pair)).toEqual({ dx: -8, dy: 0 });
    expect(standApart(1, pair)).toEqual({ dx: 8, dy: 0 });
    const corner = [{ x: 5, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 11 }];
    expect(standApart(0, corner)).toEqual({ dx: -8, dy: -8 });
  });
});

describe('waiting for a table', () => {
  it('lets one party wait and keeps the next group outside', () => {
    expect(queueHasRoom(1, 1)).toBe(false);
    expect(queueHasRoom(2, 0)).toBe(false);
    expect(queueHasRoom(0, 0, 4)).toBe(true);
    expect(queueHasRoom(0, 0, 5)).toBe(false);
    expect(queueHasRoom(1, 2, 2)).toBe(false);
  });

  it('keeps a group inside one cluster and does not reuse a tile', () => {
    const free = () => true;
    expect(planWaitSpots(4, new Set(), free, RECEPTION_SPOTS)).toEqual(RECEPTION_SPOTS);
    const partial = planWaitSpots(4, new Set(['5,10']), free, RECEPTION_SPOTS);
    expect(partial).toHaveLength(3);
    expect(partial.every((t) => t.x <= 6 && t.y >= 10)).toBe(true);
    const first = planWaitSpots(2, new Set(), free, WAITING_SPOTS);
    const rest = planWaitSpots(2, new Set(first.map((t) => `${t.x},${t.y}`)), free, WAITING_SPOTS);
    expect(rest.every((t) => !first.some((s) => s.x === t.x && s.y === t.y))).toBe(true);
  });

  it('finds a side patch that skips the door lane', () => {
    const taken = new Set([...RECEPTION_SPOTS, ...WAITING_SPOTS].map((t) => `${t.x},${t.y}`));
    const spots = scanWaitSpots(4, taken, () => true);
    expect(spots).toHaveLength(4);
    expect(new Set(spots.map((t) => `${t.x},${t.y}`)).size).toBe(4);
    expect(spots.some((t) => t.x >= 7 && t.x <= 10 && t.y >= 10)).toBe(false);
    expect(linked(spots)).toBe(true);
  });
});

describe('reachable seats', () => {
  it('accepts a chair with an open neighbour and rejects a boxed one', () => {
    const grid = new Grid(6, 6);
    const table = { x: 2, y: 1, w: 1, h: 1 };
    const seat = { x: 2, y: 2 };
    grid.setSolid(seat.x, seat.y, true);
    expect(seatsApproachable(grid, [seat], [table], 0, 0)).toBe(true);
    for (const [x, y] of [[3, 2], [1, 2], [2, 3], [2, 1]]) grid.setSolid(x, y, true);
    expect(seatsApproachable(grid, [seat], [table], 0, 0)).toBe(false);
  });

  it('allows a free dining chair and refuses one the guests cannot reach', () => {
    game.setFlag('once_decor_dining');
    game.save.decor.dining = [
      { uid: 1, id: 'table_long', x: 7, y: 8, rot: 0 },
      { uid: 2, id: 'chair_dark', x: 7, y: 9, rot: 2 },
    ];
    expect(placementBlock('restaurant', 'dining', { uid: 3, id: 'chair_dark', x: 9, y: 9, rot: 2 })).toBeNull();
    game.save.decor.dining = [
      { uid: 1, id: 'table_round', x: 10, y: 7, rot: 0 },
      { uid: 2, id: 'bamboo_pot', x: 11, y: 8, rot: 0 },
      { uid: 3, id: 'bamboo_pot', x: 9, y: 8, rot: 0 },
      { uid: 4, id: 'bamboo_pot', x: 10, y: 9, rot: 0 },
    ];
    expect(placementBlock('restaurant', 'dining', { uid: 5, id: 'chair_dark', x: 10, y: 8, rot: 0 })).toBe('Los clientes no llegan a esa silla.');
  });
});

describe('saved dining layouts', () => {
  it('widens the old default tables once and moves the guests with the chairs', () => {
    game.setFlag('once_decor_dining');
    const chairs = [
      { uid: 2, id: 'chair_dark', x: 8, y: 7, rot: 0 },
      { uid: 3, id: 'chair_dark', x: 9, y: 7, rot: 0 },
      { uid: 4, id: 'chair_dark', x: 8, y: 9, rot: 2 },
      { uid: 5, id: 'chair_dark', x: 9, y: 9, rot: 2 },
    ];
    game.save.decor.dining = [{ uid: 1, id: 'table_dark', x: 8, y: 8, rot: 0 }, ...chairs];
    game.save.dining = {
      day: 1, bag: [], lastCustomer: null, nextId: 2, shift: null,
      floor: {
        nextTicket: 1,
        parties: [],
        tables: [{
          id: '1', x: 8, y: 8, capacity: 4, status: 'occupied', partyId: 'p', tip: 7,
          seats: chairs.map((c) => ({ id: String(c.uid), x: c.x, y: c.y, rot: c.rot })),
        }],
      },
    };
    ensureDefaultDecor();
    expect(game.room('dining').find((f) => f.uid === 1)).toMatchObject({ id: 'table_long', x: 7, y: 8, rot: 0 });
    expect(game.room('dining').find((f) => f.uid === 2)).toMatchObject({ x: 7, y: 7 });
    expect(game.room('dining').find((f) => f.uid === 3)).toMatchObject({ x: 9, y: 7 });
    expect(game.room('dining').find((f) => f.uid === 5)).toMatchObject({ x: 9, y: 9 });
    const saved = game.save.dining!.floor.tables[0];
    expect(saved).toMatchObject({ x: 7, y: 8, tip: 7, partyId: 'p' });
    expect(saved.seats.find((s) => s.id === '2')).toMatchObject({ x: 7, y: 7 });
    expect(saved.seats.find((s) => s.id === '3')).toMatchObject({ x: 9, y: 7 });
    const table = game.room('dining').find((f) => f.uid === 1)!;
    table.id = 'table_dark';
    table.x = 8;
    table.y = 8;
    ensureDefaultDecor();
    expect(game.room('dining').find((f) => f.uid === 1)).toMatchObject({ id: 'table_dark', x: 8, y: 8 });
  });

  it('leaves a custom table alone when the wider spot is taken', () => {
    game.setFlag('once_decor_dining');
    game.save.decor.dining = [
      { uid: 1, id: 'table_dark', x: 8, y: 8, rot: 0 },
      { uid: 2, id: 'chair_dark', x: 8, y: 7, rot: 0 },
      { uid: 3, id: 'chair_dark', x: 9, y: 7, rot: 0 },
      { uid: 4, id: 'chair_dark', x: 8, y: 9, rot: 2 },
      { uid: 5, id: 'chair_dark', x: 9, y: 9, rot: 2 },
      { uid: 9, id: 'bamboo_pot', x: 7, y: 8, rot: 0 },
    ];
    ensureDefaultDecor();
    expect(game.room('dining').find((f) => f.uid === 1)).toMatchObject({ id: 'table_dark', x: 8, y: 8 });
    expect(game.room('dining').find((f) => f.uid === 2)).toMatchObject({ x: 8, y: 7 });
  });

  it('starts a new game with spaced tables off the door lane', () => {
    ensureDefaultDecor();
    const room = game.room('dining');
    expect(room.filter((f) => f.id === 'table_long').map((f) => [f.x, f.y])).toEqual([[7, 8], [12, 7]]);
    expect(room.filter((f) => f.id === 'chair_dark' && f.y === 7).map((f) => f.x).sort()).toEqual([7, 9]);
    expect(room.some((f) => f.id === 'table_low' && f.x === 15 && f.y === 10)).toBe(true);
    expect(room.some((f) => (f.x === 8 || f.x === 9) && f.y >= 10)).toBe(false);
  });
});

describe('tip marker', () => {
  it('shows one coin and clears it when the tip is picked up', () => {
    expect(tipPending('tip', 5)).toBe(true);
    expect(tipPending('tip', 0)).toBe(false);
    expect(tipPending('free', 5)).toBe(false);
    const svc = createService([table('t', 1)], { timing: FAST, rng: () => 0 });
    svc.arrive({ id: 'p', customerId: 'c_tourist', patience: 100 });
    steps(svc, 3);
    svc.takeOrder('p', { recipe: 'onigiri', reward: 50 });
    svc.deliver('p', 2);
    steps(svc, 3);
    const snap = svc.snapshot();
    expect(snap.tables.filter((t) => t.tip > 0)).toHaveLength(1);
    expect(snap.tables[0].tip).toBe(5);
    const loaded = createService([table('t', 1)], { timing: FAST, rng: () => 0 });
    loaded.restore(structuredClone(snap));
    expect(loaded.table('t')).toMatchObject({ status: 'tip', tip: 5 });
    expect(loaded.collectTip('t')).toEqual({ amount: 5, cleared: true });
    expect(tipPending(loaded.table('t')!.status, loaded.table('t')!.tip)).toBe(false);
    expect(loaded.collectTip('t').amount).toBe(0);
    expect(structuredClone(snap).tables[0].tip).toBe(5);
  });
});
