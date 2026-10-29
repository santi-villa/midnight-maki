import type { Dir } from '../core/types';

export const RIGG_WALK = {
  down: [0, 1, 2, 30], up: [3, 4, 5, 31],
  right: [6, 7, 8, 32], left: [9, 10, 11, 33],
} as const;

/** The illustrated poses already contain movement; do not add the generated body's bounce. */
export function riggMotion(moving: boolean, dir: Dir, act: string, time: number, blink: boolean, fallback: number): number {
  if (moving) return RIGG_WALK[dir][Math.floor(time * 6) % 4];
  if (act === 'read') return dir === 'up' ? 3 : blink ? 34 : 28;
  if (['sit', 'eat', 'drink'].includes(act)) return blink ? 35 : 29;
  if (act === 'talk') return blink ? 12 : 0;
  if (['idle', 'look', 'play'].includes(act)) {
    if (blink && dir !== 'up') return { down: 12, right: 16, left: 17 }[dir];
    return RIGG_WALK[dir][0];
  }
  if (dir === 'up' && ['cook', 'work', 'clean', 'fish', 'paint'].includes(act)) return 3;
  return fallback;
}
