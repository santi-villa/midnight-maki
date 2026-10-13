/**
 * Procedural sprites for props, furniture and buildings.
 * drawObject(kind, wPx, hPx, c1, c2, rot) returns a canvas; sprites are bottom-aligned on their footprint.
 */
import { PAL } from './palette';
import { ctx2d, ellipse, makeCanvas, outline, px, rng, shade, type Ctx } from './pixel';
import { volumize } from './shade';
import { IZAKAYA_KINDS } from './izakaya';
import { NATURE_KINDS } from './nature';
import { drawPlaque } from './pixfont';
import { SHOP_KINDS } from './shopart';
import { drawFountain } from './fountain';

const OUT = '#3a2a2a';

function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string, edge = shade(fill, -0.55)) {
  px(c, x, y, edge, w, h);
  px(c, x + 1, y + 1, fill, w - 2, h - 2);
  px(c, x + 1, y + 1, shade(fill, 0.18), w - 2, 1);
}

function leafBlob(c: Ctx, cx: number, cy: number, rx: number, ry: number, base: string, r: () => number) {
  ellipse(c, cx, cy + 1, rx, ry, shade(base, -0.35));
  ellipse(c, cx, cy, rx, ry, base);
  ellipse(c, cx - Math.floor(rx / 3), cy - Math.floor(ry / 3), Math.floor(rx / 2), Math.floor(ry / 2), shade(base, 0.15));
  for (let i = 0; i < rx * ry * 0.3; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    px(c, Math.round(cx + Math.cos(a) * rx * d * 0.9), Math.round(cy + Math.sin(a) * ry * d * 0.9), r() > 0.5 ? shade(base, -0.15) : shade(base, 0.22));
  }
}

function roof(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  // Japanese-style curved roof with tiles
  const d = shade(col, -0.35);
  for (let j = 0; j < h; j++) {
    const inset = Math.max(0, Math.round((h - j) * 0.6) - 1);
    px(c, x + inset, y + j, j % 3 === 2 ? d : col, w - inset * 2, 1);
  }
  for (let i = x + 2; i < x + w - 2; i += 4) px(c, i, y + 2, d, 1, h - 3);
  px(c, x - 1, y + h - 1, shade(col, -0.55), w + 2, 2);
  px(c, x - 2, y + h - 2, shade(col, -0.55), 2, 1);
  px(c, x + w, y + h - 2, shade(col, -0.55), 2, 1);
  px(c, x + 2, y, shade(col, -0.55), w - 4, 1);
}

function windowLit(c: Ctx, x: number, y: number, w: number, h: number, lit = true) {
  px(c, x, y, PAL.woodDD, w, h);
  px(c, x + 1, y + 1, lit ? '#f4d68c' : PAL.sky, w - 2, h - 2);
  px(c, x + 1, y + 1, lit ? '#fbe7b0' : '#e6f0f7', Math.max(1, Math.floor((w - 2) / 2)), 2);
  px(c, x + Math.floor(w / 2), y + 1, PAL.woodDD, 1, h - 2);
}

function door(c: Ctx, x: number, y: number, w: number, h: number, col = PAL.woodD, curtain?: string) {
  px(c, x, y, PAL.woodDD, w, h);
  px(c, x + 1, y + 1, col, w - 2, h - 1);
  if (curtain) {
    // noren curtain
    px(c, x + 1, y + 1, curtain, w - 2, Math.floor(h / 2));
    for (let i = x + 3; i < x + w - 1; i += 3) px(c, i, y + 2, shade(curtain, -0.3), 1, Math.floor(h / 2) - 1);
  } else px(c, x + w - 3, y + Math.floor(h / 2), PAL.gold, 1, 1);
}

type DrawFn = (c: Ctx, W: number, H: number, c1: string, c2: string, rot: number, r: () => number) => void;

