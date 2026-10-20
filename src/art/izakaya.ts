/**
 * Izakaya / sushi-bar look for Midnight Maki (style guide: the "Midnight Maki" reference scene).
 * Cream plaster with honey-wood wainscot, an indigo noren band, broad quiet floorboards and a sushi counter with a glass
 * neta case, red stools, bamboo, sake barrels, paper lamps and the restaurant's hanging sign.
 */
import { ctx2d, ellipse, makeCanvas, px, shade, type Ctx } from './pixel';

const INK = '#2b1d17';
export const IZ = {
  wall: '#eddfbd',
  wallD: '#d9c7a3',
  wallL: '#f7edd5',
  beam: '#78553c',
  top: '#59402f',
  noren: '#2f3b6b',
  norenD: '#232c52',
  norenL: '#43508a',
  plank: '#c99962',
  plankD: '#b08253',
  plankL: '#d4a870',
  counter: '#eee2c6',
  bar: '#8a603e',
  cabinet: '#ad8053',
  cabinetD: '#86603f',
};

type TileDraw = (c: Ctx, x: number, y: number, r: () => number) => void;

// ------------------------------------------------------------------ tiles
function plaster(c: Ctx, x: number, y: number, h: number) {
  px(c, x, y, IZ.wall, 16, h);
  px(c, x, y, IZ.wallL, 16, 1);
}

export const izakayaTop: TileDraw = (c, x, y) => {
  px(c, x, y, IZ.top, 16, 16);
  px(c, x, y + 14, IZ.beam, 16, 2);
};

/** Indigo noren over plain plaster: keep the Japanese silhouette without dense wall grain. */
export const izakayaUpper: TileDraw = (c, x, y) => {
  plaster(c, x, y, 16);
  px(c, x, y, IZ.beam, 16, 2);
  px(c, x, y + 1, IZ.wallL, 16, 1);
  for (const p0 of [0, 8]) {
    px(c, x + p0, y + 2, IZ.noren, 8, 9);
    px(c, x + p0, y + 2, IZ.norenL, 8, 1);
    px(c, x + p0, y + 10, IZ.norenD, 8, 1);
    px(c, x + p0 + 7, y + 3, IZ.norenD, 1, 8);
    // wave crest
    px(c, x + p0 + 2, y + 5, '#e3e6f2', 3, 1);
    px(c, x + p0 + 2, y + 6, '#e3e6f2', 1, 1);
    px(c, x + p0 + 4, y + 4, '#e3e6f2', 1, 1);
  }
  px(c, x, y + 11, IZ.wallD, 16, 1);
  px(c, x, y + 14, IZ.beam, 16, 2);
  px(c, x, y + 14, IZ.wallL, 16, 1);
};

/** Cream wall above a warm wooden wainscot. All tile sizes and collision indices stay the same. */
export const izakayaWall: TileDraw = (c, x, y) => {
  plaster(c, x, y, 16);
  px(c, x, y + 10, IZ.beam, 16, 1);
  px(c, x, y + 11, IZ.cabinet, 16, 4);
  px(c, x, y + 11, '#c09667', 16, 1);
  px(c, x + 8, y + 12, IZ.cabinetD, 1, 3);
  px(c, x, y + 15, IZ.beam, 16, 1);
};

/** Lattice window: night sky with stars, or a pale day sky. */
export function izakayaWindow(night: boolean): TileDraw {
  return (c, x, y, r) => {
    izakayaWall(c, x, y, r);
    px(c, x + 1, y, IZ.beam, 14, 11);
    px(c, x + 2, y + 1, night ? '#24305a' : '#a9c8de', 12, 9);
    if (night) {
      px(c, x + 2, y + 6, '#2e3b6b', 12, 4);
      px(c, x + 4, y + 2, '#f6e7b0');
      px(c, x + 11, y + 4, '#f6e7b0');
      px(c, x + 8, y + 7, '#c9cce6');
      ellipse(c, x + 11, y + 3, 1, 1, '#f6e7b0');
    } else {
      px(c, x + 2, y + 1, '#cfe2ee', 12, 3);
      px(c, x + 3, y + 7, '#e9f2f7', 4, 1);
    }
    px(c, x + 7, y + 1, IZ.beam, 2, 9);
    px(c, x + 2, y + 5, IZ.beam, 12, 1);
    px(c, x + 1, y + 10, IZ.wallL, 14, 1);
  };
}

