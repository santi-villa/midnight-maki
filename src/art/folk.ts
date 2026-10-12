/**
 * "Folk" renderer: the detailed pixel-art villagers (animal folk and people) of the second art direction.
 * Frames are FOLK_W x FOLK_H (32x44) with the feet on the last rows. Each character is a data spec (species shape,
 * fur palette, outfit, accessories); the same code draws every direction, walking frame and expression.
 *
 * Each body part is drawn flat on its own canvas with a 3-tone shading pass (light top-left, shade bottom-right),
 * gets its own 1px dark contour and is stacked, so heads, ears, arms and tails separate like in the reference art.
 */
import type { Dir } from '../core/types';
import { ctx2d, makeCanvas, mix, px, shade, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';

export const FOLK_W = 32;
export const FOLK_H = 52;
/** Empty rows above the 44-row figure: room for tall ears and hats. */
export const FOLK_PAD = 8;
const AX = 16; // symmetry axis (a pixel boundary)

export type FolkExpr = 'neutral' | 'blink' | 'happy' | 'surprised' | 'sad' | 'smug' | 'sleep';
export type FolkArms = 'cook1' | 'cook2' | 'wave1' | 'wave2' | 'read';
export interface FolkPose { dir: Dir; legs: 'idle' | 'a' | 'b'; expr: FolkExpr; bob?: number; arms?: FolkArms; sit?: boolean }

// ------------------------------------------------------------------ spec
export type EarKind = 'pointy' | 'round' | 'long' | 'cat' | 'none';
export type TailKind = 'bushy' | 'ringed' | 'thin' | 'puff' | 'nub' | 'none';
export type HatKind = 'none' | 'bandana' | 'straw' | 'witch' | 'chef' | 'cap' | 'beret' | 'bow';
export type HairKind = 'none' | 'bob' | 'bun' | 'short' | 'bald';

export type Deco =
  | { k: 'apron'; c: string; c2?: string }
  | { k: 'bib'; c: string; strap: string }
  | { k: 'collar'; c: string }
  | { k: 'bowtie'; c: string }
  | { k: 'buttons'; c: string }
  | { k: 'necklace'; c: string }
  | { k: 'vest'; c: string; inner: string }
  | { k: 'strap'; c: string; bag?: string }
  | { k: 'shawl'; c: string }
  | { k: 'belt'; c: string }
  | { k: 'robeTrim'; c: string };

/** Wardrobe override: a hat / body item picked by the player replaces the character's own. */
export interface FolkCustom {
  head?: { kind: string; c1: string; c2: string };
  extra?: { kind: string; c1: string; c2: string };
}

export interface FolkSpec {
  id: string;
  ears: EarKind;
  fur: string; // main fur / skin colour
  furLight?: string; // muzzle / belly colour
  innerEar?: string;
  mask?: string; // raccoon mask colour
  nose: string;
  eye: string;
  blush?: string;
  headMark?: string; // forehead stripe etc.
  hat?: { kind: HatKind; c: string; c2?: string };
  hair?: { kind: HairKind; c: string; c2?: string };
  glasses?: string;
  beard?: string;
  ink?: string;
  tail?: { kind: TailKind; c?: string; tip?: string };
  top: string; // torso colour
  topLight?: string;
  legsColor: string; // trousers (or fur when same as fur)
  legs: 'pants' | 'skirt' | 'robe' | 'fur';
  skirtC?: string;
  shoes: string;
  deco?: Deco[];
  wide?: number; // extra body width (Pip)
  humanEars?: boolean;
}

// ------------------------------------------------------------------ shading primitives
type Test = (x: number, y: number) => boolean;
interface Box { x0: number; y0: number; x1: number; y1: number }

/** Fills the pixels where `inside` holds, in 3 tones decided by the position inside the box. */
function fill(c: Ctx, box: Box, inside: Test, base: string, o: { lt?: string; dk?: string; flat?: boolean } = {}) {
  const lt = o.lt ?? shade(base, 0.2);
  const dk = o.dk ?? shade(base, -0.2);
  const w = Math.max(1, box.x1 - box.x0);
  const h = Math.max(1, box.y1 - box.y0);
  for (let y = Math.floor(box.y0); y < Math.ceil(box.y1); y++)
    for (let x = Math.floor(box.x0); x < Math.ceil(box.x1); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const u = (x + 0.5 - box.x0) / w; // 0..1
      const v = (y + 0.5 - box.y0) / h;
      let col = base;
      if (!o.flat) {
        if (v > 0.74 || (u > 0.8 && v > 0.35)) col = dk;
        else if (u + v < 0.62 && v < 0.55) col = lt;
      }
      px(c, x, y, col);
    }
}

const ell = (cx: number, cy: number, rx: number, ry: number, p = 2): Test => (x, y) => Math.pow(Math.abs(x - cx) / rx, p) + Math.pow(Math.abs(y - cy) / ry, p) <= 1;
const rect = (x0: number, y0: number, x1: number, y1: number): Test => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Test => (x, y) => {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
  const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
  return l1 >= 0 && l2 >= 0 && l1 + l2 <= 1;
};
const boxOf = (cx: number, cy: number, rx: number, ry: number): Box => ({ x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry });

const dot = (c: Ctx, x: number, y: number, col: string, w = 1, h = 1) => px(c, Math.round(x), Math.round(y), col, w, h);

/** each part on its own canvas, 1px contour, stacked */
function stack(spec: FolkSpec, layers: ((c: Ctx) => void)[], after?: (c: Ctx) => void): HTMLCanvasElement {
  const out = makeCanvas(FOLK_W, FOLK_H);
  const o = ctx2d(out);
  const ink = spec.ink ?? '#2c2230';
  for (const l of layers) {
    const cv = makeCanvas(FOLK_W, FOLK_H);
    const g = ctx2d(cv);
    g.translate(0, FOLK_PAD);
    l(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // contour
    const img = g.getImageData(0, 0, FOLK_W, FOLK_H);
    const a = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < FOLK_W && y < FOLK_H && a[(y * FOLK_W + x) * 4 + 3] > 0;
    const pts: number[] = [];
    for (let y = 0; y < FOLK_H; y++)
      for (let x = 0; x < FOLK_W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push(x, y);
    g.fillStyle = ink;
    for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
    o.drawImage(cv, 0, 0);
  }
  o.save();
  o.translate(0, FOLK_PAD);
  after?.(o);
  o.restore();
  return out;
}

function mirrorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

let CUSTOM: FolkCustom | undefined;

// ------------------------------------------------------------------ geometry
interface Geo {
  dy: number; // upper body offset (bob / sit)
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  torsoTop: number;
  torsoBot: number;
  hw: number; // torso half width
  legTop: number;
}

function geo(spec: FolkSpec, pose: FolkPose, side: boolean): Geo {
  const dy = (pose.bob ?? 0) + (pose.sit ? 4 : 0);
  return {
    dy,
    headCx: side ? AX + 0.5 : AX,
    headCy: 17.4 + dy,
    headRx: side ? 10 : 11.2,
    headRy: 8.7,
    torsoTop: 25 + dy,
    torsoBot: 35 + (pose.sit ? 3 : 0) + (pose.sit ? 0 : 0),
    hw: (side ? 5 : 6.4) + (spec.wide ?? 0) * (side ? 0.6 : 1),
    legTop: 34 + (pose.sit ? 3 : 0),
  };
}

// ------------------------------------------------------------------ ears
function earsLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  if (spec.ears === 'none') return;
  const { headCx: cx, headCy: cy } = g;
  const inner = spec.innerEar ?? shade(spec.fur, 0.35);
  const sides = view === 'side' ? [-1] : [-1, 1];
  const shift = view === 'side' ? -4.5 : 0;
  for (const s of sides) {
    const ex = cx + s * (view === 'side' ? 0 : 7.2) + shift;
    if (spec.ears === 'round') {
      const bx = view === 'side' ? cx - 3 : ex;
      const by = cy - 7.8;
      fill(c, boxOf(bx, by, 3.7, 3.5), ell(bx, by, 3.7, 3.5), spec.fur);
      if (view !== 'back') fill(c, boxOf(bx, by + 0.4, 2, 2), ell(bx, by + 0.4, 2, 2), inner, { flat: true });
    } else if (spec.ears === 'pointy' || spec.ears === 'cat') {
      const out = spec.ears === 'cat' ? 8.8 : 9.4;
      const bx = view === 'side' ? cx - 3 : ex;
      const lean = view === 'side' ? 1 : s * 1.6;
      const top = cy - 15.2;
      const t = tri(bx - 4.4, cy - 6.4, bx + 4.4, cy - 6.4, bx + lean * 1.4, top);
      fill(c, { x0: bx - 4.6, y0: top, x1: bx + 4.6, y1: cy - 5 }, t, spec.fur);
      void out;
      if (view !== 'back') fill(c, { x0: bx - 2.6, y0: top + 3, x1: bx + 2.6, y1: cy - 6 }, tri(bx - 2.4, cy - 6.4, bx + 2.4, cy - 6.4, bx + lean, top + 3.4), inner, { flat: true });
    } else if (spec.ears === 'long') {
      const bx = view === 'side' ? cx - 3.5 : ex - s * 1.2;
      for (let k = 0; k < 2; k++) {
        const ox = view === 'side' ? k * -3.2 : 0;
        if (view === 'side' && k === 1) break;
        const lean = view === 'side' ? -1.6 : s * 0.7;
        const test: Test = (x, y) => {
          const t = (cy - 7 - y) / 15; // 0 at head, 1 at tip
          const x0 = bx + ox + lean * t * 4;
          const half = 3.1 * (1 - Math.pow(t, 3) * 0.55);
          return y <= cy - 6 && y >= cy - 22.5 && Math.abs(x - x0) <= half && t <= 1;
        };
        fill(c, { x0: bx - 8, y0: cy - 22, x1: bx + 8, y1: cy - 6 }, test, spec.fur);
        if (view !== 'back') {
          const t2: Test = (x, y) => {
            const t = (cy - 7 - y) / 14;
            const x0 = bx + ox + lean * t * 4;
            return y <= cy - 7 && y >= cy - 19 && Math.abs(x - x0) <= 1.7 * (1 - t * 0.5);
          };
          fill(c, { x0: bx - 8, y0: cy - 22, x1: bx + 8, y1: cy - 6 }, t2, inner, { flat: true });
        }
      }
    }
  }
}

// ------------------------------------------------------------------ face
function faceFront(spec: FolkSpec, g: Geo, expr: FolkExpr, c: Ctx) {
  const { headCx: cx, headCy: cy } = g;
  const eyeCol = spec.eye;
  const ey = Math.round(cy - 1.6);
  const gap = 4.9;
  const mask = spec.mask;
  if (mask) {
    for (const s of [-1, 1]) {
      const mx = cx + s * 5.6;
      fill(c, boxOf(mx, ey + 1.3, 4.6, 3.3), ell(mx, ey + 1.3, 4.6, 3.3, 2.2), mask, { flat: true });
    }
    fill(c, boxOf(cx, ey + 0.5, 1.6, 2.6), rect(cx - 1.6, ey - 1, cx + 1.6, ey + 3), mask, { flat: true });
  }
  // muzzle
  if (spec.furLight) {
    fill(c, boxOf(cx, cy + 5.2, 5.4, 3.6), ell(cx, cy + 5.2, 5.4, 3.6, 2.2), spec.furLight, { lt: shade(spec.furLight, 0.1), dk: shade(spec.furLight, -0.1) });
  }
  if (spec.headMark) fill(c, boxOf(cx, cy - 7, 1.6, 2.5), rect(cx - 1.6, cy - 9, cx + 1.6, cy - 5), spec.headMark, { flat: true });
  // eyes
  const eyeX = [cx - gap, cx + gap];
  for (let i = 0; i < 2; i++) {
    const ex = Math.round(eyeX[i] - 1);
    const sign = i === 0 ? -1 : 1;
    switch (expr) {
      case 'blink':
      case 'sleep':
        dot(c, ex - 1, ey + 2, eyeCol, 4, 1);
        break;
      case 'happy':
        dot(c, ex - 1, ey + 2, eyeCol, 1, 1);
        dot(c, ex, ey + 1, eyeCol, 2, 1);
        dot(c, ex + 2, ey + 2, eyeCol, 1, 1);
        break;
      case 'surprised':
        dot(c, ex - 1, ey - 1, eyeCol, 4, 5);
        dot(c, ex, ey, '#ffffff', 1, 1);
        break;
      case 'sad':
        dot(c, ex, ey, eyeCol, 2, 4);
        dot(c, ex, ey, '#ffffff', 1, 1);
        dot(c, ex - 1 + (sign > 0 ? 0 : 0), ey - 2 + (sign < 0 ? 1 : 0), eyeCol, 3, 1);
        break;
      case 'smug':
        dot(c, ex, ey + 1, eyeCol, 2, 3);
        dot(c, ex - 1, ey + 1, eyeCol, 4, 1);
        dot(c, ex, ey + 1, shade(spec.fur, -0.1), 2, 1);
        break;
      default:
        dot(c, ex - (sign < 0 ? 1 : 0), ey, eyeCol, 3, 4);
        dot(c, ex - (sign < 0 ? 1 : 0), ey, '#ffffff', 1, 1);
        dot(c, ex - (sign < 0 ? 1 : 0) + 2, ey + 3, shade(eyeCol, 0.25), 1, 1);
    }
  }
  if (spec.blush && expr !== 'sad') for (const s of [-1, 1]) dot(c, cx + s * 8.2 - 1.5, ey + 4, spec.blush, 3, 2);
  // nose + mouth
  const ny = Math.round(cy + 3.4);
  dot(c, cx - 1, ny, spec.nose, 2, 1);
  dot(c, cx - 1, ny + 1, shade(spec.nose, 0.1), 2, 1);
  const my = ny + 2;
  const mc = shade(spec.nose, -0.1);
  if (expr === 'happy') {
    dot(c, cx - 2, my, mc);
    dot(c, cx + 1, my, mc);
    dot(c, cx - 1, my + 1, mc, 2, 1);
  } else if (expr === 'surprised') dot(c, cx - 1, my, mc, 2, 2);
  else if (expr === 'sad') {
    dot(c, cx - 1, my, mc, 2, 1);
    dot(c, cx - 2, my + 1, mc);
    dot(c, cx + 1, my + 1, mc);
  } else if (expr === 'smug') {
    dot(c, cx - 1, my, mc, 3, 1);
    dot(c, cx + 2, my - 1, mc);
  } else {
    dot(c, cx - 2, my, mc);
    dot(c, cx - 1, my + 1, mc);
    dot(c, cx, my + 1, mc);
    dot(c, cx + 1, my, mc);
  }
  if (spec.glasses) {
    for (const ex of eyeX) {
      const x0 = Math.round(ex - 3);
      px(c, x0, ey - 1, spec.glasses, 6, 1);
      px(c, x0, ey + 4, spec.glasses, 6, 1);
      px(c, x0, ey - 1, spec.glasses, 1, 6);
      px(c, x0 + 5, ey - 1, spec.glasses, 1, 6);
    }
    px(c, Math.round(cx - 1), ey + 1, spec.glasses, 2, 1);
  }
}

function faceSide(spec: FolkSpec, g: Geo, expr: FolkExpr, c: Ctx) {
  const { headCx: cx, headCy: cy } = g;
  const ey = Math.round(cy - 1.4);
  const ex = Math.round(cx + 4.2);
  if (spec.mask) fill(c, boxOf(ex + 0.5, ey + 1.3, 4.2, 3.3), ell(ex + 0.5, ey + 1.3, 4.2, 3.3, 2.2), spec.mask, { flat: true });
  if (spec.furLight) fill(c, boxOf(cx + 6.6, cy + 4.6, 4.2, 3), ell(cx + 6.6, cy + 4.6, 4.2, 3, 2.2), spec.furLight, { lt: shade(spec.furLight, 0.1), dk: shade(spec.furLight, -0.1) });
  if (spec.headMark) dot(c, cx + 3, cy - 9, spec.headMark, 3, 3);
  if (expr === 'blink' || expr === 'sleep') dot(c, ex - 1, ey + 2, spec.eye, 3, 1);
  else if (expr === 'happy') {
    dot(c, ex - 1, ey + 2, spec.eye);
    dot(c, ex, ey + 1, spec.eye, 2, 1);
    dot(c, ex + 2, ey + 2, spec.eye);
  } else {
    dot(c, ex, ey, spec.eye, 2, expr === 'surprised' ? 5 : 4);
    dot(c, ex, ey, '#ffffff', 1, 1);
  }
  if (spec.blush) dot(c, ex - 2, ey + 4, spec.blush, 3, 2);
  dot(c, cx + 9.4, Math.round(cy + 3.2), spec.nose, 2, 2);
  dot(c, cx + 7, Math.round(cy + 6.4), shade(spec.nose, -0.1), 2, 1);
  if (spec.glasses) {
    px(c, ex - 2, ey - 1, spec.glasses, 6, 1);
    px(c, ex - 2, ey + 4, spec.glasses, 6, 1);
    px(c, ex - 2, ey - 1, spec.glasses, 1, 6);
    px(c, ex + 3, ey - 1, spec.glasses, 1, 6);
  }
}

// ------------------------------------------------------------------ hair (people) and hats
function hairLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  const h = spec.hair;
  if (!h || h.kind === 'none') return;
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const col = h.c;
  const lt = h.c2 ?? shade(h.c, 0.22);
  if (h.kind === 'bald') return;
  if (h.kind === 'bun') {
    fill(c, boxOf(cx, cy - 11.4, 4.3, 3.6), ell(cx, cy - 11.4, 4.3, 3.6), col, { lt });
    const top: Test = (x, y) => ell(cx, cy, rx + 0.4, ry + 0.4, 2.4)(x, y) && y < cy - 2.2;
    fill(c, { x0: cx - rx, y0: cy - ry - 1, x1: cx + rx, y1: cy - 1 }, top, col, { lt });
    if (view !== 'back')
      for (const s of [-1, 1]) fill(c, { x0: cx + s * rx - 2.4, y0: cy - 3, x1: cx + s * rx + 2.4, y1: cy + 6 }, rect(cx + s * rx - (s > 0 ? 3 : 1.9), cy - 3, cx + s * rx + (s > 0 ? 1.9 : 3), cy + 6.5), col, { lt });
    if (view === 'back') fill(c, boxOf(cx, cy + 1, rx, ry - 1), ell(cx, cy + 1, rx, ry - 0.8, 2.4), col, { lt });
    return;
  }
  if (h.kind === 'short') {
    const top: Test = (x, y) => ell(cx, cy, rx + 0.5, ry + 0.5, 2.4)(x, y) && (y < cy - 3.4 || (view === 'back' && y < cy + 4));
    fill(c, { x0: cx - rx - 1, y0: cy - ry - 1, x1: cx + rx + 1, y1: cy + 6 }, top, col, { lt });
    if (view !== 'back') for (const s of [-1, 1]) fill(c, { x0: cx + s * rx - 2, y0: cy - 4, x1: cx + s * rx + 2, y1: cy + 4 }, rect(cx + s * (rx - 0.6) - (s > 0 ? 1.2 : 0.6), cy - 4, cx + s * (rx - 0.6) + (s > 0 ? 0.6 : 1.2), cy + 3), col, { lt });
    return;
  }
  // bob: side-swept fringe, hair down to the jaw
  const outer: Test = (x, y) => ell(cx, cy, rx + 0.9, ry + 0.9, 2.4)(x, y) && (y < cy - 1.4 || (view === 'back' && y < cy + 7) || Math.abs(x - cx) > rx - 1.8);
  fill(c, { x0: cx - rx - 1, y0: cy - ry - 1, x1: cx + rx + 1, y1: cy + 8 }, outer, col, { lt });
  if (view === 'front') {
    const cut: Test = (x, y) => y > cy - 4 && y < cy + 4 && Math.abs(x - cx) < rx - 3;
    // face window is drawn after (face layer sits on top), so only trim the fringe diagonal
    void cut;
  }
}

function hatLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  const hat = CUSTOM?.head ? undefined : spec.hat;
  if (CUSTOM?.head) {
    const t = g.headCy - g.headRy;
    headAcc(c, CUSTOM.head.kind, CUSTOM.head.c1, CUSTOM.head.c2, g.headCx, Math.round(t) + 1, 9, view);
    return;
  }
  if (!hat || hat.kind === 'none') return;
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const col = hat.c;
  const c2 = hat.c2 ?? shade(col, -0.25);
  const top = cy - ry;
  switch (hat.kind) {
    case 'bandana': {
      const band: Test = (x, y) => ell(cx, cy, rx + 0.4, ry + 0.4, 2.4)(x, y) && y >= top + 1 && y < top + 5.4;
      fill(c, { x0: cx - rx - 1, y0: top, x1: cx + rx + 1, y1: top + 6 }, band, col);
      if (view !== 'back') {
        // knot with two tails on the right
        const kx = view === 'side' ? cx - rx + 0.5 : cx + rx - 0.5;
        fill(c, boxOf(kx + 2, top + 3, 3, 1.6), rect(kx - 1, top + 2, kx + 5, top + 5), c2, { flat: true });
        fill(c, boxOf(kx + 3, top + 6, 2, 2.5), tri(kx + 1, top + 4, kx + 5, top + 4, kx + 3, top + 9), col, { flat: true });
        fill(c, boxOf(kx + 5, top + 5, 2, 2.5), tri(kx + 3, top + 4, kx + 7, top + 5, kx + 5, top + 8), c2, { flat: true });
      }
      break;
    }
    case 'straw': {
      fill(c, { x0: cx - rx - 3, y0: top - 3, x1: cx + rx + 3, y1: top + 4 }, ell(cx, top + 2.4, rx + 3.2, 3.2, 2), col, { lt: shade(col, 0.2) });
      fill(c, boxOf(cx, top - 1.2, 6.2, 3.6), ell(cx, top - 0.5, 6.2, 4.2, 2.4), col, { lt: shade(col, 0.2) });
      fill(c, { x0: cx - 6.4, y0: top + 0.2, x1: cx + 6.4, y1: top + 2.4 }, rect(cx - 6.4, top + 0.6, cx + 6.4, top + 2.4), c2, { flat: true });
      break;
    }
    case 'witch': {
      fill(c, { x0: cx - rx - 3, y0: top - 1, x1: cx + rx + 3, y1: top + 5 }, ell(cx, top + 2.2, rx + 3.6, 2.8, 2), col);
      const cone = tri(cx - 6.8, top + 2, cx + 6.8, top + 2, cx + 1.5, top - 14);
      fill(c, { x0: cx - 7, y0: top - 14, x1: cx + 7, y1: top + 3 }, cone, col);
      fill(c, { x0: cx - 7, y0: top - 1, x1: cx + 7, y1: top + 3 }, rect(cx - 7, top, cx + 7, top + 2.4), c2, { flat: true });
      dot(c, cx + 1, top + 0.5, '#f2c66d', 2, 2);
      break;
    }
    case 'chef': {
      fill(c, boxOf(cx, top - 3.4, 6.6, 4.2), ell(cx, top - 3.4, 6.6, 4.4, 2.2), col, { lt: '#ffffff', dk: shade(col, -0.12) });
      fill(c, { x0: cx - 5.6, y0: top, x1: cx + 5.6, y1: top + 3 }, rect(cx - 5.6, top - 0.4, cx + 5.6, top + 2.4), c2, { flat: true });
      break;
    }
    case 'cap': {
      fill(c, { x0: cx - rx, y0: top - 3, x1: cx + rx, y1: top + 4 }, (x, y) => ell(cx, cy, rx + 0.4, ry + 0.4, 2.4)(x, y) && y < top + 4 && y > top - 3, col);
      fill(c, boxOf(cx, top, 6.6, 3), ell(cx, top + 0.6, 7.4, 3.8, 2.4), col);
      if (view === 'front') fill(c, { x0: cx - 6, y0: top + 3, x1: cx + 6, y1: top + 6 }, rect(cx - 6.4, top + 3.2, cx + 6.4, top + 5.4), c2, { flat: true });
      if (view === 'side') fill(c, { x0: cx + 3, y0: top + 3, x1: cx + 14, y1: top + 6 }, rect(cx + 3, top + 3.2, cx + 12, top + 5.4), c2, { flat: true });
      if (view === 'front') dot(c, cx - 1, top + 0.4, '#c9d6ee', 2, 2);
      break;
    }
    case 'beret': {
      fill(c, { x0: cx - rx - 1, y0: top - 3, x1: cx + rx + 2, y1: top + 5 }, ell(cx + 1.2, top + 1.2, rx + 1.2, 4.2, 2), col);
      dot(c, cx + 1, top - 3, c2, 2, 2);
      break;
    }
    case 'bow': {
      const bx = view === 'side' ? cx - 2 : cx + 6.4;
      fill(c, boxOf(bx - 3, top + 2, 3, 2.4), tri(bx, top + 2.4, bx - 6, top - 1, bx - 6, top + 6), col, { flat: true });
      fill(c, boxOf(bx + 3, top + 2, 3, 2.4), tri(bx, top + 2.4, bx + 6, top - 1, bx + 6, top + 6), col, { flat: true });
      dot(c, bx - 1, top + 1, c2, 2, 3);
      break;
    }
  }
}

