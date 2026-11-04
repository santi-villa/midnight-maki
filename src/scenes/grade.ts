/**
 * The colour of the hour, applied to the whole picture by a camera ColorMatrix filter (Phaser 4): a warm, slightly fresh
 * morning, a neutral afternoon, a golden dusk and a cool blue night; the rain greys it a little. Each part of the day
 * slides into the next during its last third, so the change is never a jump. Pure numbers, tested in grade.test.ts.
 */
export interface Grade { r: number; g: number; b: number; sat: number }

/** period: 0 morning, 1 afternoon, 2 dusk, 3 night. */
const BY_PERIOD: Grade[] = [
  { r: 1.03, g: 1.01, b: 0.98, sat: 1.04 },
  { r: 1.0, g: 1.0, b: 1.0, sat: 1.03 },
  { r: 1.05, g: 0.99, b: 0.93, sat: 1.05 },
  { r: 0.93, g: 0.98, b: 1.07, sat: 0.9 },
];
export const NEUTRAL: Grade = { r: 1, g: 1, b: 1, sat: 1 };

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** The grade for a moment of the day (`prog` 0..1 through the period). Indoors it stays neutral: rooms have their own light. */
export function gradeAt(period: number, prog: number, rain: boolean, outdoor: boolean): Grade {
  if (!outdoor) return NEUTRAL;
  const p = ((period % 4) + 4) % 4;
  const a = BY_PERIOD[p], b = BY_PERIOD[(p + 1) % 4];
  const t = Math.max(0, Math.min(1, (prog - 2 / 3) * 3));
  const k = t * t * (3 - 2 * t);
  const g: Grade = { r: mix(a.r, b.r, k), g: mix(a.g, b.g, k), b: mix(a.b, b.b, k), sat: mix(a.sat, b.sat, k) };
  if (rain) { g.sat *= 0.82; g.r *= 0.97; g.b *= 1.02; }
  return g;
}

/**
 * The 4×5 colour matrix (row-major, as Phaser's ColorMatrix takes it): saturation around the luminance, then a gain per
 * channel. Alpha untouched, no offsets.
 */
export function gradeMatrix(g: Grade): number[] {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722, s = g.sat;
  const row = (gain: number, own: 0 | 1 | 2) => {
    const w = [lr * (1 - s), lg * (1 - s), lb * (1 - s)];
    w[own] += s;
    return [w[0] * gain, w[1] * gain, w[2] * gain, 0, 0];
  };
  return [...row(g.r, 0), ...row(g.g, 1), ...row(g.b, 2), 0, 0, 0, 1, 0];
}

/** A short key, so the matrix is only sent again when the grade really changed. */
export function gradeKey(g: Grade) { return [g.r, g.g, g.b, g.sat].map((v) => v.toFixed(3)).join(','); }
