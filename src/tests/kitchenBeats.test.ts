import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { holdCurve, holdScore, rollTwist, itemsScore, planBeats, pulseGrace, pulsePeriod, pulseScore } from '../kitchen/beats';

describe('beats of a recipe', () => {
  it('turns every step into at least one beat, in order, and waits for the stove and the rice pot', () => {
    for (const r of RECIPES) {
      const beats = planBeats(r, 'normal', true);
      expect(beats.length, r.id).toBeGreaterThanOrEqual(r.steps.length);
      const steps = beats.map((b) => b.step);
      expect([...steps].sort((a, b) => a - b), r.id).toEqual(steps);
      expect(new Set(steps).size, r.id).toBe(r.steps.length);
      expect(beats[beats.length - 1].kind, r.id).toBe('tap');
      expect(beats[beats.length - 1].station).toBe('plate');
      for (const s of r.steps) if (s.t === 'cook') expect(beats.some((b) => b.kind === 'wait' && b.wait === s.item), r.id).toBe(true);
      const needsRice = r.steps.some((s) => s.t === 'rice' || s.t === 'shape');
      expect(beats.filter((b) => b.wait === 'rice').length, r.id).toBe(needsRice ? 1 : 0);
    }
  });
  it('asks for the rice pot once, before the first thing that needs rice, and not at all without a pot', () => {
    const maki = RECIPES.find((r) => r.id === 'kappa')!;
    const withPot = planBeats(maki, 'relaxed', true);
    expect(withPot.findIndex((b) => b.wait === 'rice')).toBeLessThan(withPot.findIndex((b) => b.kind === 'hold'));
    expect(planBeats(maki, 'relaxed', false).some((b) => b.wait === 'rice')).toBe(false);
  });
  it('tempts with wrong ingredients only outside the relaxed mode', () => {
    const r = RECIPES.find((x) => x.id === 'california')!;
    const place = (m: 'relaxed' | 'normal' | 'challenge') => planBeats(r, m, false).find((b) => b.kind === 'items')!;
    expect(place('relaxed').decoys).toEqual([]);
    expect(place('normal').decoys!.length).toBe(1);
    expect(place('challenge').decoys!.length).toBe(2);
    for (const d of place('challenge').decoys!) expect(place('challenge').items).not.toContain(d);
  });
});

describe('how well a beat went', () => {
  it('scores taps by distance to the beat, kindly in relaxed and strictly in challenge', () => {
    for (const mode of ['relaxed', 'normal', 'challenge'] as const) {
      const p = pulsePeriod(mode);
      expect(pulseScore(0, p, mode).verdict).toBe('perfect');
      expect(pulseScore(p * pulseGrace(mode) * 0.5, p, mode).verdict).toBe('good');
      expect(pulseScore(p, p, mode).verdict).toBe('miss');
    }
    const lateRelaxed = pulseScore(0.25, pulsePeriod('relaxed'), 'relaxed').score;
    const lateChallenge = pulseScore(0.25, pulsePeriod('challenge'), 'challenge').score;
    expect(lateRelaxed).toBeGreaterThan(lateChallenge);
    expect(pulseScore(5, 1, 'relaxed').score).toBeGreaterThanOrEqual(0.5); // a miss never ruins a relaxed dish
  });
  it('scores a hold by how close the release was to the gold mark', () => {
    expect(holdScore(0.85, 0.85, 'normal').verdict).toBe('perfect');
    expect(holdScore(0.7, 0.85, 'normal').verdict).toBe('ok');
    expect(holdScore(0.02, 0.85, 'normal').verdict).toBe('miss');
    expect(holdScore(1, 0.7, 'challenge').verdict).toBe('miss');
  });
  it('costs a little for every wrong ingredient but never wipes the step', () => {
    expect(itemsScore(3, 0)).toBe(1);
    expect(itemsScore(3, 2)).toBeCloseTo(0.6);
    expect(itemsScore(3, 9)).toBe(0.4);
  });
});

describe('twists keep every prompt different but fair', () => {
  const seeded = (n: number) => () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  it('relaxed stays even and gentle', () => {
    for (let i = 1; i < 30; i++) {
      const t = rollTwist('rhythm', 'relaxed', 3, seeded(i));
      expect(t.gaps.every((g) => g === 1)).toBe(true);
      expect(t.jump).toBe(false);
      expect(t.speed).toBeGreaterThanOrEqual(1);
      expect(t.speed).toBeLessThan(1.31);
    }
  });
  it('never gets slower than the base pace in any mode', () => {
    for (const m of ['relaxed', 'normal', 'challenge'] as const) for (let i = 1; i < 40; i++) expect(rollTwist('tap', m, 1, seeded(i)).speed).toBeGreaterThanOrEqual(1);
  });
  it('challenge varies tempo and rhythm across rolls', () => {
    const rolls = Array.from({ length: 40 }, (_, i) => rollTwist('rhythm', 'challenge', 4, seeded(i + 3)));
    expect(new Set(rolls.map((r) => Math.round(r.speed * 10))).size).toBeGreaterThan(4);
    expect(rolls.some((r) => r.gaps.some((g) => g !== 1))).toBe(true);
  });
  it('hold curves start at 0, reach 1 and never go backwards', () => {
    for (const c of ['linear', 'in', 'out', 'surge'] as const) {
      expect(holdCurve(c, 0)).toBe(0);
      expect(holdCurve(c, 1)).toBeCloseTo(1, 5);
      let last = -1;
      for (let r = 0; r <= 1.3; r += 0.05) { const v = holdCurve(c, r); expect(v).toBeGreaterThanOrEqual(last); last = v; }
    }
  });
});