// ------------------------------------------------------------------ body
function legsLayer(spec: FolkSpec, g: Geo, pose: FolkPose, view: 'front' | 'side' | 'back', c: Ctx) {
  const top = g.legTop;
  const lc = spec.legsColor;
  const bottom = 42;
  const sit = !!pose.sit;
  const mk = (x0: number, w: number, y1: number) => {
    fill(c, { x0, y0: top, x1: x0 + w, y1 }, rect(x0, top, x0 + w, y1), lc);
    // shoe
    const sy = Math.max(top + 1, y1 - 2);
    fill(c, { x0: x0 - 0.5, y0: sy, x1: x0 + w + 0.5, y1: y1 + 1 }, rect(x0 - 0.5, sy, x0 + w + 0.5, y1 + 1), spec.shoes);
  };
  if (view === 'side') {
    const swing = pose.legs === 'idle' ? 0 : 2.4;
    const back = pose.legs === 'a' ? -1 : 1;
    if (sit) {
      mk(AX + 1, 4, bottom - 3);
      return;
    }
    mk(Math.round(AX - 2 - swing * back * 0.5), 4, bottom - (pose.legs === 'a' ? 1 : 0));
    mk(Math.round(AX - 1 + swing * back * 0.5), 4, bottom - (pose.legs === 'b' ? 1 : 0));
  } else {
    const lift = (leg: 'l' | 'r') => (pose.legs === 'a' && leg === 'l') || (pose.legs === 'b' && leg === 'r') ? 1 : 0;
    if (sit) {
      mk(AX - 6.4, 5, bottom - 2);
      mk(AX + 1.4, 5, bottom - 2);
      return;
    }
    mk(AX - 5.4, 4.6, bottom - lift('l'));
    mk(AX + 0.8, 4.6, bottom - lift('r'));
  }
}

function skirtLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  if (spec.legs !== 'skirt' && spec.legs !== 'robe') return;
  const hem = spec.legs === 'robe' ? 41 : 37.5;
  const w = (view === 'side' ? 6.2 : 8.4) + (spec.wide ?? 0) + (spec.legs === 'robe' ? 1.2 : 0);
  const col = spec.skirtC ?? spec.legsColor;
  const test: Test = (x, y) => {
    const t = (y - (g.torsoBot - 3)) / (hem - (g.torsoBot - 3));
    return y >= g.torsoBot - 3 && y < hem && Math.abs(x - (view === 'side' ? AX + 0.3 : AX)) <= (view === 'side' ? 4.4 : 6) + t * (w - 6);
  };
  fill(c, { x0: AX - w - 2, y0: g.torsoBot - 3, x1: AX + w + 2, y1: hem }, test, col);
}

function torsoLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  const cx = view === 'side' ? AX + 0.3 : AX;
  const hw = g.hw;
  const test: Test = (x, y) => {
    if (y < g.torsoTop || y >= g.torsoBot) return false;
    const t = (y - g.torsoTop) / (g.torsoBot - g.torsoTop);
    const half = hw * (0.78 + 0.22 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5)) + (t > 0.7 ? 0.3 : 0);
    return Math.abs(x - cx) <= half;
  };
  fill(c, { x0: cx - hw - 1, y0: g.torsoTop, x1: cx + hw + 1, y1: g.torsoBot }, test, spec.top, { lt: spec.topLight });
  if (CUSTOM?.extra) {
    bodyAcc(c, CUSTOM.extra.kind, CUSTOM.extra.c1, CUSTOM.extra.c2, Math.round(cx), Math.round(g.torsoTop + 8), Math.round(hw) + 1, view);
    return;
  }
  // decorations that live on the torso (hidden from the back unless noted)
  for (const d of spec.deco ?? []) {
    if (view === 'back' && !(d.k === 'strap' || d.k === 'shawl' || d.k === 'apron' || d.k === 'bib' || d.k === 'vest' || d.k === 'robeTrim' || d.k === 'belt')) continue;
    switch (d.k) {
      case 'apron': {
        const ay = g.torsoTop + 2.5;
        if (view === 'back') {
          dot(c, cx - hw, ay + 2, d.c, hw * 2, 1);
          break;
        }
        const half = view === 'side' ? 3.3 : hw - 1;
        const t2: Test = (x, y) => y >= ay && y < g.torsoBot + 1.2 && Math.abs(x - (view === 'side' ? cx + 1 : cx)) <= half;
        fill(c, { x0: cx - half - 1, y0: ay, x1: cx + half + 2, y1: g.torsoBot + 1.5 }, t2, d.c, { lt: shade(d.c, 0.1) });
        if (view === 'front') fill(c, boxOf(cx, ay + 5.4, 2.8, 1.5), rect(cx - 2.8, ay + 4, cx + 2.8, ay + 7), d.c2 ?? shade(d.c, -0.18), { flat: true });
        break;
      }
      case 'bib': {
        const by = g.torsoTop + 2;
        const half = view === 'side' ? 3.2 : hw - 1.4;
        const t2: Test = (x, y) => y >= by + 1 && y < g.torsoBot + 1 && Math.abs(x - (view === 'side' ? cx + 0.6 : cx)) <= half;
        fill(c, { x0: cx - half - 1, y0: by, x1: cx + half + 2, y1: g.torsoBot + 1 }, t2, d.c);
        if (view === 'front') {
          dot(c, cx - hw + 1.5, by - 1, d.strap, 1, 3);
          dot(c, cx + hw - 2.5, by - 1, d.strap, 1, 3);
          dot(c, cx - 2, by + 4, shade(d.c, -0.2), 4, 3);
        } else dot(c, cx - 1, by - 1, d.strap, 1, 4);
        break;
      }
      case 'collar':
        if (view === 'front') {
          fill(c, boxOf(cx, g.torsoTop + 1.4, 4, 1.6), tri(cx - 4.4, g.torsoTop + 0.2, cx + 4.4, g.torsoTop + 0.2, cx, g.torsoTop + 4), d.c, { flat: true });
        }
        break;
      case 'bowtie':
        if (view === 'front') {
          dot(c, cx - 3, g.torsoTop + 1, d.c, 2, 3);
          dot(c, cx + 1, g.torsoTop + 1, d.c, 2, 3);
          dot(c, cx - 1, g.torsoTop + 2, shade(d.c, -0.25), 2, 1);
        }
        break;
      case 'buttons':
        if (view === 'front') for (let i = 0; i < 3; i++) dot(c, cx - 0.5, g.torsoTop + 3 + i * 2.6, d.c);
        break;
      case 'necklace':
        if (view === 'front') {
          for (const [dx, dy] of [[-3, 0], [-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1], [3, 0]]) dot(c, cx + dx - 0.5, g.torsoTop + 0.6 + dy, d.c);
          dot(c, cx - 0.5, g.torsoTop + 3.2, shade(d.c, 0.25), 1, 2);
        }
        break;
      case 'vest': {
        const half = view === 'side' ? 4.2 : hw;
        const open: Test = (x, y) => y >= g.torsoTop && y < g.torsoBot && Math.abs(x - cx) <= half && (view !== 'front' || Math.abs(x - cx) >= 2);
        fill(c, { x0: cx - half - 1, y0: g.torsoTop, x1: cx + half + 1, y1: g.torsoBot }, open, d.c);
        if (view === 'front') fill(c, boxOf(cx, g.torsoBot - 4, 2, 4.5), rect(cx - 2, g.torsoTop, cx + 2, g.torsoBot), d.inner, { flat: true });
        break;
      }
      case 'strap': {
        const diag: Test = (x, y) => y >= g.torsoTop && y < g.torsoBot + 1 && Math.abs(x - (cx - hw + 1 + ((y - g.torsoTop) / (g.torsoBot - g.torsoTop)) * (hw * 2 - 2))) < 1.2;
        if (view !== 'side') fill(c, { x0: cx - hw, y0: g.torsoTop, x1: cx + hw, y1: g.torsoBot + 1 }, diag, d.c, { flat: true });
        if (d.bag && view !== 'back') fill(c, { x0: cx + hw - 4, y0: g.torsoBot - 4, x1: cx + hw + 2, y1: g.torsoBot + 3 }, rect(cx + hw - 4, g.torsoBot - 3, cx + hw + 1.5, g.torsoBot + 3), d.bag);
        break;
      }
      case 'shawl': {
        const sh: Test = (x, y) => y >= g.torsoTop - 0.5 && y < g.torsoTop + 5.4 && Math.abs(x - cx) <= hw + 1.2 - (y - g.torsoTop) * 0.12;
        fill(c, { x0: cx - hw - 2, y0: g.torsoTop - 1, x1: cx + hw + 2, y1: g.torsoTop + 6 }, sh, d.c);
        break;
      }
      case 'belt':
        dot(c, cx - hw + 0.5, g.torsoBot - 3, d.c, hw * 2 - 1, 1);
        break;
      case 'robeTrim':
        if (view === 'front') {
          dot(c, cx - 0.5, g.torsoTop + 1, d.c, 1, g.torsoBot - g.torsoTop + 5);
        }
        break;
    }
  }
}

