import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { BALANCE } from '../core/balance';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES } from '../data/recipes';
import { addRestaurantXp, serveOrder, unlockLevelRecipes } from '../restaurant/orders';
import { freeCookCoins } from '../restaurant/economy';
import { buyUpgrade } from '../restaurant/upgrades';
import { recordMastery } from '../restaurant/mastery';
import { recordRecipeResult, recipePresentation, selectRecipePresentation } from '../restaurant/recipeCollection';
import { validateSave } from '../persistence/validate';
import { buildNextPhase, startProjectPhase, phaseStatus, applyProjectBenefits, claimProjectSupplies } from '../restaurant/projects';
import { ensureDaily, claimErrandReward, type Errand } from '../quests/daily';
import { bus } from '../core/events';

beforeEach(() => { game.load(newSave('Tester')); game.setFlag('intro_done'); });
const roundTrip = () => game.load(validateSave(JSON.parse(JSON.stringify(game.save))));

describe('sustainable cooking and unlock pace', () => {
  it('keeps every fully purchasable recipe profitable at lowest service and walk-in payout', () => {
    for (const r of RECIPES.filter(r => Object.keys(r.ingredients).every(id => ITEMS_BY_ID[id].buy > 0))) {
      const cost = Object.entries(r.ingredients).reduce((n, [id, q]) => n + q * ITEMS_BY_ID[id].buy, 0);
      expect(Math.round(r.price * 0.9), r.id).toBeGreaterThan(cost);
      expect(freeCookCoins(r, 0), r.id).toBeGreaterThan(cost);
      expect(freeCookCoins(r, 0)).toBeLessThan(freeCookCoins(r, 1));
      expect(freeCookCoins(r, 1)).toBeLessThan(freeCookCoins(r, 2));
    }
  });
  it('leaves saved orders at their agreed reward and settles once', () => {
    game.save.orders = [{ uid: 101, recipe: 'california', customer: 'c_student', reward: 25 }];
    const before = game.coins;
    const bill = serveOrder(101, 0, 0, { rng: () => 1 });
    expect(bill!.coins).toBe(25); expect(game.coins).toBe(before + 25);
    expect(serveOrder(101, 0)).toBeNull();
  });
  it('unlocks level two in five perfect kappa orders and cannot bypass level gates', () => {
    expect(buyUpgrade('tables2')).toBe(false);
    for (let i = 0; i < 5; i++) {
      game.save.orders.push({ uid: i + 1, recipe: 'kappa', customer: 'c_student', reward: 16 });
      serveOrder(i + 1, 2, 0, { rng: () => 1 });
    }
    expect(game.save.restaurant.level).toBe(2);
    expect(game.save.recipesKnown).toContain('california');
    game.addCoins(300); const before = game.coins;
    expect(buyUpgrade('tables2')).toBe(true); expect(game.coins).toBe(before - 300);
    expect(buyUpgrade('tables2')).toBe(false);
    addRestaurantXp(100000); unlockLevelRecipes();
    expect(game.save.restaurant.level).toBe(BALANCE.maxRestaurantLevel);
    expect(game.save.recipesKnown).not.toContain('three_stars');
  });
  it('charges an upgrade once when a synchronous wallet listener tries buying it again', () => {
    game.save.restaurant.level = 2; game.save.coins = 1000;
    let reentered = false;
    const off = bus.on('coins:changed', () => {
      if (reentered) return;
      reentered = true;
      expect(buyUpgrade('tables2')).toBe(false);
    });
    try { expect(buyUpgrade('tables2')).toBe(true); } finally { off(); }
    expect(game.coins).toBe(700);
    expect(game.save.restaurant.upgrades.filter(id => id === 'tables2')).toHaveLength(1);
  });
});

