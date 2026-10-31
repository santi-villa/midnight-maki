/** Procedural 16x16 tileset. Each tile key maps to an index in the generated sheet. */
import { PAL } from './palette';
import { drawBridgeTile } from './bridges';
import { bank, bridgeTile, brightGrass, darkGrassBright, flowerBedBright, fringe, GREY_STONE, pathTile, paverTile, sandTile, shoreTile, shoreTileFrame, soilTile, waterTile } from './nature';
import { barFloor, plankFloor, izakayaFloor, izakayaTop, izakayaUpper, izakayaWall, izakayaWindow, tatamiMat } from './izakaya';
import { ctx2d, makeCanvas, px, rng, shade, type Ctx } from './pixel';
import { drawExteriorTile, SEA_FRAMES } from './exteriors';
import { drawVillageCliff } from './serene';

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


function dirt(): TileDraw {
  return (c, x, y, r) => {
    px(c, x, y, '#d5b68a', 16, 16);
    speckle(c, x, y, r, ['#c5a67e', '#e4cca5', '#b99c74'], 7);
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

/** Upper part of a two-tile wall: pattern, crown moulding on top and a soft shadow under it. */
function wallUpper(base: string, accent: string, pattern: Parameters<typeof wallFace>[2]): TileDraw {
  return (c, x, y, r) => {
    wallFace(base, accent, pattern)(c, x, y, r);
    // repaint the lower band (no wainscot up here)
    px(c, x, y + 11, base, 16, 5);
    if (pattern === 'stripes') for (let i = 0; i < 16; i += 4) px(c, x + i, y + 11, accent, 2, 5);
    if (pattern === 'wood') for (let i = 0; i < 16; i += 5) px(c, x + i, y + 11, shade(base, -0.15), 1, 5);
    // crown moulding
    px(c, x, y, PAL.woodD, 16, 3);
    px(c, x, y, PAL.woodL, 16, 1);
    px(c, x, y + 3, shade(base, -0.18), 16, 1);
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


/** Rock face of a hillside: 0 = the rim with grass hanging over it, 1 = the face, 2 = the foot with its shadow. */
function cliffTile(part: 0 | 1 | 2): TileDraw {
  return (c, x, y, r) => {
    if (drawVillageCliff(c, x, y, part)) return;
    const base = '#8d7a64', dark = '#5b4b3d', light = '#b9a38a', mid = '#7a6753';
    px(c, x, y, base, 16, 16);
    for (let j = 0; j < 16; j += 5) {
      const off = (j / 5) % 2 ? 4 : 0;
      px(c, x, y + j + 4, dark, 16, 1);
      for (let i = off; i < 16; i += 7 + ((i + j) % 3)) px(c, x + i, y + j, dark, 1, 5);
      px(c, x, y + j, light, 16, 1);
      for (let i = off + 1; i < 16; i += 8) px(c, x + i, y + j + 1, mid, 3, 2);
    }
    for (let k = 0; k < 10; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), r() < 0.5 ? dark : light, 1, 1);
    if (part === 0) {
      px(c, x, y, PAL.grass, 16, 3);
      for (let i = 0; i < 16; i += 3) px(c, x + i, y + 3, PAL.grassD, 2, 1 + (i % 2));
      px(c, x, y, PAL.grassL, 16, 1);
    }
    if (part === 2) {
      px(c, x, y + 11, shade(base, -0.25), 16, 5);
      px(c, x, y + 14, shade(base, -0.45), 16, 2);
      for (let i = 1; i < 16; i += 5) px(c, x + i, y + 12, '#6a8f4c', 2, 1);
    }
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
  wood: { name: 'Madera cálida', draw: plankFloor('#b98252', '#7e4f31'), price: 0 },
  darkwood: { name: 'Madera oscura', draw: plankFloor('#7a5038', '#4e3426'), price: 150 },
  tatami: { name: 'Tatami', draw: tatamiMat, price: 200 },
  izakaya: { name: 'Tablones de izakaya', draw: izakayaFloor(), price: 180 },
  checker: { name: 'Damero crema', draw: checker('#efe3c8', '#d2c3a2'), price: 150 },
  rose: { name: 'Baldosa rosa', draw: checker('#efc9c6', '#e0b0ae'), price: 180 },
  lavcarpet: { name: 'Alfombra lavanda', draw: carpet('#b7a8d6', '#cfc3e6'), price: 220 },
  moss: { name: 'Alfombra musgo', draw: carpet('#8fa77f', '#a7bd96'), price: 220 },
  night: { name: 'Alfombra noche', draw: carpet('#3b4470', '#f2c66d'), price: 260 },
  stone: { name: 'Piedra de río', draw: paverTile(1, GREY_STONE), price: 200 },
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
add('grass4', false, brightGrass(0));
add('grass5', false, brightGrass(1));
add('dgrass', false, darkGrassBright);
add('dgrass1', false, darkGrassBright);
add('dirt', false, pathTile(0));
add('dirt1', false, pathTile(1));
add('dirt2', false, pathTile(2));
for (let i = 0; i < 3; i++) add('cobble' + (i || ''), false, paverTile(i));
for (let i = 0; i < 3; i++) add('civic' + (i || ''), false, paverTile(i, GREY_STONE));
// sand: the Modern Exteriors pattern when its atlas is installed, the drawn one otherwise
const sand = (i: number): TileDraw => (c, x, y, r) => { if (!drawExteriorTile(c, x, y, 'sand')) sandTile(i)(c, x, y, r); };
add('sand', false, sand(0));
add('sand1', false, sand(1));
add('sand2', false, sand(2));
// packed sand: the beach's walks (the darker pattern of the same pack, wet and trodden)
add('sandpath', false, (c, x, y, r) => { if (!drawExteriorTile(c, x, y, 'sandpath')) pathTile(0)(c, x, y, r); });
add('shore', true, shoreTile);
for (let f = 1; f < 4; f++) add('shore' + f, true, shoreTileFrame(f));
// water: wt<calm|rain><shallow|deep><variant>_<frame>; water0 / deep0 stay as aliases of the first calm frame
add('water0', true, waterTile(0, 0, 'shallow', false));
add('deep0', true, waterTile(0, 0, 'deep', false));
// wt<calm|rain><s=shallow|m=mid|d=deep><variant>_<frame>; 'mid' softens the step between shallow and deep water
for (const rain of [false, true])
  for (const depth of ['shallow', 'mid', 'deep'] as const)
    for (let v = 0; v < 3; v++) for (let f = 0; f < 4; f++) add(`wt${rain ? 'r' : 'c'}${depth[0]}${v}_${f}`, true, waterTile(v, f, depth, rain));
// the open sea (beach): sea<calm|rain><s|m|d><parity>_<frame>, the pack's 2x2 water pattern with its 8 frames;
// deeper water and rain are a tint over the same pixels. Without the atlas it falls back to the drawn water.
const SEA_TINT = { s: '', m: 'rgba(18,58,112,0.16)', d: 'rgba(14,40,92,0.32)' } as const;
for (const rain of [false, true])
  for (const depth of ['s', 'm', 'd'] as const)
    for (let p = 0; p < 4; p++) for (let f = 0; f < SEA_FRAMES; f++) add(`sea${rain ? 'r' : 'c'}${depth}${p}_${f}`, true, (c, x, y, r) => {
      if (!drawExteriorTile(c, x, y, `sea${p}_${f}`)) return waterTile(p % 3, f % 4, depth === 's' ? 'shallow' : depth === 'm' ? 'mid' : 'deep', rain)(c, x, y, r);
      for (const tint of [SEA_TINT[depth], rain ? 'rgba(96,104,120,0.28)' : '']) if (tint) { c.fillStyle = tint; c.fillRect(x, y, 16, 16); }
    });
// the sea's waterline under dry sand (a two-tile pattern)
// plus its sides and corners where the coast steps (see seaEdge in zoneRuntime): seashore<kind><parity>_<frame>
export const SEA_EDGES = [['', 2], ['W', 2], ['E', 2], ['NW', 1], ['NE', 1], ['IW', 1], ['IE', 1]] as const;
for (const [kind, parities] of SEA_EDGES) for (let p = 0; p < parities; p++) for (let f = 0; f < SEA_FRAMES; f++) add(`seashore${kind}${p}_${f}`, true, (c, x, y, r) => {
  if (!drawExteriorTile(c, x, y, `seashore${kind}${p}_${f}`)) shoreTileFrame(f % 4)(c, x, y, r);
});
add('bridge', false, bridgeTile);
for (let mask = 0; mask < 256; mask++) add('bridge_' + mask, false, (c, x, y) => drawBridgeTile(c, x, y, mask));
add('mat', false, doorMat());
add('bed_rose', false, flowerBedBright('#f4a6c0'));
add('bed_gold', false, flowerBedBright('#ffd36a'));
add('bed_lav', false, flowerBedBright('#b9a0ec'));
add('soil', false, soilTile(false));
add('soil1', false, soilTile(false, 2));
add('soilwet', false, soilTile(true));
// transparent edge overlays (grass creeping over paths, grassy banks over water); index = mask 1..15
for (let m = 1; m < 16; m++) add('fr' + m, false, fringe(m));
for (let m = 1; m < 16; m++) add('bk' + m, false, bank(m));
for (let m = 1; m < 16; m++) add('bkb' + m, false, bank(m, 1)); // second foam frame
add('station', false, paverTile(2, GREY_STONE));
add('rail', false, rail());
add('cliff_top', true, cliffTile(0));
add('cliff_face', true, cliffTile(1));
add('cliff_foot', true, cliffTile(2));
add('kitchen', false, barFloor);
add('kitchen1', false, barFloor);
add('kitchen2', false, barFloor);
for (const [k, f] of Object.entries(FLOOR_STYLES)) add('floor_' + k, false, f.draw);
add('floor_wood1', false, plankFloor('#b98252', '#7e4f31', 5));
add('floor_wood2', false, plankFloor('#b98252', '#7e4f31', 9));
add('floor_darkwood1', false, plankFloor('#7a5038', '#4e3426', 5));
add('floor_darkwood2', false, plankFloor('#7a5038', '#4e3426', 9));
add('floor_tatami1', false, tatamiMat);
add('floor_tatami2', false, tatamiMat);
add('floor_izakaya1', false, izakayaFloor(5));
add('floor_izakaya2', false, izakayaFloor(9));
for (const [k, w] of Object.entries(WALL_STYLES)) {
  add('walltop_' + k, true, wallTop(w.base));
  add('wall_' + k, true, wallFace(w.base, w.accent, w.pattern));
  add('upper_' + k, true, wallUpper(w.base, w.accent, w.pattern));
  add('window_' + k, true, windowTile(w.base, false));
  add('windowN_' + k, true, windowTile(w.base, true));
}
add('walltop_stone', true, wallTop('#8d8790'));
add('upper_stone', true, wallUpper('#a59f9a', '#8d8790', 'plain'));
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
/** The 4 animation frames of a water tile (rain = choppier, greyer set). */
export function waterFrames(depth: 's' | 'm' | 'd', variant: number, rain: boolean): number[] {
  return [0, 1, 2, 3].map((f) => TILE_INDEX[`wt${rain ? 'r' : 'c'}${depth}${variant}_${f}`]);
}
/** Beach waterline frames (frame 0 is the plain 'shore' tile). */
export const SHORE_FRAMES = [TILE_INDEX.shore, TILE_INDEX.shore1, TILE_INDEX.shore2, TILE_INDEX.shore3];
/** The animation frames of a sea tile (parity = x % 2 + 2 * (y % 2)) and of the sea's waterline (parity = x % 2). */
export function seaFrames(depth: 's' | 'm' | 'd', parity: number, rain: boolean): number[] {
  return Array.from({ length: SEA_FRAMES }, (_, f) => TILE_INDEX[`sea${rain ? 'r' : 'c'}${depth}${parity}_${f}`]);
}
export function seaShoreFrames(edge: string): number[] {
  return Array.from({ length: SEA_FRAMES }, (_, f) => TILE_INDEX[`${edge}_${f}`]);
}

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
