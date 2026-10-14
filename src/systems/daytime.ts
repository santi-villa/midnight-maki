/** Minute of the displayed day, derived from the existing four-period clock. */
import { BALANCE } from '../core/balance';
const HOURS = [6, 12, 18, 21, 24];
export function dayMinutes(period: number, minutes: number): number {
  const p = Math.max(0, Math.min(3, Math.floor(Number.isFinite(period) ? period : 0)));
  const raw = (Number.isFinite(minutes) ? minutes : 0) / BALANCE.periodMinutes;
  // Night keeps counting past 24:00. Earlier periods still end on their boundary.
  const progress = p === 3 ? Math.max(0, raw) : Math.max(0, Math.min(1, raw));
  return Math.floor((HOURS[p] + (HOURS[p + 1] - HOURS[p]) * progress) * 60);
}
