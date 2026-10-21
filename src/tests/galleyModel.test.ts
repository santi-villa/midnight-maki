import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { ASSEMBLE_SECONDS, COOK, Galley, PLAYER, type GalleyEnv } from '../galley/model';
import { billOfMaterials, judgeDish, prepFor, recipesFor, type IngItem } from '../galley/prep';
import { cutLevel, cutSpec, indicatorAt, judgeCut } from '../galley/cut';
import { RECIPES_BY_ID } from '../data/recipes';

let stock: Record<string, number>;
let upgrades: string[];
let delivered: string[];
let accept = true;
let g: Galley;
const env = (): GalleyEnv => ({
  stock: { have: (id) => stock[id] ?? 0, take: (id) => { if ((stock[id] ?? 0) <= 0) return false; stock[id]--; return true; }, give: (id) => { stock[id] = (stock[id] ?? 0) + 1; } },
  upgrades: () => upgrades,
  rng: () => 0.5,
  known: () => true,
  deliver: (dish) => (accept ? (delivered.push(dish.kind === 'dish' ? dish.recipe : dish.drink), { ok: true }) : { ok: false, msg: 'Nadie pidió eso.' }),
});
beforeEach(() => {
  stock = { rice: 10, nori: 5, cucumber: 4, salmon: 3, egg: 2, sesame: 2, avocado: 2, crab: 1 };
  upgrades = []; delivered = []; accept = true;
  g = new Galley(env());
});

const take = (ing: string) => { const r = g.takeFromFridge(PLAYER, ing); expect(r.ok, r.msg).toBe(true); };
const act = (id: string, verb: Parameters<Galley['perform']>[2], who = PLAYER) => { const r = g.perform(who, id, verb); expect(r.ok, `${id} ${verb}: ${r.msg}`).toBe(true); return r; };
const cookRice = (n: number) => { for (let i = 0; i < n; i++) { take('rice'); act('rice', 'put'); } g.tick(COOK.rice.time + 0.1); };
const cut = (ing: string, verdict: 'perfect' | 'good' | 'regular' | 'fail', station = 'board_1') => {
  take(ing); const r = act(station, 'chop'); expect(r.needsCut).toBe(true);
  g.finishCut(station, verdict); act(station, 'take');
};

describe('rice straight from the stock', () => {
  it('scoops real stock into the cooker without hands, starts it, and stops when the cooker is full or the stock is out', () => {
    expect(g.verbs(PLAYER, 'rice')).toContain('scoop');
    act('rice', 'scoop');
    expect(g.verbs(PLAYER, 'rice')[0]).toBe('scoop'); // while loading, adding comes before taking it back
    expect(stock.rice).toBe(9);
    expect(g.station('rice').phase).toBe('cooking');
    expect(g.held(PLAYER)).toHaveLength(0);
    for (let i = 0; i < 3; i++) act('rice', 'scoop');
    expect(g.verbs(PLAYER, 'rice')).not.toContain('scoop'); // 4 portions: full
    g.tick(COOK.rice.time + 0.1);
    expect(g.verbs(PLAYER, 'rice')).not.toContain('scoop'); // done: take it out first
    for (let i = 0; i < 4; i++) { act('rice', 'take'); act('hangiri', 'put'); }
    expect(g.verbs(PLAYER, 'rice')).toContain('scoop'); // emptied: the next batch can be loaded again
    stock = { ...stock, rice: 0 };
    expect(g.verbs(PLAYER, 'rice')).not.toContain('scoop'); // nothing left to scoop
  });
  it('does not consume anything when it cannot scoop', () => {
    stock.rice = 0;
    expect(g.perform(PLAYER, 'rice', 'scoop').ok).toBe(false);
    expect(g.station('rice').items).toHaveLength(0);
  });
});

