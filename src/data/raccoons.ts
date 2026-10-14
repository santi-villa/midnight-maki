import type { RoutineStop } from './characters';

const stop = (x: number, y: number, act: RoutineStop['act'], alternatives: [number, number][], dir: RoutineStop['dir'] = 'down'): RoutineStop =>
  ({ zone: 'restaurant', x, y, act, alternatives, wander: 0, dir });

/** The clock is unchanged: staggered breaks reuse existing stools and bedrooms. */
export function raccoonRoutine(id: string, period: number, minutes: number, open: boolean): RoutineStop | undefined {
  if (!['pip', 'spicy', 'rigg'].includes(id)) return;
  if (!open) {
    if (period !== 3) return;
    if (id === 'pip') return { zone: 'home', x: 9, y: 4, act: 'sleep', wander: 0, alternatives: [[10, 4], [10, 5]] };
    if (id === 'spicy') return { zone: 'home', x: 17, y: 4, act: 'sleep', wander: 0, alternatives: [[17, 5], [18, 4]] };
    return { zone: 'home', x: minutes >= 85 ? 22 : 24, y: minutes >= 85 ? 3 : 4, act: minutes >= 85 ? 'sleep' : 'read', wander: 0, alternatives: [[23, 4], [24, 5]] };
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
