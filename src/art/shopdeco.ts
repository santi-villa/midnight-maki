/**
 * Things shops put outside, by what they sell or do: a bread cart, crates of vegetables, a mannequin, a book cart, a drying
 * rack, a flower stand, a tea parasol, a woodpile. Native pixel art on the 16px grid, same palette as the village kit.
 */
import { ellipse, px, shade, type Ctx } from './pixel';

const INK = '#2f2427', WOOD = '#9b6f48', WOOD_D = '#6b4a30', WOOD_L = '#c99a62';
type Draw = (c: Ctx, w: number, h: number, c1: string, c2: string) => void;

function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  px(c, x, y, INK, w, h); px(c, x + 1, y + 1, fill, w - 2, h - 2); px(c, x + 1, y + 1, shade(fill, 0.25), w - 2, 1);
}
function wheel(c: Ctx, x: number, y: number) {
  ellipse(c, x, y, 4, 4, INK); ellipse(c, x, y, 3, 3, WOOD_D); ellipse(c, x, y, 1, 1, WOOD_L);
}
function shadow(c: Ctx, w: number, h: number) { ellipse(c, w / 2, h - 1, w / 2 - 2, 2, 'rgba(0,0,0,0.18)'); }

export const SHOPDECO_KINDS: Record<string, Draw> = {
  /** Bento's bread cart: loaves and baguettes in baskets under a little awning */
  deco_breadcart(c, W, H, c1) {
    shadow(c, W, H);
    wheel(c, 6, H - 5); wheel(c, W - 7, H - 5);
    box(c, 2, H - 14, W - 4, 8, WOOD);
    px(c, 3, H - 8, WOOD_D, W - 6, 1);
    // baskets of bread
    for (let i = 0; i < 3; i++) {
      const bx = 4 + i * 9;
      box(c, bx, H - 19, 8, 6, '#b98a52');
      ellipse(c, bx + 2.5, H - 20, 2.3, 1.8, '#d9a15a'); ellipse(c, bx + 5.5, H - 20, 2.3, 1.8, '#c88a45');
      px(c, bx + 2, H - 21, '#f0c883', 2, 1);
    }
    // baguettes in a tall pot
    px(c, W - 6, H - 28, '#d9a15a', 2, 10); px(c, W - 4, H - 26, '#c88a45', 2, 8); px(c, W - 8, H - 25, '#d9a15a', 2, 7);
    // awning
    for (let x = 1; x < W - 1; x += 4) { px(c, x, H - 31, (x >> 2) % 2 ? '#f2e6cc' : c1 || '#c2604a', 4, 4); }
    px(c, 1, H - 27, INK, W - 2, 1);
    px(c, 2, H - 27, WOOD_D, 1, 9); px(c, W - 3, H - 27, WOOD_D, 1, 9);
  },

  /** Taro's grocery: stacked crates of cabbages, carrots and apples */
  deco_vegcrates(c, W, H) {
    shadow(c, W, H);
    const crate = (x: number, y: number, kind: number) => {
      box(c, x, y, 14, 9, WOOD); px(c, x + 1, y + 4, WOOD_D, 12, 1);
      if (kind === 0) for (let i = 0; i < 3; i++) { ellipse(c, x + 3 + i * 4, y, 2.4, 2, '#7cb35c'); px(c, x + 2 + i * 4, y - 2, '#a9d684', 2, 1); }
      else if (kind === 1) for (let i = 0; i < 4; i++) { px(c, x + 2 + i * 3, y - 3, '#e8883a', 2, 4); px(c, x + 2 + i * 3, y - 4, '#6aa04e', 2, 1); }
      else for (let i = 0; i < 4; i++) ellipse(c, x + 3 + i * 3, y - 1, 1.7, 1.7, i % 2 ? '#d9483c' : '#e8a53a');
    };
    crate(1, H - 9, 0); crate(W - 15, H - 9, 1);
    crate(8, H - 17, 2);
    px(c, 2, H - 20, '#e9dfc4', 6, 3); px(c, 3, H - 19, INK, 4, 1);
  },

  /** rice and flour sacks, tied at the neck */
  deco_sacks(c, W, H, c1) {
    shadow(c, W, H);
    const sack = (x: number, y: number, col: string) => {
      ellipse(c, x + 5, y + 6, 6, 6, INK); ellipse(c, x + 5, y + 6, 5, 5, col);
      px(c, x + 3, y, INK, 5, 3); px(c, x + 4, y + 1, shade(col, -0.1), 3, 1);
      px(c, x + 3, y + 3, '#a8503a', 5, 1);
      px(c, x + 2, y + 5, shade(col, 0.3), 2, 4);
      px(c, x + 4, y + 8, '#a8503a', 3, 2);
    };
    sack(1, H - 13, c1 || '#e6dcc2'); sack(W - 12, H - 13, '#e6dcc2'); sack(W / 2 - 5, H - 20, '#efe6cd');
  },

  /** Yuki's mannequin: a dress form wearing a kimono */
  deco_mannequin(c, W, H, c1, c2) {
    shadow(c, W, H);
    px(c, W / 2 - 4, H - 3, INK, 8, 3); px(c, W / 2 - 3, H - 3, WOOD, 6, 2);
    px(c, W / 2 - 1, H - 22, INK, 2, 20); px(c, W / 2 - 1, H - 22, WOOD_L, 1, 20);
    // head, shoulders and a kimono with an obi
    ellipse(c, W / 2, H - 31, 3, 3, INK); ellipse(c, W / 2, H - 31, 2, 2, '#e8d2b0');
    px(c, W / 2 - 7, H - 27, INK, 14, 17); px(c, W / 2 - 6, H - 26, c1 || '#c2748f', 12, 15);
    px(c, W / 2 - 6, H - 26, shade(c1 || '#c2748f', 0.25), 12, 2);
    px(c, W / 2 - 6, H - 19, c2 || '#f2e0a0', 12, 3); px(c, W / 2 - 1, H - 26, shade(c1 || '#c2748f', -0.3), 2, 7);
  },

  /** a clothes rail with three garments */
  deco_clothesrack(c, W, H) {
    shadow(c, W, H);
    px(c, 2, H - 28, INK, 3, 27); px(c, W - 5, H - 28, INK, 3, 27); px(c, 3, H - 28, WOOD_L, 1, 27); px(c, W - 4, H - 28, WOOD_L, 1, 27);
    px(c, 1, H - 29, INK, W - 2, 3); px(c, 2, H - 29, WOOD, W - 4, 1);
    const g = (x: number, col: string, sleeves: boolean) => {
      px(c, x, H - 26, INK, 8, 16); px(c, x + 1, H - 25, col, 6, 14); px(c, x + 1, H - 25, shade(col, 0.3), 6, 1);
      if (sleeves) { px(c, x - 2, H - 25, INK, 3, 8); px(c, x - 1, H - 24, col, 1, 6); px(c, x + 7, H - 25, INK, 3, 8); px(c, x + 8, H - 24, col, 1, 6); }
      px(c, x + 3, H - 28, INK, 2, 3);
    };
    g(5, '#8caaa0', true); g(15, '#d8b3bd', false); g(24 > W - 12 ? W - 11 : 22, '#b2a4c3', true);
  },

  /** the library's cart of books to return */
  deco_bookcart(c, W, H) {
    shadow(c, W, H);
    wheel(c, 6, H - 4); wheel(c, W - 7, H - 4);
    box(c, 2, H - 10, W - 4, 6, '#7d5a40');
    const cols = ['#b2585e', '#3b4470', '#d7b36c', '#5f8a6e', '#8a5a9c', '#c97f4a'];
    for (let r = 0; r < 2; r++) {
      let x = 4 + r * 2;
      for (let i = 0; i < 6 - r; i++) { const hh = 7 + (i % 3); px(c, x, H - 10 - hh - r * 8, INK, 4, hh); px(c, x + 1, H - 9 - hh - r * 8, cols[(i + r * 2) % cols.length], 2, hh - 2); x += 4; }
    }
    px(c, W - 6, H - 22, INK, 2, 14); px(c, W - 5, H - 22, WOOD_L, 1, 14);
    box(c, W - 12, H - 24, 10, 6, '#f1e4c1'); px(c, W - 10, H - 22, INK, 6, 1); px(c, W - 10, H - 20, INK, 4, 1);
  },

  /** a rack of fish drying in the sun, for the fishmongers */
  deco_fishrack(c, W, H) {
    shadow(c, W, H);
    px(c, 2, H - 28, INK, 3, 27); px(c, W - 5, H - 28, INK, 3, 27); px(c, 3, H - 28, WOOD_L, 1, 27); px(c, W - 4, H - 28, WOOD_L, 1, 27);
    px(c, 1, H - 28, INK, W - 2, 3); px(c, 2, H - 28, WOOD, W - 4, 1);
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * 6;
      px(c, x + 1, H - 25, INK, 1, 3);
      px(c, x - 1, H - 22, INK, 5, 12); px(c, x, H - 21, '#9bb5c3', 3, 10); px(c, x, H - 21, '#d4e0e6', 1, 8);
      px(c, x, H - 10, INK, 3, 3); px(c, x, H - 11, '#7f9dad', 3, 2);
    }
    box(c, W - 13, H - 7, 11, 6, WOOD); px(c, W - 12, H - 9, '#8fb2bf', 9, 3);
  },

  /** the florist's tiered stand of buckets */
  deco_flowerstand(c, W, H) {
    shadow(c, W, H);
    px(c, 2, H - 8, INK, W - 4, 8); px(c, 3, H - 7, WOOD, W - 6, 6);
    px(c, 5, H - 18, INK, W - 10, 8); px(c, 6, H - 17, WOOD_L, W - 12, 6);
    px(c, 8, H - 28, INK, W - 16, 10); px(c, 9, H - 27, WOOD, W - 18, 8);
    const cols = ['#e57f9a', '#f2c14e', '#b793e0', '#f4efe0', '#e8883a', '#7fb0e8'];
    const bucket = (x: number, y: number, n: number) => {
      box(c, x, y, 8, 6, '#7f9aa8');
      for (let k = 0; k < 4; k++) { px(c, x + 1 + k * 2, y - 4 - ((k + n) % 2), '#5f8f4f', 1, 4); px(c, x + k * 2, y - 6 - ((k + n) % 2), cols[(k + n) % cols.length], 3, 3); }
    };
    bucket(3, H - 14, 0); bucket(W - 11, H - 14, 2);
    bucket(W / 2 - 4, H - 24, 4); bucket(4, H - 6, 1); bucket(W - 12, H - 6, 3);
  },

  /** a table with a parasol and a teapot for the tea houses */
  deco_teaparasol(c, W, H, c1) {
    shadow(c, W, H);
    px(c, W / 2 - 1, H - 22, INK, 3, 21); px(c, W / 2, H - 22, WOOD_L, 1, 21);
    // parasol
    for (let y = 0; y < 8; y++) { const half = 12 - y * 0.5 - (y === 0 ? 5 : 0); px(c, W / 2 - half, H - 36 + y, INK, half * 2 + 1, 1); px(c, W / 2 - half + 1, H - 36 + y, y % 2 ? '#f2e6cc' : c1 || '#c2484a', half * 2 - 1, 1); }
    for (let x = W / 2 - 11; x < W / 2 + 11; x += 4) px(c, x, H - 28, INK, 1, 2);
    // table
    box(c, 3, H - 11, W - 6, 4, WOOD_L); px(c, 5, H - 7, INK, 2, 7); px(c, W - 7, H - 7, INK, 2, 7);
    // teapot and two cups
    ellipse(c, W / 2 - 3, H - 14, 3, 2.4, INK); ellipse(c, W / 2 - 3, H - 14, 2, 1.6, '#c99a52'); px(c, W / 2 - 1, H - 15, '#c99a52', 3, 1);
    px(c, W / 2 + 4, H - 14, INK, 4, 3); px(c, W / 2 + 5, H - 13, '#f2e6cc', 2, 1);
  },

  /** logs and planks for Ren's carpentry */
  deco_woodpile(c, W, H) {
    shadow(c, W, H);
    // planks leaning behind
    for (let i = 0; i < 4; i++) { px(c, 3 + i * 3, H - 20, INK, 3, 16); px(c, 4 + i * 3, H - 19, i % 2 ? WOOD_L : '#d6aa72', 1, 14); }
    // log ends
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4 - r; i++) {
      const x = 16 + i * 6 + r * 3, y = H - 5 - r * 5;
      ellipse(c, x, y, 3, 3, INK); ellipse(c, x, y, 2, 2, '#c99a62'); px(c, x, y, '#8a5c34', 1, 1);
    }
  },
};
