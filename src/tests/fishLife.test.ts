import { describe, expect, it } from 'vitest';
import { deepWater, jumpAt, jumpCount, orbitPoint, solidWater, waterBeside } from '../scenes/fishLife';

const POND = ['ssssss', 'swwwws', 'swwwws', 'swwwws', 'swwwws', 'ssssss'];

describe('fish in the water', () => {
  it('fish a spot from water inside the pond, never from the rim, so the shadow stays off the sand', () => {
    // a spot on the sand above the pond: the rim and the first rows lack water above them, the fourth row has it
    expect(waterBeside(POND, 2, 0)).toEqual({ x: 2, y: 3 });
    // from the side the shadow still goes in, not onto the bank
    const side = waterBeside(POND, 0, 3)!;
    expect(POND[side.y][side.x]).toBe('w');
    expect(solidWater(POND, side.x, side.y)).toBe(true);
  });

  it('has no fish for a spot that is far from any water', () => {
    expect(waterBeside(['ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'wwwwwwww'], 3, 0)).toBeNull();
  });

  it('counts as solid water only what has water on all eight sides', () => {
    const solid: string[] = [];
    for (let y = 0; y < POND.length; y++) for (let x = 0; x < POND[y].length; x++) if (solidWater(POND, x, y)) solid.push(`${x},${y}`);
    expect(solid).toEqual(['2,2', '3,2', '2,3', '3,3']); // the middle 2×2 of the 4×4 pond: every other tile touches the bank
  });

  it('draws the jump as a parabola: out of the water going up, the top at the lift, back in going down', () => {
    const start = jumpAt(0, 14, 3, 12), top = jumpAt(0.5, 14, 3, 12), end = jumpAt(1, 14, 3, 12);
    expect(start.x).toBeCloseTo(0); expect(start.y).toBeCloseTo(0);
    expect(end.x).toBeCloseTo(14); expect(end.y).toBeCloseTo(3);
    expect(top.y).toBeCloseTo(1.5 - 12);
    expect(start.angle).toBeLessThan(0); // y grows downwards: rising
    expect(end.angle).toBeGreaterThan(0); // falling
    expect(Math.abs(top.angle)).toBeLessThan(0.3); // level at the top
  });

  it('has a school jump one fish most of the time, often two, and now and then three', () => {
    const tally = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 1000; i++) tally[jumpCount(i / 1000)]++;
    expect(tally).toEqual({ 1: 500, 2: 300, 3: 200 });
    expect([jumpCount(0), jumpCount(0.4999), jumpCount(0.5), jumpCount(0.7999), jumpCount(0.8), jumpCount(0.9999)]).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('swims a shadow round an oval and points it along the way it goes', () => {
    for (let t = 0; t < 6.3; t += 0.45) {
      const o = orbitPoint(100, 50, 8, 4, t), q = orbitPoint(100, 50, 8, 4, t + 0.01);
      expect(((o.x - 100) / 8) ** 2 + ((o.y - 50) / 4) ** 2).toBeCloseTo(1, 6);
      // the next point lies where the angle points
      expect(Math.atan2(q.y - o.y, q.x - o.x)).toBeCloseTo(o.angle, 1);
    }
  });

  it('keeps the far-out fish to deep water, spread apart, and the same ones every time', () => {
    // a bay open to the south: sand on top, 14 rows of sea below, land on both sides (not a sea that runs off the map)
    const row = (n: number) => 's' + 'w'.repeat(n) + 's';
    const bay = ['s'.repeat(22), ...Array.from({ length: 14 }, () => row(20)), 's'.repeat(22)];
    const deep = deepWater(bay, 4, 7, 4);
    expect(deep.length).toBeGreaterThan(1);
    expect(deep.length).toBeLessThanOrEqual(4);
    for (const t of deep) {
      expect(bay[t.y][t.x]).toBe('w');
      // at least four tiles from any bank
      expect(Math.min(t.x, 21 - t.x, t.y, 15 - t.y)).toBeGreaterThanOrEqual(4);
    }
    for (let a = 0; a < deep.length; a++) for (let b = a + 1; b < deep.length; b++) expect(Math.hypot(deep[a].x - deep[b].x, deep[a].y - deep[b].y)).toBeGreaterThanOrEqual(7);
    expect(deepWater(bay, 4, 7, 4)).toEqual(deep);
  });

  it('has no deep water in a pond or a river too narrow to be far from the bank', () => {
    expect(deepWater(POND)).toEqual([]);
    expect(deepWater(['swwwwwwwwwwwwwwws', 'swwwwwwwwwwwwwwws', 'swwwwwwwwwwwwwwws'])).toEqual([]);
  });
});
