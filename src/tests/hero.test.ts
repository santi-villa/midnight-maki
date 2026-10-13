import { describe, expect, it } from 'vitest';
import { fillText } from '../dialogue/gender';
import { HERO_DEFAULTS, HERO_HAIR, heroSpec } from '../art/hero';
import { defaultAppearance } from '../core/state';
import { CLOTHES, CLOTHES_BY_ID, STARTER_CLOTHES } from '../data/clothes';

describe('heroes', () => {
  it('Santiago and Sofi start with clothes they own', () => {
    for (const g of ['m', 'f'] as const) {
      const a = defaultAppearance(g);
      expect(a.hero?.gender).toBe(g);
      for (const id of [a.top, a.bottom, a.shoes]) {
        expect(CLOTHES_BY_ID[id], id).toBeTruthy();
        expect(STARTER_CLOTHES).toContain(id);
      }
    }
    expect(HERO_DEFAULTS.m.name).toBe('Santiago');
  });

  it('every hair style has a name and the first 7 keep the old meaning', () => {
    expect(HERO_HAIR.length).toBeGreaterThanOrEqual(26);
    expect(HERO_HAIR[6].name).toBe('Sin pelo');
  });

  it('every wardrobe item converts to a spec without throwing', () => {
    const base = defaultAppearance('m');
    for (const c of CLOTHES) {
      const spec = heroSpec({ ...base, [c.slot]: c.id });
      expect(spec.hero).toBeTruthy();
    }
  });

  it('gender tokens in texts', () => {
    const t = '{Bienvenido|Bienvenida}, {name}. Sos {el nuevo dueño|la nueva dueña}.';
    expect(fillText(t, 'Santiago', '', 'm')).toBe('Bienvenido, Santiago. Sos el nuevo dueño.');
    expect(fillText(t, 'Sofi', '', 'f')).toBe('Bienvenida, Sofi. Sos la nueva dueña.');
  });
});
