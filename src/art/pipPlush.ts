/**
 * Pip's own renderer: a big, chubby, plush-toy raccoon drawn straight in output pixels (no design-grid scaling), so every
 * pixel cluster is a decision: round head and ears, a mask that never swallows the eyes, a round cream belly, stubby arms
 * and feet, and a fat ringed tail that shows in every direction.
 *
 * It keeps the shared contract of the folk sheets (30 poses in the order of FRAMES in characters.ts, feet on the last rows,
 * the head accessory and body accessory the player can lend a character) and is only used by specs with `plush: true`.
 *
 * Shading is cel style: every shape gets a light rim at its top-left and a shade rim at its bottom-right, two or three
 * tones per material, no gradients. All parts are painted on their own canvas and get a 1px ink contour, like folk.ts.
 */
import { ctx2d, makeCanvas, mix as mixHex, px, shade, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';
import type { FolkCustom, FolkExpr, FolkPose, FolkSpec } from './folk';

type Mask = (x: number, y: number) => boolean;
type View = 'front' | 'side' | 'back';

/** pixel-centre ellipse; p > 2 squares the corners a little (plush cheeks) */
const ell = (cx: number, cy: number, rx: number, ry: number, p = 2): Mask => (x, y) => Math.pow(Math.abs(x - cx) / rx, p) + Math.pow(Math.abs(y - cy) / ry, p) <= 1;
const box = (x0: number, y0: number, x1: number, y1: number): Mask => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

const toneCache = new Map<string, string>();
const tone = (c: string, a: number) => {
  const k = c + a;
  let v = toneCache.get(k);
  if (!v) toneCache.set(k, (v = shade(c, a)));
  return v;
};

interface Paint { lt?: number; dk?: number; l?: number; d?: number; pick?: (x: number, y: number) => string | null }

/** Fills a mask with a base colour, a light rim at the top-left and a shade rim at the bottom-right. */
function blob(g: Ctx, W: number, H: number, m: Mask, base: string, o: Paint = {}) {
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
function tailMask(p0: [number, number], p1: [number, number], p2: [number, number], r0: number, rMax: number, rTip: number) {
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

/** palette from the spec: warm grey fur, cream muzzle, soft belly, dark mask and paws */
function palette(spec: FolkSpec) {
  const fur = spec.fur;
  const cream = spec.furLight ?? '#e6e0d6';
  const belly = spec.belly?.c ?? '#d9d3d2';
  const mask = spec.mask ?? '#625d6e';
  const paw = spec.shoes;
  const tailC = spec.tail?.c ?? fur;
  return {
    fur, cream, belly, mask, paw, tailC,
    stripe: spec.headMark ?? shade(mask, -0.1),
    ringDark: tone(tailC, -0.42),
    ink: spec.ink ?? '#2c2230',
    eye: spec.eye,
    nose: spec.nose,
    inner: spec.innerEar ?? '#5b5967',
    mouth: tone(spec.nose, 0.05),
  };
}
type Pal = ReturnType<typeof palette>;

interface Geo {
  W: number; H: number; A: number;
  dy: number; // upper body offset: bob (walk) and breathing
  sit: boolean;
  hx: number; hy: number; hrx: number; hry: number; // head
  torsoTop: number; torsoBot: number; trx: number; tcx: number;
  armDy: number; // arms hang lower or higher with the mood
  lift: 'l' | 'r' | null; // foot lifted by the walk
  sway: number; // tail sway in pixels (walk)
}

function geo(W: number, H: number, pose: FolkPose, view: View): Geo {
  const A = W / 2;
  const sit = !!pose.sit;
  const dy = (pose.bob ?? 0) + (sit ? 2 : 0);
  const side = view === 'side';
  let armDy = 0;
  if (pose.expr === 'happy' || pose.expr === 'surprised') armDy = -2;
  else if (pose.expr === 'sad') armDy = 1;
  // a sad Pip lets his head droop a little
  const droop = pose.expr === 'sad' ? 1 : 0;
  const torsoTop = 22.7 + dy;
  return {
    W, H, A, dy, sit,
    hx: A + (side ? 1.6 : 0) + (pose.expr === 'sad' && !side ? -0.5 : 0),
    hy: 17.2 + dy + droop,
    hrx: side ? 11.4 : 12.8,
    hry: 8.8,
    torsoTop,
    torsoBot: 34.6,
    trx: side ? 9.4 : 11.6,
    tcx: A + (side ? -0.6 : 0),
    armDy,
    lift: pose.legs === 'a' ? 'l' : pose.legs === 'b' ? 'r' : null,
    sway: pose.legs === 'a' ? -1 : pose.legs === 'b' ? 1 : 0,
  };
}

// ------------------------------------------------------------------ parts
function tail(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H, A } = s;
  const lift = s.sit ? 2.5 : 0;
  let m: Mask;
  let band: (x: number, y: number) => number;
  if (view === 'back') {
    // seen from behind the tail hangs over the lower back, rings run across it
    const cx = A + s.sway * 0.8;
    const cy = 30.4 + lift;
    m = ell(cx, cy, 7.4, 6.6, 2.3);
    band = (_x, y) => (y - (cy - 6.6)) / 13.2;
  } else if (view === 'side') {
    const t = tailMask([A - 5.5, 31.2 + lift], [A - 12.6 + s.sway * 0.4, 31.6 + lift], [A - 12, 19.6 + lift], 3.6, 5.2, 3.5);
    m = t.mask; band = t.band;
  } else {
    // from the front only the fat curl beside the body shows
    const t = tailMask([A + 8, 31 + lift], [A + 14.4 + s.sway * 0.5, 31 + lift], [A + 14.2 + s.sway * 0.4, 20.4 + lift], 3.4, 4.8, 3.2);
    m = t.mask; band = t.band;
  }
  const rings = (t: number) => (t > 0.14 && t < 0.28) || (t > 0.42 && t < 0.56) || (t > 0.7 && t < 0.84) || t >= 0.93;
  blob(g, W, H, m, pal.tailC, { lt: 0.14, dk: -0.2, l: 1.4, d: 1.5, pick: (x, y) => (rings(band(x, y)) ? pal.ringDark : pal.tailC) });
}

function feet(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H, A } = s;
  const cy = (l: boolean) => (s.sit ? 36 : 35.7) - (s.lift === (l ? 'l' : 'r') ? 1 : 0);
  const foot = (cx: number, y: number, rx: number, ry: number) => blob(g, W, H, ell(cx, y, rx, ry, 2.2), pal.paw, { lt: 0.16, dk: -0.2, l: 1, d: 1 });
  if (view === 'side') {
    const swing = s.lift ? 2 : 0;
    const back = s.lift === 'l' ? -1 : 1;
    foot(A - 5.4 - swing * back * 0.5, cy(true), 3.4, 2.4);
    foot(A + 3.4 + swing * back * 0.5, cy(false), 3.4, 2.4);
    return;
  }
  if (s.sit) {
    foot(A - 8.6, cy(true), 3.9, 2.4);
    foot(A + 8.6, cy(false), 3.9, 2.4);
    return;
  }
  foot(A - 5.9, cy(true), 3.5, 2.5);
  foot(A + 5.9, cy(false), 3.5, 2.5);
}

function torso(g: Ctx, pal: Pal, s: Geo, view: View, custom?: FolkCustom) {
  const { W, H } = s;
  const top = s.torsoTop;
  const bot = s.torsoBot;
  const cy = (top + bot) / 2;
  const ry = (bot - top) / 2;
  blob(g, W, H, ell(s.tcx, cy, s.trx, ry, 2.3), pal.fur, { lt: 0.16, dk: -0.2, l: 1.8, d: 1.9 });
  if (view !== 'back') {
    const bx = view === 'side' ? s.tcx + 4.4 : s.tcx;
    const brx = view === 'side' ? 5.2 : 7.9;
    // the belly is the heart of Pip: big, round, soft
    blob(g, W, H, ell(bx, cy + 1, brx, ry - 0.9, 2.05), pal.belly, { lt: 0.22, dk: -0.12, l: 1.6, d: 1.7 });
  }
  if (custom?.extra) bodyAcc(g, custom.extra.kind, custom.extra.c1, custom.extra.c2, Math.round(s.tcx), Math.round(top) + 8, Math.round(s.trx) + 1, view);
}

function arms(g: Ctx, pal: Pal, s: Geo, view: View, pose: FolkPose) {
  const { W, H, A } = s;
  const dy = s.armDy;
  const arm = (cx: number, cy: number, rx = 2.7, ry = 4.2, pawTop = false) => {
    const m = ell(cx, cy, rx, ry, 2.2);
    // hand: the dark end of the arm (top end when raised)
    const pawAt = pawTop ? (y: number) => y < cy - ry + 2.4 : (y: number) => y > cy + ry - 2.4;
    blob(g, W, H, m, pal.fur, { lt: 0.16, dk: -0.2, l: 1.2, d: 1.3, pick: (_x, y) => (pawAt(y) ? pal.paw : pal.fur) });
  };
  if (view === 'side') {
    const swing = pose.legs === 'a' ? 1.4 : pose.legs === 'b' ? -1.4 : 0;
    if (pose.arms === 'read') { arm(A + 5.6, 29.4, 2.5, 3.6); return; }
    arm(s.tcx - 1.8 + swing, 28.6 + dy * 0.5 + (s.sit ? 2 : 0), 2.8, 3.9);
    return;
  }
  const lowL = pose.legs === 'a' ? 0 : pose.legs === 'b' ? 1 : 0.5;
  const lowR = pose.legs === 'b' ? 0 : pose.legs === 'a' ? 1 : 0.5;
  const sitDy = s.sit ? 2 : 0;
  const body = (x: number) => s.torsoTop + 6.4 + (x === 0 ? 0 : 0);
  void body;
  const baseY = 29 + sitDy;
  const mood = pose.expr === 'happy' || pose.expr === 'surprised' ? 0.8 : 0;
  if (pose.arms === 'cook1' || pose.arms === 'cook2') {
    const up = pose.arms === 'cook1' ? 0 : 1;
    arm(A - 8.3, baseY - 0.4 - up);
    arm(A + 8.3, baseY - 0.4 + up - 1);
    return;
  }
  if (pose.arms === 'read') {
    arm(A - 7.2, baseY + 0.4, 2.5, 3.6);
    arm(A + 7.2, baseY + 0.4, 2.5, 3.6);
    return;
  }
  if (pose.arms === 'wave1' || pose.arms === 'wave2') {
    // the raised paw goes on the side without the tail so it reads on its own
    const w = pose.arms === 'wave1' ? 0 : 1;
    arm(A - 14.2 - w * 0.6, 20.8 - w * 1.2, 2.5, 4.8, true);
    arm(A + 10.6, baseY - 0.2);
    return;
  }
  arm(A - 10.7 - mood, baseY + dy + lowL - 0.5, 2.7, 4.2);
  arm(A + 10.7 + mood, baseY + dy + lowR - 0.5, 2.7, 4.2);
}

function ears(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H } = s;
  const cyE = s.hy - 8.2;
  const ear = (cx: number, rx: number, ry: number, inner: boolean) => {
    blob(g, W, H, ell(cx, cyE + 0.4, rx, ry, 2), pal.fur, { lt: 0.16, dk: -0.18, l: 1.1, d: 1.2 });
    // the inside of the ear is dark; from behind a smaller dark patch stays, so the ears still read as raccoon ears
    if (inner) blob(g, W, H, ell(cx + (view === 'side' ? 0.3 : 0), cyE + 1, rx - 1.7, ry - 1.6, 2), pal.inner);
    else blob(g, W, H, ell(cx, cyE + 0.8, rx - 1.5, ry - 1.4, 2), tone(pal.fur, -0.3));
  };
  if (view === 'side') {
    ear(s.hx - 5.2, 3.3, 3.1, true); // near ear
    ear(s.hx + 3.6, 2.7, 2.7, true); // far ear
  } else {
    ear(s.hx - 9.4, 3.4, 3.2, view === 'front');
    ear(s.hx + 9.4, 3.4, 3.2, view === 'front');
  }
}