const K: Record<string, DrawFn> = {
  // ------------------------------------------------------------ nature
  tree(c, W, H, c1, _c2, _rot, r) {
    const cx = W / 2;
    px(c, cx - 3, H - 14, PAL.woodD, 6, 13);
    px(c, cx - 2, H - 14, PAL.wood, 3, 13);
    px(c, cx - 5, H - 2, shade(PAL.woodD, -0.2), 10, 2);
    leafBlob(c, cx, H - 26, W / 2 - 2, 15, c1, r);
    leafBlob(c, cx - 7, H - 20, 8, 7, c1, r);
    leafBlob(c, cx + 7, H - 21, 8, 7, c1, r);
  },
  sakura(c, W, H, _c1, _c2, _rot, r) {
    K.tree(c, W, H, '#e8b4c0', '', 0, r);
    for (let i = 0; i < 14; i++) px(c, Math.floor(r() * W), Math.floor(r() * (H - 18)) + 4, '#fbe3ea');
  },
  pine(c, W, H, c1) {
    const cx = Math.floor(W / 2);
    px(c, cx - 2, H - 8, PAL.woodD, 4, 8);
    for (let i = 0; i < 4; i++) {
      const y = H - 12 - i * 9;
      const half = 14 - i * 3;
      for (let j = 0; j < 10; j++) {
        const w = Math.round(half * (j / 10));
        px(c, cx - w, y - 10 + j, j < 2 ? shade(c1, 0.15) : c1, w * 2 + 1, 1);
      }
      px(c, cx - half, y, shade(c1, -0.35), half * 2 + 1, 1);
    }
  },
  bush(c, W, H, c1, c2, _rot, r) {
    leafBlob(c, W / 2, H - 7, W / 2 - 1, 6, c1, r);
    if (c2 !== c1) for (let i = 0; i < 5; i++) px(c, 3 + Math.floor(r() * (W - 6)), H - 11 + Math.floor(r() * 7), c2, 2, 1);
  },
  rock(c, W, H, c1) {
    ellipse(c, W / 2, H - 5, W / 2 - 2, 4, shade(c1, -0.4));
    ellipse(c, W / 2, H - 6, W / 2 - 2, 4, c1);
    px(c, W / 2 - 3, H - 9, shade(c1, 0.3), 3, 1);
  },
  stump(c, W, H) {
    box(c, 3, H - 9, W - 6, 8, PAL.wood);
    ellipse(c, W / 2, H - 9, W / 2 - 3, 2, PAL.woodL);
    px(c, W / 2 - 1, H - 9, PAL.woodD, 2, 1);
  },
  mushroom(c, W, H, c1) {
    px(c, W / 2 - 1, H - 6, PAL.cream, 3, 5);
    ellipse(c, W / 2, H - 7, 4, 2, c1);
    px(c, W / 2 - 2, H - 8, PAL.cream);
    px(c, W / 2 + 2, H - 7, PAL.cream);
  },
  flowers(c, W, H, c1, c2, _rot, r) {
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(r() * (W - 4));
      const y = H - 3 - Math.floor(r() * 8);
      px(c, x, y, PAL.forest, 1, 3);
      px(c, x - 1, y - 1, i % 2 ? c1 : c2, 3, 1);
      px(c, x, y - 2, i % 2 ? c1 : c2);
      px(c, x, y - 1, PAL.gold);
    }
  },
  reeds(c, W, H, c1) {
    for (let i = 2; i < W - 2; i += 3) {
      px(c, i, H - 12, c1, 1, 12);
      px(c, i, H - 14, PAL.woodD, 1, 3);
    }
  },
  // ------------------------------------------------------------ street props
  lamppost(c, W, H) {
    const cx = Math.floor(W / 2);
    px(c, cx - 1, H - 22, '#3d3a4a', 2, 21);
    px(c, cx - 3, H - 2, '#3d3a4a', 6, 2);
    box(c, cx - 3, H - 29, 7, 8, '#f4d68c', '#3d3a4a');
    px(c, cx - 4, H - 30, '#3d3a4a', 9, 2);
  },
  stonelantern(c, W, H) {
    const cx = Math.floor(W / 2);
    box(c, cx - 3, H - 8, 7, 7, PAL.stone);
    box(c, cx - 4, H - 15, 9, 7, PAL.stone);
    px(c, cx - 2, H - 13, '#f4d68c', 5, 3);
    px(c, cx - 6, H - 18, PAL.stoneD, 13, 3);
    px(c, cx - 1, H - 21, PAL.stoneD, 3, 3);
  },
  paperlantern(c, W, H, c1) {
    const cx = Math.floor(W / 2);
    px(c, cx, H - 24, OUT, 1, 4);
    ellipse(c, cx, H - 14, 5, 6, shade(c1, -0.3));
    ellipse(c, cx, H - 14, 4, 5, c1);
    px(c, cx - 4, H - 14, shade(c1, -0.2), 9, 1);
    px(c, cx - 2, H - 20, OUT, 5, 1);
    px(c, cx - 2, H - 8, OUT, 5, 1);
    px(c, cx - 2, H - 16, '#fff3c9', 2, 2);
  },
  fence(c, W, H) {
    for (let x = 1; x < W; x += 5) box(c, x, H - 12, 4, 11, PAL.woodL);
    px(c, 0, H - 9, PAL.wood, W, 2);
    px(c, 0, H - 5, PAL.wood, W, 2);
  },
  bench(c, W, H, c1) {
    box(c, 1, H - 13, W - 2, 4, c1);
    box(c, 1, H - 9, W - 2, 3, shade(c1, 0.1));
    px(c, 3, H - 6, PAL.woodDD, 2, 5);
    px(c, W - 5, H - 6, PAL.woodDD, 2, 5);
  },
  sign(c, W, H, c1) {
    px(c, W / 2 - 1, H - 8, PAL.woodD, 2, 8);
    box(c, 1, H - 16, W - 2, 9, c1);
    px(c, 4, H - 13, PAL.woodDD, W - 8, 1);
    px(c, 4, H - 11, PAL.woodDD, W - 10, 1);
  },
  board(c, W, H) {
    px(c, 3, H - 10, PAL.woodD, 2, 10);
    px(c, W - 5, H - 10, PAL.woodD, 2, 10);
    box(c, 0, H - 24, W, 16, PAL.woodL);
    px(c, 3, H - 21, PAL.cream, 7, 8);
    px(c, 12, H - 20, '#f4d7d0', 8, 6);
    px(c, 22, H - 22, PAL.cream, 7, 9);
    px(c, 6, H - 21, PAL.red, 1, 1);
    px(c, 16, H - 20, PAL.red, 1, 1);
    px(c, 25, H - 22, PAL.red, 1, 1);
    px(c, -1 + 1, H - 26, PAL.wood, W, 2);
  },
  crate(c, W, H) {
    box(c, 1, H - 14, W - 2, 13, PAL.woodL);
    px(c, 2, H - 8, PAL.wood, W - 4, 1);
    px(c, W / 2, H - 13, PAL.wood, 1, 11);
  },
  barrel(c, W, H) {
    box(c, 2, H - 15, W - 4, 14, PAL.wood);
    px(c, 2, H - 12, '#5d5864', W - 4, 1);
    px(c, 2, H - 5, '#5d5864', W - 4, 1);
    ellipse(c, W / 2, H - 15, W / 2 - 3, 1, PAL.woodL);
  },
  well(c, W, H) {
    ellipse(c, W / 2, H - 8, W / 2 - 2, 6, PAL.stoneD);
    ellipse(c, W / 2, H - 9, W / 2 - 4, 4, '#3b4f66');
    px(c, 3, H - 26, PAL.woodD, 2, 18);
    px(c, W - 5, H - 26, PAL.woodD, 2, 18);
    roof(c, 0, H - 32, W, 7, PAL.red);
  },
  mailbox(c, W, H) {
    px(c, W / 2 - 1, H - 8, PAL.woodD, 2, 8);
    box(c, W / 2 - 5, H - 17, 10, 9, PAL.red);
    px(c, W / 2 + 4, H - 20, PAL.gold, 1, 4);
  },
  fountain(c, W, H) {
    drawFountain(c, W, H);
  },
  stall(c, W, H, c1, c2, _rot, r) {
    // back wall lit from inside
    px(c, 3, H - 32, '#5a3a2c', W - 6, 16);
    px(c, 4, H - 31, '#f2c27a', W - 8, 14);
    px(c, 4, H - 31, '#fbe0a8', W - 8, 3);
    // hanging goods on a string
    px(c, 5, H - 28, '#5a3a2c', W - 10, 1);
    const goods = ['#d9675f', '#94c0d2', '#f2c66d', '#9686bd', '#7fae5f', '#e8a0b0'];
    for (let x = 7; x < W - 7; x += 5) {
      const gy = H - 27 + Math.floor(r() * 3);
      px(c, x, H - 28, '#5a3a2c', 1, gy - (H - 28));
      ellipse(c, x, gy + 2, 2, 2, goods[Math.floor(r() * goods.length)]);
    }
    // goods on the shelf
    for (let x = 6; x < W - 6; x += 4) px(c, x, H - 21, goods[Math.floor(r() * goods.length)], 3, 3);
    // counter with front panels
    box(c, 1, H - 17, W - 2, 16, PAL.woodL, PAL.woodDD);
    px(c, 2, H - 16, '#c9925f', W - 4, 2);
    for (let x = 4; x < W - 4; x += 9) {
      px(c, x, H - 12, shade(PAL.woodL, -0.18), 7, 9);
      px(c, x + 2, H - 10, ['#f6ecd6', '#d9675f', '#94c0d2'][Math.floor(r() * 3)], 3, 4);
    }
    // posts
    px(c, 1, H - 40, PAL.woodDD, 3, 25);
    px(c, W - 4, H - 40, PAL.woodDD, 3, 25);
    // striped awning with thickness and a scalloped edge
    for (let x = 0; x < W; x += 6) {
      const col = (x / 6) % 2 ? c1 : c2;
      px(c, x, H - 44, shade(col, 0.12), 6, 2);
      px(c, x, H - 42, col, 6, 7);
      ellipse(c, x + 3, H - 35, 3, 2, col);
      px(c, x, H - 36, shade(col, -0.25), 6, 1);
    }
    px(c, 0, H - 45, shade(c1, -0.5), W, 1);
  },
  boat(c, W, H, c1) {
    for (let j = 0; j < 8; j++) px(c, 2 + j, H - 10 + j, shade(c1, -0.3), W - 4 - j * 2, 1);
    px(c, 2, H - 11, c1, W - 4, 2);
    px(c, W / 2 - 1, H - 30, PAL.woodD, 2, 20);
  },
  torii(c, W, H) {
    const red = '#b8524f';
    px(c, 6, H - 34, red, 4, 34);
    px(c, W - 10, H - 34, red, 4, 34);
    px(c, 0, H - 40, '#3a2a2a', W, 4);
    px(c, 2, H - 36, red, W - 4, 3);
    px(c, 4, H - 28, red, W - 8, 3);
  },
  pier(c, W, H) {
    for (let x = 1; x < W; x += 4) px(c, x, H - 6, PAL.woodD, 2, 6);
  },
  stars(c, _W, H, c1) {
    for (let i = 0; i < 3; i++) {
      const x = 4 + i * 10;
      const y = H - 12 + (i % 2) * 4;
      px(c, x, y - 2, c1, 1, 5);
      px(c, x - 2, y, c1, 5, 1);
      px(c, x, y, '#fff6c8');
    }
  },
  // ------------------------------------------------------------ buildings (sprite only; footprint defined in map)
  building(c, W, H, c1, c2, rot) {
    // rot encodes variant: 0 restaurant, 1 shop, 2 house, 3 cabin, 4 library, 5 station
    const roofH = Math.floor(H * 0.42);
    const wallY = roofH - 2;
    const wallH = H - wallY;
    box(c, 2, wallY, W - 4, wallH, c1);
    // timber frame
    px(c, 2, wallY + 2, shade(c1, -0.35), W - 4, 1);
    for (let x = 6; x < W - 6; x += 16) px(c, x, wallY, shade(c1, -0.35), 2, wallH);
    roof(c, 0, 0, W, roofH, c2);
    const doorW = 14;
    const dx = Math.floor(W / 2 - doorW / 2);
    door(c, dx, H - 22, doorW, 22, PAL.woodD, rot === 0 ? '#3b4470' : rot === 1 ? PAL.rose : undefined);
    for (let x = 8; x + 14 < dx - 2; x += 20) windowLit(c, x, wallY + 8, 12, 10);
    for (let x = dx + doorW + 6; x + 14 < W - 4; x += 20) windowLit(c, x, wallY + 8, 12, 10);
    if (rot === 0) {
      // Midnight Maki sign + lanterns
      box(c, W / 2 - 22, wallY + 1, 44, 9, PAL.night2, PAL.woodDD);
      for (let i = 0; i < 7; i++) px(c, W / 2 - 18 + i * 6, wallY + 4, PAL.gold, 3, 3);
      for (const lx of [dx - 6, dx + doorW + 3]) {
        ellipse(c, lx + 1, H - 24, 3, 4, '#d9675f');
        px(c, lx - 1, H - 25, '#f4b08c', 2, 2);
      }
    }
    if (rot === 5) {
      px(c, 8, H - 10, '#6f6a72', W - 16, 2);
      for (let x = 10; x < W - 10; x += 14) px(c, x, wallY + 6, '#5d5864', 8, 12);
    }
  },
  lighthouse(c, W, H) {
    const cx = Math.floor(W / 2);
    for (let y = 18; y < H; y++) {
      const half = Math.round(6 + ((y - 18) / (H - 18)) * 8);
      const band = Math.floor((y - 18) / 10) % 2 === 0;
      px(c, cx - half, y, shade(band ? PAL.cream : '#b8524f', -0.5), half * 2, 1);
      px(c, cx - half + 1, y, band ? PAL.cream : '#b8524f', half * 2 - 2, 1);
    }
    box(c, cx - 8, 8, 16, 11, '#f4d68c', '#3d3a4a');
    px(c, cx - 1, 9, '#fff6c8', 2, 9);
    px(c, cx - 10, 6, '#3d3a4a', 20, 3);
    px(c, cx - 6, 2, '#3d3a4a', 12, 4);
    px(c, cx - 1, 0, PAL.gold, 2, 2);
    door(c, cx - 5, H - 16, 10, 16);
    for (const [sx, sy] of [[cx - 12, 4], [cx + 11, 7], [cx + 2, -1]]) px(c, sx, sy + 1, PAL.gold, 1, 1);
  },
  // ------------------------------------------------------------ furniture
  table(c, W, H, c1, _c2, _rot, r) {
    const o = '#2b1d17';
    const top = shade(c1, 0.14);
    const legH = H > 18 ? 7 : 4;
    // legs
    for (const lx of [2, W - 4]) {
      px(c, lx, H - legH, o, 3, legH);
      px(c, lx + 1, H - legH, shade(c1, -0.35), 1, legH - 1);
    }
    // apron + top
    px(c, 0, H - legH - 9, o, W, 10);
    px(c, 1, H - legH - 8, top, W - 2, 6);
    px(c, 1, H - legH - 8, shade(top, 0.18), W - 2, 1);
    px(c, 1, H - legH - 2, shade(c1, -0.25), W - 2, 2);
    for (let x = 6; x < W - 4; x += 9) px(c, x, H - legH - 6, shade(top, -0.06), 5, 1);
    // little table setting: soy bottle and a tea cup
    if (W >= 28) {
      const sx = 4 + Math.floor(r() * 6);
      px(c, sx, H - legH - 12, o, 3, 5);
      px(c, sx + 1, H - legH - 11, '#7a3a2a', 1, 3);
      px(c, sx + 1, H - legH - 13, '#c94a3f', 1, 1);
      const cx = W - 10;
      px(c, cx, H - legH - 10, o, 4, 3);
      px(c, cx + 1, H - legH - 10, '#9bb59a', 2, 2);
    }
  },
  roundtable(c, W, H, c1) {
    px(c, W / 2 - 1, H - 6, shade(c1, -0.5), 2, 6);
    ellipse(c, W / 2, H - 9, W / 2 - 1, 5, shade(c1, -0.5));
    ellipse(c, W / 2, H - 10, W / 2 - 2, 4, shade(c1, 0.12));
  },
  chair(c, W, H, c1, c2, rot) {
    const o = '#2b1d17';
    const wood = c1;
    const seat = c2 || shade(c1, 0.15);
    const leg = (x: number) => {
      px(c, x, H - 5, o, 2, 5);
      px(c, x, H - 5, shade(wood, -0.3), 1, 4);
    };
    const back = (y: number, h: number) => {
      px(c, 3, y, o, W - 6, h);
      px(c, 4, y + 1, wood, W - 8, h - 2);
      px(c, 4, y + 1, shade(wood, 0.2), W - 8, 1);
      for (let x = 6; x < W - 5; x += 3) px(c, x, y + 3, shade(wood, -0.3), 1, h - 4);
    };
    const seatTop = (y: number) => {
      px(c, 3, y, o, W - 6, 5);
      px(c, 4, y + 1, seat, W - 8, 2);
      px(c, 4, y + 1, shade(seat, 0.2), W - 8, 1);
      px(c, 4, y + 3, shade(wood, -0.25), W - 8, 1);
    };
    if (rot === 0) {
      back(H - 18, 9);
      seatTop(H - 10);
      leg(4);
      leg(W - 6);
    } else if (rot === 2) {
      seatTop(H - 12);
      leg(4);
      leg(W - 6);
      back(H - 9, 8);
    } else {
      const left = rot === 3;
      seatTop(H - 10);
      leg(5);
      leg(W - 7);
      const bx = left ? W - 6 : 2;
      px(c, bx, H - 18, o, 4, 14);
      px(c, bx + 1, H - 17, wood, 2, 12);
      px(c, bx + 1, H - 17, shade(wood, 0.2), 2, 1);
    }
  },

  stool(c, W, H, c1) {
    ellipse(c, W / 2, H - 9, 5, 3, shade(c1, -0.4));
    ellipse(c, W / 2, H - 10, 5, 2, c1);
    px(c, W / 2 - 4, H - 7, shade(c1, -0.5), 1, 6);
    px(c, W / 2 + 3, H - 7, shade(c1, -0.5), 1, 6);
  },
  cushion(c, W, H, c1, c2) {
    box(c, 2, H - 12, W - 4, 10, c1);
    px(c, W / 2 - 1, H - 8, c2, 2, 2);
  },
  bed(c, W, H, c1, c2) {
    const o = '#2b1d17';
    // wooden frame with a tall headboard
    px(c, 0, 0, o, W, H);
    px(c, 1, 1, PAL.woodL, W - 2, 6);
    px(c, 1, 1, shade(PAL.woodL, 0.2), W - 2, 1);
    px(c, 3, 3, PAL.wood, W - 6, 2);
    px(c, 1, 7, PAL.woodD, W - 2, H - 8);
    // pillow
    px(c, 2, 7, o, W - 4, 7);
    px(c, 3, 8, '#fbf6ea', W - 6, 5);
    px(c, 3, 8, '#ffffff', W - 6, 1);
    px(c, 4, 12, '#e6dccb', W - 8, 1);
    // quilt with a folded top edge and a patchwork pattern
    px(c, 1, 14, o, W - 2, H - 17);
    px(c, 2, 15, c1, W - 4, H - 19);
    px(c, 2, 15, '#fbf6ea', W - 4, 2);
    px(c, 2, 17, shade(c1, 0.2), W - 4, 1);
    for (let y = 20; y < H - 5; y += 5) for (let x = 3 + ((y / 5) % 2) * 3; x < W - 4; x += 6) px(c, x, y, c2, 2, 2);
    px(c, 2, H - 5, shade(c1, -0.25), W - 4, 1);
    // footboard
    px(c, 0, H - 3, o, W, 3);
    px(c, 1, H - 3, PAL.woodL, W - 2, 2);
  },
  futon(c, W, H, c1, c2) {
    const o = '#2b1d17';
    px(c, 1, 2, o, W - 2, H - 3);
    px(c, 2, 3, '#fbf6ea', W - 4, H - 5);
    px(c, 3, 4, '#ffffff', W - 6, 4);
    px(c, 3, 7, '#e6dccb', W - 6, 1);
    px(c, 2, 9, o, W - 4, 1);
    px(c, 2, 10, c1, W - 4, H - 12);
    px(c, 2, 10, shade(c1, 0.2), W - 4, 1);
    for (let x = 4; x < W - 3; x += 4) for (let y = 13; y < H - 3; y += 5) px(c, x, y, c2, 2, 2);
  },
  shelf(c, W, H, c1, c2, _rot, r) {
    box(c, 0, 0, W, H, c1);
    for (let y = 8; y < H - 2; y += 9) {
      px(c, 1, y, shade(c1, -0.4), W - 2, 2);
      for (let x = 2; x < W - 3; x += 3 + Math.floor(r() * 2)) {
        const bh = 4 + Math.floor(r() * 3);
        px(c, x, y - bh, [c2, PAL.rose, PAL.sage, PAL.lav, PAL.gold][Math.floor(r() * 5)], 2, bh);
      }
    }
  },
  wardrobe(c, W, H, c1) {
    box(c, 0, 0, W, H, c1);
    px(c, W / 2, 2, shade(c1, -0.5), 1, H - 4);
    px(c, W / 2 - 3, H / 2, PAL.gold, 2, 1);
    px(c, W / 2 + 2, H / 2, PAL.gold, 2, 1);
  },
  desk(c, W, H, c1, c2) {
    box(c, 0, H - 18, W, 8, shade(c1, 0.1));
    box(c, 1, H - 10, 10, 10, c1);
    px(c, W - 3, H - 10, shade(c1, -0.5), 2, 10);
    box(c, W - 12, H - 24, 8, 7, c2);
    px(c, 3, H - 20, PAL.cream, 6, 2);
  },
  plant(c, W, H, c1, c2, _rot, r) {
    box(c, W / 2 - 5, H - 9, 10, 8, c2);
    px(c, W / 2 - 5, H - 9, shade(c2, 0.2), 10, 2);
    leafBlob(c, W / 2, H - 16, 6, 7, c1, r);
  },
  tallplant(c, W, H, c1, c2, _rot, r) {
    box(c, W / 2 - 5, H - 10, 10, 9, c2);
    px(c, W / 2, H - 26, PAL.forest, 1, 16);
    leafBlob(c, W / 2 - 3, H - 20, 5, 4, c1, r);
    leafBlob(c, W / 2 + 3, H - 25, 5, 4, c1, r);
    leafBlob(c, W / 2, H - 29, 4, 3, c1, r);
  },
  cactus(c, W, H, c1, c2) {
    box(c, W / 2 - 4, H - 8, 8, 7, c2);
    box(c, W / 2 - 2, H - 20, 5, 13, c1);
    box(c, W / 2 - 5, H - 16, 3, 5, c1);
    px(c, W / 2, H - 21, PAL.rose, 2, 1);
  },
  bonsai(c, W, H, c1, c2, _rot, r) {
    box(c, 2, H - 6, W - 4, 5, c2);
    px(c, W / 2, H - 12, PAL.woodD, 2, 6);
    px(c, W / 2 - 3, H - 12, PAL.woodD, 4, 1);
    leafBlob(c, W / 2 - 3, H - 14, 4, 2, c1, r);
    leafBlob(c, W / 2 + 3, H - 16, 4, 3, c1, r);
  },
  vase(c, W, H, c1, c2) {
    box(c, W / 2 - 3, H - 10, 6, 9, c2);
    for (let i = -2; i <= 2; i += 2) {
      px(c, W / 2 + i, H - 16, PAL.forest, 1, 6);
      px(c, W / 2 + i - 1, H - 17, c1, 3, 2);
    }
  },
  floorlamp(c, W, H, c1) {
    px(c, W / 2 - 1, H - 22, '#3d3a4a', 2, 21);
    px(c, W / 2 - 4, H - 2, '#3d3a4a', 8, 2);
    for (let j = 0; j < 8; j++) px(c, W / 2 - 3 - Math.floor(j / 3), H - 30 + j, j < 1 ? shade(c1, -0.4) : c1, 6 + Math.floor(j / 3) * 2, 1);
    px(c, W / 2 - 6, H - 22, shade(c1, -0.4), 12, 1);
  },
  tablelamp(c, W, H, c1) {
    box(c, W / 2 - 3, H - 6, 6, 5, PAL.woodL);
    px(c, W / 2, H - 9, '#3d3a4a', 1, 3);
    for (let j = 0; j < 6; j++) px(c, W / 2 - 2 - Math.floor(j / 2), H - 15 + j, c1, 5 + Math.floor(j / 2) * 2, 1);
  },
  candles(c, _W, H, c1) {
    for (const [x, h] of [[4, 6], [8, 9], [12, 5]]) {
      px(c, x, H - h - 1, c1, 2, h);
      px(c, x, H - h - 3, '#f4d68c', 2, 2);
    }
  },
  rug(c, W, H, c1, c2, rot) {
    box(c, 0, 0, W, H, c1, c2);
    px(c, 2, 2, c2, W - 4, 1);
    px(c, 2, H - 3, c2, W - 4, 1);
    if (rot === 1) for (let y = 5; y < H - 4; y += 4) px(c, 3, y, shade(c1, -0.15), W - 6, 2);
    if (rot === 2) ellipse(c, W / 2, H / 2, W / 4, H / 4, c2);
    if (rot === 3) {
      // raccoon face rug
      ellipse(c, W / 2, H / 2, W / 3, H / 3, '#8d8a93');
      px(c, W / 2 - 8, H / 2 - 2, '#3a3440', 16, 4);
      px(c, W / 2 - 5, H / 2 - 1, PAL.white, 2, 2);
      px(c, W / 2 + 3, H / 2 - 1, PAL.white, 2, 2);
      px(c, W / 2 - 1, H / 2 + 3, '#2a2230', 2, 1);
    }
    for (let x = 1; x < W; x += 3) {
      px(c, x, -0 + 0, c2, 1, 1);
      px(c, x, H - 1, c2, 1, 1);
    }
  },
  painting(c, W, H, c1, c2, rot) {
    // wall art: sits on the wall face (H is 16)
    const fy = 2;
    const fh = H - 6;
    box(c, 1, fy, W - 2, fh, PAL.gold, PAL.woodD);
    px(c, 2, fy + 1, c1, W - 4, fh - 2);
    if (rot === 0) {
      ellipse(c, W / 2, fy + fh - 3, W / 2 - 3, 3, c2);
      px(c, W - 8, fy + 2, PAL.cream, 2, 2);
    } else if (rot === 1) {
      px(c, 4, fy + fh / 2, PAL.white, W - 8, 2);
      px(c, 5, fy + fh / 2 - 1, PAL.red, W - 10, 1);
    } else if (rot === 2) {
      for (let i = 0; i < 4; i++) px(c, 3 + i * 4, fy + 2 + (i % 2) * 3, PAL.gold);
    } else {
      ellipse(c, W / 2, fy + fh / 2 + 1, 3, 3, '#8d8a93');
      px(c, W / 2 - 3, fy + fh / 2, '#3a3440', 7, 1);
    }
  },
  clock(c, W, H) {
    ellipse(c, W / 2, H / 2 - 1, 5, 5, PAL.woodD);
    ellipse(c, W / 2, H / 2 - 1, 4, 4, PAL.cream);
    px(c, W / 2, H / 2 - 4, OUT, 1, 3);
    px(c, W / 2, H / 2 - 1, OUT, 3, 1);
  },
  garland(c, W, H, c1) {
    for (let x = 0; x < W; x++) px(c, x, 3 + Math.round(Math.sin((x / W) * Math.PI) * 4), '#5d4f5f');
    for (let x = 2; x < W; x += 4) px(c, x, 4 + Math.round(Math.sin((x / W) * Math.PI) * 4), x % 8 ? c1 : PAL.rose, 2, 2);
    void H;
  },
  plush(c, W, H, c1, c2) {
    // generic animal plush; c2 used for mask/details
    ellipse(c, W / 2, H - 5, 5, 4, c1);
    ellipse(c, W / 2, H - 11, 5, 4, c1);
    px(c, W / 2 - 5, H - 16, c1, 3, 3);
    px(c, W / 2 + 3, H - 16, c1, 3, 3);
    px(c, W / 2 - 4, H - 12, c2, 9, 2);
    px(c, W / 2 - 3, H - 12, PAL.white, 1, 1);
    px(c, W / 2 + 2, H - 12, PAL.white, 1, 1);
    px(c, W / 2, H - 9, OUT, 1, 1);
    outline(c.canvas, shade(c1, -0.6));
  },
  aquarium(c, W, H) {
    box(c, 0, H - 8, W, 8, PAL.woodD);
    box(c, 1, H - 24, W - 2, 17, '#7fb2c9', '#3d3a4a');
    px(c, 2, H - 23, '#a9d2e2', W - 4, 2);
    px(c, 3, H - 11, PAL.sand, W - 6, 2);
    px(c, 6, H - 16, PAL.gold, 3, 2);
    px(c, W - 10, H - 19, PAL.rose, 3, 2);
    px(c, W / 2, H - 14, PAL.forest, 1, 4);
  },
  counter(c, W, H, c1, c2) {
    box(c, 0, H - 18, W, 6, c2);
    box(c, 0, H - 13, W, 13, c1);
    px(c, 0, H - 13, shade(c1, -0.4), W, 1);
    for (let x = 3; x < W - 2; x += 8) px(c, x, H - 10, shade(c1, -0.2), 5, 7);
  },
  stove(c, W, H) {
    box(c, 0, H - 22, W, 22, '#5d5864', '#2f2b38');
    px(c, 2, H - 21, '#46424f', W - 4, 7);
    ellipse(c, 5, H - 18, 2, 1, '#2a2230');
    ellipse(c, W - 6, H - 18, 2, 1, '#2a2230');
    box(c, 2, H - 12, W - 4, 9, '#3d3a4a');
    px(c, 4, H - 9, '#d9675f', W - 8, 2);
  },
  fridge(c, W, H) {
    box(c, 1, H - 30, W - 2, 30, '#e8e6e0', '#7d7a83');
    px(c, 2, H - 19, '#7d7a83', W - 4, 1);
    px(c, W - 5, H - 26, '#7d7a83', 1, 5);
    px(c, W - 5, H - 15, '#7d7a83', 1, 6);
  },
  sink(c, W, H) {
    K.kitchencounter(c, W, H, '', '', 0, Math.random);
    px(c, 3, H - 17, '#9fb6c2', W - 6, 3);
    px(c, W / 2, H - 21, '#7d7a83', 2, 4);
  },
  ricecooker(c, W, H) {
    K.counter(c, W, H, PAL.woodL, '#d8d2c8', 0, Math.random);
    box(c, 3, H - 24, W - 6, 8, PAL.cream);
    px(c, 5, H - 20, PAL.red, 2, 1);
  },
  cuttingboard(c, W, H) {
    K.kitchencounter(c, W, H, '', '', 0, Math.random);
    box(c, 2, H - 19, W - 4, 5, '#e6c79b');
    px(c, W - 5, H - 20, '#c9ccd6', 3, 1);
  },
  display(c, W, H, c1) {
    box(c, 0, H - 14, W, 14, c1);
    box(c, 1, H - 26, W - 2, 13, '#cfe6ee', '#7d7a83');
    px(c, 2, H - 25, '#e9f5f9', W - 4, 2);
    for (let x = 4; x < W - 4; x += 7) {
      px(c, x, H - 18, PAL.white, 5, 3);
      px(c, x + 1, H - 19, '#e8907c', 3, 1);
    }
  },
  kotatsu(c, W, H, c1, c2) {
    box(c, 1, H - 20, W - 2, 18, c1);
    for (let x = 4; x < W - 3; x += 5) px(c, x, H - 18, c2, 2, 14);
    box(c, 4, H - 22, W - 8, 12, PAL.woodL);
    ellipse(c, W / 2, H - 17, 2, 1, '#e88a4f');
  },
  radio(c, W, H, c1) {
    box(c, 2, H - 10, W - 4, 9, c1);
    ellipse(c, 6, H - 6, 2, 2, PAL.woodDD);
    px(c, 10, H - 7, PAL.cream, 3, 2);
    px(c, W - 4, H - 14, OUT, 1, 4);
  },
  bookstack(c, W, H, c1, c2) {
    box(c, 3, H - 4, W - 6, 3, c1);
    box(c, 4, H - 7, W - 7, 3, c2);
    box(c, 3, H - 10, W - 8, 3, PAL.sage);
  },
  telescope(c, W, H) {
    px(c, W / 2 - 4, H - 8, '#3d3a4a', 1, 8);
    px(c, W / 2 + 3, H - 8, '#3d3a4a', 1, 8);
    px(c, W / 2, H - 9, '#3d3a4a', 1, 9);
    for (let i = 0; i < 12; i++) px(c, W / 2 - 6 + i, H - 12 - Math.floor(i / 1.5), '#b7a8d6', 3, 3);
  },
  tea(c, W, H, c1) {
    ellipse(c, W / 2, H - 4, 4, 2, c1);
    px(c, W / 2 - 3, H - 8, c1, 6, 4);
    px(c, W / 2 + 3, H - 7, c1, 2, 1);
  },
  chest(c, W, H, c1) {
    box(c, 1, H - 11, W - 2, 10, c1);
    px(c, 1, H - 7, shade(c1, -0.4), W - 2, 1);
    px(c, W / 2 - 1, H - 8, PAL.gold, 2, 3);
  },
  easel(c, W, H, c1) {
    px(c, 3, H - 20, PAL.woodD, 1, 20);
    px(c, W - 4, H - 20, PAL.woodD, 1, 20);
    box(c, 1, H - 22, W - 2, 12, PAL.cream);
    px(c, 3, H - 19, c1, 4, 4);
    px(c, 8, H - 17, PAL.sage, 4, 3);
  },
  frame(c, W, H, c1) {
    // standing photo frame
    box(c, 3, H - 11, W - 6, 10, c1);
    px(c, 5, H - 9, '#8d8a93', 2, 2);
    px(c, 8, H - 9, '#8d8a93', 2, 2);
    px(c, 7, H - 8, '#b2585e', 2, 2);
  },
  piano(c, W, H, c1) {
    box(c, 0, H - 26, W, 20, c1);
    box(c, 1, H - 10, W - 2, 4, PAL.white);
    for (let x = 3; x < W - 2; x += 3) px(c, x, H - 10, OUT, 1, 2);
    px(c, 2, H - 6, shade(c1, -0.5), 2, 6);
    px(c, W - 4, H - 6, shade(c1, -0.5), 2, 6);
  },
  windchime(c, W, H, c1) {
    px(c, W / 2 - 4, 2, PAL.woodD, 9, 1);
    for (let i = -3; i <= 3; i += 2) px(c, W / 2 + i, 3, c1, 1, 6 + Math.abs(i));
    void H;
  },
  vending(c, W, H, c1) {
    box(c, 1, H - 30, W - 2, 30, c1, '#2a2230');
    px(c, 3, H - 27, '#cfe6ee', W - 6, 13);
    for (let y = H - 26; y < H - 15; y += 4) for (let x = 4; x < W - 4; x += 3) px(c, x, y, ['#d9675f', '#f2c66d', '#7fae5f', '#94c0d2'][(x + y) % 4], 2, 3);
    px(c, 3, H - 11, '#2a2230', W - 6, 4);
    px(c, W - 5, H - 13, '#f2c66d', 2, 1);
    px(c, 2, H - 29, shade(c1, 0.25), W - 4, 1);
  },
  bicycle(c, W, H, c1) {
    const wheel = (cx: number) => {
      ellipse(c, cx, H - 5, 4, 4, '#3d3a4a');
      ellipse(c, cx, H - 5, 3, 3, '#00000000');
      c.clearRect(cx - 2, H - 7, 5, 5);
      px(c, cx, H - 5, '#a59f9a');
    };
    wheel(6);
    wheel(W - 7);
    px(c, 6, H - 9, c1, W - 13, 1);
    px(c, 9, H - 12, c1, 1, 4);
    px(c, W - 9, H - 13, c1, 1, 6);
    px(c, 7, H - 13, '#2a2230', 4, 1);
    px(c, W - 11, H - 14, '#3d3a4a', 4, 1);
    px(c, W - 13, H - 12, '#c9a87c', 4, 3);
  },
  pot(c, W, H, c1, c2, _rot, r) {
    box(c, W / 2 - 5, H - 8, 10, 7, c2);
    px(c, W / 2 - 6, H - 9, shade(c2, -0.2), 12, 2);
    leafBlob(c, W / 2, H - 12, 6, 5, c1, r);
    for (let i = 0; i < 3; i++) px(c, W / 2 - 4 + Math.floor(r() * 8), H - 15 + Math.floor(r() * 5), i % 2 ? '#f4c6cf' : '#fbf6ea');
  },
  menuboard(c, W, H) {
    px(c, 3, H - 4, PAL.woodD, 1, 4);
    px(c, W - 4, H - 4, PAL.woodD, 1, 4);
    box(c, 1, H - 20, W - 2, 17, '#2f3b33', PAL.woodD);
    for (let y = H - 17; y < H - 6; y += 3) px(c, 4, y, '#f6ecd6', W - 8 - ((y * 3) % 5), 1);
    px(c, W / 2 - 2, H - 18, '#f2c66d', 4, 1);
  },
  lanternstring(c, W, H, c1, c2) {
    // garland of small lanterns hanging between two posts
    px(c, 0, H - 30, PAL.woodD, 2, 30);
    px(c, W - 2, H - 30, PAL.woodD, 2, 30);
    for (let x = 2; x < W - 2; x++) px(c, x, H - 29 + Math.round(Math.sin(((x - 2) / (W - 4)) * Math.PI) * 6), '#3a2a2a');
    for (let x = 8; x < W - 6; x += 10) {
      const y = H - 28 + Math.round(Math.sin(((x - 2) / (W - 4)) * Math.PI) * 6);
      ellipse(c, x, y + 4, 2, 3, (x / 10) % 2 ? c1 : c2);
      px(c, x - 1, y + 3, '#fff3c9', 1, 1);
    }
  },
  poster(c, W, H, c1, c2) {
    box(c, 1, 1, W - 2, H - 4, PAL.cream, PAL.woodD);
    px(c, 3, 3, c1, W - 6, H / 2 - 2);
    ellipse(c, W / 2, H / 2 - 2, 3, 3, c2);
    for (let y = H / 2 + 2; y < H - 5; y += 2) px(c, 3, y, '#5d4f5f', W - 8, 1);
  },
  awning(c, W, H, c1, c2) {
    for (let x = 0; x < W; x += 6) {
      px(c, x, 0, (x / 6) % 2 ? c1 : c2, 6, H - 3);
      ellipse(c, x + 3, H - 3, 3, 2, (x / 6) % 2 ? c1 : c2);
    }
    px(c, 0, 0, shade(c1, -0.4), W, 1);
  },
  puddle(c, W, H) {
    ellipse(c, W / 2, H - 4, W / 2 - 2, 3, 'rgba(120,150,190,0.45)');
    px(c, W / 2 - 3, H - 5, 'rgba(220,235,255,0.6)', 4, 1);
  },
  stairs(c, W, H, _c1, _c2, rot) {
    // rot 0: going up (steps toward the wall), 1: going down (hole in the floor)
    if (rot === 1) {
      box(c, 0, 0, W, H, '#3a2a2a', PAL.woodDD);
      for (let y = 2; y < H; y += 4) px(c, 2, y, PAL.woodD, W - 4, 2);
      return;
    }
    for (let i = 0; i < 4; i++) {
      px(c, 0, H - 4 - i * 4, shade(PAL.woodL, -i * 0.08), W, 4);
      px(c, 0, H - 4 - i * 4, PAL.woodD, W, 1);
    }
    px(c, 0, 0, PAL.woodDD, 1, H);
    px(c, W - 1, 0, PAL.woodDD, 1, H);
  },
  walldoor(c, W, H, _c1, _c2, rot) {
    door(c, 2, 1, W - 4, H - 1, rot ? '#2a2230' : PAL.woodD);
    if (!rot) {
      px(c, W - 6, H / 2, PAL.gold, 2, 2);
      px(c, 4, 4, PAL.wood, W - 8, 1);
    }
  },
  mechanism(c, W, H) {
    ellipse(c, W / 2, H - 8, W / 2 - 2, 6, '#5d5864');
    ellipse(c, W / 2, H - 9, W / 2 - 4, 4, '#3d3a4a');
    px(c, W / 2 - 1, H - 30, PAL.goldD, 2, 22);
    ellipse(c, W / 2, H - 30, 10, 3, PAL.goldD);
    for (const [dx, dy] of [[-9, -30], [9, -30], [0, -36]]) {
      ellipse(c, W / 2 + dx, H + dy, 3, 3, '#2a2230');
      px(c, W / 2 + dx, H + dy, PAL.gold, 1, 1);
    }
  },
  starlamp(c, W, H, c1) {
    box(c, W / 2 - 3, H - 5, 6, 4, PAL.woodD);
    const cx = W / 2;
    const cy = H - 11;
    px(c, cx - 1, cy - 4, c1, 2, 9);
    px(c, cx - 4, cy - 1, c1, 9, 2);
    px(c, cx - 2, cy - 2, c1, 5, 5);
    px(c, cx - 1, cy - 1, '#fff6c8', 2, 2);
  },
};

