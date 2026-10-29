import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { NEIGHBORS, NEIGHBOR_BY_ID } from '../data/neighbors';
import { orderForCustomer, customerName } from '../restaurant/orders';
import {
  customerOf, demandFactor, dueVisit, emptyClients, favouriteOf, takeOccasion, OCCASION_GIFTS, inviteResponse, recordMeal, recordVisit, regularDropIn, rememberedDish,
  type DemandContext, type InviteContext,
} from '../restaurant/townClients';
import { inviteNeighbor, nextTownGuest, clients, noteTownLeft } from '../restaurant/townVisits';

const dem = (o: Partial<DemandContext> = {}): DemandContext => ({ period: 1, day: 3, rain: false, reputation: 0, charm: 0, festival: false, regulars: 0, ...o });
const inv = (o: Partial<InviteContext> = {}): InviteContext => ({ day: 4, period: 1, rain: false, mood: 0, alreadyToday: false, alreadyPlanned: false, ...o });
const never = () => false;

beforeEach(() => { game.load(newSave('T')); game.save.recipesKnown = ['onigiri', 'tamago', 'veggie_roll']; });

describe('demand', () => {
  it('rises in the evening, on weekends and with fame; falls in rain and stays bounded', () => {
    expect(demandFactor(dem({ period: 2 }))).toBeGreaterThan(demandFactor(dem({ period: 0 })));
    expect(demandFactor(dem({ rain: true }))).toBeLessThan(demandFactor(dem()));
    expect(demandFactor(dem({ day: 6 }))).toBeGreaterThan(demandFactor(dem({ day: 3 })));
    expect(demandFactor(dem({ reputation: 300, regulars: 5 }))).toBeGreaterThan(demandFactor(dem()));
    for (const f of [dem({ period: 0, rain: true, day: 1 }), dem({ period: 2, day: 6, reputation: 9999, charm: 999, festival: true, regulars: 99 })]) {
      const v = demandFactor(f); expect(v).toBeGreaterThanOrEqual(0.4); expect(v).toBeLessThanOrEqual(2.2);
    }
  });
});

describe('invitations', () => {
  it('depend on personality and memory, and never double-book', () => {
    const yes = (id: string, mood = 0) => { let n = 0; for (let d = 1; d <= 60; d++) if (inviteResponse(NEIGHBOR_BY_ID[id], inv({ day: d, mood })).answer !== 'no') n++; return n; };
    expect(yes('mika')).toBeGreaterThan(yes('haru'));           // sociable vs shy
    expect(yes('mika', -3)).toBeLessThan(yes('mika', 0));        // a bad memory hurts
    expect(inviteResponse(NEIGHBOR_BY_ID.mika, inv({ alreadyPlanned: true })).answer).toBe('yes');
    expect(inviteResponse(NEIGHBOR_BY_ID.mika, inv({ alreadyToday: true })).answer).toBe('no');
    const night = NEIGHBORS.find((n) => n.traits.includes('nocturnal'))!;
    const r = [...Array(40).keys()].map((d) => inviteResponse(night, inv({ day: d + 1, mood: 6 }))).find((x) => x.answer !== 'no')!;
    expect(r.period).toBe(3);
  });

  it('a yes becomes a planned visit that arrives once, when due, and survives a save round trip', () => {
    let r = inviteNeighbor('mika');
    for (let d = 0; r.answer === 'no' && d < 40; d++) { game.save.time.day++; r = inviteNeighbor('mika'); }
    expect(r.answer).not.toBe('no');
    const t = game.save.time;
    const copy = JSON.parse(JSON.stringify(game.save));
    game.load(copy);
    const plan = clients().planned[0];
    expect(plan.id).toBe('mika');
    game.save.time.period = Math.max(0, plan.period - 1);
    if (plan.period > 0) expect(dueVisit(clients(), t.day, plan.period - 1, never)).toBeNull();
    game.save.time.period = plan.period;
    expect(nextTownGuest(never, 0.99)).toBe(customerOf('mika'));
    expect(clients().planned).toHaveLength(0);
  });

  it('keeps a planned visit while that neighbour is already inside', () => {
    const s = emptyClients(); s.planned.push({ id: 'ren', day: 1, period: 0 });
    expect(dueVisit(s, 1, 2, (c) => c === customerOf('ren'))).toBeNull();
    expect(s.planned).toHaveLength(1);
  });
});