function head(g: Ctx, pal: Pal, s: Geo) {
  const { W, H } = s;
  blob(g, W, H, ell(s.hx, s.hy, s.hrx, s.hry, 2.3), pal.fur, { lt: 0.17, dk: -0.2, l: 1.9, d: 1.9 });
}

// ------------------------------------------------------------------ face (painted after the contour pass)
function face(g: Ctx, pal: Pal, s: Geo, view: View, expr: FolkExpr) {
  const { W, H, A } = s;
  if (view === 'back') {
    // the stripe carries on over the crown so Pip is recognisable from behind
    const hy = s.hy;
    blob(g, W, H, box(A - 2, hy - 8.4, A + 2, hy - 3.6), pal.stripe, {});
    return;
  }
  if (view === 'front') return faceFront(g, pal, s, expr);
  return faceSide(g, pal, s, expr);
}

function eyeAt(g: Ctx, pal: Pal, o: number, i: number, y0: number, expr: FolkExpr) {
  const s = o < i ? -1 : 1; // direction towards the outside of the face
  const lo = Math.min(o, i);
  const ink = pal.eye;
  switch (expr) {
    case 'blink':
    case 'sleep':
      px(g, i, y0 + 1, ink); px(g, o, y0 + 1, ink); px(g, o + s, y0 + 1, ink);
      if (expr === 'sleep') { px(g, o + s, y0, ink); px(g, i - s, y0 + 2, tone(pal.mask, 0.0)); }
      break;
    case 'happy':
      px(g, i, y0 + 2, ink); px(g, o, y0 + 1, ink); px(g, o + s, y0 + 2, ink);
      break;
    case 'surprised':
      px(g, lo, y0 - 1, ink, 2, 4);
      px(g, lo, y0 - 1, '#ffffff', 1, 2);
      break;
    case 'sad':
      px(g, lo, y0, ink, 2, 3);
      px(g, lo, y0 + 2, '#ffffff'); // the shine slips to the bottom: wet eyes
      px(g, i, y0 - 2, ink); px(g, o, y0 - 1, ink); // brows slant up towards the middle
      break;
    case 'smug':
      px(g, o + s, y0 + 1, ink); px(g, o, y0 + 1, ink); px(g, i, y0 + 1, ink); // heavy lid
      px(g, lo, y0 + 2, ink, 2, 1);
      px(g, lo, y0 + 2, '#ffffff');
      break;
    default:
      px(g, lo, y0, ink, 2, 3);
      px(g, lo, y0, '#ffffff'); // single highlight on the top-left
  }
}

