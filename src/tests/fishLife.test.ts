import { describe, expect, it } from 'vitest';
import { jumpAt, openWater, waterBeside } from '../scenes/fishLife';

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
});
