/** Native-size sprites for the optional interior collection; one small shared atlas. */
import catalog from '../assets/interiors/catalog.json';
import atlasURL from '../assets/interiors/atlas.png';
import { ctx2d, makeCanvas } from './pixel';
import { INTERIOR_REPLACEMENTS } from './interiorReplacements';
import limezu from '../assets/limezu/catalog.json';
import limezuURL from '../assets/limezu/atlas.png';

export const INTERIOR_ATLAS_KEY = 'interior-source';
export const INTERIOR_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
const pieces = new Map(catalog.pieces.map((piece) => [piece.id, piece]));

export function installInteriorAtlas(source: CanvasImageSource) { atlas = source; }

/**
 * LimeZu "Modern Interiors" pieces (scripts/build-limezu-assets.py) dress existing furniture IDs. Saved IDs, footprints and
 * behaviour stay the same; only the drawing changes. `?interiors=classic` keeps the previous art for comparison.
 */
export const LIMEZU_ATLAS_KEY = 'limezu-source';
export const LIMEZU_ATLAS_URL = limezuURL;
let lzAtlas: CanvasImageSource | null = null;
const lzFor = new Map<string, (typeof limezu.pieces)[number]>();
for (const piece of limezu.pieces) for (const id of piece.replaces) lzFor.set(id, piece);
export const limezuWanted = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('interiors') !== 'classic';
export function installLimezuAtlas(source: CanvasImageSource) { lzAtlas = source; }

/** Native pixels, never scaled: bottom-centred in the footprint; a taller or wider piece grows the canvas around it. */
function limezuObject(id: string, width: number, height: number, rot: number): HTMLCanvasElement | null {
  const piece = lzFor.get(id);
  if (!lzAtlas || !piece) return null;
  // a piece drawn in one direction only cannot stand turned sideways: keep the previous art there
  if (piece.frames.length < 4 && rot % 2 === 1) return null;
  const frame = piece.frames[((rot % piece.frames.length) + piece.frames.length) % piece.frames.length].atlas;
  const w = Math.max(width, frame.w);
  const h = Math.max(height, frame.h);
  const canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(lzAtlas, frame.x, frame.y, frame.w, frame.h, Math.floor((w - frame.w) / 2), h - frame.h, frame.w, frame.h);
  return canvas;
}

/** Room Builder floors (by decor floor style): a seamless 2x2 block; quarter q = x % 2 + 2 * (y % 2). */
const lzFloors = (limezu as { floors?: Record<string, { atlas: { x: number; y: number }; whole?: boolean }> }).floors ?? {};
export const LIMEZU_FLOORS = Object.keys(lzFloors);
export const hasLimezuFloor = (style: string) => !!lzAtlas && !!lzFloors[style];
export function drawLimezuFloor(c: CanvasRenderingContext2D, x: number, y: number, style: string, q: number): boolean {
  const f = lzFloors[style];
  if (!lzAtlas || !f) return false;
  // Room Builder floors repeat their seamless middle column; a whole mat (tatami) uses all four quarters
  c.drawImage(lzAtlas, f.atlas.x + (f.whole ? (q % 2) * 16 : 16), f.atlas.y + (q >> 1) * 16, 16, 16, x, y, 16, 16);
  return true;
}

/** True when this furniture ID is drawn by a LimeZu piece (the piece already has its own rotations). */
export const hasLimezu = (id: string) => !!lzAtlas && lzFor.has(id);

export function interiorObject(id: string, width: number, height: number, rot: number): HTMLCanvasElement | null {
  const lz = limezuObject(id, width, height, rot);
  if (lz) return lz;
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
