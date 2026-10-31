/**
 * LimeZu "Modern Exteriors" pieces (scripts/build-limezu-exteriors.py): ground tiles drawn into the shared tileset (sand,
 * the animated sea and its waterline) and props drawn at native size. Saved IDs, footprints and behaviour stay the same;
 * only the drawing changes. `?exteriors=classic` keeps the previous art for comparison.
 */
import catalog from '../assets/limezu/exteriors.json';
import atlasURL from '../assets/limezu/exteriors.png';
import { ctx2d, makeCanvas, type Ctx } from './pixel';

export const EXTERIOR_ATLAS_KEY = 'limezu-exteriors';
export const EXTERIOR_ATLAS_URL = atlasURL;
export const exteriorsWanted = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('exteriors') !== 'classic';

let atlas: CanvasImageSource | null = null;
const tiles = catalog.tiles as Record<string, { atlas: { x: number; y: number } }>;
const pieceFor = new Map<string, (typeof catalog.pieces)[number]>();
for (const piece of catalog.pieces) for (const id of piece.replaces) pieceFor.set(id, piece);

export function installExteriorAtlas(source: CanvasImageSource) { atlas = source; }
export const hasExteriors = () => !!atlas;

/** Animation frames of the sea and of its waterline (the pack's own timing: 8 frames). */
export const SEA_FRAMES = 8;

/** Draws one ground tile of the pack into the tileset; false when the atlas is missing (the caller keeps its own art). */
export function drawExteriorTile(c: Ctx, x: number, y: number, name: string): boolean {
  const t = tiles[name];
  if (!atlas || !t) return false;
  c.drawImage(atlas, t.atlas.x, t.atlas.y, 16, 16, x, y, 16, 16);
  return true;
}

/** Native pixels, never scaled: bottom-centred in the footprint; a taller or wider piece grows the canvas around it. */
export function exteriorObject(id: string, width: number, height: number): HTMLCanvasElement | null {
  const piece = pieceFor.get(id);
  if (!atlas || !piece) return null;
  const f = piece.atlas;
  const w = Math.max(width, f.w);
  const h = Math.max(height, f.h);
  const canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(atlas, f.x, f.y, f.w, f.h, Math.floor((w - f.w) / 2), h - f.h, f.w, f.h);
  return canvas;
}
