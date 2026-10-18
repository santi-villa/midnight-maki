import { beforeEach, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { EXTRA_HOMES } from '../data/residentHomes';
import { residentHome, restHours, restPhase, sleepStop } from '../systems/residentSleep';
import { ensureDefaultDecor, buildZone } from '../world/zoneRuntime';
import { stopFor } from '../systems/npcs';
import { NeighborLife } from '../systems/neighbors';

beforeEach(() => { game.load(newSave('Sueño')); ensureDefaultDecor(); });

it('differentiates early workers and night owls, including after midnight and rainy evenings', () => {
  expect(restHours('bento', false).sleep).toBeLessThan(restHours('kumo', false).sleep || 1440);
  expect(restPhase('ren', 3, 30, false)).toBe('sleeping'); // 22:00
  expect(restPhase('fuyu', 3, 30, false)).toBe('awake');
  expect(restPhase('fuyu', 3, 150, false)).toBe('sleeping'); // 02:00
  expect(restPhase('fuyu', 0, 45, false)).toBe('sleeping'); // 09:00
  expect(restPhase('ren', 0, 45, false)).toBe('awake');
  expect(restPhase('momo', 2, 80, false)).toBe('awake'); // 20:40
  expect(restPhase('momo', 2, 80, true)).toBe('returning');
});

it('lets scripted placements and forced service take precedence over bedtime', () => {
  game.save.time.period = 3; game.save.time.minutes = 150;
  game.setFlag('at_taro', 'restaurant,7,10,talk');
  expect(stopFor('taro', 3)?.zone).toBe('restaurant');
  game.setFlag('at_taro', ''); game.setFlag('shop_force_taro');
  expect(stopFor('taro', 3)?.zone).toBe('shop_taro');
});

it('adds a reachable separate futon without moving old furniture or duplicating grants', () => {
  for (const id of Object.keys(EXTRA_HOMES)) {
    const stop = sleepStop(id, true)!;
    expect(stop.bed, id).toBeTruthy();
    const zone = buildZone(stop.zone), door = zone.def.doors[0];
    expect(zone.grid.isSolid(stop.x, stop.y), id).toBe(false);
    expect(zone.grid.path(door.x, door.y, stop.x, stop.y), id).not.toBeNull();
  }
  const old = JSON.stringify(game.save.decor);
  ensureDefaultDecor(); expect(JSON.stringify(game.save.decor)).toBe(old);
  expect(residentHome('momo')).toBe('house_garden_31_4');
  expect(residentHome('ren')).toBe('house_plaza_1_27');
});

it('resumes a returning restaurant visitor from their actual street position', () => {
  game.save.time.period = 3; game.save.time.minutes = 70;
  const life = new NeighborLife(); life.sync();
  life.hold('mame', true); life.release('mame', { zone: 'plaza', x: 43, y: 24 });
  life.sync();
  const trip = life.state.get('mame')!.trip;
  expect(trip.position).toEqual({ zone: 'plaza', x: 43, y: 24 });
  expect(trip.destination.zone).toBe('house_plaza_46_15');
  expect(trip.settled).toBe(false);
});
