import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { bugsFor, seasonBugs } from '../systems/collect';

const NIGHT = ['b_moth', 'b_beetle', 'b_firefly', 'b_star'];

describe('bug seasons', () => {
  beforeEach(() => game.load(newSave()));

  it('filters the album insects by season without touching the capture list twice', () => {
    expect(seasonBugs(['b_sakura', 'b_ladybug', 'b_dragonfly'], 0)).toEqual(['b_sakura', 'b_ladybug', 'b_dragonfly']);
    expect(seasonBugs(['b_sakura', 'b_dragonfly', 'b_ladybug'], 2)).toEqual(['b_sakura', 'b_ladybug']);
    expect(seasonBugs(['b_blue', 'b_ladybug', 'b_firefly', 'b_moth', 'b_beetle', 'b_star'], 3)).toEqual(['b_firefly', 'b_moth', 'b_beetle', 'b_star']);
  });

  it('spawns dragonflies in summer, drops them in autumn, and keeps winter nights to moths, beetles and fireflies', () => {
    game.save.time.period = 1;
    let summer = false;
    for (let day = 15; day <= 28; day++) {
      game.save.time.day = day;
      if (bugsFor('garden').includes('b_dragonfly')) summer = true;
    }
    expect(summer).toBe(true);

    for (let day = 29; day <= 42; day++) {
      game.save.time.day = day;
      expect(bugsFor('garden')).not.toContain('b_dragonfly');
    }

    game.save.time.period = 3;
    game.save.time.day = 43;
    for (const id of bugsFor('forest')) expect(NIGHT).toContain(id);
    game.setFlag('star_butterfly');
    for (const id of bugsFor('garden')) expect(NIGHT).toContain(id);

    game.setFlag('weather', 'rain');
    expect(bugsFor('garden')).toEqual([]);
    expect(bugsFor('forest')).toEqual([]);
  });
});
