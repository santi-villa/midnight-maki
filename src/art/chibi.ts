/**
 * Chibi renderer for the player and every villager (people and animal folk), matching the raccoons:
 * big round head, large glossy eyes, hair with a light sheen, rounded body, thick dark contour per part.
 * Supports every species, hair style, eye style and clothing piece of the customization system.
 * Frames are CW x CH px; the content is bottom-aligned (feet on the last rows).
 */
import type { Appearance, Dir, Species } from '../core/types';
import { CLOTHES_BY_ID } from '../data/clothes';
import { ctx2d, ellipse, makeCanvas, mix, outline, px, shade, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';

export const CW = 20;
export const CH = 30;

export type ChibiExpr = 'neutral' | 'blink' | 'happy' | 'surprised' | 'sad' | 'smug' | 'sleep';
export type ChibiLegs = 'idle' | 'a' | 'b';
export interface ChibiPose { dir: Dir; legs: ChibiLegs; expr: ChibiExpr; bob?: number; }

const INK = '#2b2231';
const EYE = '#2a2230';
const CX = 9.5; // symmetry axis between pixel columns 9 and 10

type Layer = (c: Ctx) => void;

function stack(layers: Layer[], after?: Layer): HTMLCanvasElement {
  const out = makeCanvas(CW, CH);
  const o = ctx2d(out);
  for (const l of layers) {
    const c = makeCanvas(CW, CH);
    l(ctx2d(c));
    outline(c, INK);
    o.drawImage(c, 0, 0);
  }
  after?.(o);
  return out;
}

/** symmetric horizontal span around the axis: half-width hw */
function span(c: Ctx, hw: number, y: number, h: number, col: string, dx = 0) {
  px(c, Math.round(CX - hw + 0.5) + dx, y, col, hw * 2, h);
}

function cloth(id: string) {
  const d = id ? CLOTHES_BY_ID[id] : undefined;
  return d ? { kind: d.kind, c1: d.c1, c2: d.c2 ?? shade(d.c1, -0.2) } : null;
}

const MUZZLE: Partial<Record<Species, boolean>> = { fox: true, dog: true, bear: true, otter: true, raccoon: true };

// ------------------------------------------------------------------ geometry (y grows down; feet end at row 28)
const G = {
  headY: 10,
  headRX: 7.3,
  headRY: 6.6,
  bodyTop: 16,
  bodyBot: 23,
  legTop: 23,
  feetY: 27,
};

// ------------------------------------------------------------------ hair
interface HairShape {
  /** behind head & body (long hair, buns, ponytail) */
  back?: (c: Ctx, side: boolean, up: boolean, col: string) => void;
  /** front cap bottom edge offsets from the brow line, per column (front view) */
  bangs: number[];
  /** how far the side locks fall (row) in front view */
  sides: number;
  volume?: number;
}

const BANG_A = [0, 1, 1, 2, 1, 0, 1, 2, 2, 1, 0, 1, 2, 1, 1, 0];
const HAIR: HairShape[] = [
  // 0 Melena corta (bob)
  { bangs: BANG_A, sides: 15, back: (c, side, up, col) => {
    if (up) ellipse(c, CX, G.headY + 1.5, 7.8, 6.6, col);
    else if (side) ellipse(c, CX - 2, G.headY + 2, 6, 5.5, col);
    else ellipse(c, CX, G.headY + 2.5, 8, 5.4, col);
  } },
  // 1 Pelo largo
  { bangs: BANG_A, sides: 19, back: (c, side, up, col) => {
    if (up) {
      ellipse(c, CX, G.headY + 1, 7.8, 6.6, col);
      span(c, 7, G.headY + 2, 10, col);
      span(c, 6, G.headY + 12, 2, col);
    } else if (side) {
      ellipse(c, CX - 2, G.headY + 2, 6, 5.5, col);
      px(c, 3, G.headY + 2, col, 7, 10);
    } else {
      span(c, 8, G.headY, 10, col);
      span(c, 7, G.headY + 10, 2, col);
    }
  } },
  // 2 Corto
  { bangs: [0, 2, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1, 0, 2, 1, 0], sides: 11, back: (c, side, up, col) => {
    if (up) ellipse(c, CX, G.headY, 7.6, 6.4, col);
    else if (side) ellipse(c, CX - 2, G.headY, 5.5, 5, col);
  } },
  // 3 Rodetes
  { bangs: BANG_A, sides: 13, back: (c, side, up, col) => {
    const buns = side ? [[CX - 3, G.headY - 6.5]] : [[CX - 6, G.headY - 5.5], [CX + 6, G.headY - 5.5]];
    for (const [bx, by] of buns) ellipse(c, bx, by, 3, 3, col);
    if (up) ellipse(c, CX, G.headY, 7.6, 6.4, col);
  } },
  // 4 Colita
  { bangs: BANG_A, sides: 13, back: (c, side, up, col) => {
    if (up) {
      ellipse(c, CX, G.headY, 7.6, 6.4, col);
      ellipse(c, CX, G.headY + 6, 2.2, 4, col);
    } else if (side) {
      ellipse(c, CX - 7, G.headY - 1, 2.5, 2, col);
      ellipse(c, CX - 8, G.headY + 3, 2.2, 4, col);
    } else ellipse(c, CX + 7.2, G.headY + 3, 2, 3.6, col);
  } },
  // 5 Rulos
  { bangs: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1], sides: 15, volume: 1, back: (c, side, up, col) => {
    const pts = up ? [[-6, -2], [6, -2], [-7, 2], [7, 2], [-6, 6], [6, 6], [0, 6], [-3, 7], [3, 7]] : side ? [[-6, 0], [-6, 4], [-4, 7]] : [[-7.5, 2], [7.5, 2], [-7.5, 6], [7.5, 6]];
    for (const [dx, dy] of pts) ellipse(c, CX + dx, G.headY + dy, 2.6, 2.6, col);
    if (up) ellipse(c, CX, G.headY, 8, 6.8, col);
  } },
  // 6 Sin peinado
  { bangs: [], sides: 0 },
];
export const CHIBI_HAIR_COUNT = HAIR.length;

