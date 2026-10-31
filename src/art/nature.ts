/**
 * Soft cozy outdoor art: sage grass with sparse tufts,
 * soft beige paths that blend into the lawn, sparkling blue water with grassy banks, round leafy trees,
 * fluffy layered pines, log fences, timber-framed cottages with tiled roofs, crates, sacks and stalls.
 */
import { drawStorefront, type StoreKind } from './storefronts';
import { cozyFrame } from './cozyAssets';
import { drawSereneTile } from './serene';
import { ctx2d, ellipse, makeCanvas, mix, px, rng, shade, type Ctx } from './pixel';

export const NAT = {
  grass: '#afc183',
  grassL: '#bdcc95',
  grassLL: '#cbd7a6',
  grassD: '#a2b477',
  grassDD: '#899d69',
  path: '#ecd7ae',
  pathL: '#f5e6c7',
  pathD: '#d8bf94',
  pebble: '#b99d78',
  sand: '#f2deaa',
  sandD: '#e2c88c',
  water: '#78b3bb',
  waterL: '#a5cfd0',
  waterLL: '#e4efdf',
  waterD: '#5b94a1',
  deep: '#4e8191',
  earth: '#b18a62',
  earthD: '#896947',
  leafDD: '#566d4d',
  leafD: '#718755',
  leaf: '#8fa66e',
  leafL: '#adbe88',
  leafLL: '#ced8a6',
  trunk: '#8a5a3c',
  trunkD: '#64402a',
  wood: '#a8714a',
  woodD: '#7a4c30',
  woodL: '#c48d5e',
  ink: '#22301f',
};

type TileDraw = (c: Ctx, x: number, y: number, r: () => number) => void;

// ------------------------------------------------------------------ ground tiles
function tuft(c: Ctx, x: number, y: number, light: string, dark: string) {
  px(c, x, y + 1, dark, 3, 1);
  px(c, x, y, light);
  px(c, x + 2, y, light);
  px(c, x + 1, y - 1, light);
}

export function brightGrass(variant: number): TileDraw {
  return (c, x, y, r) => {
    const imported = drawSereneTile(c, x, y, 'grass') || cozyFrame(c, 'grass', x, y);
    if (!imported) px(c, x, y, NAT.grass, 16, 16);
    // soft light patches
    if (!imported) {
      const cx = x + 2 + Math.floor(r() * 12);
      const cy = y + 2 + Math.floor(r() * 12);
      px(c, cx - 2, cy, NAT.grassL, 5, 1);
      px(c, cx - 1, cy - 1, NAT.grassL, 3, 3);
    }
    // texture speckles
    if (!imported) for (let i = 0; i < 4; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.grassD : NAT.grassL);
    // tufts
    const n = 1 + (variant % 2);
    for (let i = 0; i < n; i++) tuft(c, x + 1 + Math.floor(r() * 12), y + 2 + Math.floor(r() * 12), r() < 0.5 ? NAT.grassLL : NAT.grassL, NAT.grassD);
    if (variant === 3) {
      const fx = x + 3 + Math.floor(r() * 9);
      const fy = y + 3 + Math.floor(r() * 9);
      px(c, fx, fy, '#ffffff');
      px(c, fx - 1, fy, '#f6f0d8');
      px(c, fx + 1, fy, '#f6f0d8');
      px(c, fx, fy - 1, '#f6f0d8');
      px(c, fx, fy + 1, '#f6f0d8');
      px(c, fx, fy, '#f2c66d');
      px(c, fx + 6, fy + 4, '#f4a6c0');
    }
  };
}

export const darkGrassBright: TileDraw = (c, x, y, r) => {
  if (drawSereneTile(c, x, y, 'grass')) {
    c.fillStyle = 'rgba(65,83,41,0.12)';
    c.fillRect(x, y, 16, 16);
  } else px(c, x, y, NAT.grassD, 16, 16);
  for (let i = 0; i < 5; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.grassDD : NAT.grass);
  for (let i = 0; i < 2; i++) tuft(c, x + 1 + Math.floor(r() * 12), y + 2 + Math.floor(r() * 12), NAT.grassL, NAT.grassD);
};

/** Worn path. Each variant keeps the same beige, with a different pebble and a small scuff. */
export function pathTile(variant = 0): TileDraw {
  const base = variant === 2 ? shade(NAT.path, -0.05) : variant === 1 ? shade(NAT.path, 0.03) : NAT.path;
  return (c, x, y, r) => {
    if (!drawSereneTile(c, x, y, 'dirt')) px(c, x, y, base, 16, 16);
    for (let i = 0; i < 4 + variant; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.pathD : NAT.pathL);
    for (let i = 0; i < 1 + (variant % 2); i++) {
      const sx = x + 2 + Math.floor(r() * 11);
      const sy = y + 2 + Math.floor(r() * 11);
      px(c, sx, sy, NAT.pebble, 2, 1);
      px(c, sx, sy - 1, NAT.pathL, 2, 1);
    }
    if (variant === 1) px(c, x + 3, y + 11, NAT.pathD, 4, 1);
    if (variant === 2) px(c, x + 9, y + 4, NAT.pathL, 3, 2);
  };
}

/** Beach sand. Variant 2 keeps one shell; the others only shift the grain. */
export function sandTile(variant = 0): TileDraw {
  const base = variant === 1 ? shade(NAT.sand, -0.04) : NAT.sand;
  return (c, x, y, r) => {
    px(c, x, y, base, 16, 16);
    for (let i = 0; i < 14; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.6 ? NAT.sandD : '#fbedc6');
    if (variant === 2) {
      px(c, x + 11, y + 10, '#fff6e4', 3, 1);
      px(c, x + 12, y + 9, '#e7d3a4');
    }
  };
}

