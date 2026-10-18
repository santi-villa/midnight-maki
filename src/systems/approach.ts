/**
 * A villager sometimes walks over with one short line.
 * The wait and the chance are both long on purpose: it should be rare, and it should still happen.
 */
export const APPROACH_WAIT = 70;
export const APPROACH_CHANCE = 0.07;

export function rollApproach(rng: () => number): boolean {
  return rng() < APPROACH_CHANCE;
}
