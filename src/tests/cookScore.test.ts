import { describe, expect, it } from 'vitest';
import { challengeLimit, judgeCook, parSeconds } from '../restaurant/cookScore';

describe('cook quality', () => {
  it('keeps relaxed service generous', () => {
    expect(judgeCook({ mode: 'relaxed', mistakes: 0, elapsed: 90, steps: 6, timeLimit: 0, precision: 0.8 })).toMatchObject({ quality: 2, label: '¡Perfecto!' });
    // sloppy work is "good", never a failure, and never depends on how long it took
    expect(judgeCook({ mode: 'relaxed', mistakes: 9, elapsed: 400, steps: 6, timeLimit: 0, precision: 0 }).quality).toBe(1);
    expect(judgeCook({ mode: 'relaxed', mistakes: 0, elapsed: 4, steps: 6, timeLimit: 0, precision: 0.2 }).quality).toBe(1);
    expect(judgeCook({ mode: 'relaxed', mistakes: 3, elapsed: 4, steps: 6, timeLimit: 0, precision: 1 }).quality).toBe(2);
  });

  it('scores normal play from mistakes, time and a small precision nudge', () => {
    const clean = judgeCook({ mode: 'normal', mistakes: 0, elapsed: parSeconds(4), steps: 4, timeLimit: 0, precision: 0 });
    expect(clean.quality).toBe(2);
    const slow = judgeCook({ mode: 'normal', mistakes: 0, elapsed: parSeconds(4) + 40, steps: 4, timeLimit: 0, precision: 0 });
    expect(slow.quality).toBeLessThan(2);
    const sloppy = judgeCook({ mode: 'normal', mistakes: 6, elapsed: 10, steps: 4, timeLimit: 0, precision: 0 });
    expect(sloppy.quality).toBe(0);
    const nudged = judgeCook({ mode: 'normal', mistakes: 2, elapsed: parSeconds(4), steps: 4, timeLimit: 0, precision: 1 });
    const plain = judgeCook({ mode: 'normal', mistakes: 2, elapsed: parSeconds(4), steps: 4, timeLimit: 0, precision: 0 });
    expect(nudged.score).toBeGreaterThan(plain.score);
    expect(nudged.score - plain.score).toBeLessThanOrEqual(8);
  });

  it('raises challenge quality when the clock is beaten', () => {
    const steps = 5;
    const limit = challengeLimit(steps);
    const late = judgeCook({ mode: 'challenge', mistakes: 5, elapsed: limit + 5, steps, timeLimit: limit, precision: 0 });
    const early = judgeCook({ mode: 'challenge', mistakes: 5, elapsed: limit - 1, steps, timeLimit: limit, precision: 0 });
    expect(early.quality).toBe(Math.min(2, late.quality + 1));
  });
});

describe('hard mode clock', () => {
  const base = { mode: 'challenge' as const, mistakes: 0, steps: 6, timeLimit: 100, precision: 1 };
  it('lifts a good dish when finished on time and caps it when late', () => {
    expect(judgeCook({ ...base, elapsed: 30 }).quality).toBe(2);
    expect(judgeCook({ ...base, elapsed: 30, mistakes: 4 }).quality).toBeGreaterThanOrEqual(1);
    expect(judgeCook({ ...base, elapsed: 130 }).quality).toBeLessThanOrEqual(1);
  });
});
