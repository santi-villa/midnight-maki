import { describe, expect, it } from 'vitest';
import { normalizeUiScale } from '../core/uiScale';

describe('interface size preference', () => {
  it('keeps the original size for old or invalid settings', () => {
    for (const value of [undefined, null, '0.8', NaN, Infinity, {}]) expect(normalizeUiScale(value)).toBe(1);
  });
  it('preserves the selected size and bounds corrupted preferences', () => {
    expect(normalizeUiScale(0.85)).toBe(0.85);
    expect(normalizeUiScale(0)).toBe(0.7);
    expect(normalizeUiScale(3)).toBe(1);
  });
});