describe('fridge and hands', () => {
  it('takes real stock, one thing at a time, and gives it back', () => {
    take('salmon');
    expect(stock.salmon).toBe(2);
    expect(g.takeFromFridge(PLAYER, 'cucumber').ok).toBe(false);
    expect(g.verbs(PLAYER, 'fridge')).toEqual(['return']);
    act('fridge', 'return');
    expect(stock.salmon).toBe(3);
    expect(g.held(PLAYER)).toHaveLength(0);
  });

  it('says there is none left instead of inventing ingredients', () => {
    stock.crab = 0;
    const r = g.takeFromFridge(PLAYER, 'crab');
    expect(r.ok).toBe(false);
    expect(g.held(PLAYER)).toHaveLength(0);
  });

  it('carries two things with the pockets upgrade, one otherwise, and employees always one', () => {
    take('rice');
    expect(g.takeFromFridge(PLAYER, 'nori').ok).toBe(false);
    upgrades = ['galley_hands'];
    take('nori');
    expect(g.held(PLAYER)).toHaveLength(2);
    expect(g.capacity('emp1')).toBe(1);
  });
});

describe('work surfaces', () => {
  it('keep what is put on them, exactly, and give it back in reverse order', () => {
    take('salmon'); act('counter_a', 'put');
    take('cucumber'); act('counter_a', 'put');
    expect(g.station('counter_a').items.map((i) => (i as IngItem).ing)).toEqual(['salmon', 'cucumber']);
    take('nori');
    expect(g.verbs(PLAYER, 'counter_a')).not.toContain('put'); // full
    act('counter_b', 'put');
    act('counter_a', 'take');
    expect((g.held(PLAYER)[0] as IngItem).ing).toBe('cucumber');
    expect(g.station('counter_a').items).toHaveLength(1);
  });

  it('never duplicates or loses an item across put and take', () => {
    take('salmon');
    const uid = g.held(PLAYER)[0].uid;
    act('counter_a', 'put'); act('counter_a', 'take');
    act('counter_b', 'put'); act('counter_b', 'take');
    expect(g.held(PLAYER)).toHaveLength(1);
    expect(g.held(PLAYER)[0].uid).toBe(uid);
    expect(g.snapshot().st.counter_a?.items ?? []).toHaveLength(0);
  });

  it('keeps the hangiri for cooked rice only', () => {
    take('rice');
    expect(g.perform(PLAYER, 'hangiri', 'put').ok).toBe(false);
    act('counter_a', 'put');
    cookRice(1);
    act('rice', 'take');
    act('hangiri', 'put');
    expect(g.station('hangiri').items).toHaveLength(1);
  });

  it('treats a locked station spot as a plain counter until the upgrade is owned', () => {
    expect(g.kind('board_2')).toBe('counter');
    take('salmon'); act('board_2', 'put'); // sits there, no cut
    expect(g.station('board_2').pending).toBe(false);
    act('board_2', 'take');
    upgrades = ['board2'];
    expect(g.kind('board_2')).toBe('board');
    expect(g.verbs(PLAYER, 'board_2')).toContain('chop');
  });
});

