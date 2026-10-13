/** Villa Nori's two-tier stone fountain, drawn directly in the game's pixel grid. */
import { ellipse, px, type Ctx } from './pixel';

export function drawFountain(c: Ctx, W: number, H: number) {
  const cx = Math.floor(W / 2);
  const top = H - 56;
  const ink = '#332d3c';
  const stone = '#a7a4b5';
  const stoneLight = '#d2c5c9';
  const stoneShade = '#77788e';
  const water = '#397caa';
  const waterLight = '#80b6cf';

  // Scanline octagons keep the diagonal corners crisp, without canvas antialiasing.
  const octagon = (x: number, y: number, w: number, h: number, corner: number, color: string) => {
    for (let row = 0; row < h; row++) {
      const inset = Math.max(0, corner - row, corner - (h - 1 - row));
      px(c, x + inset, top + y + row, color, w - inset * 2, 1);
    }
  };

  // Three stone courses beneath a thick octagonal basin.
  octagon(cx - 22, 25, 44, 29, 9, ink);
  octagon(cx - 21, 25, 42, 27, 8, '#676579');
  octagon(cx - 22, 23, 44, 28, 9, ink);
  octagon(cx - 21, 23, 42, 26, 8, stoneShade);
  octagon(cx - 22, 21, 44, 27, 9, ink);
  octagon(cx - 21, 21, 42, 25, 8, stone);
  octagon(cx - 20, 21, 40, 23, 8, stoneLight);
  octagon(cx - 18, 23, 36, 20, 7, '#696f89');
  octagon(cx - 17, 24, 34, 18, 6, '#9da4b8');
  octagon(cx - 15, 25, 30, 15, 5, water);
  octagon(cx - 14, 26, 28, 12, 4, '#4388b5');
  px(c, cx - 11, top + 39, '#7ba5bc', 22, 1);
  px(c, cx - 12, top + 45, '#c4b7bc', 24, 1);
  px(c, cx - 12, top + 49, '#9191a4', 24, 1);
  px(c, cx - 12, top + 52, '#4e4b5e', 24, 1);

  // Ripples around the fluted central pedestal.
  ellipse(c, cx, top + 35, 11, 4, '#33729d');
  px(c, cx - 12, top + 34, waterLight, 3, 1);
  px(c, cx + 9, top + 36, '#74a4c0', 3, 1);
  ellipse(c, cx, top + 37, 7, 3, '#586984');
  px(c, cx - 5, top + 28, '#687a97', 10, 9);
  px(c, cx - 4, top + 29, '#94a8bb', 2, 7);
  px(c, cx - 1, top + 29, '#a7b8c7', 2, 8);
  px(c, cx + 3, top + 29, '#4b617f', 2, 7);
  ellipse(c, cx, top + 35, 5, 2, '#7b91a9');

  // Lower bowl and the curtain of water spilling into the main basin.
  ellipse(c, cx, top + 27, 11, 6, ink);
  ellipse(c, cx, top + 26, 10, 5, stoneShade);
  ellipse(c, cx, top + 24, 11, 5, stoneLight);
  ellipse(c, cx, top + 24, 9, 3, '#567990');
  ellipse(c, cx, top + 23, 8, 2, '#68a5c6');
  for (const dx of [-8, -5, 5, 8]) {
    px(c, cx + dx, top + 26, '#82b5cf', 1, 7);
    px(c, cx + dx, top + 31, '#b4d0dd', 1, 2);
  }
  px(c, cx - 6, top + 29, '#b8b4c5', 12, 1);

  // Slender upper column and the smaller bowl.
  px(c, cx - 4, top + 12, ink, 9, 12);
  px(c, cx - 3, top + 13, '#7488a1', 7, 10);
  px(c, cx - 2, top + 13, '#b0bdcc', 2, 9);
  px(c, cx + 2, top + 13, '#526e8c', 1, 10);
  ellipse(c, cx, top + 22, 4, 2, '#8ea6bd');
  ellipse(c, cx, top + 12, 8, 5, ink);
  ellipse(c, cx, top + 12, 7, 4, stoneShade);
  ellipse(c, cx, top + 10, 8, 4, stoneLight);
  ellipse(c, cx, top + 10, 6, 2, '#4779a1');
  px(c, cx - 6, top + 11, '#91bdd2', 1, 8);
  px(c, cx + 6, top + 11, '#78a7c6', 1, 8);
  px(c, cx - 4, top + 14, '#c1bbc8', 8, 1);

  // Small sparkling jet, still recognizable with particle effects disabled.
  px(c, cx - 2, top + 5, '#477b9c', 5, 6);
  px(c, cx - 2, top + 5, '#8ec0d8', 1, 5);
  px(c, cx + 1, top + 4, '#c8e2e8', 1, 6);
  px(c, cx, top + 2, '#91bdd3', 1, 8);
  px(c, cx, top + 1, '#e4f1ee');
  px(c, cx - 3, top + 4, '#b8d9e2');
  px(c, cx + 3, top + 5, '#8db8d0');
}
