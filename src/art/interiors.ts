/** Native-size sprites for the optional interior collection; one small shared atlas. */
import catalog from '../assets/interiors/catalog.json';
import atlasURL from '../assets/interiors/atlas.png';
import { ctx2d, makeCanvas } from './pixel';

export const INTERIOR_ATLAS_KEY = 'interior-source';
export const INTERIOR_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
const pieces = new Map(catalog.pieces.map((piece) => [piece.id, piece]));

export function installInteriorAtlas(source: CanvasImageSource) { atlas = source; }

export function interiorObject(id: string, width: number, height: number, rot: number): HTMLCanvasElement | null {
  const piece = pieces.get(id);
  if (!atlas || !piece) return null;
  const frame = piece.frames[((rot % piece.frames.length) + piece.frames.length) % piece.frames.length].atlas;
  const canvas = makeCanvas(width, height);
  // The catalog's footprints include the whole sprite; no fractional scaling of its pixels.
  ctx2d(canvas).drawImage(atlas, frame.x, frame.y, frame.w, frame.h,
    Math.floor((width - frame.w) / 2), height - frame.h, frame.w, frame.h);
  return canvas;
}