describe('rice cooker', () => {
  it('cooks a batch, waits for the player, and hands out one portion at a time', () => {
    for (let i = 0; i < 4; i++) { take('rice'); act('rice', 'put'); }
    take('rice');
    expect(g.perform(PLAYER, 'rice', 'put').ok).toBe(false); // capacity 4
    act('counter_a', 'put');
   
    expect(g.busy('rice')).toBe(true); // it started by itself with the first portion
    expect(g.verbs(PLAYER, 'rice')).toEqual(['take']); // still loading: a change of mind is allowed
    g.tick(COOK.rice.grace + 0.5);
    expect(g.verbs(PLAYER, 'rice')).toEqual([]);
    g.tick(COOK.rice.time - COOK.rice.grace - 1.5);
    expect(g.progress('rice')).toBeGreaterThan(0.9);
    const ev = g.tick(2);
    expect(ev.some((e) => e.t === 'ready')).toBe(true);
    expect(g.station('rice').items.every((i) => i.kind === 'ing' && i.form === 'cooked' && i.q === 3)).toBe(true);
    act('rice', 'take');
    expect(g.station('rice').items).toHaveLength(3);
    expect(g.verbs(PLAYER, 'rice')).not.toContain('take'); // hands full
  });

  it('goes past, and eventually burns what is left', () => {
    cookRice(2);
    g.tick(COOK.rice.over1);
    expect(g.station('rice').items.every((i) => (i as IngItem).q === 2)).toBe(true);
    g.tick(COOK.rice.over2 - COOK.rice.over1);
    expect(g.station('rice').items.every((i) => (i as IngItem).q === 1)).toBe(true);
    const ev = g.tick(COOK.rice.burn);
    expect(ev.some((e) => e.t === 'burnt')).toBe(true);
    expect(g.station('rice').items).toHaveLength(0);
    expect(g.station('rice').phase).toBe('idle');
  });

  it('holds six portions with the big cooker', () => {
    upgrades = ['rice_big'];
    expect(g.slots('rice')).toBe(6);
  });

  it('lets you take the raw rice back before starting', () => {
    take('rice'); act('rice', 'put');
    act('rice', 'take');
    expect(g.held(PLAYER)).toHaveLength(1);
  });

  it('cooks eggs on the stove, and only what needs the stove', () => {
    take('salmon');
    expect(g.perform(PLAYER, 'stove', 'put').ok).toBe(false);
    act('counter_a', 'put');
    take('egg'); act('stove', 'put');
    g.tick(COOK.stove.time + 0.1);
    act('stove', 'take');
    expect(g.held(PLAYER)[0]).toMatchObject({ ing: 'egg', form: 'cooked', q: 3 });
  });
});

describe('cutting board', () => {
  it('cuts what is cuttable and grades it', () => {
    take('salmon');
    const r = act('board_1', 'chop');
    expect(r.needsCut).toBe(true);
    expect(g.pendingCut).toBe('board_1');
    expect(g.verbs(PLAYER, 'board_1')).toEqual(['chop']); // resume
    const done = g.finishCut('board_1', 'perfect');
    expect(done.events[0]).toMatchObject({ t: 'cut', verdict: 'perfect' });
    expect(g.pendingCut).toBeNull();
    act('board_1', 'take');
    expect(g.held(PLAYER)[0]).toMatchObject({ ing: 'salmon', form: 'cut', q: 3 });
  });

  it('refuses what is not cut on a board', () => {
    take('rice');
    expect(g.perform(PLAYER, 'board_1', 'chop').ok).toBe(false);
    act('counter_a', 'put');
    take('nori');
    expect(g.perform(PLAYER, 'board_1', 'chop').ok).toBe(false);
  });

  it('cooked eggs are cut into cooked_cut, ready for the tamago nigiri', () => {
    take('egg'); act('stove', 'put'); g.tick(COOK.stove.time + 0.1); act('stove', 'take');
    act('board_1', 'chop'); g.finishCut('board_1', 'good'); act('board_1', 'take');
    expect(g.held(PLAYER)[0]).toMatchObject({ ing: 'egg', form: 'cooked_cut', q: 2 });
  });

  it('does not let a cut be finished twice', () => {
    take('salmon'); act('board_1', 'chop'); g.finishCut('board_1', 'good');
    expect(g.finishCut('board_1', 'perfect').ok).toBe(false);
  });
});

