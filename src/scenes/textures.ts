/** Lazily converts generated canvases into Phaser textures (cached by key). */
import { setPlaqueName } from '../art/izakaya';
import Phaser from 'phaser';
import { cozyObject } from '../art/cozyAssets';
import { furnitureCanvas } from '../art/furniture';
import { interiorObject } from '../art/interiors';
import { exteriorObject } from '../art/exteriors';
import { japaneseCityObject } from '../art/japaneseCity';
import { sereneObject } from '../art/serene';
import { farmObject, farmPiece } from '../art/farm';
import { hasVillageAtlas, villageObject } from '../art/villageAssets';
import { game } from '../core/state';
import { restaurantFacadeLayout } from '../art/restaurantFacade';
import { drawPlaque, pixTextWidth } from '../art/pixfont';
import type { ShopPhase } from '../systems/schedule';
import { buildCharacterSheet, FH, FRAME_COUNT, FW } from '../art/characters';
import { buildFolkSheet } from '../art/folk';
import { heroSheet, isHeroLook } from '../art/heroRender';
import { buildingLayout } from '../art/nature';
import { villageShopLayout } from '../art/village';
import { homeLayout } from '../art/homes';
import { windowGlowRects } from '../art/windowGlow';
import { buildCustomerSheet } from '../art/customerSheet';
import type { CustomerId } from '../art/customers';
import { FOLK_SPECS } from '../data/folkSpecs';
import { drawObject } from '../art/objects';
import { ctx2d, makeCanvas, outline, px, shade } from '../art/pixel';
import { buildTileset } from '../art/tiles';
import { buildRaccoonSheet, type RaccoonBuild } from '../art/raccoon';
import { iconCanvas, type IconSpec } from '../art/icons';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { PROPS } from '../data/props';
import { appearanceKey, appearanceOf, dropOf, folkCustom } from '../systems/appearance';
import { jpBuildingObject } from '../art/japaneseBuildings';

/** The three raccoons use the chibi renderer (art/raccoon.ts). */
export const RACCOON_BUILD: Record<string, RaccoonBuild> = { spicy: 'small', rigg: 'medium', pip: 'big' };

const charKeys = new Map<string, string>(); // id -> current texture key

export function ensureTileset(scene: Phaser.Scene) {
  if (!scene.textures.exists('tiles')) scene.textures.addCanvas('tiles', buildTileset());
}

/** Returns a texture key for the character, regenerating it if their look changed. */
export function charTexture(scene: Phaser.Scene, id: string): string {
  const look = appearanceKey(id);
  const key = 'ch_' + hashStr(look);
  if (!scene.textures.exists(key)) {
    const build = RACCOON_BUILD[id];
    const folk = FOLK_SPECS[id];
    if (folk || (id === 'player' && isHeroLook(appearanceOf(id)))) {
      const { canvas, fw, fh, pad } = folk ? buildFolkSheet(folk, folkCustom(id)) : heroSheet(appearanceOf(id));
      const tex = scene.textures.addCanvas(key, canvas)!;
      for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * fw, 0, fw, fh);
      tex.customData = { pad };
    } else if (build) {
      const { canvas, fw, fh } = buildRaccoonSheet(appearanceOf(id), build);
      const tex = scene.textures.addCanvas(key, canvas)!;
      for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * fw, 0, fw, fh);
    } else {
      const sheet = buildCharacterSheet(appearanceOf(id), dropOf(id));
      const tex = scene.textures.addCanvas(key, sheet)!;
      for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * FW, 0, FW, FH);
    }
  }
  const prev = charKeys.get(id);
  charKeys.set(id, key);
  if (prev && prev !== key && ![...charKeys.values()].includes(prev) && scene.textures.exists(prev)) {
    // keep memory bounded: old looks are discarded
    scene.time.delayedCall(100, () => scene.textures.exists(prev) && scene.textures.remove(prev));
  }
  return key;
}

/** True when this look is already a texture, so a zone change does not have to paint the sheet. */
export function hasCharTexture(scene: Phaser.Scene, id: string): boolean {
  return scene.textures.exists('ch_' + hashStr(appearanceKey(id)));
}

