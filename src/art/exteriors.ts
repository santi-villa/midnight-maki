/**
 * LimeZu "Modern Exteriors" pieces (scripts/build-limezu-exteriors.py): ground tiles drawn into the shared tileset (sand,
 * the animated sea and its waterline) and props drawn at native size. Saved IDs, footprints and behaviour stay the same;
 * only the drawing changes. `?exteriors=classic` keeps the previous art for comparison.
 */
import { packJson, packUrl, type PackPiece } from './packs';

const catalog = packJson('limezu/exteriors.json', { tiles: {} as Record<string, { atlas: { x: number; y: number } }>, pieces: [] as PackPiece[], sandPalette: undefined as unknown });
const atlasURL = packUrl('limezu/exteriors.png');
import { ctx2d, makeCanvas, type Ctx } from './pixel';

export const EXTERIOR_ATLAS_KEY = 'limezu-exteriors';
export const EXTERIOR_ATLAS_URL = atlasURL ?? '';
export const exteriorsWanted = () => !!atlasURL && (typeof location === 'undefined' || new URLSearchParams(location.search).get('exteriors') !== 'classic');

let atlas: CanvasImageSource | null = null;
const tiles = catalog.tiles as Record<string, { atlas: { x: number; y: number } }>;
const pieceFor = new Map<string, PackPiece>();
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

/**
 * The pack's sand castles are sand on sand: almost the same beige as the ground, so on the beach they melt into it. Their
 * lightness is stretched over a warm brown (shadows and outline) and a bright sand (lit side); the shading stays the pack's own.
 */
const CASTLE_DARK = [112, 78, 46];
const CASTLE_LIGHT = [246, 226, 178];
const CASTLE_LO = 0.42;
const CASTLE_HI = 0.9;
export function warmSandPieces(rgba: Uint8ClampedArray) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const l = (0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2]) / 255;
    const t = Math.max(0, Math.min(1, (l - CASTLE_LO) / (CASTLE_HI - CASTLE_LO)));
    for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(CASTLE_DARK[k] + (CASTLE_LIGHT[k] - CASTLE_DARK[k]) * t);
  }
}

/** Native pixels, never scaled: bottom-centred in the footprint; a taller or wider piece grows the canvas around it. */
export function exteriorObject(id: string, width: number, height: number): HTMLCanvasElement | null {
  const piece = pieceFor.get(id);
  if (!atlas || !piece) return null;
  const f = piece.atlas;
  const w = Math.max(width, f.w);
  const h = Math.max(height, f.h);
  const canvas = makeCanvas(w, h);
  const g = ctx2d(canvas);
  const x0 = Math.floor((w - f.w) / 2);
  g.drawImage(atlas, f.x, f.y, f.w, f.h, x0, h - f.h, f.w, f.h);
  if (piece.id.includes('sandcastle')) {
    const img = g.getImageData(0, 0, w, h);
    warmSandPieces(img.data);
    g.putImageData(img, 0, 0);
  }
  return canvas;
}
