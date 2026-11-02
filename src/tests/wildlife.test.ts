import { describe, expect, it } from 'vitest';
import { bankWater, crabHomes, duckWater, fallFor, frogHomes, spread } from '../scenes/wildlife';

// a pond in a meadow, with a bridge across its top row
const POND = [
  'gggggggggggg',
  'gggggggggggg',
  'gggbbbbggggg',
  'ggwwwwwwwggg',
  'ggwwwwwwwggg',
  'ggwwwwwwwggg',
  'ggwwwwwwwggg',
  'gggggggggggg',
];
const all = () => true;
const water = (c: string | undefined) => c === 'w' || c === 'd';

describe('where the small animals live', () => {
  it('puts frogs on the bank, never in the water or on a bridge, spread apart', () => {
    const homes = frogHomes(POND, all, 3);
    expect(homes.length).toBeGreaterThan(0);
    for (const h of homes) {
      expect(water(POND[h.y][h.x])).toBe(false);
      expect(POND[h.y][h.x]).not.toBe('b');
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => water(POND[h.y + dy]?.[h.x + dx]))).toBe(true);
    }
    for (let a = 0; a < homes.length; a++) for (let b = a + 1; b < homes.length; b++) expect(Math.hypot(homes[a].x - homes[b].x, homes[a].y - homes[b].y)).toBeGreaterThanOrEqual(6);
    // where the ground cannot be walked on, there is no frog
    expect(frogHomes(POND, () => false)).toEqual([]);
  });

  it('puts crabs only on sand close to the sea', () => {
    const beach = ['ssssssssss', 'ssssssssss', 'ssssssssss', 'ssssssssss', 'wwwwwwwwww', 'wwwwwwwwww'];
    const homes = crabHomes(beach, all, 4);
    expect(homes.length).toBeGreaterThan(0);
    for (const h of homes) { expect(beach[h.y][h.x]).toBe('s'); expect(h.y).toBeGreaterThanOrEqual(2); }
    expect(crabHomes(POND, all)).toEqual([]); // no sand, no crabs
  });

  it('lets the ducks swim only where there is water all round, and the dragonflies over the edge of it', () => {
    for (const t of duckWater(POND)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(water(POND[t.y + dy][t.x + dx])).toBe(true);
    expect(duckWater(POND).length).toBe(5 * 2);
    for (const t of bankWater(POND)) expect(water(POND[t.y][t.x])).toBe(true);
    expect(bankWater(POND).every((t) => duckWater(POND).every((d) => d.x !== t.x || d.y !== t.y))).toBe(true);
  });

  it('spreads its picks apart and picks the same ones every time', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }));
    const a = spread(pts, 3, 4), b = spread(pts, 3, 4);
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y)).toBeGreaterThanOrEqual(4);
  });

  it('lets cherry trees shed petals in spring, trees a leaf in summer, both their leaves in autumn, and nothing in winter', () => {
    expect(fallFor('sakura', 0)?.what).toEqual(['petal']);
    expect(fallFor('tree', 0)).toBeNull();
    expect(fallFor('tree', 1)?.what).toEqual(['leaf']);
    expect(fallFor('tree', 1)!.rate).toBeLessThan(fallFor('sakura', 0)!.rate);
    expect(fallFor('sakura', 2)?.what.length).toBe(3);
    expect(fallFor('pine', 2)).toBeNull(); // an evergreen keeps its needles
    for (const k of ['tree', 'sakura', 'pine']) expect(fallFor(k, 3)).toBeNull();
  });
});
