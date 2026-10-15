import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { ITEMS_BY_ID, PACKS } from '../data/items';
import { validateSave } from '../persistence/validate';
import { BASE_CAPACITY, giveStarterBundle, pantryTotal, shortageText, storePacks } from '../restaurant/supplies';

beforeEach(() => { game.load(newSave('Tester')); game.setFlag('intro_done'); });

describe('supplies, packs and the pantry', () => {
  it('sells packs and boxes with a moderate discount against buying one by one', () => {
    for (const p of PACKS) {
      const unit = ITEMS_BY_ID[p.item].buy * p.qty, price = ITEMS_BY_ID[p.id].buy;
      expect(price, p.id).toBeLessThanOrEqual(unit);
      expect(price, p.id).toBeGreaterThanOrEqual(unit * 0.75);
    }
  });

  it('opens packs into the pantry up to its capacity and keeps the rest in the bag', () => {
    game.addItem('bx_rice', 5, 'test');
    const r = storePacks();
    expect(pantryTotal()).toBeLessThanOrEqual(BASE_CAPACITY);
    expect(r.stored).toBe(pantryTotal());
    expect(game.count('bx_rice')).toBe(r.left);
    expect(r.left).toBeGreaterThan(0);
  });

  it('cooks from the pantry first, then the bag, without charging twice', () => {
    game.save.inventory = { rice: 2 };
    game.setPantry('rice', 3);
    expect(game.countUsable('rice')).toBe(5);
    expect(game.consumeIngredients({ rice: 4 })).toBe(true);
    expect(game.pantryCount('rice')).toBe(0);
    expect(game.count('rice')).toBe(1);
    expect(game.consumeIngredients({ rice: 2 })).toBe(false);
    expect(game.count('rice')).toBe(1);
  });

  it('says what is missing and where to get it, and loads old saves without a pantry', () => {
    game.save.inventory = {};
    expect(shortageText({ ingredients: { salmon: 1 } })).toContain('Nami');
    delete game.save.pantry;
    const back = game.load(validateSave(JSON.parse(JSON.stringify(game.save))));
    void back;
    expect(game.pantryCount('rice')).toBe(0);
  });

  it('leaves a starter bundle only when nothing can be cooked and coins are short', () => {
    game.save.inventory = {};
    game.save.coins = 500;
    expect(giveStarterBundle()).toBe(false);
    game.save.coins = 5;
    expect(giveStarterBundle()).toBe(true);
    expect(game.countUsable('rice')).toBe(3);
    expect(giveStarterBundle()).toBe(false);
  });
});
