/**
 * Pieces of the river valley and the shrine hill: the watermill, the waterfall over the rocks and the stone stairs
 * that climb the terraces. Native pixel art on the 16px grid, same palette as the village kit.
 */
import { ellipse, px, shade, type Ctx } from './pixel';

const INK = '#2f2427', TIM = '#5a3d2e', TIM2 = '#7d5a40', TIM3 = '#b08a62';
type Draw = (c: Ctx, w: number, h: number, c1: string, c2: string, rot: number, r: () => number) => void;

function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  px(c, x, y, INK, w, h); px(c, x + 1, y + 1, fill, w - 2, h - 2);
}

export const HILLSIDE_KINDS: Record<string, Draw> = {
  /** the watermill: a timber house with a big wheel on its river side (left) */
  mill(c, W, H) {
    const base = H - 3;
    // plaster walls with a timber frame, stone footing
    box(c, 22, 30, W - 26, base - 28, '#e6d6b2');
    for (let y = 36; y < base - 3; y += 6) px(c, 23, y, TIM2, W - 28, 2);
    px(c, 22, 30, TIM, 4, base - 30); px(c, W - 8, 30, TIM, 4, base - 30);
    for (let x = 22; x < W - 4; x += 7) { px(c, x, base - 3, '#8b8478', 6, 3); px(c, x, base - 3, '#b7ae9a', 6, 1); }
    // roof
    for (let y = 6; y < 32; y++) {
      const inset = Math.max(1, Math.round((32 - y) * 0.2));
      px(c, 20 + inset, y, INK, W - 22 - inset * 2, 1);
      const t = (y - 6) / 26;
      px(c, 21 + inset, y, shade('#8a5a46', 0.14 - t * 0.22), W - 24 - inset * 2, 1);
      if ((y - 6) % 4 === 3) px(c, 21 + inset, y, shade('#8a5a46', -0.3), W - 24 - inset * 2, 1);
      else for (let x = 22 + inset + (((y - 6) >> 2) % 2) * 4; x < W - 6 - inset; x += 8) px(c, x, y, shade('#8a5a46', -0.26), 1, 1);
    }
    px(c, 32, 6, INK, W - 44, 3); px(c, 33, 6, shade('#8a5a46', 0.36), W - 46, 1);
    px(c, 20, 31, INK, W - 18, 2); px(c, 21, 32, TIM3, W - 20, 1);
    // door and window
    box(c, W - 24, base - 22, 12, 21, TIM2); px(c, W - 22, base - 20, '#4a3426', 8, 19);
    box(c, 28, 40, 12, 12, TIM2); px(c, 29, 41, '#9bbfca', 10, 10); px(c, 29, 41, '#cfe4e2', 10, 3); px(c, 34, 41, TIM, 1, 10); px(c, 29, 46, TIM, 10, 1);
    // sacks by the door
    ellipse(c, W - 6, base - 5, 5, 5, INK); ellipse(c, W - 6, base - 5, 4, 4, '#e6dcc2'); px(c, W - 8, base - 11, '#a8503a', 4, 1);
    // the wheel: rim, spokes and paddles
    const cx = 12, cy = base - 14;
    ellipse(c, cx, cy, 12, 12, INK); ellipse(c, cx, cy, 10, 10, TIM2); ellipse(c, cx, cy, 8, 8, '#4f6f8a');
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      for (let t = 2; t < 11; t++) px(c, Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), t > 8 ? TIM3 : TIM, 1, 1);
      px(c, Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), TIM3, 2, 2);
    }
    ellipse(c, cx, cy, 2, 2, INK); px(c, cx - 1, cy - 1, TIM3, 2, 2);
    px(c, cx, cy - 1, TIM, 12, 3); // axle into the house
    // splash
    for (let i = 0; i < 6; i++) px(c, 2 + i * 3, base - 1 - (i % 2), '#d7ecf2', 2, 1);
  },

  /** water pouring over the rocks into the river: white streaks and foam at the foot (64 px wide) */
  waterfall(c, W, H, _c1, _c2, _rot, r) {
    px(c, 0, 0, '#a9d6ea', W, H - 6);
    for (let x = 0; x < W; x += 3) {
      const len = 10 + Math.floor(r() * (H - 20));
      px(c, x, 0, '#e8f6fb', 1, len); px(c, x + 1, Math.floor(r() * 8), '#7fbad6', 1, len);
    }
    for (let y = 6; y < H - 8; y += 9) px(c, 0, y, 'rgba(255,255,255,0.35)', W, 1);
    // foam at the foot
    for (let x = 0; x < W; x += 4) { ellipse(c, x + 2, H - 5, 3, 3, '#f4fbfd'); ellipse(c, x + 2, H - 3, 3, 2, '#cfe8f1'); }
    px(c, 0, 0, '#5d8fa6', 2, H - 6); px(c, W - 2, 0, '#5d8fa6', 2, H - 6);
  },

  /** stone steps cut into a rock face; one tile (16x16), drawn flat */
  stonestairs(c, W, H) {
    px(c, 0, 0, '#6d5f52', W, H);
    for (let y = 0; y < H; y += 4) {
      px(c, 1, y, '#c4b8a4', W - 2, 3); px(c, 1, y, '#e2d8c4', W - 2, 1); px(c, 1, y + 3, '#7f7365', W - 2, 1);
    }
    px(c, 0, 0, '#4f4439', 1, H); px(c, W - 1, 0, '#4f4439', 1, H);
  },
};