/** Warm rounded cobbles for the plaza: irregular stones, low contrast, several layouts. */
const COBBLE_LAYOUTS: [number, number, number, number][][] = [
  [[0, 0, 6, 5], [6, 0, 5, 4], [11, 0, 5, 6], [0, 5, 4, 6], [4, 4, 7, 6], [11, 6, 5, 5], [0, 11, 6, 5], [6, 10, 5, 6], [11, 11, 5, 5]],
  [[0, 0, 5, 6], [5, 0, 6, 5], [11, 0, 5, 5], [0, 6, 7, 5], [7, 5, 5, 6], [12, 5, 4, 6], [0, 11, 4, 5], [4, 11, 7, 5], [11, 11, 5, 5]],
  [[0, 0, 7, 4], [7, 0, 4, 6], [11, 0, 5, 5], [0, 4, 5, 6], [5, 6, 6, 5], [11, 5, 5, 6], [0, 10, 5, 6], [5, 11, 6, 5], [11, 11, 5, 5]],
];
const WARM = ['#d7c4a5', '#eee1c6', '#e4d5b9', '#f4e8d0', '#e1ccb1'];
export const GREY_STONE = ['#afa594', '#dad1bf', '#cec5b3', '#e6ddcb', '#c2b7a3'];
export const paverTile = (variant = 0, pal: string[] = WARM): TileDraw => (c, x, y, r) => {
  px(c, x, y, pal[0], 16, 16);
  for (const [sx, sy, w, h] of COBBLE_LAYOUTS[variant % COBBLE_LAYOUTS.length]) {
    const tone = pal[1 + Math.floor(r() * 4)];
    const cx = x + sx + (w - 1) / 2;
    const cy = y + sy + (h - 1) / 2;
    ellipse(c, cx, cy, (w - 1.2) / 2, (h - 1.2) / 2, shade(tone, -0.07));
    ellipse(c, cx, cy - 0.5, (w - 1.8) / 2, (h - 2) / 2, tone);
    px(c, x + sx + 1, y + sy + 1, shade(tone, 0.2), 2, 1);
  }
};

// ---------------------------------------------------------------- water
/**
 * Water is drawn as 3 variants x 4 animation frames per kind (shallow/deep, calm/rain). Variants differ in their patches of
 * lighter/darker blue and where the ripples sit, so the grid never shows; every motion loops in exactly 4 frames:
 * ripples bob a pixel or two, thin current streaks slide 4px per frame (a full tile per loop) and one glint twinkles per frame.
 */
interface WaterPal { base: string; dk: string; dk2: string; lt: string; cur: string; glint: string }
const WATER_PAL: Record<'calm' | 'rain', Record<'shallow' | 'mid' | 'deep', WaterPal>> = {
  calm: {
    shallow: { base: '#78b3bb', dk: '#6aa4ae', dk2: '#6198a5', lt: '#a5cfd0', cur: '#8fbfc3', glint: '#e4efdf' },
    mid: { base: '#659da9', dk: '#598e9c', dk2: '#507f91', lt: '#8abac2', cur: '#79acb7', glint: '#d6e8df' },
    deep: { base: '#4e8191', dk: '#467383', dk2: '#3d6578', lt: '#72a2b2', cur: '#6191a4', glint: '#c6dfe0' },
  },
  rain: {
    shallow: { base: '#5a90b6', dk: '#4c80a4', dk2: '#417196', lt: '#85b3cd', cur: '#6fa2c0', glint: '#d6e6ef' },
    mid: { base: '#4d7ea6', dk: '#416f95', dk2: '#376285', lt: '#719fbe', cur: '#5f90b2', glint: '#c9dde9' },
    deep: { base: '#3f6a94', dk: '#355c82', dk2: '#2d5073', lt: '#5a86ad', cur: '#4a7aa3', glint: '#b9d3e6' },
  },
};
// [x, y, w, h, tone] patches: static colour variation inside each variant
const WATER_PATCHES: [number, number, number, number, 'dk' | 'dk2' | 'lt'][][] = [
  [[1, 2, 6, 2, 'dk'], [9, 5, 5, 1, 'lt'], [3, 9, 7, 2, 'dk'], [11, 12, 4, 2, 'dk2']],
  [[8, 1, 6, 2, 'dk'], [2, 4, 4, 1, 'lt'], [0, 8, 5, 2, 'dk2'], [8, 10, 6, 1, 'lt'], [10, 13, 5, 2, 'dk']],
  [[4, 0, 5, 2, 'dk2'], [11, 6, 5, 2, 'dk'], [1, 7, 5, 1, 'lt'], [2, 12, 7, 2, 'dk'], [10, 3, 4, 1, 'lt']],
];
// ripples [row, length, start x]; they bob with BOB[frame]
const WATER_RIPPLES: [number, number, number][][] = [[[3, 5, 1], [8, 4, 9], [13, 4, 3]], [[1, 4, 10], [6, 5, 2], [11, 5, 8]], [[4, 4, 6], [9, 5, 0], [14, 4, 10]]];
const WATER_GLINTS: [number, number][][] = [[[4, 6], [12, 3], [8, 11], [2, 14]], [[10, 2], [3, 9], [13, 12], [6, 5]], [[7, 13], [14, 7], [2, 2], [11, 9]]];
const CURRENTS: [number, number, number][] = [[2, 9, 5], [10, 7, 3], [6, 8, 12]]; // [variant row offsets] used per variant below
const BOB = [0, 1, 2, 1];

/** px that wraps around the tile edge so moving streaks leave one side and enter the other. */
function wrapPx(c: Ctx, x: number, y: number, ox: number, row: number, len: number, color: string) {
  for (let i = 0; i < len; i++) px(c, x + ((ox + i) % 16 + 16) % 16, y + row, color);
}

