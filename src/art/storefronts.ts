/**
 * The shop and restaurant facades of Villa Nori. Each one has its own materials, roof, awnings and window displays,
 * but they all keep the door and window rectangles of `buildingLayout` (nature.ts) so the night-time glow still lines up.
 * The restaurant has four looks (stage 0..3) that follow its level; see restaurant/stages.ts.
 */
import { ellipse, px, shade, type Ctx } from './pixel';

export type StoreKind = 'izakaya' | 'bakery' | 'clothes' | 'store' | 'library' | 'gallery';

interface Lay {
  roofH: number;
  wallY: number;
  dx: number;
  doorW: number;
  doorY: number;
  doorH: number;
  windows: { x: number; y: number; w: number; h: number }[];
}

function layout(W: number, H: number): Lay {
  const roofH = Math.floor(H * 0.46);
  const wallY = roofH - 3;
  const doorW = 14;
  const dx = Math.floor(W / 2 - doorW / 2);
  const wy = wallY + 13; // below the shop sign
  const windows: Lay['windows'] = [];
  for (let x = 9; x + 12 < dx - 3; x += 20) windows.push({ x, y: wy, w: 11, h: 9 });
  for (let x = dx + doorW + 7; x + 12 < W - 6; x += 20) windows.push({ x, y: wy, w: 11, h: 9 });
  return { roofH, wallY, dx, doorW, doorY: H - 25, doorH: 20, windows };
}

const INK = '#2b1d17';

function foundation(c: Ctx, W: number, H: number, col = '#6f6a72') {
  px(c, 3, H - 6, col, W - 6, 6);
  for (let x = 4; x < W - 4; x += 5) {
    px(c, x, H - 5, shade(col, 0.28), 4, 2);
    px(c, x + 2, H - 3, shade(col, 0.1), 4, 2);
  }
}

function wall(c: Ctx, W: number, y0: number, h: number, col: string, planks = false, seam = shade(col, -0.25)) {
  px(c, 3, y0, shade(col, -0.5), W - 6, h);
  px(c, 4, y0, col, W - 8, h);
  px(c, 4, y0, shade(col, -0.14), W - 8, 3);
  if (planks) for (let x = 7; x < W - 5; x += 6) px(c, x, y0 + 3, seam, 1, h - 3);
}

/** Tiled roof with overhanging eaves. `curl` turns the lower corners up like a Japanese roof. */
function tiledRoof(c: Ctx, W: number, y0: number, h: number, col: string, curl = false, inset = 0) {
  const dark = shade(col, -0.35);
  const light = shade(col, 0.2);
  const edge = shade(col, -0.58);
  for (let j = 0; j < h; j++) {
    const ins = Math.max(0, Math.round((h - 1 - j) * 0.0)) + inset;
    px(c, ins, y0 + j, j === 0 ? edge : j % 3 === 2 ? dark : col, W - ins * 2, 1);
    if (j > 0 && j < h - 2 && j % 3 !== 2) for (let i = ins + 2 + (Math.floor(j / 3) % 2) * 3; i < W - ins - 2; i += 6) px(c, i, y0 + j, light, 4, 1);
    if (j > 0 && j % 3 === 2) for (let i = ins + 4 + (Math.floor(j / 3) % 2) * 3; i < W - ins - 2; i += 6) px(c, i, y0 + j, edge, 1, 1);
  }
  px(c, inset, y0 + h - 2, edge, W - inset * 2, 2);
  px(c, inset + 1, y0 + 1, light, W - inset * 2 - 2, 1);
  if (curl) {
    for (const s of [0, 1]) {
      const x = s ? W - inset - 1 : inset;
      px(c, x, y0 + h - 3, edge, 1, 3);
      px(c, s ? x + 1 : x - 1, y0 + h - 4, edge, 1, 2);
    }
  }
}

function stripedAwning(c: Ctx, x: number, y: number, w: number, a: string, b: string, h = 5) {
  for (let i = 0; i < w; i += 4) {
    const col = (i / 4) % 2 ? b : a;
    px(c, x + i, y, col, 4, h);
    px(c, x + i, y + h, shade(col, -0.2), 4, 1);
    px(c, x + i, y, shade(col, 0.22), 4, 1);
  }
  px(c, x, y - 1, shade(a, -0.5), w, 1);
}

