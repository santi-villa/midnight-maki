/** Hand-made 16×16 icons (Sushi 16×16 and Fishing Icon Pack 16×16, used with the owner's permission): one small atlas, see scripts/build-icon-assets.py. */
import catalog from '../assets/icons16/icons.json';
import atlasURL from '../assets/icons16/icons.png';
import { ctx2d, makeCanvas } from './pixel';

export const ICON_ATLAS_KEY = 'icon-art-source';
export const ICON_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
export function installIconAtlas(source: CanvasImageSource) { atlas = source; }

const cells = catalog.cells as unknown as Record<string, [number, number]>;

/** The icon as a 16×16 canvas, or null while the atlas is missing or the name is unknown (the drawn icon then stays). */
export function iconArtCanvas(name: string): HTMLCanvasElement | null {
  const at = cells[name];
  if (!atlas || !at) return null;
  const c = makeCanvas(16, 16);
  ctx2d(c).drawImage(atlas, at[0], at[1], 16, 16, 0, 0, 16, 16);
  return c;
}