export type WaterDepth = 'shallow' | 'mid' | 'deep';
export function waterTile(variant: number, frame: number, depth: WaterDepth, rain: boolean): TileDraw {
  const deep = depth === 'deep';
  return (c, x, y) => {
    const pal = WATER_PAL[rain ? 'rain' : 'calm'][depth];
    px(c, x, y, pal.base, 16, 16);
    for (const [sx, sy, w, h, tone] of WATER_PATCHES[variant]) {
      const col = pal[tone];
      for (let j = 0; j < h; j++) px(c, x + sx + (j % 2 ? 0 : 1), y + sy + j, col, w - (j % 2 ? 0 : 2), 1);
    }
    // thin current streaks slide 4px per frame, so 4 frames make one seamless loop
    const cur = CURRENTS[variant];
    wrapPx(c, x, y, cur[2] + frame * 4, cur[0], rain ? 4 : cur[1], pal.cur);
    if (!rain) wrapPx(c, x, y, cur[2] + 7 + frame * 4, cur[0] + 7, 4, pal.cur);
    if (rain) {
      // choppy dashes plus two expanding rain rings per loop
      for (const [rx, ry, w] of WATER_RIPPLES[variant]) px(c, x + rx, y + ry, pal.lt, Math.max(2, w - 2), 1);
      WATER_GLINTS[variant].slice(0, 2).forEach(([gx, gy], k) => {
        const age = (frame + k * 2) % 4;
        const cx = x + gx;
        const cy = y + Math.min(14, gy + 1);
        if (age === 0) px(c, cx, cy, pal.glint);
        if (age === 1) { px(c, cx - 1, cy, pal.glint); px(c, cx + 1, cy, pal.glint); }
        if (age === 2) { px(c, cx - 2, cy, pal.lt); px(c, cx + 2, cy, pal.lt); px(c, cx - 1, cy - 1, pal.lt, 3, 1); px(c, cx - 1, cy + 1, pal.lt, 3, 1); }
        if (age === 3) { px(c, cx - 3, cy, pal.cur); px(c, cx + 3, cy, pal.cur); }
      });
      return;
    }
    // soft ripples: light crest with a darker shadow underneath, bobbing 0-2px
    WATER_RIPPLES[variant].forEach(([ry, len, rx], i) => {
      const ox = rx + BOB[(frame + i) % 4];
      px(c, x + Math.min(ox, 16 - len), y + ry, i % 2 ? pal.lt : mix(pal.lt, pal.base, 0.4), len, 1);
      if (!deep || i !== 1) px(c, x + Math.min(ox, 16 - len) + 1, y + ry + 1, pal.dk, Math.max(1, len - 2), 1);
    });
    // one glint per frame (deeper water twinkles less)
    const [gx, gy] = WATER_GLINTS[variant][frame];
    px(c, x + gx, y + gy, pal.glint);
    if (!deep && frame === (variant + 1) % 4) {
      px(c, x + gx - 1, y + gy, pal.lt);
      px(c, x + gx + 1, y + gy, pal.lt);
      px(c, x + gx, y + gy - 1, pal.lt);
    }
  };
}

/**
 * Beach waterline. The sea is to the south of the sand, so the water fills the BOTTOM of the tile:
 * the wave creeps up the sand (frames 0-2) and slides back, leaving broken foam and a row of wet sand above the water.
 */
export function shoreTileFrame(frame: number): TileDraw {
  const RISE = [0, 1, 2, 1];
  return (c, x, y) => {
    sandTile(0)(c, x, y, rng(777));
    const wl = 5 + RISE[frame]; // rows of water, counted from the bottom
    const top = 16 - wl;
    const pal = WATER_PAL.calm.shallow;
    px(c, x, y + top, pal.base, 16, wl);
    for (let i = 0; i < 16; i += 5) px(c, x + ((i + frame * 3) % 16), y + top + 1 + (i % 3), pal.lt, 3, 1);
    px(c, x, y + top, pal.lt, 16, 1);
    px(c, x, y + top - 1, NAT.waterLL, 16, 1);
    // broken foam where the wave stopped
    for (let i = 0; i < 16; i += 4) px(c, x + ((i + frame * 5) % 14), y + top - 2, '#ffffff', 2 + (i % 3 === 0 ? 1 : 0), 1);
    // wet sand where the water just was, above the foam
    for (let i = 0; i < 16; i++) if ((i + frame) % 3) px(c, x + i, y + top - 3, mix(NAT.sand, '#b89d6a', 0.35));
  };
}
export const shoreTile: TileDraw = shoreTileFrame(0);

/** Where a building's door and windows sit (shared by the sprite and by the night-time window glow). */
export function buildingLayout(W: number, H: number) {
  const roofH = Math.floor(H * 0.46);
  const wallY = roofH - 3;
  const doorW = 14;
  const dx = Math.floor(W / 2 - doorW / 2);
  const wy = wallY + 13; // below the shop sign
  const windows: { x: number; y: number; w: number; h: number }[] = [];
  for (let x = 9; x + 12 < dx - 3; x += 20) windows.push({ x, y: wy, w: 11, h: 9 });
  for (let x = dx + doorW + 7; x + 12 < W - 6; x += 20) windows.push({ x, y: wy, w: 11, h: 9 });
  return { roofH, wallY, doorW, dx, doorY: H - 25, doorH: 20, windows, attic: { x: W / 2, y: roofH - 3 - Math.min(30, Math.floor(W * 0.32)) / 5 } };
}

export const bridgeTile: TileDraw = (c, x, y) => {
  px(c, x, y, NAT.water, 16, 16);
  for (let j = 0; j < 16; j += 4) {
    px(c, x, y + j, NAT.woodD, 16, 4);
    px(c, x + 1, y + j, NAT.woodL, 14, 3);
    px(c, x + 1, y + j, shade(NAT.woodL, 0.15), 14, 1);
    px(c, x + 3, y + j + 1, NAT.woodD);
    px(c, x + 12, y + j + 1, NAT.woodD);
  }
  px(c, x, y, NAT.trunkD, 2, 16);
  px(c, x + 14, y, NAT.trunkD, 2, 16);
};

