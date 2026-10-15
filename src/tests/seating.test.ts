import { describe, expect, it } from 'vitest';
import { facingTable } from '../restaurant/seating';

describe('seated guests look at their table', () => {
  const table = { x: 4, y: 4, w: 2, h: 1 };
  it('faces the camera above the table, turns their back below it and sits in profile at the ends', () => {
    expect(facingTable({ x: 4, y: 3 }, table)).toBe('down');
    expect(facingTable({ x: 5, y: 5 }, table)).toBe('up');
    expect(facingTable({ x: 3, y: 4 }, table)).toBe('right');
    expect(facingTable({ x: 6, y: 4 }, table)).toBe('left');
  });
});
