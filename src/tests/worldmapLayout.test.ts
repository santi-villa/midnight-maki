import { describe, expect, it } from 'vitest';
import { layout } from '../world/mapLayout';

describe('map layout from the real doors', () => {
  const at = Object.fromEntries(layout().map((p) => [p.z.id, p]));
  it('puts every outdoor zone on the map, with the plaza in the middle', () => {
    for (const id of ['plaza', 'forest', 'market', 'station', 'garden', 'beach']) expect(at[id], id).toBeTruthy();
    expect(at.plaza).toMatchObject({ x: 0, y: 0 });
  });
  it('places each neighbour on the side where its door is, and never on top of another zone', () => {
    expect(at.forest.y + at.forest.z.h).toBe(0);      // door on the north edge
    expect(at.market.y + at.market.z.h).toBe(0);
    expect(at.beach.y).toBe(at.plaza.z.h);            // door on the south edge
    expect(at.station.x + at.station.z.w).toBe(0);    // door on the west edge
    expect(at.garden.x).toBe(at.plaza.z.w);           // door on the east edge
    const all = Object.values(at);
    for (const a of all) for (const b of all) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.z.w && b.x < a.x + a.z.w && a.y < b.y + b.z.h && b.y < a.y + a.z.h;
      expect(overlap, `${a.z.id} / ${b.z.id}`).toBe(false);
    }
  });
});
