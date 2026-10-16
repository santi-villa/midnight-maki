import { describe, expect, it } from 'vitest';
import { TILE_INDEX, TILE_SOLID } from '../art/tiles';
import { castAnchor } from '../scenes/lightmath';
import type { ZoneDef } from '../data/zones';
import { tileFor } from '../world/zoneRuntime';

function row(ch: string, n = 32): ZoneDef {
  const line = ch.repeat(n);
  return { ground: [line, line, line], rooms: [], floor: 'wood', walls: 'cream' } as unknown as ZoneDef;
}

describe('cast shadows stay on the object base', () => {
  it('keeps the feet put and leans only the tip', () => {
    for (const reach of [-12, -3, 0, 4, 9]) {
      const pose = castAnchor(40, 80, reach, 48, 0.3);
      expect(pose.x).toBe(40);
      expect(pose.y).toBe(80);
      expect(pose.scaleY).toBeCloseTo(0.3);
      expect(Math.sign(pose.angle)).toBe(Math.sign(reach));
    }
  });

  it('leans a tall object farther than a short one for the same sun', () => {
    const tall = castAnchor(0, 0, 8, 64, 0.4);
    const short = castAnchor(0, 0, 8, 16, 0.2);
    expect(Math.abs(tall.angle)).toBeLessThan(Math.abs(short.angle));
    expect(tall.x).toBe(short.x);
  });
});

describe('ground tiles vary by coordinate and stay walkable', () => {
  it('picks a stable mix for lawn, path, sand, soil and indoor floors', () => {
    for (const ch of ['g', 'G', 'p', 's', 'o', 'f', 'k', 't']) {
      const def = row(ch);
      const seen = new Set<number>();
      for (let y = 0; y < 3; y++) for (let x = 0; x < 32; x++) {
        const t = tileFor(def, ch, x, y);
        expect(tileFor(def, ch, x, y)).toBe(t);
        expect(TILE_SOLID[t]).toBe(false);
        seen.add(t);
      }
      expect(seen.size, ch).toBeGreaterThan(1);
    }
  });

  it('keeps the flower lawn uncommon and the plain path tile available', () => {
    const def = row('g', 80);
    let flowers = 0;
    let n = 0;
    for (let x = 0; x < 80; x++) {
      n++;
      if (tileFor(def, 'g', x, 0) === TILE_INDEX.grass3) flowers++;
    }
    expect(flowers).toBeGreaterThan(0);
    expect(flowers / n).toBeLessThan(0.25);
    expect(TILE_INDEX.dirt).toBeGreaterThan(0);
    expect(TILE_INDEX.dirt1).not.toBe(TILE_INDEX.dirt);
    expect(TILE_INDEX.sand2).not.toBe(TILE_INDEX.sand);
  });
});

import { quantize } from '../scenes/shadowTex';
describe('baked shadow cache keys', () => {
  it('rounds the lean and squash so a day needs only a few textures', () => {
    expect(quantize(3.4, 0.337)).toEqual({ reach: 3, squash: 0.35 });
    expect(quantize(99, 5)).toEqual({ reach: 14, squash: 0.7 });
    expect(quantize(-99, 0)).toEqual({ reach: -14, squash: 0.1 });
  });
});
