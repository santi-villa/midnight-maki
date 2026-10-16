import { describe, expect, it } from 'vitest';
import { decorChips, firstDecorView, ghostAnchor } from '../decoration/decorView';
import { FURNITURE } from '../data/furniture';

describe('decoration menu', () => {
  it('shows a chip only for categories you own, then the room and the floor', () => {
    const chips = decorChips({ pt_sushi: 1, bamboo_pot: 1, missing: 0 }, FURNITURE);
    expect(chips.map((c) => c.label)).toEqual(['Pared', 'Plantas', 'En el cuarto', 'Piso']);
    expect(firstDecorView(chips)).toBe('wall');
  });

  it('opens on the room when nothing is stored', () => {
    const chips = decorChips({}, FURNITURE);
    expect(chips.map((c) => c.id)).toEqual(['room', 'style']);
    expect(firstDecorView(chips)).toBe('room');
  });

  it('anchors the footprint on the tile under the finger', () => {
    expect(ghostAnchor(5, 6, 1, 1)).toEqual({ x: 5, y: 6 });
    expect(ghostAnchor(5, 6, 2, 1)).toEqual({ x: 5, y: 6 });
    expect(ghostAnchor(5, 6, 3, 2)).toEqual({ x: 4, y: 5 });
  });
});
