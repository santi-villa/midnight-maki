/** Selected native-size art, loaded once before world textures are generated. */
import atlasURL from '../assets/cozy-town/atlas.png';
import { COZY_FRAMES } from './cozyFrames';
import { ctx2d, makeCanvas, type Ctx } from './pixel';

export const COZY_ATLAS_KEY = 'cozy-town-source';
export const COZY_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
export function installCozyAtlas(source: CanvasImageSource) { atlas = source; }

export function cozyFrame(c: Ctx, name: keyof typeof COZY_FRAMES, x: number, y: number, w?: number, h?: number): boolean {
  if (!atlas) return false;
  const f = COZY_FRAMES[name];
  c.drawImage(atlas, f.x, f.y, f.w, f.h, x, y, w ?? f.w, h ?? f.h);
  return true;
}

/** Native submodules: repeating complete pixels preserves the original facade's proportions. */
export function cozyPatch(c: Ctx, name: keyof typeof COZY_FRAMES, sx: number, sy: number, w: number, h: number, x: number, y: number): boolean {
  if (!atlas) return false;
  const f = COZY_FRAMES[name];
  c.drawImage(atlas, f.x + sx, f.y + sy, w, h, x, y, w, h);
  return true;
}

/** Repeat the actual roof material inside the existing building silhouette, without moving its openings. */
export function cozyRoofRow(c: Ctx, x: number, y: number, width: number, row: number, color: string): void {
  if (!atlas) return;
  const n = Number.parseInt(color.replace('#', ''), 16);
  const red = (n >> 16) & 255, green = (n >> 8) & 255, blue = n & 255;
  const f = COZY_FRAMES[red > green * 1.12 ? 'roofClay' : green > blue * 1.08 ? 'roofMoss' : 'roofSlate'];
  for (let dx = 0; dx < width; dx += f.w) {
    const span = Math.min(f.w, width - dx);
    c.drawImage(atlas, f.x, f.y + row % f.h, span, 1, x + dx, y, span, 1);
  }
}

/** Keep pivots and logical footprints: fit single decorations, never distort or stretch a sprite. */
export function cozyObject(id: string, w: number, h: number, rot: number): HTMLCanvasElement | null {
  if (!atlas) return null;
  let name: keyof typeof COZY_FRAMES;
  if (id === 'table_long' && rot === 0) name = 'table';
  else if (id === 'chair_dark') name = (['chairDown', 'chairRight', 'chairUp', 'chairLeft'] as const)[rot % 4];
  else {
    const decor: Record<string, keyof typeof COZY_FRAMES> = {
      plant_monstera: 'monstera', plant_fern: 'planter', bonsai: 'roundShrub',
      lamp_cream: 'floorLamp', vase_tulips: 'flowerVase', clock: 'clock',
      stonelantern: 'stoneLantern', pot_cream: 'topiary', pot_rose: 'flowerVase',
      bush: 'roundShrub', bush_flower: 'roundShrub', village_pine: 'villagePine',
      mailbox: 'villageMailbox', menuboard: 'villageNotice', crate: 'villageWoodbox',
    };
    if (!decor[id]) return null;
    name = decor[id];
  }
  const f = COZY_FRAMES[name];
  const scale = Math.min(1, w / f.w, h / f.h);
  const dw = Math.max(1, Math.round(f.w * scale)), dh = Math.max(1, Math.round(f.h * scale));
  const canvas = makeCanvas(w, h);
  cozyFrame(ctx2d(canvas), name, Math.floor((w - dw) / 2), h - dh, dw, dh);
  return canvas;
}
