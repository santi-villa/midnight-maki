/**
 * Pure rules of the griddle/pan station. A piece cooks from 0 to 1; where it sits on that bar says
 * how it came out. It burns, but slowly: there is a long window to take it off.
 */
export type GrillZone = 'raw' | 'ready' | 'over' | 'burnt';
export type CookMode = 'relaxed' | 'normal' | 'challenge';

/** edges of the zones on the 0..1 bar */
export const ZONES = { ready: 0.3, over: 0.72, burnt: 0.9 } as const;

/** Seconds to travel the whole bar for each ingredient (longer in Relajado). */
const BASE_SECONDS: Record<string, number> = { egg: 38, shrimp: 42, eel: 46, salmon: 40, rice: 28 };

export function grillSeconds(item: string, mode: CookMode): number {
  const base = BASE_SECONDS[item] ?? 42;
  return mode === 'relaxed' ? base * 1.5 : mode === 'challenge' ? base * 0.8 : base;
}

export function grillZone(p: number): GrillZone {
  return p < ZONES.ready ? 'raw' : p < ZONES.over ? 'ready' : p < ZONES.burnt ? 'over' : 'burnt';
}

/** Advances a piece; it keeps cooking (and burning) up to 1.15, never past it. */
export function grillAdvance(p: number, dt: number, item: string, mode: CookMode): number {
  return Math.min(1.15, p + dt / grillSeconds(item, mode));
}

export interface Doneness { zone: GrillZone; score: number; mistake: boolean; label: string }

/** How a piece taken off at `p` turned out: score 0..1 feeds the dish precision, bad ones count as a mistake. */
export function doneness(p: number): Doneness {
  const zone = grillZone(p);
  if (zone === 'raw') return { zone, score: Math.max(0.15, 0.55 * (p / ZONES.ready)), mistake: true, label: 'Le faltó cocción' };
  if (zone === 'ready') return { zone, score: 1, mistake: false, label: 'En su punto' };
  if (zone === 'over') return { zone, score: 0.7, mistake: false, label: 'Un poquito pasado' };
  return { zone, score: 0.2, mistake: true, label: 'Quemado' };
}
