import { expect, it } from 'vitest';
import { shopShutter, shutterLevel } from '../art/shopShutter';
import { narratorPortrait } from '../art/narratorPortrait';

it('maps the shared service phases to open, half and closed shutters', () => {
  expect(['setup', 'open', 'closing', 'closed'].map(p => shutterLevel(p as any))).toEqual([0.5, 0, 0.5, 1]);
  const b = shopShutter(18, 30);
  expect(b.alpha(0, 0)).toBe(255);
  expect([...b.data.slice((2 * 18 + 3) * 4, (2 * 18 + 3) * 4 + 3)])
    .not.toEqual([...b.data.slice((4 * 18 + 3) * 4, (4 * 18 + 3) * 4 + 3)]);
});

it('draws a square narrator portrait with a crescent and an ink well', () => {
  const b = narratorPortrait();
  expect([b.w, b.h]).toEqual([32, 32]);
  expect(b.alpha(0, 0)).toBe(0);
  const color = (x: number, y: number) => [...b.data.slice((y * b.w + x) * 4, (y * b.w + x) * 4 + 3)];
  expect(color(7, 10)).not.toEqual(color(14, 8));
  expect(color(10, 27)).not.toEqual(color(10, 23));
});