describe('collection, projects and reward compatibility', () => {
  it('persists records, variants and earned plates without downgrading a best score', () => {
    for (let i = 0; i < 6; i++) recordMastery('kappa', 2);
    recordRecipeResult('kappa', { score: 95, quality: 2, variantItem: 'sesame' });
    recordRecipeResult('kappa', { score: 70, quality: 1, variantItem: 'sesame' });
    expect(selectRecipePresentation('kappa', 'gold')).toBe(false);
    expect(selectRecipePresentation('kappa', 'sakura')).toBe(true);
    roundTrip(); expect(recipePresentation('kappa')).toBe('sakura');
    expect(game.save.recipeRecords!.kappa).toMatchObject({ bestScore: 95, bestQuality: 2, variants: { sesame: { count: 2, bestScore: 95 } } });
    const old = JSON.parse(JSON.stringify(newSave())); delete old.recipeRecords;
    expect(validateSave(old).recipeRecords).toEqual({});
  });
  it('starts collaboration from current counters and rejects stale/reentrant construction', () => {
    game.save.restaurant.level = 4; game.addCoins(2000); game.addItem('wood', 10); game.addItem('ginger', 5);
    game.setFlag('proj_plaza_garden_1'); game.setFlag('proj_plaza_garden_2');
    for (let i = 0; i < 8; i++) recordMastery('kappa', 2);
    expect(startProjectPhase('plaza_garden', 2)).toBe(true);
    expect(phaseStatus('plaza_garden')[2].activity!.progress).toBe(0);
    expect(buildNextPhase('plaza_garden', 2)).toBe(false);
    for (let i = 0; i < 4; i++) recordMastery('kappa', 2);
    const off = bus.on('coins:changed', () => expect(buildNextPhase('plaza_garden', 2)).toBe(false));
    try { expect(buildNextPhase('plaza_garden', 2)).toBe(true); } finally { off(); }
    const coins = game.coins;
    expect(buildNextPhase('plaza_garden', 2)).toBe(false); expect(game.coins).toBe(coins);
  });
  it('preserves old crops and makes restored supplies daily and persistent', () => {
    const crop = { plot: 0, seed: 'sd_cucumber', plantedDay: 1, watered: 1, ready: false };
    game.save.garden[0] = crop; game.setFlag('proj_garden_lanterns_4');
    expect(applyProjectBenefits()).toBe(true); expect(applyProjectBenefits()).toBe(false);
    expect(game.save.garden).toHaveLength(8); expect(game.save.garden[0]).toEqual(crop);
    game.setFlag('proj_plaza_garden_1'); game.setFlag('proj_plaza_garden_2'); game.setFlag('proj_plaza_garden_3');
    expect(claimProjectSupplies('tea_table')).toEqual({ ginger: 2, g_candy: 1 });
    roundTrip(); expect(claimProjectSupplies('tea_table')).toBeNull();
    game.save.time.day++; expect(claimProjectSupplies('tea_table')).not.toBeNull();
  });
  it('archives completed rewards across midnight, pays exact rewards once and blocks reentrancy', () => {
    const e: Errand = { id: 'regression', kind: 'gather', base: 0, goal: 2, coins: 40, claimed: false, rewards: { items: { rice: 2 }, friendship: { who: 'taro', points: 3 } } };
    game.save.flags.daily_state = JSON.stringify({ day: 1, week: 0, daily: [e], weekly: [], pending: [] });
    game.stat('gathered', 2); game.save.time.day = 2;
    expect(ensureDaily().pending!.map(e => e.id)).toContain('regression');
    const coins = game.coins, rice = game.count('rice');
    const off = bus.on('inventory:changed', () => expect(claimErrandReward(e.id)).toBeNull());
    try { expect(claimErrandReward(e.id)).toMatchObject({ coins: 40 }); } finally { off(); }
    expect(game.coins).toBe(coins + 40); expect(game.count('rice')).toBe(rice + 2);
    roundTrip(); expect(claimErrandReward(e.id)).toBeNull();
  });
  it('does not consume an incomplete delivery or reroll an older saved reward', () => {
    const e: Errand = { id: 'old_delivery', kind: 'deliver', target: 'stone', goal: 3, base: 0, coins: 77, claimed: false };
    game.save.flags.daily_state = JSON.stringify({ day: 1, week: 0, daily: [e], weekly: [] });
    game.addItem('stone', 2); expect(claimErrandReward(e.id)).toBeNull(); expect(game.count('stone')).toBe(2);
    roundTrip(); expect(ensureDaily().daily[0].coins).toBe(77);
    game.addItem('stone', 1); expect(claimErrandReward(e.id)).toMatchObject({ coins: 77 }); expect(game.count('stone')).toBe(0);
  });
});
