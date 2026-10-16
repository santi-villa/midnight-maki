/**
 * Village homes, drawn at native pixel resolution on the shared 16px grid (96x80: six tiles wide, five tall).
 * One layout function drives the art, the night window glow and the doorway, so they always line up.
 * `variant` = trade * 2 + (door on the right ? 1 : 0); trades: 0 home, 1 tea house, 2 fishmonger, 3 florist.
 */
import { ellipse, px, shade, type Ctx } from './pixel';
import { cozyRoofRow } from './cozyAssets';

const INK = '#4b3c32', TIM = '#795a3e', TIM2 = '#a07952', TIM3 = '#d2ad7c', STONE = '#a89a82', STONE2 = '#d5c5a6';
export type Trade = 0 | 1 | 2 | 3;
interface Rect { x: number; y: number; w: number; h: number }
export interface HomeLayout { windows: Rect[]; door: Rect; eave: number; right: boolean; trade: Trade; side: boolean }

export function homeLayout(W: number, H: number, variant: number, side: boolean): HomeLayout {
  const right = (variant & 1) === 1, trade = (variant >> 1) as Trade;
  const doorX = side ? (right ? W - 9 : 9) : (right ? W - 24 : 24);
  const door = { x: doorX - 6, y: H - 31, w: 12, h: 27 };
  const eave = 40;
  const wy = eave + 9;
  let windows: Rect[];
  if (side) windows = [{ x: right ? 20 : 38, y: wy, w: 18, h: 15 }];
  else if (right) windows = [{ x: 9, y: wy, w: 16, h: 15 }, { x: 33, y: wy, w: 16, h: 15 }];
  else windows = [{ x: 47, y: wy, w: 16, h: 15 }, { x: 71, y: wy, w: 16, h: 15 }];
  return { windows, door, eave, right, trade, side };
}

const TRIM: Record<Trade, string> = { 0: '#6f8a6a', 1: '#a8483f', 2: '#46698f', 3: '#a05f86' };
const AWN: Record<Trade, [string, string]> = { 0: ['#c9b48a', '#8a735a'], 1: ['#b8453d', '#f0e3c8'], 2: ['#46698f', '#f0e8d8'], 3: ['#a05f86', '#f0e3c8'] };

function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  px(c, x, y, INK, w, h); px(c, x + 1, y + 1, fill, w - 2, h - 2);
}

/** one row of roof tiles between two x positions; `t` is how far down the slope (0..1) */
function tileRow(c: Ctx, xa: number, xb: number, y: number, k: number, t: number, color: string, lit = 0) {
  const row = shade(color, 0.14 - t * 0.22 + lit);
  px(c, xa, y, INK, xb - xa, 1);
  px(c, xa + 1, y, row, xb - xa - 2, 1);
  cozyRoofRow(c, xa + 1, y, xb - xa - 2, k, color);
  const m = k % 4;
  if (m === 3) px(c, xa + 1, y, shade(color, -0.3), xb - xa - 2, 1);
  else if (m === 0) px(c, xa + 1, y, shade(color, 0.18), xb - xa - 2, 1);
  else for (let x = xa + 2 + ((k >> 2) % 2) * 4; x < xb - 2; x += 8) px(c, x, y, shade(color, -0.26), 1, 1);
}
/** a tiled roof between two rows; `inset(y)` is how far each end is pulled in at that row */
function tiles(c: Ctx, W: number, top: number, bottom: number, color: string, inset: (y: number) => number) {
  for (let y = top; y < bottom; y++) { const i = inset(y); tileRow(c, i, W - i, y, y - top, (y - top) / Math.max(1, bottom - top), color); }
}