export const soilTile = (wet: boolean, shift = 0): TileDraw => (c, x, y, r) => {
  px(c, x, y, wet ? '#87654c' : '#bb956d', 16, 16);
  const start = 2 + (shift % 3);
  for (let j = start; j < 16; j += 4) {
    px(c, x + 1, y + j, wet ? '#74583f' : '#a5825c', 14, 1);
    px(c, x + 1, y + j - 1, wet ? '#96765c' : '#cba77d', 14, 1);
  }
  for (let i = 0; i < 3; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), wet ? '#9d7d62' : '#d0b18b');
};

export function flowerBedBright(color: string): TileDraw {
  return (c, x, y, r) => {
    soilTile(false)(c, x, y, r);
    for (let j = 2; j < 16; j += 5)
      for (let i = 2; i < 16; i += 5) {
        px(c, x + i, y + j + 1, NAT.leafD, 1, 2);
        px(c, x + i - 1, y + j + 1, NAT.leaf);
        px(c, x + i - 1, y + j, color, 3, 1);
        px(c, x + i, y + j - 1, color);
        px(c, x + i, y + j, '#fff3c0');
      }
  };
}

// ------------------------------------------------------------------ transition overlays (drawn over ground)
/** mask bits: 1 = grass to the north, 2 = east, 4 = south, 8 = west. */
function jag(r: () => number, n: number, min: number, max: number): number[] {
  const out: number[] = [];
  let v = min + Math.floor(r() * (max - min + 1));
  for (let i = 0; i < n; i++) {
    v = Math.max(min, Math.min(max, v + (r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0)));
    out.push(v);
  }
  return out;
}

/** Grass creeping over a path / sand edge. */
export function fringe(mask: number): TileDraw {
  return (c, x, y, r) => {
    const sides: [number, (i: number, d: number) => [number, number, number, number]][] = [
      [1, (i, d) => [x + i, y, 1, d]],
      [4, (i, d) => [x + i, y + 16 - d, 1, d]],
      [8, (i, d) => [x, y + i, d, 1]],
      [2, (i, d) => [x + 16 - d, y + i, d, 1]],
    ];
    for (const [bit, rect] of sides) {
      if (!(mask & bit)) continue;
      const depth = jag(r, 16, 1, 2);
      depth.forEach((d, i) => {
        const [rx, ry, rw, rh] = rect(i, d);
        px(c, rx, ry, NAT.grass, rw, rh);
        // dark lip along the edge
        const [lx, ly] = bit === 1 ? [rx, ry + d] : bit === 4 ? [rx, ry - 1] : bit === 8 ? [rx + d, ry] : [rx - 1, ry];
        px(c, lx, ly, shade(NAT.path, -0.12));
      });
      for (let k = 0; k < 1; k++) {
        const t = 2 + Math.floor(r() * 11);
        const [tx, ty] = bit === 1 ? [x + t, y + 2] : bit === 4 ? [x + t, y + 14] : bit === 8 ? [x + 1, y + t] : [x + 13, y + t];
        tuft(c, tx, ty, NAT.grassL, NAT.grassD);
      }
    }
  };
}

/** Grassy bank over a water tile: grass, an earth lip (north side) and a foam line. */
export function bank(mask: number, off = 0): TileDraw {
  return (c, x, y, r) => {
    if (mask & 1) {
      const d = jag(r, 16, 2, 3);
      d.forEach((v, i) => {
        px(c, x + i, y, NAT.grass, 1, v);
        px(c, x + i, y + v, NAT.earth, 1, 3);
        px(c, x + i, y + v + 2, NAT.earthD, 1, 1);
        px(c, x + i, y + v + 3 + off, NAT.waterLL, 1, 1);
        if ((i + off) % 2 === 0) px(c, x + i, y + v + 4 + off, '#62bcee', 1, 1);
      });
    }
    if (mask & 4) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x + i, y + 16 - v, NAT.grass, 1, v);
        px(c, x + i, y + 15 - v - off, NAT.waterLL, 1, 1);
        if ((i + off) % 2 === 0) px(c, x + i, y + 14 - v - off, '#62bcee', 1, 1);
      });
    }
    if (mask & 8) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x, y + i, NAT.grass, v, 1);
        px(c, x + v, y + i, NAT.earth, 1, 1);
        px(c, x + v + 1 + off, y + i, NAT.waterLL, 1, 1);
        if ((i + off) % 2 === 0) px(c, x + v + 2 + off, y + i, '#62bcee', 1, 1);
      });
    }
    if (mask & 2) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x + 16 - v, y + i, NAT.grass, v, 1);
        px(c, x + 15 - v, y + i, NAT.earth, 1, 1);
        px(c, x + 14 - v - off, y + i, NAT.waterLL, 1, 1);
        if ((i + off) % 2 === 0) px(c, x + 13 - v - off, y + i, '#62bcee', 1, 1);
      });
    }
  };
}

// ------------------------------------------------------------------ props
type DrawFn = (c: Ctx, W: number, H: number, c1: string, c2: string, rot: number, r: () => number) => void;

/** Leafy cluster with dark rim, mid body, light top-left and highlight flecks. */
function cluster(c: Ctx, cx: number, cy: number, rx: number, ry: number, pal: string[], r: () => number) {
  const [dd, d, m, l, ll] = pal;
  ellipse(c, cx, cy + 1, rx, ry, dd);
  ellipse(c, cx, cy, rx - 0.5, ry - 0.5, d);
  ellipse(c, cx - rx * 0.12, cy - ry * 0.18, rx * 0.8, ry * 0.72, m);
  ellipse(c, cx - rx * 0.3, cy - ry * 0.38, rx * 0.45, ry * 0.4, l);
  for (let i = 0; i < rx * ry * 0.055; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.85;
    const fx = Math.round(cx + Math.cos(a) * rx * k);
    const fy = Math.round(cy + Math.sin(a) * ry * k);
    const top = fy < cy;
    px(c, fx, fy, top ? (r() < 0.5 ? ll : l) : d);
  }
}