function armLayer(spec: FolkSpec, g: Geo, pose: FolkPose, view: 'front' | 'side' | 'back', c: Ctx, which: 'l' | 'r' | 'both') {
  const top = g.torsoTop + 1.2;
  const swing = pose.legs === 'idle' ? 0 : 1;
  const sleeve = spec.top;
  const hand = spec.fur;
  const mk = (x: number, y0: number, h: number, handUp = false) => {
    fill(c, { x0: x, y0, x1: x + 3, y1: y0 + h }, rect(x, y0, x + 3, y0 + h - 1.6), sleeve);
    fill(c, { x0: x, y0: y0 + h - 2.6, x1: x + 3, y1: y0 + h }, rect(x, y0 + h - 2.6, x + 3, y0 + h), hand);
    void handUp;
  };
  const hw = g.hw;
  if (view === 'side') {
    const ax = AX - 0.5 + (pose.legs === 'a' ? 1.5 : pose.legs === 'b' ? -1.5 : 0);
    if (pose.arms === 'read') {
      mk(AX + 2, top + 2, 6);
      return;
    }
    mk(Math.round(ax), top, 8);
    return;
  }
  const arms = pose.arms;
  const L = which !== 'r';
  const R = which !== 'l';
  if (arms === 'cook1' || arms === 'cook2') {
    const up = arms === 'cook1' ? 0 : 1;
    if (L) mk(AX - hw - 1.2 + 2.2, top + 2 - up, 7);
    if (R) mk(AX + hw - 4 + 1.6, top + 2 + up - 1, 7);
    return;
  }
  if (arms === 'read') {
    if (L) mk(AX - hw + 1, top + 2, 6);
    if (R) mk(AX + hw - 4, top + 2, 6);
    return;
  }
  if (arms === 'wave1' || arms === 'wave2') {
    if (L) mk(AX - hw - 1.4, top + 1, 8);
    if (R) {
      const wx = arms === 'wave1' ? AX + hw + 1.2 : AX + hw + 2.4;
      mk(wx, top - 7, 9);
    }
    return;
  }
  if (L) mk(AX - hw - 1.6, top + (pose.legs === 'a' ? 1 : 0) + 0.5 * swing, 8);
  if (R) mk(AX + hw - 1.4, top + (pose.legs === 'b' ? 1 : 0), 8);
}

