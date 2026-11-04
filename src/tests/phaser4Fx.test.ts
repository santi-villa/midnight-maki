import { describe, expect, it } from 'vitest';
import { BANK_MS, POND_MS, SEA_MS, tileAnimations, waterCycles } from '../scenes/groundAnim';
import { fallMs, particleCount, rippleValue } from '../scenes/fxMath';
import { TILE_INDEX } from '../art/tiles';

describe('water animated by the GPU', () => {
  const cycles = waterCycles(TILE_INDEX);
  it('finds the sea, pond, waterline and bank cycles of the real tileset, each with its speed', () => {
    expect(cycles.some((c) => c.ms === SEA_MS && c.frames.length === 8)).toBe(true);
    expect(cycles.some((c) => c.ms === POND_MS && c.frames.length === 4)).toBe(true);
    expect(cycles.some((c) => c.ms === BANK_MS && c.frames.length === 2)).toBe(true);
    // no tile belongs to two cycles (each tile can name only one animation)
    const all = cycles.flatMap((c) => c.frames);
    expect(new Set(all).size).toBe(all.length);
  });
  it('starts the cycle of each tile from itself, so a tile placed on a later frame keeps its offset', () => {
    const anim = tileAnimations([{ frames: [10, 11, 12, 13], ms: 450 }], 0);
    expect(anim[12].animation.map((f) => f.tileid)).toEqual([12, 13, 10, 11]);
    expect(anim[12].animationDuration).toBe(1800);
    expect(tileAnimations([{ frames: [5, 6], ms: 900 }], 1)[4].animation[0].tileid).toBe(4);
  });
});

describe('weather on the GPU', () => {
  it('fills the village densely but within a cap, and none in an empty area', () => {
    expect(particleCount('snow', 1920, 1280)).toBeGreaterThan(2000);
    expect(particleCount('rain', 100000, 100000)).toBe(5000);
    expect(particleCount('petals', 0, 0)).toBe(0);
  });
  it('crosses the area top to bottom at the given speed', () => {
    expect(fallMs(1280, 20)).toBe(66000);
  });
});

describe('ripple pattern', () => {
  it('pushes around the neutral 128 and stays a valid colour', () => {
    let sum = 0, n = 0;
    for (let f = 0; f < 4; f++) for (let y = 0; y < 50; y += 3) for (let x = 0; x < 80; x += 3) {
      for (const v of rippleValue(x, y, f)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255); sum += v; n++; }
    }
    expect(Math.abs(sum / n - 128)).toBeLessThan(12);
  });
});