/** Texture for an arbitrary appearance (generic customers). */
export function lookTexture(scene: Phaser.Scene, a: import('../core/types').Appearance): string {
  const key = lookKey(a);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, buildCharacterSheet(a))!;
    for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  }
  return key;
}

/** Any player's look, hero or classic, for the friend who is in the room with us. */
export function appearanceTexture(scene: Phaser.Scene, a: import('../core/types').Appearance): string {
  if (!isHeroLook(a)) return lookTexture(scene, a);
  const key = 'rm_' + hashStr(JSON.stringify(a));
  if (!scene.textures.exists(key)) {
    const { canvas, fw, fh, pad } = heroSheet(a);
    const tex = scene.textures.addCanvas(key, canvas)!;
    for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * fw, 0, fw, fh);
    tex.customData = { pad };
  }
  return key;
}

export function hasLookTexture(scene: Phaser.Scene, a: import('../core/types').Appearance): boolean {
  return scene.textures.exists(lookKey(a));
}

function lookKey(a: import('../core/types').Appearance): string {
  return 'lk_' + hashStr(JSON.stringify(a));
}

/** Yellow order mark. Its own sprite so it sorts with the guest instead of a shared Graphics batch. */
export function orderMarkTexture(scene: Phaser.Scene): string {
  const key = 'order_bang';
  if (scene.textures.exists(key)) return key;
  const c = makeCanvas(7, 13);
  const g = ctx2d(c);
  g.fillStyle = '#4a3029';
  g.fillRect(2, 0, 3, 8);
  g.fillRect(2, 9, 3, 3);
  g.fillStyle = '#f2c66d';
  g.fillRect(3, 1, 1, 6);
  g.fillRect(3, 10, 1, 1);
  g.fillStyle = '#ffe7a3';
  g.fillRect(3, 1, 1, 2);
  scene.textures.addCanvas(key, c);
  return key;
}

/** Texture of a restaurant customer (the 28x40 animal customers). Side-seated: Actor flips it for seats facing left. */
export function customerTexture(scene: Phaser.Scene, id: CustomerId, seed = '', raincoat = false): string {
  const key = 'cust_' + id + (seed ? '_' + seed : '') + (raincoat ? '_rain' : '');
  if (!scene.textures.exists(key)) {
    const { canvas, fw, fh, count } = buildCustomerSheet(id, { seed, raincoat });
    const tex = scene.textures.addCanvas(key, canvas)!;
    for (let i = 0; i < count; i++) tex.add(i, 0, i * fw, 0, fw, fh);
    tex.customData = { sideSit: true };
  }
  return key;
}

/** The drawing of a map prop as a plain canvas (the same art propTexture hands to Phaser), for menus. */
export function propCanvas(key: string, closed = false, sign = game.save.player.restaurantName || 'Midnight Maki'): HTMLCanvasElement {
  const d = PROPS[key];
  return jpBuildingObject(key, d.sw, d.sh, d.label) ?? sereneObject(key, d.sw, d.sh) ?? japaneseCityObject(key, d.sw, d.sh) ?? farmObject(key, d.sw, d.sh) ?? villageObject(key, d.sw, d.sh, d.stage, closed, sign) ?? exteriorObject(key, d.sw, d.sh) ?? interiorObject(key, d.sw, d.sh, d.variant ?? 0) ?? cozyObject(key, d.sw, d.sh, d.variant ?? 0) ?? drawObject(d.kind, d.sw, d.sh, d.c1, d.c2, d.variant ?? 0, hashStr(key), d.label, d.stage, closed);
}

export function propTexture(scene: Phaser.Scene, key: string, closed = false): string {
  // the facade's sign shows the restaurant's name, so its texture is keyed by that name too
  const facade = /^bld_restaurant(_s[0-3])?$/.test(key);
  const sign = game.save.player.restaurantName || 'Midnight Maki';
  const plaque = key === 'mm_sign';
  const k = 'pr_' + key + (closed ? '_closed' : '') + (facade || plaque ? '_' + sign : '');
  if (!scene.textures.exists(k)) {
    if (plaque) setPlaqueName(sign);
    scene.textures.addCanvas(k, propCanvas(key, closed, sign));
  }
  return k;
}