function faceFront(g: Ctx, pal: Pal, s: Geo, expr: FolkExpr) {
  const { W, H } = s;
  const hx = s.hx;
  const hy = s.hy;
  const cxm = Math.round(hx); // axis column pair: (cxm - 1, cxm)
  // mask: two soft patches and a bridge, flat so the eyes read inside them
  for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * 6.1, hy + 0.5, 5.1, 3.7, 2.2), pal.mask, {});
  blob(g, W, H, box(hx - 2, hy - 2, hx + 2, hy + 1.4), pal.mask, {});
  // forehead stripe: Pip's mark, tapering into the bridge of the mask
  blob(g, W, H, box(hx - 2, hy - 8.4, hx + 2, hy - 3), pal.stripe, {});
  blob(g, W, H, box(hx - 1, hy - 3, hx + 1, hy - 1.4), pal.stripe, {});
  // cheeks and muzzle: pale cream with a soft rim
  // soft cheeks in between fur and cream give the face its plush volume
  for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * 7.6, hy + 5.2, 3, 2.3, 2.2), mixHex(pal.fur, pal.cream, 0.55), { lt: 0.1 });
  blob(g, W, H, ell(hx, hy + 4.7, 5.5, 3.5, 2.3), pal.cream, { lt: 0.12, dk: -0.1, l: 1.2, d: 1.2 });
  const ey = Math.round(hy - 1.2);
  eyeAt(g, pal, cxm - 7, cxm - 6, ey, expr);
  eyeAt(g, pal, cxm + 6, cxm + 5, ey, expr);
  // nose: small, a little rounded
  const ny = ey + 3;
  px(g, cxm - 2, ny, pal.nose, 4, 1);
  px(g, cxm - 1, ny + 1, pal.nose, 2, 1);
  px(g, cxm - 2, ny, tone(pal.nose, 0.35)); // glint
  const my = ny + 3;
  const mc = pal.mouth;
  switch (expr) {
    case 'happy':
      px(g, cxm - 2, my, mc, 4, 1);
      px(g, cxm - 1, my + 1, '#d98b8b', 2, 1);
      break;
    case 'surprised':
      px(g, cxm - 1, my, mc, 2, 2);
      break;
    case 'sad':
      px(g, cxm - 1, my, mc, 2, 1);
      px(g, cxm - 2, my + 1, mc); px(g, cxm + 1, my + 1, mc);
      break;
    case 'smug':
      px(g, cxm - 2, my + 1, mc, 3, 1); px(g, cxm + 1, my, mc);
      break;
    case 'sleep':
      px(g, cxm - 1, my, mc, 2, 1);
      break;
    default:
      px(g, cxm - 2, my, mc); px(g, cxm + 1, my, mc); px(g, cxm - 1, my + 1, mc, 2, 1);
  }
}