function paperLantern(c: Ctx, x: number, y: number, col = '#d9675f', string = true) {
  if (string) px(c, x, y - 4, INK, 1, 4);
  px(c, x - 3, y, INK, 7, 1);
  px(c, x - 3, y + 8, INK, 7, 1);
  ellipse(c, x, y + 4, 3.4, 4, shade(col, -0.35));
  ellipse(c, x, y + 4, 2.8, 3.6, col);
  px(c, x - 1, y + 2, shade(col, 0.45), 2, 2);
  px(c, x - 3, y + 4, shade(col, -0.35), 7, 1);
}

function stepAndMat(c: Ctx, L: Lay, H: number) {
  px(c, L.dx - 2, H - 5, '#6f6a72', L.doorW + 4, 3);
  px(c, L.dx - 1, H - 5, '#c6c2cc', L.doorW + 2, 1);
}

function plantPot(c: Ctx, x: number, H: number, bloom = '#f4a6c0') {
  px(c, x, H - 9, INK, 5, 5);
  px(c, x + 1, H - 8, '#b0533f', 3, 3);
  ellipse(c, x + 2.5, H - 11, 3, 2.5, '#5f8a47');
  px(c, x + 1, H - 12, bloom);
  px(c, x + 3, H - 11, '#ffd36a');
}

// ------------------------------------------------------------------ restaurant (four stages)
function noren(c: Ctx, x: number, y: number, w: number, h: number, col: string, wave: boolean) {
  px(c, x, y, col, w, h);
  px(c, x, y, shade(col, 0.2), w, 1);
  for (let i = x + 3; i < x + w - 1; i += 4) px(c, i, y + 1, shade(col, -0.35), 1, h - 1);
  if (wave) for (let i = x + 1; i < x + w - 1; i += 3) {
    px(c, i, y + Math.floor(h / 2), '#e8f0f8', 2, 1);
    px(c, i + 1, y + Math.floor(h / 2) - 1, '#e8f0f8', 1, 1);
  }
}

function shoji(c: Ctx, w: { x: number; y: number; w: number; h: number }, lit: boolean, broken = false) {
  px(c, w.x - 1, w.y - 1, INK, w.w + 2, w.h + 2);
  px(c, w.x, w.y, lit ? '#f7dc8f' : '#2c3250', w.w, w.h);
  if (lit) px(c, w.x, w.y, '#fff0be', Math.floor(w.w / 2), 2);
  const frame = lit ? '#7a4a2f' : '#3a3f5c';
  for (let i = 3; i < w.w; i += 3) px(c, w.x + i, w.y, frame, 1, w.h);
  px(c, w.x, w.y + Math.floor(w.h / 2), frame, w.w, 1);
  if (broken) for (let k = 0; k < 7; k++) px(c, w.x + 1 + k, w.y + 1 + k, '#d0cde0', 1, 1);
}

