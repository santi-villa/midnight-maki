/**
 * Chibi raccoon renderer for Pip, Spicy and Rigg (style guide: the "Mapache pequeño / castaño / acostado" sheets).
 * Big round heads, thick dark contour around every body part, soft two-tone shading and striped tails.
 * Each body part is painted on its own layer and outlined separately, so overlaps keep an inner contour line.
 * Sheets use the same 24-frame layout as the human characters (see FRAMES in characters.ts).
 */
import type { Appearance, Dir } from '../core/types';
import { CLOTHES_BY_ID } from '../data/clothes';
import type { Expr, Legs } from './characters';
import type { ChibiArms } from './chibi';
import { ctx2d, ctx2dRead, ellipse, makeCanvas, mix, outline, px, shade, type Ctx } from './pixel';

export type RaccoonBuild = 'small' | 'medium' | 'big';

const INK = '#2b2231';
const EYE = '#17121c';

interface Pal {
  base: string; baseD: string; baseL: string;
  mask: string; white: string; whiteD: string;
  limb: string; limbD: string;
  ear: string; earIn: string;
  ring: string; stripe: string;
}

function palette(a: Appearance): Pal {
  const m = a.marks ?? {};
  const base = a.skin;
  const white = m.face ?? '#f4f1ec';
  const limb = m.arms ?? shade(base, -0.3);
  // keep the mask a touch lighter than the pupils so the eyes stay readable
  const mask = mix(m.mask ?? '#2a2230', base, 0.12);
  return {
    base, baseD: shade(base, -0.22), baseL: shade(base, 0.16),
    mask, white, whiteD: shade(white, -0.13),
    limb, limbD: shade(limb, -0.25),
    ear: base, earIn: white,
    ring: shade(base, -0.5),
    stripe: m.stripe ?? mask,
  };
}

// ------------------------------------------------------------------ helpers
/** Soft volume: dark ellipse, lit ellipse nudged up, small highlight. */
function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, base: string, dark: string, light?: string) {
  ellipse(c, cx, cy, rx, ry, dark);
  ellipse(c, cx, cy - 1, Math.max(1, rx - 0.6), Math.max(1, ry - 1), base);
  if (light) ellipse(c, cx - rx * 0.35, cy - ry * 0.45, Math.max(1, rx * 0.35), Math.max(0.6, ry * 0.25), light);
}

type Layer = (c: Ctx) => void;

/** Paints each layer on its own canvas, outlines it, and stacks them back to front. */
function stack(W: number, H: number, layers: Layer[], after?: Layer): HTMLCanvasElement {
  const out = makeCanvas(W, H);
  const o = ctx2d(out);
  for (const l of layers) {
    const c = makeCanvas(W, H);
    l(ctx2dRead(c));
    outline(c, INK);
    o.drawImage(c, 0, 0);
  }
  after?.(o);
  return out;
}

/** Ringed tail as a chain of ellipses following the given points. */
function tail(c: Ctx, pts: [number, number][], r: number, p: Pal) {
  pts.forEach(([x, y], i) => {
    const col = i % 2 ? p.ring : p.base;
    ellipse(c, x, y, r, r, i % 2 ? shade(p.ring, -0.15) : p.baseD);
    ellipse(c, x, y - 0.6, Math.max(1, r - 0.6), Math.max(1, r - 0.8), col);
  });
  const [lx, ly] = pts[pts.length - 1];
  ellipse(c, lx, ly, Math.max(1, r - 0.8), Math.max(1, r - 0.8), p.ring);
}

function mirrorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// ------------------------------------------------------------------ faces
function eyesFront(c: Ctx, cx: number, ey: number, gap: number, expr: Expr, p: Pal, big: boolean) {
  const xs = [cx - gap - 1, cx + gap];
  const lid = '#e6e0ea';
  for (const x of xs) {
    switch (expr) {
      case 'blink':
      case 'sleep':
        px(c, x - 1, ey + 1, lid, 3, 1);
        break;
      case 'happy':
        px(c, x - 1, ey + 1, lid);
        px(c, x, ey, lid);
        px(c, x + 1, ey + 1, lid);
        break;
      case 'sad':
        px(c, x, ey, EYE, 2, 2);
        px(c, x, ey, '#ffffff');
        px(c, x === xs[0] ? x - 1 : x + 2, ey - 2, lid);
        px(c, x === xs[0] ? x : x + 1, ey - 2, lid);
        break;
      case 'smug':
        px(c, x, ey + 1, EYE, 2, 1);
        px(c, x - 1, ey, lid, 4, 1);
        break;
      case 'surprised':
        px(c, x - (big ? 1 : 0), ey - 1, EYE, big ? 3 : 2, 3);
        px(c, x - (big ? 1 : 0), ey - 1, '#ffffff');
        break;
      default:
        px(c, x, ey - 1, EYE, 2, 3);
        px(c, x, ey - 1, '#ffffff');
    }
  }
  void p;
}

function mouthFront(c: Ctx, cx: number, y: number, expr: Expr) {
  // nose
  px(c, cx - 1, y, INK, 3, 1);
  px(c, cx, y + 1, INK);
  if (expr === 'surprised') {
    px(c, cx, y + 2, '#7a3a44', 1, 2);
  } else if (expr === 'happy') {
    px(c, cx - 2, y + 2, INK);
    px(c, cx - 1, y + 3, '#c26472', 3, 1);
    px(c, cx + 2, y + 2, INK);
  } else if (expr === 'sad') {
    px(c, cx - 1, y + 3, INK);
    px(c, cx + 1, y + 3, INK);
  } else {
    px(c, cx - 1, y + 2, INK);
    px(c, cx + 1, y + 2, INK);
  }
}

/** Raccoon face seen from the front. (cx, hy) = head centre. */
function faceFront(c: Ctx, cx: number, hy: number, s: number, expr: Expr, p: Pal, stripe: boolean) {
  const gap = Math.round(3.3 * s);
  // light brows above the mask
  ellipse(c, cx - gap - 0.5, hy - 3 * s, 2 * s, 1 * s, p.white);
  ellipse(c, cx + gap + 0.5, hy - 3 * s, 2 * s, 1 * s, p.white);
  if (stripe) px(c, cx - 1, hy - 6 * s, p.stripe, 3, Math.round(4 * s));
  // the bandit mask
  ellipse(c, cx - gap - 0.5, hy - 0.2, 2.6 * s, 1.9 * s, p.mask);
  ellipse(c, cx + gap + 0.5, hy - 0.2, 2.6 * s, 1.9 * s, p.mask);
  // muzzle
  ellipse(c, cx, hy + 2.4 * s, 3.4 * s, 2.3 * s, p.white);
  px(c, cx - Math.round(3 * s), hy + Math.round(3.6 * s), p.whiteD, Math.round(6 * s) + 1, 1);
  eyesFront(c, cx, Math.round(hy - 1), gap, expr, p, s > 1.05);
  mouthFront(c, cx, Math.round(hy + 1.4 * s), expr);
  // blush
  if (expr === 'happy' || expr === 'smug') {
    px(c, cx - gap - 3, Math.round(hy + 2 * s), '#e59aa3', 2, 1);
    px(c, cx + gap + 2, Math.round(hy + 2 * s), '#e59aa3', 2, 1);
  }
}

