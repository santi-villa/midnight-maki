import { beforeEach, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { game, newSave } from '../core/state';
import { clock } from '../systems/time';
import { formatHudTime, hudTime } from '../ui/hudClock';
beforeEach(() => { game.load(newSave()); clock.resetPause(); });

it.each([[0, 0, '06:00'], [0, 45, '09:00'], [1, 0, '12:00'], [1, 45, '15:00'], [2, 0, '18:00'], [2, 45, '19:30'], [3, 0, '21:00'], [3, 89.5, '23:59'], [3, 90, '00:00']])('formats period %i minute %f as %s', (period, minutes, label) => {
  expect(formatHudTime(hudTime(period as number, minutes as number))).toBe(label);
});
it('normalizes fractional, wrapped and invalid presentation values', () => {
  expect(formatHudTime(1439.9)).toBe('23:59');
  expect(formatHudTime(1440)).toBe('00:00');
  expect(formatHudTime(1441)).toBe('00:01');
  expect(formatHudTime(-1)).toBe('23:59');
  expect(formatHudTime(NaN)).toBe('00:00');
  expect(formatHudTime(hudTime(NaN, NaN))).toBe('06:00');
});
it('uses the existing period rollover and pause, without advancing a separate clock', () => {
  game.save.time.minutes = BALANCE.periodMinutes - 0.01;
  clock.tick(BALANCE.realSecondsPerGameMinute);
  expect(game.save.time.period).toBe(1);
  expect(formatHudTime(hudTime(game.save.time.period, game.save.time.minutes))).toBe('12:00');
  clock.pause(); const before = structuredClone(game.save.time);
  clock.tick(60); expect(game.save.time).toEqual(before);
  clock.resume(); clock.tick(BALANCE.realSecondsPerGameMinute);
  expect(game.save.time.minutes).toBe(1);
});