function faceSide(g: Ctx, pal: Pal, s: Geo, expr: FolkExpr) {
  const { W, H } = s;
  const hx = s.hx;
  const hy = s.hy;
  const cx = Math.round(hx);
  blob(g, W, H, ell(hx + 5.2, hy + 0.5, 5, 3.6, 2.2), pal.mask, {});
  blob(g, W, H, ell(hx + 1.4, hy - 6.2, 2.8, 2.5, 2), pal.stripe, {});
  // muzzle sticks out, cheek puffs behind it
  blob(g, W, H, ell(hx + 3.2, hy + 5.4, 3.4, 2.5, 2.2), mixHex(pal.fur, pal.cream, 0.55), { lt: 0.1 });
  blob(g, W, H, ell(hx + 8.2, hy + 4.4, 4, 3.2, 2.3), pal.cream, { lt: 0.12, dk: -0.1, l: 1.2, d: 1.2 });
  const ey = Math.round(hy - 1.2);
  eyeAt(g, pal, cx + 5, cx + 4, ey, expr);
  px(g, cx + 10, ey + 2, pal.nose, 2, 2);
  px(g, cx + 10, ey + 2, tone(pal.nose, 0.35));
  const my = ey + 6;
  const mc = pal.mouth;
  if (expr === 'happy') { px(g, cx + 6, my, mc, 4, 1); px(g, cx + 7, my + 1, '#d98b8b', 2, 1); }
  else if (expr === 'surprised') px(g, cx + 7, my, mc, 2, 2);
  else if (expr === 'sad') { px(g, cx + 7, my, mc, 3, 1); px(g, cx + 6, my + 1, mc); }
  else if (expr === 'smug') { px(g, cx + 6, my + 1, mc, 3, 1); px(g, cx + 9, my, mc); }
  else px(g, cx + 6, my, mc, 3, 1);
}