function izakaya(c: Ctx, W: number, H: number, stage: number, roofCol: string) {
  const L = layout(W, H);
  const worn = stage === 0;
  const wood = worn ? '#5e5750' : stage >= 3 ? '#5a3424' : '#6a4128';
  foundation(c, W, H, worn ? '#5d5964' : '#6f6a72');
  wall(c, W, L.wallY, H - L.wallY - 4, wood, true, shade(wood, -0.3));
  // dark timber posts between the bays
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 8]) px(c, x, L.wallY, shade(wood, -0.38), 3, H - L.wallY - 4);
  // roof: the grand one gets a second tier
  if (stage >= 3) {
    tiledRoof(c, W, 17, L.roofH - 14, roofCol, true);
    tiledRoof(c, W, 3, 20, shade(roofCol, 0.05), true, 22);
    px(c, 24, 2, '#f2c66d', W - 48, 1);
    for (const gx of [22, W - 25]) {
      px(c, gx, 0, '#f2c66d', 3, 2);
      px(c, gx + (gx < W / 2 ? -1 : 1), 2, '#f2c66d', 2, 1);
    }
    px(c, 4, 17 + L.roofH - 16, '#f2c66d', W - 8, 1);
  } else tiledRoof(c, W, 0, L.roofH, roofCol, true);
  // windows (same rectangles the night glow uses)
  L.windows.forEach((w, i) => shoji(c, w, !worn, worn && i === 1));
  if (worn) {
    px(c, L.windows[1].x - 2, L.windows[1].y + 1, '#7a5a3c', L.windows[1].w + 4, 3);
    px(c, L.windows[1].x - 2, L.windows[1].y + 6, '#6a4c30', L.windows[1].w + 4, 3);
  }
  // sliding door with lattice and noren
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, worn ? '#4a4540' : '#8a5634', L.doorW, L.doorH - 3);
  for (let i = L.dx + 3; i < L.dx + L.doorW - 1; i += 3) px(c, i, L.doorY + 9, worn ? '#3a3633' : '#c99c64', 1, L.doorH - 10);
  px(c, L.dx + Math.floor(L.doorW / 2), L.doorY + 3, INK, 1, L.doorH - 3);
  noren(c, L.dx, L.doorY + 2, L.doorW, 7, worn ? '#3b4058' : '#2f3b6b', !worn);
  if (worn) {
    // torn noren, stains, moss, weeds and unlit lanterns
    px(c, L.dx + 2, L.doorY + 7, wood, 3, 2);
    px(c, L.dx + 9, L.doorY + 6, wood, 2, 3);
    for (let i = 0; i < 18; i++) px(c, 6 + ((i * 29) % (W - 16)), L.wallY + 4 + ((i * 11) % 34), i % 2 ? '#454039' : '#3e3a35', 3 + (i % 3), 2 + (i % 2));
    for (let i = 0; i < 9; i++) px(c, 10 + ((i * 23) % (W - 24)), 6 + ((i * 7) % 22), '#5b7a43', 3, 1);
    for (const [x, y, w, h] of [[22, 12, 9, 4], [70, 20, 11, 4], [44, 5, 7, 3], [88, 9, 8, 3]]) px(c, x, y, '#1f1a24', w, h);
    for (const lx of [L.dx - 6, L.dx + L.doorW + 4]) paperLantern(c, lx, H - 31, '#7a7780');
    for (let x = 4; x < 18; x += 2) px(c, x, H - 5 - (x % 3), '#5f7a3e', 1, 3);
    for (let x = W - 20; x < W - 5; x += 2) px(c, x, H - 5 - (x % 4), '#5f7a3e', 1, 3);
    return;
  }
  stepAndMat(c, L, H);
  // planters under the windows
  for (const w of L.windows) {
    px(c, w.x - 1, w.y + w.h + 2, '#3a2418', w.w + 2, 4);
    px(c, w.x, w.y + w.h + 2, '#5a8a3a', w.w, 1);
    for (let i = 0; i < w.w; i += 3) px(c, w.x + i, w.y + w.h + 1, '#5f8a47', 1, 2);
  }
  // red lanterns beside the door
  for (const lx of [L.dx - 6, L.dx + L.doorW + 4]) paperLantern(c, lx, H - 31);
  if (stage >= 2) {
    // popular: row of small lanterns under the eaves, striped awning over the door
    for (let x = 9; x < W - 8; x += 11) if (Math.abs(x - W / 2) > 9) paperLantern(c, x, L.wallY + 2, x % 22 < 11 ? '#e0653a' : '#f6e3d0');
    stripedAwning(c, L.dx - 4, H - 35, L.doorW + 8, '#c94a4a', '#f6e3d0', 4);
  }
  if (stage >= 3) {
    // heart of the village: gold fittings, three stars over the ridge, big lantern over the door
    for (const sx of [W / 2 - 14, W / 2 - 1, W / 2 + 12]) {
      px(c, sx, 6, '#f2c66d', 3, 3);
      px(c, sx + 1, 4, '#f2c66d', 1, 7);
      px(c, sx - 1, 7, '#f2c66d', 5, 1);
    }
    paperLantern(c, Math.floor(W / 2), H - 44, '#f6e3d0');
    for (const w of L.windows) px(c, w.x - 2, w.y - 2, '#f2c66d', w.w + 4, 1);
  }
}

