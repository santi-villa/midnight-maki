import { describe, expect, it } from 'vitest';
import { drainFor, energyAfterSleep, hhmm, wakePlan } from '../systems/fatigue';

describe('tiredness and sleep', () => {
  it('drains faster after midnight', () => {
    expect(drainFor(60, 12 * 60)).toBeLessThan(drainFor(60, 25 * 60));
    expect(drainFor(-5, 0)).toBe(0);
  });
  it('a normal evening bed still wakes at 06:00, a late one wakes later', () => {
    const early = wakePlan(21 * 60, 8);
    expect(hhmm(early.wakeMinute)).toBe('06:00');
    expect(early.sleptHours).toBe(9);
    const late = wakePlan(25 * 60, 8); // 01:00
    expect(hhmm(late.wakeMinute)).toBe('09:00');
    expect(late.lateMinutes).toBe(3 * 60);
  });
  it('sleep restores by the hours slept and never beyond full', () => {
    expect(energyAfterSleep(10, 4)).toBeLessThan(energyAfterSleep(10, 8));
    expect(energyAfterSleep(90, 10)).toBe(100);
  });
});
