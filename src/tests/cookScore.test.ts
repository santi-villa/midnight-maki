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
  coneDrag,
  cutWidths,
  fishCutSpeed,
  fishCutSummary,
  fishCutVerdict,
  fishCutZones,
  evenness,
  pressRate,
  pressVerdict,
  pressZone,
  riceStats,
  riceVerdict,
} from '../restaurant/cookScore';

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

describe('rice, pressure and cuts', () => {
  it('measures coverage and thickness', () => {
    const cells = new Uint8Array(10);
    cells.fill(2, 0, 8);
    expect(riceStats(cells)).toEqual({ coverage: 0.8, mean: 2 });
    expect(riceVerdict(1).kind).toBe('thin');
    expect(riceVerdict(2).kind).toBe('good');
    expect(riceVerdict(3).kind).toBe('thick');
    expect(riceVerdict(2).prec).toBeGreaterThan(riceVerdict(3).prec);
  });

  it('judges the roll pressure with a wide relaxed zone', () => {
    for (const mode of ['relaxed', 'normal', 'challenge'] as const) {
      const z = pressZone(mode);
      expect(pressVerdict(z.lo - 0.1, mode).kind).toBe('loose');
      expect(pressVerdict((z.lo + z.hi) / 2, mode).kind).toBe('firm');
      expect(pressVerdict(z.hi + 0.1, mode).kind).toBe('squeezed');
      expect(pressRate(mode)).toBeGreaterThan(0);
    }
    const r = pressZone('relaxed');
    const c = pressZone('challenge');
    expect(r.hi - r.lo).toBeGreaterThan(c.hi - c.lo);
    expect(pressVerdict(0.1, 'relaxed').prec).toBeGreaterThan(0);
  });

  it('rates how even the cut pieces are', () => {
    const even = cutWidths([50, 100, 150], 0, 200);
    expect(even).toEqual([50, 50, 50, 50]);
    expect(evenness(even)).toBe(1);
    const uneven = cutWidths([20, 40, 190], 0, 200);
    expect(evenness(uneven)).toBeLessThan(0.5);
    expect(cutWidths([300, -5], 0, 100).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('fish cutting and cones', () => {
  it('judges the marker against the gold and green zones', () => {
    for (const mode of ['relaxed', 'normal', 'challenge'] as const) {
      expect(fishCutVerdict(0.5, mode).kind).toBe('perfect');
      expect(fishCutVerdict(0.5 + fishCutZones(mode).good - 0.01, mode).kind).toBe('good');
      expect(fishCutVerdict(0.95, mode).kind).toBe('miss');
      expect(fishCutVerdict(0.95, mode).prec).toBeGreaterThan(0);
    }
    expect(fishCutZones('relaxed').good).toBeGreaterThan(fishCutZones('challenge').good);
    expect(fishCutZones('normal', true).good).toBeGreaterThan(fishCutZones('normal').good);
  });

  it('keeps the marker comfortable on touch screens', () => {
    for (const mode of ['relaxed', 'normal', 'challenge'] as const) for (let d = 1; d <= 5; d++) for (let i = 0; i < 4; i++) expect(fishCutSpeed(mode, d, i)).toBeLessThanOrEqual(2.4);
    expect(fishCutSpeed('normal', 4, 2)).toBeGreaterThan(fishCutSpeed('normal', 1, 0));
  });

  it('summarises a row of cuts and never fails the dish', () => {
    expect(fishCutSummary(['perfect', 'good', 'perfect'])).toBe('clean');
    expect(fishCutSummary(['good', 'miss', 'good'])).toBe('ok');
    expect(fishCutSummary(['miss', 'miss', 'good'])).toBe('ragged');
    expect(fishCutSummary([])).toBe('ok');
  });

  it('measures the temaki cone drag', () => {
    expect(coneDrag(106, -106).progress).toBeCloseTo(1, 1);
    expect(coneDrag(106, -106).straight).toBeCloseTo(1, 1);
    expect(coneDrag(100, 100).straight).toBeLessThan(0.1);
    expect(coneDrag(-50, 50).progress).toBe(0);
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
