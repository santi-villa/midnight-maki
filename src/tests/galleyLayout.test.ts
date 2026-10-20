import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { buildZone } from '../world/zoneRuntime';
import { KITCHEN, KITCHEN_GATES, STATIONS, footprint, stationAtTile } from '../galley/layout';
import { RESTAURANT_ENTRY } from '../data/zones';

beforeEach(() => { game.load(newSave('Tester')); });

const variants: [string, number, string[]][] = [['stage 0', 1, []], ['stage 3 with every upgrade', 12, ['board2', 'rice_big', 'galley_hands']]];

describe('the physical kitchen map', () => {
  for (const [name, level, upgrades] of variants) {
    describe(name, () => {
      const zone = () => { game.save.restaurant.level = level; game.save.restaurant.upgrades = [...upgrades]; return buildZone('restaurant', false); };

      it('blocks exactly the tiles of its stations and nothing else inside the kitchen', () => {
        const z = zone();
        const blocked = new Set<string>();
        for (let y = KITCHEN.y; y < KITCHEN.y + KITCHEN.h; y++) for (let x = KITCHEN.x; x < KITCHEN.x + KITCHEN.w; x++) if (z.grid.isSolid(x, y)) blocked.add(`${x},${y}`);
        const expected = new Set(STATIONS.flatMap((s) => footprint(s).map(([x, y]) => `${x},${y}`)));
        expect([...blocked].sort()).toEqual([...expected].sort());
      });

      it('has no two stations on the same tile', () => {
        const seen = new Set<string>();
        for (const s of STATIONS) for (const [x, y] of footprint(s)) { expect(seen.has(`${x},${y}`), `${s.id} overlaps at ${x},${y}`).toBe(false); seen.add(`${x},${y}`); }
      });

      it('lets you stand at every station and reach it from the street door', () => {
        const z = zone();
        const from = RESTAURANT_ENTRY;
        for (const s of STATIONS) {
          expect(s.stand.length).toBeGreaterThan(0);
          for (const [x, y] of s.stand) {
            expect(z.grid.isSolid(x, y), `${s.id} stand ${x},${y} is blocked`).toBe(false);
            expect(stationAtTile(x, y), `${s.id} stand tile is another station`).toBeUndefined();
            expect(z.grid.path(from.x, from.y, x, y), `${s.id} stand ${x},${y} unreachable`).not.toBeNull();
          }
        }
      });

      it('keeps a corridor at least two tiles wide all along the kitchen', () => {
        const z = zone();
        const free = (x: number, y: number) => !z.grid.isSolid(x, y);
        const pairs = (x: number) => { const out = new Set<number>(); for (let y = KITCHEN.y; y < KITCHEN.y + KITCHEN.h; y++) if (free(x, y) && free(x, y + 1)) out.add(y); return out; };
        for (let x = KITCHEN.x; x < KITCHEN.x + KITCHEN.w; x++) expect(pairs(x).size, `column ${x} is narrower than 2`).toBeGreaterThan(0);
        for (let x = KITCHEN.x; x < KITCHEN.x + KITCHEN.w - 1; x++) {
          const a = pairs(x), b = pairs(x + 1);
          expect([...a].some((y) => b.has(y)), `the 2-wide corridor breaks between ${x} and ${x + 1}`).toBe(true);
        }
      });

      it('opens to the dining hall through its gates', () => {
        const z = zone();
        for (const [x, y] of KITCHEN_GATES) expect(z.grid.isSolid(x, y), `gate ${x},${y} is blocked`).toBe(false);
        expect(z.grid.path(5, 5, 12, 3)).not.toBeNull();
      });

      it('keeps the hall-side counters and the stairs and storage door reachable', () => {
        const z = zone();
        for (const [x, y] of [[6, 5], [7, 5], [8, 5], [16, 3], [13, 3]]) expect(z.grid.path(RESTAURANT_ENTRY.x, RESTAURANT_ENTRY.y, x, y), `${x},${y}`).not.toBeNull();
      });
    });
  }

  it('turns the second board spot into a plain counter until the upgrade is bought', () => {
    game.save.restaurant.upgrades = [];
    const z = buildZone('restaurant', false);
    expect(z.props.filter((p) => p.x === 10 && p.y === 2).map((p) => p.key)).toEqual(['k_work']);
    game.save.restaurant.upgrades = ['board2'];
    expect(buildZone('restaurant', false).props.filter((p) => p.x === 10 && p.y === 2).map((p) => p.key)).toEqual(['k_board']);
  });
});
