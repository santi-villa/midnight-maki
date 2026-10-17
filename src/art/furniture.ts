/** One renderer for world sprites, shop previews and the decoration editor. */
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { cozyObject } from './cozyAssets';
import { interiorObject } from './interiors';
import { drawObject } from './objects';

export function furnitureCanvas(id: string, rot = 0): HTMLCanvasElement {
  const def = FURN_BY_ID[id];
  const variant = def.rotatable ? rot : def.variant ?? 0;
  const size = furnSize(def, rot);
  const width = size.w * 16;
  const height = Math.max(def.sh, size.h * 16);
  return interiorObject(id, width, height, variant)
    ?? cozyObject(id, width, height, variant)
    ?? drawObject(def.kind, width, height, def.c1, def.c2 || def.c1, variant, seed(id));
}

function seed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}
