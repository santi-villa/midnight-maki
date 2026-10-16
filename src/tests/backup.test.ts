import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { STARTER_CLOTHES } from '../data/clothes';
import { saveCode, saveFromCode } from '../persistence/storage';
import { validateSave } from '../persistence/validate';

beforeEach(() => game.load(newSave('Sofía')));

describe('backups', () => {
  it('round-trips a save through the text code (with accents)', () => {
    game.addCoins(345);
    game.save.player.restaurantName = 'Mañana Maki';
    const back = saveFromCode(saveCode());
    expect(back.coins).toBe(game.save.coins);
    expect(back.player.name).toBe('Sofía');
    expect(back.player.restaurantName).toBe('Mañana Maki');
  });

  it('rejects a broken code with a friendly error', () => {
    expect(() => saveFromCode('MM1:esto-no-es-una-partida')).toThrow(/código/);
  });

  it('gives the starter painting and pot to a prologue still in progress', () => {
    const old = JSON.parse(JSON.stringify(game.save));
    old.flags = {};
    old.furnitureOwned = {};
    old.stats = {};
    old.quests = { active: { prologue: { step: 4, progress: {} } }, done: [], tracked: 'prologue' };
    const fixed = validateSave(old);
    expect(fixed.furnitureOwned.pt_sushi).toBe(1);
    expect(fixed.furnitureOwned.bamboo_pot).toBe(1);
    expect(fixed.flags.starter_decor).toBe(true);
  });

  it('leaves a finished prologue without the starter pieces', () => {
    const old = JSON.parse(JSON.stringify(game.save));
    old.flags = {};
    old.furnitureOwned = {};
    old.quests.done = ['prologue'];
    const fixed = validateSave(old);
    expect(fixed.furnitureOwned.pt_sushi).toBeUndefined();
    expect(fixed.flags.starter_decor).toBeUndefined();
  });

  it('gives starter clothes added later to older saves', () => {
    const old = JSON.parse(JSON.stringify(game.save));
    old.clothesOwned = ['top_tee_cream'];
    const fixed = validateSave(old);
    for (const id of STARTER_CLOTHES) expect(fixed.clothesOwned).toContain(id);
  });
});
