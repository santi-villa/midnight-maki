import type { IconSpec } from '../art/icons';
import { game } from '../core/state';

export interface DrinkDef { id: string; name: string; price: number; xp: number; ingredients: Record<string, number>; icon: IconSpec; steps: string[] }
export const DRINKS: DrinkDef[] = [
  { id: 'green_tea', name: 'Té verde', price: 9, xp: 2, ingredients: { tea_leaves: 1 }, icon: { type: 'tea', c1: '#91ab69' }, steps: ['Elegí la taza', 'Dosificá el té'] },
  { id: 'ramune', name: 'Ramune', price: 11, xp: 2, ingredients: { ramune_bottle: 1 }, icon: { type: 'bottle', c1: '#78adb6' }, steps: ['Sacá la botella', 'Abrí la bolita', 'Serví despacio'] },
  { id: 'strawberry_milk', name: 'Leche de frutilla', price: 14, xp: 3, ingredients: { milk: 1, berry: 1 }, icon: { type: 'tea', c1: '#df9baa' }, steps: ['Mezclá leche y frutilla', 'Llená el vaso'] },
];
export const DRINK_BY_ID = Object.fromEntries(DRINKS.map(d => [d.id, d]));
export const drinksUnlocked = () => game.has('intro_done') && game.save.restaurant.level >= 2;
export const canPrepareDrink = (id: string) => !!DRINK_BY_ID[id] && Object.entries(DRINK_BY_ID[id].ingredients).every(([item, n]) => game.countUsable(item) >= n);
