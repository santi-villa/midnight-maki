/** Things that happen when a new day starts: weather, orders, garden growth, market nights, mail. */
import { giveStarterBundle } from '../restaurant/supplies';
import { seasonOf, weekday } from '../core/balance';
import { game } from '../core/state';
import { rng } from '../art/pixel';
import { clock } from './time';
import { refreshOrders } from '../restaurant/orders';
import { closeServiceForNight } from '../restaurant/service';
import { growGarden } from './garden';
import { eventToday } from './events';
import { ensureDaily } from '../quests/daily';

let installed = false;

export function installDaily() {
  if (installed) return;
  installed = true;
  clock.onNewDay((day) => {
    const r = rng(day * 7919 + 17);
    // weather: never on the first days, cozy rain sometimes
    const rain = day > 3 && r() < (seasonOf(day) === 0 ? 0.2 : 0.14);
    game.setFlag('weather', rain ? 'rain' : 'clear');
    // night market: Fridays and Saturdays once it has been discovered
    game.setFlag('market_night', weekday(day) === 4 || weekday(day) === 5);
    game.setFlag('market_open', false);
    growGarden(day, rain);
    closeServiceForNight();
    ensureDaily();
    refreshOrders(true);
    if (game.save.restaurant.upgrades.includes('pantry')) {
      game.addItem('rice', 3, 'pantry');
      game.addItem('nori', 3, 'pantry');
    }
    if (giveStarterBundle()) game.setFlag('starter_bundle', true);
    const ev = eventToday(day);
    game.setFlag('festival_today', ev ?? false);
    // daily friendship talk/gift limits reset implicitly via lastTalkDay/lastGiftDay
  });
  clock.onPeriod((p) => {
    // the market opens at night on market nights after it was discovered
    game.setFlag('market_open', p === 3 && ((((!!game.flag('market_night') || game.has('market_force')) && game.has('market_known'))) || game.flag('festival_today') === 'moon'));
    // Regular orders come from the dining room. Closing is checked against the
    // clock inside the service, because the night shift ends mid-period.
    if (p === 1 || p === 2) refreshOrders(false);
  });
}
