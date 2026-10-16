/**
 * Cooking as a short act: every recipe step becomes one or two "beats", each asking the player for one simple thing
 * (a tap on the beat, holding to the gold mark, choosing the right ingredients) while Sofi does the work in the kitchen.
 * Pure rules, no DOM and no scene: the recipe, the mode and the player's timing go in; precision and mistakes come out.
 */
import type { CookStep, RecipeDef } from '../data/recipes';

export type CookModeName = 'relaxed' | 'normal' | 'challenge';
export type PromptKind = 'tap' | 'rhythm' | 'hold' | 'items' | 'wait';
export type Station = 'board' | 'rice' | 'stove' | 'plate';

export interface Beat {
  kind: PromptKind;
  /** index of the recipe step this beat belongs to (the dish chip and the step chips follow it) */
  step: number;
  station: Station;
  title: string;
  hint: string;
  /** rhythm: how many pulses */
  pulses?: number;
  /** items: what must be placed (repeats allowed) */
  items?: string[];
  /** items: wrong ingredients that tempt the player in normal and challenge */
  decoys?: string[];
  /** hold: where on the 0..1 bar the gold mark sits */
  target?: number;
  /** wait: what the stove must hand back */
  wait?: string;
}

const DECOYS = ['avocado', 'cucumber', 'carrot', 'tuna', 'egg', 'crab'];

/** Beats for every step of a recipe, in order. `pot` = the rice of this dish comes from the rice pot. */
export function planBeats(recipe: RecipeDef, mode: CookModeName, pot: boolean): Beat[] {
  const out: Beat[] = [];
  let riceAsked = false;
  const decoys = (items: string[]) => (mode === 'relaxed' ? [] : DECOYS.filter((d) => !items.includes(d)).slice(0, mode === 'challenge' ? 2 : 1));
  recipe.steps.forEach((s: CookStep, step) => {
    if ((s.t === 'rice' || s.t === 'shape') && pot && !riceAsked) {
      riceAsked = true;
      out.push({ kind: 'wait', step, station: 'rice', title: 'Arroz', hint: 'Falta el arroz: ponelo en la olla (pestaña Plancha).', wait: 'rice' });
    }
    switch (s.t) {
      case 'cook': out.push({ kind: 'wait', step, station: 'stove', title: 'Cocinar', hint: 'Ponelo en la plancha y volvé cuando esté en su punto.', wait: s.item }); break;
      case 'nori': out.push({ kind: 'tap', step, station: 'board', title: 'Alga', hint: 'Tocá cuando el aro llegue al círculo.' }); break;
      case 'rice': out.push({ kind: 'hold', step, station: 'board', title: 'Extender el arroz', hint: 'Mantené apretado y soltá en la marca dorada.', target: 0.85 }); break;
      case 'place': out.push({ kind: 'items', step, station: 'board', title: 'Relleno', hint: 'Tocá cada ingrediente para ponerlo en el alga.', items: [...s.items], decoys: decoys(s.items) }); break;
      case 'roll': out.push({ kind: 'rhythm', step, station: 'board', title: 'Enrollar', hint: 'Tocá al ritmo: tres vueltas parejas.', pulses: 3 }); break;
      case 'cut': out.push({ kind: 'rhythm', step, station: 'board', title: 'Cortar', hint: 'Un toque por corte, justo cuando cae el cuchillo.', pulses: Math.max(2, Math.min(4, s.pieces - 1)) }); break;
      case 'slice': out.push({ kind: 'rhythm', step, station: 'board', title: `Cortar ${s.item === 'egg' ? 'el tamago' : 'el pescado'}`, hint: 'Un toque por lámina.', pulses: Math.max(2, Math.min(4, s.cuts)) }); break;
      case 'shape': for (let i = 0; i < Math.min(3, s.count); i++) out.push({ kind: 'hold', step, station: 'board', title: `Moldear ${i + 1}/${Math.min(3, s.count)}`, hint: 'Mantené apretado y soltá en la marca.', target: 0.7 }); break;
      case 'top': out.push({ kind: 'items', step, station: 'board', title: 'Cubrir', hint: 'Poné la cobertura sobre cada bolita.', items: [s.item, s.item], decoys: decoys([s.item]) }); break;
      case 'wrap': out.push({ kind: 'items', step, station: 'board', title: 'Envolver', hint: 'Una tira de alga por pieza.', items: ['nori', 'nori'], decoys: decoys(['nori']) }); break;
      case 'cone': out.push({ kind: 'hold', step, station: 'board', title: 'Armar el cono', hint: 'Mantené apretado y soltá en la marca.', target: 0.8 }); break;
      case 'garnish': out.push({ kind: 'items', step, station: 'board', title: 'Decorar', hint: 'Tocá cada ingrediente para decorar.', items: [...s.items], decoys: decoys(s.items) }); break;
      case 'plate': out.push({ kind: 'tap', step, station: 'plate', title: 'Emplatar', hint: 'Tocá cuando el aro llegue al círculo para servir.' }); break;
    }
  });
  return out;
}

/** Seconds between the pulses of a rhythm beat, and the grace around each one (a fraction of that period). */
export const pulsePeriod = (mode: CookModeName) => (mode === 'relaxed' ? 0.8 : mode === 'challenge' ? 0.46 : 0.62);
export const pulseGrace = (mode: CookModeName) => (mode === 'relaxed' ? 0.5 : mode === 'challenge' ? 0.28 : 0.38);

export type Verdict = 'perfect' | 'good' | 'ok' | 'miss';

