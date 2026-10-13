/** Minute of the displayed day, derived from the existing four-period clock. */
import { BALANCE } from '../core/balance';
const HOURS = [6, 12, 18, 21, 24];
export function dayMinutes(period: number, minutes: number): number {
  const p = Math.max(0, Math.min(3, Math.floor(Number.isFinite(period) ? period : 0)));
  const progress = Math.max(0, Math.min(1, (Number.isFinite(minutes) ? minutes : 0) / BALANCE.periodMinutes));
  return Math.floor((HOURS[p] + (HOURS[p + 1] - HOURS[p]) * progress) * 60);
}
