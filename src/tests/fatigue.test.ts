import { describe, expect, it } from 'vitest';
import { dayMinutes } from '../systems/daytime';
import { drainFor, energyAfterSleep, hhmm, wakePlan } from '../systems/fatigue';

describe('tiredness and sleep', () => {
  it('drains faster after midnight', () => {
    expect(drainFor(60, 12 * 60)).toBeLessThan(drainFor(60, 25 * 60));
    expect(drainFor(-5, 0)).toBe(0);
  });
  it('sleeps the hours you pick, including a wake before 06:00', () => {
    const bed = 22 * 60;
    const plans = [5, 6, 7, 8].map((hours) => wakePlan(bed, hours));
    expect(plans.map((plan) => hhmm(plan.wakeMinute))).toEqual(['03:00', '04:00', '05:00', '06:00']);
    expect(plans.map((plan) => plan.sleptHours)).toEqual([5, 6, 7, 8]);
    expect(plans.map((plan) => plan.advanceDay)).toEqual([false, false, false, true]);
    for (const plan of plans) expect(hhmm(dayMinutes(plan.period, plan.minutes))).toBe(hhmm(plan.wakeMinute));
  });
  it('an evening 8 hour sleep wakes at 05:00 without rolling the day', () => {
    const early = wakePlan(21 * 60, 8);
    expect(hhmm(early.wakeMinute)).toBe('05:00');
    expect(early.sleptHours).toBe(8);
    expect(early.advanceDay).toBe(false);
    expect(early.period).toBe(3);
    expect(hhmm(dayMinutes(early.period, early.minutes))).toBe('05:00');
  });
  it('a late bed wakes later the same morning', () => {
    const late = wakePlan(25 * 60, 8); // 01:00
    expect(hhmm(late.wakeMinute)).toBe('09:00');
    expect(late.lateMinutes).toBe(3 * 60);
    expect(late.advanceDay).toBe(true);
    expect(late.sleptHours).toBe(8);
    expect(hhmm(dayMinutes(late.period, late.minutes))).toBe('09:00');
  });
  it('clamps the sleep length and restores energy without passing full', () => {
    expect(wakePlan(21 * 60, 1).sleptHours).toBe(4);
    expect(wakePlan(21 * 60, 99).sleptHours).toBe(10);
    expect(energyAfterSleep(10, 4)).toBeLessThan(energyAfterSleep(10, 8));
    expect(energyAfterSleep(90, 10)).toBe(100);
  });
});