/** Raccoon face in profile, looking right. (hx, hy) = head centre. */
function faceSide(c: Ctx, hx: number, hy: number, s: number, expr: Expr, p: Pal, stripe: boolean) {
  if (stripe) px(c, hx - 1, hy - 6 * s, p.stripe, 3, Math.round(3 * s));
  ellipse(c, hx + 1.5 * s, hy - 2.6 * s, 2 * s, 0.9 * s, p.white);
  ellipse(c, hx + 2.2 * s, hy - 0.2, 3 * s, 1.9 * s, p.mask);
  const ex = Math.round(hx + 2.6 * s);
  const ey = Math.round(hy - 1);
  if (expr === 'blink' || expr === 'sleep' || expr === 'happy') px(c, ex - 1, ey + 1, '#e6e0ea', 3, 1);
  else {
    px(c, ex, ey, EYE, 2, s > 1.05 ? 3 : 2);
    px(c, ex, ey, '#ffffff');
  }
}

function snoutSide(c: Ctx, hx: number, hy: number, s: number, p: Pal) {
  const sx = hx + 5.6 * s;
  const sy = hy + 2 * s;
  ellipse(c, sx, sy, 2.8 * s, 2 * s, p.whiteD);
  ellipse(c, sx, sy - 0.6, 2.4 * s, 1.5 * s, p.white);
}

// ------------------------------------------------------------------ accessories
export function headAcc(c: Ctx, kind: string, c1: string, c2: string, cx: number, top: number, w: number, view: 'front' | 'side' | 'back') {
  const d = shade(c1, -0.25);
  switch (kind) {
    case 'bandana': {
      // hachimaki-style headband with a knot at the side
      const bw = w - 2;
      px(c, cx - bw, top + 2, d, bw * 2 + 1, 2);
      px(c, cx - bw + 1, top + 1, c1, bw * 2 - 1, 2);
      px(c, cx - 1, top + 1, c2, 3, 1);
      const kx = view === 'side' ? cx - w : cx + w - 2;
      px(c, kx, top + 3, c1, 2, 2);
      px(c, kx + (view === 'side' ? -1 : 1), top + 4, d, 2, 2);
      break;
    }
    case 'chefhat':
      ellipse(c, cx, top - 1, w * 0.7, 3.5, d);
      ellipse(c, cx, top - 1.5, w * 0.65, 3, c1);
      px(c, cx - w + 2, top + 1, c2, w * 2 - 3, 2);
      break;
    case 'beanie':
      ellipse(c, cx, top + 1, w * 0.9, 3, c1);
      px(c, cx - w + 1, top + 3, c2, w * 2 - 1, 2);
      ellipse(c, cx, top - 2.5, 1.5, 1.5, c2);
      break;
    case 'beret':
      ellipse(c, cx + 1, top + 1, w * 0.85, 2.2, c1);
      px(c, cx + 1, top - 2, c2, 1, 2);
      break;
    case 'straw':
      ellipse(c, cx, top + 3, w + 3, 2, '#d6b86c');
      ellipse(c, cx, top + 1, w * 0.6, 2.5, c1);
      px(c, cx - Math.round(w * 0.6), top + 2, c2, Math.round(w * 1.2) + 1, 1);
      break;
    case 'witch':
      ellipse(c, cx, top + 3, w + 2, 1.6, c1);
      for (let i = 0; i < 7; i++) px(c, cx - 3 + Math.floor(i / 2), top + 2 - i, c1, 7 - i, 1);
      px(c, cx - 3, top + 1, c2, 7, 1);
      break;
    case 'frog':
      ellipse(c, cx, top + 2, w * 0.95, 3, c1);
      if (view !== 'back') {
        ellipse(c, cx - 4, top - 1, 2, 2, c1);
        ellipse(c, cx + 4, top - 1, 2, 2, c1);
        px(c, cx - 4, top - 1, INK);
        px(c, cx + 4, top - 1, INK);
      }
      break;
    case 'catears':
      for (const sx of [-1, 1]) {
        const ex = cx + sx * (w - 3);
        px(c, ex - 1, top - 1, c1, 3, 2);
        px(c, ex, top - 2, c1);
        px(c, ex, top - 1, c2);
      }
      break;
    case 'bow': {
      const bx = view === 'side' ? cx - 2 : cx + w - 4;
      px(c, bx - 2, top, c1, 2, 3);
      px(c, bx + 1, top, c1, 2, 3);
      px(c, bx, top + 1, c2);
      break;
    }
    case 'flower': {
      const fx = view === 'side' ? cx - 1 : cx + w - 4;
      px(c, fx - 1, top + 1, c1, 3, 1);
      px(c, fx, top, c1, 1, 3);
      px(c, fx, top + 1, c2);
      break;
    }
    case 'starclip': {
      const sx = view === 'side' ? cx - 1 : cx + w - 4;
      px(c, sx - 1, top + 2, c1, 3, 1);
      px(c, sx, top + 1, c1, 1, 3);
      break;
    }
    default:
      break;
  }
}

