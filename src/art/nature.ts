/**
 * Bright cozy outdoor art (style guide: the farm-village reference): saturated grass with tufts,
 * soft beige paths that blend into the lawn, sparkling blue water with grassy banks, round leafy trees,
 * fluffy layered pines, log fences, timber-framed cottages with tiled roofs, crates, sacks and stalls.
 */
import { ctx2d, ellipse, makeCanvas, px, shade, type Ctx } from './pixel';

export const NAT = {
  grass: '#5db449',
  grassL: '#7ccb59',
  grassLL: '#9be070',
  grassD: '#43963c',
  grassDD: '#2f7a35',
  path: '#e6cd98',
  pathL: '#f3e0b4',
  pathD: '#d2b47c',
  pebble: '#c3a26c',
  sand: '#f2deaa',
  sandD: '#e2c88c',
  water: '#3ea8e4',
  waterL: '#78cdf4',
  waterLL: '#c9f0ff',
  waterD: '#2b88cc',
  deep: '#2479bf',
  earth: '#8b5a3a',
  earthD: '#6a4229',
  leafDD: '#24683a',
  leafD: '#2f8a3e',
  leaf: '#46a846',
  leafL: '#6cc456',
  leafLL: '#9be06a',
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
    px(c, x, y, NAT.grass, 16, 16);
    // soft light patches
    for (let i = 0; i < 2; i++) {
      const cx = x + 2 + Math.floor(r() * 12);
      const cy = y + 2 + Math.floor(r() * 12);
      px(c, cx - 2, cy, NAT.grassL, 5, 1);
      px(c, cx - 1, cy - 1, NAT.grassL, 3, 3);
    }
    // texture speckles
    for (let i = 0; i < 14; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.grassD : NAT.grassL);
    // tufts
    const n = 3 + variant;
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
  px(c, x, y, '#4fa543', 16, 16);
  for (let i = 0; i < 16; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.grassD : NAT.grass);
  for (let i = 0; i < 5; i++) tuft(c, x + 1 + Math.floor(r() * 12), y + 2 + Math.floor(r() * 12), NAT.grassL, NAT.grassD);
};

export const pathTile: TileDraw = (c, x, y, r) => {
  px(c, x, y, NAT.path, 16, 16);
  for (let i = 0; i < 16; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? NAT.pathD : NAT.pathL);
  for (let i = 0; i < 2; i++) {
    const sx = x + 2 + Math.floor(r() * 11);
    const sy = y + 2 + Math.floor(r() * 11);
    px(c, sx, sy, NAT.pebble, 2, 1);
    px(c, sx, sy - 1, NAT.pathL, 2, 1);
  }
};

export const sandTile: TileDraw = (c, x, y, r) => {
  px(c, x, y, NAT.sand, 16, 16);
  for (let i = 0; i < 18; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.6 ? NAT.sandD : '#fbedc6');
};

/** Warm rounded cobbles for the plaza: irregular stones, low contrast, several layouts. */
const COBBLE_LAYOUTS: [number, number, number, number][][] = [
  [[0, 0, 6, 5], [6, 0, 5, 4], [11, 0, 5, 6], [0, 5, 4, 6], [4, 4, 7, 6], [11, 6, 5, 5], [0, 11, 6, 5], [6, 10, 5, 6], [11, 11, 5, 5]],
  [[0, 0, 5, 6], [5, 0, 6, 5], [11, 0, 5, 5], [0, 6, 7, 5], [7, 5, 5, 6], [12, 5, 4, 6], [0, 11, 4, 5], [4, 11, 7, 5], [11, 11, 5, 5]],
  [[0, 0, 7, 4], [7, 0, 4, 6], [11, 0, 5, 5], [0, 4, 5, 6], [5, 6, 6, 5], [11, 5, 5, 6], [0, 10, 5, 6], [5, 11, 6, 5], [11, 11, 5, 5]],
];
const WARM = ['#c9bba6', '#e8ddcb', '#e0d3be', '#eee5d6', '#dacbb4'];
export const GREY_STONE = ['#8f8a96', '#c6c2cc', '#bab5c1', '#d1cdd6', '#b0abb8'];
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

export function brightWater(frame: number, deep = false): TileDraw {
  return (c, x, y) => {
    const base = deep ? '#3698d8' : NAT.water;
    px(c, x, y, base, 16, 16);
    // gentle drifting ripples (irregular so the grid doesn't show)
    const ripples: [number, number, number][] = [[2, 3, 4], [9, 6, 3], [5, 11, 3], [12, 13, 2]];
    ripples.forEach(([rx, ry, w], i) => {
      const ox = (rx + frame * (i % 2 ? 1 : 2)) % 14;
      px(c, x + ox, y + ry, i % 2 ? NAT.waterL : shade(base, 0.12), w, 1);
    });
    if (frame === 1) px(c, x + 7, y + 9, NAT.waterLL);
    if (frame === 2) px(c, x + 13, y + 4, NAT.waterLL);
  };
}