function hairCap(c: Ctx, style: HairShape, side: boolean, up: boolean, col: string) {
  const hx = side ? CX + 1 : CX;
  const vol = style.volume ?? 0;
  const tmp = makeCanvas(CW, CH);
  const t = ctx2d(tmp);
  ellipse(t, hx, G.headY - 1.2, G.headRX + 0.7 + vol, G.headRY - 0.3 + vol * 0.5, col);
  if (vol) for (const dx of [-5, -2, 2, 5]) ellipse(t, hx + dx, G.headY - 6.5, 2.2, 2, col);
  if (!up) {
    // open the face below the brow line, leaving bangs and side locks
    const brow = G.headY - 2;
    for (let x = 0; x < CW; x++) {
      const rel = Math.round(x - (hx - 8));
      if (side) {
        if (x < hx - 2) {
          // back of the head stays covered down to the nape
          t.clearRect(x, G.headY + 4, 1, CH);
          continue;
        }
        const b = brow + (BANG_A[rel % 16] ?? 0);
        t.clearRect(x, b + 1, 1, CH);
      } else {
        const edge = Math.abs(x - hx) > 5.2;
        const lock = edge ? style.sides : brow + (style.bangs[rel] ?? 0) + 1;
        t.clearRect(x, lock, 1, CH);
      }
    }
  } else t.clearRect(0, G.headY + 5, CW, CH);
  c.drawImage(tmp, 0, 0);
  // long side locks falling past the cheeks (front view)
  if (!up && !side && style.sides > G.headY + 5) {
    for (const lx of [Math.round(hx - 8), Math.round(hx + 6)]) {
      px(c, lx, G.headY - 2, col, 2, style.sides - G.headY + 2);
      px(c, lx + (lx < hx ? 1 : 0), style.sides, col, 1, 1);
      px(c, lx + (lx < hx ? 1 : 0), G.headY + 1, shade(col, 0.15), 1, 3);
    }
  }
  // sheen
  const sheenY = Math.round(G.headY - 5);
  px(c, Math.round(hx - 4), sheenY, shade(col, 0.3), 3, 1);
  px(c, Math.round(hx - 1), sheenY - 1, shade(col, 0.3), 3, 1);
  px(c, Math.round(hx + 2), sheenY, shade(col, 0.18), 2, 1);
}