export function bodyAcc(c: Ctx, kind: string, c1: string, c2: string, cx: number, by: number, bw: number, view: 'front' | 'side' | 'back') {
  switch (kind) {
    case 'apron':
      if (view === 'back') {
        px(c, cx - 1, by - 2, c2, 3, 2);
        break;
      }
      {
        const x0 = view === 'side' ? cx : cx - bw + 2;
        const w = view === 'side' ? bw - 1 : bw * 2 - 3;
        px(c, x0, by - 1, shade(c1, -0.12), w, 6);
        px(c, x0, by - 1, c1, w, 5);
        px(c, x0, by - 2, c2, w, 1);
        if (view === 'front') px(c, cx - 1, by + 1, c2, 3, 2);
      }
      break;
    case 'necklace':
      if (view === 'back') break;
      for (let i = -3; i <= 3; i++) px(c, cx + i + (view === 'side' ? 2 : 0), by - 4 + Math.round((i * i) / 6), c1);
      px(c, cx + (view === 'side' ? 2 : 0), by - 2, c2, 1, 2);
      break;
    case 'scarf':
      px(c, cx - bw + 1, by - 5, c1, bw * 2 - 1, 2);
      px(c, cx - bw + 1, by - 4, c2, bw * 2 - 1, 1);
      if (view !== 'back') px(c, cx + (view === 'side' ? -bw + 1 : 2), by - 3, c1, 2, 4);
      break;
    case 'cape':
      if (view === 'back') {
        px(c, cx - bw, by - 5, c1, bw * 2 + 1, 9);
        px(c, cx - bw, by - 5, c2, bw * 2 + 1, 1);
      } else px(c, cx - bw, by - 5, c2, bw * 2 + 1, 1);
      break;
    default:
      break;
  }
}

function accOf(id: string) {
  const d = id ? CLOTHES_BY_ID[id] : undefined;
  return d ? { kind: d.kind, c1: d.c1, c2: d.c2 ?? shade(d.c1, -0.2) } : null;
}

// ------------------------------------------------------------------ standing raccoon (Spicy, Rigg)
interface Pose { dir: Dir; legs: Legs; expr: Expr; bob: number; arms?: ChibiArms; sit?: boolean; }