describe('assembly and the pass', () => {
  const makeKappa = (grade: 'perfect' | 'good' | 'regular' | 'fail') => {
    cookRice(1);
    act('rice', 'take'); act('assembly', 'put');
    take('nori'); act('assembly', 'put');
    cut('cucumber', grade);
    act('assembly', 'put');
  };

  it('recognises the recipe from what is on the table and builds it in a moment', () => {
    makeKappa('perfect');
    expect(g.preview().map((m) => m.recipe.id)).toEqual(['kappa']);
    act('assembly', 'assemble');
    expect(g.busy('assembly')).toBe(true);
    expect(g.verbs(PLAYER, 'assembly')).toEqual([]);
    g.tick(ASSEMBLE_SECONDS + 0.01);
    const dish = g.station('assembly').items[0];
    expect(dish).toMatchObject({ kind: 'dish', recipe: 'kappa', dq: 2 });
    expect(g.station('assembly').items).toHaveLength(1); // the pieces became the dish, nothing is left over
  });

  it('a ruined piece caps the dish at acceptable; regular cuts make it good, not perfect', () => {
    makeKappa('fail'); act('assembly', 'assemble'); g.tick(2);
    expect((g.station('assembly').items[0] as { dq: number }).dq).toBe(0);
    act('assembly', 'take'); act('bin', 'trash');
    makeKappa('regular'); act('assembly', 'assemble'); g.tick(2);
    expect((g.station('assembly').items[0] as { dq: number }).dq).toBe(1);
  });

  it('bamboo makes the assembly quicker', () => {
    upgrades = ['bamboo'];
    makeKappa('good'); act('assembly', 'assemble');
    g.tick(ASSEMBLE_SECONDS * 0.7 + 0.01);
    expect(g.station('assembly').items[0].kind).toBe('dish');
  });

  it('says nothing is made while the pieces do not add up', () => {
    take('nori'); act('assembly', 'put');
    expect(g.preview()).toEqual([]);
    expect(g.verbs(PLAYER, 'assembly')).not.toContain('assemble');
  });

  it('delivers a dish through the pass and refuses it when nobody asked for it', () => {
    makeKappa('good'); act('assembly', 'assemble'); g.tick(2);
    act('assembly', 'take');
    accept = false;
    const no = g.perform(PLAYER, 'pass', 'deliver');
    expect(no.ok).toBe(false);
    expect(g.held(PLAYER)).toHaveLength(1); // still in the hands
    accept = true;
    act('pass', 'deliver');
    expect(delivered).toEqual(['kappa']);
    expect(g.held(PLAYER)).toHaveLength(0);
  });

  it('the bin takes whatever is in the hands', () => {
    take('salmon'); act('bin', 'trash');
    expect(g.held(PLAYER)).toHaveLength(0);
    expect(stock.salmon).toBe(2); // wasted, not refunded
  });
});

describe('saving', () => {
  it('survives a round trip with hands, cookers, the board and the assembly intact', () => {
    take('rice'); act('rice', 'put'); g.tick(5);
    take('salmon'); act('board_1', 'chop');
    take('nori'); act('assembly', 'put');
    take('cucumber');
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const g2 = new Galley(env());
    g2.restore(snap);
    expect(g2.station('rice')).toMatchObject({ phase: 'cooking' });
    expect(g2.progress('rice')).toBeCloseTo(5 / COOK.rice.time, 3);
    expect(g2.pendingCut).toBe('board_1');
    expect(g2.station('assembly').items).toHaveLength(1);
    expect(g2.held(PLAYER)).toHaveLength(1);
    // new items never reuse an id
    g2.takeFromFridge(PLAYER, 'egg'); // hands full: refused
    act('counter_a', 'put');
    const ids = new Set<number>();
    for (const s of ['rice', 'board_1', 'assembly', 'counter_a']) for (const i of g2.station(s).items) { expect(ids.has(i.uid)).toBe(false); ids.add(i.uid); }
  });

  it('ignores damaged saves and drops unknown items', () => {
    g.restore(undefined);
    g.restore({ v: 1, nextUid: 5, hands: { player: [{ kind: 'ing', uid: 1, ing: 'does_not_exist', form: 'raw', q: 2 } as never] }, st: { rice: { items: [{ kind: 'dish', uid: 2, recipe: 'nope', dq: 1, bonus: 0 } as never], phase: 'cooking', t: 3 } } });
    expect(g.held(PLAYER)).toHaveLength(0);
    expect(g.station('rice').phase).toBe('idle'); // a cooker with nothing in it cannot be cooking
  });
});

