import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { game, newSave } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { RECIPES } from '../data/recipes';
import { ZONES } from '../data/zones';
import { DEV_PLACE_FLAGS, devArrival, devZoneGroups, giveTestKit, maxFriendships, openPlaces, prepareEverything } from '../systems/devMode';
import { shopStatus } from '../systems/schedule';
import { buildZone } from '../world/zoneRuntime';
import { safeArrival } from '../world/zoneTransition';

beforeEach(() => { game.load(newSave('Tester')); });

describe('developer test kit', () => {
  it('opens every road and counter without finishing the story', () => {
    openPlaces();
    for (const flag of DEV_PLACE_FLAGS) expect(game.has(flag), flag).toBe(true);
    expect(game.has('market_open')).toBe(true);
    expect(game.has('shop_force_taro')).toBe(true);
    expect(game.has('ch1_done')).toBe(false);
    expect(game.save.story.chapter).toBe(0);
    const night = shopStatus('yuki', {
      period: 3, minutes: 40, festival: false, force: game.has('shop_force_yuki'), shut: false, storyHere: false, keeperZone: null,
    });
    expect(night.open).toBe(true);
  });

  it('fills recipes, coins, a rod and friendship without taking anything away', () => {
    game.addCoins(9000, 'already');
    const rich = game.coins;
    game.save.recipesKnown = ['kappa'];
    giveTestKit();
    maxFriendships();
    expect(game.coins).toBe(rich);
    expect(game.save.restaurant.level).toBe(BALANCE.maxRestaurantLevel);
    expect(game.save.recipesKnown).toEqual(expect.arrayContaining(RECIPES.map((r) => r.id)));
    expect(new Set(game.save.recipesKnown).size).toBe(game.save.recipesKnown.length);
    expect(game.count('rice')).toBeGreaterThanOrEqual(12);
    expect(game.count('rod_advanced')).toBe(1);
    for (const c of CHARACTERS) expect(game.rel(c.id).points).toBe(BALANCE.maxFriendship);
  });

  it('lists every zone once and lands each warp on a free tile, gates open or shut', () => {
    const ids = devZoneGroups().flatMap((g) => g.ids);
    expect(new Set(ids)).toEqual(new Set(Object.keys(ZONES)));
    for (const flagged of [false, true]) {
      if (flagged) openPlaces();
      else game.load(newSave('Tester'));
      for (const id of ids) {
        const spot = devArrival(id);
        expect(spot, id).not.toBeNull();
        const built = buildZone(id, flagged);
        expect(() => safeArrival(built, spot!.x, spot!.y), `${id} flagged=${flagged}`).not.toThrow();
      }
    }
  });

  it('prepare everything is the three steps together', () => {
    prepareEverything();
    expect(game.has('unlock_station')).toBe(true);
    expect(game.save.recipesKnown.length).toBe(RECIPES.length);
    expect(game.rel('pip').points).toBe(BALANCE.maxFriendship);
  });
});