function window(c: Ctx, r: Rect, trade: Trade, lattice: boolean) {
  const { x, y, w, h } = r;
  // shutters first, so the frame sits over them
  if (!lattice) for (const sx of [x - 5, x + w + 1]) { box(c, sx, y - 1, 4, h + 2, TRIM[trade]); px(c, sx + 1, y + 2, shade(TRIM[trade], -0.25), 2, 1); px(c, sx + 1, y + 5, shade(TRIM[trade], -0.25), 2, 1); px(c, sx + 1, y + 8, shade(TRIM[trade], -0.25), 2, 1); }
  box(c, x - 1, y - 1, w + 2, h + 2, TIM2);
  px(c, x, y, lattice ? '#efe2bb' : '#9bbfca', w, h);
  if (!lattice) {
    px(c, x, y, '#cfe4e2', w, 3);
    px(c, x + 1, y + 4, '#b9d6d8', 2, 5);
    px(c, x + Math.floor(w / 2), y, TIM, 1, h);
    px(c, x, y + Math.floor(h / 2), TIM, w, 1);
  } else {
    for (let i = 4; i < w; i += 4) px(c, x + i, y, TIM2, 1, h);
    for (let j = 4; j < h; j += 5) px(c, x, y + j, TIM2, w, 1);
  }
  px(c, x - 3, y + h + 1, TIM3, w + 6, 2); px(c, x - 3, y + h + 3, shade(TIM, -0.2), w + 6, 1);
}

function flowerBox(c: Ctx, x: number, y: number, w: number, cols: string[]) {
  box(c, x, y, w, 5, '#8d6a4b');
  for (let i = 2; i < w - 1; i += 3) { px(c, x + i, y - 3 - (i % 2), '#5f8f4f', 2, 4); px(c, x + i, y - 5 - (i % 2), cols[(i / 3 | 0) % cols.length], 2, 2); }
}

function door(c: Ctx, r: Rect, trade: Trade, side: boolean) {
  const { x, y, w, h } = r;
  box(c, x - 2, y - 2, w + 4, h + 3, TIM);
  px(c, x, y, '#4a3426', w, h);
  px(c, x + 1, y + 1, '#6a4a34', w - 2, h - 1);
  for (let i = 3; i < w - 1; i += 4) px(c, x + i, y + 1, '#52392a', 1, h - 1);
  px(c, x + 2, y + 3, '#cfe0dc', w - 4, 7); px(c, x + 2, y + 3, '#eaf4ee', w - 4, 2);
  px(c, x + w - 3, y + 15, '#e0c276', 2, 2);
  px(c, x - 3, y + h, STONE2, w + 6, 3); px(c, x - 3, y + h + 2, STONE, w + 6, 1);
  // a small canopy over the door in the trade colour
  const [a, b] = AWN[trade];
  const cy = y - 8;
  for (let i = 0; i < w + 8; i += 4) { px(c, x - 4 + i, cy, i % 8 ? b : a, 4, 5); px(c, x - 4 + i, cy + 5, shade(i % 8 ? b : a, -0.3), 4, 1); }
  px(c, x - 4, cy - 1, INK, w + 8, 1);
  if (trade === 1) for (let i = 0; i < 3; i++) { box(c, x + i * 4, y + 1, 4, 9, i === 1 ? '#f0e3c8' : '#7b3a36'); }
  void side;
}

function lantern(c: Ctx, x: number, y: number, col: string) {
  px(c, x, y - 3, INK, 1, 3);
  box(c, x - 2, y, 5, 8, col);
  px(c, x - 1, y + 1, shade(col, 0.4), 1, 5);
  px(c, x - 2, y - 1, INK, 5, 1); px(c, x - 2, y + 8, INK, 5, 1);
}

function foundation(c: Ctx, W: number, y: number, x0 = 5, x1 = W - 5) {
  for (let j = 0; j < 4; j++) for (let x = x0 + (j % 2) * 3; x < x1; x += 7) {
    px(c, x, y + j * 2, STONE, 6, 2); px(c, x, y + j * 2, STONE2, 6, 1);
  }
}

