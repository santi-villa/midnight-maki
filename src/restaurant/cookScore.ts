/**
 * Scoring for the sushi minigame. Pure: no DOM, no audio, no save.
 * Quality stays 0 | 1 | 2 so orders, tips and friendship keep their current bands.
 * Relaxed mode never drops below "good". Precision only nudges normal and challenge.
 */
export type CookMode = 'relaxed' | 'normal' | 'challenge';

export interface CookJudgeInput {
  mode: CookMode;
  mistakes: number;
  elapsed: number;
  steps: number;
  /** Challenge clock. 0 means there is no clock. */
  timeLimit: number;
  /** 0..1. Ignored while the mode is relaxed. */
  precision: number;
}

export interface CookJudgement {
  quality: 0 | 1 | 2;
  score: number;
  label: string;
}

const LABELS = ['¡Listo!', '¡Muy bien!', '¡Perfecto!'] as const;

export function parSeconds(steps: number): number {
  return 10 + Math.max(0, steps) * 7;
}

export function challengeLimit(steps: number): number {
  return 40 + Math.max(0, steps) * 12;
}

export function judgeCook(input: CookJudgeInput): CookJudgement {
  if (input.mode === 'relaxed') {
    // never below "good", and no clock. Technique still counts, so a careful dish beats a careless one.
    const score = Math.round(Math.max(55, Math.min(100, 62 + clamp01(input.precision) * 38 - Math.max(0, input.mistakes - 1) * 4)));
    const quality: 0 | 1 | 2 = score >= 82 ? 2 : 1;
    return { quality, score, label: LABELS[quality] };
  }
  const par = parSeconds(input.steps);
  const precision = clamp01(input.precision);
  const score = Math.min(100, Math.max(0, 100 - input.mistakes * 10 - Math.max(0, input.elapsed - par) * 1.5) + precision * 8);
  let quality: 0 | 1 | 2 = score >= 80 ? 2 : score >= 50 ? 1 : 0;
  if (input.mode === 'challenge' && input.timeLimit > 0) {
    // hard mode has a real clock: on time it lifts the dish a level, over time it cannot be better than "good"
    if (input.elapsed <= input.timeLimit) quality = Math.min(2, quality + 1) as 0 | 1 | 2;
    else quality = Math.min(1, quality) as 0 | 1 | 2;
  }
  return { quality, score: Math.round(score), label: LABELS[quality] };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