function standing(a: Appearance, pose: Pose, size: 'small' | 'medium'): HTMLCanvasElement {
  const p = palette(a);
  const s = size === 'small' ? 0.86 : 0.98;
  const W = size === 'small' ? 23 : 25;
  const H = size === 'small' ? 23 : 26;
  const cx = Math.floor(W / 2);
  const feetY = H - 3;
  const bodyY = feetY - Math.round(4.5 * s) + pose.bob;
  const headY = bodyY - Math.round(9 * s);
  const hrx = 8.8 * s;
  const hry = 7.2 * s;
  const head = accOf(a.head);
  const extra = accOf(a.extra);
  const side = pose.dir === 'left' || pose.dir === 'right';
  const front = pose.dir === 'down';

  const legOff = (k: 0 | 1) => (pose.legs === 'idle' ? 0 : (pose.legs === 'a') === (k === 0) ? -1 : 0);
  const feet: Layer = (c) => {
    if (side) {
      const sw = pose.legs === 'a' ? 2 : pose.legs === 'b' ? -1 : 0;
      ellipse(c, cx - 2 - sw, feetY + legOff(1), 2 * s, 1.2, p.limbD);
      ellipse(c, cx + 2 + sw, feetY + legOff(0), 2 * s, 1.2, p.limb);
    } else {
      ellipse(c, cx - 3 * s, feetY + legOff(0), 2.2 * s, 1.3, p.limb);
      ellipse(c, cx + 3 * s, feetY + legOff(1), 2.2 * s, 1.3, p.limb);
    }
  };
  const tailLayer: Layer = (c) => {
    if (pose.dir === 'up') return;
    if (side) tail(c, [[cx - 5, bodyY + 3], [cx - 7, bodyY + 1], [cx - 9, bodyY - 1], [cx - 10, bodyY - 3]], 2.4 * s, p);
    else tail(c, [[cx + 5, bodyY + 3], [cx + 7, bodyY + 1], [cx + 9, bodyY - 1], [cx + 10, bodyY - 3]], 2.4 * s, p);
  };
  const capeBack: Layer = (c) => {
    if (extra?.kind === 'cape' && pose.dir !== 'up') px(c, cx - 6, bodyY - 4, extra.c1, 13, 9);
  };
  const body: Layer = (c) => {
    blob(c, cx, bodyY + 1, 6 * s, 5 * s, p.base, p.baseD);
    if (pose.dir !== 'up') ellipse(c, side ? cx + 2 : cx, bodyY + 2, (side ? 3 : 4) * s, 3.4 * s, p.white);
    if (pose.dir !== 'up') ellipse(c, side ? cx + 2 : cx, bodyY + 4, (side ? 2.4 : 3.4) * s, 1.2, p.whiteD);
    if (extra) bodyAcc(c, extra.kind, extra.c1, extra.c2, cx, bodyY + 1, Math.round(5 * s), front ? 'front' : side ? 'side' : 'back');
  };
  const arms: Layer = (c) => {
    if (side) {
      const sw = pose.legs === 'a' ? 1 : pose.legs === 'b' ? -1 : 0;
      ellipse(c, cx + 1 + sw, bodyY + 1, 1.6, 2.8 * s, p.limb);
    } else if (pose.arms === 'wave1' || pose.arms === 'wave2') {
      ellipse(c, cx - 6 * s, bodyY + 1, 1.6, 2.6 * s, p.limb);
      ellipse(c, cx + 6.5 * s, bodyY - 1, 1.6, 2.4 * s, p.limb);
    } else if (pose.arms) {
      const dy = pose.arms === 'cook2' ? 1 : 0;
      ellipse(c, cx - 3 * s, bodyY + 2 + dy, 2, 1.6, p.limb);
      ellipse(c, cx + 3 * s, bodyY + 2 + dy, 2, 1.6, p.limb);
    } else {
      const sw = pose.legs === 'idle' ? 0 : pose.legs === 'a' ? 1 : -1;
      ellipse(c, cx - 6 * s, bodyY + 1 + sw, 1.6, 2.6 * s, p.limb);
      ellipse(c, cx + 6 * s, bodyY + 1 - sw, 1.6, 2.6 * s, p.limb);
    }
  };
  const held: Layer = (c) => {
    if (side || !pose.arms) return;
    if (pose.arms.startsWith('wave')) {
      // paw raised beside the cheek, in front of the head
      const wy = headY + 3 - (pose.arms === 'wave2' ? 2 : 0);
      ellipse(c, cx + hrx + 0.5, wy, 1.9, 2.4, p.limb);
      ellipse(c, cx + hrx + 0.5, wy - 0.6, 1.1, 1.3, shade(p.limb, 0.25));
      return;
    }
    const dy = pose.arms === 'cook2' ? 1 : 0;
    if (pose.arms === 'read') {
      px(c, cx - 4, bodyY, '#3b4470', 9, 5);
      px(c, cx - 3, bodyY + 1, '#f6f1e6', 3, 3);
      px(c, cx + 1, bodyY + 1, '#f6f1e6', 3, 3);
    } else {
      px(c, cx - 4, bodyY + 3 + dy, '#f6f1e6', 9, 1);
      px(c, cx - 3, bodyY + 4 + dy, '#d9675f', 7, 2);
      px(c, cx + (pose.arms === 'cook1' ? 1 : 0), bodyY - 2 + dy, '#a8714a', 1, 5);
      px(c, cx + (pose.arms === 'cook1' ? 2 : 1), bodyY - 2 + dy, '#a8714a', 1, 5);
    }
  };
  const ears: Layer = (c) => {
    const ex = side ? [cx - 4, cx + 1] : [cx - 5.6 * s, cx + 5.6 * s];
    for (const x of ex) {
      ellipse(c, x, headY - 5.2 * s, 2.6 * s, 2.6 * s, pose.dir === 'up' ? p.baseD : p.ear);
      if (pose.dir !== 'up') ellipse(c, x, headY - 4.8 * s, 1.4 * s, 1.5 * s, p.earIn);
    }
  };
  const headL: Layer = (c) => {
    const hx = side ? cx + 1 : cx;
    blob(c, hx, headY, hrx * (side ? 0.92 : 1), hry, p.base, p.baseD, p.baseL);
    // fluffy cheeks
    ellipse(c, hx - (side ? 4 : 6.8) * s, headY + 2, 2 * s, 2 * s, p.base);
    if (!side) ellipse(c, hx + 6.8 * s, headY + 2, 2 * s, 2 * s, p.base);
    if (side) snoutSide(c, hx, headY, s, p);
  };
  const tailFront: Layer = (c) => {
    if (pose.dir === 'up') tail(c, [[cx + 2, feetY - 1], [cx + 4, feetY - 3], [cx + 6, feetY - 5], [cx + 7, feetY - 7]], 2.5 * s, p);
  };
  const decorate: Layer = (c) => {
    const hx = side ? cx + 1 : cx;
    if (front) faceFront(c, hx, headY, s, pose.expr, p, false);
    else if (side) {
      faceSide(c, hx, headY, s, pose.expr, p, false);
      px(c, Math.round(hx + 8.2 * s), Math.round(headY + 1.2 * s), INK, 2, 2);
    } else {
      // back of the head: a slightly darker cap
      ellipse(c, hx, headY - 2, hrx * 0.7, hry * 0.5, p.baseD);
    }
    if (head) headAcc(c, head.kind, head.c1, head.c2, hx, Math.round(headY - hry), Math.round(hrx), front ? 'front' : side ? 'side' : 'back');
  };
  const canvas = stack(W, H, [tailLayer, capeBack, feet, body, arms, ears, headL, tailFront, held], decorate);
  return pose.dir === 'left' ? mirrorCanvas(canvas) : canvas;
}