// ------------------------------------------------------------------ tails
function tailLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx, behind: boolean) {
  const t = spec.tail;
  if (!t || t.kind === 'none') return;
  const col = t.c ?? spec.fur;
  const by = g.torsoBot;
  if (view === 'back') {
    if (behind) return;
    if (t.kind === 'bushy' || t.kind === 'ringed') {
      fill(c, boxOf(AX + 1.5, by - 1, 5.2, 6), ell(AX + 1.5, by - 1, 5.2, 6.2, 2), col);
      if (t.tip) fill(c, { x0: AX - 4, y0: by + 2, x1: AX + 7, y1: by + 6 }, (x, y) => ell(AX + 1.5, by - 1, 5.2, 6.2, 2)(x, y) && y > by + 2.4, t.tip, { flat: true });
      if (t.kind === 'ringed') for (const yy of [by - 4, by - 0.5, by + 3]) dot(c, AX - 3.6, yy, shade(col, -0.4), 10, 1);
    } else if (t.kind === 'puff') fill(c, boxOf(AX, by - 0.5, 2.8, 2.6), ell(AX, by - 0.5, 2.8, 2.6), col, { lt: '#ffffff' });
    else if (t.kind === 'nub') fill(c, boxOf(AX, by - 0.5, 2, 2), ell(AX, by - 0.5, 2, 2), col);
    else if (t.kind === 'thin') fill(c, { x0: AX + 1, y0: by - 8, x1: AX + 4, y1: by + 2 }, rect(AX + 1, by - 6, AX + 3.4, by + 3), col);
    return;
  }
  if (!behind && view === 'front') return;
  const sx = view === 'side' ? AX - 6.5 : AX + 5.8;
  if (t.kind === 'bushy' || t.kind === 'ringed') {
    const test: Test = (x, y) => {
      const k = (y - (by - 12)) / 15;
      if (k < 0 || k > 1) return false;
      const cxk = sx + 2.2 + Math.sin(k * 2.6) * (view === 'side' ? -3.2 : 3.6);
      const half = 1.6 + Math.sin(k * Math.PI * 0.92) * 3.7;
      return Math.abs(x - cxk) <= half;
    };
    fill(c, { x0: sx - 8, y0: by - 12, x1: sx + 13, y1: by + 3 }, test, col);
    if (t.tip) fill(c, { x0: sx - 8, y0: by - 12, x1: sx + 13, y1: by + 3 }, (x, y) => test(x, y) && y < by - 8, t.tip, { flat: true });
    if (t.kind === 'ringed') for (const yy of [by - 9, by - 5, by - 1.5]) fill(c, { x0: sx - 8, y0: yy, x1: sx + 13, y1: yy + 1.6 }, (x, y) => test(x, y) && y >= yy && y < yy + 1.5, shade(col, -0.38), { flat: true });
  } else if (t.kind === 'thin') {
    const test: Test = (x, y) => y > by - 10 && y < by + 3 && Math.abs(x - (sx + 2 + (by - y) * 0.35)) < 1.3;
    fill(c, { x0: sx - 4, y0: by - 11, x1: sx + 12, y1: by + 3 }, test, col, { flat: true });
  } else if (t.kind === 'puff') {
    fill(c, boxOf(sx + 1, by - 2, 3, 3), ell(sx + 1, by - 2, 3, 3), col, { lt: '#ffffff' });
  } else if (t.kind === 'nub') {
    fill(c, boxOf(sx + 1, by - 2, 2.2, 2.2), ell(sx + 1, by - 2, 2.2, 2.2), col);
  }
}

