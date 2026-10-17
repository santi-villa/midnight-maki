import { describe, expect, it } from 'vitest';
import { agenda, type AgendaInput } from '../systems/agenda';

const base: AgendaInput = {
  introDone: true, phase: 'open', energy: 80, coins: 100, level: 2, orders: 0, quest: null, canCookAny: true,
  upgrade: null, canHire: false, hireFrom: 150, festival: false, marketTonight: false, beach: false, drinks: false,
};
const ids = (i: Partial<AgendaInput>) => agenda({ ...base, ...i }).map((x) => `${x.group}:${x.id}`);

describe('agenda', () => {
  it('says nothing before the story lets the restaurant open', () => {
    expect(agenda({ ...base, introDone: false })).toEqual([]);
  });

  it('puts rest first when tired, then the orders, and keeps each group short', () => {
    const list = agenda({ ...base, energy: 10, orders: 2, quest: 'Hablá con Pip', festival: true, upgrade: { name: 'Más mesas', price: 300, missing: [] }, canCookAny: false });
    expect(list[0].id).toBe('sleep');
    expect(list.filter((x) => x.group === 'now')).toHaveLength(3);
    expect(ids({ orders: 2 })).toContain('now:orders');
  });

  it('suggests other things while the restaurant is closed, and what is unlocked', () => {
    const got = ids({ phase: 'closed', beach: true, canHire: true, upgrade: { name: 'Más mesas', price: 300, missing: ['Monedas'] } });
    expect(got).toEqual(expect.arrayContaining(['later:opens', 'later:upgrade', 'unlocked:fishing', 'unlocked:hire']));
    expect(got).not.toContain('now:orders');
  });
});
