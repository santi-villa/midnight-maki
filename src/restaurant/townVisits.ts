/** The game-bound side of the neighbours' clientele (see townClients.ts for the rules). */
import { game } from '../core/state';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { charm } from './orders';
import {
  customerOf, demandFactor, takeOccasion, dueVisit, emptyClients, inviteResponse, plan, recordInvite, recordMeal, recordVisit, regularDropIn, regularsCount, walkIn,
  type ClientsSave, type InviteResult,
} from './townClients';

export const clients = (): ClientsSave => (game.save.clients ??= emptyClients());

export function clientsDemand(): number {
  const t = game.save.time;
  return demandFactor({
    period: t.period, day: t.day, rain: game.flag('weather') === 'rain', reputation: game.save.restaurant.reputation,
    charm: charm(), festival: !!game.flag('festival_today'), regulars: regularsCount(clients()),
  });
}

/** Who comes next when the door opens: a planned visit first, then a regular, then someone who just feels like it. */
export function nextTownGuest(busy: (customer: string) => boolean, roll: number = Math.random()): string | null {
  const s = clients(), t = game.save.time;
  const id = dueVisit(s, t.day, t.period, busy) ?? regularDropIn(s, t.day, roll, busy) ?? walkIn(t.day, t.period, roll, busy, s);
  return id ? customerOf(id) : null;
}

export function noteTownMeal(customer: string, recipe: string, quality: 0 | 1 | 2, waited: boolean): boolean {
  return recordMeal(clients(), customer, recipe, quality, waited, game.save.time.day);
}

/** Records the end of a visit. Returns the thank-you gift when this was their 5th or 10th happy visit (already added to the stored furniture). */
export function noteTownLeft(customer: string, happy: boolean): { id: string; furniture: string; visit: number } | null {
  recordVisit(clients(), customer, game.save.time.day, happy);
  if (!happy) return null;
  game.save.restaurant.reputation += 1;
  const gift = takeOccasion(clients(), customer);
  if (gift) game.save.furnitureOwned[gift.furniture] = (game.save.furnitureOwned[gift.furniture] ?? 0) + 1;
  return gift;
}

/** Visits the player arranged for today (for the morning note). */
export function plannedToday(day: number): { id: string; period: number }[] {
  return clients().planned.filter((p) => p.day === day).map((p) => ({ id: p.id, period: p.period }));
}

/** The player invites a neighbour. Returns what they answered; a yes is remembered as a planned visit. */
export function inviteNeighbor(id: string): InviteResult {
  const n = NEIGHBOR_BY_ID[id], s = clients(), t = game.save.time;
  const reg = s.regulars[id];
  const result = inviteResponse(n, {
    day: t.day, period: t.period, rain: game.flag('weather') === 'rain', mood: reg?.mood ?? 0,
    alreadyToday: reg?.invited === t.day, alreadyPlanned: s.planned.some((p) => p.id === id),
  });
  if (reg?.invited !== t.day) recordInvite(s, id, t.day);
  if (result.answer !== 'no' && !s.planned.some((p) => p.id === id)) plan(s, id, t.day, result.period ?? t.period);
  game.touch('invite');
  return result;
}