/** One growth stage of a crop from the farm atlas (key of the texture), or null while the atlas is missing. */
export function cropTexture(scene: Phaser.Scene, crop: string, stage: number): string | null {
  const k = `crop_${crop}_${stage}`;
  if (scene.textures.exists(k)) return k;
  const c = farmPiece(`${crop}_${stage}`);
  if (!c) return null;
  scene.textures.addCanvas(k, c);
  return k;
}

export function furnTexture(scene: Phaser.Scene, id: string, rot = 0): string {
  const d = FURN_BY_ID[id];
  const variant = d.rotatable ? rot : d.variant ?? 0;
  const size = furnSize(d, d.rotatable ? rot : 0);
  const sh = d.kind === 'table' ? Math.max(d.sh, size.h * 16) : d.sh;
  const k = `fu_${id}_${variant}_${size.w}x${sh}`;
  if (!scene.textures.exists(k)) scene.textures.addCanvas(k, furnitureCanvas(id, rot));
  return k;
}

export function iconTexture(scene: Phaser.Scene, spec: IconSpec): string {
  const k = 'ic_' + hashStr(JSON.stringify(spec));
  if (!scene.textures.exists(k)) {
    const c = makeCanvas(16, 16);
    ctx2d(c).drawImage(iconCanvas(spec), 0, 0);
    scene.textures.addCanvas(k, c);
  }
  return k;
}

/**
 * Radial light used to cut holes in the night overlay. Drawn in 6 brightness bands with a 4x4 ordered dither between them,
 * so light pools look like pixel art (stepped, slightly grainy) instead of a smooth photographic gradient.
 */
export function lightTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('light')) {
    const S = 64;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d')!;
    const img = g.createImageData(S, S);
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const LEVELS = 6;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
        // bright core, gentle shoulder, soft edge
        const a = d >= 1 ? 0 : Math.pow(1 - d, 1.35) * (d < 0.12 ? 1 : 0.94);
        const t = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        const q = Math.min(1, Math.floor(a * LEVELS + t) / LEVELS);
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(q * 255);
      }
    g.putImageData(img, 0, 0);
    scene.textures.addCanvas('light', c);
  }
  return 'light';
}

/**
 * Warm window panes (and, for the restaurant, its door) of a building sprite, as an overlay that is added on top at night.
 * Built once per building size and variant, from the same layout the sprite itself was drawn with.
 */
export function windowGlowTexture(scene: Phaser.Scene, W: number, H: number, rot: number, door: boolean, home?: 'front' | 'side', facadeStage?: number): string {
  const key = `winglow_${W}x${H}_${rot}_${door ? 'd' : 'w'}${home ? '_' + home : ''}_${facadeStage ?? 'legacy'}`;
  if (scene.textures.exists(key)) return key;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  if (facadeStage !== undefined && hasVillageAtlas()) {
    const L = restaurantFacadeLayout(W, H, facadeStage);
    // The selected art has timber entries, not glass doors. Lamp pools light the entrance.
    if (!door) for (const w of L.windows) {
      px(g, w.x + 1, w.y + 1, '#ffc44a', w.w - 2, w.h - 2);
      px(g, w.x + 1, w.y + 1, '#fff3c0', Math.floor((w.w - 2) / 2), 3);
      px(g, w.x + Math.floor(w.w / 2), w.y + 1, '#b8661e', 1, w.h - 2);
    }
    scene.textures.addCanvas(key, c);
    return key;
  }
  const panes = windowGlowRects(W, H, rot, door, home);
  if (home) {
    // a house: warm panes, the light through the glass of the door and the lantern beside it
    const L = homeLayout(W, H, rot, home === 'side');
    for (const w of L.windows) {
      px(g, w.x, w.y, '#ffc44a', w.w, w.h);
      px(g, w.x, w.y, '#fff3c0', Math.floor(w.w / 2), 3);
      if (L.trade === 1) { for (let i = 4; i < w.w; i += 4) px(g, w.x + i, w.y, '#b8661e', 1, w.h); for (let j = 4; j < w.h; j += 5) px(g, w.x, w.y + j, '#b8661e', w.w, 1); }
      else { px(g, w.x + Math.floor(w.w / 2), w.y, '#b8661e', 1, w.h); px(g, w.x, w.y + Math.floor(w.h / 2), '#cf7a26', w.w, 1); }
    }
    // The imported genkan is solid timber; only its windows and lantern emit light.
    const lantern = panes[panes.length - 1];
    px(g, lantern.x, lantern.y, '#fff1b4', lantern.w, lantern.h);
    scene.textures.addCanvas(key, c);
    return key;
  }
  if (door) {
    // the noren doorway: an orange wash with a brighter slit
    const r = panes[0];
    px(g, r.x, r.y, '#ffb040', r.w, r.h);
    px(g, r.x + 2, r.y + 1, '#ffe08a', r.w - 4, r.h - 4);
  } else {
    const L = rot >= 20 && rot <= 23 ? villageShopLayout(W, H, rot) : buildingLayout(W, H);
    for (const w of L.windows) {
      px(g, w.x + 1, w.y + 1, '#ffc44a', w.w - 2, w.h - 2);
      px(g, w.x + 1, w.y + 1, '#fff3c0', Math.floor((w.w - 2) / 2), 3);
      px(g, w.x + Math.floor(w.w / 2), w.y + 1, '#b8661e', 1, w.h - 2); // mullion stays dark
      px(g, w.x + 1, w.y + Math.floor(w.h / 2), '#cf7a26', w.w - 2, 1);
    }
    if (rot === 2 || rot === 3) {
      const attic = panes[panes.length - 1];
      px(g, attic.x, attic.y, '#ffe7a4', attic.w, attic.h);
    }
  }
  scene.textures.addCanvas(key, c);
  return key;
}

