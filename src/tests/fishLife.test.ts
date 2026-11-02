import { describe, expect, it } from 'vitest';
import { jumpAt, jumpCount, openWater, orbitPoint, waterBeside } from '../scenes/fishLife';

const POND = ['ssssss', 'swwwws', 'swwwws', 'swwwws', 'swwwws', 'ssssss'];

describe('fish in the water', () => {
  it('fish a spot from water inside the pond, never from the rim, so the shadow stays off the sand', () => {
    // a spot on the sand above the pond: the rim and the first rows lack water above them, the fourth row has it
    expect(waterBeside(POND, 2, 0)).toEqual({ x: 2, y: 3 });
    // from the side the shadow still goes in, not onto the bank
    const side = waterBeside(POND, 0, 3)!;
    expect(POND[side.y][side.x]).toBe('w');
    expect(openWater(POND)).toContainEqual(side);
  });

  it('has no fish for a spot that is far from any water', () => {
    expect(waterBeside(['ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'wwwwwwww'], 3, 0)).toBeNull();
  });

  it('lets fish jump only where there is water all around', () => {
    const open = openWater(POND);
    expect(open).toHaveLength(2 * 2); // the middle 2×2 of the 4×4 pond: every other tile touches the bank
    for (const t of open) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(POND[t.y + dy][t.x + dx]).toBe('w');
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
});
