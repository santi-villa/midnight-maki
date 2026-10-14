import { describe, expect, it } from 'vitest';
import { MAP_PLACE_IDS, placeIconGrid } from '../ui/mapIcons';

function ink(rows: string[]): number {
  return rows.join('').replace(/\./g, '').length;
}

describe('world map icons', () => {
  it('draws a distinct marker for every place, and a question mark when it is locked', () => {
    const seen = new Set<string>();
    for (const id of MAP_PLACE_IDS) {
      const rows = placeIconGrid(id);
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
      expect(ink(rows)).toBeGreaterThan(8);
      seen.add(rows.join('\n'));
    }
    expect(seen.size).toBe(MAP_PLACE_IDS.length);
    const locked = placeIconGrid('unknown');
    expect(locked).toHaveLength(16);
    expect(seen.has(locked.join('\n'))).toBe(false);
    expect(placeIconGrid('nowhere')).toEqual(locked);
    expect(ink(locked)).toBeGreaterThan(8);
  });
});