// ------------------------------------------------------------------ shops
function bakery(c: Ctx, W: number, H: number) {
  const L = layout(W, H);
  foundation(c, W, H, '#7a5a4a');
  wall(c, W, L.wallY, H - L.wallY - 4, '#f6e8cc');
  // brick lower half
  const by = L.wallY + 26;
  px(c, 4, by, '#8e3f33', W - 8, H - by - 6);
  for (let y = by; y < H - 6; y += 3) {
    px(c, 4, y, '#6e2c24', W - 8, 1);
    for (let x = 4 + ((y / 3) % 2) * 4; x < W - 6; x += 8) px(c, x, y + 1, '#a9503f', 7, 2);
  }
  px(c, 4, by - 1, '#7a4a2f', W - 8, 2);
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 7]) px(c, x, L.wallY, '#7a4a2f', 3, by - L.wallY);
  tiledRoof(c, W, 0, L.roofH, '#4a3f4c');
  // brick chimney with smoke
  px(c, W - 26, 0, '#8e3f33', 9, 14);
  px(c, W - 27, 0, '#6e2c24', 11, 2);
  for (let y = 3; y < 14; y += 3) px(c, W - 26, y, '#a9503f', 8, 1);
  // front awning over the whole shop window band
  stripedAwning(c, 6, L.wallY + 10, W - 12, '#f6f1e6', '#7a4a2f', 3);
  // display windows full of bread
  for (const w of L.windows) {
    px(c, w.x - 1, w.y - 1, INK, w.w + 2, w.h + 2);
    px(c, w.x, w.y, '#f7dc8f', w.w, w.h);
    px(c, w.x, w.y + 5, '#a8734d', w.w, 1);
    px(c, w.x, w.y + 8, '#a8734d', w.w, 1);
    for (let i = 1; i < w.w - 2; i += 4) {
      ellipse(c, w.x + i + 1.5, w.y + 3, 2, 1.5, '#d9964a');
      px(c, w.x + i + 1, w.y + 2, '#f2c27a');
    }
    for (let i = 2; i < w.w - 2; i += 4) px(c, w.x + i, w.y + 7, '#c07a3c', 3, 1);
  }
  // wooden door with a little glass
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, '#8a5634', L.doorW, L.doorH - 3);
  px(c, L.dx + 3, L.doorY + 5, '#f7dc8f', L.doorW - 6, 7);
  px(c, L.dx + 3, L.doorY + 5, '#fff0be', 3, 2);
  px(c, L.dx + Math.floor(L.doorW / 2), L.doorY + 5, INK, 1, 7);
  px(c, L.dx + L.doorW - 3, L.doorY + 13, '#f2c66d', 1, 2);
  stepAndMat(c, L, H);
  // baked goods outside: a bread basket and a flour sack
  const bx = L.dx - 15;
  px(c, bx, H - 9, INK, 11, 6);
  px(c, bx + 1, H - 8, '#b98252', 9, 4);
  for (let i = 0; i < 3; i++) px(c, bx + 2 + i * 3, H - 12 - (i % 2), '#d9964a', 2, 5);
  px(c, bx + 1, H - 13, '#e8b46a', 8, 1);
  const sx = L.dx + L.doorW + 5;
  px(c, sx, H - 11, INK, 8, 8);
  px(c, sx + 1, H - 10, '#efe6d0', 6, 6);
  px(c, sx + 2, H - 9, '#d8cdb5', 4, 1);
}

function clothes(c: Ctx, W: number, H: number) {
  const L = layout(W, H);
  foundation(c, W, H, '#7a6a72');
  wall(c, W, L.wallY, H - L.wallY - 4, '#f6e2d6', true, '#eccfc2');
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 7]) px(c, x, L.wallY, '#9a5a64', 3, H - L.wallY - 4);
  tiledRoof(c, W, 0, L.roofH, '#c25a6a', true);
  px(c, 4, L.wallY - 1, '#f2c66d', W - 8, 1);
  // windows show garments on hangers
  const cloth = ['#c94a6a', '#3b4470', '#f2c66d', '#7fa356', '#9686bd'];
  L.windows.forEach((w, wi) => {
    px(c, w.x - 1, w.y - 1, INK, w.w + 2, w.h + 2);
    px(c, w.x, w.y, '#fbeedd', w.w, w.h);
    px(c, w.x, w.y + 1, '#c9a24a', w.w, 1);
    for (let i = 0; i < 2; i++) {
      const col = cloth[(wi * 2 + i) % cloth.length];
      const gx = w.x + 1 + i * 5;
      px(c, gx, w.y + 2, col, 4, 6);
      px(c, gx - 1, w.y + 2, shade(col, -0.15), 1, 3);
      px(c, gx + 4, w.y + 2, shade(col, -0.15), 1, 3);
      px(c, gx + 1, w.y + 2, '#fbeedd', 2, 1);
      px(c, gx, w.y + 6, shade(col, -0.25), 4, 1);
    }
  });
  // pink noren and striped awning over the door
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, '#8a5634', L.doorW, L.doorH - 3);
  for (let i = L.dx + 3; i < L.dx + L.doorW - 1; i += 3) px(c, i, L.doorY + 9, '#76472a', 1, L.doorH - 10);
  noren(c, L.dx, L.doorY + 2, L.doorW, 7, '#d9a3a6', false);
  px(c, L.dx + 5, L.doorY + 4, '#f6f1e6', 4, 3);
  stripedAwning(c, L.dx - 6, H - 31, L.doorW + 12, '#d9a3a6', '#f6f1e6', 4);
  stepAndMat(c, L, H);
  for (const lx of [L.dx - 10, L.dx + L.doorW + 9]) paperLantern(c, lx, L.wallY + 4, '#f6f1e6');
  plantPot(c, L.dx - 14, H, '#f4a6c0');
  plantPot(c, L.dx + L.doorW + 9, H, '#fff3c0');
}

