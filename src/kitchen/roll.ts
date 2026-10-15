/**
 * Rolling with the bamboo mat: drag up across the sheet, slowly. Progress needs real movement:
 * a stalled hand adds nothing and a violent swipe adds little. Mouse and finger are judged on their own scale.
 */
export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface RollState { progress: number; pressed: boolean; pressT: number; rushed: number; slow: number }
export const newRoll = (): RollState => ({ progress: 0, pressed: false, pressT: 0, rushed: 0, slow: 0 });

/** [min, ideal-max, hard-max] speed in "mat heights per second" */
export function speedBand(kind: PointerKind): [number, number, number] {
  return kind === 'touch' ? [0.07, 0.95, 1.9] : [0.05, 0.8, 1.6];
}

/** progress gained by moving `dy` (mat heights, up positive) in `dt` seconds */
export function rollGain(dy: number, dt: number, kind: PointerKind): { gain: number; verdict: 'ok' | 'fast' | 'slow' } {
  if (dy <= 0 || dt <= 0) return { gain: 0, verdict: 'slow' };
  const v = dy / dt, [lo, hi, max] = speedBand(kind);
  if (v < lo) return { gain: dy * 0.35, verdict: 'slow' };
  if (v <= hi) return { gain: dy, verdict: 'ok' };
  if (v >= max) return { gain: dy * 0.15, verdict: 'fast' };
  return { gain: dy * (1 - ((v - hi) / (max - hi)) * 0.85), verdict: 'fast' };
}

export function rollStep(s: RollState, dy: number, dt: number, kind: PointerKind): 'ok' | 'fast' | 'slow' {
  const r = rollGain(dy, dt, kind);
  s.progress = Math.min(1, s.progress + r.gain);
  if (r.verdict === 'fast') s.rushed += Math.abs(dy);
  else if (r.verdict === 'slow') s.slow += Math.abs(dy);
  return r.verdict;
}

/** 0..1: how gently the roll went (rushed travel hurts, slow does not) */
export function rollScore(s: RollState, pressOk: boolean): number {
  return Math.max(0, Math.min(1, 1 - s.rushed * 0.9)) * (pressOk ? 1 : 0.9);
}

/** the final squeeze: hold the press at least this long (s) */
export const PRESS_SECONDS = 0.6;
