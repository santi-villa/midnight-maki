/** Data integrity: catches broken references before they become bugs in-game. */
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../data/characters';
import { CLOTHES, CLOTHES_BY_ID } from '../data/clothes';
import { FURNITURE } from '../data/furniture';
import { ITEMS, ITEMS_BY_ID, INGREDIENT_ALIASES } from '../data/items';
import { PROPS } from '../data/props';
import { EXPERIMENTS, RECIPES } from '../data/recipes';
import { ZONES } from '../data/zones';
import { CLUES, CLUE_BY_ID, DEDUCTIONS } from '../story/clues';
import { OBJECT_KINDS } from '../art/objects';

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe('content integrity', () => {
  it('has unique ids', () => {
    expect(unique(ITEMS.map((i) => i.id))).toBe(true);
    expect(unique(RECIPES.map((r) => r.id))).toBe(true);
    expect(unique(FURNITURE.map((f) => f.id))).toBe(true);
    expect(unique(CLOTHES.map((c) => c.id))).toBe(true);
    expect(unique(CHARACTERS.map((c) => c.id))).toBe(true);
    expect(unique(CLUES.map((c) => c.id))).toBe(true);
  });

  it('meets the content targets of the design document', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(24);
    expect(FURNITURE.length).toBeGreaterThanOrEqual(60);
    expect(CHARACTERS.filter((c) => !c.raccoon).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(ZONES).length).toBeGreaterThanOrEqual(8);
  });

  it('recipes only use existing ingredients, and every step item is part of the recipe', () => {
    for (const r of RECIPES) {
      for (const id of Object.keys(r.ingredients)) expect(ITEMS_BY_ID[id], `${r.id}: ${id}`).toBeTruthy();
      const used = new Set(Object.keys(r.ingredients));
      for (const s of r.steps) {
        const items = 'items' in s ? s.items : 'item' in s ? [s.item] : [];
        for (const it of items) expect(used.has(it) || used.has(INGREDIENT_ALIASES[it] ?? ''), `${r.id} step uses ${it}`).toBe(true);
      }
      for (const v of r.variants ?? []) expect(ITEMS_BY_ID[v.item]).toBeTruthy();
      expect(r.price).toBeGreaterThan(0);
    }
  });

  it('experiments point to real recipes', () => {
    for (const e of EXPERIMENTS) {
      expect(RECIPES.some((r) => r.id === e.result)).toBe(true);
      for (const i of e.combo) expect(ITEMS_BY_ID[i]).toBeTruthy();
    }
  });

  it('zones reference valid props, doors and sizes', () => {
    for (const z of Object.values(ZONES)) {
      expect(z.ground.length).toBe(z.h);
      for (const row of z.ground) expect(row.length).toBe(z.w);
      for (const p of z.props) expect(PROPS[p.id], `${z.id}: prop ${p.id}`).toBeTruthy();
      for (const d of z.doors) {
        expect(ZONES[d.to], `${z.id} door to ${d.to}`).toBeTruthy();
        const t = ZONES[d.to];
        expect(d.tx >= 0 && d.ty >= 0 && d.tx < t.w && d.ty < t.h).toBe(true);
      }
      for (const g of z.gather) for (const i of g.pool) expect(ITEMS_BY_ID[i], `${z.id} gather ${i}`).toBeTruthy();
    }
  });

  it('every prop and furniture has a drawing recipe', () => {
    for (const p of Object.values(PROPS)) expect(OBJECT_KINDS).toContain(p.kind);
    for (const f of FURNITURE) expect(OBJECT_KINDS, f.id).toContain(f.kind);
  });

  it('characters wear existing clothes and like existing items', () => {
    for (const c of CHARACTERS) {
      for (const slot of ['top', 'bottom', 'shoes', 'head', 'face', 'extra', 'bag'] as const) {
        const id = c.appearance[slot];
        if (id) expect(CLOTHES_BY_ID[id], `${c.id} ${slot}`).toBeTruthy();
      }
      for (const id of [...c.loves, ...c.likes, ...c.dislikes]) expect(ITEMS_BY_ID[id] || FURNITURE.some((f) => f.id === id), `${c.id} pref ${id}`).toBeTruthy();
      for (const r of c.routine) expect(ZONES[r.zone]).toBeTruthy();
    }
  });

  it('deductions use existing clues', () => {
    for (const d of DEDUCTIONS) {
      for (const c of d.pair) expect(CLUE_BY_ID[c]).toBeTruthy();
      expect(d.correct).toBeLessThan(d.conclusions.length);
    }
  });
});
