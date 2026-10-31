/**
 * Pixel-art building blocks for the three raccoons (trio.ts): pixel-centre shapes, cel shading (a light rim at the top-left, a
 * shade rim at the bottom-right, no gradients), a fat ringed tail along a curve, and layer stacking with a 1px ink contour per
 * part, like folk.ts. Shapes use whole pixel centres and radii wherever possible, so edges fall between pixels and stay crisp.
 */
import { ctx2d, ctx2dRead, makeCanvas, px, shade, type Ctx } from './pixel';

export type Mask = (x: number, y: number) => boolean;

/** pixel-centre ellipse; p > 2 squares the corners a little (plush cheeks) */
export const ell = (cx: number, cy: number, rx: number, ry: number, p = 2): Mask => (x, y) => Math.pow(Math.abs(x - cx) / rx, p) + Math.pow(Math.abs(y - cy) / ry, p) <= 1;
export const box = (x0: number, y0: number, x1: number, y1: number): Mask => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

const toneCache = new Map<string, string>();
export const tone = (c: string, a: number) => {
  const k = c + a;
  let v = toneCache.get(k);
  if (!v) toneCache.set(k, (v = shade(c, a)));
  return v;
};

export interface Paint { lt?: number; dk?: number; l?: number; d?: number; pick?: (x: number, y: number) => string | null }

/** Fills a mask with a base colour, a light rim at the top-left and a shade rim at the bottom-right. */
export function blob(g: Ctx, W: number, H: number, m: Mask, base: string, o: Paint = {}) {
  const l = o.l ?? 1.5;
  const d = o.d ?? 1.6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (!m(cx, cy)) continue;
      const col = o.pick?.(cx, cy) ?? base;
      let out = col;
      if (o.lt !== undefined && !m(cx + l, cy + l * 0.85)) out = tone(col, o.lt);
      else if (o.dk !== undefined && !m(cx - d, cy - d * 0.85)) out = tone(col, o.dk);
      px(g, x, y, out);
    }
  }
}

/** A fat tail along a curve: thicker in the middle, round tip, alternating rings. */
export function tailMask(p0: [number, number], p1: [number, number], p2: [number, number], r0: number, rMax: number, rTip: number) {
  const pts: { x: number; y: number; r: number; t: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    // base -> belly of the tail -> rounded tip
    const r = t < 0.55 ? r0 + (rMax - r0) * Math.sin((t / 0.55) * Math.PI * 0.5) : rMax + (rTip - rMax) * Math.pow((t - 0.55) / 0.45, 1.6);
    pts.push({ x, y, r, t });
  }
  const nearest = (x: number, y: number) => {
    let best = Infinity;
    let bt = 0;
    for (const p of pts) {
      const dd = Math.hypot(x - p.x, y - p.y) - p.r;
      if (dd < best) { best = dd; bt = p.t; }
    }
    return { d: best, t: bt };
  };
  const mask: Mask = (x, y) => nearest(x, y).d <= 0;
  const band = (x: number, y: number) => nearest(x, y).t;
  return { mask, band };
}

// ------------------------------------------------------------------ assembling
export type Layer = (g: Ctx) => void;

export function stack(W: number, H: number, ink: string, layers: Layer[], after: (g: Ctx) => void): HTMLCanvasElement {
  const out = makeCanvas(W, H);
  const o = ctx2d(out);
  for (const l of layers) {
    const cv = makeCanvas(W, H);
    const g = ctx2dRead(cv);
    l(g);
    const img = g.getImageData(0, 0, W, H);
    const a = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > 0;
    const pts: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push(x, y);
    g.fillStyle = ink;
    for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
    o.drawImage(cv, 0, 0);
  }
  after(o);
  return out;
}

export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