/** Broad honey floorboards: quiet, low-contrast surfaces keep food and actors readable. */
export function izakayaFloor(shift = 0): TileDraw {
  const tones = [IZ.plank, IZ.plankL];
  const joints = [3, 11].map((j) => (j + shift) % 13);
  return (c, x, y) => {
    for (let row = 0; row < 2; row++) {
      const y0 = y + row * 8;
      const tone = tones[row];
      px(c, x, y0, tone, 16, 8);
      px(c, x, y0, shade(tone, 0.06), 16, 1);
      px(c, x, y0 + 7, IZ.plankD, 16, 1);
      px(c, x + joints[row], y0 + 1, shade(tone, -0.12), 1, 6);
    }
  };
}

/** Continuous wooden boards in any colour (bedrooms, halls). `shift` moves the joints so neighbouring tiles do not share one grid. */
export function plankFloor(base: string, line: string, shift = 0): TileDraw {
  return (c, x, y) => {
    const tones = [base, shade(base, 0.08), shade(base, -0.06), shade(base, 0.03)];
    const joints = [4, 12, 8, 1].map((j) => (j + shift) % 13);
    for (let row = 0; row < 4; row++) {
      const y0 = y + row * 4;
      px(c, x, y0, tones[row], 16, 4);
      px(c, x, y0, shade(tones[row], 0.1), 16, 1);
      px(c, x, y0 + 3, line, 16, 1);
      px(c, x + ((joints[row] + 6) % 16), y0 + 2, shade(tones[row], -0.07), 4, 1);
      if (row % 2 === 1) px(c, x + joints[row], y0, line, 1, 3);
    }
  };
}

/** Behind the counter: a slightly darker honey wood, still distinct from the dining floor. */
export const barFloor: TileDraw = (c, x, y, r) => {
  for (let row = 0; row < 2; row++) {
    const tone = row === 0 ? '#b28659' : '#ba9163';
    px(c, x, y + row * 8, tone, 16, 8);
    px(c, x, y + row * 8 + 7, '#967047', 16, 1);
    px(c, x + 4 + Math.floor(r() * 8), y + row * 8, '#a07850', 1, 7);
  }
};

/** Tatami mat with dark green borders. */
export const tatamiMat: TileDraw = (c, x, y, r) => {
  px(c, x, y, '#ddd6ad', 16, 16);
  for (let j = 3; j < 16; j += 4) px(c, x, y + j, '#d2cba3', 16, 1);
  for (let i = 0; i < 2; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), '#e7dfbc');
  px(c, x, y, '#768764', 16, 2);
  px(c, x, y, '#768764', 2, 16);
  px(c, x, y + 1, '#94a17d', 16, 1);
};

// ------------------------------------------------------------------ props
type DrawFn = (c: Ctx, W: number, H: number, c1: string, c2: string, rot: number, r: () => number) => void;

const NETA = ['#f08c6c', '#d9485a', '#f2c66d', '#f4a07c', '#e8eef0', '#7fae5f'];

function nigiri(c: Ctx, x: number, y: number, col: string) {
  px(c, x, y + 1, '#f6f1e6', 4, 2);
  px(c, x, y, col, 4, 2);
  px(c, x, y, shade(col, 0.3), 2, 1);
}

function maki(c: Ctx, x: number, y: number, col: string) {
  ellipse(c, x + 1.5, y + 1.5, 1.6, 1.6, '#2f3b2c');
  px(c, x + 1, y + 1, '#f6f1e6', 2, 2);
  px(c, x + 1, y + 1, col);
}

function glyphs(): Record<string, string[]> {
  return {
    M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
    I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
    D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    N: ['X...X', 'XX..X', 'X.X.X', 'X.X.X', 'X..XX', 'X...X', 'X...X'],
    G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
    H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  };
}

function word(c: Ctx, text: string, x: number, y: number, col: string, shadow: string) {
  const G = glyphs();
  let cx = x;
  for (const ch of text) {
    const g = G[ch];
    if (!g) {
      cx += 4;
      continue;
    }
    g.forEach((row, j) =>
      [...row].forEach((v, i) => {
        if (v !== 'X') return;
        px(c, cx + i, y + j + 1, shadow);
        px(c, cx + i, y + j, col);
      }),
    );
    cx += g[0].length + 1;
  }
}

export function wordWidth(text: string): number {
  const G = glyphs();
  return [...text].reduce((w, ch) => w + (G[ch] ? G[ch][0].length + 1 : 4), -1);
}

