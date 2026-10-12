import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave, SaveError } from '../persistence/validate';
import { Grid } from '../world/grid';

beforeEach(() => game.load(newSave('Test')));

describe('economy & inventory', () => {
  it('never lets coins go negative', () => {
    game.save.coins = 10;
    expect(game.spend(20)).toBe(false);
    expect(game.coins).toBe(10);
    expect(game.spend(10)).toBe(true);
    expect(game.coins).toBe(0);
    game.addCoins(-50);
    expect(game.coins).toBe(0);
  });

  it('adds and removes items atomically', () => {
    game.addItem('salmon', 2);
    expect(game.removeItem('salmon', 5)).toBe(false);
    expect(game.count('salmon')).toBe(4); // 2 starter + 2
    expect(game.removeItem('salmon', 4)).toBe(true);
    expect(game.count('salmon')).toBe(0);
    expect('salmon' in game.save.inventory).toBe(false);
  });

  it('consumes ingredients using fish aliases, all or nothing', () => {
    game.save.inventory = { rice: 1, f_salmon: 1 };
    expect(game.consumeIngredients({ rice: 1, salmon: 1, nori: 1 })).toBe(false);
    expect(game.count('rice')).toBe(1);
    expect(game.consumeIngredients({ rice: 1, salmon: 1 })).toBe(true);
    expect(game.count('f_salmon')).toBe(0);
  });

  it('runs one-time rewards only once', () => {
    let n = 0;
    game.once('reward', () => n++);
    game.once('reward', () => n++);
    expect(n).toBe(1);
  });
});

describe('friendship', () => {
  it('levels up and caps at 5', () => {
    expect(game.friendLevel('pip')).toBe(0);
    const up = game.addFriendship('pip', 120);
    expect(up).toBe(1);
    game.addFriendship('pip', 10_000);
    expect(game.friendLevel('pip')).toBe(5);
  });
});

describe('save validation', () => {
  it('accepts a fresh save and round-trips through JSON', () => {
    const s = validateSave(JSON.parse(JSON.stringify(newSave('Sofi'))));
    expect(s.player.name).toBe('Sofi');
  });

  it('rejects garbage', () => {
    expect(() => validateSave({ hola: 1 })).toThrow(SaveError);
    expect(() => validateSave('x')).toThrow(SaveError);
  });

  it('rejects saves from a newer version', () => {
    const s: any = newSave();
    s.version = 999;
    expect(() => validateSave(s)).toThrow(SaveError);
  });

  it('repairs invalid values and fills missing fields', () => {
    const s: any = newSave();
    s.coins = -30;
    s.inventory = { rice: -2, nori: 3.7, salmon: NaN };
    delete s.garden;
    delete s.photos;
    s.recipesKnown = ['kappa', 'kappa'];
    const v = validateSave(s);
    expect(v.coins).toBe(0);
    expect(v.inventory).toEqual({ nori: 3 });
    expect(v.garden.length).toBe(6);
    expect(v.photos).toEqual([]);
    expect(v.recipesKnown).toEqual(['kappa']);
  });

  it('keeps nextUid above existing furniture uids', () => {
    const s: any = newSave();
    s.decor = { dining: [{ uid: 50, id: 'chair_wood', x: 1, y: 1, rot: 0 }] };
    s.nextUid = 3;
    expect(validateSave(s).nextUid).toBe(51);
  });
});

describe('pathfinding', () => {
  it('finds a path around walls', () => {
    const g = new Grid(5, 5);
    for (let y = 0; y < 4; y++) g.setSolid(2, y, true);
    const p = g.path(0, 0, 4, 0)!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toEqual([4, 0]);
    expect(p.some(([x, y]) => x === 2 && y === 4)).toBe(true);
  });

  it('targets the nearest walkable tile when the goal is solid', () => {
    const g = new Grid(5, 5);
    g.setSolid(3, 3, true);
    const p = g.path(0, 0, 3, 3)!;
    const last = p[p.length - 1];
    expect(Math.abs(last[0] - 3) + Math.abs(last[1] - 3)).toBe(1);
  });

  it('returns null when unreachable', () => {
    const g = new Grid(5, 5);
    for (let y = 0; y < 5; y++) g.setSolid(2, y, true);
    expect(g.path(0, 0, 4, 4)).toBeNull();
    expect(g.reachableCount(0, 0)).toBe(10);
  });
});
