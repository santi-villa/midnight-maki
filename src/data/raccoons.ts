import { game } from '../core/state';
import type { RoutineStop } from './characters';
import { FURN_BY_ID } from './furniture';

const stop = (x: number, y: number, act: RoutineStop['act'], alternatives: [number, number][], dir: RoutineStop['dir'] = 'down'): RoutineStop =>
  ({ zone: 'restaurant', x, y, act, alternatives, wander: 0, dir });

/** Minute of the night (21:00 + n) until which Rigg keeps cleaning. The restaurant closes at minute 60. */
export const CLEAN_UNTIL = 80;

const BEDS: Record<string, { zone: string; x: number; y: number; alternatives: [number, number][] }> = {
  pip: { zone: 'home', x: 9, y: 4, alternatives: [[10, 4], [10, 5]] },
  spicy: { zone: 'home', x: 17, y: 4, alternatives: [[17, 5], [18, 4]] },
  rigg: { zone: 'home', x: 22, y: 3, alternatives: [[23, 4], [24, 5]] },
};

/**
 * Sleeping spot: the bed or futon in their own room if it is there, so the sleeper really lies in it
 * (the actor is drawn in the bed). Without one, they sleep beside the usual spot as before.
 */
function bedStop(id: string): RoutineStop {
  const home = BEDS[id];
  const placed = game.save.decor?.['room_' + id]?.find((f) => {
    const d = FURN_BY_ID[f.id];
    return d && (d.kind === 'bed' || d.kind === 'futon') && d.w === 1 && d.h === 2 && !(f.rot % 2);
  });
  if (!placed) return { ...home, act: 'sleep', wander: 0 };
  const below = placed.y + 2;
  return {
    zone: 'home', x: placed.x, y: below, act: 'sleep', wander: 0,
    bed: { x: placed.x, y: placed.y, w: 1, h: 2 },
    alternatives: [[placed.x + 1, below], [placed.x - 1, below], [placed.x, below + 1]],
  };
}

/** The clock is unchanged: staggered breaks reuse existing stools and bedrooms. */
export function raccoonRoutine(id: string, period: number, minutes: number, open: boolean): RoutineStop | undefined {
  if (!['pip', 'spicy', 'rigg'].includes(id)) return;
  if (!open) {
    if (period !== 3) return;
    // Rigg tidies the dining room for a few minutes after closing; the others go straight to bed.
    if (id === 'rigg' && minutes < CLEAN_UNTIL) return stop(10, 7, 'clean', [[11, 7], [10, 9], [9, 6]]);
    return bedStop(id);
  }
  if (id === 'pip') {
    if (period === 1 && minutes >= 25 && minutes < 35) return { ...stop(4, 6, 'sit', [[3, 6], [6, 7]]), seatLift: 4 };
    return stop(6, 10, 'work', [[5, 10], [6, 11]]);
  }
  if (id === 'spicy') {
    if (period === 1 && minutes >= 45 && minutes < 55) return { ...stop(1, 6, 'drink', [[2, 6], [3, 6]]), seatLift: 4 };
    return stop(3, 3, 'cook', [[2, 3], [3, 4]], 'up');
  }
  if (period === 1 && minutes >= 65 && minutes < 75) return { ...stop(2, 6, 'read', [[3, 6], [4, 6]]), seatLift: 4 };
  return stop(10, 4, 'read', [[10, 3], [11, 4]]);
}
