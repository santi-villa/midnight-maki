/** Collection records count successful manual preparations, independently of serving. */
import { game } from '../core/state';
import type { RecipePresentation, RecipeRecord } from '../core/types';
import { RECIPES_BY_ID } from '../data/recipes';
import { recipeStars } from './mastery';

export const PRESENTATIONS: { id: RecipePresentation; name: string; stars: number; desc: string }[] = [
  { id: 'classic', name: 'Cerámica del pueblo', stars: 0, desc: 'Borde verde y esmalte cálido.' },
  { id: 'indigo', name: 'Porcelana índigo', stars: 2, desc: 'Azul profundo y pequeños trazos blancos.' },
  { id: 'sakura', name: 'Flor de sakura', stars: 3, desc: 'Esmalte rosado con pétalos en el borde.' },
  { id: 'gold', name: 'Plato de honor', stars: 5, desc: 'Cerámica oscura con un borde dorado.' },
];

export function recipeRecord(id: string): RecipeRecord | undefined {
  return game.save.recipeRecords?.[id];
}

export function recipePresentation(id: string): RecipePresentation {
  const selected = recipeRecord(id)?.presentation;
  const style = PRESENTATIONS.find((p) => p.id === selected);
  return style && recipeStars(id) >= style.stars ? style.id : 'classic';
}

export function selectRecipePresentation(id: string, presentation: RecipePresentation): boolean {
  const style = PRESENTATIONS.find((p) => p.id === presentation);
  if (!RECIPES_BY_ID[id] || !game.save.recipesKnown.includes(id) || !style || recipeStars(id) < style.stars) return false;
  game.save.recipeRecords ??= {};
  const record = game.save.recipeRecords[id] ?? { variants: {} };
  record.presentation = presentation;
  game.save.recipeRecords[id] = record;
  game.touch('recipe:presentation');
  return true;
}

/** Quick dishes and cancellations never call this function. Scores are on the existing 0–100 scale. */
export function recordRecipeResult(id: string, result: { score: number; quality: 0 | 1 | 2; variant?: string; variantItem?: string }): { newBest: boolean; discovered?: string } {
  const recipe = RECIPES_BY_ID[id];
  if (!recipe || !Number.isFinite(result.score) || ![0, 1, 2].includes(result.quality)) return { newBest: false };
  game.save.recipeRecords ??= {};
  const record = game.save.recipeRecords[id] ?? { variants: {} };
  const score = Math.round(Math.max(0, Math.min(100, result.score)));
  const newBest = record.bestScore === undefined || score > record.bestScore;
  if (newBest) {
    record.bestScore = score;
    record.bestDay = game.save.time.day;
  }
  record.bestQuality = Math.max(record.bestQuality ?? 0, result.quality) as 0 | 1 | 2;
  const variant = recipe.variants?.find((v) => result.variantItem ? v.item === result.variantItem : v.name === result.variant);
  let discovered: string | undefined;
  if (variant) {
    const previous = record.variants[variant.item];
    if (!previous) discovered = variant.name;
    record.variants[variant.item] = { count: (previous?.count ?? 0) + 1, bestScore: Math.max(previous?.bestScore ?? 0, score) };
  }
  game.save.recipeRecords[id] = record;
  game.touch('recipe:record');
  return { newBest, discovered };
}
