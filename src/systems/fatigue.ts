/**
 * Tiredness: energy drains while awake (faster after midnight) and each dish costs a little.
 * Under the tired line she cannot cook; sleeping restores it by the hours slept. Pure helpers + a thin state layer.
 */
import { bus } from '../core/events';
import { game } from '../core/state';

export const MAX_ENERGY = 100;
/** below this she is too tired to cook */
export const TIRED_LIMIT = 15;
export const WARN_LIMIT = 30;
/** energy lost per game minute awake, and after midnight */
const DRAIN = 0.07;
const DRAIN_LATE = 0.1;
export const DISH_COST = 2;
export const REST_GAIN = 20;
export const SLEEP_GAIN_PER_HOUR = 14;
export const MIN_SLEEP = 4;
export const MAX_SLEEP = 10;
export const DEFAULT_SLEEP = 8;
/** the day always begins at 06:00; sleeping longer than the night allows means waking later */
const MORNING = 24 * 60 + 6 * 60;

export function drainFor(gameMinutes: number, dayMinute: number): number {
  if (!(gameMinutes > 0)) return 0;
  return gameMinutes * (dayMinute >= 24 * 60 ? DRAIN_LATE : DRAIN);
}

export function energyAfterSleep(before: number, hours: number): number {
  return Math.max(0, Math.min(MAX_ENERGY, before + Math.max(0, hours) * SLEEP_GAIN_PER_HOUR));
}

/** Waking plan for going to bed at `bedMinute` (minutes since the day started at 00:00; after midnight keeps counting) and sleeping `hours`. */
export function wakePlan(bedMinute: number, hours: number): { wakeMinute: number; sleptHours: number; lateMinutes: number } {
  const h = Math.max(MIN_SLEEP, Math.min(MAX_SLEEP, Math.round(hours)));
  const bed = bedMinute < 6 * 60 ? bedMinute + 24 * 60 : bedMinute; // a nap before dawn counts as the same night
  const wake = Math.max(MORNING, bed + h * 60);
  return { wakeMinute: wake, sleptHours: (wake - bed) / 60, lateMinutes: Math.min(wake - MORNING, 4 * 60) };
}

export function hhmm(minuteOfDay: number): string {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function getEnergy(): number {
  const e = game.save.player.energy;
  return typeof e === 'number' && Number.isFinite(e) ? Math.max(0, Math.min(MAX_ENERGY, e)) : MAX_ENERGY;
}

let lastWarn = 100;
export function setEnergy(v: number) {
  const before = getEnergy();
  const next = Math.max(0, Math.min(MAX_ENERGY, v));
  game.save.player.energy = next;
  if (Math.round(before) !== Math.round(next)) bus.emit('energy:changed', { energy: next });
  if (next > WARN_LIMIT) lastWarn = 100;
  else if (next <= TIRED_LIMIT && lastWarn > TIRED_LIMIT) { lastWarn = TIRED_LIMIT; bus.emit('toast', { text: 'Estás agotada: no podés cocinar hasta descansar. Dormí en tu cama.' }); }
  else if (next <= WARN_LIMIT && lastWarn > WARN_LIMIT) { lastWarn = WARN_LIMIT; bus.emit('toast', { text: 'Empezás a sentirte cansada.' }); }
}

export const addEnergy = (d: number) => setEnergy(getEnergy() + d);
export const tooTiredToCook = () => getEnergy() <= TIRED_LIMIT;
