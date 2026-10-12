/** Procedural 16x16 tileset. Each tile key maps to an index in the generated sheet. */
import { PAL } from './palette';
import { bank, bridgeTile, brightGrass, brightWater, darkGrassBright, flowerBedBright, fringe, pathTile, paverTile, sandTile, shoreTile, soilTile } from './nature';
import { barFloor, izakayaFloor, izakayaTop, izakayaUpper, izakayaWall, izakayaWindow, tatamiMat } from './izakaya';
import { ctx2d, makeCanvas, px, rng, shade, type Ctx } from './pixel';

export const TS = 16;

type TileDraw = (c: Ctx, x: number, y: number, r: () => number) => void;
interface TileDef { key: string; solid: boolean; draw: TileDraw; }

function speckle(c: Ctx, x: number, y: number, r: () => number, colors: string[], n: number) {
  for (let i = 0; i < n; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), colors[Math.floor(r() * colors.length)]);
}


function plank(base: string, line: string): TileDraw {
  return (c, x, y, r) => {
    px(c, x, y, base, 16, 16);
    for (let row = 0; row < 4; row++) {
      px(c, x, y + row * 4 + 3, line, 16, 1);
      const seam = Math.floor(r() * 12) + 2;
      px(c, x + seam, y + row * 4, line, 1, 3);
      px(c, x + Math.floor(r() * 14), y + row * 4 + 1, shade(base, 0.08), 2, 1);
    }
  };
}

function checker(a: string, b: string, size = 8): TileDraw {
  return (c, x, y) => {
    for (let j = 0; j < 16; j += size) for (let i = 0; i < 16; i += size) px(c, x + i, y + j, ((i + j) / size) % 2 ? a : b, size, size);
    px(c, x, y, shade(a, -0.08), 16, 1);
  };
}

function carpet(base: string, dot: string): TileDraw {
  return (c, x, y) => {
    px(c, x, y, base, 16, 16);
    for (let j = 2; j < 16; j += 6) for (let i = 2; i < 16; i += 6) px(c, x + i, y + j, dot, 2, 2);
  };
}

function stonePath(base: string, dark: string, light: string): TileDraw {
  return (c, x, y, r) => {
    px(c, x, y, dark, 16, 16);
    const stones = [[0, 0, 7, 6], [8, 0, 8, 5], [0, 7, 5, 9], [6, 6, 10, 5], [6, 12, 10, 4]];
    for (const [sx, sy, w, h] of stones) {
      px(c, x + sx + 1, y + sy + 1, base, w - 1, h - 1);
      px(c, x + sx + 1, y + sy + 1, light, w - 2, 1);
      px(c, x + sx + 1, y + sy + 1, light, 1, h - 2);
      // each stone is a little rounded: shaded bottom and right side
      px(c, x + sx + 1, y + sy + h - 1, shade(base, -0.22), w - 1, 1);
      px(c, x + sx + w - 1, y + sy + 2, shade(base, -0.14), 1, h - 3);
    }
    speckle(c, x, y, r, [shade(base, -0.1)], 4);
  };
}

function dirt(): TileDraw {
  return (c, x, y, r) => {
    px(c, x, y, '#c9a87c', 16, 16);
    speckle(c, x, y, r, ['#b8966b', '#d8bb91', '#a8865c'], 22);
  };
}




/** Wall top (beam seen from above) */
function wallTop(base: string): TileDraw {
  return (c, x, y) => {
    px(c, x, y, shade(base, -0.45), 16, 16);
    px(c, x, y + 12, shade(base, -0.25), 16, 4);
    px(c, x, y + 15, shade(base, -0.6), 16, 1);
  };
}