/** soft bloom sprite for additive light halos */
export function glowTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('glow')) {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    scene.textures.addCanvas('glow', c);
  }
  return 'glow';
}

/** dark edges, clear center */
export function vignetteTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('vignette')) {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 34, 64, 64, 92);
    grad.addColorStop(0, 'rgba(20,14,36,0)');
    grad.addColorStop(1, 'rgba(20,14,36,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    scene.textures.addCanvas('vignette', c);
  }
  return 'vignette';
}

export function dotTexture(scene: Phaser.Scene, key: string, color: string, w = 2, h = 2): string {
  if (!scene.textures.exists(key)) {
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    scene.textures.addCanvas(key, c);
  }
  return key;
}

/** Tiny ambient critters (2 frames each), outlined like the rest of the art. */
export function critterTexture(scene: Phaser.Scene, kind: 'bird' | 'cat' | 'butterfly', variant = 0): string {
  const key = 'cr_' + kind + variant;
  if (scene.textures.exists(key)) return key;
  const wings = ['#f4a6c0', '#ffd36a', '#9fd8f6', '#ffffff'][variant % 4];
  const B: Record<string, string> = { b: '#a8714a', d: '#7a4c30', w: '#f6f1e6', y: '#f2b33a', k: '#2b1d17', g: '#a59f9a', G: '#7a7480', p: '#f08aa0', W: wings, V: shade(wings, -0.2) };
  const frames =
    kind === 'bird'
      ? [
          ['..........', '....bbb...', '...bbbbk..', '..dbwwwy..', '..dbbbb...', '...k.k....'],
          ['.d.....d..', '..dbbbd...', '...bbbbk..', '...bwwwy..', '....bb....', '...k.k....'],
        ]
      : kind === 'cat'
        ? [
            ['g.....g......', 'gg...gg......', 'ggggggg......', 'gkggkgg...g..', 'gggpgggg.g...', '.ggggggggg...', '.GGGGGGGG....', '.g.g...g.g...'],
            ['g.....g......', 'gg...gg......', 'ggggggg....g.', 'gkggkgg...g..', 'gggpgggggg...', '.ggggggggg...', '.GGGGGGGG....', '..g.gg..g.g..'],
          ]
        : [
            ['WW.k.WW', 'WWVkVWW', '.WVkVW.', '.WW.WW.'],
            ['.......', '.WVkVW.', '..VkV..', '.......'],
          ];
  const w = frames[0][0].length;
  const h = frames[0].length;
  const c = makeCanvas((w + 2) * 2, h + 2);
  const g = ctx2d(c);
  frames.forEach((rows, i) => {
    const f = makeCanvas(w + 2, h + 2);
    const fg = ctx2d(f);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (B[ch]) {
        fg.fillStyle = B[ch];
        fg.fillRect(x + 1, y + 1, 1, 1);
      }
    }));
    outline(f, '#2b1d17');
    g.drawImage(f, i * (w + 2), 0);
  });
  const tex = scene.textures.addCanvas(key, c)!;
  tex.add(0, 0, 0, 0, w + 2, h + 2);
  tex.add(1, 0, w + 2, 0, w + 2, h + 2);
  return key;
}