function details(c: Ctx, W: number, H: number, L: HomeLayout) {
  const { right, trade, side } = L;
  const dx = right ? 8 : W - 40, base = H - 5;
  if (trade === 0) {
    // a rain barrel and a pot by the door
    box(c, right ? W - 30 : 17, base - 11, 10, 12, '#9b6f48'); px(c, right ? W - 30 : 17, base - 8, '#6b4a30', 10, 1); px(c, right ? W - 30 : 17, base - 4, '#6b4a30', 10, 1);
    ellipse(c, (right ? W - 30 : 17) + 5, base - 11, 4, 1.4, '#5b7f93');
    box(c, right ? W - 44 : 31, base - 7, 8, 8, '#b4624e'); px(c, right ? W - 43 : 32, base - 11, '#5f8f4f', 6, 4); px(c, right ? W - 41 : 34, base - 12, '#e0a6ae', 2, 2);
  } else if (trade === 1) {
    // a low bench and a teapot sign
    box(c, right ? W - 36 : 20, base - 7, 18, 6, '#9b7a55'); px(c, right ? W - 35 : 21, base - 9, '#6b4a30', 16, 2);
    px(c, right ? W - 33 : 23, base - 12, '#c99a52', 5, 4); px(c, right ? W - 29 : 27, base - 11, '#c99a52', 3, 1); px(c, right ? W - 32 : 24, base - 13, '#8a5c34', 3, 1);
  } else if (trade === 2) {
    // fish crates and a drying line
    box(c, right ? W - 40 : 18, base - 8, 11, 9, '#9b7a55'); px(c, right ? W - 38 : 20, base - 10, '#8fb2bf', 7, 3); px(c, right ? W - 36 : 22, base - 11, '#d7e3e6', 2, 1);
    box(c, right ? W - 27 : 31, base - 8, 11, 9, '#7d5f43'); px(c, right ? W - 25 : 33, base - 10, '#d8895c', 7, 3);
    px(c, 4, L.eave + 6, TIM, 1, 14); px(c, 4, L.eave + 6, TIM, 10, 1);
    for (const i of [0, 4, 8]) { px(c, 6 + i, L.eave + 7, '#9eb7c0', 2, 5); px(c, 6 + i, L.eave + 12, '#c1d3d8', 2, 1); }
  } else {
    // flower buckets
    for (let i = 0; i < 3; i++) {
      const bx = (right ? W - 44 : 19) + i * 9;
      box(c, bx, base - 8, 8, 9, '#7f9aa8');
      for (let k = 0; k < 3; k++) px(c, bx + 1 + k * 2, base - 12 - (k + i) % 2, ['#e57f9a', '#f2c14e', '#b793e0'][(k + i) % 3], 2, 4);
    }
  }
  void dx; void side;
}

