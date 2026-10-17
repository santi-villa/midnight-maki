import { describe, expect, it } from 'vitest';
import { APPROACH_CHANCE, APPROACH_WAIT, rollApproach } from '../systems/approach';

describe('a rare visit', () => {
  it('is unlikely, and still happens', () => {
    expect(APPROACH_CHANCE).toBeGreaterThan(0);
    expect(APPROACH_CHANCE).toBeLessThan(0.15);
    expect(APPROACH_WAIT).toBeGreaterThanOrEqual(60);
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (rollApproach(() => i / 4000)) hits++;
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(800);
  });
});
