/** Native-size sprites for the optional interior collection; one small shared atlas. */
import catalog from '../assets/interiors/catalog.json';
import atlasURL from '../assets/interiors/atlas.png';
import { ctx2d, makeCanvas } from './pixel';
import { INTERIOR_REPLACEMENTS } from './interiorReplacements';

export const INTERIOR_ATLAS_KEY = 'interior-source';
export const INTERIOR_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
const pieces = new Map(catalog.pieces.map((piece) => [piece.id, piece]));

export function installInteriorAtlas(source: CanvasImageSource) { atlas = source; }

export function interiorObject(id: string, width: number, height: number, rot: number): HTMLCanvasElement | null {
  const replacement = INTERIOR_REPLACEMENTS[id];
  const piece = pieces.get(replacement ?? id);
  if (!atlas || !piece) return null;
  const frame = piece.frames[((rot % piece.frames.length) + piece.frames.length) % piece.frames.length].atlas;
  const canvas = makeCanvas(width, height);
  // Native pieces retain their pixels. Legacy pieces fit proportionally into their saved footprint.
  const scale = replacement ? Math.min(1, width / frame.w, height / frame.h) : 1;
  const w = Math.max(1, Math.round(frame.w * scale)), h = Math.max(1, Math.round(frame.h * scale));
  ctx2d(canvas).drawImage(atlas, frame.x, frame.y, frame.w, frame.h,
    Math.floor((width - w) / 2), height - h, w, h);
  return canvas;
}