// ------------------------------------------------------------------ head
function headLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const p = spec.humanEars ? 2.3 : 2.5;
  fill(c, boxOf(cx, cy, rx, ry), ell(cx, cy, rx, ry, p), spec.fur);
  if (spec.humanEars && view !== 'back') {
    const ex = view === 'side' ? cx - 1 : cx + rx - 0.6;
    fill(c, boxOf(ex, cy + 1, 1.8, 2.4), ell(ex, cy + 1, 1.8, 2.4), spec.fur);
    if (view === 'front') fill(c, boxOf(cx - rx + 0.6, cy + 1, 1.8, 2.4), ell(cx - rx + 0.6, cy + 1, 1.8, 2.4), spec.fur);
  }
}

// ------------------------------------------------------------------ one frame
export function folkFrame(spec: FolkSpec, pose: FolkPose, custom?: FolkCustom): HTMLCanvasElement {
  CUSTOM = custom;
  const side = pose.dir === 'left' || pose.dir === 'right';
  const view: 'front' | 'side' | 'back' = pose.dir === 'down' ? 'front' : pose.dir === 'up' ? 'back' : 'side';
  const g = geo(spec, pose, side);
  const bodyLegs = (c: Ctx) => {
    if (spec.legs === 'skirt' || spec.legs === 'robe') {
      // short legs under the dress
      legsLayer({ ...spec, legsColor: spec.fur }, g, pose, view, c);
    } else legsLayer(spec, g, pose, view, c);
  };
  const layers: ((c: Ctx) => void)[] = [
    (c) => tailLayer(spec, g, view, c, true),
    bodyLegs,
    (c) => skirtLayer(spec, g, view, c),
    (c) => torsoLayer(spec, g, view, c),
    (c) => armLayer(spec, g, pose, view, c, view === 'side' ? 'r' : 'both'),
    (c) => earsLayer(spec, g, view, c),
    (c) => headLayer(spec, g, view, c),
    (c) => hairLayer(spec, g, view, c),
    (c) => hatLayer(spec, g, view, c),
    (c) => tailLayer(spec, g, view, c, false),
  ];
  // the face sits inside the head silhouette, drawn after the contour pass of the head
  const canvas = stack(spec, layers, (o) => {
    if (view === 'front') faceFront(spec, g, pose.expr, o);
    else if (view === 'side') faceSide(spec, g, pose.expr, o);
    if (pose.arms === 'read') {
      const by = g.torsoTop + 5;
      fill(o, { x0: AX - 4, y0: by, x1: AX + 4, y1: by + 6 }, rect(AX - 4, by, AX + 4, by + 5), '#e9d3a5', { lt: '#f6e7c4' });
      px(o, AX, by, '#8a5a3c', 1, 5);
      px(o, AX - 4, by + 4, '#8a5a3c', 8, 1);
    }
  });
  return pose.dir === 'left' ? mirrorCanvas(canvas) : canvas;
}

