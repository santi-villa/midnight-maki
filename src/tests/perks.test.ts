import { describe, expect, it } from 'vitest';
import { FLOOR, PERKS, PLAYER_REF, SLOWER, activePerks, chooseAlternative, floorSeconds, perkTotals, perksOf } from '../restaurant/perks';
import { cutSecondsFor, paceFor } from '../galley/crew';

describe('skills of the people who work', () => {
  it('give automatic ones by level and one of two at levels 2 and 4, never both of a pair', () => {
    expect(activePerks('spicy', 1, {})).toEqual([]);
    expect(activePerks('spicy', 2, {}).map((p) => p.id)).toEqual(['spicy_batch']); // nothing chosen yet: the first alternative applies
    expect(activePerks('spicy', 3, { perks: ['spicy_knife'] }).map((p) => p.id)).toEqual(['spicy_knife', 'spicy_step']);
    const picked = chooseAlternative('spicy', 4, { perks: ['spicy_knife'] }, 'spicy_double')!;
    expect(picked).toEqual(['spicy_knife', 'spicy_double']);
    expect(activePerks('spicy', 4, { perks: picked }).map((p) => p.id)).toEqual(['spicy_knife', 'spicy_step', 'spicy_double']);
    expect(chooseAlternative('spicy', 4, {}, 'spicy_knife')).toEqual(['spicy_knife']); // a level 2 skill at level 4 is allowed
    expect(chooseAlternative('spicy', 1, {}, 'spicy_knife')).toBeNull(); // not unlocked yet
    expect(chooseAlternative('rigg', 4, {}, 'spicy_knife')).toBeNull(); // someone else's
  });

  it('every skill has a real, small effect and every group has exactly two alternatives', () => {
    for (const p of PERKS) {
      const fx = Object.values(p.fx);
      expect(fx.length, p.id).toBeGreaterThan(0);
      if (p.fx.speed) { expect(p.fx.speed).toBeGreaterThanOrEqual(0.8); expect(p.fx.speed).toBeLessThan(1); }
      if (p.fx.walk) expect(p.fx.walk).toBeLessThanOrEqual(1.2);
    }
    for (const who of new Set(PERKS.map((p) => p.who))) {
      for (const level of new Set(perksOf(who).map((p) => p.level))) {
        const group = perksOf(who).filter((p) => p.level === level && p.group);
        if (group.length) { expect(group, `${who} ${level}`).toHaveLength(2); expect(new Set(group.map((p) => p.group)).size).toBe(1); }
      }
    }
    expect(perkTotals('rigg', 4, { perks: ['rigg_tray', 'rigg_double'] }).carry).toBe(2);
  });

  it('helpers are never faster than the player: at least 1.2× the player at the top level with the best skills, and slower below', () => {
    const best = 0.85 * 0.85; // both speed skills
    for (let level = 0; level <= 4; level++) {
      expect(cutSecondsFor(level, best)).toBeGreaterThanOrEqual(PLAYER_REF.cut * FLOOR - 1e-9);
      expect(paceFor(level, best)).toBeGreaterThanOrEqual(PLAYER_REF.step * FLOOR - 1e-9);
      expect(cutSecondsFor(level)).toBeGreaterThanOrEqual(PLAYER_REF.cut * SLOWER[4] - 1e-9);
    }
    // each level is quicker than the one before (practice shows) until the floor
    for (let level = 1; level <= 4; level++) expect(cutSecondsFor(level)).toBeLessThan(cutSecondsFor(level - 1));
    expect(floorSeconds(10, 0)).toBe(22);
    expect(floorSeconds(10, 4, 0.1)).toBe(12);
  });
});
