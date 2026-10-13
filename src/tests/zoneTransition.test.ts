import { beforeEach, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { ZONES } from '../data/zones';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';
import { safeArrival, zoneTransitionKind } from '../world/zoneTransition';
beforeEach(() => { game.load(newSave()); ensureDefaultDecor(); });
it.each(['restaurant', 'shop_bento', 'shop_taro', 'shop_yuki', 'library', 'home', 'storage'])('uses shutters when entering or leaving %s', zone => {
  expect(zoneTransitionKind('plaza', zone)).toBe('doors');
  expect(zoneTransitionKind(zone, 'plaza')).toBe('doors');
});
it('retains fades between outdoor regions', () => {
  expect(zoneTransitionKind('plaza', 'beach')).toBe('fade');
  expect(zoneTransitionKind('forest', 'plaza')).toBe('fade');
});
it('keeps valid arrival coordinates and resolves blocked decorations without choosing an exit', () => {
  const zone = buildZone('restaurant', false);
  expect(safeArrival(zone, 8, 12)).toEqual({ x: 8, y: 12 });
  zone.grid.setSolid(8, 12, true);
  const moved = safeArrival(zone, 8, 12);
  expect(zone.grid.isSolid(moved.x, moved.y)).toBe(false);
  expect(zone.def.doors.some(d => d.x === moved.x && d.y === moved.y)).toBe(false);
  expect(() => safeArrival(zone, NaN, 12)).toThrow();
  expect(() => safeArrival(zone, -1, 12)).toThrow();
});
it('provides a free library entrance, exit and reachable reading spot', () => {
  const entrance = ZONES.plaza.doors.find(d => d.to === 'library')!;
  const lib = buildZone('library', false);
  expect(lib.grid.isSolid(entrance.tx, entrance.ty)).toBe(false);
  const reading = lib.def.interact.find(i => i.action === 'library')!;
  expect(lib.grid.path(entrance.tx, entrance.ty, reading.x, reading.y)).not.toBeNull();
  const exit = lib.def.doors[0];
  expect(buildZone('plaza', false).grid.isSolid(exit.tx, exit.ty)).toBe(false);
});