describe('recipes in the physical kitchen', () => {
  const piece = (ing: string, form: IngItem['form'], q: IngItem['q'] = 3, uid = 0): IngItem => ({ kind: 'ing', uid, ing, form, q });

  it('every recipe can be built from its own bill of materials', () => {
    for (const r of RECIPES) {
      const pieces: IngItem[] = [];
      for (const n of billOfMaterials(r)) for (let i = 0; i < n.count; i++) pieces.push(piece(n.ing, n.form));
      const ids = recipesFor(pieces).map((m) => m.recipe.id);
      expect(ids, r.id).toContain(r.id);
    }
  });

  it('rice is always cooked, fish and vegetables are cut, and the recipe steps that cook come out cooked', () => {
    expect(prepFor(RECIPES_BY_ID.kappa, 'rice')).toBe('cook');
    expect(prepFor(RECIPES_BY_ID.kappa, 'cucumber')).toBe('cut');
    expect(prepFor(RECIPES_BY_ID.kappa, 'nori')).toBe('none');
    expect(prepFor(RECIPES_BY_ID.tamago, 'egg')).toBe('cook_cut');
    expect(prepFor(RECIPES_BY_ID.ebi, 'shrimp')).toBe('cook_cut');
    expect(prepFor(RECIPES_BY_ID.dragon, 'eel')).toBe('cook_cut');
    expect(prepFor(RECIPES_BY_ID.california, 'sesame')).toBe('none');
  });

  it('a variant ingredient on the table is accepted and named; anything else makes it fail', () => {
    const base = [piece('rice', 'cooked'), piece('nori', 'raw'), piece('cucumber', 'cut')];
    expect(recipesFor([...base, piece('sesame', 'raw')]).find((m) => m.recipe.id === 'kappa')?.variant?.item).toBe('sesame');
    expect(recipesFor([...base, piece('salmon', 'cut')]).find((m) => m.recipe.id === 'kappa')).toBeUndefined();
    expect(recipesFor([piece('rice', 'raw'), piece('nori', 'raw'), piece('cucumber', 'cut')])).toEqual([]); // raw rice is not rice
  });

  it('grades a dish from its parts', () => {
    const r = RECIPES_BY_ID.kappa;
    expect(judgeDish(r, [piece('rice', 'cooked', 3), piece('cucumber', 'cut', 3)])).toBe(2);
    expect(judgeDish(r, [piece('rice', 'cooked', 3), piece('cucumber', 'cut', 2)])).toBe(2); // 2.5
    expect(judgeDish(r, [piece('rice', 'cooked', 2), piece('cucumber', 'cut', 2)])).toBe(1);
    expect(judgeDish(r, [piece('rice', 'cooked', 1), piece('cucumber', 'cut', 1)])).toBe(0);
    expect(judgeDish(r, [piece('rice', 'cooked', 3), piece('cucumber', 'cut', 0)])).toBe(0);
  });
});