/** Same 30-frame layout as every other sheet (see FRAMES in characters.ts). */
const SPECS: Omit<FolkPose, 'bob'>[] = [
  { dir: 'down', legs: 'idle', expr: 'neutral' }, { dir: 'down', legs: 'a', expr: 'neutral' }, { dir: 'down', legs: 'b', expr: 'neutral' },
  { dir: 'up', legs: 'idle', expr: 'neutral' }, { dir: 'up', legs: 'a', expr: 'neutral' }, { dir: 'up', legs: 'b', expr: 'neutral' },
  { dir: 'right', legs: 'idle', expr: 'neutral' }, { dir: 'right', legs: 'a', expr: 'neutral' }, { dir: 'right', legs: 'b', expr: 'neutral' },
  { dir: 'left', legs: 'idle', expr: 'neutral' }, { dir: 'left', legs: 'a', expr: 'neutral' }, { dir: 'left', legs: 'b', expr: 'neutral' },
  { dir: 'down', legs: 'idle', expr: 'blink' }, { dir: 'down', legs: 'idle', expr: 'happy' }, { dir: 'down', legs: 'idle', expr: 'surprised' }, { dir: 'down', legs: 'idle', expr: 'sleep' },
  { dir: 'right', legs: 'idle', expr: 'blink' }, { dir: 'left', legs: 'idle', expr: 'blink' }, { dir: 'down', legs: 'idle', expr: 'sad' }, { dir: 'down', legs: 'idle', expr: 'smug' },
  { dir: 'down', legs: 'idle', expr: 'neutral' }, { dir: 'up', legs: 'idle', expr: 'neutral' }, { dir: 'right', legs: 'idle', expr: 'neutral' }, { dir: 'left', legs: 'idle', expr: 'neutral' },
  { dir: 'down', legs: 'idle', expr: 'neutral', arms: 'cook1' }, { dir: 'down', legs: 'idle', expr: 'happy', arms: 'cook2' },
  { dir: 'down', legs: 'idle', expr: 'happy', arms: 'wave1' }, { dir: 'down', legs: 'idle', expr: 'happy', arms: 'wave2' },
  { dir: 'down', legs: 'idle', expr: 'neutral', arms: 'read' }, { dir: 'down', legs: 'idle', expr: 'smug', sit: true },
];

