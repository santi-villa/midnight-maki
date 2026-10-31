/** Serene Village's natural props and low-contrast ground, with the same saved identities and footprints. */
import catalog from '../assets/serene/catalog.json';
import atlasURL from '../assets/serene/atlas.png';
import cliffURL from '../assets/map-study/cliffs.png';
import { ctx2d, makeCanvas, type Ctx } from './pixel';

export const SERENE_ATLAS_KEY = 'serene-village';
export const SERENE_ATLAS_URL = atlasURL;
export const VILLAGE_CLIFF_URL = cliffURL;
export const VILLAGE_CLIFF_KEY = 'village-cliffs';
let cliffs: CanvasImageSource | null = null;
export function installVillageCliffs(source: CanvasImageSource) { cliffs = source; }
export function drawVillageCliff(c: Ctx, x: number, y: number, part: number) {
  if (!cliffs) return false;
  c.drawImage(cliffs, part === 0 ? 0 : 16, 0, 16, 16, x, y, 16, 16);
  return true;
}
export const sereneWanted = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('serene') !== 'classic';

let atlas: CanvasImageSource | null = null;
const pieces = new Map<string, (typeof catalog.pieces)[number]>();
for (const piece of catalog.pieces) for (const id of piece.replaces) pieces.set(id, piece);

export function installSereneAtlas(source: CanvasImageSource) { atlas = source; }

export function drawSereneTile(c: Ctx, x: number, y: number, name: keyof typeof catalog.tiles): boolean {
  if (!atlas) return false;
  const f = catalog.tiles[name].atlas;
  c.drawImage(atlas, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
  return true;
}

/** Complete objects, never stretched. Preserve the world's bottom-centred pivot. */
export function sereneObject(id: string, width: number, height: number): HTMLCanvasElement | null {
  const piece = pieces.get(id);
  if (!atlas || !piece) return null;
  const f = piece.atlas;
  const w = Math.max(width, f.w), h = Math.max(height, f.h);
  const canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(atlas, f.x, f.y, f.w, f.h, Math.floor((w - f.w) / 2), h - f.h, f.w, f.h);
  return canvas;
}