/** the whole house, front view (door on one side, two windows) or gable-end view (entrance on the end wall) */
export function drawHome(c: Ctx, W: number, H: number, walls: string, roof: string, variant: number, side: boolean) {
  const L = homeLayout(W, H, variant, side);
  const { eave, trade, right } = L;
  const base = H - 5;
  // --- walls: plaster with timber frame and a stone footing
  box(c, 4, eave - 1, W - 8, base - eave + 3, walls);
  px(c, W - 11, eave + 1, shade(walls, -0.2), 6, base - eave - 1);
  // trade wainscot: planks, blue tiles or brick
  const wain = trade === 2 ? '#8fa9bd' : trade === 3 ? '#b4694f' : '#9a7a58';
  px(c, 5, base - 12, wain, W - 10, 10);
  for (let y = base - 12; y < base - 2; y += 3) px(c, 5, y, shade(wain, -0.2), W - 10, 1);
  if (trade >= 2) for (let x = 5 + (trade === 3 ? 2 : 0); x < W - 5; x += 6) px(c, x, base - 12, shade(wain, -0.22), 1, 10);
  px(c, 5, base - 13, TIM, W - 10, 2); px(c, 5, base - 13, TIM3, W - 10, 1);
  // timber frame: corner posts and the beam under the eaves
  for (const x of [5, W - 9]) { px(c, x, eave + 2, TIM, 4, base - eave - 3); px(c, x, eave + 2, TIM3, 1, base - eave - 3); }
  px(c, 5, eave, TIM, W - 10, 3); px(c, 5, eave, TIM3, W - 10, 1);
  foundation(c, W, base - 2);
  // --- roof
  if (!side) {
    tiles(c, W, 5, eave - 1, roof, (y) => Math.max(1, Math.round((eave - y) * 0.2)));
    // the right face of the hip a little darker, the left a little lighter
    for (let y = 6; y < eave - 1; y++) { const i = Math.max(1, Math.round((eave - y) * 0.2)); px(c, W - i - 1 - Math.round((eave - y) * 0.2), y, shade(roof, -0.28), Math.round((eave - y) * 0.2) + 1, 1); }
    px(c, 14, 5, INK, W - 28, 3); px(c, 15, 5, shade(roof, 0.36), W - 30, 1); px(c, 15, 7, shade(roof, -0.4), W - 30, 1);
    if (trade === 0) { const cx = right ? 18 : W - 28; box(c, cx, 0, 8, 14, '#a87a63'); px(c, cx + 1, 2, '#c99d86', 2, 10); px(c, cx - 1, 0, TIM, 10, 2); }
  } else {
    // the long slope toward us, and the gable end beside it
    const gx = right ? W - 24 : 4, gw = 20;
    const xa = right ? 3 : gw - 2, xb = right ? W - gw + 2 : W - 3;
    for (let y = 12; y < eave - 1; y++) tileRow(c, xa, xb, y, y - 12, (y - 12) / (eave - 13), roof);
    px(c, xa, 11, INK, xb - xa, 3); px(c, xa + 1, 11, shade(roof, 0.36), xb - xa - 2, 1); px(c, xa + 1, 13, shade(roof, -0.4), xb - xa - 2, 1);
    for (let y = 4; y < eave - 1; y++) {
      const half = Math.min(gw / 2, Math.round((y - 3) * 0.6));
      const cx = gx + gw / 2;
      px(c, cx - half, y, INK, half * 2 + 1, 1);
      if (half > 1) px(c, cx - half + 1, y, shade(walls, -0.04), half * 2 - 1, 1);
      if (half > 2 && y % 3 === 0) px(c, cx - half + 2, y, shade(walls, -0.22), half * 2 - 3, 1);
    }
    // gable trim: barge boards along both slopes and a small round vent
    for (let y = 4; y < eave - 1; y++) { const half = Math.min(gw / 2, Math.round((y - 3) * 0.6)); const cx = gx + gw / 2; px(c, cx - half, y, TIM, 2, 1); px(c, cx + half - 1, y, TIM, 2, 1); }
    ellipse(c, gx + gw / 2, 22, 2.2, 2.2, TIM); px(c, gx + gw / 2 - 1, 21, '#e8d9b4', 2, 2);
  }
  // eave fascia and the shadow under it
  px(c, 3, eave - 3, INK, W - 6, 1); px(c, 3, eave - 2, shade(roof, -0.4), W - 6, 2);
  px(c, 5, eave + 3, shade(walls, -0.32), W - 10, 2);
  // --- openings
  for (const w of L.windows) window(c, w, trade, trade === 1);
  door(c, L.door, trade, side);
  // flower boxes and a lantern
  if (trade === 3 || trade === 0) for (const w of L.windows) flowerBox(c, w.x, w.y + w.h + 3, w.w, trade === 3 ? ['#e57f9a', '#f2c14e', '#b793e0'] : ['#f1d59c', '#e0a6ae']);
  lantern(c, right ? L.door.x - 9 : L.door.x + L.door.w + 9, L.door.y - 3, trade === 1 ? '#c8483f' : '#d9a85a');
  details(c, W, H, L);
}
