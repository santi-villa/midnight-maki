import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, generateCode, normalizeCode, POSTCARDS } from '../cloud/friendCode';

describe('friend codes', () => {
  it('make six readable characters and read back whatever people type', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect(normalizeCode(c)).toBe(c);
      expect(normalizeCode(c.toLowerCase().replace(/(...)(...)/, '$1 - $2'))).toBe(c);
    }
  });
  it('refuse things that cannot be a code', () => {
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode('ABC')).toBeNull();
    expect(normalizeCode('ABCDE0')).toBeNull();
    expect(normalizeCode('ABCDE?')).toBeNull();
  });
  it('offers only fixed postcards with unique ids', () => {
    expect(new Set(POSTCARDS.map((p) => p.id)).size).toBe(POSTCARDS.length);
  });
});