// ------------------------------------------------------------------ lying raccoon (Pip)
function lying(a: Appearance, pose: Pose): HTMLCanvasElement {
  const p = palette(a);
  const W = 37;
  const H = 25;
  const cx = 18;
  const groundY = H - 3;
  const side = pose.dir === 'left' || pose.dir === 'right';
  const extra = accOf(a.extra);
  const head = accOf(a.head);
  const s = 1.2;
  const step = pose.legs === 'idle' ? 0 : pose.legs === 'a' ? 1 : -1;
  const by = groundY - 5 + pose.bob;
  const hy = by - 4;

  const tailLayer: Layer = (c) => {
    if (pose.dir === 'up') return;
    if (side) tail(c, [[cx - 12, by + 1], [cx - 14, by - 1], [cx - 15, by - 3], [cx - 16, by - 5]], 2.8, p);
    else tail(c, [[cx + 11, by - 1], [cx + 13, by - 3], [cx + 14, by - 5], [cx + 15, by - 7]], 2.8, p);
  };
  const paws: Layer = (c) => {
    if (side) {
      ellipse(c, cx + 9 + step, groundY, 3, 1.5, p.limb);
      ellipse(c, cx - 9 - step, groundY, 3, 1.5, p.limbD);
    } else if (pose.dir === 'down') {
      ellipse(c, cx - 7, groundY - (step > 0 ? 1 : 0), 3, 1.6, p.limb);
      ellipse(c, cx + 7, groundY - (step < 0 ? 1 : 0), 3, 1.6, p.limb);
    } else {
      ellipse(c, cx - 9, groundY - 1, 3, 1.5, p.limbD);
      ellipse(c, cx + 9, groundY - 1, 3, 1.5, p.limbD);
    }
  };
  const body: Layer = (c) => {
    if (side) {
      blob(c, cx - 3, by + 1, 12, 5.5, p.base, p.baseD, p.baseL);
      ellipse(c, cx - 2, by + 4, 8, 2, p.whiteD);
    } else {
      blob(c, cx, by + 1, 13, 5.5, p.base, p.baseD, p.baseL);
      if (pose.dir === 'down') ellipse(c, cx, by + 4, 9, 2, p.whiteD);
    }
    if (extra && extra.kind === 'cape') px(c, cx - 8, by - 3, extra.c1, 16, 5);
  };
  const ears: Layer = (c) => {
    if (pose.dir === 'up') {
      for (const x of [cx - 6.5, cx + 6.5]) ellipse(c, x, hy - 7.5, 2.8, 2.8, p.baseD);
      return;
    }
    const xs = side ? [cx + 4, cx + 9] : [cx - 7, cx + 7];
    for (const x of xs) {
      ellipse(c, x, hy - 7.2, 2.8, 2.8, p.ear);
      ellipse(c, x, hy - 6.8, 1.6, 1.7, p.earIn);
    }
  };
  const headL: Layer = (c) => {
    if (pose.dir === 'up') {
      blob(c, cx, hy - 1, 9, 6.5, p.base, p.baseD);
      return;
    }
    const hx = side ? cx + 7 : cx;
    blob(c, hx, hy, side ? 8 : 9.5, 7.5, p.base, p.baseD, p.baseL);
    ellipse(c, hx - (side ? 5 : 8), hy + 3, 2.4, 2.4, p.base);
    if (!side) ellipse(c, hx + 8, hy + 3, 2.4, 2.4, p.base);
    if (side) snoutSide(c, hx, hy + 1, s, p);
  };
  const tailFront: Layer = (c) => {
    if (pose.dir === 'up') tail(c, [[cx + 1, groundY - 1], [cx + 3, groundY - 3], [cx + 5, groundY - 4], [cx + 7, groundY - 5]], 3, p);
  };
  const decorate: Layer = (c) => {
    const hx = side ? cx + 7 : cx;
    if (pose.dir === 'down') faceFront(c, hx, hy, s, pose.expr, p, true);
    else if (side) {
      faceSide(c, hx, hy, s, pose.expr, p, true);
      px(c, Math.round(hx + 9.6), Math.round(hy + 2.2), INK, 2, 2);
    } else px(c, cx - 1, hy - 7, p.stripe, 3, 5);
    if (extra && extra.kind !== 'cape') bodyAcc(c, extra.kind, extra.c1, extra.c2, hx, hy + 9, 6, pose.dir === 'down' ? 'front' : side ? 'side' : 'back');
    if (head) headAcc(c, head.kind, head.c1, head.c2, hx, Math.round(hy - 8), 8, pose.dir === 'down' ? 'front' : side ? 'side' : 'back');
  };
  const canvas = stack(W, H, [tailLayer, paws, body, ears, headL, tailFront], decorate);
  return pose.dir === 'left' ? mirrorCanvas(canvas) : canvas;
}

