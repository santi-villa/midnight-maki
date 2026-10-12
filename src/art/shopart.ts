/** Props for the walkable shop interiors: counters, clothes racks, bread case, stacked goods. */
import { ellipse, px, shade, type Ctx } from './pixel';

const INK = '#2b1d17';
type DrawFn = (c: Ctx, W: number, H: number, c1: string, c2: string, rot: number, r: () => number) => void;

export const SHOP_KINDS: Record<string, DrawFn> = {
  /** shop counter: wooden front with a lighter top (c1 wood, c2 top); rot 1 = with a little scale/register */
  shopcounter(c, W, H, c1, c2, rot) {
    const wood = c1 || '#a8714a';
    const top = c2 || '#e2b585';
    px(c, 0, H - 16, INK, W, 16);
    px(c, 1, H - 15, top, W - 2, 4);
    px(c, 1, H - 15, shade(top, 0.25), W - 2, 1);
    px(c, 1, H - 11, wood, W - 2, 10);
    for (let x = 3; x < W - 2; x += 8) px(c, x, H - 9, shade(wood, -0.2), 5, 6);
    px(c, 1, H - 2, shade(wood, -0.4), W - 2, 1);
    if (rot === 1) {
      px(c, 3, H - 22, INK, 9, 7);
      px(c, 4, H - 21, '#c9a24a', 7, 5);
      px(c, 5, H - 20, '#3a3440', 5, 2);
    }
  },
  /** clothes rack with hanging garments in c1/c2 colours */
  clothesrack(c, W, H, c1, c2, _rot, r) {
    px(c, 1, H - 26, INK, W - 2, 3);
    px(c, 2, H - 25, '#c48d5e', W - 4, 1);
    px(c, 2, H - 24, INK, 2, 24);
    px(c, W - 4, H - 24, INK, 2, 24);
    const cols = [c1 || '#d9a3a6', c2 || '#3b4470', '#f6f1e6', '#9bb59a'];
    for (let x = 5, i = 0; x < W - 8; x += 7, i++) {
      const col = cols[(i + Math.floor(r() * 2)) % cols.length];
      px(c, x, H - 23, INK, 6, 15);
      px(c, x + 1, H - 22, col, 4, 13);
      px(c, x + 1, H - 22, shade(col, 0.25), 4, 2);
      px(c, x + 2, H - 21, shade(col, -0.25), 1, 11);
    }
    px(c, 2, H - 2, '#7a4c30', W - 4, 2);
  },
  /** glass bread case with loaves */
  breadcase(c, W, H) {
    px(c, 0, H - 22, INK, W, 22);
    px(c, 1, H - 21, '#bfdce6', W - 2, 12);
    px(c, 1, H - 21, '#e4f2f6', W - 2, 1);
    for (let x = 3; x < W - 6; x += 7) {
      ellipse(c, x + 3, H - 14, 3, 2.4, '#2b1d17');
      ellipse(c, x + 3, H - 14, 2.4, 1.8, '#d9964a');
      px(c, x + 2, H - 15, '#f2c27a', 3, 1);
    }
    px(c, 1, H - 9, '#a8714a', W - 2, 8);
    px(c, 1, H - 9, '#c48d5e', W - 2, 1);
    px(c, 4, H - 6, shade('#a8714a', -0.2), W - 8, 3);
  },
  /** sack of grain / flour */
  flour(c, W, H) {
    ellipse(c, W / 2, H - 7, 6, 6.5, INK);
    ellipse(c, W / 2, H - 7, 5.2, 5.7, '#efe3c8');
    px(c, W / 2 - 3, H - 8, '#d9c8a4', 6, 1);
    px(c, W / 2 - 2, H - 5, '#b2585e', 4, 3);
    px(c, W / 2 - 3, H - 14, INK, 6, 2);
    px(c, W / 2 - 2, H - 13, '#efe3c8', 4, 1);
  },
  /** a rug at the door (flat) */
  shoprug(c, W, H, c1) {
    px(c, 1, H - 9, INK, W - 2, 8);
    px(c, 2, H - 8, c1 || '#b8524f', W - 4, 6);
    px(c, 3, H - 7, shade(c1 || '#b8524f', 0.25), W - 6, 1);
    for (let x = 4; x < W - 4; x += 4) px(c, x, H - 5, '#f2c66d', 2, 1);
  },
};