describe('regulars remember', () => {
  it('ask again for the dish they loved, and long waits sour them', () => {
    const s = emptyClients();
    recordVisit(s, customerOf('goro'), 1, true); recordVisit(s, customerOf('goro'), 2, true);
    recordMeal(s, customerOf('goro'), 'tamago', 2, false, 2);
    expect(rememberedDish(s, customerOf('goro'), ['onigiri', 'tamago'], 0.1)).toBe('tamago');
    expect(rememberedDish(s, customerOf('goro'), ['onigiri'], 0.1)).toBeNull();
    expect(regularDropIn(s, 5, 0.05, never)).toBe('goro');
    expect(regularDropIn(s, 5, 0.9, never)).toBeNull();
    for (let i = 0; i < 4; i++) recordMeal(s, customerOf('goro'), 'onigiri', 0, true, 5);
    expect(s.regulars.goro.mood).toBeLessThan(0);
    expect(regularDropIn(s, 9, 0.05, never)).toBeNull();
  });

  it('are named, drawn as neighbours, and their order uses the memory', () => {
    expect(customerName(customerOf('kai'))).toBe('Kai');
    recordMeal(clients(), customerOf('kai'), 'veggie_roll', 2, false, 1);
    const o = orderForCustomer(customerOf('kai'), () => 0.01)!;
    expect(o.recipe).toBe('veggie_roll');
    expect(o.customer).toBe('nb_kai');
  });
});

describe('a regular is recognised', () => {
  it('has a favourite only after a couple of good servings, and serving it again is flagged once it is known', () => {
    const s = emptyClients(), c = customerOf('goro');
    expect(recordMeal(s, c, 'tamago', 1, false, 1)).toBe(false);
    expect(favouriteOf(s, c)).toBeNull();
    expect(recordMeal(s, c, 'tamago', 2, false, 2)).toBe(false); // it becomes a favourite with this serving
    expect(favouriteOf(s, c)).toBe('tamago');
    expect(recordMeal(s, c, 'tamago', 1, false, 3)).toBe(true);
    expect(recordMeal(s, c, 'tamago', 0, false, 4)).toBe(false); // a bad plate is not celebrated
  });

  it('brings one thank-you gift on the 5th and the 10th happy visit, never twice, and keeps old saves working', () => {
    game.save.furnitureOwned = {};
    for (let d = 1; d <= 4; d++) { recordMeal(clients(), customerOf('kai'), 'veggie_roll', 2, false, d); expect(noteTownLeft(customerOf('kai'), true)).toBeNull(); }
    recordMeal(clients(), customerOf('kai'), 'veggie_roll', 2, false, 5);
    const gift = noteTownLeft(customerOf('kai'), true);
    expect(gift).toMatchObject({ id: 'kai', furniture: OCCASION_GIFTS.kai, visit: 5 });
    expect(game.save.furnitureOwned[OCCASION_GIFTS.kai]).toBe(1);
    expect(takeOccasion(clients(), customerOf('kai'))).toBeNull(); // same milestone: already given
    for (let d = 6; d <= 9; d++) { recordMeal(clients(), customerOf('kai'), 'veggie_roll', 2, false, d); expect(noteTownLeft(customerOf('kai'), true)).toBeNull(); }
    recordMeal(clients(), customerOf('kai'), 'veggie_roll', 2, false, 10);
    expect(noteTownLeft(customerOf('kai'), true)?.visit).toBe(10);
    expect(game.save.furnitureOwned[OCCASION_GIFTS.kai]).toBe(2);
    // an unhappy 5th visit gives nothing and a save without `gifted` is fine
    const s = emptyClients(); s.regulars.ren = { visits: 5, likes: {}, mood: 0, last: 1, waits: 0 };
    expect(takeOccasion(s, customerOf('ren'))).toBeNull();
  });
});