// ------------------------------------------------------------------ sheets & portraits
const SPECS: Omit<Pose, 'bob'>[] = [
  { dir: 'down', legs: 'idle', expr: 'neutral' },
  { dir: 'down', legs: 'a', expr: 'neutral' },
  { dir: 'down', legs: 'b', expr: 'neutral' },
  { dir: 'up', legs: 'idle', expr: 'neutral' },
  { dir: 'up', legs: 'a', expr: 'neutral' },
  { dir: 'up', legs: 'b', expr: 'neutral' },
  { dir: 'right', legs: 'idle', expr: 'neutral' },
  { dir: 'right', legs: 'a', expr: 'neutral' },
  { dir: 'right', legs: 'b', expr: 'neutral' },
  { dir: 'left', legs: 'idle', expr: 'neutral' },
  { dir: 'left', legs: 'a', expr: 'neutral' },
  { dir: 'left', legs: 'b', expr: 'neutral' },
  { dir: 'down', legs: 'idle', expr: 'blink' },
  { dir: 'down', legs: 'idle', expr: 'happy' },
  { dir: 'down', legs: 'idle', expr: 'surprised' },
  { dir: 'down', legs: 'idle', expr: 'sleep' },
  { dir: 'right', legs: 'idle', expr: 'blink' },
  { dir: 'left', legs: 'idle', expr: 'blink' },
  { dir: 'down', legs: 'idle', expr: 'sad' },
  { dir: 'down', legs: 'idle', expr: 'smug' },
  { dir: 'down', legs: 'idle', expr: 'neutral' },
  { dir: 'up', legs: 'idle', expr: 'neutral' },
  { dir: 'right', legs: 'idle', expr: 'neutral' },
  { dir: 'left', legs: 'idle', expr: 'neutral' },
  // action frames 24..29 (see EXTRA_POSES in characters.ts)
  { dir: 'down', legs: 'idle', expr: 'neutral', arms: 'cook1' },
  { dir: 'down', legs: 'idle', expr: 'happy', arms: 'cook2' },
  { dir: 'down', legs: 'idle', expr: 'happy', arms: 'wave1' },
  { dir: 'down', legs: 'idle', expr: 'happy', arms: 'wave2' },
  { dir: 'down', legs: 'idle', expr: 'neutral', arms: 'read' },
  { dir: 'down', legs: 'idle', expr: 'smug', sit: true },
];

