import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { BONDS, bondDone, grantBond, nextBondFor, readyBonds } from '../story/bonds';
import { FURN_BY_ID } from '../data/furniture';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES_BY_ID } from '../data/recipes';

beforeEach(() => { game.load(newSave('Tester')); });
const befriend = (id: string, level: number) => { game.rel(id).points = level * 100; };

describe('personal scenes (vínculos)', () => {
  it('are well formed: unique ids, real rewards, real speakers', () => {
    expect(new Set(BONDS.map((b) => b.id)).size).toBe(BONDS.length);
    for (const b of BONDS) {
      const r = b.reward;
      if (r.furniture) expect(FURN_BY_ID[r.furniture], b.id).toBeDefined();
      if (r.recipe) expect(RECIPES_BY_ID[r.recipe], b.id).toBeDefined();
      for (const item of Object.keys(r.items ?? {})) expect(ITEMS_BY_ID[item], b.id + ' ' + item).toBeDefined();
      const beats = [...b.intro, ...(b.outro ?? []), ...(b.choice?.replies.flat(1) ?? [])] as [string, string][];
      expect(b.intro.length, b.id).toBeGreaterThanOrEqual(3);
      for (const [who] of beats) expect(['narr', 'pip', 'spicy', 'rigg', 'player']).toContain(who);
    }
  });

  it('start closed on a new game and never reveal Akio’s fate before the ending', () => {
    expect(readyBonds()).toEqual([]);
    const spoilers = /Ciudad del Puerto|\bsalud\b|enferm|estrellas escondidas|constelaci/i;
    for (const b of BONDS.filter((x) => x.id !== 'rigg_beam')) {
      const text = JSON.stringify([b.intro, b.outro, b.choice]);
      expect(text, b.id).not.toMatch(spoilers);
    }
    // anything that remembers the old owner waits until the player has heard his name (or found his notebook)
    befriend('pip', 3); game.setFlag('proj_beach_corner_2');
    expect(readyBonds().map((b) => b.id)).not.toContain('pip_bottle');
    game.setFlag('ume_akio');
    expect(readyBonds().map((b) => b.id)).toContain('pip_bottle');
  });

  it('are tied to what the player did, and talking starts the right one', () => {
    befriend('pip', 1); befriend('spicy', 1);
    expect(nextBondFor('pip', 'restaurant')).toBeNull();
    game.setFlag('proj_forest_clearing_1');
    expect(nextBondFor('pip', 'plaza')?.id).toBe('pip_nap');
    expect(nextBondFor('spicy', 'plaza')).toBeNull();
    for (const id of ['pip', 'spicy', 'rigg']) befriend(id, 2);
    game.setFlag('ch4_done'); game.setFlag('intro_done'); game.setFlag('bond_pip_nap');
    expect(nextBondFor('pip', 'plaza')).toBeNull(); // the three-way scenes need the restaurant
    expect(nextBondFor('pip', 'restaurant')?.id).toBe('trio_tuesday');
  });

  it('give their rewards once, and keep them on a reload', () => {
    const b = BONDS.find((x) => x.id === 'pip_nap')!;
    grantBond(b, null); grantBond(b, null);
    expect(bondDone(b)).toBe(true);
    expect(game.save.furnitureOwned.bond_nap_cushion).toBe(1);
    expect(game.save.recipesKnown.filter((r) => r === 'pip_nap')).toHaveLength(1);
    expect(game.flag('memory_bond_pip_nap')).toBe(b.reward.memory);
    const copy = JSON.parse(JSON.stringify(game.save));
    game.load(copy);
    expect(bondDone(b)).toBe(true);
    expect(readyBonds().map((x) => x.id)).not.toContain('pip_nap');
  });

  it('the kitchen renovations bring a scene with their raccoon, once, and only after the upgrade and the friendship', () => {
    game.setFlag('intro_done');
    const rice0 = game.save.inventory.rice ?? 0;
    for (const [who, upgrade, id] of [['spicy', 'rice_hand', 'spicy_rice'], ['rigg', 'service_bell', 'rigg_bell'], ['pip', 'carry_tray', 'pip_tray']] as const) {
      expect(readyBonds().map((b) => b.id)).not.toContain(id);
      befriend(who, 2);
      expect(readyBonds().map((b) => b.id)).not.toContain(id); // friendship alone is not enough
      game.save.restaurant.upgrades.push(upgrade);
      expect(nextBondFor(who, 'plaza')?.id).toBe(id);
      const b = BONDS.find((x) => x.id === id)!;
      grantBond(b, null); grantBond(b, null);
      expect(nextBondFor(who, 'plaza')?.id).not.toBe(id);
      expect(game.flag(`bond_count_${who}`)).toBe(1);
    }
    expect(game.save.furnitureOwned.clock).toBe(1);
    expect(game.save.inventory.rice).toBe(rice0 + 4);
  });
});
