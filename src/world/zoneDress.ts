/**
 * Which authored props belong on a tile. Wild flowers are dropped when the ground
 * cannot grow them. Mushrooms and reeds are only suggested for a damp natural bank.
 */

const WILD_FLOWER = new Set(['flowers', 'flowers_lav', 'farm_flowers']);

export function keepDressProp(id: string, ground: string | undefined): boolean {
  if (!WILD_FLOWER.has(id)) return true;
  return ground === 'g' || ground === 'G' || ground === 'o' || ground === 'r' || ground === 'y' || ground === 'l';
}

/** A mushroom on a forest or garden bank: natural ground, fresh water beside it, no path or deck. */
export function dampMushroom(ground: string | undefined, nearFresh: boolean, nearHard: boolean): boolean {
  return (ground === 'g' || ground === 'G') && nearFresh && !nearHard;
}

/** Reeds in the grass at the water, not on a walk. */
export function reedHere(ground: string | undefined, nearFresh: boolean, nearHard: boolean): boolean {
  return ground === 'g' && nearFresh && !nearHard;
}

/** A fishing net lies on the sand, next to a boat, not on the wood. */
export function netBeside(ground: string | undefined): boolean {
  return ground === 's';
}
