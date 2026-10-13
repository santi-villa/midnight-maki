import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave } from '../persistence/validate';
import { masteryStars, nextStarGoal, quickQuality, recipeStars, recordMastery } from '../restaurant/mastery';

beforeEach(() => game.load(newSave('Tester')));

describe('recipe mastery', () => {
  it('needs consistent quality, not just repetition', () => {
    expect(masteryStars(undefined)).toBe(0);
    expect(masteryStars({ n: 1, g: 0, p: 0 })).toBe(1);
    expect(masteryStars({ n: 30, g: 0, p: 0 })).toBe(1); // many sloppy dishes never get past one star
    expect(masteryStars({ n: 3, g: 2, p: 0 })).toBe(2);
    expect(masteryStars({ n: 6, g: 6, p: 3 })).toBe(3);
    expect(masteryStars({ n: 12, g: 12, p: 7 })).toBe(4);
    expect(masteryStars({ n: 20, g: 20, p: 14 })).toBe(5);
  });

  it('records dishes and reports star changes', () => {
    let up = recordMastery('kappa', 2);
    expect(up).toEqual({ before: 0, after: 1 });
    for (let i = 0; i < 4; i++) up = recordMastery('kappa', 2);
    expect(recipeStars('kappa')).toBe(2);
    up = recordMastery('kappa', 2);
    expect(up.after).toBe(3);
    expect(game.save.recipeMastery?.kappa.n).toBe(6);
  });

  it('opens the quick shortcut at three stars and it pays a fixed quality', () => {
    expect(quickQuality(2)).toBeNull();
    expect(quickQuality(3)).toBe(1);
    expect(quickQuality(5)).toBe(2);
  });

  it('explains the next star and survives older saves', () => {
    expect(nextStarGoal(undefined)).toMatch(/una vez/);
    expect(nextStarGoal({ n: 20, g: 20, p: 14 })).toBeNull();
    const old = JSON.parse(JSON.stringify(newSave('Vieja')));
    delete old.recipeMastery;
    const loaded = validateSave(old);
    expect(loaded.recipeMastery).toEqual({});
  });
});
