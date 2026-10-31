/** Selected free Japanese City props. Native pixels; no terrain or facade replacement. */
import catalog from '../assets/japanese-city/catalog.json';
import atlasURL from '../assets/japanese-city/atlas.png';
import { ctx2d, makeCanvas } from './pixel';

export const JAPANESE_CITY_ATLAS_KEY = 'japanese-city';
export const JAPANESE_CITY_ATLAS_URL = atlasURL;
export const japaneseCityWanted = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('japaneseCity') !== 'classic';

let atlas: CanvasImageSource | null = null;
const pieces = new Map<string, (typeof catalog.pieces)[number]>();
for (const piece of catalog.pieces) for (const id of piece.replaces) pieces.set(id, piece);

export function installJapaneseCityAtlas(source: CanvasImageSource) { atlas = source; }

/** Keep the same bottom-centred pivot as every world prop; missing atlas uses the normal fallback. */
export function japaneseCityObject(id: string, width: number, height: number): HTMLCanvasElement | null {
  const piece = pieces.get(id);
  if (!atlas || !piece) return null;
  const f = piece.atlas;
  const w = Math.max(width, f.w), h = Math.max(height, f.h);
  const canvas = makeCanvas(w, h);
  ctx2d(canvas).drawImage(atlas, f.x, f.y, f.w, f.h, Math.floor((w - f.w) / 2), h - f.h, f.w, f.h);
  return canvas;
}
