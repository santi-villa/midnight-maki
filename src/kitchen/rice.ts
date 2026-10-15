/**
 * Rice on the nori: a coverage mask the player fills by rubbing the rice ball across the sheet.
 * Strokes (left-right or circular) lay rice where the hand passes; staying put or going fast covers less.
 */
export const RICE_W = 32;
export const RICE_H = 16;

export interface RiceMask {
  v: Float32Array;
  /** rice still left in the ball, in "cell units" */
  left: number;
  travel: number;
}

export function newMask(supply = RICE_W * RICE_H * 1.7): RiceMask {
  return { v: new Float32Array(RICE_W * RICE_H), left: supply, travel: 0 };
}

/** Lays rice along a stroke from (x0,y0) to (x1,y1), given in 0..1 of the sheet. Returns how much was laid. */
export function spread(m: RiceMask, x0: number, y0: number, x1: number, y1: number, radius = 0.075): number {
  const dist = Math.hypot((x1 - x0) * RICE_W, (y1 - y0) * RICE_H);
  if (dist < 0.05 || m.left <= 0) return 0;
  m.travel += dist;
  const steps = Math.max(1, Math.ceil(dist * 2));
  const gain = Math.min(0.6, 0.22 + dist / steps * 0.08);
  let laid = 0;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, cx = (x0 + (x1 - x0) * t) * RICE_W, cy = (y0 + (y1 - y0) * t) * RICE_H;
    const rx = radius * RICE_W, ry = radius * RICE_W * 0.8;
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(RICE_H - 1, Math.ceil(cy + ry)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(RICE_W - 1, Math.ceil(cx + rx)); x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d > 1) continue;
        const i = y * RICE_W + x;
        if (m.v[i] >= 1.25) continue;
        const add = gain * (1 - d * 0.5) * 0.35;
        m.v[i] += add; m.left -= add * 0.35; laid += add;
      }
    }
  }
  return laid;
}

export interface RiceStats { coverage: number; thick: number; even: number; ok: boolean }
/** coverage: share of cells holding rice; thick: share too thick; even: 0..1 */
export function riceStats(m: RiceMask): RiceStats {
  let cov = 0, thick = 0, sum = 0, sum2 = 0;
  for (const v of m.v) {
    if (v >= 0.4) cov++;
    if (v > 1.05) thick++;
    sum += Math.min(v, 1.25); sum2 += Math.min(v, 1.25) ** 2;
  }
  const n = m.v.length, mean = sum / n, varc = Math.max(0, sum2 / n - mean * mean);
  const coverage = cov / n, thickShare = thick / n;
  const even = Math.max(0, Math.min(1, 1 - Math.sqrt(varc) * 1.2));
  return { coverage, thick: thickShare, even, ok: coverage >= 0.8 };
}

/** 0..1 precision for scoring: ideal coverage is 80–92%, a thin or heaped spread loses points */
export function riceScore(s: RiceStats): number {
  const cov = s.coverage >= 0.8 ? 1 : Math.max(0, s.coverage / 0.8);
  const heap = Math.max(0, 1 - s.thick * 1.5);
  return Math.max(0, Math.min(1, cov * 0.6 + heap * 0.2 + s.even * 0.2));
}
