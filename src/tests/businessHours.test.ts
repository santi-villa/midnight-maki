import { beforeEach, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { dayMinutes } from '../systems/daytime';
import { formatHudTime, hudTime } from '../ui/hudClock';
import { shopGate, whereIs } from '../systems/npcs';
import { EARLY_HOURS, LATE_HOURS, SHOP_PLACES, restaurantPhase } from '../systems/schedule';
import { buildZone } from '../world/zoneRuntime';
beforeEach(() => {
  game.load(newSave()); game.save.time.day = 4; game.save.quests.done = ['prologue'];
  game.setFlag('intro_done'); game.setFlag('unlock_beach');
});
it.each([
  [0, 29.75, '07:59', false, false],
  [0, 30, '08:00', true, true],
  [1, 0, '12:00', true, true],
  [1, 89.75, '17:59', true, true],
  [2, 0, '18:00', true, true],
  [2, 59.5, '19:59', true, true],
  [2, 89.5, '20:59', false, true],
  [3, 20, '21:40', false, true],
  [3, 29.5, '21:59', false, true],
  [3, 40, '22:20', false, false],
  [3, 90, '00:00', false, false],
] as const)(
  'early and late businesses agree with the HUD at %s/%s (%s)', (period, minutes, text, early, late) => {
    game.save.time.period = period; game.save.time.minutes = minutes;
    expect(formatHudTime(dayMinutes(period, minutes))).toBe(text);
    expect(hudTime(period, minutes)).toBe(dayMinutes(period, minutes));
    expect(restaurantPhase(period, minutes) === 'open').toBe(late);
    for (const place of SHOP_PLACES) {
      const open = place.closeAt === EARLY_HOURS.closeAt ? early : late;
      expect(shopGate(place.id).open, place.id).toBe(open);
      expect(shopGate(place.id).hours).toBe(place.closeAt === EARLY_HOURS.closeAt ? EARLY_HOURS.hours : LATE_HOURS.hours);
      if (open && place.keeper) expect(whereIs(place.keeper), place.id).toBe(place.zone);
      if (place.counter) expect(buildZone(place.zone).grid.isSolid(place.counter.x, place.counter.y)).toBe(false);
    }
  });
it('keeps daytime counters attended in rain and festivals, and closes each one on its own hour', () => {
  game.setFlag('weather', 'rain'); game.setFlag('festival_today', 'flowers');
  game.save.time.period = 2; game.save.time.minutes = 40;
  for (const p of SHOP_PLACES) expect(shopGate(p.id).open, p.id).toBe(true);
  game.save.time.period = 3; game.save.time.minutes = 20;
  for (const p of SHOP_PLACES) expect(shopGate(p.id).open, p.id).toBe(p.closeAt === LATE_HOURS.closeAt);
  game.save.time.minutes = 70;
  for (const p of SHOP_PLACES) expect(shopGate(p.id).open, p.id).toBe(false);
});
it('preserves explicit narrative placements and closures', () => {
  game.save.time.period = 1; game.save.time.minutes = 30;
  game.setFlag('at_taro', 'plaza,13,15,talk');
  expect(whereIs('taro')).toBe('plaza'); expect(shopGate('taro').open).toBe(false);
  game.setFlag('shop_force_taro'); expect(shopGate('taro').open).toBe(true);
  game.setFlag('shop_shut_taro'); expect(shopGate('taro').open).toBe(false);
});
it('keeps the existing night market exception, including its conch stall', () => {
  game.save.player.zone = 'market'; game.save.time.period = 3; game.save.time.minutes = 70;
  for (const id of ['market_food', 'market_rare', 'market_clothes', 'market_furn', 'shells']) expect(shopGate(id).open, id).toBe(true);
  game.save.player.zone = 'beach'; expect(shopGate('shells').open).toBe(false);
  game.save.time.period = 1; expect(shopGate('market_food').open).toBe(false);
});
