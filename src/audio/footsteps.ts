/** Surfaces and distance/cadence are shared by people and local pets. No Phaser/audio dependencies. */
export function stepSurface(outdoor: boolean, tile: string, wet: boolean): string {
  if (outdoor && wet && 'gGpcsobh'.includes(tile)) return 'step_wet';
  if (!outdoor || tile === 'b') return 'step_wood';
  if (tile === 's' || tile === 'h') return 'step_sand';
  if (tile === 'c' || tile === 'R' || tile === 'S') return 'step_stone';
  return 'gGop'.includes(tile) ? 'step_grass' : 'step';
}

export function stepGain(distance: number, pet = false): number {
  return Math.pow(Math.max(0, 1 - distance / 112), 2) * (pet ? 0.28 : 0.55);
}

export class Footsteps {
  private last = new WeakMap<object, { x: number; y: number; travel: number; cool: number }>();
  sample(id: object, x: number, y: number, dt: number, paused: boolean, pet = false): boolean {
    const previous = this.last.get(id);
    if (!previous) { this.last.set(id, { x, y, travel: 0, cool: 0 }); return false; }
    const distance = Math.hypot(x - previous.x, y - previous.y);
    previous.x = x; previous.y = y;
    previous.cool = Math.max(0, previous.cool - dt);
    if (paused || distance > 24) { previous.travel = 0; return false; }
    previous.travel += distance;
    if (distance < 0.01 || previous.travel < (pet ? 7 : 12) || previous.cool > 0) return false;
    previous.travel = 0; previous.cool = pet ? 0.25 : 0.28;
    return true;
  }
}
