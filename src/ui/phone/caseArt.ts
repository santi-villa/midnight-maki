/**
 * Pixel-art body of the NoriPhone. It is drawn at its own small resolution ("phone pixels") and shown
 * scaled by a whole number, so every edge stays crisp. The screen is a transparent hole: the real interface sits behind it.
 */
import { px, shade, type Ctx } from '../../art/pixel';
import type { ColorDef, ModelDef } from './catalog';

/** Transparent margin left and right of the body, for the side buttons. */
export const SIDE_MARGIN = 2;

export interface CaseGeo {
  Wc: number;
  Hc: number;
  /** screen rectangle in phone pixels */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function caseGeometry(m: ModelDef, Wc: number, Hc: number): CaseGeo {
  const sx = SIDE_MARGIN + m.bezel.side;
  return { Wc, Hc, sx, sy: m.bezel.top, sw: Wc - sx * 2, sh: Hc - m.bezel.top - m.bezel.bottom };
}

/** Horizontal inset of row `y` for a rectangle of height `h` with rounded corners of radius `r`. */
function inset(y: number, h: number, r: number): number {
  const d = y < r ? r - y - 0.5 : y >= h - r ? y - (h - r) + 0.5 : -1;
  if (d < 0) return 0;
  return Math.max(0, Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))));
}

function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number, col: string) {
  for (let j = 0; j < h; j++) {
    const i = inset(j, h, r);
    px(g, x + i, y + j, col, w - i * 2, 1);
  }
}

function clearRrect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  for (let j = 0; j < h; j++) {
    const i = inset(j, h, r);
    g.clearRect(x + i, y + j, w - i * 2, 1);
  }
}

function star(g: Ctx, cx: number, cy: number, col: string) {
  px(g, cx, cy - 1, col, 1, 3);
  px(g, cx - 1, cy, col, 3, 1);
}

export function drawCase(canvas: HTMLCanvasElement, m: ModelDef, color: ColorDef, Wc: number, Hc: number) {
  canvas.width = Wc;
  canvas.height = Hc;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, Wc, Hc);
  const geo = caseGeometry(m, Wc, Hc);
  const base = color.body;
  const edge = shade(base, -0.62);
  const hi = shade(base, 0.3);
  const lo = shade(base, -0.2);
  const bx = SIDE_MARGIN;
  const bw = Wc - SIDE_MARGIN * 2;
  // side buttons first, so the body overlaps their roots
  const btn = shade(base, -0.3);
  px(g, bx - 1, Math.round(Hc * 0.2), edge, 2, 7);
  px(g, bx - 1, Math.round(Hc * 0.2) + 1, btn, 1, 5);
  px(g, bx - 1, Math.round(Hc * 0.2) + 10, edge, 2, 7);
  px(g, bx - 1, Math.round(Hc * 0.2) + 11, btn, 1, 5);
  px(g, bx + bw - 1, Math.round(Hc * 0.28), edge, 2, 10);
  px(g, bx + bw, Math.round(Hc * 0.28) + 1, btn, 1, 8);
  // body: outline, fill, light from the top-left
  rrect(g, bx, 0, bw, Hc, m.radius, edge);
  rrect(g, bx + 1, 1, bw - 2, Hc - 2, Math.max(1, m.radius - 1), base);
  px(g, bx + m.radius + 1, 1, hi, bw - m.radius * 2 - 2, 1);
  px(g, bx + 1, m.radius + 1, hi, 1, Hc - m.radius * 2 - 2);
  px(g, bx + m.radius + 1, Hc - 2, lo, bw - m.radius * 2 - 2, 1);
  px(g, bx + bw - 2, m.radius + 1, lo, 1, Hc - m.radius * 2 - 2);
  // a soft reflection across the top bezel
  px(g, bx + m.radius + 2, 2, shade(base, 0.5), 3, 1);
  px(g, bx + m.radius + 6, 2, shade(base, 0.38), 1, 1);
  // screen hole with a thin dark rim
  rrect(g, geo.sx - 1, geo.sy - 1, geo.sw + 2, geo.sh + 2, m.screenRadius + 1, shade(base, -0.58));
  clearRrect(g, geo.sx, geo.sy, geo.sw, geo.sh, m.screenRadius);
  // speaker and camera
  const cx = Math.round(Wc / 2);
  const ty = Math.max(2, Math.round(m.bezel.top / 2) - 1);
  const dark = shade(base, -0.6);
  const slot = (w: number) => {
    px(g, cx - Math.floor(w / 2), ty, dark, w, 2);
    px(g, cx - Math.floor(w / 2) + 1, ty + 2, hi, w - 2, 1);
  };
  const lens = (x: number, y: number, size: number, col = '#2a3a66') => {
    px(g, x - 1, y - 1, dark, size + 2, size + 2);
    px(g, x, y, col, size, size);
    px(g, x, y, '#a9c4ff', 1, 1);
  };
  switch (m.speaker) {
    case 'slot': slot(14); break;
    case 'short': slot(8); break;
    case 'thin': px(g, cx - 5, ty + 1, dark, 10, 1); break;
    case 'star': slot(6); star(g, cx - 8, ty + 1, '#ffe38a'); break;
  }
  switch (m.camera) {
    case 'dot': lens(cx + 11, ty, 3); break;
    case 'small': lens(cx + 8, ty, 2); break;
    case 'punch': lens(cx + 9, ty, 2, '#1b2448'); break;
    case 'moon': lens(cx + 9, ty, 2, '#4a3b78'); px(g, cx + 12, ty - 1, '#ffe38a', 1, 1); break;
  }
  // little marks of the colour edition on the bezel
  const bottomY = Hc - Math.round(m.bezel.bottom / 2) - 1;
  switch (color.deco) {
    case 'petals':
      for (const [x, y] of [[bx + 2, 14], [bx + bw - 4, 30], [bx + 3, Math.round(Hc * 0.6)], [bx + bw - 5, Math.round(Hc * 0.8)], [cx + 14, bottomY]]) {
        px(g, x, y, '#ffffff', 2, 1);
        px(g, x, y + 1, '#e88aa6', 2, 1);
      }
      break;
    case 'stars':
      for (const [x, y] of [[bx + 3, 18], [bx + bw - 4, 24], [cx - 12, bottomY], [cx + 12, bottomY], [bx + 3, Math.round(Hc * 0.7)]]) star(g, x, y, '#ffe38a');
      break;
    case 'pip':
      for (const sx of [bx + m.radius, bx + bw - m.radius - 4]) {
        px(g, sx, 0, '#55545e', 4, 2);
        px(g, sx + 1, 1, '#ecebef', 2, 1);
      }
      px(g, cx - 2, bottomY, '#55545e', 5, 3);
      px(g, cx - 3, bottomY - 1, '#55545e', 1, 1);
      px(g, cx + 3, bottomY - 1, '#55545e', 1, 1);
      break;
    case 'spicy':
      px(g, cx - 3, bottomY, '#e0403a', 5, 2);
      px(g, cx + 2, bottomY - 1, '#e0403a', 2, 1);
      px(g, cx + 3, bottomY - 2, '#5f8a47', 1, 1);
      px(g, cx - 3, bottomY, '#ff8a6a', 2, 1);
      break;
    case 'rigg':
      px(g, cx - 3, bottomY - 1, '#2c3a52', 7, 4);
      px(g, cx - 2, bottomY, '#f6ecd6', 2, 2);
      px(g, cx + 1, bottomY, '#e58f98', 2, 2);
      break;
  }
}
