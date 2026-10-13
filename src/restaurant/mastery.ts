/**
 * Recipe mastery: 0..5 stars earned by consistent quality, not by repeating a dish.
 * Pure (the save is touched only by recordMastery). Mastered recipes can be made in one tap ("Rápido"),
 * which never raises mastery itself, so the shortcut cannot be farmed.
 */
import { game } from '../core/state';

export interface Mastery {
  /** dishes cooked on the board */
  n: number;
  /** good or perfect */
  g: number;
  /** perfect */
  p: number;
}

export type Stars = 0 | 1 | 2 | 3 | 4 | 5;

export const QUICK_STARS = 3;

export function masteryStars(m?: Mastery): Stars {
  if (!m || m.n < 1) return 0;
  if (m.n >= 20 && m.p >= 14) return 5;
  if (m.n >= 12 && m.p >= 7) return 4;
  if (m.n >= 6 && m.p >= 3) return 3;
  if (m.n >= 3 && m.g >= 2) return 2;
  return 1;
}

/** What the next star asks for, in words. */
export function nextStarGoal(m?: Mastery): string | null {
  const s = masteryStars(m);
  const n = m?.n ?? 0;
  const p = m?.p ?? 0;
  switch (s) {
    case 0: return 'Preparala una vez.';
    case 1: return `Hacela ${Math.max(0, 3 - n)} vez/veces más con buen resultado.`;
    case 2: return `${Math.max(0, 6 - n)} platos más y ${Math.max(0, 3 - p)} perfectos.`;
    case 3: return `${Math.max(0, 12 - n)} platos más y ${Math.max(0, 7 - p)} perfectos.`;
    case 4: return `${Math.max(0, 20 - n)} platos más y ${Math.max(0, 14 - p)} perfectos.`;
    default: return null;
  }
}

export function starsText(s: number): string {
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}

/** The quality a one-tap dish gets, or null while the recipe is not mastered enough. */
export function quickQuality(s: Stars): 1 | 2 | null {
  if (s < QUICK_STARS) return null;
  return s >= 5 ? 2 : 1;
}

export function mastery(recipe: string): Mastery | undefined {
  return game.save.recipeMastery?.[recipe];
}

export function recipeStars(recipe: string): Stars {
  return masteryStars(mastery(recipe));
}

/** Counts a dish cooked by hand. Returns the stars before and after. */
export function recordMastery(recipe: string, quality: 0 | 1 | 2): { before: Stars; after: Stars } {
  const s = game.save;
  if (!s.recipeMastery) s.recipeMastery = {};
  const m = s.recipeMastery[recipe] ?? { n: 0, g: 0, p: 0 };
  const before = masteryStars(m);
  m.n++;
  if (quality >= 1) m.g++;
  if (quality === 2) m.p++;
  s.recipeMastery[recipe] = m;
  game.touch('mastery');
  return { before, after: masteryStars(m) };
}
