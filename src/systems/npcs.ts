/** Where every character is right now (routines + weather + story overrides). DOM-free. */
import { game } from '../core/state';
import { CHARACTERS, type RoutineStop } from '../data/characters';

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
  if (game.flag('weather') === 'rain' && period < 3) {
    if (c.rainSpot) return c.rainSpot;
    // some villagers shelter from the rain at Midnight Maki; the rest stay indoors
    const shelter = RAIN_SHELTER[c.id];
    if (shelter) return { zone: 'restaurant', x: shelter[0], y: shelter[1], wander: 0, act: 'sit' };
    if (!['nami', 'kiki'].includes(c.id) && c.routine[period].zone !== 'restaurant') return null;
  }
  // raccoons stay home on the very first evening (intro)
  // during the prologue tutorial the raccoons stay at the restaurant so they're always reachable
  if (c.raccoon && !game.save.quests.done.includes('prologue') && game.save.time.day < 2) return { zone: 'restaurant', ...introSpot(id) };
  const stop = c.routine[period];
  // villagers who "sleep" in town are indoors (not visible)
  if (stop.act === 'sleep' && !c.raccoon) return null;
  return stop;
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
