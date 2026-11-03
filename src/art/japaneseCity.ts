/** Selected free Japanese City props. Native pixels; no terrain or facade replacement. */
import { packJson, packUrl, type PackPiece } from './packs';

const catalog = packJson('japanese-city/catalog.json', { pieces: [] as PackPiece[] });
const atlasURL = packUrl('japanese-city/atlas.png');
import { ctx2d, makeCanvas } from './pixel';

export const JAPANESE_CITY_ATLAS_KEY = 'japanese-city';
export const JAPANESE_CITY_ATLAS_URL = atlasURL ?? '';
export const japaneseCityWanted = () => !!atlasURL && (typeof location === 'undefined' || new URLSearchParams(location.search).get('japaneseCity') !== 'classic');

let atlas: CanvasImageSource | null = null;
const pieces = new Map<string, PackPiece>();
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
