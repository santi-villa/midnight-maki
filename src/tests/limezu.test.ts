import { describe, expect, it } from 'vitest';
import catalog from '../assets/limezu/catalog.json';
import { FURN_BY_ID } from '../data/furniture';
import { PROPS } from '../data/props';

describe('LimeZu interior pieces', () => {
  it('only dress furniture and props that exist, each ID once', () => {
    const seen = new Set<string>();
    for (const piece of catalog.pieces) for (const id of piece.replaces) {
      expect(FURN_BY_ID[id] ?? PROPS[id], `${piece.id} -> ${id}`).toBeTruthy();
      expect(seen.has(id), `${id} dressed twice`).toBe(false);
      seen.add(id);
    }
  });

  it('give rotatable seats all four directions and keep every frame inside the atlas', () => {
    for (const piece of catalog.pieces) {
      const seat = piece.replaces.some((id) => FURN_BY_ID[id]?.sit && FURN_BY_ID[id]?.rotatable);
      if (seat) expect(piece.frames, piece.id).toHaveLength(4);
      for (const f of piece.frames) {
        expect(f.atlas.x + f.atlas.w).toBeLessThanOrEqual(catalog.width);
        expect(f.atlas.y + f.atlas.h).toBeLessThanOrEqual(catalog.height);
      }
    }
  });
});
