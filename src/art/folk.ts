/**
 * "Folk" renderer: the detailed pixel-art villagers (animal folk and people) of the second art direction.
 * Frames are FOLK_W x FOLK_H (24x39 at the default scale) with the feet on the last rows. Each character is a data spec (species shape,
 * fur palette, outfit, accessories); the same code draws every direction, walking frame and expression.
 *
 * Each body part is drawn flat on its own canvas with a 3-tone shading pass (light top-left, shade bottom-right),
 * gets its own 1px dark contour and is stacked, so heads, ears, arms and tails separate like in the reference art.
 */
import type { Dir } from '../core/types';
import { ctx2d, makeCanvas, mix, px, shade, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';
import { plushFrame } from './plushRaccoon';
import { pipFrame } from './pip';
import { drawHeroAccessories, drawHeroFace, drawHeroHair, type FaceParams, type HeroSpec, type Kit } from './hero';

/**
 * Everything is designed on a 32x52 "design grid" and rasterised at FOLK_SCALE (0.75), so the sprites stay crisp
 * pixel art but come out chibi-sized (about 24x39 px, close to the previous characters).
 */
export const FOLK_SCALE = 0.75;
const K = FOLK_SCALE;
const DW = 32; // design frame width
const DH = 52; // design frame height
const DPAD = 8; // empty design rows above the figure: room for tall ears and hats
export const FOLK_W = Math.round(DW * K);
export const FOLK_H = Math.round(DH * K);
/** Transparent rows above the figure in the output frame (used for speech-bubble placement). */
export const FOLK_PAD = Math.round(DPAD * K);
let FW = DW; // design width of the character being drawn (wide characters get a wider frame)
let AX = DW / 2; // symmetry axis in design units

export type FolkExpr = 'neutral' | 'blink' | 'happy' | 'surprised' | 'sad' | 'smug' | 'sleep';
export type FolkArms = 'cook1' | 'cook2' | 'wave1' | 'wave2' | 'read';
export interface FolkPose { dir: Dir; legs: 'idle' | 'a' | 'b'; expr: FolkExpr; bob?: number; arms?: FolkArms; sit?: boolean }

// ------------------------------------------------------------------ spec
export type EarKind = 'pointy' | 'round' | 'long' | 'cat' | 'none';
export type TailKind = 'bushy' | 'ringed' | 'thin' | 'puff' | 'nub' | 'none';
export type HatKind = 'none' | 'bandana' | 'straw' | 'witch' | 'chef' | 'cap' | 'beret' | 'bow' | 'beanie' | 'headband';
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
  | { k: 'robeTrim'; c: string }
  // heroes
  | { k: 'hood'; c: string }
  | { k: 'pocket'; c: string }
  | { k: 'rib'; c: string }
  | { k: 'zip'; c: string; inner: string }
  | { k: 'stripesH'; c: string; vertical?: boolean }
  | { k: 'kimono'; c: string }
  | { k: 'tankNeck'; c: string }
  | { k: 'choker'; c: string }
  | { k: 'chain'; c: string; pendant?: boolean }
  | { k: 'scarf'; c: string; c2: string }
  | { k: 'cape'; c: string; c2: string }
  | { k: 'bag'; c: string; c2: string; kind: string };

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
  wide?: number; // extra body half-width (Pip)
  frameW?: number; // frame width override (wide characters)
  earColor?: string; // ears in another colour than the face (hair-coloured ears)
  belly?: { c: string; rx?: number; ry?: number; y?: number };
  /** drawn by plushRaccoon.ts instead of the shared parts: body size and the traits that tell the plush raccoons apart */
  plush?: { size: 'big' | 'small'; stripe?: string; brow?: string; earOuter?: string; cheek?: string; ring?: string; darkLimbs?: boolean; tailK?: number };
  human?: boolean; // human face: no snout, small nose, brows
  humanEars?: boolean;
  hero?: HeroSpec; // playable hero: detailed hair / face / outfit parameters
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
  // sample the analytic shape at the centre of every OUTPUT pixel: crisp edges, no blur
  for (let y = Math.floor(box.y0 * K); y < Math.ceil(box.y1 * K); y++)
    for (let x = Math.floor(box.x0 * K); x < Math.ceil(box.x1 * K); x++) {
      const dx = (x + 0.5) / K;
      const dy = (y + 0.5) / K;
      if (!inside(dx, dy)) continue;
      const u = (dx - box.x0) / w; // 0..1
      const v = (dy - box.y0) / h;
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

/** a rectangle given in design units, drawn at least 1 output pixel wide/tall */
const dot = (c: Ctx, x: number, y: number, col: string, w = 1, h = 1) => {
  const x0 = Math.round(x * K);
  const y0 = Math.round(y * K);
  px(c, x0, y0, col, Math.max(1, Math.round((x + w) * K) - x0), Math.max(1, Math.round((y + h) * K) - y0));
};

/** each part on its own canvas, 1px contour, stacked */
type Layer = ((c: Ctx) => void) & { inner?: string };

function stack(spec: FolkSpec, layers: Layer[], after?: (c: Ctx) => void): HTMLCanvasElement {
  const OW = Math.round(FW * K);
  const out = makeCanvas(OW, FOLK_H);
  const o = ctx2d(out);
  const ink = spec.ink ?? '#2c2230';
  for (const l of layers) {
    const cv = makeCanvas(OW, FOLK_H);
    const g = ctx2d(cv);
    g.translate(0, FOLK_PAD);
    l(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // contour
    const img = g.getImageData(0, 0, OW, FOLK_H);
    const a = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < OW && y < FOLK_H && a[(y * OW + x) * 4 + 3] > 0;
    const pts: number[] = [];
    for (let y = 0; y < FOLK_H; y++)
      for (let x = 0; x < OW; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push(x, y);
    // a layer with `inner` (the hair) only gets the dark ink where it borders empty space; over other parts it uses its own soft colour
    const under = l.inner ? o.getImageData(0, 0, OW, FOLK_H).data : null;
    for (let i = 0; i < pts.length; i += 2) {
      g.fillStyle = under && under[(pts[i + 1] * OW + pts[i]) * 4 + 3] > 0 ? l.inner! : ink;
      g.fillRect(pts[i], pts[i + 1], 1, 1);
    }
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
let EXPR: FolkExpr = 'neutral';

/** primitives handed to the hero drawing routines (hero.ts) */
const kit = (): Kit => ({ K, AX, fill, ell, rect, tri, boxOf, dot });

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
  headP: number; // head outline squareness
}

const HERO_RY = [9.6, 10.2, 9.7]; // round / oval / square: the chin stays put, the forehead gets taller

function geo(spec: FolkSpec, pose: FolkPose, side: boolean): Geo {
  const dy = (pose.bob ?? 0) + (pose.sit ? 4 : 0);
  const h = spec.hero;
  const face = h?.look.face ?? 1;
  return {
    dy,
    headCx: side ? AX + 0.5 : AX,
    headCy: (h ? 27.1 - (HERO_RY[face] ?? 9.7) : 18.4) + dy,
    headRx: h ? (side ? 10.2 : [11.8, 11, 11.4][face] ?? 11) : side ? 11 : 12.2,
    headRy: h ? HERO_RY[face] ?? 9.7 : 9.6,
    headP: h ? [2.1, 2.3, 3][face] ?? 2.3 : spec.humanEars ? 2.3 : 2.5,
    torsoTop: (h ? 26.8 : 26.6) + dy,
    torsoBot: 34.6 + (pose.sit ? 3 : 0),
    hw: (side ? 4.8 : 6) + (spec.wide ?? 0) * (side ? 0.6 : 1),
    legTop: 33.8 + (pose.sit ? 3 : 0),
  };
}

// ------------------------------------------------------------------ ears
function earsLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  if (spec.ears === 'none') return;
  const { headCx: cx, headCy: cy } = g;
  const inner = spec.innerEar ?? shade(spec.fur, 0.35);
  const sides = view === 'side' ? [-1] : [-1, 1];
  const earFur = spec.earColor ?? spec.fur;
  const shift = view === 'side' ? -4.5 : 0;
  for (const s of sides) {
    const ex = cx + s * (view === 'side' ? 0 : 7.2) + shift;
    if (spec.ears === 'round') {
      const bx = view === 'side' ? cx - 3 : ex;
      const by = cy - 7.8;
      fill(c, boxOf(bx, by, 3.7, 3.5), ell(bx, by, 3.7, 3.5), earFur);
      if (view !== 'back') fill(c, boxOf(bx, by + 0.4, 2, 2), ell(bx, by + 0.4, 2, 2), inner, { flat: true });
    } else if (spec.ears === 'pointy' || spec.ears === 'cat') {
      const out = spec.ears === 'cat' ? 8.8 : 9.4;
      const bx = view === 'side' ? cx - 3 : ex;
      const lean = view === 'side' ? 1 : s * 1.6;
      const top = cy - 15.2;
      const t = tri(bx - 4.4, cy - 6.4, bx + 4.4, cy - 6.4, bx + lean * 1.4, top);
      fill(c, { x0: bx - 4.6, y0: top, x1: bx + 4.6, y1: cy - 5 }, t, earFur);
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
        fill(c, { x0: bx - 8, y0: cy - 22, x1: bx + 8, y1: cy - 6 }, test, earFur);
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
// Faces are drawn straight in OUTPUT pixels (not design units) so both eyes always match exactly.
function faceFront(spec: FolkSpec, g: Geo, expr: FolkExpr, c: Ctx) {
  const { headCx, headCy } = g;
  const cx = Math.round(headCx * K);
  const cyo = headCy * K;
  const ey = Math.round(cyo - 1.7);
  const eyeCol = spec.eye;
  // mask + muzzle are soft shapes (design units)
  const mask = spec.mask;
  const dcy = headCy;
  if (mask) {
    for (const s of [-1, 1]) {
      const mx = headCx + s * 6;
      fill(c, boxOf(mx, dcy + 0.4, 5.2, 4.2), ell(mx, dcy + 0.4, 5.2, 4.2, 2.2), mask, { flat: true });
    }
    fill(c, boxOf(headCx, dcy, 2, 3.4), rect(headCx - 2, dcy - 2.6, headCx + 2, dcy + 3), mask, { flat: true });
  }
  if (spec.furLight) fill(c, boxOf(headCx, dcy + 5.6, 5.8, 3.8), ell(headCx, dcy + 5.6, 5.8, 3.8, 2.2), spec.furLight, { lt: shade(spec.furLight, 0.1), dk: shade(spec.furLight, -0.1) });
  if (spec.headMark) fill(c, boxOf(headCx, dcy - 7, 1.6, 2.5), rect(headCx - 1.6, dcy - 9, headCx + 1.6, dcy - 5), spec.headMark, { flat: true });
  for (const left of [true, false]) {
    const x0 = left ? cx - 6 : cx + 3;
    switch (expr) {
      case 'blink':
      case 'sleep':
        px(c, x0, ey + 2, eyeCol, 3, 1);
        break;
      case 'happy':
        px(c, x0, ey + 2, eyeCol);
        px(c, x0 + 1, ey + 1, eyeCol);
        px(c, x0 + 2, ey + 2, eyeCol);
        break;
      case 'surprised':
        px(c, x0, ey - 1, eyeCol, 3, 5);
        px(c, x0, ey - 1, '#ffffff');
        break;
      case 'sad':
        px(c, x0, ey, eyeCol, 3, 4);
        px(c, x0, ey, '#ffffff');
        px(c, x0 + (left ? 1 : 0), ey - 2, eyeCol, 2, 1);
        break;
      case 'smug':
        px(c, x0, ey + 1, eyeCol, 3, 3);
        px(c, x0, ey + 1, shade(spec.fur, -0.12), 3, 1);
        break;
      default:
        px(c, x0, ey, eyeCol, 3, 4);
        px(c, x0, ey, '#ffffff');
        px(c, x0 + 2, ey + 3, shade(eyeCol, 0.3));
    }
  }
  if (spec.blush && expr !== 'sad') {
    px(c, cx - 8, ey + 3, spec.blush, 2, 1);
    px(c, cx + 6, ey + 3, spec.blush, 2, 1);
  }
  const ny = ey + 4;
  px(c, cx - 1, ny, spec.nose, 2, 1);
  const my = ny + 2;
  const mc = shade(spec.nose, -0.1);
  if (expr === 'happy') {
    px(c, cx - 2, my, mc);
    px(c, cx + 1, my, mc);
    px(c, cx - 1, my + 1, mc, 2, 1);
  } else if (expr === 'surprised') px(c, cx - 1, my, mc, 2, 2);
  else if (expr === 'sad') {
    px(c, cx - 1, my, mc, 2, 1);
    px(c, cx - 2, my + 1, mc);
    px(c, cx + 1, my + 1, mc);
  } else if (expr === 'smug') {
    px(c, cx - 2, my + 1, mc, 3, 1);
    px(c, cx + 1, my, mc);
  } else {
    px(c, cx - 2, my, mc);
    px(c, cx - 1, my + 1, mc, 2, 1);
    px(c, cx + 1, my, mc);
  }
  if (spec.glasses) {
    for (const left of [true, false]) {
      const x0 = (left ? cx - 6 : cx + 3) - 1;
      px(c, x0, ey - 1, spec.glasses, 5, 1);
      px(c, x0, ey + 4, spec.glasses, 5, 1);
      px(c, x0, ey - 1, spec.glasses, 1, 6);
      px(c, x0 + 4, ey - 1, spec.glasses, 1, 6);
    }
    px(c, cx - 1, ey + 1, spec.glasses, 2, 1);
  }
}

function faceHuman(spec: FolkSpec, g: Geo, expr: FolkExpr, c: Ctx, view: 'front' | 'side') {
  const { headCx, headCy } = g;
  const cx = Math.round(headCx * K);
  const ey = Math.round(headCy * K - 1.2);
  const skin = spec.fur;
  const brow = spec.hair?.c ?? shade(skin, -0.4);
  const xs = view === 'front' ? [cx - 5, cx + 3] : [cx + 3];
  for (const x0 of xs) {
    if (expr === 'blink' || expr === 'sleep') px(c, x0, ey + 2, spec.eye, 2, 1);
    else if (expr === 'happy') {
      px(c, x0, ey + 2, spec.eye);
      px(c, x0 + 1, ey + 1, spec.eye);
    } else {
      px(c, x0, ey + (expr === 'surprised' ? 0 : 1), spec.eye, 2, expr === 'surprised' ? 4 : 3);
      px(c, x0, ey + (expr === 'surprised' ? 0 : 1), '#ffffff');
    }
    px(c, x0 - 1, ey - (expr === 'surprised' ? 2 : 0) + (expr === 'sad' ? 1 : 0), brow, 3, 1);
  }
  if (spec.blush) for (const bx of view === 'front' ? [cx - 8, cx + 6] : [cx + 1]) px(c, bx, ey + 3, spec.blush, 2, 1);
  const nx = view === 'front' ? cx - 1 : cx + 6;
  px(c, nx, ey + 3, shade(skin, -0.22), 2, 2);
  if (spec.beard) {
    const bc = spec.beard;
    const bx = view === 'front' ? headCx : headCx + 2.4;
    const test: Test = (x, y) => y >= headCy + 4 && ell(bx, headCy + 3, view === 'front' ? 9 : 5.8, 7.2, 2)(x, y) && !(view === 'front' && Math.abs(x - bx) < 2.2 && y < headCy + 6.4) && x < headCx + 9.6;
    fill(c, { x0: bx - 10, y0: headCy + 3, x1: bx + 10, y1: headCy + 12 }, test, bc, { lt: shade(bc, 0.2) });
    if (view === 'front') px(c, cx - 3, ey + 4, bc, 6, 1);
  }
  const mx = view === 'front' ? cx - 1 : cx + 5;
  const my = ey + 6;
  const mc = spec.beard ? shade(spec.beard, -0.45) : shade(skin, -0.4);
  if (expr === 'happy') {
    px(c, mx - 1, my, mc);
    px(c, mx, my + 1, mc, 2, 1);
    px(c, mx + 2, my, mc);
  } else if (expr === 'surprised') px(c, mx, my, mc, 2, 2);
  else if (expr === 'sad') {
    px(c, mx, my, mc, 2, 1);
    px(c, mx - 1, my + 1, mc);
    px(c, mx + 2, my + 1, mc);
  } else px(c, mx, my, mc, 2, 1);
  if (spec.glasses) {
    for (const x0 of xs) {
      const gx = x0 - 1;
      px(c, gx, ey - 1, spec.glasses, 4, 1);
      px(c, gx, ey + 3, spec.glasses, 4, 1);
      px(c, gx, ey - 1, spec.glasses, 1, 5);
      px(c, gx + 3, ey - 1, spec.glasses, 1, 5);
    }
    if (view === 'front') px(c, cx - 1, ey + 1, spec.glasses, 2, 1);
  }
}

function faceSide(spec: FolkSpec, g: Geo, expr: FolkExpr, c: Ctx) {
  const { headCx, headCy } = g;
  const cx = Math.round(headCx * K);
  const ey = Math.round(headCy * K - 1.7);
  const ex = cx + 3;
  const dcy = headCy;
  if (spec.mask) fill(c, boxOf(headCx + 4.4, dcy + 0.4, 5.2, 4.2), ell(headCx + 4.4, dcy + 0.4, 5.2, 4.2, 2.2), spec.mask, { flat: true });
  if (spec.furLight) fill(c, boxOf(headCx + 7.4, dcy + 5.2, 4.6, 3.4), ell(headCx + 7.4, dcy + 5.2, 4.6, 3.4, 2.2), spec.furLight, { lt: shade(spec.furLight, 0.1), dk: shade(spec.furLight, -0.1) });
  if (spec.headMark) fill(c, boxOf(headCx + 3, dcy - 7, 2, 2), rect(headCx + 1, dcy - 9, headCx + 5, dcy - 5), spec.headMark, { flat: true });
  if (expr === 'blink' || expr === 'sleep') px(c, ex, ey + 2, spec.eye, 3, 1);
  else if (expr === 'happy') {
    px(c, ex, ey + 2, spec.eye);
    px(c, ex + 1, ey + 1, spec.eye);
    px(c, ex + 2, ey + 2, spec.eye);
  } else {
    px(c, ex, ey - (expr === 'surprised' ? 1 : 0), spec.eye, 2, expr === 'surprised' ? 5 : 4);
    px(c, ex, ey - (expr === 'surprised' ? 1 : 0), '#ffffff');
  }
  if (spec.blush) px(c, ex - 3, ey + 3, spec.blush, 2, 1);
  px(c, cx + 7, ey + 3, spec.nose, 2, 2);
  px(c, cx + 5, ey + 6, shade(spec.nose, -0.1), 2, 1);
  if (spec.glasses) {
    px(c, ex - 1, ey - 1, spec.glasses, 4, 1);
    px(c, ex - 1, ey + 4, spec.glasses, 4, 1);
    px(c, ex - 1, ey - 1, spec.glasses, 1, 6);
    px(c, ex + 2, ey - 1, spec.glasses, 1, 6);
  }
}

// ------------------------------------------------------------------ hair (people) and hats
function hairLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  if (spec.hero) {
    const hh = spec.hero;
    drawHeroHair(kit(), c, g, view, hh.hair, hh.hairColor, hh.hairHi, spec.fur);
    return;
  }
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
    if (view === 'front')
      for (const s of [-1, 1]) fill(c, { x0: cx + s * rx - 2.4, y0: cy - 3, x1: cx + s * rx + 2.4, y1: cy + 6 }, rect(cx + s * rx - (s > 0 ? 3 : 1.9), cy - 3, cx + s * rx + (s > 0 ? 1.9 : 3), cy + 6.5), col, { lt });
    if (view === 'back') fill(c, boxOf(cx, cy + 1, rx, ry - 1), ell(cx, cy + 1, rx, ry - 0.8, 2.4), col, { lt });
    if (view === 'side') fill(c, { x0: cx - rx - 1, y0: cy - 2, x1: cx, y1: cy + 7 }, (x, y) => x < cx - 2.4 && x > cx - rx - 0.6 && y > cy - 4 && y < cy + 6.5, col, { lt });
    return;
  }
  if (h.kind === 'short') {
    const top: Test = (x, y) => ell(cx, cy, rx + 0.5, ry + 0.5, 2.4)(x, y) && (y < cy - 3.4 || (view === 'back' && y < cy + 4));
    fill(c, { x0: cx - rx - 1, y0: cy - ry - 1, x1: cx + rx + 1, y1: cy + 6 }, top, col, { lt });
    if (view !== 'back') for (const s of [-1, 1]) fill(c, { x0: cx + s * rx - 2, y0: cy - 4, x1: cx + s * rx + 2, y1: cy + 4 }, rect(cx + s * (rx - 0.6) - (s > 0 ? 1.2 : 0.6), cy - 4, cx + s * (rx - 0.6) + (s > 0 ? 0.6 : 1.2), cy + 3), col, { lt });
    return;
  }
  // bob: side-swept fringe, hair down to the jaw
  const outer: Test = (x, y) =>
    ell(cx, cy, rx + 0.9, ry + 0.9, 2.4)(x, y) &&
    (view === 'side' ? y < cy - 3 || (x < cx - 1.6 && y < cy + 8) : y < cy - 2.8 || (view === 'back' && y < cy + 7) || Math.abs(x - cx) > rx - 1.8);
  fill(c, { x0: cx - rx - 1, y0: cy - ry - 1, x1: cx + rx + 1, y1: cy + 8 }, outer, col, { lt });
  if (view === 'front') {
    const cut: Test = (x, y) => y > cy - 4 && y < cy + 4 && Math.abs(x - cx) < rx - 3;
    // face window is drawn after (face layer sits on top), so only trim the fringe diagonal
    void cut;
  }
}

function hatLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  const item = CUSTOM?.head ?? spec.hero?.headItem;
  const hat = CUSTOM?.head ? undefined : spec.hat;
  if (item) {
    const t = g.headCy - g.headRy;
    headAcc(c, item.kind, item.c1, item.c2, Math.round(g.headCx * K), Math.round(t * K) - 1, 8, view);
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
    case 'beanie': {
      const lim = top + 5.2;
      fill(c, { x0: cx - rx - 1, y0: top - 3, x1: cx + rx + 1, y1: lim + 2 }, (x, y) => ell(cx, cy - 0.6, rx + 0.9, ry + 1.3, 2.3)(x, y) && y < lim, col, { lt: shade(col, 0.16) });
      fill(c, { x0: cx - rx - 1, y0: lim - 2.4, x1: cx + rx + 1, y1: lim + 1.2 }, (x, y) => ell(cx, cy - 0.6, rx + 1.1, ry + 1.5, 2.3)(x, y) && y >= lim - 2.4 && y < lim + 1.2, c2, { flat: true });
      if (view !== 'back') for (let i = 0; i < 4; i++) dot(c, cx - rx + 2 + i * ((rx * 2 - 4) / 3), lim - 2.1, shade(c2, -0.22), 1, 3);
      break;
    }
    case 'headband': {
      const band: Test = (x, y) => ell(cx, cy, rx + 0.5, ry + 0.5, 2.3)(x, y) && y >= top + 3.4 && y < top + 5.6;
      fill(c, { x0: cx - rx - 1, y0: top + 3, x1: cx + rx + 1, y1: top + 6 }, band, col, { flat: true });
      if (view === 'front') dot(c, cx - rx + 1.4, top + 3.6, c2, 1.6, 1);
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
  const bottom = 40.8;
  const sit = !!pose.sit;
  const hero = spec.hero;
  const mk = (x0: number, w0: number, y1: number) => {
    let w = w0;
    if (hero) {
      const wide = hero.legMode === 'wide' ? 1.2 : 0;
      x0 -= wide / 2;
      w += wide;
      if (hero.legMode === 'shorts') {
        fill(c, { x0, y0: top, x1: x0 + w, y1 }, rect(x0, top, x0 + w, y1), spec.fur);
        fill(c, { x0: x0 - 0.3, y0: top, x1: x0 + w + 0.3, y1: top + 4.4 }, rect(x0 - 0.3, top, x0 + w + 0.3, top + 4.4), lc);
      } else fill(c, { x0, y0: top, x1: x0 + w, y1 }, rect(x0, top, x0 + w, y1), lc);
      const k = hero.shoeKind;
      const sy = k === 'boot' ? y1 - 4.4 : k === 'sandal' ? y1 - 1.2 : Math.max(top + 1, y1 - 1.9);
      if (k === 'sandal') {
        fill(c, { x0: x0 - 0.5, y0: y1 - 1, x1: x0 + w + 0.5, y1: y1 + 1 }, rect(x0 - 0.5, y1 - 0.6, x0 + w + 0.5, y1 + 1), spec.shoes);
        dot(c, x0, y1 - 1.8, hero.shoeAccent, w, 0.9);
        return;
      }
      const ww = k === 'slipper' ? 0.9 : 0.5;
      fill(c, { x0: x0 - ww, y0: sy, x1: x0 + w + ww, y1: y1 + 1 }, rect(x0 - ww, sy, x0 + w + ww, y1 + 1), spec.shoes);
      if (k === 'sneaker') {
        dot(c, x0 - 0.5, y1 + 0.1, hero.shoeAccent, w + 1, 0.9);
        dot(c, x0 + 0.4, sy + 0.4, shade(spec.shoes, 0.35), w - 0.8, 0.8);
      } else if (k === 'boot') dot(c, x0 - 0.5, sy, hero.shoeAccent, w + 1, 0.9);
      else dot(c, x0 - 0.5, sy, hero.shoeAccent, w + 1.8, 1.2);
      return;
    }
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
    const wd = (spec.wide ?? 0) * 0.6;
    mk(AX - 5.4 - wd, 4.6 + wd * 0.3, bottom - lift('l'));
    mk(AX + 0.8 + wd, 4.6 + wd * 0.3, bottom - lift('r'));
  }
}

function skirtLayer(spec: FolkSpec, g: Geo, view: 'front' | 'side' | 'back', c: Ctx) {
  if (spec.legs !== 'skirt' && spec.legs !== 'robe') return;
  const hem = spec.legs === 'robe' ? 40 : 37;
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
  const pear = !spec.hero && (spec.wide ?? 0) > 1;
  const test: Test = (x, y) => {
    if (y < g.torsoTop || y >= g.torsoBot) return false;
    if (pear) {
      const cyb = g.torsoTop + 4.6;
      const k = (y - cyb) / 5;
      return Math.abs(x - cx) <= hw * Math.sqrt(Math.max(0, 1 - k * k)) + 0.4;
    }
    const t = (y - g.torsoTop) / (g.torsoBot - g.torsoTop);
    const half = hw * (0.78 + 0.22 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5)) + (t > 0.7 ? 0.3 : 0);
    return Math.abs(x - cx) <= half;
  };
  fill(c, { x0: cx - hw - 1, y0: g.torsoTop, x1: cx + hw + 1, y1: g.torsoBot }, test, spec.top, { lt: spec.topLight });
  if (spec.belly && view !== 'back') {
    const b = spec.belly;
    const bcx = view === 'side' ? cx + 1.2 : cx;
    const rx = (b.rx ?? hw - 1.8) * (view === 'side' ? 0.55 : 1);
    const ry = b.ry ?? 4.6;
    const by = g.torsoTop + (b.y ?? 5.4);
    fill(c, boxOf(bcx, by, rx, ry), ell(bcx, by, rx, ry, 2.2), b.c, { lt: shade(b.c, 0.08), dk: shade(b.c, -0.1) });
  }
  if (CUSTOM?.extra) {
    bodyAcc(c, CUSTOM.extra.kind, CUSTOM.extra.c1, CUSTOM.extra.c2, Math.round(cx * K), Math.round((g.torsoTop + 7) * K), Math.round(hw * K) + 1, view);
    return;
  }
  // decorations that live on the torso (hidden from the back unless noted)
  for (const d of spec.deco ?? []) {
    if (view === 'back' && !(d.k === 'strap' || d.k === 'shawl' || d.k === 'apron' || d.k === 'bib' || d.k === 'vest' || d.k === 'robeTrim' || d.k === 'belt' || d.k === 'rib' || d.k === 'hood' || d.k === 'stripesH' || d.k === 'cape' || d.k === 'bag' || d.k === 'scarf' || d.k === 'choker')) continue;
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
      case 'hood': {
        const hy = g.torsoTop + 0.6;
        const hr = view === 'side' ? 3.6 : hw - 0.8;
        const hx = view === 'side' ? cx - 0.8 : cx;
        fill(c, boxOf(hx, hy + 1, hr, 2.8), (x, y) => ell(hx, hy + 1, hr, 2.8, 2.2)(x, y) && y >= g.torsoTop, d.c, { lt: shade(d.c, 0.12) });
        if (view === 'front') {
          dot(c, cx - 2.6, hy + 3, shade(d.c, 0.3), 1, 4.4);
          dot(c, cx + 1.6, hy + 3, shade(d.c, 0.3), 1, 4.4);
        }
        break;
      }
      case 'pocket':
        if (view === 'front') {
          const py = g.torsoBot - 5.6;
          fill(c, { x0: cx - hw + 1.4, y0: py, x1: cx + hw - 1.4, y1: g.torsoBot }, (x, y) => y >= py && y < g.torsoBot - 0.4 && Math.abs(x - cx) <= hw - 1.6 - (y < py + 1.2 ? 0 : 0), d.c, { flat: true });
          dot(c, cx - 0.4, py + 0.4, shade(d.c, -0.22), 0.8, 4.4);
        }
        break;
      case 'rib': {
        const half = view === 'side' ? 4.2 : hw + 0.2;
        dot(c, cx - half, g.torsoBot - 1.5, d.c, half * 2, 1.5);
        if (view === 'front') {
          fill(c, boxOf(cx, g.torsoTop + 0.4, 3.8, 1.4), (x, y) => ell(cx, g.torsoTop - 0.6, 3.8, 2.2, 2)(x, y) && y >= g.torsoTop, shade(d.c, 0.08), { flat: true });
        }
        break;
      }
      case 'zip':
        if (view === 'front') {
          fill(c, boxOf(cx, g.torsoTop + 1.2, 2.2, 2), tri(cx - 2.4, g.torsoTop, cx + 2.4, g.torsoTop, cx, g.torsoTop + 3.4), d.inner, { flat: true });
          dot(c, cx - 0.4, g.torsoTop + 3.2, shade(d.c, -0.35), 0.8, g.torsoBot - g.torsoTop - 3.2);
        }
        break;
      case 'stripesH': {
        const top = g.torsoTop + 1;
        const half = view === 'side' ? 4.4 : hw;
        if (d.vertical) {
          for (let y = top; y < g.torsoBot - 0.5; y += 3.6) dot(c, cx - half + 0.5, y, d.c, half * 2 - 1, 0.9);
          for (let x = cx - half + 1; x < cx + half - 0.5; x += 3.4) dot(c, x, top, d.c, 0.9, g.torsoBot - top - 0.5);
        } else {
          for (let y = top + 1.4; y < g.torsoBot - 0.5; y += 3) dot(c, cx - half + 0.4, y, d.c, half * 2 - 0.8, 1.2);
        }
        break;
      }
      case 'kimono':
        if (view === 'front') {
          for (let i = 0; i < 9; i++) {
            const t = i / 8;
            dot(c, cx - hw + 0.8 + t * (hw - 0.8), g.torsoTop + t * 7, d.c, 1.6, 1.4);
            dot(c, cx + hw - 2.4 - t * (hw - 0.8), g.torsoTop + t * 7, shade(d.c, -0.1), 1.6, 1.4);
          }
          dot(c, cx - hw, g.torsoBot - 3.4, d.c, hw * 2, 1.8);
        }
        break;
      case 'tankNeck':
        if (view !== 'side') fill(c, boxOf(cx, g.torsoTop + 0.8, 4.2, 3), (x, y) => ell(cx, g.torsoTop - 0.8, 4.6, 4.4, 2)(x, y) && y >= g.torsoTop, d.c, { flat: true });
        break;
      case 'choker':
        if (view === 'front') dot(c, cx - 3.4, g.torsoTop + 0.7, d.c, 6.8, 1.1);
        else if (view === 'side') dot(c, cx - 1.6, g.torsoTop + 0.7, d.c, 4, 1.1);
        else dot(c, cx - 3.4, g.torsoTop + 0.7, d.c, 6.8, 1.1);
        break;
      case 'chain':
        if (view === 'front') {
          for (const [dx, dy] of [[-3.4, 0.5], [-2.6, 1.5], [-1.6, 2.4], [-0.5, 2.9], [0.6, 2.9], [1.6, 2.4], [2.6, 1.5], [3.4, 0.5]]) dot(c, cx + dx, g.torsoTop + 0.8 + dy, d.c, 1, 0.9);
          if (d.pendant) dot(c, cx - 0.6, g.torsoTop + 4.4, shade(d.c, 0.2), 1.4, 1.8);
        } else if (view === 'side') dot(c, cx + 1.2, g.torsoTop + 1.2, d.c, 1, 2.2);
        break;
      case 'scarf': {
        const sw = view === 'side' ? 4.2 : hw + 0.6;
        fill(c, { x0: cx - sw, y0: g.torsoTop - 0.4, x1: cx + sw, y1: g.torsoTop + 3.8 }, (x, y) => y >= g.torsoTop - 0.2 && y < g.torsoTop + 3.4 && Math.abs(x - cx) <= sw, d.c, { lt: shade(d.c, 0.14) });
        if (view !== 'back') {
          dot(c, cx + 1.2, g.torsoTop + 3, d.c2, 2.6, 6.2);
          for (let i = 0; i < 2; i++) dot(c, cx + 1.2, g.torsoTop + 5 + i * 2.2, shade(d.c, 0.25), 2.6, 0.8);
        }
        break;
      }
      case 'cape':
        if (view === 'back') {
          fill(c, { x0: cx - hw - 3, y0: g.torsoTop, x1: cx + hw + 3, y1: g.torsoBot + 7 }, (x, y) => y >= g.torsoTop && y < g.torsoBot + 6.4 && Math.abs(x - cx) <= hw + 0.6 + (y - g.torsoTop) * 0.22, d.c, { lt: shade(d.c, 0.12) });
          dot(c, cx - 0.4, g.torsoTop + 1, d.c2, 0.8, g.torsoBot - g.torsoTop + 4);
        } else if (view === 'front') {
          dot(c, cx - hw - 0.4, g.torsoTop + 0.4, d.c, 2.2, 4.4);
          dot(c, cx + hw - 1.8, g.torsoTop + 0.4, d.c, 2.2, 4.4);
          dot(c, cx - 3, g.torsoTop + 1, d.c2, 6, 0.9);
          dot(c, cx - 0.8, g.torsoTop + 1.8, '#f2c66d', 1.6, 1.6);
        } else dot(c, cx - 5, g.torsoTop + 0.6, d.c, 3, g.torsoBot - g.torsoTop + 2.4);
        break;
      case 'bag':
        if (d.kind === 'satchel') {
          if (view !== 'side') {
            const diag: Test = (x, y) => y >= g.torsoTop && y < g.torsoBot && Math.abs(x - (cx - hw + 1 + ((y - g.torsoTop) / (g.torsoBot - g.torsoTop)) * (hw * 2 - 2))) < 0.8;
            fill(c, { x0: cx - hw, y0: g.torsoTop, x1: cx + hw, y1: g.torsoBot }, diag, d.c2, { flat: true });
          }
          if (view !== 'back') fill(c, { x0: cx + hw - 5, y0: g.torsoBot - 4.4, x1: cx + hw + 1.6, y1: g.torsoBot + 2.4 }, rect(cx + hw - 5, g.torsoBot - 4, cx + hw + 1.4, g.torsoBot + 2.2), d.c);
        } else if (view === 'front') {
          dot(c, cx - hw + 1.6, g.torsoTop, d.c2, 1.4, g.torsoBot - g.torsoTop - 1);
          dot(c, cx + hw - 3, g.torsoTop, d.c2, 1.4, g.torsoBot - g.torsoTop - 1);
        } else if (view === 'back') {
          fill(c, { x0: cx - hw, y0: g.torsoTop + 0.6, x1: cx + hw, y1: g.torsoBot + 2 }, rect(cx - hw + 0.4, g.torsoTop + 0.6, cx + hw - 0.4, g.torsoBot + 1.6), d.c, { lt: shade(d.c, 0.14) });
          dot(c, cx - hw + 1.8, g.torsoBot - 3.6, d.c2, hw * 2 - 3.6, 3);
          dot(c, cx - hw + 0.4, g.torsoTop + 0.6, d.c2, 1.2, 4);
          dot(c, cx + hw - 1.6, g.torsoTop + 0.6, d.c2, 1.2, 4);
        } else fill(c, { x0: cx - 8, y0: g.torsoTop, x1: cx - 2, y1: g.torsoBot + 2 }, rect(cx - 7.2, g.torsoTop + 0.8, cx - 2.2, g.torsoBot + 1.6), d.c, { lt: shade(d.c, 0.14) });
        break;
    }
  }
}

function armLayer(spec: FolkSpec, g: Geo, pose: FolkPose, view: 'front' | 'side' | 'back', c: Ctx, which: 'l' | 'r' | 'both') {
  const top = g.torsoTop + 1.2;
  const swing = pose.legs === 'idle' ? 0 : 1;
  const hero = spec.hero;
  const sleeve = hero ? hero.sleeveColor : spec.top;
  const hand = spec.fur;
  const mk = (x: number, y0: number, h: number, handUp = false) => {
    if (hero) {
      const mode = hero.sleeves;
      const sl = mode === 'none' ? 0 : mode === 'short' ? 3 : h - 2.6;
      const w = mode === 'wide' ? 4.2 : 3;
      const x1 = mode === 'wide' ? x - 0.6 : x;
      fill(c, { x0: x1, y0, x1: x1 + w, y1: y0 + h }, rect(x1, y0, x1 + w, y0 + h), hand);
      if (sl > 0) {
        fill(c, { x0: x1, y0, x1: x1 + w, y1: y0 + sl }, rect(x1, y0, x1 + w, y0 + sl), sleeve);
        if (hero.cuff && mode === 'long') dot(c, x1, y0 + sl - 1.4, hero.cuff, w, 1.4);
        if (mode === 'wide') dot(c, x1, y0 + sl - 1.2, shade(sleeve, -0.2), w, 1.2);
      }
      return;
    }
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
    mk(Math.round(ax), top, 7);
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
    if (L) mk(AX - hw - 1.4, top + 1, 7);
    if (R) {
      const wx = arms === 'wave1' ? AX + hw + 1.2 : AX + hw + 2.4;
      mk(wx, top - 7, 9);
    }
    return;
  }
  if (L) mk(AX - hw - 1.6, top + (pose.legs === 'a' ? 1 : 0) + 0.5 * swing, 7);
  if (R) mk(AX + hw - 1.4, top + (pose.legs === 'b' ? 1 : 0), 7);
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
  const sx = view === 'side' ? AX - 6.5 - (spec.wide ?? 0) * 0.5 : AX + 5.8 + (spec.wide ?? 0);
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
  const p = g.headP;
  fill(c, boxOf(cx, cy, rx, ry), ell(cx, cy, rx, ry, p), spec.fur, spec.hero ? { lt: shade(spec.fur, 0.05), dk: shade(spec.fur, -0.07) } : {});
  if (spec.humanEars && view !== 'back') {
    const ex = view === 'side' ? cx - 1 : cx + rx - 0.6;
    fill(c, boxOf(ex, cy + 1, 1.8, 2.4), ell(ex, cy + 1, 1.8, 2.4), spec.fur);
    if (view === 'front') fill(c, boxOf(cx - rx + 0.6, cy + 1, 1.8, 2.4), ell(cx - rx + 0.6, cy + 1, 1.8, 2.4), spec.fur);
  }
  const h = spec.hero;
  if (h && view !== 'back') {
    const l = h.look;
    const f: FaceParams = {
      skin: spec.fur, eye: spec.eye, eyeStyle: h.eyeStyle, brow: l.brow, browColor: l.browColor || shade(h.hairColor, -0.12),
      nose: l.nose, lips: l.lips, piercing: l.piercing ?? 0, freckles: l.freckles, mole: l.mole, blush: l.blush || h.blushItem, facial: l.facial,
      facialColor: shade(h.hairColor, -0.05),
    };
    drawHeroFace(kit(), c, g, view, f, EXPR);
  }
}

// ------------------------------------------------------------------ one frame
export function folkFrame(spec: FolkSpec, pose: FolkPose, custom?: FolkCustom): HTMLCanvasElement {
  if (spec.id === 'pip') return pipFrame(pose, custom, pose.legs === 'a' ? .25 : .75);
  CUSTOM = custom;
  EXPR = pose.expr;
  FW = spec.frameW ?? DW;
  AX = FW / 2;
  if (spec.plush) return plushFrame(spec, pose, custom, Math.round(FW * K), FOLK_H);
  const side = pose.dir === 'left' || pose.dir === 'right';
  const view: 'front' | 'side' | 'back' = pose.dir === 'down' ? 'front' : pose.dir === 'up' ? 'back' : 'side';
  const g = geo(spec, pose, side);
  const bodyLegs = (c: Ctx) => {
    if (spec.legs === 'skirt' || spec.legs === 'robe') {
      // short legs under the dress
      legsLayer({ ...spec, legsColor: spec.fur }, g, pose, view, c);
    } else legsLayer(spec, g, pose, view, c);
  };
  const hairL: Layer = (c) => hairLayer(spec, g, view, c);
  if (spec.hero) hairL.inner = shade(spec.hero.hairColor, -0.42);
  const layers: Layer[] = [
    (c) => tailLayer(spec, g, view, c, true),
    bodyLegs,
    (c) => skirtLayer(spec, g, view, c),
    (c) => torsoLayer(spec, g, view, c),
    (c) => armLayer(spec, g, pose, view, c, view === 'side' ? 'r' : 'both'),
    (c) => earsLayer(spec, g, view, c),
    (c) => headLayer(spec, g, view, c),
    hairL,
    (c) => hatLayer(spec, g, view, c),
    (c) => tailLayer(spec, g, view, c, false),
  ];
  // the face sits inside the head silhouette, drawn after the contour pass of the head
  const canvas = stack(spec, layers, (o) => {
    if (spec.hero) {
      const hh = spec.hero;
      drawHeroAccessories(kit(), o, g, view, { earrings: hh.look.earrings, glasses: hh.glasses, glassColor: hh.glassColor, skin: spec.fur });
    } else if (spec.human && view !== 'back') faceHuman(spec, g, pose.expr, o, view);
    else if (view === 'front') faceFront(spec, g, pose.expr, o);
    else if (view === 'side') faceSide(spec, g, pose.expr, o);
    if (pose.arms === 'read') {
      const by = g.torsoTop + 5;
      fill(o, { x0: AX - 4, y0: by, x1: AX + 4, y1: by + 6 }, rect(AX - 4, by, AX + 4, by + 5), '#e9d3a5', { lt: '#f6e7c4' });
      dot(o, AX, by, '#8a5a3c', 1, 5);
      dot(o, AX - 4, by + 4, '#8a5a3c', 8, 1);
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
  const fw = frames[0].width;
  const canvas = makeCanvas(fw * frames.length, FOLK_H);
  const g = ctx2d(canvas);
  frames.forEach((f, i) => g.drawImage(f, i * fw, 0));
  return { canvas, fw, fh: FOLK_H };
}

/** Head-and-shoulders portrait from the front frame, upscaled with crisp pixels. */
export function buildFolkPortrait(spec: FolkSpec, expr: FolkExpr, scale = 6, custom?: FolkCustom): HTMLCanvasElement {
  const f = folkFrame(spec, { dir: 'down', legs: 'idle', expr, bob: 0 }, custom);
  const top = 1;
  const h = 30;
  const out = makeCanvas(f.width * scale, h * scale);
  const o = ctx2d(out);
  o.imageSmoothingEnabled = false;
  o.drawImage(f, 0, top, f.width, h, 0, 0, f.width * scale, h * scale);
  return out;
}

void mix;