/** Soft cloud shadow that drifts over outdoor zones. */
export function cloudShadowTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('cloudshadow')) {
    const c = makeCanvas(96, 48);
    const g = c.getContext('2d')!;
    for (const [x, y, r] of [[30, 26, 20], [52, 20, 24], [72, 28, 18], [46, 32, 18]] as const) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(20,30,60,0.22)');
      grad.addColorStop(1, 'rgba(20,30,60,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 48);
    }
    scene.textures.addCanvas('cloudshadow', c);
  }
  return 'cloudshadow';
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Objective guide sprites: a golden arrow (pointing right) and a bouncing diamond marker. */
export function guideTexture(scene: Phaser.Scene, kind: 'arrow' | 'mark'): string {
  const key = 'guide_' + kind;
  if (scene.textures.exists(key)) return key;
  const c = makeCanvas(13, 13);
  const g = ctx2d(c);
  const ink = '#2b1d17';
  if (kind === 'arrow') {
    const rows = ['....X........', '....XX.......', 'XXXXXXX......', 'XXXXXXXX.....', 'XXXXXXX......', '....XX.......', '....X........'];
    rows.forEach((r, j) => [...r].forEach((v, i) => { if (v === 'X') { g.fillStyle = ink; g.fillRect(i + 2, j + 3, 1, 1); } }));
    g.fillStyle = '#ffd25a';
    g.fillRect(3, 6, 5, 1);
    g.fillRect(6, 4, 1, 5);
    g.fillRect(7, 5, 1, 3);
    g.fillRect(8, 6, 1, 1);
    g.fillStyle = '#fff2a0';
    g.fillRect(3, 6, 3, 1);
  } else {
    for (let j = 0; j < 11; j++) {
      const w = j < 6 ? j : 10 - j;
      g.fillStyle = ink;
      g.fillRect(6 - w - 1, j + 1, w * 2 + 3, 1);
    }
    for (let j = 1; j < 10; j++) {
      const w = j < 6 ? j - 1 : 9 - j;
      g.fillStyle = j < 5 ? '#fff2a0' : '#ffc23a';
      g.fillRect(6 - w, j + 1, w * 2 + 1, 1);
    }
  }
  scene.textures.addCanvas(key, c);
  return key;
}

export function questMarkerTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('quest_pin')) {
    const c = makeCanvas(12, 16);
    const g = c.getContext('2d')!;
    g.fillStyle = '#46291f';
    g.beginPath();
    g.moveTo(6, 0);
    g.lineTo(12, 6);
    g.lineTo(6, 15);
    g.lineTo(0, 6);
    g.closePath();
    g.fill();

    g.fillStyle = '#f2c66d';
    g.beginPath();
    g.moveTo(6, 2);
    g.lineTo(10, 6);
    g.lineTo(6, 13);
    g.lineTo(2, 6);
    g.closePath();
    g.fill();

    g.fillStyle = '#fff8e8';
    g.fillRect(5, 4, 2, 3);
    scene.textures.addCanvas('quest_pin', c);
  }
  return 'quest_pin';
}

/** Native pixel font: at most 29×11 logical pixels, cached by service phase. */
export function shopSignTexture(scene: Phaser.Scene, text: string, phase: ShopPhase): string {
  const key = 'shop_sign_' + phase;
  if (!scene.textures.exists(key)) {
    const canvas = makeCanvas(pixTextWidth(text) + 2, 11);
    drawPlaque(ctx2d(canvas), canvas.width / 2, 0, text, { pad: 0, ink: phase === 'closed' ? '#843e3a' : '#765029' });
    scene.textures.addCanvas(key, canvas);
  }
  return key;
}