export const IZAKAYA_KINDS: Record<string, DrawFn> = {
  /** Sushi counter: slatted front, light top, glass neta case. rot 1 = bar end with register and lucky cat. */
  sushibar(c, W, H, c1, c2, rot, r) {
    const front = c1 || IZ.bar;
    const top = c2 || IZ.counter;
    px(c, 0, H - 14, INK, W, 14);
    px(c, 0, H - 13, front, W, 12);
    for (let x = 1; x < W; x += 8) px(c, x, H - 12, shade(front, -0.12), 1, 10);
    px(c, 0, H - 3, shade(front, -0.35), W, 2);
    px(c, 0, H - 18, INK, W, 5);
    px(c, 0, H - 17, top, W, 3);
    px(c, 0, H - 17, shade(top, 0.2), W, 1);
    if (rot === 1) {
      // register
      px(c, 2, H - 24, INK, 9, 7);
      px(c, 3, H - 23, '#c9a24a', 7, 5);
      px(c, 4, H - 22, '#3a3440', 5, 2);
      px(c, 4, H - 19, '#e8d08a', 5, 1);
      // tiny lucky cat
      px(c, 12, H - 23, INK, 4, 6);
      px(c, 12, H - 22, '#f6f1e6', 3, 4);
      px(c, 12, H - 23, '#f6f1e6');
      px(c, 14, H - 23, '#f6f1e6');
      px(c, 13, H - 20, '#d9485a');
      return;
    }
    // glass case
    px(c, 0, H - 27, '#4a3a36', W, 10);
    px(c, 1, H - 26, '#bfdce6', W - 2, 8);
    px(c, 1, H - 26, '#e4f2f6', W - 2, 1);
    px(c, 1, H - 21, '#9cc2d0', W - 2, 1);
    for (let x = 1; x < W - 3; x += 5) {
      const col = NETA[Math.floor(r() * NETA.length)];
      if (r() < 0.7) nigiri(c, x, H - 24, col);
      else maki(c, x, H - 24, col);
    }
    px(c, 2, H - 25, '#ffffff', 2, 1);
  },
  stool(c, W, H, c1) {
    const seat = c1 || '#b8524f';
    const cx = Math.floor(W / 2);
    px(c, cx - 4, H - 7, INK, 2, 7);
    px(c, cx + 2, H - 7, INK, 2, 7);
    px(c, cx - 3, H - 6, '#5a3726', 1, 5);
    px(c, cx + 3, H - 6, '#5a3726', 1, 5);
    px(c, cx - 4, H - 4, '#5a3726', 8, 1);
    ellipse(c, cx, H - 9, 5, 2.6, INK);
    ellipse(c, cx, H - 9.5, 4.2, 1.8, seat);
    px(c, cx - 2, H - 11, shade(seat, 0.3), 3, 1);
  },
  /** Wall shelves with plates, bowls and sake bottles. */
  wallshelf(c, W, H, _c1, _c2, _rot, r) {
    for (const sy of [H - 13, H - 4]) {
      px(c, 0, sy, INK, W, 3);
      px(c, 1, sy, '#a8734d', W - 2, 1);
      px(c, 1, sy + 1, '#7a4e34', W - 2, 1);
    }
    let x = 2;
    while (x < W - 4) {
      const k = r();
      const base = H - 13;
      if (k < 0.3) {
        // sake bottle
        const col = r() < 0.5 ? '#4f7a52' : '#8a5a3c';
        px(c, x, base - 7, INK, 4, 7);
        px(c, x + 1, base - 6, col, 2, 6);
        px(c, x + 1, base - 9, INK, 2, 3);
        px(c, x + 1, base - 4, '#f6ecd6', 2, 2);
        x += 5;
      } else if (k < 0.6) {
        // stacked plates
        px(c, x, base - 4, INK, 6, 4);
        px(c, x + 1, base - 3, '#f3eee4', 4, 1);
        px(c, x + 1, base - 1, '#f3eee4', 4, 1);
        px(c, x + 1, base - 2, '#3b4470', 4, 1);
        x += 7;
      } else {
        // bowl
        px(c, x, base - 3, INK, 5, 3);
        px(c, x + 1, base - 3, '#d9675f', 3, 2);
        px(c, x + 1, base - 3, '#f3eee4', 3, 1);
        x += 6;
      }
    }
    // lower shelf: jars
    for (let jx = 3; jx < W - 4; jx += 7) {
      px(c, jx, H - 9, INK, 5, 5);
      px(c, jx + 1, H - 8, r() < 0.5 ? '#e8d6a8' : '#c9b48c', 3, 4);
      px(c, jx + 1, H - 9, '#7a4e34', 3, 1);
    }
  },
  /** The restaurant's hanging plaque. */
  mmsign(c, W, H) {
    const top = H - 28;
    px(c, 8, top - 2, INK, 1, 3);
    px(c, W - 9, top - 2, INK, 1, 3);
    px(c, 0, top + 1, INK, W, 27);
    px(c, 1, top + 2, '#8a5a3c', W - 2, 25);
    px(c, 3, top + 4, '#e2c08c', W - 6, 21);
    px(c, 3, top + 4, '#f0d7a8', W - 6, 1);
    px(c, 3, top + 24, '#c9a06a', W - 6, 1);
    const l1 = 'MIDNIGHT';
    const l2 = 'MAKI';
    const area = W - 26;
    word(c, l1, 6 + Math.floor((area - wordWidth(l1)) / 2), top + 7, '#3a2418', '#c9a06a');
    word(c, l2, 6 + Math.floor((area - wordWidth(l2)) / 2), top + 16, '#3a2418', '#c9a06a');
    // maki roll and chopsticks
    const mx = W - 13;
    const my = top + 15;
    ellipse(c, mx, my, 5, 5, '#22301f');
    ellipse(c, mx, my, 4, 4, '#f6f1e6');
    ellipse(c, mx, my, 2, 2, '#d9485a');
    px(c, mx - 1, my - 1, '#7fae5f');
    for (let i = 0; i < 8; i++) {
      px(c, mx - 4 + i, my - 7 + Math.floor(i / 2), '#7a4e34');
      px(c, mx - 2 + i, my - 8 + Math.floor(i / 2), '#5a3726');
    }
  },
  bamboo(c, W, H, c1, c2) {
    const leaf = c1 || '#6f9e5a';
    const pot = c2 || '#3b4470';
    const cx = Math.floor(W / 2);
    // pot
    px(c, cx - 5, H - 9, INK, 10, 9);
    px(c, cx - 4, H - 8, pot, 8, 7);
    px(c, cx - 4, H - 8, shade(pot, 0.25), 8, 1);
    px(c, cx - 5, H - 10, INK, 10, 2);
    px(c, cx - 4, H - 10, shade(pot, 0.15), 8, 1);
    // stalks
    const stalks: [number, number][] = [[cx - 3, H - 30], [cx, H - 34], [cx + 3, H - 27]];
    for (const [sx, sy] of stalks) {
      px(c, sx - 1, sy, INK, 3, H - 10 - sy);
      px(c, sx, sy, '#8fbf5f', 1, H - 10 - sy);
      for (let y = sy + 4; y < H - 10; y += 6) px(c, sx - 1, y, '#4f7a3a', 3, 1);
    }
    // leaves
    const leaves: [number, number, number][] = [[cx - 6, H - 28, -1], [cx + 4, H - 31, 1], [cx - 5, H - 22, -1], [cx + 5, H - 24, 1], [cx - 1, H - 35, 1]];
    for (const [lx, ly, d] of leaves) {
      for (let i = 0; i < 4; i++) px(c, lx + i * d, ly + Math.floor(i / 2), i < 3 ? leaf : shade(leaf, -0.3), 2, 1);
      px(c, lx + d, ly - 1, shade(leaf, 0.25));
    }
  },
  /** Komodaru: straw-wrapped sake barrel with a red crest. */
  sakebarrel(c, W, H, c1) {
    const crest = c1 || '#b8524f';
    const cx = Math.floor(W / 2);
    px(c, 1, H - 15, INK, W - 2, 14);
    px(c, 2, H - 14, '#e8dcbc', W - 4, 12);
    for (let x = 3; x < W - 2; x += 3) px(c, x, H - 14, '#d6c79e', 1, 12);
    px(c, 2, H - 12, '#8a6a44', W - 4, 1);
    px(c, 2, H - 4, '#8a6a44', W - 4, 1);
    ellipse(c, cx, H - 8, 3, 3, crest);
    px(c, cx - 1, H - 9, '#f6ecd6', 2, 2);
    ellipse(c, cx, H - 15, cx - 2, 1.6, INK);
    ellipse(c, cx, H - 15, cx - 3, 1, '#a8734d');
  },
  /** Andon: standing paper lamp. */
  andon(c, W, H, c1) {
    const paper = c1 || '#f6e3b0';
    const cx = Math.floor(W / 2);
    px(c, cx - 5, H - 26, INK, 10, 24);
    px(c, cx - 4, H - 25, paper, 8, 20);
    px(c, cx - 4, H - 25, '#fff6d8', 3, 18);
    px(c, cx - 4, H - 18, '#5a3726', 8, 1);
    px(c, cx - 4, H - 11, '#5a3726', 8, 1);
    px(c, cx, H - 25, '#5a3726', 1, 20);
    px(c, cx - 5, H - 4, '#5a3726', 2, 4);
    px(c, cx + 3, H - 4, '#5a3726', 2, 4);
    px(c, cx - 6, H - 27, '#5a3726', 12, 2);
  },
  /** Charcoal grill (replaces the western stove). */
  konro(c, W, H) {
    px(c, 0, H - 22, INK, W, 22);
    px(c, 1, H - 21, IZ.cabinet, W - 2, 20);
    px(c, 1, H - 21, IZ.counter, W - 2, 1);
    px(c, 2, H - 19, '#3a3440', W - 4, 6);
    for (let x = 3; x < W - 3; x += 2) px(c, x, H - 17, x % 4 ? '#f08c4f' : '#ffd27a', 1, 3);
    px(c, 2, H - 19, '#8d8790', W - 4, 1);
    // skewers
    px(c, 3, H - 20, '#e8d6a8', W - 6, 1);
    px(c, 5, H - 21, '#c96a4a', 2, 2);
    px(c, 9, H - 21, '#c96a4a', 2, 2);
    for (let x = 3; x < W - 3; x += 4) px(c, x, H - 11, '#5a3726', 2, 8);
  },
  /** Kitchen cabinet (pantry) with drawers and bowls on top. */
  tansu(c, W, H) {
    px(c, 0, H - 26, INK, W, 26);
    px(c, 1, H - 25, IZ.cabinet, W - 2, 24);
    for (let y = H - 23; y < H - 2; y += 5) {
      px(c, 2, y, shade(IZ.cabinet, 0.08), W - 4, 4);
      px(c, 2, y + 3, IZ.cabinetD, W - 4, 1);
      px(c, W / 2 - 1, y + 1, '#c9a24a', 2, 1);
    }
    px(c, 2, H - 30, INK, 6, 4);
    px(c, 3, H - 29, '#d9675f', 4, 2);
    px(c, 9, H - 31, INK, 5, 5);
    px(c, 10, H - 30, '#e8d6a8', 3, 4);
  },
  /** Wooden rice tub on the counter. */
  hangiri(c, W, H) {
    IZAKAYA_KINDS.kitchencounter(c, W, H, '', '', 0, Math.random);
    ellipse(c, W / 2, H - 19, 6, 3, INK);
    ellipse(c, W / 2, H - 19.5, 5, 2, '#a8734d');
    ellipse(c, W / 2, H - 20, 4, 1.4, '#f6f1e6');
    px(c, W / 2 - 6, H - 18, '#c9a24a', 12, 1);
  },
  /** Rice cooker on its counter: a round cream pot with a lid, a steam vent, side handles and a little red lamp. */
  ricepot(c, W, H) {
    IZAKAYA_KINDS.kitchencounter(c, W, H, '', '', 0, Math.random);
    const cx = W / 2;
    px(c, 2, H - 27, INK, W - 4, 10);
    px(c, 3, H - 26, '#f2ead8', W - 6, 8);
    px(c, 3, H - 26, '#fff8e8', W - 6, 1);
    px(c, 3, H - 19, '#cdbf9f', W - 6, 1);
    // lid with vent
    px(c, 4, H - 30, INK, W - 8, 4);
    px(c, 5, H - 29, '#d9ccb0', W - 10, 2);
    px(c, cx - 1, H - 31, INK, 2, 2);
    px(c, cx - 1, H - 31, '#8f8571');
    // handles and the lamp
    px(c, 1, H - 24, INK, 2, 3);
    px(c, W - 3, H - 24, INK, 2, 3);
    px(c, 5, H - 22, '#d9485a', 2, 1);
    px(c, 8, H - 22, '#6f9e5a', 2, 1);
  },
  /** Plain work counter: light top, wooden doors. Things are drawn on top of it by the kitchen view. */
  workcounter(c, W, H) {
    IZAKAYA_KINDS.kitchencounter(c, W, H, '', '', 0, Math.random);
    px(c, 2, H - 17, shade(IZ.counter, 0.12), W - 4, 1);
  },
  /** Assembly table (two tiles): light top with a bamboo rolling mat laid on it. */
  prepcounter(c, W, H) {
    px(c, 0, H - 18, INK, W, 18);
    px(c, 1, H - 17, IZ.counter, W - 2, 3);
    px(c, 1, H - 17, shade(IZ.counter, 0.2), W - 2, 1);
    px(c, 1, H - 13, IZ.cabinetD, W - 2, 12);
    for (let x = 4; x < W - 4; x += W / 2) px(c, x, H - 11, IZ.cabinet, W / 2 - 8, 8);
    // bamboo mat
    const mx = Math.round(W / 2 - 9);
    px(c, mx, H - 16, '#8d7a3d', 18, 3);
    px(c, mx + 1, H - 16, '#cdb867', 16, 2);
    for (let x = mx + 2; x < mx + 17; x += 2) px(c, x, H - 16, '#a89352', 1, 2);
    px(c, 0, H - 3, shade(IZ.cabinetD, -0.3), W, 2);
  },
  /** Floor bin with a lid. */
  bin(c, W, H) {
    px(c, 3, H - 13, INK, W - 6, 13);
    px(c, 4, H - 12, '#8f94a1', W - 8, 11);
    px(c, 4, H - 12, '#b9bec9', W - 8, 1);
    px(c, 4, H - 3, '#6b7080', W - 8, 2);
    px(c, 2, H - 15, INK, W - 4, 3);
    px(c, 3, H - 14, '#a7acb8', W - 6, 1);
    px(c, W / 2 - 1, H - 17, INK, 2, 2);
    for (let x = 6; x < W - 5; x += 3) px(c, x, H - 10, '#6b7080', 1, 7);
  },
  /** The pass (three tiles): low counter with slatted front and a service bell. Plates are drawn on top by the view. */
  passcounter(c, W, H) {
    px(c, 0, H - 14, INK, W, 14);
    px(c, 1, H - 13, IZ.bar, W - 2, 11);
    for (let x = 2; x < W - 1; x += 4) px(c, x, H - 12, shade(IZ.bar, -0.14), 1, 9);
    px(c, 0, H - 17, INK, W, 5);
    px(c, 1, H - 16, IZ.counter, W - 2, 3);
    px(c, 1, H - 16, shade(IZ.counter, 0.2), W - 2, 1);
    px(c, 0, H - 3, shade(IZ.bar, -0.35), W, 2);
    // service bell at the right end
    ellipse(c, W - 6, H - 19, 2.6, 1.8, INK);
    ellipse(c, W - 6, H - 19.4, 2, 1.3, '#e8c25a');
    px(c, W - 7, H - 21, '#fff2b0');
  },
  /** Tea and drinks corner: iron kettle, cups and ramune bottles on a counter. */
  drinkstation(c, W, H) {
    IZAKAYA_KINDS.kitchencounter(c, W, H, '', '', 0, Math.random);
    ellipse(c, 6, H - 21, 4, 3, INK);
    ellipse(c, 6, H - 21.5, 3.2, 2.4, '#4a4f5c');
    px(c, 9, H - 23, INK, 3, 1);
    px(c, 3, H - 25, INK, 6, 1);
    px(c, 11, H - 21, INK, 2, 5);
    px(c, 11, H - 21, '#78adb6', 1, 4);
    px(c, 14, H - 20, INK, 2, 4);
    px(c, 14, H - 20, '#f6ecd6', 1, 3);
  },
  kitchencounter(c, W, H) {
    px(c, 0, H - 18, INK, W, 18);
    px(c, 1, H - 17, IZ.counter, W - 2, 3);
    px(c, 1, H - 17, shade(IZ.counter, 0.2), W - 2, 1);
    px(c, 1, H - 13, IZ.cabinetD, W - 2, 12);
    px(c, 3, H - 11, IZ.cabinet, W - 6, 8);
    px(c, W - 5, H - 8, '#c9a24a', 1, 2);
  },
};

/** Standalone canvas helper for previews. */
export function izakayaSprite(kind: string, w: number, h: number, c1 = '', c2 = '', rot = 0, r: () => number = Math.random) {
  const c = makeCanvas(w, h);
  IZAKAYA_KINDS[kind](ctx2d(c), w, h, c1, c2, rot, r);
  return c;
}
