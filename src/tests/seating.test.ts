import { describe, expect, it } from 'vitest';
import { facingTable } from '../restaurant/seating';

describe('seated guests face their table', () => {
  const table = { x: 4, y: 4, w: 2, h: 1 };
  it('looks at the table from every side, ignoring the chair rotation', () => {
    expect(facingTable({ x: 4, y: 3 }, table)).toBe('down');
    expect(facingTable({ x: 5, y: 5 }, table)).toBe('up');
    expect(facingTable({ x: 3, y: 4 }, table)).toBe('right');
    expect(facingTable({ x: 6, y: 4 }, table)).toBe('left');
  });
});