// ------------------------------------------------------------------ species bits
function ears(c: Ctx, s: Species, side: boolean, up: boolean, fur: string, inner: string) {
  const hx = side ? CX + 1 : CX;
  const xs = side ? [hx - 3, hx + 2] : [hx - 5, hx + 5];
  const top = G.headY - G.headRY;
  const tri = (x: number, h: number, w: number, col: string, inn?: string) => {
    for (let j = 0; j < h; j++) {
      const hw = Math.max(0, Math.round((w * (j + 1)) / h));
      px(c, Math.round(x - hw / 2), Math.round(top - h + 2 + j), col, Math.max(1, hw), 1);
      if (inn && j > 1 && j < h - 1 && !up) px(c, Math.round(x - hw / 4), Math.round(top - h + 2 + j), inn, Math.max(1, Math.round(hw / 2)), 1);
    }
  };
  switch (s) {
    case 'cat':
      for (const x of xs) tri(x, 5, 5, fur, inner);
      break;
    case 'fox':
      for (const x of xs) tri(x, 6, 6, fur, '#2f2630');
      break;
    case 'bunny':
      for (const x of xs) {
        ellipse(c, x, top - 2.5, 1.8, 4.5, fur);
        if (!up) ellipse(c, x, top - 2, 0.8, 3.2, inner);
      }
      break;
    case 'bear':
    case 'raccoon':
    case 'otter':
      for (const x of xs) {
        const r = s === 'otter' ? 1.6 : 2.4;
        ellipse(c, x, top + 1.5, r, r, fur);
        if (!up) ellipse(c, x, top + 1.8, r * 0.5, r * 0.5, inner);
      }
      break;
    case 'squirrel':
      for (const x of xs) {
        tri(x, 4, 4, fur, inner);
        px(c, Math.round(x), Math.round(top - 3), shade(fur, -0.2), 1, 2);
      }
      break;
    case 'owl':
      for (const x of xs) tri(x, 3, 3, shade(fur, -0.15));
      break;
    default:
      break;
  }
}

/** Dog ears hang down the sides; humans get tiny skin-coloured ears. */
function sideEars(c: Ctx, s: Species, side: boolean, up: boolean, fur: string) {
  if (s === 'dog') {
    const xs = side ? [CX - 3] : [CX - 7, CX + 7];
    for (const x of xs) ellipse(c, x, G.headY + 0.5, 1.8, 3.6, shade(fur, -0.25));
  } else if (s === 'human' && !up) {
    const xs = side ? [CX - 2] : [CX - 7.2, CX + 7.2];
    for (const x of xs) ellipse(c, x, G.headY + 1.5, 1.1, 1.4, fur);
  }
}

