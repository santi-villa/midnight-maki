import { describe, expect, it } from 'vitest';
import { COLORS, DEFAULT_PHONE, MODELS, WALLPAPERS, itemOf, ruleMet, type UnlockCtx } from '../ui/phone/catalog';

const ctx = (over: Partial<UnlockCtx> = {}): UnlockCtx => ({ level: 1, has: () => false, friend: () => 0, projectPhases: 0, achievement: () => false, ...over });

describe('NoriPhone catalog', () => {
  it('the starting look is free and every id is unique', () => {
    for (const k of ['model', 'color', 'wallpaper'] as const) expect(itemOf(k, DEFAULT_PHONE[k])?.unlock).toBeUndefined();
    for (const list of [MODELS, COLORS, WALLPAPERS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
  });
  it('unlocks follow the game, not the other way round', () => {
    expect(ruleMet('model', 'plus', ctx())).toBe(false);
    expect(ruleMet('model', 'plus', ctx({ level: 3 }))).toBe(true);
    expect(ruleMet('color', 'pip', ctx({ friend: (id) => (id === 'pip' ? 3 : 0) }))).toBe(true);
    expect(ruleMet('model', 'unknown', ctx())).toBe(false);
  });
});
