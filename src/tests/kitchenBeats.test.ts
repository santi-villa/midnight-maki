import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { holdScore, itemsScore, planBeats, pulseGrace, pulsePeriod, pulseScore } from '../kitchen/beats';

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