function tailLayer(c: Ctx, s: Species, side: boolean, up: boolean, fur: string, marks: Appearance['marks']) {
  const bx = side ? CX - 6 : CX + 5;
  const by = G.bodyBot - 2;
  const dir = side ? -1 : 1;
  const sdx = up ? -dir : dir;
  switch (s) {
    case 'cat':
      for (let i = 0; i < 6; i++) px(c, Math.round(bx + sdx * (i * 0.8)), by - i, fur, 2, 2);
      break;
    case 'fox':
      ellipse(c, bx + sdx * 2.5, by - 2, 3, 4, fur);
      ellipse(c, bx + sdx * 3.5, by - 5, 1.8, 1.8, '#f6f0e6');
      break;
    case 'dog':
      ellipse(c, bx + sdx * 1.5, by - 3, 1.4, 3, fur);
      break;
    case 'squirrel':
      ellipse(c, bx + sdx * 2.5, by - 4, 3.4, 5.5, fur);
      ellipse(c, bx + sdx * 3.5, by - 8, 2.4, 2, shade(fur, 0.15));
      break;
    case 'otter':
      for (let i = 0; i < 5; i++) px(c, Math.round(bx + sdx * i), by + 1 - Math.floor(i / 2), fur, 2, 2);
      break;
    case 'raccoon':
      for (let i = 0; i < 4; i++) ellipse(c, bx + sdx * (1 + i * 1.3), by - i * 1.4, 1.9, 1.9, i % 2 ? (marks?.mask ?? shade(fur, -0.5)) : fur);
      break;
    case 'bunny':
      if (up) ellipse(c, CX, by + 1, 2, 2, '#f6f0e6');
      break;
    case 'bear':
      if (up) ellipse(c, CX, by + 1, 1.5, 1.5, fur);
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ face
const EYE_ROW = G.headY;

function eyesFront(c: Ctx, style: number, expr: ChibiExpr, col: string, lidCol: string, xs: number[]) {
  for (const x of xs) {
    const y = EYE_ROW;
    switch (expr) {
      case 'blink':
      case 'sleep':
        px(c, x - 1, y + 1, lidCol, 3, 1);
        continue;
      case 'happy':
        px(c, x - 1, y + 1, lidCol);
        px(c, x, y, lidCol);
        px(c, x + 1, y + 1, lidCol);
        continue;
      case 'smug':
        px(c, x - 1, y, lidCol, 3, 1);
        px(c, x, y + 1, EYE, 2, 1);
        continue;
      default:
        break;
    }
    const big = expr === 'surprised';
    if (style === 1) {
      // dots
      px(c, x, y, EYE, 2, 2);
      px(c, x, y, '#ffffff');
    } else {
      px(c, x, y - 1, EYE, 2, 3 + (big ? 1 : 0));
      px(c, x, y + 1, col, 2, 1 + (big ? 1 : 0));
      px(c, x, y - 1, '#ffffff');
      if (style === 2) px(c, x + 1, y + 1, '#ffffff');
      if (style === 4) {
        px(c, x - 1, y - 2, EYE, 2, 1);
        px(c, x + 1, y - 2, EYE, 2, 1);
      }
      if (style === 3) px(c, x, y - 1, EYE, 2, 1);
    }
    if (expr === 'sad') px(c, x === xs[0] ? x - 1 : x + 1, y - 3, lidCol, 2, 1);
  }
}

function mouth(c: Ctx, x: number, y: number, expr: ChibiExpr) {
  if (expr === 'happy') {
    px(c, x - 1, y, '#7a3a44', 3, 1);
    px(c, x, y + 1, '#e07a8a');
  } else if (expr === 'surprised') px(c, x, y, '#7a3a44', 1, 2);
  else if (expr === 'sad') {
    px(c, x - 1, y + 1, '#7a3a44');
    px(c, x, y, '#7a3a44');
    px(c, x + 1, y + 1, '#7a3a44');
  } else if (expr === 'smug') px(c, x, y, '#7a3a44', 2, 1);
  else {
    px(c, x - 1, y, '#7a3a44');
    px(c, x, y + 1, '#7a3a44');
    px(c, x + 1, y, '#7a3a44');
  }
}

function face(c: Ctx, a: Appearance, pose: ChibiPose, fur: string) {
  const s = a.species;
  const side = pose.dir === 'left' || pose.dir === 'right';
  const lid = mix(shade(fur, -0.55), INK, 0.4);
  const hx = side ? CX + 1 : CX;
  // species face patterns
  if (s === 'owl' && !side) ellipse(c, hx, G.headY + 1, 5.5, 4.5, shade(fur, 0.25));
  if (s === 'raccoon') {
    const m = a.marks?.mask ?? '#2a2230';
    if (side) ellipse(c, hx + 3, G.headY + 0.5, 2.6, 1.8, m);
    else for (const dx of [-3.5, 3.5]) ellipse(c, hx + dx, G.headY + 0.5, 2.6, 1.9, m);
  }
  if (MUZZLE[s]) {
    const mc = a.marks?.face ?? shade(fur, 0.45);
    if (side) ellipse(c, hx + 5.5, G.headY + 3, 2.2, 1.6, mc);
    else ellipse(c, hx, G.headY + 3.2, 2.8, 1.8, mc);
  }
  if (s === 'cat' || s === 'bunny' || s === 'squirrel') {
    // tiny nose + whisker dots
    if (!side) px(c, Math.floor(hx), G.headY + 2, '#c96a7a', 1, 1);
  }
  // eyes
  if (side) {
    const ex = Math.round(hx + 2.5);
    eyesFront(c, a.eyes, pose.expr, a.eyeColor, lid, [ex]);
  } else eyesFront(c, a.eyes, pose.expr, a.eyeColor, lid, [Math.round(hx - 4.5), Math.round(hx + 2.5)]);
  // nose / mouth
  if (MUZZLE[s]) {
    if (side) px(c, Math.round(hx + 7), G.headY + 2, INK, 1, 1);
    else px(c, Math.floor(hx), G.headY + 2, INK, 1, 1);
    if (!side) mouth(c, Math.floor(hx), G.headY + 4, pose.expr);
  } else if (side) px(c, Math.round(hx + 5), G.headY + 4, '#7a3a44', 1, 1);
  else mouth(c, Math.floor(hx), G.headY + 3 + (s === 'human' ? 0 : 1), pose.expr);
  // blush
  if (!side) {
    const b = pose.expr === 'happy' || pose.expr === 'smug' || cloth(a.face)?.kind === 'blush' ? '#f08aa0' : '#f4b4b8';
    px(c, Math.round(hx - 6.5), G.headY + 2, b, 2, 1);
    px(c, Math.round(hx + 4.5), G.headY + 2, b, 2, 1);
  } else px(c, Math.round(hx + 1), G.headY + 2, '#f4b4b8', 2, 1);
}

function faceAcc(c: Ctx, kind: string, c1: string, side: boolean) {
  const hx = side ? CX + 1 : CX;
  const xs = side ? [Math.round(hx + 2.5)] : [Math.round(hx - 4.5), Math.round(hx + 2.5)];
  const y = EYE_ROW - 2;
  if (kind === 'glasses' || kind === 'roundglasses' || kind === 'sunglasses') {
    for (const x of xs) {
      if (kind === 'sunglasses') px(c, x - 1, y + 1, '#2a2230', 4, 3);
      else {
        px(c, x - 1, y + 1, c1, 4, 1);
        px(c, x - 1, y + 4, c1, 4, 1);
        px(c, x - 1, y + 1, c1, 1, 4);
        px(c, x + 2, y + 1, c1, 1, 4);
        if (kind === 'roundglasses') {
          c.clearRect(x - 1, y + 1, 1, 1);
          c.clearRect(x + 2, y + 1, 1, 1);
        }
      }
    }
    if (!side) px(c, xs[0] + 3, y + 2, c1, xs[1] - xs[0] - 3, 1);
    if (kind === 'sunglasses') for (const x of xs) px(c, x, y + 1, '#6a6a8a');
  }
}

// ------------------------------------------------------------------ body & clothes
function shoe(c: Ctx, x: number, y: number, kind: string | undefined, c1: string, skin: string, side: boolean) {
  const w = side ? 4 : 3;
  switch (kind) {
    case 'boots':
      px(c, x, y - 2, c1, w, 4);
      px(c, x, y - 2, shade(c1, 0.2), w, 1);
      break;
    case 'sandals':
      px(c, x, y, skin, w, 2);
      px(c, x, y + 1, c1, w, 1);
      px(c, x + 1, y, c1, 1, 1);
      break;
    case 'slippers':
      px(c, x - (side ? 0 : 1), y, c1, w + 1, 2);
      px(c, x, y, shade(c1, 0.3), w - 1, 1);
      break;
    default:
      px(c, x, y, c1, w, 2);
      px(c, x, y, shade(c1, 0.25), w - 1, 1);
  }
}

function bodyLayer(c: Ctx, a: Appearance, pose: ChibiPose, fur: string) {
  const side = pose.dir === 'left' || pose.dir === 'right';
  const up = pose.dir === 'up';
  const top = cloth(a.top);
  const bot = cloth(a.bottom);
  const shoes = cloth(a.shoes);
  const bob = pose.bob ?? 0;
  const bt = G.bodyTop + bob;
  const longLegs = bot && ['pants', 'overalls', 'hakama'].includes(bot.kind);
  const legCol = longLegs ? bot!.c1 : fur;
  const shoeCol = shoes?.c1 ?? shade(fur, -0.35);
  const step = pose.legs === 'idle' ? 0 : pose.legs === 'a' ? 1 : -1;

  // legs + shoes
  if (side) {
    const fx = Math.round(CX - 1);
    const sw = step * 2;
    px(c, fx - 1 - sw, G.legTop, shade(legCol, -0.15), 2, 4);
    px(c, fx + 1 + sw, G.legTop, legCol, 2, 4);
    shoe(c, fx - 2 - sw, G.feetY, shoes?.kind, shade(shoeCol, -0.15), fur, true);
    shoe(c, fx + sw, G.feetY, shoes?.kind, shoeCol, fur, true);
  } else {
    const ly = (k: number) => (step === 0 ? 0 : (step > 0) === (k === 0) ? -1 : 0);
    px(c, 7, G.legTop + ly(0), legCol, 2, 4);
    px(c, 11, G.legTop + ly(1), legCol, 2, 4);
    shoe(c, 6, G.feetY + ly(0), shoes?.kind, shoeCol, fur, false);
    shoe(c, 11, G.feetY + ly(1), shoes?.kind, shoeCol, fur, false);
  }

  // torso
  const tc = top?.c1 ?? fur;
  const hw = side ? 4 : 5;
  const dx = side ? 0 : 0;
  span(c, hw - 1, bt, 1, tc, dx);
  span(c, hw, bt + 1, G.bodyBot - bt - 1, tc, dx);
  span(c, hw, G.bodyBot - 1, 1, shade(tc, -0.15), dx);
  if (!top) {
    // fur folk: lighter belly
    if (!up && a.species !== 'human') ellipse(c, side ? CX + 1.5 : CX, bt + 4, side ? 2 : 3, 2.6, a.marks?.belly ?? shade(fur, 0.35));
  } else {
    const c2 = top.c2;
    const y0 = bt + 1;
    switch (top.kind) {
      case 'stripes':
        for (let y = y0 + 1; y < G.bodyBot - 1; y += 2) span(c, hw, y, 1, c2);
        break;
      case 'kimono':
        if (!up && !side) {
          for (let i = 0; i < 4; i++) {
            px(c, 7 + i, y0 + i, c2);
            px(c, 12 - i, y0 + i, c2);
          }
          span(c, hw, G.bodyBot - 3, 1, shade(c2, -0.1));
        }
        break;
      case 'cardigan':
        if (!up && !side) {
          px(c, 9, y0, c2, 2, G.bodyBot - y0 - 1);
          px(c, 8, y0 + 2, '#f2c66d');
          px(c, 8, y0 + 4, '#f2c66d');
        }
        break;
      case 'hoodie':
        if (!up && !side) {
          px(c, 7, y0 + 3, c2, 6, 2);
          px(c, 8, y0, '#f6f0e6', 1, 2);
          px(c, 11, y0, '#f6f0e6', 1, 2);
        }
        if (up) span(c, 3, y0, 2, c2);
        break;
      case 'chef':
        if (!up && !side) for (let y = y0 + 1; y < G.bodyBot - 1; y += 2) {
          px(c, 8, y, c2);
          px(c, 11, y, c2);
        }
        break;
      case 'pajama':
        for (let y = y0 + 1; y < G.bodyBot - 1; y += 3) for (let x = 6 + (y % 2); x < 14; x += 3) px(c, x, y, c2);
        break;
      case 'coat':
        span(c, hw + 1, G.bodyBot - 2, 2, tc);
        if (!up && !side) {
          px(c, 9, y0, c2, 2, 1);
          px(c, 9, y0 + 2, shade(tc, -0.35));
          px(c, 9, y0 + 4, shade(tc, -0.35));
        }
        break;
      case 'sweater':
        span(c, hw, G.bodyBot - 2, 1, c2);
        if (!up && !side) span(c, 2, y0, 1, c2);
        break;
      case 'tank':
        if (!up && !side) span(c, 2, bt, 1, fur);
        break;
      default:
        if (!up && !side) span(c, 1, y0, 1, c2);
    }
  }

  // bottoms over the lower torso / legs
  if (bot) {
    const b1 = bot.c1;
    const b2 = bot.c2;
    switch (bot.kind) {
      case 'skirt':
        span(c, hw, G.bodyBot - 2, 1, b1);
        span(c, hw + 1, G.bodyBot - 1, 2, b1);
        span(c, hw + 1, G.bodyBot + 1, 1, shade(b1, -0.2));
        break;
      case 'dress':
        span(c, hw, G.bodyBot - 4, 3, b1);
        span(c, hw + 1, G.bodyBot - 1, 2, b1);
        span(c, hw + 2, G.bodyBot + 1, 1, b1);
        span(c, hw + 2, G.bodyBot + 2, 1, shade(b1, -0.2));
        if (!up) span(c, hw, G.bodyBot - 4, 1, b2);
        break;
      case 'shorts':
        span(c, hw, G.bodyBot - 2, 2, b1);
        if (!side) {
          px(c, 6, G.bodyBot, b1, 4, 1);
          px(c, 10, G.bodyBot, b1, 4, 1);
        }
        break;
      case 'overalls':
        span(c, hw, G.bodyBot - 3, 3, b1);
        if (!up && !side) {
          px(c, 7, bt + 2, b1, 6, 3);
          px(c, 7, bt + 1, b2, 1, 2);
          px(c, 12, bt + 1, b2, 1, 2);
        }
        break;
      case 'hakama':
        span(c, hw, G.bodyBot - 2, 2, b1);
        if (!side) {
          span(c, hw + 1, G.bodyBot, 3, b1);
          for (let x = 6; x < 14; x += 2) px(c, x, G.bodyBot, shade(b1, -0.2), 1, 3);
        }
        break;
      default:
        span(c, hw, G.bodyBot - 2, 2, b1);
    }
  }

  // extras on the body (apron, scarf, necklace, cape front)
  const ex = cloth(a.extra);
  if (ex && ex.kind !== 'cape') bodyAcc(c, ex.kind, ex.c1, ex.c2, 10, bt + 4, hw, up ? 'back' : side ? 'side' : 'front');
  if (ex?.kind === 'cape' && up) {
    span(c, hw + 1, bt, G.bodyBot - bt + 1, ex.c1);
    span(c, hw + 1, bt, 1, ex.c2);
  }
  // bag
  const bag = cloth(a.bag);
  if (bag) {
    if (up) {
      px(c, 6, bt + 1, bag.c1, 8, 6);
      px(c, 6, bt + 1, bag.c2, 8, 2);
      if (bag.kind === 'raccoonpack') {
        px(c, 7, bt + 3, '#2a2230', 2, 1);
        px(c, 11, bt + 3, '#2a2230', 2, 1);
      }
    } else if (bag.kind === 'satchel') {
      for (let i = 0; i < 6; i++) px(c, 6 + i, bt + i, bag.c2);
      px(c, side ? 6 : 12, G.bodyBot - 3, bag.c1, 3, 3);
    } else if (!side) {
      px(c, 6, bt + 1, bag.c2, 1, 4);
      px(c, 13, bt + 1, bag.c2, 1, 4);
    } else px(c, 3, bt + 1, bag.c1, 3, 6);
  }
}

function armLayer(c: Ctx, a: Appearance, pose: ChibiPose, fur: string) {
  const side = pose.dir === 'left' || pose.dir === 'right';
  const top = cloth(a.top);
  const short = !top || top.kind === 'tee' || top.kind === 'tank';
  const sleeve = short ? fur : top!.c1;
  const bt = G.bodyTop + (pose.bob ?? 0);
  const swing = pose.legs === 'idle' ? 0 : pose.legs === 'a' ? 1 : -1;
  const arm = (x: number, dy: number) => {
    px(c, x, bt + 1 + dy, sleeve, 2, 5);
    if (short && top && top.kind === 'tee') px(c, x, bt + 1 + dy, top.c1, 2, 2);
    if (top?.kind === 'kimono') px(c, x - (x < CX ? 1 : 0), bt + 3 + dy, top.c1, 3, 3);
    ellipse(c, x + 0.5, bt + 6.5 + dy, 1.2, 1.2, fur);
  };
  if (side) arm(Math.round(CX - 0.5) + swing, 0);
  else {
    arm(3, swing);
    arm(15, -swing);
  }
}

// ------------------------------------------------------------------ composer
export function drawChibi(ctx: Ctx, ox: number, oy: number, a: Appearance, pose: ChibiPose): void {
  const fur = a.skin;
  const side = pose.dir === 'left' || pose.dir === 'right';
  const up = pose.dir === 'up';
  const hairStyle = HAIR[Math.max(0, Math.min(HAIR.length - 1, a.hairStyle))] ?? HAIR[0];
  const hasHair = hairStyle.bangs.length > 0;
  const hairCol = a.hairColor;
  const inner = a.species === 'raccoon' ? (a.marks?.ear ?? '#f4f1ec') : mix(fur, '#f4a6b4', 0.5);
  const head = cloth(a.head);
  const ex = cloth(a.extra);
  const bob = pose.bob ?? 0;

  const layers: Layer[] = [
    (c) => {
      if (ex?.kind === 'cape' && !up) {
        span(c, 6, G.bodyTop + bob, 8, ex.c1);
      }
    },
    (c) => tailLayer(c, a.species, side, up, fur, a.marks),
    (c) => hasHair && hairStyle.back?.(c, side, up, hairCol),
    (c) => bodyLayer(c, a, pose, fur),
    (c) => armLayer(c, a, pose, fur),
    (c) => ears(c, a.species, side, up, fur, inner),
    (c) => sideEars(c, a.species, side, up, fur),
    (c) => {
      const hx = side ? CX + 1 : CX;
      ellipse(c, hx, G.headY + bob * 0, G.headRX - (side ? 0.4 : 0), G.headRY, shade(fur, -0.12));
      ellipse(c, hx - 0.3, G.headY - 0.4, G.headRX - 0.7, G.headRY - 0.6, fur);
      if (side && MUZZLE[a.species]) ellipse(c, hx + 5.2, G.headY + 2.8, 2.6, 2, fur);
    },
    (c) => hasHair && hairCap(c, hairStyle, side, up, hairCol),
  ];
  const decorate: Layer = (c) => {
    if (!up) face(c, a, pose, fur);
    const fa = cloth(a.face);
    if (fa && !up) faceAcc(c, fa.kind, fa.c1, side);
    if (head && head.kind !== 'raccoonhat') headAcc(c, head.kind, head.c1, head.c2, side ? 11 : 10, Math.round(G.headY - G.headRY) + (hasHair ? -1 : 0), 7, up ? 'back' : side ? 'side' : 'front');
    if (head?.kind === 'raccoonhat') {
      for (const dx of side ? [-2, 2] : [-5, 5]) ellipse(c, CX + dx, G.headY - 6, 2, 2, head.c1);
      ellipse(c, CX, G.headY - 4, 7, 2.5, head.c1);
    }
  };
  let canvas = stack(layers, decorate);
  if (pose.dir === 'left') {
    const m = makeCanvas(CW, CH);
    const g = ctx2d(m);
    g.translate(CW, 0);
    g.scale(-1, 1);
    g.drawImage(canvas, 0, 0);
    canvas = m;
  }
  ctx.drawImage(canvas, ox, oy);
}
