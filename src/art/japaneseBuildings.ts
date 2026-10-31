/**
 * VectoRaith "Traditional Japanese Buildings" facades (scripts/build-japanese-buildings.py) for Midnight Maki's four
 * stages, the three shops and the library. Each facade carries its doorway, windows and sign, so the street path, the
 * shop shutter, the lanterns and the night glow follow the new art. Saved prop IDs stay the same; the footprint grows to
 * whole tiles around the facade. `?buildings=classic` keeps the previous art.
 */
import catalog from '../assets/jp-buildings/catalog.json';
import atlasURL from '../assets/jp-buildings/atlas.png';
import { ctx2d, makeCanvas, type Ctx } from './pixel';
import { drawPlaque } from './pixfont';

export const JP_BUILDINGS_ATLAS_KEY = 'jp-buildings';
export const JP_BUILDINGS_ATLAS_URL = atlasURL;
export const jpBuildingsWanted = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('buildings') !== 'classic';

type Facade = (typeof catalog.facades)[number];
type Rect = { x: number; y: number; w: number; h: number };
const facadeFor = new Map<string, Facade>();
for (const f of catalog.facades) for (const id of f.replaces) facadeFor.set(id, f);

let atlas: CanvasImageSource | null = null;
export function installJpBuildingsAtlas(source: CanvasImageSource) { atlas = source; }

/** Left edge of a facade in a W-wide canvas: centred, then nudged so its doorway sits on the middle of a tile. */
function facadeX(f: Facade, W: number): number {
  const x = Math.floor((W - f.rect[2]) / 2);
  let d = ((8 - (x + f.door[0] + f.door[2] / 2)) % 16 + 16) % 16;
  if (d > 8) d -= 16;
  return x + d;
}

/** The footprint a facade needs: whole tiles wide enough for the nudged facade, and its own height. */
export function jpFootprint(id: string): { w: number; sw: number; sh: number } | null {
  const f = jpBuildingsWanted() ? facadeFor.get(id) : undefined;
  if (!f) return null;
  let w = Math.ceil(f.rect[2] / 16);
  while (facadeX(f, w * 16) < 0 || facadeX(f, w * 16) + f.rect[2] > w * 16) w++;
  return { w, sw: w * 16, sh: f.rect[3] };
}

export interface JpFacadeLayout extends Rect { door: Rect; windows: Rect[]; sign: { x: number; y: number } }
/** Where the facade, its doorway, windows and sign sit inside a W×H prop canvas (bottom-centred, never scaled). */
export function jpFacadeLayout(id: string, W: number, H: number): JpFacadeLayout | null {
  const f = jpBuildingsWanted() ? facadeFor.get(id) : undefined;
  if (!f) return null;
  const [, , w, h] = f.rect, x = facadeX(f, W), y = H - h;
  const at = ([rx, ry, rw, rh]: number[]) => ({ x: x + rx, y: y + ry, w: rw, h: rh });
  return { x, y, w, h, door: at(f.door), windows: f.windows.map(at), sign: { x: W / 2, y: y + f.sign } };
}

/** Draws only the facade; false when the atlas is missing (the caller keeps its own art). */
export function drawJpFacade(c: Ctx, id: string, W: number, H: number): boolean {
  const f = facadeFor.get(id), L = jpFacadeLayout(id, W, H);
  if (!atlas || !f || !L) return false;
  c.drawImage(atlas, f.atlas.x, f.atlas.y, L.w, L.h, L.x, L.y, L.w, L.h);
  return true;
}

/** A shop or the library: the facade with its name plaque. The restaurant is drawn by villageAssets (sign, lanterns). */
export function jpBuildingObject(id: string, W: number, H: number, label?: string): HTMLCanvasElement | null {
  if (id.startsWith('bld_restaurant')) return null;
  const canvas = makeCanvas(W, H), c = ctx2d(canvas);
  if (!drawJpFacade(c, id, W, H)) return null;
  const L = jpFacadeLayout(id, W, H)!;
  if (label) drawPlaque(c, L.sign.x, L.sign.y, label, { wood: '#d9b482' });
  return canvas;
}
