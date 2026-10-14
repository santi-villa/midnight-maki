import { beforeEach, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { game, newSave } from '../core/state';
import { clock } from '../systems/time';
import { restaurantPhase } from '../systems/schedule';
import { realSecondsPerPeriodMinute } from '../systems/daytime';
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
  clock.tick(realSecondsPerPeriodMinute(game.save.time.period));
  expect(game.save.time.period).toBe(1);
  expect(formatHudTime(hudTime(game.save.time.period, game.save.time.minutes))).toBe('12:00');
  clock.pause(); const before = structuredClone(game.save.time);
  clock.tick(60); expect(game.save.time).toEqual(before);
  clock.resume(); clock.tick(realSecondsPerPeriodMinute(game.save.time.period));
  expect(game.save.time.minutes).toBe(1);
});
it('advances one displayed minute per real second in the morning and at night', () => {
  game.save.time.period = 0;
  game.save.time.minutes = 0;
  clock.tick(1);
  expect(formatHudTime(hudTime(0, game.save.time.minutes))).toBe('06:01');
  game.save.time.period = 2;
  game.save.time.minutes = 0;
  clock.tick(1);
  expect(formatHudTime(hudTime(2, game.save.time.minutes))).toBe('18:01');
  game.save.time.period = 3;
  game.save.time.minutes = 0;
  clock.tick(1);
  expect(formatHudTime(hudTime(3, game.save.time.minutes))).toBe('21:01');
  game.save.time.minutes = BALANCE.periodMinutes;
  clock.tick(1);
  expect(formatHudTime(hudTime(3, game.save.time.minutes))).toBe('00:01');
});
it('keeps the night clock moving past midnight and holds it before morning', () => {
  game.save.time.period = 3;
  game.save.time.minutes = BALANCE.periodMinutes;
  expect(formatHudTime(hudTime(3, game.save.time.minutes))).toBe('00:00');
  clock.tick(realSecondsPerPeriodMinute(3));
  expect(game.save.time.period).toBe(3);
  expect(formatHudTime(hudTime(3, game.save.time.minutes))).toBe('00:02');
  expect(restaurantPhase(3, game.save.time.minutes)).toBe('closed');
  clock.tick(10_000);
  expect(game.save.time.period).toBe(3);
  expect(formatHudTime(hudTime(3, game.save.time.minutes))).toBe('05:59');
  expect(restaurantPhase(3, game.save.time.minutes)).toBe('closed');
});
