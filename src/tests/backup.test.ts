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

  it('gives starter clothes added later to older saves', () => {
    const old = JSON.parse(JSON.stringify(game.save));
    old.clothesOwned = ['top_tee_cream'];
    const fixed = validateSave(old);
    for (const id of STARTER_CLOTHES) expect(fixed.clothesOwned).toContain(id);
  });
});
