/** In-game clock: four periods per day. Pauses during menus/dialogue; never penalizes absence. */
import { BALANCE, dayOfSeason, SEASONS, seasonOf, WEEKDAYS, weekday } from '../core/balance';
import { dayMinutes, realSecondsPerPeriodMinute } from './daytime';
import { addEnergy, drainFor } from './fatigue';
import { bus } from '../core/events';
import { game } from '../core/state';

type Hook = (day: number) => void;
const dayHooks: Hook[] = [];
const periodHooks: ((period: number) => void)[] = [];

let pauseCount = 0;

export const clock = {
  pause() {
    pauseCount++;
  },
  resume() {
    pauseCount = Math.max(0, pauseCount - 1);
  },
  get paused() {
    return pauseCount > 0;
  },
  resetPause() {
    pauseCount = 0;
  },

  onNewDay(fn: Hook) {
    dayHooks.push(fn);
  },
  onPeriod(fn: (p: number) => void) {
    periodHooks.push(fn);
  },

  /** advance by real seconds of exploration */
  tick(dt: number) {
    if (pauseCount > 0 || !game.loaded || !Number.isFinite(dt) || dt <= 0) return;
    const t = game.save.time;
    // One night period is 21:00–24:00. Three of those reach 06:00, which is the next morning.
    const cap = t.period === 3 ? BALANCE.periodMinutes * 3 - 0.05 : Number.POSITIVE_INFINITY;
    if (t.minutes >= cap) return;
    t.minutes += dt / realSecondsPerPeriodMinute(t.period);
    addEnergy(-drainFor(dt / BALANCE.realSecondsPerGameMinute, dayMinutes(t.period, t.minutes)));
    if (t.minutes >= BALANCE.periodMinutes && t.period < 3) this.advancePeriod();
    else if (t.minutes > cap) t.minutes = cap;
  },

  advancePeriod(): boolean {
    const t = game.save.time;
    if (t.period >= 3) return false;
    t.period++;
    t.minutes = 0;
    game.touch('period');
    for (const h of periodHooks) h(t.period);
    bus.emit('time:changed', { day: t.day, period: t.period });
    return true;
  },

  /** Sleep: go to the next morning */
  newDay() {
    const t = game.save.time;
    t.day++;
    t.period = 0;
    t.minutes = 0;
    game.touch('day');
    for (const h of dayHooks) {
      try {
        h(t.day);
      } catch (err) {
        console.error('[time] day hook failed', err);
      }
    }
    for (const h of periodHooks) h(0);
    bus.emit('time:changed', { day: t.day, period: 0 });
  },

  get period() {
    return game.save.time.period;
  },
  get day() {
    return game.save.time.day;
  },
  isNight() {
    return game.save.time.period === 3;
  },
  /** 0..1 progress within the current period (for smooth lighting) */
  progress() {
    return Math.min(1, game.save.time.minutes / BALANCE.periodMinutes);
  },
  label() {
    const t = game.save.time;
    return `${BALANCE.periodNames[t.period]}`;
  },
  dateLabel(day = game.save.time.day) {
    return `${WEEKDAYS[weekday(day)]} ${dayOfSeason(day)} de ${SEASONS[seasonOf(day)]}`;
  },
};