function store(c: Ctx, W: number, H: number) {
  const L = layout(W, H);
  foundation(c, W, H, '#6f6a72');
  wall(c, W, L.wallY, H - L.wallY - 4, '#d8b88a', true, '#b9976a');
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 7]) px(c, x, L.wallY, '#6a4128', 3, H - L.wallY - 4);
  tiledRoof(c, W, 0, L.roofH, '#2f6b4f');
  stripedAwning(c, 6, L.wallY + 10, W - 12, '#7a4a2f', '#f6f1e6', 3);
  // shelves with jars and sacks through the windows
  L.windows.forEach((w) => {
    px(c, w.x - 1, w.y - 1, INK, w.w + 2, w.h + 2);
    px(c, w.x, w.y, '#f7dc8f', w.w, w.h);
    px(c, w.x, w.y + 4, '#7a4a2f', w.w, 1);
    px(c, w.x, w.y + 8, '#7a4a2f', w.w, 1);
    for (let i = 1; i < w.w - 2; i += 3) {
      px(c, w.x + i, w.y + 1, ['#c25a4a', '#7fa356', '#f2c66d'][i % 3], 2, 3);
      px(c, w.x + i, w.y + 5, ['#9686bd', '#d9964a', '#e8e2d2'][i % 3], 2, 3);
    }
  });
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, '#8a5634', L.doorW, L.doorH - 3);
  for (let i = L.dx + 2; i < L.dx + L.doorW - 1; i += 3) px(c, i, L.doorY + 4, '#76472a', 1, L.doorH - 5);
  px(c, L.dx + L.doorW - 3, L.doorY + 11, '#f2c66d', 1, 2);
  stepAndMat(c, L, H);
  // crates of produce, a barrel and sacks
  const bx = L.dx - 17;
  for (const [x, col] of [[bx, '#e0424f'], [bx + 9, '#7fbf4f']] as const) {
    px(c, x, H - 10, INK, 9, 6);
    px(c, x + 1, H - 9, '#c48d5e', 7, 4);
    for (let i = 0; i < 3; i++) ellipse(c, x + 2 + i * 2.5, H - 10, 1.4, 1.4, col);
  }
  const rx = L.dx + L.doorW + 5;
  px(c, rx, H - 13, INK, 8, 10);
  px(c, rx + 1, H - 12, '#9a6a40', 6, 8);
  px(c, rx + 1, H - 10, '#4a3428', 6, 1);
  px(c, rx + 1, H - 7, '#4a3428', 6, 1);
  px(c, rx + 10, H - 11, INK, 8, 8);
  px(c, rx + 11, H - 10, '#efe6d0', 6, 6);
}

