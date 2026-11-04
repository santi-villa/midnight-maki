import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';
import { createService, layoutTables } from '../restaurant/floor';
import { seatsApproachable } from '../restaurant/seating';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { restyleDining } from '../restaurant/interiorLayout';
import { interiorSun, beamReach, lampRoom } from '../scenes/interiorLight';
import { NEIGHBORS } from '../data/neighbors';
import { neighborSpec } from '../art/neighborArt';

beforeEach(() => game.load(newSave()));

describe('planned restaurant', () => {
  it.each([1, 3, 5, 8])('keeps every seat, kitchen, stair and door accessible at level %i', level => {
    game.save.restaurant.level = level; ensureDefaultDecor();
    const built = buildZone('restaurant');
    const pieces = game.room('dining').map(f => { const d = FURN_BY_ID[f.id], s = furnSize(d, f.rot); return { ...f, kind: d.kind, ...s, sit: d.sit }; });
    const tables = layoutTables(pieces);
    expect(tables.length).toBe(3 + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0) + (level >= 8 ? 1 : 0));
    expect(tables.every(t => t.capacity > 0)).toBe(true);
    expect(seatsApproachable(built.grid, tables.flatMap(t => t.seats), tables, 8, 12)).toBe(true);
    for (const [x, y] of [[9, 5], [16, 3], [13, 3], [6, 10]]) expect(built.grid.path(8, 12, x, y)).not.toBeNull();
  });
  it('keeps a custom obstacle and an intact purchased group if their new places conflict', () => {
    game.save.decor.dining = [
      { uid: 1, id: 'table_long', x: 13, y: 7, rot: 0 },
      ...[[13,6,0],[15,6,0],[13,8,2],[15,8,2]].map(([x,y,rot],i) => ({uid:i+2,id:'chair_dark',x,y,rot})),
      { uid: 8, id: 'bamboo_pot', x: 11, y: 7, rot: 0 },
    ];
    const before = structuredClone(game.room('dining'));
    restyleDining(); restyleDining();
    expect(game.room('dining')).toEqual(before);
  });
  it('defers an active service and later moves an intact set once, retaining ownership and UIDs', () => {
    game.save.decor.dining = [
      { uid: 1, id: 'table_long', x: 13, y: 7, rot: 0 },
      ...[[13,6,0],[15,6,0],[13,8,2],[15,8,2]].map(([x,y,rot],i) => ({uid:i+2,id:'chair_dark',x,y,rot})),
    ];
    game.save.furnitureOwned.bonsai = 2;
    const service = createService([]);
    service.arrive({ id: 'pending', customerId: 'c_tourist', patience: 100 });
    game.save.dining = { day: 1, bag: [], lastCustomer: null, nextId: 2, shift: null, floor: service.snapshot() };
    restyleDining();
    expect(game.room('dining')[0].x).toBe(13);
    expect(game.has('once_dining_izakaya_v2')).toBe(false);
    game.save.dining.floor.parties = [];
    restyleDining();
    expect(game.room('dining')[0]).toMatchObject({ uid: 1, x: 11, y: 7 });
    const result = structuredClone(game.room('dining'));
    restyleDining();
    expect(game.room('dining')).toEqual(result);
    expect(game.save.furnitureOwned.bonsai).toBe(2);
    expect(game.room('dining').map(f => f.uid)).toEqual([1,2,3,4,5]);
  });
});

describe('interior sun and appearance adapters', () => {
  it('has continuous boundaries, no night sun and weaker rain light', () => {
    for (let p = 0; p < 3; p++) expect(interiorSun(p, 1, false)).toEqual(interiorSun(p + 1, 0, false));
    expect(interiorSun(3, .7, false).strength).toBe(0);
    expect(interiorSun(1, .5, true).strength).toBeLessThan(interiorSun(1, .5, false).strength);
    expect(beamReach(40, 32, 16, 60, 0, [{ x: 32, y: 50, w: 16, h: 16 }])).toBe(18);
    expect(lampRoom(['#######','#######','#ff#ff#','#ff#ff#','#######'], 24, 40)).toEqual({ x: 16, y: 32, w: 32, h: 32 });
  });
  it('preserves every neighbor skin, clothing and species silhouette', () => {
    for (const n of NEIGHBORS) {
      const s = neighborSpec(n.look);
      expect(s.fur).toBe(n.look.skin); expect(s.human).toBe(false);
      expect(s.ears).not.toBe('none'); expect(s.top).toBeTruthy();
      expect(s.tail).toBeDefined();
    }
  });
});
