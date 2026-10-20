/**
 * The restaurant's one kitchen: the model wired to the real game (stock, upgrades, recipes, save, orders).
 * Everything that is not rules lives here, so the model stays testable with plain objects.
 */
import { game } from '../core/state';
import { Galley, type GalleyEnv } from './model';
import { deliverDish } from './serve';

const env: GalleyEnv = {
  stock: {
    have: (id) => game.countUsable(id),
    take: (id) => game.consumeIngredients({ [id]: 1 }),
    give: (id) => { game.addItem(id, 1, 'refund'); },
  },
  upgrades: () => game.save.restaurant.upgrades,
  rng: () => Math.random(),
  known: (id) => game.save.recipesKnown.includes(id),
  deliver: (dish) => deliverDish(dish),
};

let kitchen: Galley | null = null;
let loadedFor: unknown = null;

/** The kitchen of the current save (it restores itself when another save is loaded). */
export function galley(): Galley {
  kitchen ??= new Galley(env);
  if (loadedFor !== game.save) { kitchen.restore(game.save.galley); loadedFor = game.save; }
  return kitchen;
}

/** Writes the kitchen into the save. Cheap: call after anything that changes it and now and then while cookers run. */
export function saveGalley() {
  if (!kitchen) return;
  game.save.galley = kitchen.snapshot();
  game.dirty = true;
}

export { galleyOn } from './mode';
