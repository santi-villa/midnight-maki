/** Achievements with friendly names; some unlock cosmetic rewards. Checked on state changes (cheap). */
import { bus } from '../core/events';
import { game } from '../core/state';
import { RECIPES } from '../data/recipes';
import { FURNITURE } from '../data/furniture';
import { recipeStars } from '../restaurant/mastery';

export interface Achievement { id: string; name: string; desc: string; check: () => boolean; reward?: { clothes?: string[]; furniture?: string[] }; }

const s = (k: string) => game.save.stats[k] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_maki', name: 'Primer Maki', desc: 'Preparaste tu primer sushi.', check: () => game.save.restaurant.served + s('freeCooked') >= 1 },
  { id: 'chef', name: 'Chef Mapache', desc: 'Serviste 50 platos.', check: () => game.save.restaurant.served >= 50, reward: { clothes: ['hd_raccoon'] } },
  { id: 'friends', name: 'Amigos Inseparables', desc: 'Nivel 3 de amistad con los tres mapaches.', check: () => ['pip', 'spicy', 'rigg'].every((r) => game.friendLevel(r) >= 3), reward: { clothes: ['top_raccoon_hoodie'] } },
  { id: 'detectives', name: 'Detectives Nocturnos', desc: 'Resolviste tu primera deducción.', check: () => s('deductions') >= 1 },
  { id: 'decorator', name: 'Decoradora Profesional', desc: 'Colocaste 20 muebles.', check: () => s('decorPlaced') >= 20, reward: { furniture: ['rug_raccoon'] } },
  { id: 'queen', name: 'Reina del Sushi', desc: 'Descubriste 20 recetas.', check: () => game.save.recipesKnown.length >= 20 },
  { id: 'stars', name: 'Coleccionista de Estrellas', desc: 'Reuniste las tres estrellas.', check: () => ['star1', 'star2', 'star3'].every((x) => game.count(x) > 0) || game.has('story_done'), reward: { clothes: ['hd_star_clip', 'top_star_sweater'] } },
  { id: 'pip_treasure', name: 'El Tesoro de Pip', desc: 'Pip te regaló 5 tesoros.', check: () => s('pipTreasures') >= 5 },
  { id: 'spicy_ok', name: 'Picante, Pero No Tanto', desc: 'Serviste 5 platos picantes.', check: () => s('spicyServed') >= 5 },
  { id: 'rigg_right', name: 'Rigg Tenía Razón', desc: 'Resolviste todas las deducciones.', check: () => s('deductions') >= 4 },
  { id: 'fisher', name: 'Paciencia de Pescadora', desc: 'Pescaste 10 peces.', check: () => s('fishCaught') >= 10 },
  { id: 'bugs', name: 'Red Suave', desc: 'Atrapaste 5 insectos.', check: () => s('bugsCaught') >= 5 },
  { id: 'gardener', name: 'Manos Verdes', desc: 'Cosechaste 5 veces.', check: () => s('harvests') >= 5 },
  { id: 'photos', name: 'Recuerdos en Pixel', desc: 'Sacaste 5 fotos.', check: () => game.save.photos.length >= 5 },
  { id: 'mastery_one', name: 'Plato de Honor', desc: 'Dominaste una receta con cinco estrellas.', check: () => Object.keys(game.save.recipeMastery ?? {}).some((id) => recipeStars(id) >= 5) },
  { id: 'mastery_many', name: 'Manos de Cocinera', desc: 'Llegaste a tres estrellas en cinco recetas.', check: () => Object.keys(game.save.recipeMastery ?? {}).filter((id) => recipeStars(id) >= 3).length >= 5 },
  { id: 'town_helper', name: 'Vecina del Año', desc: 'Terminaste cinco etapas de proyectos del pueblo.', check: () => s('projectPhases') >= 5 },
  { id: 'errands', name: 'Siempre Ocupada', desc: 'Cumpliste diez encargos.', check: () => s('errandsDone') >= 10 },
  { id: 'all_recipes', name: 'El Gran Libro', desc: 'Cocinaste todas las recetas.', check: () => RECIPES.every((r) => (game.save.recipesCooked[r.id] ?? 0) > 0) },
  { id: 'rich', name: 'Ahorro de Mapache', desc: 'Juntaste 5000 monedas en total.', check: () => s('coinsEarned') >= 5000 },
  { id: 'story', name: 'Las Tres Estrellas', desc: 'Terminaste la historia principal.', check: () => game.has('story_done') },
  { id: 'furniture_all', name: 'Casa Llena', desc: 'Conseguiste 40 muebles distintos.', check: () => new Set([...Object.keys(game.save.furnitureOwned), ...Object.values(game.save.decor).flat().map((f) => f.id)]).size >= Math.min(40, FURNITURE.length) },
];

let t: ReturnType<typeof setTimeout> | undefined;
function checkAll() {
  if (!game.loaded) return;
  for (const a of ACHIEVEMENTS) {
    if (game.save.achievements.includes(a.id)) continue;
    let ok = false;
    try {
      ok = a.check();
    } catch {
      ok = false;
    }
    if (!ok) continue;
    game.save.achievements.push(a.id);
    for (const c of a.reward?.clothes ?? []) if (!game.save.clothesOwned.includes(c)) game.save.clothesOwned.push(c);
    for (const f of a.reward?.furniture ?? []) game.save.furnitureOwned[f] = (game.save.furnitureOwned[f] ?? 0) + 1;
    bus.emit('toast', { text: `Logro: ${a.name}${a.reward ? ' (¡con regalo!)' : ''}` });
    game.touch('achievement');
  }
}
bus.on('state:changed', () => {
  if (t) clearTimeout(t);
  t = setTimeout(checkAll, 600);
});