/** Wall face with wainscot */
function wallFace(base: string, accent: string, pattern: 'plain' | 'stripes' | 'dots' | 'stars' | 'shoji' | 'wood'): TileDraw {
  return (c, x, y) => {
    px(c, x, y, base, 16, 16);
    if (pattern === 'stripes') for (let i = 0; i < 16; i += 4) px(c, x + i, y, accent, 2, 11);
    if (pattern === 'dots') for (let j = 1; j < 11; j += 4) for (let i = (j % 8 ? 1 : 3); i < 16; i += 5) px(c, x + i, y + j, accent);
    if (pattern === 'stars') {
      px(c, x + 3, y + 3, accent);
      px(c, x + 11, y + 6, accent);
      px(c, x + 7, y + 1, accent);
      px(c, x + 12, y + 2, shade(accent, 0.3));
    }
    if (pattern === 'shoji') {
      px(c, x, y, accent, 16, 1);
      px(c, x, y + 5, accent, 16, 1);
      px(c, x + 7, y, accent, 1, 11);
      px(c, x, y, accent, 1, 11);
    }
    if (pattern === 'wood') for (let i = 0; i < 16; i += 5) px(c, x + i, y, shade(base, -0.15), 1, 11);
    // wainscot
    px(c, x, y + 11, PAL.woodL, 16, 4);
    px(c, x, y + 11, PAL.woodD, 16, 1);
    px(c, x, y + 15, PAL.woodDD, 16, 1);
    for (let i = 3; i < 16; i += 8) px(c, x + i, y + 12, PAL.wood, 1, 3);
  };
}

function windowTile(base: string, night: boolean): TileDraw {
  return (c, x, y, r) => {
    wallFace(base, base, 'plain')(c, x, y, r);
    px(c, x + 2, y + 1, PAL.woodD, 12, 9);
    px(c, x + 3, y + 2, night ? '#f2d58a' : PAL.sky, 10, 7);
    px(c, x + 3, y + 2, night ? '#f7e3a8' : '#e6f0f7', 4, 2);
    px(c, x + 8, y + 2, PAL.woodD, 1, 7);
    px(c, x + 3, y + 5, PAL.woodD, 10, 1);
  };
}

function doorMat(): TileDraw {
  return (c, x, y, r) => {
    plank(PAL.woodL, PAL.wood)(c, x, y, r);
    px(c, x + 2, y + 4, PAL.red, 12, 8);
    px(c, x + 3, y + 5, '#c97278', 10, 6);
  };
}





function voidTile(): TileDraw {
  return (c, x, y) => px(c, x, y, '#1a1626', 16, 16);
}

function stationFloor(): TileDraw {
  return (c, x, y, r) => {
    px(c, x, y, '#8d8790', 16, 16);
    px(c, x, y, '#7a7480', 16, 1);
    px(c, x, y, '#7a7480', 1, 16);
    speckle(c, x, y, r, ['#9a949c', '#7f7984'], 12);
  };
}

function rail(): TileDraw {
  return (c, x, y, r) => {
    dirt()(c, x, y, r);
    for (let j = 1; j < 16; j += 5) px(c, x + 1, y + j, PAL.woodD, 14, 2);
    px(c, x + 3, y, '#6f6a72', 2, 16);
    px(c, x + 11, y, '#6f6a72', 2, 16);
  };
}

// ---------------------------------------------------------------- room styles (decor)
export const FLOOR_STYLES: Record<string, { name: string; draw: TileDraw; price: number }> = {
  wood: { name: 'Madera cálida', draw: plank(PAL.woodL, PAL.wood), price: 0 },
  darkwood: { name: 'Madera oscura', draw: plank('#6e4a38', '#563626'), price: 150 },
  tatami: { name: 'Tatami', draw: tatamiMat, price: 200 },
  izakaya: { name: 'Tablones de izakaya', draw: izakayaFloor, price: 180 },
  checker: { name: 'Damero crema', draw: checker('#efe3c8', '#d2c3a2'), price: 150 },
  rose: { name: 'Baldosa rosa', draw: checker('#efc9c6', '#e0b0ae'), price: 180 },
  lavcarpet: { name: 'Alfombra lavanda', draw: carpet('#b7a8d6', '#cfc3e6'), price: 220 },
  moss: { name: 'Alfombra musgo', draw: carpet('#8fa77f', '#a7bd96'), price: 220 },
  night: { name: 'Alfombra noche', draw: carpet('#3b4470', '#f2c66d'), price: 260 },
  stone: { name: 'Piedra de río', draw: stonePath(PAL.stoneL, PAL.stoneD, '#d8d2c8'), price: 200 },
};