describe('the reflex bar', () => {
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  it('the indicator bounces end to end', () => {
    expect(indicatorAt(0, 1)).toBe(0);
    expect(indicatorAt(1, 1)).toBeCloseTo(1);
    expect(indicatorAt(1.5, 1)).toBeCloseTo(0.5);
    expect(indicatorAt(2, 1)).toBeCloseTo(0);
    for (let t = 0; t < 7; t += 0.13) { const p = indicatorAt(t, 1.3); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });

  it('the zone always fits on the bar, moves every time, and shrinks with difficulty', () => {
    let prev: number | undefined;
    for (let i = 0; i < 200; i++) {
      const s = cutSpec({ level: 0.5, knife: false }, rng, prev);
      expect(s.start).toBeGreaterThanOrEqual(0.03);
      expect(s.start + s.width).toBeLessThanOrEqual(0.99);
      if (prev !== undefined) expect(Math.abs(s.start - prev)).toBeGreaterThanOrEqual(0.18);
      prev = s.start;
    }
    expect(cutSpec({ level: 1, knife: false }, () => 0.5).width).toBeLessThan(cutSpec({ level: 0, knife: false }, () => 0.5).width);
    expect(cutSpec({ level: 0.5, knife: true }, () => 0.5).width).toBeGreaterThan(cutSpec({ level: 0.5, knife: false }, () => 0.5).width);
  });

  it('judges perfect in the middle, good in the zone, regular just outside and fail far away', () => {
    const spec = { start: 0.4, width: 0.2, speed: 1, limit: 3 };
    expect(judgeCut(0.5, spec)).toBe('perfect');
    expect(judgeCut(0.42, spec)).toBe('good');
    expect(judgeCut(0.35, spec)).toBe('regular');
    expect(judgeCut(0.9, spec)).toBe('fail');
  });

  it('is harder in challenge mode and a bit busier at noon and at night', () => {
    expect(cutLevel('challenge', 1)).toBeGreaterThan(cutLevel('normal', 1));
    expect(cutLevel('normal', 1)).toBeGreaterThan(cutLevel('relaxed', 1));
    expect(cutLevel('normal', 0)).toBeGreaterThan(cutLevel('normal', 1));
  });
});

describe('Spicy in the kitchen', () => {
  const ctx = (ups: string[], wanted: { ing: string; form: 'cut'; count: number }[] = []) => ({ stock: (id: string) => stock[id] ?? 0, ups, wanted });
  const run = async (until: () => boolean, ups: string[], wanted: { ing: string; form: 'cut'; count: number }[] = []) => {
    const { HANDS, CUT_SECONDS } = await import('../galley/crew');
    const who = 'hand:spicy';
    let guard = 0;
    while (!until() && guard++ < 300) {
      const step = HANDS.spicy.next(g, who, ctx(ups, wanted));
      if (!step) { g.tick(COOK.rice.time + 0.1); continue; }
      const r = step.verb === 'fetch' ? g.takeFromFridge(who, step.arg!) : g.perform(who, step.station, step.verb);
      expect(r.ok, `${step.station} ${step.verb}: ${r.msg}`).toBe(true);
      if (r.needsCut) { g.tick(CUT_SECONDS); g.finishCut(step.station, 'good'); }
    }
    return who;
  };
  it('keeps the hangiri stocked with cooked rice', async () => {
    const who = await run(() => g.station('hangiri').items.length >= 4, ['rice_hand']);
    expect(g.station('hangiri').items.length).toBe(4);
    expect(g.held(who)).toEqual([]);
    expect(stock.rice).toBe(6);
    const { HANDS } = await import('../galley/crew');
    expect(HANDS.spicy.next(g, who, ctx(['rice_hand']))).toBeNull(); // reserve is full: he rests
  });
  it('cuts what the tickets need once he has the cutting upgrade, and leaves it on a counter', async () => {
    await run(() => g.station('counter_a').items.length >= 2, ['cut_hand'], [{ ing: 'cucumber', form: 'cut', count: 2 }]);
    expect(g.station('counter_a').items.map((i) => (i.kind === 'ing' ? `${i.ing}:${i.form}` : i.kind))).toEqual(['cucumber:cut', 'cucumber:cut']);
    expect(stock.cucumber).toBe(2);
  });
  it('does nothing without his upgrades', async () => {
    const { handsFor } = await import('../galley/crew');
    expect(handsFor([])).toEqual([]);
    expect(handsFor(['cut_hand'])).toHaveLength(1);
  });
});

describe('drinks in the blender', () => {
  it('a glass plus the ingredients make the drink, which is taken by hand and handed over at the pass', () => {
    stock.milk = 2; stock.berry = 2;
    take('milk');
    expect(g.perform(PLAYER, 'cups', 'cup').ok).toBe(false); // hands are busy
    act('mixer', 'put');
    take('berry'); act('mixer', 'put');
    expect(g.busy('mixer')).toBe(false); // no glass yet
    act('cups', 'cup'); act('mixer', 'put');
    expect(g.busy('mixer')).toBe(true); // mixing started by itself
    expect(g.verbs(PLAYER, 'mixer')).toEqual([]);
    g.tick(5);
    expect(g.station('mixer').items.map((i) => i.kind)).toEqual(['drink']);
    act('mixer', 'take');
    expect(g.held(PLAYER)[0].kind).toBe('drink');
    act('pass', 'deliver');
    expect(delivered).toEqual(['strawberry_milk']);
    expect(stock.milk).toBe(1);
  });
  it('a wrong mix does not start', () => {
    stock.milk = 1;
    take('milk'); act('mixer', 'put'); act('cups', 'cup'); act('mixer', 'put');
    expect(g.drinkIn()).toBeNull();
  });
});

describe('cuts, hints and the lesson', () => {
  it('needs 5 cuts at first, fewer with better knives, and averages them', async () => {
    const { cutsNeeded, combineVerdicts } = await import('../galley/cut');
    expect(cutsNeeded([])).toBe(5);
    expect(cutsNeeded(['knife'])).toBe(4);
    expect(cutsNeeded(['knife', 'knife2'])).toBe(3);
    expect(combineVerdicts(['perfect', 'perfect', 'perfect', 'good', 'perfect'])).toBe('perfect');
    expect(combineVerdicts(['good', 'good', 'regular', 'good', 'good'])).toBe('good');
    expect(combineVerdicts(['fail', 'fail', 'regular', 'fail', 'fail'])).toBe('fail');
  });
  it('relaxed mode asks one cut fewer, never fewer than two, and knives still help', async () => {
    const { cutsNeeded, cutSpec } = await import('../galley/cut');
    expect(cutsNeeded([], 'relaxed')).toBe(4);
    expect(cutsNeeded(['knife'], 'relaxed')).toBe(3);
    expect(cutsNeeded(['knife', 'knife2'], 'relaxed')).toBe(2);
    expect(cutsNeeded(['knife', 'knife2'], 'challenge')).toBe(3);
    const wide = (knives: number) => cutSpec({ level: 0.5, knife: knives > 0, knives }, () => 0.5).width;
    expect(wide(2)).toBeGreaterThan(wide(1));
    expect(wide(1)).toBeGreaterThan(wide(0));
  });
  it('says what the assembly table is still missing', async () => {
    const { closestRecipe } = await import('../galley/prep');
    const piece = (ing: string, form: 'raw' | 'cooked' | 'cut'): IngItem => ({ kind: 'ing', uid: 1, ing, form, q: 2 });
    const near = closestRecipe([piece('rice', 'cooked'), piece('cucumber', 'cut')], (id) => id === 'kappa');
    expect(near?.recipe.id).toBe('kappa');
    expect(near?.ready).toBe(false);
    expect(near?.missing.map((n) => n.ing)).toEqual(['nori']);
    expect(closestRecipe([piece('rice', 'cooked'), piece('cucumber', 'cut'), piece('nori', 'raw')], (id) => id === 'kappa')?.ready).toBe(true);
    expect(closestRecipe([piece('salmon', 'raw')], (id) => id === 'kappa')).toBeNull();
  });
  it('the lesson only moves forward', async () => {
    const { tutorialStep, TUTORIAL } = await import('../galley/tutorial');
    const served = new Set<string>();
    expect(tutorialStep(0, { g, served })).toBe(0);
    take('rice');
    expect(tutorialStep(0, { g, served })).toBe(1);
    act('rice', 'put');
    expect(tutorialStep(1, { g, served })).toBe(2);
    expect(tutorialStep(TUTORIAL.length, { g, served })).toBe(TUTORIAL.length);
  });
  it('the arrow follows the work: fridge, then cooker, then the board', async () => {
    const { tutorialStation } = await import('../galley/tutorial');
    const served = new Set<string>();
    expect(tutorialStation(0, { g, served })).toBe('fridge');
    take('rice');
    expect(tutorialStation(1, { g, served })).toBe('rice');
    act('rice', 'put');
    g.tick(COOK.rice.time + 0.1);
    expect(tutorialStation(2, { g, served })).toBe('rice');
    act('rice', 'take');
    act('hangiri', 'put');
    expect(tutorialStation(3, { g, served })).toBe('fridge'); // the cucumber is still in the fridge
    take('cucumber');
    expect(tutorialStation(3, { g, served })).toBe('board_1');
    expect(tutorialStation(5, { g, served })).toBe('assembly');
    expect(tutorialStation(6, { g, served })).toBe('assembly'); // not carrying the dish yet: fetch it
  });
});