// ------------------------------------------------------------------ assembling
type Layer = (g: Ctx) => void;

function stack(W: number, H: number, ink: string, layers: Layer[], after: (g: Ctx) => void): HTMLCanvasElement {
  const out = makeCanvas(W, H);
  const o = ctx2d(out);
  for (const l of layers) {
    const cv = makeCanvas(W, H);
    const g = ctx2d(cv);
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

function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** One frame of the plush Pip. `left` is drawn as the mirror of `right`, like every folk sheet. */
export function plushFrame(spec: FolkSpec, pose: FolkPose, custom: FolkCustom | undefined, W: number, H: number): HTMLCanvasElement {
  const pal = palette(spec);
  const view: View = pose.dir === 'down' ? 'front' : pose.dir === 'up' ? 'back' : 'side';
  const s = geo(W, H, pose, view);
  const layers: Layer[] = [];
  if (view !== 'back') layers.push((g) => tail(g, pal, s, view));
  layers.push((g) => feet(g, pal, s, view));
  layers.push((g) => torso(g, pal, s, view, custom));
  layers.push((g) => arms(g, pal, s, view, pose));
  if (view === 'back') layers.push((g) => tail(g, pal, s, view));
  layers.push((g) => ears(g, pal, s, view));
  layers.push((g) => head(g, pal, s));
  const item = custom?.head;
  if (item) layers.push((g) => headAcc(g, item.kind, item.c1, item.c2, Math.round(s.hx), Math.round(s.hy - s.hry) - 1, 8, view));
  const canvas = stack(W, H, pal.ink, layers, (o) => {
    face(o, pal, s, view, pose.expr);
    if (pose.arms === 'read') {
      const A = s.A;
      const by = 27;
      px(o, A - 4, by, '#8a5a3c', 9, 6);
      px(o, A - 4, by, '#e9d3a5', 9, 5);
      px(o, A - 3, by + 1, '#f6e7c4', 3, 2);
      px(o, A, by, '#8a5a3c', 1, 5);
    }
  });
  return pose.dir === 'left' ? mirror(canvas) : canvas;
}
