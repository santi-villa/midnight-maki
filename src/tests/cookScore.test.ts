import { describe, expect, it } from 'vitest';
import {
  challengeLimit,
  guideTolerance,
  heatHit,
  heatMark,
  heatWindow,
  inPlate,
  judgeCook,
  nextGuide,
  parSeconds,
  platePrecision,
  rollFromDrag,
  swipeCuts,
} from '../restaurant/cookScore';

describe('cook quality', () => {
  it('keeps relaxed service generous', () => {
    expect(judgeCook({ mode: 'relaxed', mistakes: 0, elapsed: 90, steps: 6, timeLimit: 0, precision: 0 })).toMatchObject({ quality: 2, label: '¡Perfecto!' });
    expect(judgeCook({ mode: 'relaxed', mistakes: 2, elapsed: 90, steps: 6, timeLimit: 0, precision: 0 }).quality).toBe(2);
    expect(judgeCook({ mode: 'relaxed', mistakes: 3, elapsed: 4, steps: 6, timeLimit: 0, precision: 1 }).quality).toBe(1);
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

describe('cook gestures', () => {
  it('asks for the next dotted cut and accepts a vertical swipe on it', () => {
    expect(nextGuide(0, 3, 20, 180)).toBeCloseTo(20 + 180 / 4);
    expect(nextGuide(3, 3, 20, 180)).toBeNull();
    const guide = nextGuide(0, 3, 20, 180)!;
    expect(swipeCuts(4, 40, guide + 4, guide, guideTolerance('normal'))).toBe('hit');
    expect(swipeCuts(4, 40, guide + 40, guide, guideTolerance('normal'))).toBe('miss');
    expect(swipeCuts(80, 10, guide, guide, 24)).toBe('none');
    expect(guideTolerance('relaxed')).toBeGreaterThan(guideTolerance('challenge'));
  });

  it('rolls faster on the bamboo mat and stays at zero for a downward drag', () => {
    expect(rollFromDrag(0, false)).toBe(0);
    expect(rollFromDrag(-20, true)).toBe(0);
    expect(rollFromDrag(150, false)).toBeCloseTo(1);
    expect(rollFromDrag(150, true)).toBeGreaterThan(1);
  });

  it('puts the cooking mark on a wide, slow window when the kitchen is relaxed', () => {
    const easy = heatWindow('relaxed');
    const hard = heatWindow('challenge');
    expect(easy.half).toBeGreaterThan(hard.half);
    expect(easy.speed).toBeLessThan(hard.speed);
    expect(heatHit(0.5, easy.half)).toBe(true);
    expect(heatHit(heatMark(0, easy.speed), easy.half)).toBe(true);
    expect(heatHit(0.95, hard.half)).toBe(false);
  });

  it('measures plating from the center of the dish', () => {
    expect(inPlate(100, 80, 100, 80, 40, 20)).toBe(true);
    expect(inPlate(160, 80, 100, 80, 40, 20)).toBe(false);
    expect(platePrecision(100, 80, 100, 80, 40, 20)).toBeCloseTo(1);
    expect(platePrecision(140, 80, 100, 80, 40, 20)).toBeCloseTo(0);
    expect(platePrecision(200, 80, 100, 80, 40, 20)).toBe(0);
  });
});
