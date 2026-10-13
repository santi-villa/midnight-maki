/**
 * The playable heroes (Santiago and Sofi) and everything their customization needs: hair, faces, outfits.
 * Drawing is done by the folk engine (src/art/folk.ts); this module holds the data (HeroLook -> FolkSpec) and the
 * human-specific drawing routines (hair, face, accessories) that the engine calls through a small "kit" of primitives.
 */
import type { Appearance, HeroLook } from '../core/types';
import { CLOTHES_BY_ID } from '../data/clothes';
import { mix, px, shade, type Ctx } from './pixel';
import type { Deco, FolkSpec, HatKind } from './folk';

// ------------------------------------------------------------------ kit handed over by folk.ts
export type Test = (x: number, y: number) => boolean;
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Kit {
  K: number;
  AX: number;
  fill: (c: Ctx, box: Box, inside: Test, base: string, o?: { lt?: string; dk?: string; flat?: boolean }) => void;
  ell: (cx: number, cy: number, rx: number, ry: number, p?: number) => Test;
  rect: (x0: number, y0: number, x1: number, y1: number) => Test;
  tri: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Test;
  boxOf: (cx: number, cy: number, rx: number, ry: number) => Box;
  dot: (c: Ctx, x: number, y: number, col: string, w?: number, h?: number) => void;
}
export interface HeadGeo { headCx: number; headCy: number; headRx: number; headRy: number; torsoTop: number; torsoBot: number }
export type View = 'front' | 'side' | 'back';
export type Expr = 'neutral' | 'blink' | 'happy' | 'surprised' | 'sad' | 'smug' | 'sleep';

// ------------------------------------------------------------------ hair
export interface HairDef {
  name: string;
  /** extra volume on top of the head (design units) */
  crown?: number;
  fringe: 'none' | 'short' | 'side' | 'full' | 'curtain' | 'spiky' | 'swoop' | 'pixie';
  /** strands in front of / beside the ears */
  sides: 'none' | 'short' | 'ear' | 'jaw' | 'shoulder' | 'chest';
  /** how far the hair reaches behind */
  back: 'none' | 'nape' | 'jaw' | 'shoulder' | 'chest' | 'waist';
  wave?: number;
  /** shaved sides blending into the skin */
  fade?: boolean;
  tie?: 'pony' | 'high' | 'twin' | 'bun' | 'topknot' | 'braid' | 'lowbun' | 'twinbun';
  /** extra width all around (curly hair) */
  puff?: number;
  part?: -1 | 0 | 1;
}

/** The first 7 keep the meaning of the old creator's hairstyles, so saved games look about the same. */
export const HERO_HAIR: HairDef[] = [
  { name: 'Melena corta', fringe: 'side', sides: 'jaw', back: 'jaw', part: -1 },
  { name: 'Pelo largo', fringe: 'curtain', sides: 'chest', back: 'chest', wave: 0.8 },
  { name: 'Corto', fringe: 'short', sides: 'short', back: 'nape' },
  { name: 'Rodetes', fringe: 'full', sides: 'short', back: 'nape', tie: 'twinbun' },
  { name: 'Colita', fringe: 'side', sides: 'ear', back: 'nape', tie: 'pony', part: 1 },
  { name: 'Rulos', fringe: 'full', sides: 'jaw', back: 'jaw', puff: 2.6, wave: 0.9, crown: 1.2 },
  { name: 'Sin pelo', fringe: 'none', sides: 'none', back: 'none' },
  { name: 'Degradé corto', fringe: 'short', sides: 'short', back: 'nape', fade: true, crown: 0.2 },
  { name: 'Rapado', fringe: 'none', sides: 'none', back: 'none', crown: -0.8 },
  { name: 'Undercut', fringe: 'swoop', sides: 'short', back: 'nape', fade: true, crown: 2 },
  { name: 'Jopo', fringe: 'swoop', sides: 'short', back: 'nape', crown: 3, part: 1 },
  { name: 'Desprolijo', fringe: 'spiky', sides: 'short', back: 'nape', crown: 1 },
  { name: 'Raya al costado', fringe: 'side', sides: 'short', back: 'nape', part: 1, crown: 0.5 },
  { name: 'Pixie', fringe: 'pixie', sides: 'ear', back: 'nape', part: -1 },
  { name: 'Carré', fringe: 'full', sides: 'jaw', back: 'jaw' },
  { name: 'Media melena', fringe: 'curtain', sides: 'shoulder', back: 'shoulder' },
  { name: 'Lacio largo', fringe: 'full', sides: 'chest', back: 'waist' },
  { name: 'Ondas con flequillo', fringe: 'full', sides: 'chest', back: 'chest', wave: 0.9 },
  { name: 'Colita alta', fringe: 'curtain', sides: 'ear', back: 'nape', tie: 'high' },
  { name: 'Colitas', fringe: 'full', sides: 'jaw', back: 'nape', tie: 'twin' },
  { name: 'Trenza', fringe: 'curtain', sides: 'ear', back: 'nape', tie: 'braid' },
  { name: 'Rodete alto', fringe: 'side', sides: 'ear', back: 'nape', tie: 'bun', part: 1 },
  { name: 'Rodete bajo', fringe: 'curtain', sides: 'ear', back: 'nape', tie: 'lowbun' },
  { name: 'Moño samurái', fringe: 'short', sides: 'short', back: 'nape', tie: 'topknot', fade: true },
  { name: 'Afro', fringe: 'none', sides: 'ear', back: 'jaw', puff: 4, crown: 2 },
  { name: 'Rulos largos', fringe: 'curtain', sides: 'shoulder', back: 'shoulder', puff: 2.4, wave: 1.2, crown: 1 },
];