function library(c: Ctx, W: number, H: number) {
  const L = layout(W, H);
  foundation(c, W, H, '#6f6a72');
  wall(c, W, L.wallY, H - L.wallY - 4, '#ece2f2');
  // brick base and pillars
  const by = L.wallY + 26;
  px(c, 4, by, '#8a4a3a', W - 8, H - by - 6);
  for (let y = by; y < H - 6; y += 3) {
    px(c, 4, y, '#6a3328', W - 8, 1);
    for (let x = 4 + ((y / 3) % 2) * 4; x < W - 6; x += 8) px(c, x, y + 1, '#a45a48', 7, 2);
  }
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 7]) px(c, x, L.wallY, '#5a4a6a', 3, by - L.wallY);
  tiledRoof(c, W, 0, L.roofH, '#45507f');
  // tall windows with shelves of colourful books
  const books = ['#c25a6a', '#3b4470', '#d9a24a', '#5f8a47', '#9686bd', '#e8e2d2'];
  L.windows.forEach((w) => {
    px(c, w.x - 1, w.y - 2, INK, w.w + 2, w.h + 4);
    px(c, w.x, w.y - 1, '#f7dc8f', w.w, w.h + 2);
    for (let row = 0; row < 2; row++) {
      const yy = w.y + row * 5;
      px(c, w.x, yy + 4, '#7a4a2f', w.w, 1);
      for (let i = 0; i < w.w; i += 2) px(c, w.x + i, yy, books[(i + row * 3) % books.length], 2, 4 - (i % 3 === 0 ? 1 : 0));
    }
  });
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, '#6a4a6a', L.doorW, L.doorH - 3);
  px(c, L.dx + 3, L.doorY + 5, '#f7dc8f', L.doorW - 6, 6);
  px(c, L.dx + Math.floor(L.doorW / 2), L.doorY + 5, INK, 1, 6);
  stepAndMat(c, L, H);
  for (const lx of [L.dx - 8, L.dx + L.doorW + 7]) paperLantern(c, lx, L.wallY + 10, '#f6e3b0');
  // open book emblem
  px(c, W / 2 - 6, L.wallY + 1, INK, 12, 7);
  px(c, W / 2 - 5, L.wallY + 2, '#3b4470', 5, 5);
  px(c, W / 2, L.wallY + 2, '#b2585e', 5, 5);
  plantPot(c, L.dx - 14, H, '#9686bd');
}

function gallery(c: Ctx, W: number, H: number) {
  const L = layout(W, H);
  foundation(c, W, H, '#7a6a82');
  wall(c, W, L.wallY, H - L.wallY - 4, '#f6ecd6');
  for (const x of [4, L.dx - 4, L.dx + L.doorW + 1, W - 7]) px(c, x, L.wallY, '#7a5fb0', 3, H - L.wallY - 4);
  tiledRoof(c, W, 0, L.roofH, '#7a5fb0', true);
  px(c, 4, L.wallY - 1, '#f2c66d', W - 8, 1);
  const art: [string, string][] = [['#e8826f', '#3b4470'], ['#7fa356', '#f2c66d'], ['#9686bd', '#f6ecd6']];
  L.windows.forEach((w, i) => {
    px(c, w.x - 1, w.y - 1, INK, w.w + 2, w.h + 2);
    px(c, w.x, w.y, '#fbf6ea', w.w, w.h);
    const [a, b] = art[i % art.length];
    px(c, w.x + 1, w.y + 1, '#c9a24a', 9, 7);
    px(c, w.x + 2, w.y + 2, a, 7, 5);
    px(c, w.x + 2, w.y + 5, b, 7, 2);
    ellipse(c, w.x + 6, w.y + 4, 1.5, 1.5, '#fff6c8');
  });
  px(c, L.dx - 1, L.doorY + 2, INK, L.doorW + 2, L.doorH - 2);
  px(c, L.dx, L.doorY + 3, '#8a5634', L.doorW, L.doorH - 3);
  px(c, L.dx + 3, L.doorY + 5, '#f7dc8f', L.doorW - 6, 7);
  px(c, L.dx + Math.floor(L.doorW / 2), L.doorY + 5, INK, 1, 7);
  stepAndMat(c, L, H);
  for (const lx of [L.dx - 8, L.dx + L.doorW + 7]) paperLantern(c, lx, L.wallY + 10, '#f6f1e6');
  plantPot(c, L.dx + L.doorW + 8, H, '#fff3c0');
}

export function drawStorefront(c: Ctx, W: number, H: number, kind: StoreKind, stage = 0, roof = '#2f4f7a') {
  switch (kind) {
    case 'izakaya': return izakaya(c, W, H, stage, roof);
    case 'bakery': return bakery(c, W, H);
    case 'clothes': return clothes(c, W, H);
    case 'store': return store(c, W, H);
    case 'library': return library(c, W, H);
    case 'gallery': return gallery(c, W, H);
  }
}