export const WALL_STYLES: Record<string, { name: string; base: string; accent: string; pattern: Parameters<typeof wallFace>[2]; price: number }> = {
  cream: { name: 'Yeso crema', base: '#efe1c4', accent: '#efe1c4', pattern: 'plain', price: 0 },
  sage: { name: 'Rayas salvia', base: '#c4d3b8', accent: '#aebfa0', pattern: 'stripes', price: 150 },
  rose: { name: 'Papel rosa', base: '#efcfcc', accent: '#d9a3a6', pattern: 'dots', price: 150 },
  night: { name: 'Cielo nocturno', base: '#3b4470', accent: '#f2c66d', pattern: 'stars', price: 240 },
  shoji: { name: 'Shoji', base: '#f3ead6', accent: '#a8734d', pattern: 'shoji', price: 220 },
  wood: { name: 'Paneles de madera', base: '#a8734d', accent: '#8a5a3c', pattern: 'wood', price: 180 },
  lav: { name: 'Lavanda suave', base: '#d6cce8', accent: '#bfb2db', pattern: 'dots', price: 150 },
};

// ---------------------------------------------------------------- registry
const DEFS: TileDef[] = [];
const add = (key: string, solid: boolean, draw: TileDraw) => DEFS.push({ key, solid, draw });

add('void', true, voidTile());
for (let i = 0; i < 4; i++) add('grass' + i, false, brightGrass(i));
add('dgrass', false, darkGrassBright);
add('dirt', false, pathTile);
for (let i = 0; i < 3; i++) add('cobble' + (i || ''), false, paverTile(i));
add('sand', false, sandTile);
add('shore', true, shoreTile);
for (let i = 0; i < 3; i++) add('water' + i, true, brightWater(i));
for (let i = 0; i < 3; i++) add('deep' + i, true, brightWater(i, true));
add('bridge', false, bridgeTile);
add('mat', false, doorMat());
add('bed_rose', false, flowerBedBright('#f4a6c0'));
add('bed_gold', false, flowerBedBright('#ffd36a'));
add('bed_lav', false, flowerBedBright('#b9a0ec'));
add('soil', false, soilTile(false));
add('soilwet', false, soilTile(true));
// transparent edge overlays (grass creeping over paths, grassy banks over water); index = mask 1..15
for (let m = 1; m < 16; m++) add('fr' + m, false, fringe(m));
for (let m = 1; m < 16; m++) add('bk' + m, false, bank(m));
add('station', false, stationFloor());
add('rail', false, rail());
add('kitchen', false, barFloor);
for (const [k, f] of Object.entries(FLOOR_STYLES)) add('floor_' + k, false, f.draw);
for (const [k, w] of Object.entries(WALL_STYLES)) {
  add('walltop_' + k, true, wallTop(w.base));
  add('wall_' + k, true, wallFace(w.base, w.accent, w.pattern));
  add('window_' + k, true, windowTile(w.base, false));
  add('windowN_' + k, true, windowTile(w.base, true));
}
add('walltop_stone', true, wallTop('#8d8790'));
// the restaurant's own walls (not sold as a decor style)
add('walltop_izakaya', true, izakayaTop);
add('upper_izakaya', true, izakayaUpper);
add('wall_izakaya', true, izakayaWall);
add('window_izakaya', true, izakayaWindow(false));
add('windowN_izakaya', true, izakayaWindow(true));
add('wall_stone', true, wallFace('#a59f9a', '#8d8790', 'plain'));

export const TILE_INDEX: Record<string, number> = Object.fromEntries(DEFS.map((d, i) => [d.key, i]));
export const TILE_SOLID: boolean[] = DEFS.map((d) => d.solid);
export const TILE_KEYS = DEFS.map((d) => d.key);
export const WATER_FRAMES = [
  [TILE_INDEX.water0, TILE_INDEX.water1, TILE_INDEX.water2],
  [TILE_INDEX.deep0, TILE_INDEX.deep1, TILE_INDEX.deep2],
];

export const TILESET_COLS = 16;

export function buildTileset(): HTMLCanvasElement {
  const rows = Math.ceil(DEFS.length / TILESET_COLS);
  const c = makeCanvas(TILESET_COLS * TS, rows * TS);
  const ctx = ctx2d(c);
  DEFS.forEach((d, i) => {
    const x = (i % TILESET_COLS) * TS;
    const y = Math.floor(i / TILESET_COLS) * TS;
    d.draw(ctx, x, y, rng(1000 + i * 7919));
  });
  return c;
}
