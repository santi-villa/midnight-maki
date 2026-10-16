/** Village kit: readable shopfronts and homes, stone banks and modular timber decks.
 * Drawn at native pixel resolution; all pieces share the existing 16px ground grid.
 */
import { ellipse, px, shade, type Ctx } from './pixel';
import { buildingLayout } from './nature';
import { cozyRoofRow } from './cozyAssets';

const INK = '#4b3c32', WOOD = '#a07952', DARK = '#705239', LIGHT = '#d6b284';
type Draw = (c: Ctx, w: number, h: number, c1: string, c2: string, rot: number, r: () => number) => void;
function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  px(c, x, y, INK, w, h); px(c, x + 1, y + 1, col, w - 2, h - 2);
}
function roof(c: Ctx, w: number, top: number, bottom: number, color: string, worn = false) {
  // A hipped tiled roof: visible right return and curved eaves, with staggered tile joints.
  for (let y = top; y < bottom; y++) {
    const edge = Math.max(2, Math.floor((bottom - y) * .29));
    px(c, edge, y, INK, w - edge * 2, 1);
    px(c, edge + 2, y, shade(color, (y % 5 === 0 ? .22 : y % 5 === 4 ? -.28 : -.02)), w - edge * 2 - 4, 1);
    cozyRoofRow(c, edge + 2, y, w - edge * 2 - 4, y - top, color);
    if (y % 5 === 1) for (let x = edge + 3 + (Math.floor(y / 5) % 2) * 4; x < w - edge - 3; x += 8) {
      px(c, x, y, shade(color, -.3), 1, 3);
      px(c, x + 1, y, shade(color, .12), 1, 2);
    }
    px(c, w - edge - 9, y, shade(color, -.2), 5, 1);
  }
  px(c, 3, bottom, DARK, w - 6, 3); px(c, 4, bottom, LIGHT, w - 8, 1);
  px(c, 1, bottom - 1, INK, 4, 2); px(c, w - 5, bottom - 1, INK, 4, 2);
  px(c, 15, top, INK, w - 30, 3); px(c, 16, top, shade(color, .3), w - 32, 1);
  if (worn) for (const [x, y] of [[22, bottom - 8], [30, bottom - 5], [w - 26, top + 11]]) {
    px(c, x, y, '#647457', 5, 2); px(c, x + 1, y - 1, '#8a9567', 3, 1);
  }
}
function window(c: Ctx, x: number, y: number, w: number, h: number, paper = false) {
  rect(c, x - 2, y - 2, w + 4, h + 4, WOOD);
  px(c, x, y, paper ? '#e9d8ac' : '#a3bdc0', w, h);
  px(c, x + 1, y + 1, paper ? '#fff0c5' : '#d0e1d9', Math.max(2, w / 2 - 2), 2);
  px(c, x + Math.floor(w / 2), y, DARK, 1, h);
  px(c, x, y + Math.floor(h / 2), DARK, w, 1);
  px(c, x - 2, y + h + 2, LIGHT, w + 4, 2);
}
function lantern(c: Ctx, x: number, y: number, color = '#bf5d51') {
  px(c, x, y - 3, DARK, 1, 3); rect(c, x - 3, y, 7, 10, color);
  px(c, x - 1, y + 1, '#efaa79', 1, 7); px(c, x - 2, y - 1, DARK, 5, 1); px(c, x - 2, y + 10, DARK, 5, 1);
}
function planter(c: Ctx, x: number, y: number, flowers: boolean) {
  rect(c, x, y, 12, 6, '#927257');
  for (let i = 1; i < 11; i += 3) {
    px(c, x + i, y - 4 - i % 2, '#68875c', 3, 5);
    if (flowers) px(c, x + i, y - 5, i % 2 ? '#e0a6ae' : '#f1d59c', 2, 2);
  }
}