/** How well a tap landed. `offset` is tap time minus the moment of the beat, in seconds (negative = early). */
export function pulseScore(offset: number, period: number, mode: CookModeName): { score: number; verdict: Verdict } {
  const grace = period * pulseGrace(mode);
  const x = Math.abs(offset) / grace;
  if (x > 1) return { score: mode === 'relaxed' ? 0.5 : 0.2, verdict: 'miss' };
  if (x < 0.3) return { score: 1, verdict: 'perfect' };
  if (x < 0.65) return { score: 0.8, verdict: 'good' };
  return { score: 0.6, verdict: 'ok' };
}

/** Seconds a hold needs to fill the whole bar. */
export const holdSeconds = (mode: CookModeName) => (mode === 'relaxed' ? 1.5 : mode === 'challenge' ? 0.9 : 1.15);
export const holdTolerance = (mode: CookModeName) => (mode === 'relaxed' ? 0.22 : mode === 'challenge' ? 0.1 : 0.16);

/** How close the release was to the gold mark, 0..1. An empty bar or an overflow never scores above "ok". */
export function holdScore(value: number, target: number, mode: CookModeName): { score: number; verdict: Verdict } {
  const tol = holdTolerance(mode);
  const x = Math.abs(value - target) / tol;
  if (value < 0.15) return { score: mode === 'relaxed' ? 0.5 : 0.2, verdict: 'miss' };
  if (x < 0.35) return { score: 1, verdict: 'perfect' };
  if (x < 0.7) return { score: 0.82, verdict: 'good' };
  if (x <= 1.15) return { score: 0.62, verdict: 'ok' };
  return { score: mode === 'relaxed' ? 0.5 : 0.25, verdict: 'miss' };
}

/** Choosing ingredients: wrong ones cost; the order does not matter. */
export function itemsScore(placed: number, wrong: number): number {
  if (placed <= 0) return 0;
  return Math.max(0.4, 1 - wrong * 0.2);
}

/** The tap beat is one pulse with a generous window. */
export const tapPeriod = (mode: CookModeName) => pulsePeriod(mode) * 1.15;


/** Each prompt rolls a small twist so no two feel the same: tempo, uneven rhythm, a target that hops, a bar that speeds up or drags. */
export type HoldCurve = 'linear' | 'in' | 'out' | 'surge';
export interface Twist {
  /** multiplies the tempo: above 1 is faster */
  speed: number;
  /** rhythm: spacing of each pulse relative to the period (1 = even) */
  gaps: number[];
  /** tap: the target hops to another spot after each pulse */
  jump: boolean;
  curve: HoldCurve;
  /** items: the ingredients change places after each pick */
  shuffle: boolean;
  /** hold: how far the gold mark is nudged from its usual place */
  nudge: number;
  /** short word shown while it starts */
  label: string;
}

const PATTERNS: number[][] = [[1, 1, 1, 1, 1], [1, 0.65, 1.35, 1, 1], [0.7, 0.7, 1.4, 0.7, 1.2], [1.3, 0.7, 1, 0.7, 1], [0.6, 1.4, 0.6, 1.4, 1]];

/** `rand` returns 0..1; pass a seeded one in tests. */
export function rollTwist(kind: PromptKind, mode: CookModeName, pulses: number, rand: () => number = Math.random): Twist {
  // never slower than the base pace: only quicker, by a different amount each time
  const lo = mode === 'relaxed' ? 1 : mode === 'challenge' ? 1.1 : 1.02;
  const hi = mode === 'relaxed' ? 1.3 : mode === 'challenge' ? 1.9 : 1.65;
  const speed = lo + rand() * (hi - lo);
  let gaps = new Array(Math.max(1, pulses)).fill(1);
  if (kind === 'rhythm' && mode !== 'relaxed') {
    const pick = PATTERNS[Math.floor(rand() * (mode === 'challenge' ? PATTERNS.length : 3))];
    gaps = Array.from({ length: Math.max(1, pulses) }, (_, i) => pick[i % pick.length]);
  }
  const curves: HoldCurve[] = mode === 'relaxed' ? ['linear'] : mode === 'challenge' ? ['in', 'out', 'surge', 'linear'] : ['linear', 'in', 'out'];
  const curve = kind === 'hold' ? curves[Math.floor(rand() * curves.length)] : 'linear';
  const jump = mode !== 'relaxed' && rand() < (mode === 'challenge' ? 0.7 : 0.4);
  const shuffle = mode !== 'relaxed' && rand() < (mode === 'challenge' ? 0.7 : 0.35);
  const nudge = mode === 'relaxed' ? 0 : (rand() - 0.5) * (mode === 'challenge' ? 0.2 : 0.14);
  const label = speed > 1.45 ? '¡Rápido!' : gaps.some((g) => g !== 1) ? 'Ritmo raro' : jump ? 'Ojo: se mueve' : curve === 'surge' ? 'Acelera' : '';
  return { speed, gaps, jump, curve, shuffle, nudge, label };
}

/** Progress of a hold bar for `r` = time held / time to fill, shaped by the curve. Past the full bar it keeps rising evenly. */
export function holdCurve(curve: HoldCurve, r: number): number {
  if (r <= 0) return 0;
  if (r >= 1) return r;
  switch (curve) {
    case 'in': return Math.pow(r, 1.7);
    case 'out': return 1 - Math.pow(1 - r, 1.7);
    case 'surge': return r < 0.5 ? r * 0.6 : 0.3 + (r - 0.5) * 1.4;
    default: return r;
  }
}