Object.assign(K, NATURE_KINDS, IZAKAYA_KINDS, SHOP_KINDS);

export function drawObject(kind: string, w: number, h: number, c1: string, c2: string, rot = 0, seed = 7, label?: string): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  const fn = K[kind];
  if (fn) fn(ctx, w, h, c1, c2, rot, rng(seed));
  else {
    // never leave a broken sprite: visible placeholder crate
    K.crate(ctx, w, h, c1, c2, 0, rng(seed));
  }
  if (label) {
    // shop plaque on the facade, or the board of a signpost
    if (kind === 'building') drawPlaque(ctx, w / 2, Math.floor(h * 0.46) - 2, label);
    else drawPlaque(ctx, w / 2, 1, label, { wood: '#d9a970' });
  }
  // flat ground decals stay flat; everything else gets lit volume
  // The fountain already has its own stone courses, rim highlights and water shading.
  if (!FLAT.has(kind) && kind !== 'fountain') volumize(c, kind === 'building' || kind === 'lighthouse' ? 0.7 : 1);
  return c;
}

const FLAT = new Set(['shoprug', 'wallshelf', 'mmsign', 'rug', 'puddle', 'pier', 'stars', 'garland', 'windchime', 'painting', 'poster', 'clock', 'stairs', 'walldoor', 'flowers', 'reeds']);

export const OBJECT_KINDS = Object.keys(K);
