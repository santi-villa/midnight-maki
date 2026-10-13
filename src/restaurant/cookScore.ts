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

// ------------------------------------------------------------------ rice, pressure and cuts (pure, shared with the board)
export const RICE_COLS = 24;
export const RICE_ROWS = 10;
export const RICE_MAX_LAYERS = 3;

/** Share of the mat that has rice, and the average number of layers on the covered cells. */
export function riceStats(cells: ArrayLike<number>): { coverage: number; mean: number } {
  let covered = 0;
  let sum = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] > 0) {
      covered++;
      sum += cells[i];
    }
  }
  return { coverage: cells.length ? covered / cells.length : 0, mean: covered ? sum / covered : 0 };
}

export type RiceKind = 'thin' | 'good' | 'thick';

/** 2 layers is the ideal; the good band is wide so nobody has to count. */
export function riceVerdict(mean: number): { kind: RiceKind; prec: number } {
  const kind: RiceKind = mean < 1.55 ? 'thin' : mean > 2.55 ? 'thick' : 'good';
  return { kind, prec: clamp01(1 - Math.max(0, Math.abs(mean - 2.05) - 0.5) / 1.1) };
}

export type PressKind = 'loose' | 'firm' | 'squeezed';

/** Sweet zone of the roll pressure meter (0..1). Relaxed is wide, challenge narrow. */
export function pressZone(mode: CookMode): { lo: number; hi: number } {
  if (mode === 'relaxed') return { lo: 0.42, hi: 0.92 };
  if (mode === 'challenge') return { lo: 0.62, hi: 0.8 };
  return { lo: 0.52, hi: 0.84 };
}

/** How fast the meter fills while the finger is down, in units per second. */
export function pressRate(mode: CookMode): number {
  return mode === 'challenge' ? 0.9 : mode === 'relaxed' ? 0.55 : 0.72;
}

export function pressVerdict(p: number, mode: CookMode): { kind: PressKind; prec: number } {
  const z = pressZone(mode);
  if (p < z.lo) return { kind: 'loose', prec: clamp01(0.25 + (p / z.lo) * 0.45) };
  if (p > z.hi) return { kind: 'squeezed', prec: clamp01(0.7 - (p - z.hi) * 2.5) };
  const mid = (z.lo + z.hi) / 2;
  return { kind: 'firm', prec: clamp01(0.85 + (1 - Math.abs(p - mid) / ((z.hi - z.lo) / 2)) * 0.15) };
}

/** Widths of the pieces left by cuts at the given x positions across [x0, x0 + width]. */
export function cutWidths(cuts: number[], x0: number, width: number): number[] {
  const xs = [x0, ...[...cuts].sort((a, b) => a - b).map((x) => Math.max(x0, Math.min(x0 + width, x))), x0 + width];
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

/** 1 when every piece has the same width, falling toward 0 as they differ. */
export function evenness(widths: number[]): number {
  if (widths.length < 2) return 1;
  const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  if (mean <= 0) return 0;
  const dev = widths.reduce((a, b) => a + Math.abs(b - mean), 0) / widths.length / mean;
  return clamp01(1 - dev * 1.6);
}