/** Same coordinates drive the shop art and the existing warm-window mask. */
export function villageShopLayout(W: number, H: number, variant: number) {
  const base = buildingLayout(W, H);
  const centre = variant === 23 ? W / 2 + 8 : variant === 20 || variant === 22 ? W - 24 : 24;
  const wy = base.wallY + 13;
  return { ...base, dx: centre - 7, windows: variant === 23
    ? [{ x: 12, y: wy, w: 22, h: 14 }, { x: 72, y: wy, w: 12, h: 14 }]
    : variant === 20 || variant === 22
    ? [{ x: 10, y: wy, w: 18, h: 13 }, { x: 38, y: wy, w: 16, h: 13 }]
    : [{ x: 43, y: wy, w: 34, h: 13 }] };
}

/** Specialised frontages retain the saved street doorway: restaurant centre, Taro right, Bento left. */
export function drawVillageBuilding(c: Ctx, W: number, H: number, variant: number, stage: number, plaster: string, tiles: string, closed = false) {
  const maki = variant === 0, baker = variant === 21, tailor = variant === 22, library = variant === 23;
  const L = maki ? buildingLayout(W, H) : villageShopLayout(W, H, variant);
  const wall = L.wallY, floor = H - 5, side = W - 10;
  // Foundation, timber frame and the shaded side wall give the footprint visual depth.
  rect(c, 7, wall - 1, W - 14, floor - wall + 2, plaster);
  px(c, side, wall + 2, shade(plaster, -.23), 3, floor - wall - 2);
  for (let y = floor - 4; y <= floor; y += 3) for (let x = 8 + y % 2 * 3; x < W - 9; x += 8) {
    px(c, x, y, '#877d70', 7, 2); px(c, x, y, '#b5aa91', 7, 1);
  }
  for (const x of [8, W - 13]) { px(c, x, wall, DARK, 3, floor - wall - 4); px(c, x, wall, LIGHT, 1, floor - wall - 4); }
  for (let y = maki ? wall + 28 : wall + 27; y < floor - 6; y += 4) {
    px(c, 11, y, shade(WOOD, (y % 8 ? -.12 : .06)), W - 25, 3);
    for (let x = 14; x < W - 15; x += 17) px(c, x, y + 1, DARK, 4, 1);
  }
  roof(c, W, 5, wall - 2, tiles, maki && stage === 0);
  // Raised ridge details keep the three roof silhouettes distinct at gameplay zoom.
  if (maki) {
    // a pair of ridge-end ornaments (onigawara) instead of an attic window
    for (const x of [13, W - 20]) { px(c, x, 2, INK, 7, 6); px(c, x + 1, 3, '#7f8da0', 5, 4); px(c, x + 2, 1, INK, 3, 2); }
  } else if (baker) {
    rect(c, W - 26, 2, 9, 15, '#ad8571');
    for (let y = 4; y < 16; y += 3) px(c, W - 24, y, '#dfb99a', 6, 1);
    rect(c, W - 28, 1, 13, 4, '#9d8275');
  } else {
    px(c, 14, 10, '#95a177', 12, 2); px(c, 18, 9, '#b6bc8c', 7, 1);
  }
  // Recessed entry, visible threshold and a short stone step aligned with the walk-through tile.
  rect(c, L.dx - 2, L.doorY - 2, L.doorW + 4, L.doorH + 4, DARK);
  if (closed) {
    // shut: planked door, iron strap and a small padlock
    px(c, L.dx, L.doorY, '#7b5a40', L.doorW, L.doorH);
    for (let x = L.dx + 3; x < L.dx + L.doorW; x += 4) px(c, x, L.doorY, '#5c4231', 1, L.doorH);
    px(c, L.dx, L.doorY + 8, '#4a4448', L.doorW, 2);
    px(c, L.dx + L.doorW - 5, L.doorY + 10, '#bda76a', 3, 4);
  } else {
    // open: a warm dim hall behind a half-drawn curtain
    px(c, L.dx + 1, L.doorY + 1, '#362a30', L.doorW - 2, L.doorH - 1);
    px(c, L.dx + 2, L.doorY + 8, '#8a5a38', L.doorW - 4, L.doorH - 9);
    px(c, L.dx + 3, L.doorY + 12, '#c88a4a', L.doorW - 6, L.doorH - 13);
    for (let x = L.dx + 2; x < L.dx + L.doorW - 1; x += 4) px(c, x, L.doorY + 2, WOOD, 1, 6);
  }
  px(c, L.dx - 4, floor, '#928678', L.doorW + 8, 4);
  px(c, L.dx - 4, floor, '#c6b59a', L.doorW + 8, 1);
  for (const win of L.windows) {
    window(c, win.x, win.y, win.w, win.h, maki);
    if (closed) {
      px(c, win.x - 1, win.y - 1, INK, win.w + 2, win.h + 2); px(c, win.x, win.y, '#8a6444', win.w, win.h);
      for (let y = win.y + 2; y < win.y + win.h; y += 3) { px(c, win.x, y, '#5c4231', win.w, 1); px(c, win.x, y - 1, '#a67a55', win.w, 1); }
    }
  }
  if (maki) {
    // Upper shoji, lower noren and the two familiar red lanterns remain in all four stages.
    px(c, 10, L.doorY - 8, DARK, W - 23, 4);
    px(c, 10, L.doorY - 8, LIGHT, W - 23, 1);
    if (!closed) for (let i = 0; i < 3; i++) rect(c, L.dx - 2 + i * 6, L.doorY, 6, 7 + i % 2, stage === 0 ? '#626c84' : '#384969');
    lantern(c, 44, H - 24); lantern(c, 68, H - 24);
    // Clear restoration changes: patched boards, plants, balcony details and star trim.
    if (stage === 0) { px(c, 16, H - 22, '#726157', 13, 3); px(c, 20, H - 29, '#726157', 3, 15); }
    else { planter(c, 13, H - 10, true); planter(c, W - 28, H - 10, true); }
    if (stage >= 2) {
      px(c, 13, wall + 29, DARK, W - 30, 2);
      for (let x = 15; x < W - 17; x += 6) px(c, x, wall + 25, LIGHT, 1, 5);
    }
    if (stage >= 3) for (const x of [W / 2 - 6, W / 2, W / 2 + 6]) { px(c, x, 9, '#e5c175', 1, 5); px(c, x - 1, 11, '#e5c175', 3, 1); }
  } else if (library) {
    // A small civic library: gabled reading window, book return and carved shelf below it.
    // a clock on the ridge board instead of an attic window
    ellipse(c, W - 22, 17, 6, 6, INK); ellipse(c, W - 22, 17, 5, 5, '#f1e4c1'); px(c, W - 22, 13, INK, 1, 5); px(c, W - 22, 17, INK, 3, 1);
    rect(c, 12, H - 20, 23, 12, WOOD);
    for (let i = 0; i < 6; i++) px(c, 14 + i * 3, H - 18 + i % 2, ['#678177', '#b77b6c', '#d7b36c'][i % 3], 2, 7 - i % 2);
    rect(c, W - 22, H - 18, 12, 11, '#708178'); px(c, W - 20, H - 15, INK, 8, 2);
    lantern(c, 68, L.doorY - 5, '#dbb575');
  } else {
    const color = baker ? '#b77962' : tailor ? '#ba8498' : '#64826a';
    const sx = baker ? 40 : 8, width = baker ? 42 : 48, sy = L.windows[0].y - 5;
    // Small canvas awning, with wood supports instead of a flat rectangular facade.
    if (closed) {
      // awning rolled up against the wall
      px(c, sx, sy, INK, width, 5); px(c, sx + 1, sy + 1, shade(color, -0.1), width - 2, 3); px(c, sx + 1, sy + 1, shade(color, 0.2), width - 2, 1);
      for (let x = sx + 5; x < sx + width - 2; x += 9) px(c, x, sy, DARK, 1, 5);
    } else for (let x = sx; x < sx + width; x += 6) {
      px(c, x, sy, Math.floor((x - sx) / 6) % 2 ? '#eddbc0' : color, 6, 5);
      px(c, x, sy + 5, DARK, 6, 1);
    }
    lantern(c, baker ? 35 : 84, L.doorY - 5, baker ? '#c78159' : '#aa6553');
    if (baker) {
      if (!closed) for (let i = 0; i < 4; i++) { const x = 46 + i * 7; ellipse(c, x, L.windows[0].y + 9, 3, 2, '#b97b47'); px(c, x - 1, L.windows[0].y + 7, '#edc47e', 3, 1); }
      planter(c, 8, H - 10, true);
      rect(c, W - 23, H - 17, 13, 10, '#a4754d'); px(c, W - 22, H - 14, closed ? '#e6dcc4' : '#e8c27e', 10, 3);
    } else if (tailor) {
      // Fabric rolls and a dress in the display make Yuki distinct from the grocer.
      if (!closed) for (const win of L.windows) {
        px(c, win.x + 7, win.y + 2, '#f2d7b0', 3, 2);
        px(c, win.x + 5, win.y + 4, '#b77c99', 7, 4);
        px(c, win.x + 3, win.y + 8, '#d4a3b1', 11, 4);
      }
      for (let i = 0; i < 3; i++) { rect(c, 12 + i * 10, H - 18, 8, 11, ['#d8b3bd', '#8caaa0', '#b2a4c3'][i]); px(c, 15 + i * 10, H - 17, '#f0dfc0', 2, 7); }
      planter(c, W - 18, H - 10, true);
    } else {
      for (const [x, col] of [[12, '#e8b35b'], [25, '#a1b56b'], [40, '#c97f65']] as const) {
        rect(c, x, H - 15, 11, 8, WOOD); px(c, x + 2, H - 17, closed ? '#e6dcc4' : col, 7, closed ? 3 : 4);
      }
      px(c, 12, H - 10, LIGHT, 40, 1);
    }
  }
}

