import { beforeEach, describe, expect, it } from 'vitest';
import { insectAt, musicFade, waveAt } from '../audio/coast';
import { game, newSave } from '../core/state';
import { gatherSpots, mushroomsUp } from '../systems/gather';
import { hopscotchOpen, scentLine, snowLevel, vendorPhase } from '../world/townAmbience';
import { buildVillage } from '../world/village';

beforeEach(() => { game.load(newSave('T')); });

describe('street schedules', () => {
  it('keeps hopscotch to dry afternoons and dusk', () => {
    expect(hopscotchOpen(0, false, 0)).toBe(false);
    expect(hopscotchOpen(1, false, 1)).toBe(true);
    expect(hopscotchOpen(2, false, 2)).toBe(true);
    expect(hopscotchOpen(3, false, 0)).toBe(false);
    expect(hopscotchOpen(1, true, 1)).toBe(false);
    expect(hopscotchOpen(1, false, 3)).toBe(false);
  });

  it('walks the vendor through the day and then off', () => {
    expect([0, 1, 2, 3].map(vendorPhase)).toEqual(['morning', 'afternoon', 'pack', 'off']);
  });
});

describe('snow and mushrooms', () => {
  it('builds winter cover in steps and melts it in the rain', () => {
    expect(snowLevel(15, false)).toBe(0);
    expect(snowLevel(43, false)).toBe(1);
    expect(snowLevel(50, false)).toBe(2);
    expect(snowLevel(53, false)).toBe(3);
    expect(snowLevel(53, true)).toBe(0);
  });

  it('adds one garden shiitake after rain, the same one on reload, and none in winter', () => {
    game.save.time.day = 10;
    game.setFlag('damp_day', 10);
    expect(mushroomsUp(10)).toBe(true);
    expect(mushroomsUp(11)).toBe(true);
    expect(mushroomsUp(12)).toBe(false);
    const a = gatherSpots('garden');
    const b = gatherSpots('garden');
    expect(b).toEqual(a);
    expect(a.filter((s) => s.item === 'shiitake' && s.idx >= 100)).toHaveLength(1);
    game.save.time.day = 43;
    expect(mushroomsUp(43)).toBe(false);
    expect(gatherSpots('garden').some((s) => s.idx >= 100)).toBe(false);
    expect(gatherSpots('forest').some((s) => s.idx >= 100)).toBe(false);
  });
});

describe('restaurant remarks', () => {
  it('stays quiet when the door is shut and does not repeat the last line', () => {
    expect(scentLine({ phase: 'closed', level: 5, reputation: 200, lights: true, rain: false, period: 1, dish: 'Onigiri', last: null, roll: 0.1 })).toBeNull();
    const first = scentLine({ phase: 'open', level: 1, reputation: 0, lights: false, rain: false, period: 1, dish: null, last: null, roll: 0 });
    const second = scentLine({ phase: 'open', level: 1, reputation: 0, lights: false, rain: false, period: 1, dish: null, last: first, roll: 0 });
    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('mentions a dish only when one was actually remembered', () => {
    const line = scentLine({ phase: 'open', level: 2, reputation: 10, lights: false, rain: false, period: 1, dish: 'Onigiri', last: null, roll: 0 });
    expect(line).toContain('Onigiri');
  });
});

describe('coast and crossings', () => {
  it('fades the sea inland and separates day insects from night ones', () => {
    expect(waveAt(10, 70)).toBe(1);
    expect(waveAt(10, 70)).toBeGreaterThan(waveAt(10, 20));
    expect(waveAt(50, 30)).toBe(0);
    expect(waveAt(50, 40)).toBe(0);
    expect(musicFade(true, null, false, null)).toBe(0.8);
    expect(musicFade(false, true, false, false)).toBe(1.15);
    expect(musicFade(true, true, true, false)).toBe(2.7);
    const trees = insectAt('plaza', 1, 0, false, true);
    const shore = insectAt('harbor', 1, 0, false, true);
    expect(trees.cicadas).toBeGreaterThan(shore.cicadas);
    expect(insectAt('plaza', 1, 3, false, true).crickets).toBeGreaterThan(0);
    expect(insectAt('plaza', 0, 0, false, true).cicadas).toBe(0);
    expect(insectAt('plaza', 1, 1, false, false)).toEqual({ cicadas: 0, crickets: 0 });
  });

  it('leaves a step in front of the lighthouse and keeps the quay mouths clear of carts', () => {
    const built = buildVillage(false);
    const door = built.def.doors.find((d) => d.to === 'lighthouse');
    expect(door).toBeTruthy();
    expect(built.grid.isSolid(door!.x, door!.y)).toBe(true);
    expect(built.grid.isSolid(door!.x, door!.y + 1)).toBe(false);
    for (const p of built.props) {
      if (p.key !== 'wharf_flower_cart' && p.key !== 'wharf_candy_cart') continue;
      const blocksApproach = p.x >= 51 && p.x <= 55 && p.y >= 57 && p.y <= 66;
      expect(blocksApproach, p.key).toBe(false);
    }
    const open = (x: number, y: number) => {
      if (built.grid.isSolid(x, y)) return false;
      if (built.def.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1)) return false;
      return 'gGcpsb'.includes(built.def.ground[y]?.[x] ?? '');
    };
    const courts = [{ x: 56, y: 38 }, { x: 51, y: 39 }, { x: 48, y: 33 }, { x: 62, y: 32 }];
    expect(courts.some((o) => [0, 1, 2, 3, 4, 5].every((i) => open(o.x, o.y + i)) && open(o.x - 1, o.y + 1) && open(o.x + 1, o.y + 2))).toBe(true);
    const spots = [{ x: 50, y: 33, cx: 1, cy: 0 }, { x: 62, y: 33, cx: -1, cy: 0 }, { x: 70, y: 44, cx: 0, cy: 1 }, { x: 40, y: 36, cx: 1, cy: 0 }];
    expect(spots.filter((s) => open(s.x, s.y) && open(s.x + s.cx, s.y + s.cy)).length).toBeGreaterThanOrEqual(2);
  });
});