export function buildFolkSheet(spec: FolkSpec, custom?: FolkCustom): { canvas: HTMLCanvasElement; fw: number; fh: number } {
  const frames = SPECS.map((sp, i) => folkFrame(spec, { ...sp, bob: sp.legs !== 'idle' ? -1 : i >= 20 && i < 24 ? 1 : 0 }, custom));
  const canvas = makeCanvas(FOLK_W * frames.length, FOLK_H);
  const g = ctx2d(canvas);
  frames.forEach((f, i) => g.drawImage(f, i * FOLK_W, 0));
  return { canvas, fw: FOLK_W, fh: FOLK_H };
}

/** Head-and-shoulders portrait from the front frame, upscaled with crisp pixels. */
export function buildFolkPortrait(spec: FolkSpec, expr: FolkExpr, scale = 5, custom?: FolkCustom): HTMLCanvasElement {
  const f = folkFrame(spec, { dir: 'down', legs: 'idle', expr, bob: 0 }, custom);
  const top = 1;
  const h = 40;
  const out = makeCanvas(FOLK_W * scale, h * scale);
  const o = ctx2d(out);
  o.imageSmoothingEnabled = false;
  o.drawImage(f, 0, top, FOLK_W, h, 0, 0, FOLK_W * scale, h * scale);
  return out;
}

void mix;
