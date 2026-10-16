/**
 * Night deadlines. Closing a restaurant mission sends Sofi to bed.
 * Staying out past that still leaves the small hours free; only a long
 * stretch without sleep costs coins and ends the night.
 */
import { bus } from '../core/events';
import { game } from '../core/state';
import type { QuestTarget } from '../quests/quests';
import { restaurantPhase } from './schedule';

/**
 * Period-3 minute when the night has run too long.
 * Minute 0 is 21:00, 90 is 00:00, and 240 is 05:00.
 */
export const EXHAUSTED_PERIOD_MINUTES = 240;

export function exhaustionFine(coins: number): number {
  if (!Number.isFinite(coins) || coins <= 0) return 0;
  return Math.min(40, Math.max(1, Math.floor(coins * 0.15)));
}

/** The tracked step still needs the restaurant itself, not a door that only passes through it. */
export function questKeepsRestaurant(target: QuestTarget | null, npcZone: (id: string) => string | null): boolean {
  if (!target) return false;
  if (target.kind === 'object' || target.kind === 'location') return target.zone === 'restaurant';
  if (target.kind === 'interior') return target.targetZone === 'restaurant';
  if (target.kind === 'npc') return npcZone(target.npc) === 'restaurant';
  return false;
}

export function bedtimeReason(
  period: number,
  minutes: number,
  target: QuestTarget | null,
  npcZone: (id: string) => string | null,
): 'closing' | 'exhausted' | null {
  if (period !== 3 || !Number.isFinite(minutes)) return null;
  if (restaurantPhase(period, minutes) === 'closing' && questKeepsRestaurant(target, npcZone)) return 'closing';
  if (minutes >= EXHAUSTED_PERIOD_MINUTES) return 'exhausted';
  return null;
}

let settling = false;

/** Fade out, start the next morning, and explain why the night ended. */
export async function settleBedtime(reason: 'closing' | 'exhausted') {
  if (settling) return;
  settling = true;
  try {
    if (reason === 'exhausted') {
      const dropped = exhaustionFine(game.coins);
      if (dropped > 0) game.addCoins(-dropped, 'exhaustion');
      game.setFlag('slept_exhausted', true);
      game.setFlag('slept_dropped', dropped);
      bus.emit('toast', { text: 'Se te cierran los ojos. Demasiado tiempo sin dormir.' });
    } else {
      game.setFlag('slept_closing', true);
      bus.emit('toast', { text: 'El restaurante está cerrando. Esa misión sigue mañana: a dormir.' });
    }
    const { sleepNow } = await import('./sleep');
    await sleepNow(reason === 'exhausted' ? { hours: 6 } : undefined);
  } finally {
    settling = false;
  }
}
