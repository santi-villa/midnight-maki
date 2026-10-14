import { describe, expect, it } from 'vitest';
import { doneness, grillAdvance, grillSeconds, grillZone } from '../restaurant/grill';

describe('plancha', () => {
  it('has four zones along the bar', () => {
    expect([0, 0.29, 0.3, 0.71, 0.72, 0.89, 0.9, 1].map(grillZone)).toEqual(['raw', 'raw', 'ready', 'ready', 'over', 'over', 'burnt', 'burnt']);
  });
  it('burns slowly: the whole bar takes a long while and relaxed is slower still', () => {
    expect(grillSeconds('shrimp', 'normal')).toBeGreaterThan(30);
    expect(grillSeconds('shrimp', 'relaxed')).toBeGreaterThan(grillSeconds('shrimp', 'normal'));
    expect(grillSeconds('shrimp', 'challenge')).toBeLessThan(grillSeconds('shrimp', 'normal'));
    expect(grillAdvance(0, 10, 'shrimp', 'relaxed')).toBeLessThan(0.3);
  });
  it('never goes past the cap', () => {
    expect(grillAdvance(1.1, 999, 'egg', 'normal')).toBe(1.15);
  });
  it('rates how it came out', () => {
    expect(doneness(0.5)).toMatchObject({ zone: 'ready', score: 1, mistake: false });
    expect(doneness(0.1).mistake).toBe(true);
    expect(doneness(0.8).mistake).toBe(false);
    expect(doneness(1).mistake).toBe(true);
    expect(doneness(1).score).toBeLessThan(doneness(0.8).score);
  });
});
