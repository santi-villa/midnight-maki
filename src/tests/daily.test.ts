import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { claimErrand, ensureDaily, isComplete, makeErrands, progressOf, seeded, weekOf } from '../quests/daily';
import { buildNextPhase, phaseStatus, projectDone, projectsDoneTotal, townCharm, visibleProjects } from '../restaurant/projects';
import { charm } from '../restaurant/orders';

beforeEach(() => {
  game.load(newSave('Tester'));
  game.setFlag('intro_done');
});

describe('daily errands', () => {
  it('are the same all day and change the next day', () => {
    const a = ensureDaily();
    const again = ensureDaily();
    expect(again.daily.map((e) => e.id)).toEqual(a.daily.map((e) => e.id));
    game.save.time.day = 2;
    const b = ensureDaily();
    expect(b.day).toBe(2);
    expect(b.daily.map((e) => e.id)).not.toEqual(a.daily.map((e) => e.id));
  });

  it('only offer what the player can already do', () => {
    const kinds = ensureDaily().daily.map((e) => e.kind);
    expect(kinds).not.toContain('fish');
    expect(kinds).not.toContain('harvest');
    expect(new Set(kinds).size).toBe(kinds.length);
    game.setFlag('unlock_beach');
    const open = makeErrands(1234, 20, false);
    expect(open.map((e) => e.kind)).toContain('fish');
  });

  it('count progress since they were handed out and pay once', () => {
    const e = ensureDaily().daily[0];
    expect(progressOf(e)).toBe(0);
    const key = { serve: 'served', good: 'goodServed', gift: 'gifts', gather: 'gathered', photo: 'photos', project: 'projectPhases' }[e.kind as string] ?? 'served';
    game.stat(key, e.goal);
    expect(isComplete(e)).toBe(true);
    const before = game.coins;
    expect(claimErrand(e.id)).toBe(e.coins);
    expect(game.coins).toBe(before + e.coins);
    expect(claimErrand(e.id)).toBe(0); // no second payment
  });

  it('keeps one weekly goal for seven days', () => {
    const w = ensureDaily().weekly[0];
    game.save.time.day = 7;
    expect(ensureDaily().weekly[0].id).toBe(w.id);
    game.save.time.day = 8;
    expect(weekOf(8)).toBe(1);
    expect(ensureDaily().weekly[0].id).not.toBe(w.id);
  });

  it('survives a broken saved value', () => {
    game.save.flags.daily_state = '{not json';
    expect(ensureDaily().daily.length).toBeGreaterThan(0);
    expect(seeded(5)()).toBe(seeded(5)());
  });
});

describe('town projects', () => {
  it('hide areas that are still closed', () => {
    const ids = visibleProjects().map((p) => p.id);
    expect(ids).toContain('plaza_garden');
    expect(ids).not.toContain('beach_corner');
    game.setFlag('unlock_beach');
    expect(visibleProjects().map((p) => p.id)).toContain('beach_corner');
  });

  it('charge coins and materials once, in order, and add charm', () => {
    expect(buildNextPhase('plaza_garden')).toBe(false); // nothing in the pocket yet
    expect(phaseStatus('plaza_garden')[0].missing.length).toBeGreaterThan(0);
    game.addCoins(2000, 'test');
    game.addItem('fl_daisy', 3);
    game.addItem('wood', 4);
    const c0 = charm();
    const coins = game.coins;
    expect(buildNextPhase('plaza_garden')).toBe(true);
    expect(game.coins).toBe(coins - 150);
    expect(game.count('fl_daisy')).toBe(0);
    expect(projectDone('plaza_garden')).toBe(1);
    expect(charm()).toBe(c0 + 2);
    expect(buildNextPhase('plaza_garden')).toBe(false); // needs restaurant level 2
    game.save.restaurant.level = 2;
    expect(buildNextPhase('plaza_garden')).toBe(true);
    expect(projectsDoneTotal()).toBe(2);
    expect(townCharm()).toBe(4);
    expect(buildNextPhase('plaza_garden')).toBe(false); // finished
  });
});

describe('restaurant stages', () => {
  it('follow the ten levels in four looks', async () => {
    const { stageForLevel } = await import('../restaurant/stages');
    expect([1, 2, 3, 4, 5, 7, 8, 10].map(stageForLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});
