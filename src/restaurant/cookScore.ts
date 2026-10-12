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
    const quality: 0 | 1 | 2 = input.mistakes <= 2 ? 2 : 1;
    return { quality, score: quality === 2 ? 100 : 70, label: LABELS[quality] };
  }
  const par = parSeconds(input.steps);
  const precision = clamp01(input.precision);
  const score = Math.min(100, Math.max(0, 100 - input.mistakes * 10 - Math.max(0, input.elapsed - par) * 1.5) + precision * 8);
  let quality: 0 | 1 | 2 = score >= 80 ? 2 : score >= 50 ? 1 : 0;
  if (input.mode === 'challenge' && input.timeLimit > 0 && input.elapsed <= input.timeLimit) {
    quality = Math.min(2, quality + 1) as 0 | 1 | 2;
  }
  return { quality, score: Math.round(score), label: LABELS[quality] };
}

/** How far a downward cut may sit from the dotted guide, in board pixels. */
export function guideTolerance(mode: CookMode): number {
  if (mode === 'relaxed') return 42;
  if (mode === 'challenge') return 16;
  return 24;
}

export function missCosts(mode: CookMode): boolean {
  return mode === 'challenge';
}

/** X of the next dotted cut. `needed` is how many cuts the step asks for. */
export function nextGuide(done: number, needed: number, x0: number, width: number): number | null {
  if (needed <= 0 || done >= needed || width <= 0) return null;
  const pieces = needed + 1;
  const index = done + 1;
  if (index >= pieces) return null;
  return x0 + (width / pieces) * index;
}

export function swipeCuts(dx: number, dy: number, x: number, guideX: number | null, tolerance: number): 'hit' | 'miss' | 'none' {
  const vertical = dy > 28 && Math.abs(dx) < 60;
  if (!vertical || guideX == null) return 'none';
  return Math.abs(x - guideX) <= tolerance ? 'hit' : 'miss';
}

/** Upward drag, in board pixels, toward a finished roll. Bamboo mat finishes sooner. */
export function rollFromDrag(upwardPx: number, bamboo: boolean): number {
  if (upwardPx <= 0) return 0;
  return (upwardPx / 150) * (bamboo ? 1.45 : 1);
}

export function heatWindow(mode: CookMode): { half: number; speed: number; giveUp: number } {
  if (mode === 'relaxed') return { half: 0.36, speed: 1.1, giveUp: 7 };
  if (mode === 'challenge') return { half: 0.12, speed: 2.2, giveUp: 12 };
  return { half: 0.2, speed: 1.6, giveUp: 9 };
}

/** 0..1 position of the cooking marker. The sweet spot is 0.5. */
export function heatMark(t: number, speed: number): number {
  return 0.5 + 0.42 * Math.sin(t * speed);
}

export function heatHit(mark: number, half: number): boolean {
  return Math.abs(mark - 0.5) <= half;
}

export function inPlate(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/** 1 at the center of the plate, 0 on the rim or outside. */
export function platePrecision(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  if (!inPlate(x, y, cx, cy, rx, ry)) return 0;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return clamp01(1 - Math.sqrt(nx * nx + ny * ny));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
