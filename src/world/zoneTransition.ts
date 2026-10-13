/** Pure transition and arrival rules; rendering and timing remain in the existing world. */
import { ZONES } from '../data/zones';
import type { BuiltZone } from './zoneRuntime';
export type TransitionKind = 'doors' | 'fade';
export function zoneTransitionKind(from: string, to: string): TransitionKind {
  return ZONES[from]?.outdoor && ZONES[to]?.outdoor ? 'fade' : 'doors';
}
export function safeArrival(zone: BuiltZone, x: number, y: number): { x: number; y: number } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !zone.grid.inside(x, y)) throw new Error('Invalid zone arrival');
  if (!zone.grid.isSolid(x, y)) return { x, y };
  // A saved decoration can occupy the entrance. Prefer a nearby tile inside, never an exit.
  for (let r = 1; r <= zone.def.w + zone.def.h; r++) {
    for (let dy = -r; dy <= r; dy++) for (const dx of new Set([r - Math.abs(dy), Math.abs(dy) - r])) {
      const tx = x + dx, ty = y + dy;
      if (!zone.grid.isSolid(tx, ty) && !zone.def.doors.some(d => d.walk && d.x === tx && d.y === ty)) return { x: tx, y: ty };
    }
  }
  throw new Error('No free zone arrival');
}