const hash = (a: number, b = 0) => {
  let h = (Math.round(a * 7) * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Draws the whole hairdo (cap, fringe, side strands, hair behind, ties) for one view. */
export function drawHeroHair(k: Kit, c: Ctx, g: HeadGeo, view: View, def: HairDef, col: string, hiCol: string, _skin?: string) {
  if (def.fringe === 'none' && def.sides === 'none' && def.back === 'none' && !def.crown && !def.puff && !def.tie) return; // bald
  const { fill, ell, rect, tri, boxOf, dot } = k;
  const { headCx: cx, headCy: cy, headRx: rx, headRy: ry } = g;
  const lt = hiCol || shade(col, 0.24);
  const dk = shade(col, -0.26);
  const crown = def.crown ?? 0;
  const puff = def.puff ?? 0;
  const part = def.part ?? 0;
  const wave = def.wave ?? 0;
  const Rx = rx + 0.6 + puff;
  const Ry = ry + 0.9 + puff * 0.6 + Math.max(0, crown) * 0.5;
  const top = cy - Ry - (crown < 0 ? crown : 0) * -0.0;
  const capC = cy - Math.max(0, crown) * 0.45 - puff * 0.15;
  const cap = ell(cx, capC, Rx, Ry + Math.max(0, crown) * 0.4, 2.3);
  const sideEnd = { none: -4, short: -0.6, ear: 3, jaw: ry - 1.3, shoulder: ry + 5, chest: ry + 8.8 }[def.sides];
  const backEnd = { none: -3, nape: 4.2, jaw: ry + 0.6, shoulder: ry + 5.5, chest: ry + 8.8, waist: ry + 11 }[def.back];
  const long = def.sides === 'shoulder' || def.sides === 'chest' || def.back === 'chest' || def.back === 'waist' || def.back === 'shoulder';
  const wob = (y: number) => Math.sin(y * 0.85) * wave;
  const box: Box = { x0: cx - Rx - 5, y0: top - 6, x1: cx + Rx + 5, y1: cy + ry + 14 };
  const F = (inside: Test, base = col, o: { lt?: string; dk?: string; flat?: boolean } = { lt, dk }) => fill(c, box, inside, base, o);

  // hairline height at horizontal position x (smaller y = more forehead shown)
  const edge = Math.abs;
  const hairline = (x: number): number => {
    const t = edge(x - cx) / rx;
    switch (def.fringe) {
      case 'none': return cy - 5.2 + 3.4 * Math.pow(t, 2.6);
      case 'short': return cy - 5.2 + 3 * Math.pow(t, 2.4) + (hash(x, 1) < 0.35 ? 0.7 : 0);
      case 'side': return cy - 4.6 - (x - cx) * 0.3 * (part || 1) + (hash(x, 2) < 0.3 ? 0.6 : 0) + 1.6 * Math.pow(t, 3);
      case 'full': return cy - 3.6 + 1.2 * Math.pow(t, 2.6) + (hash(x, 3) < 0.4 ? 0.7 : 0);
      case 'curtain': return cy - 6.4 + Math.min(3.2, Math.max(0, edge(x - cx) - 1) * 0.9) + 1.8 * Math.pow(t, 3);
      case 'spiky': return cy - 5.4 + 1.7 * Math.abs(Math.sin(x * 1.7)) + 2 * Math.pow(t, 3);
      case 'swoop': return cy - 6.2 + (x < cx ? ((cx - x) / rx) * 3.4 : 0) + 1.8 * Math.pow(t, 3);
      case 'pixie': return cy - 4.4 - (x - cx) * 0.45 * (part || -1) + 1.4 * Math.pow(t, 3);
    }
  };

  if (view === 'front') {
    // ---- hair behind / beside the face (drawn first so the cap overlaps)
    if (def.sides !== 'none' && def.sides !== 'short') {
      for (const s of [-1, 1]) {
        const inner = rx * (long ? 0.8 : 0.84);
        const outer = Rx + (long ? 1.6 : 0.5);
        const strip: Test = (x, y) => {
          if (y > cy + sideEnd || y < cy - 6) return false;
          const w = wob(y) * s;
          const ax = Math.abs(x - cx) - w;
          return ax >= inner - (y > cy + 3 ? 0.4 : 0) && ax <= outer - (y > cy + ry ? 1 : 0) && ((x - cx) * s > 0);
        };
        F(strip);
      }
    }
    // ---- cap above the hairline + temples
    const capT: Test = (x, y) => cap(x, y) && (y < hairline(x) || (Math.abs(x - cx) > rx * 0.86 && y < cy + (def.sides === 'short' ? (def.fade ? -3.4 : -2.2) : def.sides === 'none' ? -3.6 : 2.2)));
    F(capT);
    // fringe lock (a darker streak makes the part visible)
    if (def.fringe === 'side' || def.fringe === 'pixie') {
      const p = part || 1;
      F((x, y) => y >= hairline(x) - 0.2 && y < hairline(x) + 0.9 && Math.abs(x - (cx - p * 2)) < 4 && cap(x, y), dk, { flat: true });
    }
    if (def.fringe === 'curtain') F((x, y) => Math.abs(x - cx) < 0.9 && y < cy - 5.4 && cap(x, y), dk, { flat: true });
    // ---- ties
    if (def.tie === 'high') F(ell(cx, top - 1.2, 4.2, 3, 2), col);
    if (def.tie === 'bun') F(ell(cx + (part || 1) * 0.5, top - 1.8, 4.4, 3.6, 2), col);
    if (def.tie === 'topknot') {
      F(ell(cx, top - 1.4, 2.6, 2.6, 2), col);
      dot(c, cx - 1.4, top + 0.6, '#d9485a', 2.8, 1);
    }
    if (def.tie === 'twinbun') for (const s of [-1, 1]) F(ell(cx + s * (rx * 0.62), top - 0.6, 3.6, 3.2, 2), col);
    if (def.tie === 'twin') {
      for (const s of [-1, 1]) {
        F((x, y) => y > cy - 0.5 && y < cy + ry + 7 && Math.abs(x - (cx + s * (Rx + 1.6) + Math.sin(y * 0.9) * 0.5)) < 2.2, col);
        dot(c, cx + s * (Rx + 1.6) - 1.4, cy - 0.5, '#d9485a', 2.8, 1.4);
      }
    }
    if (def.tie === 'braid') {
      const bx = cx + rx * 0.52;
      F((x, y) => y > cy + 1 && y < cy + ry + 9 && Math.abs(x - (bx + (Math.floor((y - cy) / 2) % 2 ? 0.8 : -0.8))) < 1.9, col);
      dot(c, bx - 1.4, cy + ry + 8.4, '#d9485a', 2.8, 1.3);
    }
    if (def.tie === 'lowbun') { /* hidden behind the head from the front */ }
    if (puff > 0.5) F((x, y) => cap(x, y) && y < cy - 1 && hash(Math.floor(x * 1.3), Math.floor(y * 1.3)) < 0.14, lt, { flat: true });
    return;
  }

  if (view === 'back') {
    const topC = ell(cx, capC, Rx + (long ? 0.4 : 0), Ry + Math.max(0, crown) * 0.4, 2.3);
    const mass: Test = (x, y) => {
      if (topC(x, y)) return true;
      if (y < cy && y > cy - 8) return false;
      const w = wob(y);
      return y >= cy && y < cy + backEnd && Math.abs(x - cx) - w <= Rx + (long ? 1.2 : 0.2) - Math.max(0, y - (cy + ry)) * (long ? 0.12 : 0.5);
    };
    F(mass);
    if (part === 0 && def.fringe === 'curtain') F((x, y) => Math.abs(x - cx) < 0.6 && y < cy + 1 && topC(x, y), dk, { flat: true });
    if (long) F((x, y) => y > cy + ry - 1 && y < cy + backEnd && Math.abs(Math.abs(x - cx) - rx * 0.5) < 0.5 && hash(y, 4) < 0.7, dk, { flat: true });
    if (def.tie === 'high') {
      F(ell(cx, top - 1.4, 4.4, 3.2, 2), col);
      F((x, y) => y > top && y < cy + ry + 9 && Math.abs(x - cx) < 2.6 + (y - top) * 0.04 + Math.sin(y * 0.9) * 0.4, col);
    }
    if (def.tie === 'pony') F((x, y) => y > cy - 4 && y < cy + ry + 8 && Math.abs(x - cx - Math.sin(y * 0.8) * 0.6) < 2.8 - (y - cy) * 0.05, col);
    if (def.tie === 'bun') F(ell(cx, top - 1.8, 4.4, 3.6, 2), col);
    if (def.tie === 'topknot') F(ell(cx, top - 1.4, 2.6, 2.6, 2), col);
    if (def.tie === 'twinbun') for (const s of [-1, 1]) F(ell(cx + s * (rx * 0.62), top - 0.6, 3.6, 3.2, 2), col);
    if (def.tie === 'twin') for (const s of [-1, 1]) F((x, y) => y > cy - 0.5 && y < cy + ry + 7 && Math.abs(x - (cx + s * (Rx + 1.2))) < 2.2, col);
    if (def.tie === 'braid') F((x, y) => y > cy + 2 && y < cy + ry + 10 && Math.abs(x - cx - (Math.floor((y - cy) / 2) % 2 ? 0.8 : -0.8)) < 2, col);
    if (def.tie === 'lowbun') F(ell(cx, cy + ry - 1.2, 3.8, 3.4, 2), col);
    return;
  }

  // ---- side view (facing +x): hair covers the back half and the top
  const frontX = cx + rx * (def.fringe === 'full' || def.fringe === 'curtain' || def.fringe === 'side' || def.fringe === 'pixie' ? 0.9 : 0.66);
  const capS: Test = (x, y) => {
    const e = ell(cx - 0.5, capC, Rx, Ry + Math.max(0, crown) * 0.4, 2.3);
    if (!e(x, y)) return false;
    const fy = cy - (def.fringe === 'full' ? 1.8 : def.fringe === 'none' || def.fringe === 'short' ? 4.2 : 3.2) + (x > frontX - 2 ? 0.6 : 0);
    if (def.fringe === 'swoop') return y < cy - 4.4 || x < cx - 1;
    return y < fy + (x < cx ? 2.6 : 0) || x < cx - 1.2 + (def.sides === 'none' ? 0 : 0.8);
  };
  const longBack: Test = (x, y) => {
    if (y < cy - 1 || y > cy + backEnd) return false;
    const w = wob(y);
    return x > cx - Rx - (long ? 2.4 : 0.6) - w && x < cx - 1.2 + (y > cy + 4 ? -0.6 : 0.6) + (long ? 1.6 : 0);
  };
  if (def.back !== 'none') F(longBack);
  F(capS);
  if (def.sides !== 'none' && def.sides !== 'short') F((x, y) => y > cy - 4 && y < cy + sideEnd && x > cx - 2.2 && x < cx + 0.8 && Math.abs(y - cy) < 14, col);
  if (def.tie === 'pony') F((x, y) => y > cy - 4 && y < cy + ry + 8 && Math.abs(x - (cx - Rx - 1.4 - (y - cy) * 0.06)) < 2.4, col);
  if (def.tie === 'high') {
    F(ell(cx - 2.6, top - 1, 3.6, 2.8, 2), col);
    F((x, y) => y > top && y < cy + ry + 9 && Math.abs(x - (cx - Rx - 1 - (y - top) * 0.1)) < 2.2, col);
  }
  if (def.tie === 'bun') F(ell(cx - 2.2, top - 1.8, 4.2, 3.6, 2), col);
  if (def.tie === 'topknot') F(ell(cx - 1.4, top - 1.4, 2.6, 2.6, 2), col);
  if (def.tie === 'twinbun') F(ell(cx - 1.6, top - 0.6, 3.6, 3.2, 2), col);
  if (def.tie === 'twin') F((x, y) => y > cy - 0.5 && y < cy + ry + 7 && Math.abs(x - (cx - 1)) < 2.2, col);
  if (def.tie === 'braid') F((x, y) => y > cy + 2 && y < cy + ry + 10 && Math.abs(x - (cx - Rx - 0.6 + (Math.floor((y - cy) / 2) % 2 ? 0.8 : -0.8))) < 1.9, col);
  if (def.tie === 'lowbun') F(ell(cx - Rx + 0.6, cy + ry - 1, 3.6, 3.4, 2), col);
  if (puff > 0.5) F((x, y) => capS(x, y) && y < cy - 1 && hash(Math.floor(x * 1.3), Math.floor(y * 1.3)) < 0.14, lt, { flat: true });
  void tri;
  void rect;
  void boxOf;
}

// ------------------------------------------------------------------ face
export const EYE_STYLES = ['Redondos', 'Rasgados', 'Grandes', 'Somnolientos', 'Con pestañas', 'Puntitos'];
export const BROW_STYLES = ['Finas', 'Gruesas', 'En ángulo', 'Suaves'];
export const FACE_SHAPES = ['Redonda', 'Ovalada', 'Cuadrada'];
export const FACIAL_HAIR = ['Nada', 'Barba de días', 'Bigote', 'Perilla', 'Barba corta', 'Barba larga'];
export const EARRINGS = ['Nada', 'Aros dorados', 'Aros plateados', 'Argollas doradas', 'Argollas plateadas', 'Colgantes'];
export const NECK = ['Nada', 'Gargantilla negra', 'Gargantilla vino', 'Cadena dorada', 'Cadena plateada', 'Dije dorado'];

export interface FaceParams {
  skin: string;
  eye: string;
  eyeStyle: number;
  brow: number;
  browColor: string;
  nose: number;
  lips: string;
  freckles: boolean;
  mole: boolean;
  blush: boolean;
  facial: number;
  facialColor: string;
}

/** Face features straight in OUTPUT pixels (like the animals' faces), so both eyes always match exactly. */
export function drawHeroFace(k: Kit, c: Ctx, g: HeadGeo, view: View, f: FaceParams, expr: Expr) {
  if (view === 'back') return;
  const K = k.K;
  const cx = Math.round(g.headCx * K);
  const ey = Math.round((g.headCy + g.headRy) * K - 8.2);
  const sk = f.skin;
  const dk = shade(sk, -0.28);
  const dk2 = shade(sk, -0.45);
  const lipC = f.lips || shade(sk, -0.34);
  const front = view === 'front';
  const eyeX = front ? [cx - 6, cx + 3] : [cx + 3];
  const brow = f.browColor;
  const iris = f.eye;
  const closed = expr === 'blink' || expr === 'sleep';
  eyeX.forEach((x0, idx) => {
    const left = idx === 0 && front;
    if (closed) {
      px(c, x0, ey + 2, dk2, 3, 1);
    } else if (expr === 'happy') {
      px(c, x0, ey + 2, dk2);
      px(c, x0 + 1, ey + 1, dk2);
      px(c, x0 + 2, ey + 2, dk2);
    } else {
      switch (f.eyeStyle) {
        case 1: // almond: narrow, heavy upper lid
          px(c, x0 - 1, ey + 1, dk2, 1, 1);
          px(c, x0, ey + 1, dk2, 3, 1);
          px(c, x0, ey + 2, iris, 3, 2);
          px(c, x0 + 1, ey + 2, '#ffffff');
          break;
        case 2: // big and shiny
          px(c, x0, ey - 1, iris, 3, 5);
          px(c, x0, ey - 1, '#ffffff', 1, 2);
          px(c, x0 + 2, ey + 2, mix(iris, '#ffffff', 0.4));
          break;
        case 3: // sleepy: half closed
          px(c, x0, ey + 1, dk, 3, 1);
          px(c, x0, ey + 2, iris, 3, 2);
          px(c, x0, ey + 2, '#ffffff');
          break;
        case 4: // round with lashes
          px(c, x0, ey + 1, iris, 3, 3);
          px(c, x0, ey + 1, '#ffffff');
          px(c, left ? x0 - 1 : x0 + 3, ey + 1, dk2);
          px(c, x0, ey, dk2, 3, 1);
          break;
        case 5: // tiny dots
          px(c, x0 + 1, ey + 1, iris, 2, 2);
          px(c, x0 + 1, ey + 1, '#ffffff');
          break;
        default: // 0 round, small and neat
          px(c, x0 + (left ? 1 : 0), ey + 1, iris, 2, 3);
          px(c, x0 + (left ? 1 : 0), ey + 1, '#ffffff');
      }
    }
    // eyebrows
    const by = ey - (expr === 'surprised' ? 3 : 2);
    switch (f.brow) {
      case 1: // thick
        px(c, x0 - 1, by, brow, 5, 1);
        px(c, x0, by + 1, brow, 3, 1);
        break;
      case 2: // angled: high at the outer end, low at the nose
        px(c, left ? x0 - 1 : x0 + 2, by - 1, brow, 2, 1);
        px(c, left ? x0 + 1 : x0, by, brow, 2, 1);
        px(c, left ? x0 + 2 : x0 - 1, by + 1, brow, 1, 1);
        break;
      case 3: // soft and high
        px(c, x0, by - 1, shade(brow, 0.1), 3, 1);
        break;
      default: // thin
        px(c, x0, by, brow, 3, 1);
    }
    if (expr === 'sad') px(c, left ? x0 + 1 : x0 - 1, by - 1, brow);
  });
  // nose: a small shade, bigger for style 1/2
  if (front) {
    px(c, cx - 1, ey + 4, dk, 2, 1);
    if (f.nose >= 1) px(c, cx - 1, ey + 3, shade(sk, -0.14), 2, 1);
    if (f.nose === 2) px(c, cx - 2, ey + 4, dk);
  } else {
    px(c, cx + 7, ey + 3, dk, 1, 2);
    if (f.nose >= 1) px(c, cx + 8, ey + 4, dk);
  }
  // mouth
  const mx = front ? cx - 1 : cx + 5;
  const my = ey + (front ? 6 : 6);
  if (expr === 'happy') {
    px(c, mx - 1, my, lipC);
    px(c, mx, my + 1, lipC, 2, 1);
    px(c, mx + 2, my, lipC);
  } else if (expr === 'surprised') px(c, mx, my, lipC, 2, 2);
  else if (expr === 'sad') {
    px(c, mx, my, lipC, 2, 1);
    px(c, mx - 1, my + 1, lipC);
    px(c, mx + 2, my + 1, lipC);
  } else if (expr === 'smug') {
    px(c, mx, my, lipC, 3, 1);
    px(c, mx + 3, my - 1, lipC);
  } else {
    px(c, mx - 1, my, lipC, 4, 1);
    if (f.lips) px(c, mx, my + 1, shade(f.lips, 0.12), 2, 1);
  }
  // cheeks and little marks
  if (f.blush) for (const bx of front ? [cx - 8, cx + 6] : [cx + 1]) px(c, bx, ey + 4, mix(sk, '#e8707e', 0.6), 2, 1);
  if (f.freckles) {
    const spots: [number, number][] = front ? [[-6, 4], [-4, 5], [-7, 5], [4, 5], [6, 4], [5, 5], [-1, 3], [1, 3]] : [[0, 4], [2, 5], [-1, 5]];
    for (const [dx, dy] of spots) px(c, cx + dx, ey + dy, shade(sk, -0.3));
  }
  if (f.mole) px(c, front ? cx + 3 : cx + 3, ey + 7, dk2);
  // facial hair
  if (f.facial > 0) {
    const fc = f.facialColor;
    const jaw = front ? [cx - 6, cx + 6] : [cx - 2, cx + 7];
    if (f.facial === 1) {
      // stubble: a sprinkle of dots along the jaw
      for (let y = ey + 6; y <= ey + 8; y++) for (let x = jaw[0]; x <= jaw[1]; x++) if ((x + y) % 2 === 0 && (y > ey + 6 || Math.abs(x - cx) > 3)) px(c, x, y, mix(fc, sk, 0.72));
    }
    if (f.facial === 2 || f.facial === 5) px(c, mx - 1, my - 1, fc, 4, 1);
    if (f.facial === 3) px(c, mx, my + 1, fc, 2, 2);
    if (f.facial === 4 || f.facial === 5) {
      for (let y = ey + 5; y <= ey + (f.facial === 5 ? 9 : 8); y++) {
        const half = front ? 6 - Math.max(0, y - (ey + 5)) * (f.facial === 5 ? 0.6 : 0.9) : 5;
        for (let x = (front ? cx - Math.round(half) : jaw[0]); x <= (front ? cx + Math.round(half) - 1 : jaw[1]); x++) {
          if (y <= ey + 6 && Math.abs(x - mx - 1) <= 1.5 && front) continue; // keep the mouth visible
          px(c, x, y, fc);
        }
      }
      if (front) px(c, mx - 1, my, lipC, 4, 1);
    }
  }
}

/** Accessories that sit on top of the hair: earrings and glasses. */
export function drawHeroAccessories(k: Kit, c: Ctx, g: HeadGeo, view: View, o: { earrings: number; glasses: string; glassColor: string; skin: string }) {
  const K = k.K;
  const cx = Math.round(g.headCx * K);
  const ey = Math.round((g.headCy + g.headRy) * K - 8.2);
  const rxo = g.headRx * K;
  if (o.earrings > 0 && view !== 'back') {
    const gold = '#f0c04a';
    const silver = '#d5dbe6';
    const col = o.earrings === 2 || o.earrings === 4 ? silver : gold;
    const ex = (s: number) => cx + Math.round(s * (rxo - 0.4));
    const sides = view === 'front' ? [-1, 1] : [1];
    for (const s of sides) {
      const x = view === 'front' ? ex(s) : cx - 1;
      if (o.earrings <= 2) px(c, x, ey + 3, col);
      else if (o.earrings <= 4) {
        px(c, x, ey + 3, col);
        px(c, x + (s > 0 || view !== 'front' ? 1 : -1), ey + 4, col);
        px(c, x, ey + 5, col);
      } else {
        px(c, x, ey + 3, col);
        px(c, x, ey + 4, '#e8707e');
        px(c, x, ey + 5, '#e8707e');
      }
    }
  }
  if (o.glasses !== 'none' && view !== 'back') {
    const col = o.glassColor;
    const xs = view === 'front' ? [cx - 6, cx + 3] : [cx + 3];
    for (const x0 of xs) {
      if (o.glasses === 'sun') {
        px(c, x0 - 1, ey, '#1f1b26', 5, 3);
        px(c, x0, ey, '#6a6f86');
        px(c, x0 - 1, ey - 1, col, 5, 1);
      } else if (o.glasses === 'round') {
        px(c, x0 - 1, ey, col, 5, 1);
        px(c, x0 - 1, ey + 4, col, 5, 1);
        px(c, x0 - 1, ey + 1, col, 1, 3);
        px(c, x0 + 3, ey + 1, col, 1, 3);
        px(c, x0, ey + 1, 'rgba(220,235,250,0.35)', 3, 3);
      } else {
        px(c, x0 - 1, ey - 1, col, 5, 1);
        px(c, x0 - 1, ey + 4, col, 5, 1);
        px(c, x0 - 1, ey - 1, col, 1, 6);
        px(c, x0 + 3, ey - 1, col, 1, 6);
      }
    }
    if (view === 'front') px(c, cx - 1, ey + 1, col, 2, 1);
    else px(c, cx - 2, ey + 1, col, 2, 1);
  }
}

/** Everything the engine needs beyond FolkSpec's generic fields to draw a hero. */
export interface HeroSpec {
  look: HeroLook;
  hair: HairDef;
  hairColor: string;
  hairHi: string;
  sleeves: 'long' | 'short' | 'none' | 'wide';
  sleeveColor: string;
  cuff?: string;
  legMode: 'long' | 'shorts' | 'wide';
  shoeKind: 'sneaker' | 'boot' | 'sandal' | 'slipper';
  shoeAccent: string;
  glasses: 'none' | 'round' | 'sun' | 'square';
  glassColor: string;
  blushItem: boolean;
  eyeStyle: number;
  headItem?: { kind: string; c1: string; c2: string };
}

// ------------------------------------------------------------------ the data: Appearance -> FolkSpec
export const HERO_SKINS = ['#fbe3d0', '#f4d3b8', '#e6b890', '#d9a77c', '#c18a62', '#a06d49', '#7d4f33', '#5e3a26'];
export const HERO_HAIR_COLORS = [
  '#1f1a22', '#3a281f', '#5a3d2e', '#7a5232', '#a07040', '#c9985a', '#e2c27a', '#f2dc9a', '#8e3f2e', '#b2584a',
  '#d8d2c8', '#8c8a96', '#3a3f6a', '#6f4fa0', '#c2587e', '#3f8a78', '#4f86c4', '#e0709a',
];
export const HERO_EYE_COLORS = ['#3a2a22', '#5d4037', '#7a5a2a', '#4f6b52', '#3b6f9c', '#6a5a9c', '#8a8e9a', '#1f1a22'];

export const HERO_DEFAULTS: Record<'m' | 'f', { name: string; look: HeroLook; app: Partial<Appearance> }> = {
  m: {
    name: 'Santiago',
    look: { gender: 'm', build: 1, face: 2, brow: 1, browColor: '', nose: 1, lips: '', freckles: false, mole: false, blush: false, facial: 0, hairHi: '', earrings: 0, neck: 3 },
    app: { species: 'human', skin: '#dba980', hairStyle: 7, hairColor: '#4a3326', eyes: 1, eyeColor: '#3a2a22', top: 'top_sweatshirt_black', bottom: 'bot_jeans_black', shoes: 'sh_sneakers_white', head: '', face: '', extra: '', bag: '' },
  },
  f: {
    name: 'Sofi',
    look: { gender: 'f', build: 1, face: 0, brow: 3, browColor: '', nose: 0, lips: '', freckles: false, mole: false, blush: true, facial: 0, hairHi: '', earrings: 0, neck: 1 },
    app: { species: 'human', skin: '#e1b38b', hairStyle: 1, hairColor: '#4a3328', eyes: 4, eyeColor: '#4a3226', top: 'top_jacket_black', bottom: 'bot_pants_black', shoes: 'sh_boots_black', head: '', face: '', extra: '', bag: '' },
  },
};

export function heroLook(a: Appearance): HeroLook {
  const base = HERO_DEFAULTS[a.hero?.gender ?? 'f'].look;
  return { ...base, ...(a.hero ?? {}) };
}

const HAT_KIND: Record<string, HatKind> = { bandana: 'bandana', straw: 'straw', witch: 'witch', chefhat: 'chef', cap: 'cap', beret: 'beret', bow: 'bow', beanie: 'beanie', headband: 'headband' };

/**
 * Translates a player Appearance (any human look) into the data the folk engine draws.
 * Clothes keep their old "kind" names so every item in the game's wardrobe and shops keeps working.
 */
export function heroSpec(a: Appearance): FolkSpec {
  const look = heroLook(a);
  const skin = a.skin;
  const hair = HERO_HAIR[Math.max(0, Math.min(HERO_HAIR.length - 1, a.hairStyle))] ?? HERO_HAIR[0];
  const top = a.top ? CLOTHES_BY_ID[a.top] : undefined;
  const bot = a.bottom ? CLOTHES_BY_ID[a.bottom] : undefined;
  const sh = a.shoes ? CLOTHES_BY_ID[a.shoes] : undefined;
  const hd = a.head ? CLOTHES_BY_ID[a.head] : undefined;
  const fc = a.face ? CLOTHES_BY_ID[a.face] : undefined;
  const ex = a.extra ? CLOTHES_BY_ID[a.extra] : undefined;
  const bg = a.bag ? CLOTHES_BY_ID[a.bag] : undefined;
  const topKind = top?.kind ?? 'tee';
  const botKind = bot?.kind ?? 'pants';
  const topC = top?.c1 ?? '#cfc3b0';
  const topC2 = top?.c2 ?? shade(topC, -0.2);
  const botC = bot?.c1 ?? '#5d6f9c';
  const dress = botKind === 'dress';
  const deco: Deco[] = [];
  // ---- what the top looks like
  switch (topKind) {
    case 'hoodie': deco.push({ k: 'hood', c: topC2 }, { k: 'pocket', c: shade(topC, -0.22) }); break;
    case 'sweatshirt': deco.push({ k: 'rib', c: shade(topC, -0.2) }); break;
    case 'sweater': deco.push({ k: 'rib', c: topC2 }); break;
    case 'jacket': deco.push({ k: 'zip', c: topC2, inner: shade(topC2, 0) }); break;
    case 'cardigan': deco.push({ k: 'zip', c: shade(topC, -0.15), inner: topC2 }, { k: 'buttons', c: shade(topC, -0.35) }); break;
    case 'shirt': deco.push({ k: 'collar', c: '#f3ede0' }, { k: 'buttons', c: shade(topC, -0.3) }, { k: 'stripesH', c: topC2, vertical: true }); break;
    case 'stripes': deco.push({ k: 'stripesH', c: topC2 }); break;
    case 'kimono': deco.push({ k: 'kimono', c: topC2 }); break;
    case 'chef': deco.push({ k: 'buttons', c: topC2 }); break;
    case 'pajama': deco.push({ k: 'collar', c: topC2 }, { k: 'buttons', c: topC2 }); break;
    case 'coat': deco.push({ k: 'zip', c: topC2, inner: shade(topC, -0.3) }, { k: 'buttons', c: topC2 }); break;
    case 'long': deco.push({ k: 'collar', c: topC2 }); break;
    case 'tank': deco.push({ k: 'tankNeck', c: skin }); break;
    default: deco.push({ k: 'rib', c: shade(topC, -0.14) });
  }
  if (botKind === 'overalls') deco.push({ k: 'bib', c: botC, strap: shade(botC, -0.2) });
  if (botKind === 'hakama' || botKind === 'dress') deco.push({ k: 'belt', c: bot?.c2 ?? shade(botC, -0.2) });
  // ---- neck, extras, bag
  const neck = look.neck;
  if (neck === 1) deco.push({ k: 'choker', c: '#1c1820' });
  if (neck === 2) deco.push({ k: 'choker', c: '#7a2a3e' });
  if (neck === 3) deco.push({ k: 'chain', c: '#f0c04a' });
  if (neck === 4) deco.push({ k: 'chain', c: '#d5dbe6' });
  if (neck === 5) deco.push({ k: 'chain', c: '#f0c04a', pendant: true });
  if (ex) {
    if (ex.kind === 'scarf') deco.push({ k: 'scarf', c: ex.c1, c2: ex.c2 ?? shade(ex.c1, -0.2) });
    else if (ex.kind === 'necklace') deco.push({ k: 'chain', c: ex.c1, pendant: true });
    else if (ex.kind === 'apron') deco.push({ k: 'apron', c: ex.c1, c2: ex.c2 });
    else if (ex.kind === 'cape') deco.push({ k: 'cape', c: ex.c1, c2: ex.c2 ?? shade(ex.c1, -0.2) });
  }
  if (bg) deco.push({ k: 'bag', c: bg.c1, c2: bg.c2 ?? shade(bg.c1, -0.25), kind: bg.kind });
  // ---- hat: native hats of the engine, the rest through the old accessory drawings
  const hat = hd && HAT_KIND[hd.kind] ? { kind: HAT_KIND[hd.kind], c: hd.c1, c2: hd.c2 } : undefined;
  const legs: FolkSpec['legs'] = dress || botKind === 'skirt' ? 'skirt' : 'pants';
  const spec: FolkSpec = {
    id: 'hero',
    ears: 'none',
    fur: skin,
    nose: shade(skin, -0.3),
    eye: a.eyeColor,
    blush: look.blush ? mix(skin, '#e8707e', 0.55) : undefined,
    human: true,
    humanEars: true,
    hat: hat as FolkSpec['hat'],
    top: dress ? botC : topC,
    topLight: shade(dress ? botC : topC, 0.18),
    legsColor: botC,
    legs,
    skirtC: botC,
    shoes: sh?.c1 ?? '#f0ece4',
    deco,
    wide: (look.gender === 'm' ? 0.7 : 0) + (look.build === 0 ? -0.7 : look.build === 2 ? 0.9 : 0),
    hero: {
      look,
      hair,
      hairColor: a.hairColor,
      hairHi: look.hairHi,
      sleeves: topKind === 'tee' || topKind === 'stripes' || topKind === 'chef' ? 'short' : topKind === 'tank' ? 'none' : topKind === 'kimono' ? 'wide' : 'long',
      sleeveColor: dress ? skin : topC,
      cuff: topKind === 'sweatshirt' || topKind === 'hoodie' || topKind === 'sweater' || topKind === 'jacket' ? shade(topC, -0.2) : undefined,
      legMode: botKind === 'shorts' ? 'shorts' : botKind === 'hakama' ? 'wide' : 'long',
      shoeKind: sh?.kind === 'boots' ? 'boot' : sh?.kind === 'sandals' ? 'sandal' : sh?.kind === 'slippers' ? 'slipper' : 'sneaker',
      shoeAccent: sh?.c2 ?? '#b2585e',
      glasses: fc?.kind === 'roundglasses' ? 'round' : fc?.kind === 'sunglasses' ? 'sun' : fc?.kind === 'glasses' ? 'square' : 'none',
      glassColor: fc?.c1 ?? '#3a2a2a',
      blushItem: fc?.kind === 'blush',
      eyeStyle: a.eyes,
      headItem: hd && !HAT_KIND[hd.kind] ? { kind: hd.kind, c1: hd.c1, c2: hd.c2 ?? hd.c1 } : undefined,
    },
  };
  return spec;
}