function leafPal(c1: string): string[] {
  const k = c1.toLowerCase();
  if (k === '#d08a4f') return ['#8a4a26', '#b8652f', '#d9853f', '#f0a95a', '#ffd08a'];
  if (k === '#e8b4c0') return ['#b5607e', '#d983a0', '#f0a8bf', '#fbc8d6', '#ffe8ef'];
  if (k === '#4f7a52' || k === 'dark') return ['#1c5230', NAT.leafDD, NAT.leafD, NAT.leaf, NAT.leafL];
  return [NAT.leafDD, NAT.leafD, NAT.leaf, NAT.leafL, NAT.leafLL];
}

function trunk(c: Ctx, cx: number, H: number, h: number) {
  px(c, cx - 3, H - h, NAT.trunkD, 7, h);
  px(c, cx - 2, H - h, NAT.trunk, 4, h - 1);
  px(c, cx - 2, H - h, shade(NAT.trunk, 0.15), 1, h - 2);
  // roots
  px(c, cx - 5, H - 3, NAT.trunkD, 3, 2);
  px(c, cx + 3, H - 3, NAT.trunkD, 3, 2);
  px(c, cx - 4, H - 4, NAT.trunk, 2, 1);
  px(c, cx + 3, H - 4, NAT.trunk, 2, 1);
}

function logPost(c: Ctx, x: number, y: number, h: number) {
  px(c, x, y, NAT.woodD, 4, h);
  px(c, x + 1, y, NAT.wood, 2, h - 1);
  px(c, x, y, NAT.woodL, 4, 2);
  px(c, x + 1, y, '#e2b585', 2, 1);
}

function shingleRoof(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  const dark = shade(col, -0.35);
  const light = shade(col, 0.18);
  px(c, x, y, shade(col, -0.55), w, h);
  for (let j = 1; j < h - 2; j++) {
    const row = Math.floor((j - 1) / 3);
    px(c, x + 1, y + j, j % 3 === 0 ? dark : col, w - 2, 1);
    if (j % 3 === 1) for (let i = x + 2 + (row % 2) * 3; i < x + w - 2; i += 6) px(c, i, y + j, light, 4, 1);
    if (j % 3 === 2) for (let i = x + 4 + (row % 2) * 3; i < x + w - 2; i += 6) px(c, i, y + j, dark, 1, 1);
  }
  // ridge and eaves
  px(c, x + 1, y + 1, light, w - 2, 1);
  px(c, x, y + h - 2, shade(col, -0.5), w, 2);
  px(c, x - 1, y + h - 2, shade(col, -0.6), 1, 2);
  px(c, x + w, y + h - 2, shade(col, -0.6), 1, 2);
}

function cottageWindow(c: Ctx, x: number, y: number, w: number, h: number, box = true) {
  px(c, x - 1, y - 1, NAT.woodD, w + 2, h + 2);
  px(c, x, y, '#f7dc8f', w, h);
  px(c, x, y, '#fff0be', Math.floor(w / 2), 2);
  px(c, x + Math.floor(w / 2), y, NAT.woodD, 1, h);
  px(c, x, y + Math.floor(h / 2), NAT.woodD, w, 1);
  if (box) {
    // flower box
    px(c, x - 1, y + h + 1, NAT.woodD, w + 2, 3);
    px(c, x, y + h + 1, NAT.wood, w, 2);
    for (let i = 0; i < w; i += 2) px(c, x + i, y + h, i % 4 ? '#f4a6c0' : '#fff3c0');
    px(c, x, y + h, NAT.leaf, w, 1);
    for (let i = 1; i < w; i += 4) px(c, x + i, y + h - 1, i % 8 === 1 ? '#f06c7a' : '#ffd36a');
  }
}

function archDoor(c: Ctx, x: number, y: number, w: number, h: number, curtain?: string) {
  px(c, x - 1, y + 2, NAT.woodD, w + 2, h - 2);
  px(c, x + 1, y, NAT.woodD, w - 2, 2);
  px(c, x, y + 2, '#8a5634', w, h - 2);
  px(c, x + 1, y + 1, '#8a5634', w - 2, 1);
  for (let i = x + 2; i < x + w - 1; i += 3) px(c, i, y + 3, '#76472a', 1, h - 4);
  px(c, x + w - 3, y + Math.floor(h / 2) + 1, '#f2c66d', 1, 2);
  if (curtain) {
    px(c, x, y + 2, curtain, w, Math.floor(h * 0.45));
    px(c, x + Math.floor(w / 2) - 1, y + 4, shade(curtain, -0.3), 2, Math.floor(h * 0.45) - 2);
    px(c, x, y + 2, shade(curtain, 0.2), w, 1);
  }
}

