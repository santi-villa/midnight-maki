/** Crops from the uploaded sheet. Saved identities, footprints and gameplay remain unchanged. */
import atlasURL from '../assets/village/atlas.png';
import catalog from '../assets/village/catalog.json';
import { ctx2d, makeCanvas, px, type Ctx } from './pixel';
import { drawPlaque, pixTextWidth } from './pixfont';
import { restaurantFacadeLayout } from './restaurantFacade';

export const VILLAGE_ATLAS_KEY = 'village-source';
export const VILLAGE_ATLAS_URL = atlasURL;
let source: CanvasImageSource | null = null;
export function installVillageAtlas(image: CanvasImageSource) { source = image; }
export const hasVillageAtlas = () => source !== null;
type Frame = keyof typeof catalog.frames;
export const VILLAGE_PROP_FRAMES: Readonly<Record<string, Frame>> = {
  boat: 'boat', boat_rope: 'boat_rope', bush: 'shrub', bush_flower: 'shrub_wide',
  stonelantern: 'stone_lamp', lantern_cream: 'paperlamp', wall_lantern_cream: 'paperlamp',
  lanternstring: 'lanterns', deco_fishrack: 'fishrack', village_net: 'nettable',
  village_fish_crate: 'fish_crate', menuboard: 'woodstand', barrel: 'barrel',
  stall_wood: 'stall_gray', stall_rose: 'stall_gray', stall_gold: 'stall_gray',
  stall_sage: 'stall_green', stall_night: 'stall_blue',
};

function frame(c: Ctx, name: Frame, x: number, y: number, w: number, h: number) {
  const f = catalog.frames[name];
  c.drawImage(source!, f.x, f.y, f.w, f.h, x, y, w, h);
}

/** The name the player chose for the restaurant, upper-cased and cut to fit the facade's plaque. */
export function restaurantSignText(name: string, W: number): string {
  let t = name.trim().toUpperCase() || 'MIDNIGHT MAKI';
  while (t.length > 1 && pixTextWidth(t) > W - 14) t = t.slice(0, -1);
  return t;
}

export function villageObject(id: string, W: number, H: number, stage = 0, closed = false, sign = 'Midnight Maki'): HTMLCanvasElement | null {
  if (!source) return null;
  const restaurant = id === 'bld_restaurant' || /^bld_restaurant_s[0-3]$/.test(id);
  const name = VILLAGE_PROP_FRAMES[id];
  if (!restaurant && !name) return null;
  const canvas = makeCanvas(W, H), c = ctx2d(canvas);
  if (restaurant) {
    const L = restaurantFacadeLayout(W, H, stage);
    frame(c, L.frame, L.x, L.y, L.w, L.h);
    if (closed) {
      for (const window of L.windows) px(c, window.x, window.y, '#70543f', window.w, window.h);
      px(c, L.door.x + 1, L.door.y + 1, '#79573f', L.door.w - 2, L.door.h - 1);
      for (let x = L.door.x + 3; x < L.door.x + L.door.w - 1; x += 4) px(c, x, L.door.y + 1, '#503e31', 1, L.door.h - 1);
    }
    if (stage >= 3) frame(c, 'lanterns', Math.round(W / 2 - 26), L.sign.y - 14, 52, 14);
    // Keep the restaurant name and its two warm lanterns on the selected facade.
    drawPlaque(c, L.sign.x, L.sign.y, restaurantSignText(sign, W), { wood: '#d9b482' });
    for (const lamp of L.lanterns) {
      px(c, lamp.x, lamp.y - 4, '#79573c', 1, 5);
      frame(c, 'paperlamp', lamp.x - 4, lamp.y, 8, 9);
    }
    if (stage >= 3) for (const x of [W / 2 - 6, W / 2, W / 2 + 6]) {
      px(c, x, L.y + 12, '#e5c175', 1, 5); px(c, x - 1, L.y + 14, '#e5c175', 3, 1);
    }
    return canvas;
  }
  const f = catalog.frames[name], scale = Math.min(W / f.w, H / f.h);
  const w = Math.max(1, Math.round(f.w * scale)), h = Math.max(1, Math.round(f.h * scale));
  if (name === 'paperlamp') px(c, Math.floor(W / 2), 0, '#79573c', 1, H - h + 2);
  frame(c, name, Math.floor((W - w) / 2), H - h, w, h);
  return canvas;
}
