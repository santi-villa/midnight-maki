/** Minute of the displayed day, derived from the existing four-period clock. */
import { BALANCE } from '../core/balance';
const HOURS = [6, 12, 18, 21, 24];

function periodIndex(period: number): number {
  return Math.max(0, Math.min(3, Math.floor(Number.isFinite(period) ? period : 0)));
}

/** Clock minutes packed into one stored period-minute. Morning is wider than night, so this differs. */
export function displayedMinutesPerPeriodMinute(period: number): number {
  const p = periodIndex(period);
  return (HOURS[p + 1] - HOURS[p]) * 60 / BALANCE.periodMinutes;
}

/** Real seconds that advance one stored period-minute. The HUD then gains one minute per real second. */
export function realSecondsPerPeriodMinute(period: number): number {
  return BALANCE.realSecondsPerGameMinute * displayedMinutesPerPeriodMinute(period);
}

export function dayMinutes(period: number, minutes: number): number {
  const p = periodIndex(period);
  const raw = (Number.isFinite(minutes) ? minutes : 0) / BALANCE.periodMinutes;
  // Night keeps counting past 24:00. Earlier periods still end on their boundary.
  const progress = p === 3 ? Math.max(0, raw) : Math.max(0, Math.min(1, raw));
  return Math.floor((HOURS[p] + (HOURS[p + 1] - HOURS[p]) * progress) * 60);
}