export const NATURE_KINDS: Record<string, DrawFn> = {
  tree(c, W, H, c1, _c2, _rot, r) {
    const cx = Math.floor(W / 2);
    const pal = leafPal(c1);
    trunk(c, cx, H, 15);
    cluster(c, cx, H - 25, W / 2 - 3, 13, pal, r);
    cluster(c, cx - 8, H - 21, 9, 8, pal, r);
    cluster(c, cx + 8, H - 22, 9, 8, pal, r);
    cluster(c, cx - 1, H - 36, 11, 9, pal, r);
    cluster(c, cx + 4, H - 30, 8, 7, pal, r);
  },
  sakura(c, W, H, _c1, _c2, _rot, r) {
    NATURE_KINDS.tree(c, W, H, '#e8b4c0', '', 0, r);
    for (let i = 0; i < 10; i++) px(c, 4 + Math.floor(r() * (W - 8)), 6 + Math.floor(r() * (H - 26)), '#ffffff');
  },
  pine(c, W, H, c1) {
    const cx = Math.floor(W / 2);
    const pal = leafPal(c1 === '#4f6b52' ? 'dark' : c1);
    px(c, cx - 2, H - 8, NAT.trunkD, 5, 8);
    px(c, cx - 1, H - 8, NAT.trunk, 2, 7);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const by = H - 7 - i * 9;
      const half = 14 - i * 3;
      const th = 13;
      for (let j = 0; j < th; j++) {
        const w = Math.max(1, Math.round(half * ((j + 2) / (th + 1))));
        const yy = by - th + j;
        px(c, cx - w, yy, pal[0], w * 2 + 1, 1);
        px(c, cx - w + 1, yy, j < th - 2 ? pal[2] : pal[1], w * 2 - 1, 1);
        if (j > 1 && j < th - 2) px(c, cx - w + 1, yy, pal[3], Math.max(1, Math.floor(w * 0.6)), 1);
      }
      // fluffy scalloped bottom edge
      for (let x = cx - half; x <= cx + half; x += 3) px(c, x, by, pal[0], 2, 1);
      px(c, cx - 2, by - th + 2, pal[4], 2, 1);
    }
  },
  bush(c, W, H, c1, c2, _rot, r) {
    const pal = leafPal(c1);
    cluster(c, W / 2, H - 6, W / 2 - 1, 5.5, pal, r);
    cluster(c, W / 2 - 3, H - 8, 4, 3.5, pal, r);
    if (c2 && c2 !== c1) for (let i = 0; i < 5; i++) {
      const fx = 3 + Math.floor(r() * (W - 6));
      const fy = H - 10 + Math.floor(r() * 6);
      px(c, fx, fy, c2, 2, 2);
      px(c, fx, fy, '#ffffff');
    }
  },
  rock(c, W, H, c1) {
    const base = c1 || '#a59f9a';
    ellipse(c, W / 2, H - 5, W / 2 - 1, 4.5, shade(base, -0.4));
    ellipse(c, W / 2, H - 6, W / 2 - 1.5, 4, base);
    ellipse(c, W / 2 - 2, H - 7.5, W / 4, 2, shade(base, 0.25));
    px(c, W / 2 + 2, H - 5, shade(base, -0.2), 2, 1);
  },
  stump(c, W, H) {
    px(c, 3, H - 9, NAT.trunkD, W - 6, 8);
    px(c, 4, H - 9, NAT.trunk, W - 8, 7);
    ellipse(c, W / 2, H - 9, W / 2 - 3, 2, NAT.woodL);
    ellipse(c, W / 2, H - 9, W / 2 - 5, 1, '#e2b585');
    px(c, W / 2, H - 9, NAT.woodD);
  },
  mushroom(c, W, H, c1) {
    px(c, W / 2 - 1, H - 6, '#f6ecd6', 3, 5);
    ellipse(c, W / 2, H - 7, 4.5, 2.5, c1 || '#d9485a');
    px(c, W / 2 - 2, H - 8, '#ffffff');
    px(c, W / 2 + 2, H - 7, '#ffffff');
  },
  flowers(c, W, H, c1, c2, _rot, r) {
    for (let i = 0; i < 6; i++) {
      const x = 2 + Math.floor(r() * (W - 4));
      const y = H - 3 - Math.floor(r() * 8);
      const col = i % 2 ? c1 : c2;
      px(c, x, y, NAT.leafD, 1, 3);
      px(c, x - 1, y + 1, NAT.leaf);
      px(c, x - 1, y - 1, col, 3, 1);
      px(c, x, y - 2, col);
      px(c, x, y, col);
      px(c, x, y - 1, '#ffe27a');
    }
  },
  reeds(c, W, H, c1) {
    for (let i = 2; i < W - 2; i += 3) {
      const h = 9 + ((i * 7) % 5);
      px(c, i, H - h, c1 || NAT.leaf, 1, h);
      px(c, i, H - h - 3, NAT.trunk, 1, 3);
    }
  },
  fence(c, W, H) {
    logPost(c, 1, H - 14, 13);
    logPost(c, W - 5, H - 14, 13);
    px(c, 0, H - 11, NAT.woodD, W, 3);
    px(c, 0, H - 11, NAT.woodL, W, 1);
    px(c, 0, H - 6, NAT.woodD, W, 3);
    px(c, 0, H - 6, NAT.woodL, W, 1);
  },
  crate(c, W, H) {
    px(c, 1, H - 14, NAT.woodD, W - 2, 13);
    px(c, 2, H - 13, NAT.woodL, W - 4, 11);
    px(c, 2, H - 9, NAT.wood, W - 4, 1);
    px(c, 2, H - 5, NAT.wood, W - 4, 1);
    px(c, 2, H - 13, '#e2b585', W - 4, 1);
    for (let i = 0; i < 3; i++) px(c, 4 + i * 3, H - 16, ['#d9485a', '#f2a03c', '#7fbf4f'][i], 3, 3);
  },
  barrel(c, W, H) {
    px(c, 2, H - 15, NAT.woodD, W - 4, 14);
    px(c, 3, H - 15, NAT.wood, W - 6, 13);
    px(c, 4, H - 15, NAT.woodL, 3, 13);
    px(c, 2, H - 12, '#6a6470', W - 4, 1);
    px(c, 2, H - 5, '#6a6470', W - 4, 1);
    ellipse(c, W / 2, H - 15, W / 2 - 3, 1.5, NAT.woodD);
    ellipse(c, W / 2, H - 15, W / 2 - 4, 1, NAT.woodL);
  },
  sack(c, W, H, c1) {
    const col = c1 || '#d8b98a';
    ellipse(c, W / 2, H - 6, 6, 6, shade(col, -0.35));
    ellipse(c, W / 2, H - 7, 5, 5, col);
    ellipse(c, W / 2 - 2, H - 9, 2, 2, shade(col, 0.2));
    px(c, W / 2 - 2, H - 13, shade(col, -0.35), 5, 2);
    px(c, W / 2 - 1, H - 15, col, 3, 2);
  },
  bench(c, W, H, c1) {
    const col = c1 || NAT.wood;
    px(c, 1, H - 13, NAT.woodD, W - 2, 5);
    px(c, 2, H - 12, shade(col, 0.15), W - 4, 3);
    px(c, 1, H - 8, NAT.woodD, W - 2, 3);
    px(c, 2, H - 8, col, W - 4, 1);
    logPost(c, 3, H - 6, 6);
    logPost(c, W - 7, H - 6, 6);
  },
  building(c, W, H, c1, c2, rot) {
    // rot encodes variant: 0 restaurant, 1 shop, 2 house, 3 cabin, 4 library, 5 station, 6 store, 7 bakery, 8 gallery.
    // 100..103 are the four stages of the restaurant facade (see art/storefronts.ts).
    const shop: Record<number, StoreKind> = { 1: 'clothes', 4: 'library', 6: 'store', 7: 'bakery', 8: 'gallery' };
    if (rot >= 100) return drawStorefront(c, W, H, 'izakaya', rot - 100, c2);
    if (rot === 0) return drawStorefront(c, W, H, 'izakaya', 1, c2);
    if (shop[rot]) return drawStorefront(c, W, H, shop[rot]);
    const L = buildingLayout(W, H);
    const wall = rot === 3 ? NAT.woodL : c1;
    const roofH = Math.floor(H * 0.46);
    const wallY = roofH - 3;
    const wallH = H - wallY - 4;
    const timber = rot === 3 ? NAT.woodD : '#7a4a2f';
    // stone foundation
    px(c, 3, H - 6, '#6f6a72', W - 6, 6);
    for (let x = 4; x < W - 4; x += 5) {
      px(c, x, H - 5, '#a8a2a8', 4, 2);
      px(c, x + 2, H - 3, '#968f96', 4, 2);
    }
    // walls + timber frame
    px(c, 3, wallY, shade(wall, -0.45), W - 6, wallH);
    px(c, 4, wallY, wall, W - 8, wallH);
    px(c, 4, wallY, shade(wall, -0.12), W - 8, 3);
    if (rot === 3) {
      for (let y = wallY + 3; y < wallY + wallH; y += 4) {
        px(c, 4, y, NAT.woodD, W - 8, 1);
        px(c, 4, y + 1, shade(NAT.woodL, 0.12), W - 8, 1);
      }
    } else {
      const midY = wallY + Math.floor(wallH * 0.45);
      px(c, 4, midY, timber, W - 8, 2);
      for (let x = 4; x < W - 6; x += 16) {
        px(c, x, wallY, timber, 3, wallH);
        // diagonal braces in the upper panels
        for (let k = 0; k < Math.min(12, midY - wallY - 2); k++) px(c, x + 3 + k, midY - 1 - k, timber, 2, 1);
      }
      px(c, W - 7, wallY, timber, 3, wallH);
    }
    // roof
    shingleRoof(c, 0, 0, W, roofH, c2);
    // chimney
    if (rot === 2 || rot === 3) {
      px(c, W - 22, 2, '#6f6a72', 8, 10);
      px(c, W - 21, 3, '#a8a2a8', 6, 8);
      px(c, W - 23, 1, '#5d5864', 10, 2);
    }
    // door + windows
    const { doorW, dx } = L;
    const curtain = rot === 0 ? '#2f3b6b' : rot === 1 ? '#d9a3a6' : undefined;
    archDoor(c, dx, H - 25, doorW, 20, curtain);
    for (const w of L.windows) cottageWindow(c, w.x, w.y, w.w, w.h);
    // stone door step and potted plants
    px(c, dx - 2, H - 5, '#6f6a72', doorW + 4, 3);
    px(c, dx - 1, H - 5, '#c6c2cc', doorW + 2, 1);
    if (rot !== 5 && rot !== 0) for (const ppx of [dx - 7, dx + doorW + 2]) {
      px(c, ppx, H - 9, '#2b1d17', 5, 5);
      px(c, ppx + 1, H - 8, '#b0533f', 3, 3);
      ellipse(c, ppx + 2.5, H - 11, 3, 2.5, NAT.leaf);
      px(c, ppx + 1, H - 12, '#f4a6c0');
      px(c, ppx + 3, H - 11, '#ffd36a');
    }
    // front gable with a round attic window on homes and shops
    if (rot >= 2 && rot !== 5) {
      const gw = Math.min(30, Math.floor(W * 0.32));
      const gy = roofH - 3;
      for (let j = 0; j < gw / 2; j++) {
        const hw = gw / 2 - j;
        px(c, Math.round(W / 2 - hw), gy - j, '#2b1d17', Math.round(hw * 2), 1);
        if (hw > 1) px(c, Math.round(W / 2 - hw + 1), gy - j, wall, Math.round(hw * 2 - 2), 1);
      }
      ellipse(c, W / 2, gy - gw / 5, 3, 3, '#2b1d17');
      ellipse(c, W / 2, gy - gw / 5, 2.2, 2.2, '#f7dc8f');
      px(c, Math.round(W / 2 - 0.5), gy - gw / 5 - 2, '#7a4a2f', 1, 5);
      // eave boards along the gable
      for (let j = 0; j < gw / 2; j++) {
        px(c, Math.round(W / 2 - gw / 2 + j - 1), gy - j - 1, shade(c2, -0.4), 2, 1);
        px(c, Math.round(W / 2 + gw / 2 - j - 1), gy - j - 1, shade(c2, -0.4), 2, 1);
      }
    }
    if (rot === 6) {
      // general store: produce crates by the door
      for (const [bx2, col] of [[dx - 16, '#e0424f'], [dx + doorW + 8, '#7fbf4f']] as const) {
        px(c, bx2, H - 10, '#2b1d17', 9, 6);
        px(c, bx2 + 1, H - 9, NAT.woodL, 7, 4);
        for (let i = 0; i < 3; i++) ellipse(c, bx2 + 2 + i * 2.5, H - 10, 1.4, 1.4, col);
      }
    }
    if (rot === 7) {
      // bakery: striped awning and a bread sign
      for (let x = dx - 8; x < dx + doorW + 8; x += 4) px(c, x, H - 30, (x - dx) % 8 ? '#f6f1e6' : '#c25a4a', 4, 4);
      px(c, dx - 8, H - 31, '#7a2a2a', doorW + 16, 1);
      ellipse(c, dx + doorW + 13, wallY + 12, 4, 2.5, '#c98a3c');
      px(c, dx + doorW + 11, wallY + 11, '#e8b46a', 4, 1);
    }
    if (rot === 0) {
      // Midnight Maki: maki emblem on the noren, lanterns by the door
      ellipse(c, W / 2, H - 19, 2, 2, '#f6f1e6');
      px(c, W / 2, H - 19, '#d9485a');
      for (const lx of [dx - 6, dx + doorW + 4]) {
        px(c, lx + 1, H - 31, '#3a2418', 1, 3);
        ellipse(c, lx + 1, H - 25, 3, 4, '#d9675f');
        px(c, lx - 1, H - 27, '#ffd0a0', 2, 2);
        px(c, lx - 1, H - 22, '#3a2418', 5, 1);
      }
    }
    if (rot === 1) {
      // striped awning over the door
      for (let x = dx - 6; x < dx + doorW + 6; x += 4) px(c, x, H - 29, (x - dx) % 8 ? '#f6f1e6' : '#d9a3a6', 4, 4);
      px(c, dx - 6, H - 30, '#8a4a5a', doorW + 12, 1);
    }
    if (rot === 4) {
      // book sign
      px(c, W / 2 - 6, wallY + 1, '#3a2418', 12, 7);
      px(c, W / 2 - 5, wallY + 2, '#3b4470', 5, 5);
      px(c, W / 2, wallY + 2, '#b2585e', 5, 5);
    }
    if (rot === 5) {
      px(c, 8, H - 10, '#6f6a72', W - 16, 2);
    }
  },
  /** Wooden signpost (the board with the text is painted by drawObject from the prop label). */
  signpost(c, W, H) {
    const cx = Math.floor(W / 2);
    px(c, cx - 2, H - 22, '#2b1d17', 4, 22);
    px(c, cx - 1, H - 22, NAT.wood, 2, 21);
    px(c, cx - 1, H - 22, NAT.woodL, 1, 21);
    ellipse(c, cx, H - 1, 4, 1.5, shade(NAT.grass, -0.25));
  },
  /** Ren's carpentry stall: planks, log ends and a stone on the counter under a brown awning. */
  carpstall(c, W, H, c1, c2) {
    px(c, 3, H - 30, NAT.woodD, W - 6, 13);
    px(c, 4, H - 29, '#b98a5a', W - 8, 11);
    for (let x = 6; x < W - 8; x += 9) { px(c, x, H - 27, '#e2b585', 7, 2); px(c, x, H - 24, '#c48d5e', 7, 2); px(c, x, H - 21, '#e2b585', 7, 2); }
    px(c, 1, H - 17, NAT.woodD, W - 2, 16);
    px(c, 2, H - 16, NAT.woodL, W - 4, 14);
    px(c, 2, H - 16, '#e2b585', W - 4, 1);
    for (let i = 0; i < 3; i++) ellipse(c, 8 + i * 5, H - 19, 2.4, 2.4, '#d9b27c');
    px(c, W - 14, H - 20, '#9a9690', 6, 4); px(c, W - 12, H - 22, '#b7b2ac', 4, 2);
    px(c, 4, H - 20, '#7a7f86', 9, 1);
    logPost(c, 1, H - 42, 26);
    logPost(c, W - 5, H - 42, 26);
    for (let x = 0; x < W; x += 6) {
      const col = (x / 6) % 2 ? c1 : c2;
      px(c, x, H - 46, shade(col, 0.15), 6, 2);
      px(c, x, H - 44, col, 6, 7);
      ellipse(c, x + 3, H - 37, 3, 2, col);
    }
    px(c, 0, H - 47, shade(c1, -0.5), W, 1);
  },
  stall(c, W, H, c1, c2, _rot, r) {
    const goods = ['#d9485a', '#f2a03c', '#7fbf4f', '#f2c66d', '#9b6ad0', '#e86a9a'];
    // back shelf
    px(c, 3, H - 30, NAT.woodD, W - 6, 13);
    px(c, 4, H - 29, '#c48d5e', W - 8, 11);
    for (let x = 6; x < W - 6; x += 4) {
      px(c, x, H - 27, goods[Math.floor(r() * goods.length)], 3, 3);
      px(c, x, H - 22, goods[Math.floor(r() * goods.length)], 3, 3);
    }
    // counter with crates of produce
    px(c, 1, H - 17, NAT.woodD, W - 2, 16);
    px(c, 2, H - 16, NAT.woodL, W - 4, 14);
    px(c, 2, H - 16, '#e2b585', W - 4, 1);
    for (let x = 4; x < W - 8; x += 10) {
      px(c, x, H - 20, NAT.woodD, 8, 5);
      for (let i = 0; i < 3; i++) ellipse(c, x + 2 + i * 2, H - 20, 1.4, 1.4, goods[Math.floor(r() * goods.length)]);
    }
    logPost(c, 1, H - 42, 26);
    logPost(c, W - 5, H - 42, 26);
    // striped awning
    for (let x = 0; x < W; x += 6) {
      const col = (x / 6) % 2 ? c1 : c2;
      px(c, x, H - 46, shade(col, 0.15), 6, 2);
      px(c, x, H - 44, col, 6, 7);
      ellipse(c, x + 3, H - 37, 3, 2, col);
    }
    px(c, 0, H - 47, shade(c1, -0.5), W, 1);
  },
};

/** Standalone canvas helper for previews. */
export function natureSprite(kind: string, w: number, h: number, c1 = '', c2 = '', rot = 0, r: () => number = Math.random) {
  const c = makeCanvas(w, h);
  NATURE_KINDS[kind](ctx2d(c), w, h, c1, c2, rot, r);
  return c;
}
