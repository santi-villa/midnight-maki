import { describe, expect, it } from 'vitest';
import { riggMotion, RIGG_WALK } from '../art/riggMotion';

describe('illustrated Rigg motion', () => {
  it('plays all four walking poses in order, at six frames per second', () => {
    for (const dir of ['down', 'up', 'right', 'left'] as const) {
      const cycle = Array.from({ length: 4 }, (_, i) => riggMotion(true, dir, 'idle', (i + .1) / 6, true, 0));
      expect(cycle).toEqual(RIGG_WALK[dir]);
      expect(riggMotion(true, dir, 'idle', 4.1 / 6, false, 0)).toBe(cycle[0]);
    }
  });
  it('blinks without replacing a reading or seated body with a standing pose', () => {
    expect(riggMotion(false, 'down', 'read', 0, false, 0)).toBe(28);
    expect(riggMotion(false, 'down', 'read', 0, true, 0)).toBe(34);
    expect(riggMotion(false, 'down', 'sit', 0, true, 0)).toBe(35);
    expect(riggMotion(false, 'right', 'idle', 0, true, 0)).toBe(16);
    expect(riggMotion(false, 'left', 'idle', 0, true, 0)).toBe(17);
    expect(riggMotion(false, 'up', 'idle', 0, true, 0)).toBe(3);
  });
  it('keeps work and conversation stationary instead of stepping or waving repeatedly', () => {
    for (const time of [0, .4, .8, 1.2]) {
      expect(riggMotion(false, 'up', 'work', time, false, 4)).toBe(3);
      expect(riggMotion(false, 'down', 'talk', time, false, 27)).toBe(0);
    }
  });
});