/** Houses share shop materials but retain their own porch/gable and historic door tiles. */
export function drawVillageHome(c: Ctx, W: number, H: number, walls: string, tiles: string, variant: number, sideView: boolean) {
  const right = (variant & 1) === 1, trade = variant >> 1;
  const doorX = sideView ? (right ? W - 8 : 8) : (right ? W - 24 : 24);
  const eaves = 42, floor = H - 5;
  rect(c, 3, eaves, W - 6, floor - eaves + 2, walls);
  px(c, W - 10, eaves + 2, shade(walls, -.22), 5, floor - eaves - 2);
  for (let y = H - 28; y < floor - 3; y += 4) { px(c, 5, y, WOOD, W - 15, 3); px(c, 6, y, LIGHT, W - 17, 1); }
  roof(c, W, 4, eaves, tiles);
  const wx = right ? 12 : 43;
  window(c, wx, eaves + 8, 16, 13, trade !== 2);
  if (!sideView) window(c, wx + 22, eaves + 8, 12, 13, trade !== 2);
  // A visible gable face differentiates the lateral houses without mirroring their artwork.
  if (sideView) {
    const cx = right ? W - 17 : 17;
    for (let y = 4; y < eaves; y++) {
      const half = Math.min(16, Math.round((y - 3) * .43));
      px(c, cx - half, y, DARK, half * 2 + 1, 1);
      if (half > 2) px(c, cx - half + 2, y, shade(walls, -.06), half * 2 - 3, 1);
    }
    window(c, cx - 4, 28, 8, 8, true);
  }
  rect(c, doorX - 7, H - 31, 14, 27, DARK);
  px(c, doorX - 5, H - 29, '#42332f', 10, 23);
  for (let x = doorX - 4; x < doorX + 5; x += 4) px(c, x, H - 28, LIGHT, 1, 22);
  px(c, doorX - 8, H - 5, '#b4a58b', 16, 4);
  const noren = ['#52657b', '#a96f67', '#536e87', '#b88ba0'][trade];
  for (let i = 0; i < 3; i++) rect(c, doorX - 8 + i * 5, H - 33, 5, 8, noren);
  lantern(c, right ? doorX - 13 : doorX + 13, H - 30, trade === 1 ? '#c87962' : '#d9bc85');
  const detailX = right ? 18 : 54;
  if (trade === 1) {
    rect(c, detailX, H - 17, 20, 10, WOOD); px(c, detailX + 3, H - 19, '#ede2be', 7, 3); px(c, detailX + 12, H - 18, '#a1b56b', 5, 4);
  } else if (trade === 2) {
    for (let i = 0; i < 2; i++) { rect(c, detailX + i * 12, H - 17, 11, 10, WOOD); ellipse(c, detailX + 5 + i * 12, H - 14, 4, 1, '#99bfc5'); px(c, detailX + 8 + i * 12, H - 15, '#d3e2d7', 2, 3); }
  } else { planter(c, detailX, H - 10, trade === 3); }
  for (let x = 4; x < W - 7; x += 8) if (Math.abs(x - doorX) > 9) px(c, x, floor, '#a59c87', 7, 2);
}

