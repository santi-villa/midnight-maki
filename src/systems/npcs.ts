/** Where every character is right now (routines + weather + story overrides). DOM-free. */
import { game } from '../core/state';
import { CHARACTERS, type CharacterDef, type RoutineStop } from '../data/characters';
import { ZONES } from '../data/zones';
import { applyBeat, FESTIVAL_SPOT, restaurantPhase, shopPlace, shopStatus, type ShopStatus } from './schedule';

function minutesNow(): number {
  return game.save.time.minutes;
}

function beat(c: CharacterDef, period: number, base: RoutineStop, hold = false): RoutineStop {
  return applyBeat(c, period, minutesNow(), base, hold);
}

/** Story/event overrides: flag `at_<id>` = "zone,x,y,act" forces a position until cleared. */
export function stopFor(id: string, period: number): RoutineStop | null {
  const c = CHARACTERS.find((ch) => ch.id === id);
  if (!c) return null;
  if (c.needsFlag && !game.has(c.needsFlag)) return null;
  const ov = game.flag('at_' + id);
  if (typeof ov === 'string' && ov) {
    const [zone, x, y, act] = ov.split(',');
    return { zone, x: +x, y: +y, act: (act || undefined) as RoutineStop['act'], wander: 0 };
  }
  // during the prologue tutorial the raccoons stay at the restaurant so they're always reachable
  if (c.raccoon && !game.save.quests.done.includes('prologue') && game.save.time.day < 2) return { zone: 'restaurant', ...introSpot(id) };
  // Pip hosts the whole public shift, then returns to his own evening routine.
  if (id === 'pip' && game.has('intro_done') && restaurantPhase(period, minutesNow()) === 'open') {
    return { zone: 'restaurant', x: 8, y: 9, wander: 0, act: 'work' };
  }
  const spot = c.routine[period];
  if (game.flag('weather') === 'rain' && period < 3) {
    const outdoor = !!ZONES[spot.zone]?.outdoor;
    // already indoors: keep the shift, and still eat, clean and close up
    if (!outdoor) return beat(c, period, spot);
    if (c.rainSpot) return c.rainSpot;
    const shelter = RAIN_SHELTER[c.id];
    if (shelter) return { zone: 'restaurant', x: shelter[0], y: shelter[1], wander: 0, act: 'sit' };
    // a couple of neighbors actually like being out in the rain
    if (c.id === 'nami' || c.id === 'kiki') return beat(c, period, spot);
    return null;
  }
  const fest = (period === 1 || period === 2) && game.flag('festival_today') ? FESTIVAL_SPOT[c.id] : undefined;
  if (fest) return beat(c, period, fest, period < 2);
  // villagers who "sleep" in town are indoors (not visible). Raccoons sleep in their rooms.
  if (spot.act === 'sleep' && !c.raccoon) return null;
  return beat(c, period, spot);
}

function introSpot(id: string) {
  if (id === 'pip') return { x: 6, y: 6, act: undefined, wander: 0 };
  if (id === 'spicy') return { x: 3, y: 3, act: 'cook' as const, wander: 0 };
  return { x: 14, y: 10, act: 'read' as const, wander: 0 };
}

const RAIN_SHELTER: Record<string, [number, number]> = { momo: [10, 11], bento: [13, 11], ume: [8, 10], kumo: [12, 10] };

export function charactersIn(zone: string, period: number): { id: string; stop: RoutineStop }[] {
  const out: { id: string; stop: RoutineStop }[] = [];
  for (const c of CHARACTERS) {
    const s = stopFor(c.id, period);
    if (s && s.zone === zone) out.push({ id: c.id, stop: s });
  }
  return out;
}

export function whereIs(id: string): string | null {
  return stopFor(id, game.save.time.period)?.zone ?? null;
}

/** Whether a counter will sell right now. Market stalls stay on their own night rule. */
export function shopGate(id: string): ShopStatus {
  const place = shopPlace(id);
  if (!place) return shopStatus(id, { period: 0, minutes: 0, festival: false, force: false, shut: false, storyHere: false, keeperZone: null });
  const keeperZone = place.keeper ? whereIs(place.keeper) : place.zone;
  const story = place.keeper ? game.flag('at_' + place.keeper) : undefined;
  return shopStatus(id, {
    period: game.save.time.period,
    minutes: game.save.time.minutes,
    festival: !!game.flag('festival_today'),
    force: game.has('shop_force_' + id),
    shut: game.has('shop_shut_' + id),
    storyHere: typeof story === 'string' && keeperZone === place.zone,
    keeperZone,
  });
}