export const shoreTile: TileDraw = (c, x, y, r) => {
  sandTile(c, x, y, r);
  px(c, x, y, NAT.water, 16, 5);
  px(c, x, y + 5, NAT.waterL, 16, 1);
  px(c, x, y + 6, NAT.waterLL, 16, 1);
  px(c, x + 3, y + 7, '#ffffff', 4, 1);
  px(c, x + 10, y + 7, '#ffffff', 3, 1);
};

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

export const soilTile = (wet: boolean): TileDraw => (c, x, y, r) => {
  px(c, x, y, wet ? '#6e4a33' : '#a07049', 16, 16);
  for (let j = 2; j < 16; j += 4) {
    px(c, x + 1, y + j, wet ? '#5a3b28' : '#87593a', 14, 1);
    px(c, x + 1, y + j - 1, wet ? '#7d5640' : '#b5825a', 14, 1);
  }
  for (let i = 0; i < 6; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), wet ? '#83604a' : '#c09068');
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
      const depth = jag(r, 16, 1, 4);
      depth.forEach((d, i) => {
        const [rx, ry, rw, rh] = rect(i, d);
        px(c, rx, ry, NAT.grass, rw, rh);
        // dark lip along the edge
        const [lx, ly] = bit === 1 ? [rx, ry + d] : bit === 4 ? [rx, ry - 1] : bit === 8 ? [rx + d, ry] : [rx - 1, ry];
        px(c, lx, ly, shade(NAT.path, -0.12));
      });
      for (let k = 0; k < 3; k++) {
        const t = 2 + Math.floor(r() * 11);
        const [tx, ty] = bit === 1 ? [x + t, y + 2] : bit === 4 ? [x + t, y + 14] : bit === 8 ? [x + 1, y + t] : [x + 13, y + t];
        tuft(c, tx, ty, NAT.grassL, NAT.grassD);
      }
    }
  };
}

/** Grassy bank over a water tile: grass, an earth lip (north side) and a foam line. */
export function bank(mask: number): TileDraw {
  return (c, x, y, r) => {
    if (mask & 1) {
      const d = jag(r, 16, 2, 3);
      d.forEach((v, i) => {
        px(c, x + i, y, NAT.grass, 1, v);
        px(c, x + i, y + v, NAT.earth, 1, 3);
        px(c, x + i, y + v + 2, NAT.earthD, 1, 1);
        px(c, x + i, y + v + 3, NAT.waterLL, 1, 1);
      });
    }
    if (mask & 4) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x + i, y + 16 - v, NAT.grass, 1, v);
        px(c, x + i, y + 15 - v, NAT.waterLL, 1, 1);
      });
    }
    if (mask & 8) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x, y + i, NAT.grass, v, 1);
        px(c, x + v, y + i, NAT.earth, 1, 1);
        px(c, x + v + 1, y + i, NAT.waterLL, 1, 1);
      });
    }
    if (mask & 2) {
      const d = jag(r, 16, 1, 3);
      d.forEach((v, i) => {
        px(c, x + 16 - v, y + i, NAT.grass, v, 1);
        px(c, x + 15 - v, y + i, NAT.earth, 1, 1);
        px(c, x + 14 - v, y + i, NAT.waterLL, 1, 1);
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
  for (let i = 0; i < rx * ry * 0.16; i++) {
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
    // rot encodes variant: 0 restaurant, 1 shop, 2 house, 3 cabin, 4 library, 5 station
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
    const doorW = 14;
    const dx = Math.floor(W / 2 - doorW / 2);
    const curtain = rot === 0 ? '#2f3b6b' : rot === 1 ? '#d9a3a6' : undefined;
    archDoor(c, dx, H - 25, doorW, 20, curtain);
    const wy = wallY + 7;
    for (let x = 9; x + 12 < dx - 3; x += 20) cottageWindow(c, x, wy, 11, 9);
    for (let x = dx + doorW + 7; x + 12 < W - 6; x += 20) cottageWindow(c, x, wy, 11, 9);
    if (rot === 0) {
      // Midnight Maki: hanging sign, maki emblem on the noren, lanterns by the door
      px(c, W / 2 - 22, wallY + 1, '#3a2418', 44, 9);
      px(c, W / 2 - 21, wallY + 2, '#e2c08c', 42, 7);
      for (let i = 0; i < 6; i++) px(c, W / 2 - 17 + i * 6, wallY + 4, '#3a2418', 4, 3);
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
      px(c, W / 2 - 16, wallY + 1, '#3a2418', 32, 6);
      px(c, W / 2 - 15, wallY + 2, '#f6ecd6', 30, 4);
    }
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