export const VILLAGE_KINDS: Record<string, Draw> = {
  village_deck(c, W, H, _c1, _c2, rot) {
    // Open ends, golden planks and Japanese timber rails. The traversable footprint is unchanged.
    const vertical = rot === 1;
    const length = vertical ? H : W, width = vertical ? W : H;
    const plank = (along: number, across: number, len: number, thick: number, color: string) => {
      if (vertical) px(c, across, along, color, thick, len);
      else px(c, along, across, color, len, thick);
    };
    plank(0, 1, length, width - 2, '#896544');
    for (let n = 0; n < length; n += 8) {
      plank(n, 3, Math.min(7, length - n), width - 6, n % 16 ? '#bc9569' : '#c5a174');
      plank(n, 3, 1, width - 6, '#e0bf8e');
    }
    if (vertical) {
      for (const edge of [0, W - 5]) {
        px(c, edge + 1, 0, '#79573c', 3, H);
        px(c, edge + 1, 0, '#ddb57e', 1, H);
        for (let y = 0; y < H; y += 16) {
          px(c, edge, y, '#6f5037', 5, Math.min(10, H - y));
          px(c, edge + 1, y + 1, '#c79b66', 3, Math.min(8, H - y - 1));
          px(c, edge, y, '#efd0a0', 5, 2);
        }
      }
    } else {
      for (const y of [0, H - 10]) {
        px(c, 0, y + 2, '#79573c', W, 3);
        px(c, 1, y + 2, '#ddb57e', W - 2, 1);
        px(c, 0, y + 7, '#79573c', W, 1);
        for (let x = 0; x < W; x += 16) {
          px(c, x, y, '#6f5037', Math.min(5, W - x), 10);
          px(c, x + 1, y + 1, '#c79b66', Math.min(3, W - x - 1), 8);
          px(c, x, y, '#efd0a0', Math.min(5, W - x), 2);
        }
      }
    }
  },
  village_bank(c, W, H, _c1, _c2, rot) {
    const x = rot ? 0 : W - 5;
    for (let y = 0; y < H; y += 5) {
      px(c, x, y, '#6c7563', 5, 5); px(c, x + (y % 2), y, '#b2aa8b', 4, 3);
      px(c, x + 1, y + 3, '#858b70', 3, 1);
    }
    px(c, rot ? 4 : W - 6, 2, '#78935e', 2, 3); px(c, rot ? 4 : W - 6, 12, '#92a877', 2, 2);
  },
  village_net(c, W, H) {
    px(c, 1, H - 8, '#806d4a', W - 2, 7);
    for (let y = H - 8; y < H - 1; y += 3) for (let x = 2; x < W - 2; x += 4) { px(c, x, y, '#c8b78a', 3, 1); px(c, x + 2, y - 1, '#c8b78a', 1, 3); }
    ellipse(c, W - 7, H - 8, 5, 3, '#c8af77'); ellipse(c, W - 7, H - 8, 3, 1, '#806d4a');
  },
};
