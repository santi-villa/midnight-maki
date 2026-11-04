import { describe, expect, it } from 'vitest';
import { gradeAt, gradeMatrix, NEUTRAL } from '../scenes/grade';

const apply = (m: number[], rgb: [number, number, number]) => [0, 1, 2].map((i) => m[i * 5] * rgb[0] + m[i * 5 + 1] * rgb[1] + m[i * 5 + 2] * rgb[2]);

describe('colour of the hour', () => {
  it('warms the dusk and cools the night, and leaves the afternoon nearly as it is', () => {
    const grey: [number, number, number] = [0.5, 0.5, 0.5];
    const [dr, , db] = apply(gradeMatrix(gradeAt(2, 0.2, false, true)), grey);
    const [nr, , nb] = apply(gradeMatrix(gradeAt(3, 0.2, false, true)), grey);
    const [ar, ag, ab] = apply(gradeMatrix(gradeAt(1, 0.2, false, true)), grey);
    expect(dr).toBeGreaterThan(db);
    expect(nb).toBeGreaterThan(nr);
    for (const v of [ar, ag, ab]) expect(v).toBeCloseTo(0.5, 2);
  });
  it('slides into the next part of the day only in the last third, without jumps', () => {
    expect(gradeAt(2, 0.5, false, true)).toEqual(gradeAt(2, 0.1, false, true));
    const steps = Array.from({ length: 61 }, (_, i) => gradeAt(2, i / 60, false, true).b);
    for (let i = 1; i < steps.length; i++) expect(Math.abs(steps[i] - steps[i - 1])).toBeLessThan(0.02);
    expect(gradeAt(2, 1, false, true).b).toBeCloseTo(gradeAt(3, 0, false, true).b, 5);
  });
  it('keeps grey grey (saturation never tints a neutral colour) and stays neutral indoors', () => {
    const m = gradeMatrix({ r: 1, g: 1, b: 1, sat: 1.4 });
    for (const v of apply(m, [0.3, 0.3, 0.3])) expect(v).toBeCloseTo(0.3, 5);
    expect(gradeAt(3, 0.5, true, false)).toEqual(NEUTRAL);
  });
  it('greys the rain a little', () => {
    expect(gradeAt(1, 0.2, true, true).sat).toBeLessThan(gradeAt(1, 0.2, false, true).sat);
  });
});
