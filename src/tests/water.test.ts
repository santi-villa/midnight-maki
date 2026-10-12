import { describe, expect, it } from 'vitest';
import { SHORE_FRAMES, TILE_INDEX, TILE_SOLID, waterFrames } from '../art/tiles';
import { ZONES } from '../data/zones';
import { tileFor, waterDepthAt, waterVariant } from '../world/zoneRuntime';

describe('water tiles', () => {
  it('has 4 frames for every kind, variant and weather, all solid like before', () => {
    for (const rain of [false, true])
      for (const depth of ['s', 'm', 'd'] as const)
        for (let v = 0; v < 3; v++) {
          const frames = waterFrames(depth, v, rain);
          expect(frames).toHaveLength(4);
          expect(new Set(frames).size).toBe(4);
          for (const f of frames) {
            expect(f).toBeGreaterThan(0);
            expect(TILE_SOLID[f]).toBe(true); // water still blocks walking
          }
        }
    expect(new Set(SHORE_FRAMES).size).toBe(4);
  });

  it('keeps the legacy water0 / deep0 keys for the title scene', () => {
    expect(TILE_INDEX.water0).toBeGreaterThan(0);
    expect(TILE_INDEX.deep0).toBeGreaterThan(0);
  });

  it('picks a stable variant and a softer tone next to deep water', () => {
    for (let i = 0; i < 50; i++) expect(waterVariant(i, i * 3)).toBe(waterVariant(i, i * 3));
    expect(new Set(Array.from({ length: 60 }, (_, i) => waterVariant(i, 7))).size).toBe(3);
    const g = ['www', 'wdw', 'www', 'wwww'];
    expect(waterDepthAt(g, 1, 1)).toBe('d');
    expect(waterDepthAt(g, 0, 0)).toBe('m');
    expect(waterDepthAt(['wwww', 'wwww', 'wwww', 'wwww'], 3, 3)).toBe('s');
  });

  it('every water cell of every zone resolves to a calm water tile (collisions unchanged)', () => {
    let seen = 0;
    for (const def of Object.values(ZONES))
      for (let y = 0; y < def.h; y++)
        for (let x = 0; x < def.w; x++) {
          const ch = def.ground[y][x];
          if (ch !== 'w' && ch !== 'd') continue;
          seen++;
          const t = tileFor(def, ch, x, y);
          expect(waterFrames(ch === 'd' ? 'd' : waterDepthAt(def.ground, x, y), waterVariant(x, y), false)[0]).toBe(t);
          expect(TILE_SOLID[t]).toBe(true);
        }
    expect(seen).toBeGreaterThan(50);
  });
});
