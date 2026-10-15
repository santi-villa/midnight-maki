import { describe, expect, it } from 'vitest';
import { deliveryGoals, nearestGoal } from '../world/delivery';

describe('delivery guide', () => {
  const a = { tableId: 'a', x: 10, y: 10, table: 'Mesa 1', dish: 'Kappa maki' };
  it('gives one target per table and joins the dishes of the same table', () => {
    const g = deliveryGoals([a, { ...a, dish: 'Té verde' }, { tableId: 'b', x: 90, y: 10, table: 'Mesa 2', dish: 'Ebi nigiri' }]);
    expect(g.map((x) => x.label)).toEqual(['Mesa 1 · Kappa maki + Té verde', 'Mesa 2 · Ebi nigiri']);
  });
  it('points the arrow at the nearest table and has none when nothing is carried', () => {
    const g = deliveryGoals([a, { tableId: 'b', x: 90, y: 10, table: 'Mesa 2', dish: 'x' }]);
    expect(nearestGoal(g, 80, 12)?.x).toBe(90);
    expect(nearestGoal(deliveryGoals([]), 0, 0)).toBeNull();
  });
});