export function raccoonFrame(a: Appearance, build: RaccoonBuild, pose: Pose): HTMLCanvasElement {
  return build === 'big' ? lying(a, pose) : standing(a, pose, build);
}

/** Sheet with the shared 24-frame layout. Returns the canvas and its frame size. */
export function buildRaccoonSheet(a: Appearance, build: RaccoonBuild): { canvas: HTMLCanvasElement; fw: number; fh: number } {
  const frames = SPECS.map((sp, i) => raccoonFrame(a, build, { ...sp, bob: sp.legs !== 'idle' ? -1 : i >= 20 && i < 24 ? 1 : sp.sit ? 1 : 0 }));
  const fw = frames[0].width;
  const fh = frames[0].height;
  const canvas = makeCanvas(fw * frames.length, fh);
  const g = ctx2d(canvas);
  frames.forEach((f, i) => g.drawImage(f, i * fw, 0));
  return { canvas, fw, fh };
}

/** Upscaled head-and-shoulders portrait (used when no illustrated portrait exists). */
export function buildRaccoonPortrait(a: Appearance, build: RaccoonBuild, expr: Expr, scale = 4): HTMLCanvasElement {
  const f = raccoonFrame(a, build, { dir: 'down', legs: 'idle', expr, bob: 0 });
  const out = makeCanvas(f.width * scale, f.height * scale);
  const o = ctx2d(out);
  o.drawImage(f, 0, 0, f.width * scale, f.height * scale);
  return out;
}
