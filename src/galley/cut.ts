/**
 * The cutting-board reflex bar. An indicator bounces from end to end; the player stops it on the green zone.
 * The zone moves every attempt. Pure maths: the view draws it and reads the clock.
 */
import type { Grade } from './prep';

export type CutVerdict = 'perfect' | 'good' | 'regular' | 'fail';

export interface CutSpec {
  /** left edge and width of the green zone, as fractions of the bar (0..1) */
  start: number;
  width: number;
  /** bar lengths per second (the indicator goes one way in 1/speed seconds) */
  speed: number;
  /** seconds before an unattended cut counts as a miss */
  limit: number;
}

export interface CutDifficulty {
  /** 0 (very easy) .. 1 (hard) */
  level: number;
  /** the knife upgrade widens the zone */
  knife: boolean;
  /** 0, 1 or 2 knives owned: each widens the green zone a little (`knife` alone counts as one) */
  knives?: number;
}

/** Zone width and speed for a difficulty. Wide and slow when relaxed, narrow and fast when hard. */
export function cutSpec(d: CutDifficulty, rng: () => number, previousStart?: number): CutSpec {
  const level = Math.max(0, Math.min(1, d.level));
  const knives = d.knives ?? (d.knife ? 1 : 0);
  const width = Math.max(0.1, 0.3 - 0.15 * level + 0.05 * knives);
  const speed = 0.8 + 0.9 * level;
  // anywhere on the bar, but never the same place twice in a row
  const lo = 0.04, hi = 0.96 - width;
  let start = lo + rng() * (hi - lo);
  for (let i = 0; i < 6 && previousStart !== undefined && Math.abs(start - previousStart) < 0.18; i++) start = lo + rng() * (hi - lo);
  if (previousStart !== undefined && Math.abs(start - previousStart) < 0.18) start = previousStart < (lo + hi) / 2 ? hi : lo;
  return { start, width, speed, limit: 2.4 };
}

/** Where the indicator is after `t` seconds: a triangle wave between 0 and 1, so it bounces. */
export function indicatorAt(t: number, speed: number): number {
  const phase = ((t * speed) % 2 + 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/** Perfect in the middle of the zone, good in it, regular just outside, fail anywhere else. */
export function judgeCut(pos: number, spec: CutSpec): CutVerdict {
  const centre = spec.start + spec.width / 2;
  const off = Math.abs(pos - centre);
  if (off <= spec.width * 0.15) return 'perfect';
  if (off <= spec.width / 2) return 'good';
  if (off <= spec.width / 2 + 0.07) return 'regular';
  return 'fail';
}

export const VERDICT_GRADE: Record<CutVerdict, Grade> = { perfect: 3, good: 2, regular: 1, fail: 0 };

/** Cuts in a row at the start; the knives bring it down (Cuchillo de Spicy: 4, Cuchillo afilado: 3). */
export const BASE_CUTS = 5;
/** Relaxed mode starts with one cut fewer (a repeated bar is the dullest part of a long order); never fewer than two. */
export function cutsNeeded(upgrades: readonly string[], mode: 'relaxed' | 'normal' | 'challenge' = 'normal'): number {
  const base = mode === 'relaxed' ? BASE_CUTS - 1 : BASE_CUTS;
  return Math.max(2, base - (upgrades.includes('knife') ? 1 : 0) - (upgrades.includes('knife2') ? 1 : 0));
}
export const knivesOwned = (upgrades: readonly string[]): number => (upgrades.includes('knife') ? 1 : 0) + (upgrades.includes('knife2') ? 1 : 0);

/** The result of a whole series of cuts: the average of their grades, rounded to the nearest verdict. */
export function combineVerdicts(vs: readonly CutVerdict[]): CutVerdict {
  if (!vs.length) return 'fail';
  const mean = vs.reduce((n, v) => n + VERDICT_GRADE[v], 0) / vs.length;
  return mean >= 2.6 ? 'perfect' : mean >= 1.7 ? 'good' : mean >= 0.8 ? 'regular' : 'fail';
}

/** How hard the board is right now: the cooking mode and the time of day (the evening is busier). */
export function cutLevel(mode: 'relaxed' | 'normal' | 'challenge', period: number): number {
  const base = mode === 'relaxed' ? 0.1 : mode === 'challenge' ? 0.85 : 0.45;
  const rush = period === 0 ? 0.1 : period === 3 ? 0.08 : 0;
  return Math.max(0, Math.min(1, base + rush));
}
