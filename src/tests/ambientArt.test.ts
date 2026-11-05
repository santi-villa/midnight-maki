import { describe, expect, it } from 'vitest';
import { PUFF_COLORS, PUFF_FRAMES, PUFF_H, PUFF_W } from '../art/puff';
import { PROPS } from '../data/props';
import { ZONES } from '../data/zones';
import { TILE_INDEX, TILE_SOLID } from '../art/tiles';

describe('smoke and steam puffs (art/fx/puff.recipe.json)', () => {
  const filled = (rows: string[]) => rows.join('').replace(/\./g, '').length;

  it('every frame fits the cell and only uses the puff colours', () => {
    for (const rows of PUFF_FRAMES) {
      expect(rows).toHaveLength(PUFF_H);
      for (const row of rows) {
        expect(row).toHaveLength(PUFF_W);
        expect(row).toMatch(/^[.lmd]+$/);
      }
    }
    for (const kind of ['smoke', 'steam'] as const) expect(Object.keys(PUFF_COLORS[kind]).sort()).toEqual(['d', 'l', 'm']);
  });

  it('is born small, billows, then comes apart (the growth is drawn, never scaled)', () => {
    const sizes = PUFF_FRAMES.map(filled);
    const peak = sizes.indexOf(Math.max(...sizes));
    expect(sizes[0]).toBeLessThan(sizes[peak] / 4);
    for (let i = 1; i <= peak; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    for (let i = peak + 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThan(sizes[i - 1]);
  });
});

describe('the station line', () => {
  const station = ZONES.station;
  const row = station.ground.findIndex((r) => r.startsWith('R'));

  it('runs across the whole district, out of the village to the east', () => {
    expect(row).toBeGreaterThan(0);
    expect(station.ground[row]).toBe('R'.repeat(station.w));
  });

  it('stays walkable and nothing solid stands on it', () => {
    expect(TILE_SOLID[TILE_INDEX.rail]).toBe(false);
    const blocking = station.props.filter((p) => {
      const d = PROPS[p.id];
      return d?.solid !== false && row >= p.y && row < p.y + d.h;
    });
    expect(blocking.map((p) => p.id)).toEqual([]);
  });
});
