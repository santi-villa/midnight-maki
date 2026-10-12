/**
 * Izakaya / sushi-bar look for Midnight Maki (style guide: the "Midnight Maki" reference scene).
 * Dark wooden walls with an indigo noren band, night windows, warm planks, a sushi counter with a glass
 * neta case, red stools, bamboo, sake barrels, paper lamps and the restaurant's hanging sign.
 */
import { ctx2d, ellipse, makeCanvas, px, shade, type Ctx } from './pixel';

const INK = '#2b1d17';
export const IZ = {
  wall: '#5c3c2b',
  wallD: '#462d21',
  wallL: '#70503b',
  beam: '#3a261c',
  top: '#2a1c16',
  noren: '#2f3b6b',
  norenD: '#232c52',
  norenL: '#43508a',
  plank: '#9c6440',
  plankD: '#7a4a2f',
  plankL: '#b07650',
  counter: '#c99a6b',
  bar: '#5a3726',
};

type TileDraw = (c: Ctx, x: number, y: number, r: () => number) => void;

// ------------------------------------------------------------------ tiles
function planksV(c: Ctx, x: number, y: number, h: number, r: () => number) {
  px(c, x, y, IZ.wall, 16, h);
  for (let i = 0; i < 16; i += 4) {
    const tone = r() < 0.33 ? IZ.wallL : r() < 0.5 ? IZ.wallD : IZ.wall;
    px(c, x + i, y, tone, 4, h);
    px(c, x + i, y, IZ.wallD, 1, h);
  }
}

export const izakayaTop: TileDraw = (c, x, y) => {
  px(c, x, y, IZ.top, 16, 16);
  px(c, x, y + 14, IZ.beam, 16, 2);
};

/** Upper wall: a deep indigo noren (two split panels per tile with a white crest) over dark planks. */
export const izakayaUpper: TileDraw = (c, x, y, r) => {
  planksV(c, x, y, 16, r);
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

/** Wall face: vertical planks above a darker wainscot. */
export const izakayaWall: TileDraw = (c, x, y, r) => {
  planksV(c, x, y, 16, r);
  px(c, x, y + 10, IZ.beam, 16, 1);
  px(c, x, y + 11, '#3e281e', 16, 4);
  for (let i = 1; i < 16; i += 5) px(c, x + i, y + 12, '#4a3125', 3, 2);
  px(c, x, y + 15, '#21150f', 16, 1);
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

/** Warm floor planks: continuous horizontal boards (each row its own tone) with staggered joints. */
export const izakayaFloor: TileDraw = (c, x, y, r) => {
  const tones = [IZ.plank, IZ.plankL, shade(IZ.plank, -0.07), shade(IZ.plank, 0.05)];
  const joints = [3, 11, 7, 14];
  for (let row = 0; row < 4; row++) {
    const y0 = y + row * 4;
    const tone = tones[row];
    px(c, x, y0, tone, 16, 4);
    px(c, x, y0, shade(tone, 0.1), 16, 1);
    px(c, x, y0 + 3, IZ.plankD, 16, 1);
    px(c, x + ((joints[row] + 5) % 16), y0 + 2, shade(tone, -0.07), 4, 1);
    if (row % 2 === 0) px(c, x + joints[row], y0, IZ.plankD, 1, 3);
  }
  if (r() < 2) px(c, x + 9, y + 5, shade(IZ.plankD, -0.1), 1, 1);
};

/** Behind-the-counter floor: darker, tighter boards. */
export const barFloor: TileDraw = (c, x, y, r) => {
  for (let row = 0; row < 4; row++) {
    const tone = r() < 0.5 ? '#6f452f' : '#7a4e35';
    px(c, x, y + row * 4, tone, 16, 4);
    px(c, x, y + row * 4 + 3, '#4f3021', 16, 1);
    px(c, x + 4 + Math.floor(r() * 8), y + row * 4, '#4f3021', 1, 3);
  }
};

/** Tatami mat with dark green borders. */
export const tatamiMat: TileDraw = (c, x, y, r) => {
  px(c, x, y, '#cfc98f', 16, 16);
  for (let j = 1; j < 16; j += 2) px(c, x, y + j, '#c2bb7f', 16, 1);
  for (let i = 0; i < 6; i++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), '#dcd6a2');
  px(c, x, y, '#4f6b47', 16, 2);
  px(c, x, y, '#4f6b47', 2, 16);
  px(c, x, y + 1, '#6b8a5f', 16, 1);
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
    for (let x = 1; x < W; x += 4) px(c, x, H - 12, shade(front, -0.2), 1, 10);
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
    px(c, 1, H - 21, '#7a4e34', W - 2, 20);
    px(c, 1, H - 21, '#a8734d', W - 2, 1);
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
    px(c, 1, H - 25, '#7a4e34', W - 2, 24);
    for (let y = H - 23; y < H - 2; y += 5) {
      px(c, 2, y, '#8f5e3f', W - 4, 4);
      px(c, 2, y + 3, '#5a3726', W - 4, 1);
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
  kitchencounter(c, W, H) {
    px(c, 0, H - 18, INK, W, 18);
    px(c, 1, H - 17, IZ.counter, W - 2, 3);
    px(c, 1, H - 17, shade(IZ.counter, 0.2), W - 2, 1);
    px(c, 1, H - 13, '#7a4e34', W - 2, 12);
    px(c, 3, H - 11, '#8f5e3f', W - 6, 8);
    px(c, W - 5, H - 8, '#c9a24a', 1, 2);
  },
};

/** Standalone canvas helper for previews. */
export function izakayaSprite(kind: string, w: number, h: number, c1 = '', c2 = '', rot = 0, r: () => number = Math.random) {
  const c = makeCanvas(w, h);
  IZAKAYA_KINDS[kind](ctx2d(c), w, h, c1, c2, rot, r);
  return c;
}
