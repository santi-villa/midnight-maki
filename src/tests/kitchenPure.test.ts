import { describe, expect, it } from 'vitest';
import { newMask, riceScore, riceStats, spread } from '../kitchen/rice';
import { newRoll, rollGain, rollStep } from '../kitchen/roll';
import { cutOrder, knifeMove, newMarks, pieceLayout, cutScore } from '../kitchen/cut';
import { autoSpots, inPlate, settle } from '../kitchen/plating';

describe('rice spreading', () => {
  it('a single dab does not cover the sheet', () => {
    const m = newMask(); spread(m, 0.5, 0.5, 0.52, 0.5);
    expect(riceStats(m).coverage).toBeLessThan(0.2);
  });
  it('left-right passes cover 80%+ without heaping', () => {
    const m = newMask();
    for (let pass = 0; pass < 4; pass++) for (let row = 0; row < 5; row++) {
      const y = 0.1 + row * 0.2;
      spread(m, 0.03, y, 0.97, y); spread(m, 0.97, y, 0.03, y + 0.05);
    }
    const s = riceStats(m);
    expect(s.coverage).toBeGreaterThanOrEqual(0.8);
    expect(riceScore(s)).toBeGreaterThan(0.6);
  });
  it('staying put heaps rice and does not move the stats forever', () => {
    const m = newMask();
    for (let i = 0; i < 200; i++) spread(m, 0.5, 0.5, 0.505 + (i % 2) * 0.01, 0.5);
    expect(riceStats(m).coverage).toBeLessThan(0.35);
  });
});

describe('rolling', () => {
  it('a stalled hand adds almost nothing, a steady one adds fully, a swipe adds little', () => {
    expect(rollGain(0.001, 1, 'mouse').gain).toBeLessThan(0.001);
    expect(rollGain(0.3, 0.6, 'mouse').verdict).toBe('ok');
    expect(rollGain(0.5, 0.1, 'mouse').gain).toBeLessThan(0.1);
  });
  it('touch tolerates a bit more speed than the mouse', () => {
    expect(rollGain(0.3, 0.33, 'touch').gain).toBeGreaterThan(rollGain(0.3, 0.33, 'mouse').gain);
  });
  it('finishes after about a mat of steady movement and never goes backwards', () => {
    const s = newRoll();
    for (let i = 0; i < 30; i++) rollStep(s, 0.05, 0.1, 'mouse');
    expect(s.progress).toBe(1);
    rollStep(s, -0.5, 0.1, 'mouse');
    expect(s.progress).toBe(1);
  });
});

describe('cutting', () => {
  it('cuts the middle first, then the rest', () => {
    expect(cutOrder(6)[0]).toBeCloseTo(0.5, 1);
    expect(cutOrder(6)).toHaveLength(5);
    expect(cutOrder(8)).toHaveLength(7);
  });
  it('needs the blade to travel through, near a mark', () => {
    const marks = newMarks(4);
    expect(knifeMove(marks, 0.5, 0.4, 0.05)).toBe(-1);
    expect(marks[0].done).toBeCloseTo(0.4);
    expect(knifeMove(marks, 0.5, 0.7, 0.05)).toBe(0);
    expect(knifeMove(marks, 0.9, 1, 0.03)).toBe(-1);
  });
  it('pieces separate as cuts finish', () => {
    const marks = newMarks(4);
    marks.forEach((m) => { m.done = 1; });
    const p = pieceLayout(4, marks, 100, 6);
    expect(p).toHaveLength(4);
    expect(p[1].x - p[0].x).toBeGreaterThan(25);
    expect(cutScore(marks, 0.05)).toBe(1);
  });
});

describe('plating', () => {
  const pl = { cx: 100, cy: 100, rx: 50, ry: 30 };
  it('moves overlapping pieces apart, inside the plate', () => {
    const a = { x: 100, y: 100 };
    const q = settle({ x: 101, y: 100 }, [a], pl, 14)!;
    expect(Math.hypot(q.x - a.x, (q.y - a.y) * 1.3)).toBeGreaterThanOrEqual(13);
    expect(inPlate(q, pl)).toBe(true);
  });
  it('ignores drops far from the plate', () => {
    expect(settle({ x: 300, y: 300 }, [], pl, 14)).toBeNull();
  });
  it('auto spots fit 8 pieces without overlap', () => {
    const s = autoSpots(8, pl, 14);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, (s[i].y - s[j].y) * 1.3)).toBeGreaterThan(12);
    s.forEach((p) => expect(inPlate(p, pl)).toBe(true));
  });
});

import { RECIPES } from '../data/recipes';
describe('recipe order', () => {
  it('cooking happens at the stove before any table step (never after rolling or molding)', () => {
    const table = ['nori', 'rice', 'place', 'roll', 'cut', 'shape', 'top', 'wrap', 'cone', 'garnish', 'plate'];
    for (const r of RECIPES) {
      const firstTable = r.steps.findIndex((s) => table.includes(s.t));
      const lastCook = r.steps.map((s) => s.t).lastIndexOf('cook');
      if (lastCook >= 0) expect(lastCook, r.id).toBeLessThan(firstTable);
    }
  });
  it('fish is sliced before the roll is made', () => {
    for (const r of RECIPES) {
      const roll = r.steps.findIndex((s) => s.t === 'roll'), slice = r.steps.findIndex((s) => s.t === 'slice');
      if (roll >= 0 && slice >= 0) expect(slice, r.id).toBeLessThan(roll);
    }
  });
});
