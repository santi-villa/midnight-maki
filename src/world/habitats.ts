/**
 * Where a wild flower or an ambient insect may be. A flower texture is not enough:
 * the ground under it has to be a place a plant would actually grow.
 * Pots and plaza planters are planted on purpose. They are not wild flowers.
 */

/** Grass, dark grass, soil and flower beds. */
const NATURAL = new Set(['g', 'G', 'o', 'r', 'y', 'l']);

export function wildFlowerGround(ground: string | undefined): boolean {
  return !!ground && NATURAL.has(ground);
}

/** Fresh water, not the sea. The sea is `d` only when a district says so; here `w` is the pond tile. */
export function freshWater(ground: string | undefined): boolean {
  return ground === 'w';
}

/**
 * A bee may visit this prop. Wild patches only grow on natural ground.
 * Plaza planters may sit on the civic paving. Nothing visits a dock, a bridge or the water,
 * and a wharf crate is cargo even when its name says flower.
 */
export function beeMayVisit(propId: string, ground: string | undefined): boolean {
  if (!ground || 'wdhSRCWVx#f'.includes(ground)) return false;
  if (ground === 'b' || propId.startsWith('wharf_')) return false;
  if (propId === 'flowers' || propId === 'flowers_lav' || propId === 'farm_flowers') return wildFlowerGround(ground);
  if (propId.startsWith('planter_')) return ground === 'c' || wildFlowerGround(ground);
  if (propId.startsWith('pot_')) return wildFlowerGround(ground);
  return wildFlowerGround(ground);
}

/** A butterfly can rest here: a garden bed, a lawn, or a planter that is not on the dock. */
export function butterflyGround(ground: string | undefined, planter: boolean): boolean {
  if (ground === 'b' || !ground || 'wdhSRC'.includes(ground)) return false;
  if (planter && (ground === 'c' || wildFlowerGround(ground))) return true;
  return wildFlowerGround(ground);
}

/** Night lights of the woods and gardens, never the paving or the water. */
export function fireflyGround(ground: string | undefined): boolean {
  return ground === 'g' || ground === 'G';
}

/** Beetles stay in the litter. Rain and deep winter keep almost all of them down. */
export function beetleCount(season: number, period: number, rain: boolean): number {
  if (rain) return 0;
  if (season === 3) return period >= 2 ? 1 : 0;
  if (period === 3) return 2;
  return 3;
}

export function beetleGround(ground: string | undefined, nearHard: boolean): boolean {
  return (ground === 'g' || ground === 'G') && !nearHard;
}
