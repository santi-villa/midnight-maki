import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../data/characters';
import { FOLK_SPECS } from '../data/folkSpecs';

const HEX = /^#[0-9a-f]{6}$/i;

describe('folk (new art style) specs', () => {
  it('covers every villager and raccoon (none missing, none extra)', () => {
    const ids = CHARACTERS.map((c) => c.id).sort();
    expect(Object.keys(FOLK_SPECS).sort()).toEqual(ids);
    for (const [id, spec] of Object.entries(FOLK_SPECS)) expect(spec.id).toBe(id);
  });

  it('uses valid colours everywhere', () => {
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string' && v.startsWith('#')) expect(v, path).toMatch(HEX);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '.' + i));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path + '.' + k);
    };
    for (const [id, spec] of Object.entries(FOLK_SPECS)) walk(spec, id);
  });

  it('keeps the raccoons wardrobe-aware (spec ids match raccoon flags)', () => {
    for (const c of CHARACTERS) expect(Boolean(c.raccoon)).toBe(['pip', 'spicy', 'rigg'].includes(c.id));
  });
});
