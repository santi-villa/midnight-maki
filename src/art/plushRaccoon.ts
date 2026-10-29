/**
 * The plush raccoons (Pip, Spicy, Rigg): round chibi bodies drawn straight in output pixels (no design-grid scaling), so every
 * pixel cluster is a decision: a round head and round ears, a dark mask that never swallows the eyes, a cream muzzle, a round
 * cream belly, stubby arms and feet, and a fat ringed tail that shows in every direction.
 *
 * It keeps the shared contract of the folk sheets (30 poses in the order of FRAMES in characters.ts, feet on the last rows, the
 * head accessory and body accessory the player can lend a character) and is only used by specs with `plush`.
 *
 * Shading is cel style: every shape gets a light rim at its top-left and a shade rim at its bottom-right, two or three tones per
 * material, no gradients. All parts are painted on their own canvas and get a 1px ink contour, like folk.ts. Shapes use whole
 * pixel centres and radii wherever possible, so edges fall between pixels and stay crisp.
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

// ------------------------------------------------------------------ sizes
/** Every measurement of one body size, in output pixels (x measured from the symmetry axis). */
interface Dims {
  hy: number; hrx: number; hry: number; hrxS: number; // head: centre row, half sizes (front / side)
  tTop: number; tBot: number; trx: number; trxS: number; // torso
  bRx: number; bRxS: number; // belly half widths (front / side)
  armDx: number; armRx: number; armRy: number; armY: number;
  earDx: number; earRx: number; earRy: number;
  footDx: number; footRx: number; footRy: number; sitFootDx: number;
  eyeD: number; eyeW: number; eyeH: number; // eye columns: outer edge distance from the axis, size
  maskRx: number; maskRy: number;
  noseW: number;
  tail: { back: [number, number, number]; side: [[number, number], [number, number], [number, number]]; front: [[number, number], [number, number], [number, number]]; r: [number, number, number] };
}

const BIG: Dims = {
  hy: 19, hrx: 12, hry: 8, hrxS: 11,
  tTop: 25, tBot: 35, trx: 11, trxS: 9,
  bRx: 8, bRxS: 5,
  armDx: 10, armRx: 2.7, armRy: 4.2, armY: 29.6,
  earDx: 8.6, earRx: 3.3, earRy: 3.1,
  footDx: 6, footRx: 3.5, footRy: 2.5, sitFootDx: 8,
  eyeD: 6, eyeW: 2, eyeH: 3,
  maskRx: 4.8, maskRy: 3.5,
  noseW: 4,
  tail: { back: [6.4, 5.8, 30.6], side: [[-5, 31.4], [-10.6, 31.8], [-10.4, 22.2]], front: [[7, 31.2], [13.2, 31.2], [13, 22.4]], r: [3, 4.4, 3] },
};

const SMALL: Dims = {
  hy: 19.5, hrx: 10, hry: 6.5, hrxS: 9,
  tTop: 25, tBot: 35, trx: 8, trxS: 7,
  bRx: 5.5, bRxS: 4,
  armDx: 8, armRx: 2.2, armRy: 3.6, armY: 30,
  earDx: 6.8, earRx: 2.8, earRy: 2.6,
  footDx: 4.5, footRx: 2.8, footRy: 2.4, sitFootDx: 6.5,
  eyeD: 5, eyeW: 3, eyeH: 3,
  maskRx: 4, maskRy: 3.2,
  noseW: 2,
  tail: { back: [5.6, 5.2, 30.6], side: [[-4, 31.2], [-9.6, 31.6], [-9.4, 23]], front: [[5.6, 31], [11.6, 31], [11.4, 22.4]], r: [2.8, 4, 2.6] },
};

/** palette from the spec: fur, cream muzzle and belly, dark mask and paws, ringed tail */
function palette(spec: FolkSpec) {
  const look = spec.plush!;
  const fur = spec.fur;
  const cream = spec.furLight ?? '#f2e6d8';
  const tailC = spec.tail?.c ?? fur;
  return {
    fur, cream, tailC,
    belly: spec.belly?.c ?? cream,
    mask: spec.mask ?? '#514a59',
    paw: spec.shoes,
    stripe: look.stripe ?? null,
    brow: look.brow ?? null,
    earOuter: look.earOuter ?? fur,
    cheek: look.cheek ?? mixHex(fur, cream, 0.55),
    darkLimbs: !!look.darkLimbs,
    ringDark: look.ring ?? tone(tailC, -0.42),
    ink: spec.ink ?? '#2c2230',
    eye: spec.eye,
    nose: spec.nose,
    inner: spec.innerEar ?? '#5b5967',
    mouth: tone(spec.nose, 0.05),
  };
}
type Pal = ReturnType<typeof palette>;

interface Geo {
  D: Dims; look: NonNullable<FolkSpec['plush']>;
  W: number; H: number; A: number;
  dy: number; // upper body offset: bob (walk) and breathing
  sit: boolean;
  hx: number; hy: number; hrx: number; hry: number; // head
  torsoTop: number; torsoBot: number; trx: number; tcx: number;
  armDy: number; // arms hang lower or higher with the mood
  lift: 'l' | 'r' | null; // foot lifted by the walk
  sway: number; // tail sway in pixels (walk)
}

function geo(spec: FolkSpec, W: number, H: number, pose: FolkPose, view: View): Geo {
  const look = spec.plush!;
  const D = look.size === 'big' ? BIG : SMALL;
  const A = W / 2;
  const sit = !!pose.sit;
  const dy = (pose.bob ?? 0) + (sit ? 2 : 0);
  const side = view === 'side';
  let armDy = 0;
  if (pose.expr === 'happy' || pose.expr === 'surprised') armDy = -2;
  else if (pose.expr === 'sad') armDy = 1;
  // a sad one lets the head droop a little
  const droop = pose.expr === 'sad' ? 1 : 0;
  return {
    D, look, W, H, A, dy, sit,
    hx: A + (side ? 2 : 0) + (pose.expr === 'sad' && !side ? -1 : 0),
    hy: D.hy + dy + droop,
    hrx: side ? D.hrxS : D.hrx,
    hry: D.hry,
    torsoTop: D.tTop + dy,
    torsoBot: D.tBot,
    trx: side ? D.trxS : D.trx,
    tcx: A + (side ? -1 : 0),
    armDy,
    lift: pose.legs === 'a' ? 'l' : pose.legs === 'b' ? 'r' : null,
    sway: pose.legs === 'a' ? -1 : pose.legs === 'b' ? 1 : 0,
  };
}

// ------------------------------------------------------------------ parts
function tail(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H, A, D } = s;
  const k = s.look.tailK ?? 1;
  const lift = s.sit ? 2.5 : 0;
  const [r0, rMax, rTip] = D.tail.r.map((r) => r * k) as [number, number, number];
  let m: Mask;
  let band: (x: number, y: number) => number;
  if (view === 'back') {
    // seen from behind the tail hangs over the lower back, rings run across it
    const [rx, ry, cy0] = D.tail.back;
    const cx = A + s.sway * 0.8;
    const cy = cy0 + lift;
    m = ell(cx, cy, rx * k, ry * k, 2.3);
    band = (_x, y) => (y - (cy - ry * k)) / (ry * k * 2);
  } else {
    const side = view === 'side';
    const [p0, p1, p2] = side ? D.tail.side : D.tail.front;
    const sw = side ? s.sway * -0.4 : s.sway * 0.5;
    const t = tailMask(
      [A + p0[0], p0[1] + lift],
      [A + p1[0] * k + sw, p1[1] + lift],
      [A + p2[0] * k + (side ? 0 : sw * 0.8), p2[1] + lift],
      r0, rMax, rTip,
    );
    m = t.mask; band = t.band;
  }
  const rings = (t: number) => (t > 0.14 && t < 0.28) || (t > 0.42 && t < 0.56) || (t > 0.7 && t < 0.84) || t >= 0.93;
  blob(g, W, H, m, pal.tailC, { lt: 0.14, dk: -0.2, l: 1.4, d: 1.5, pick: (x, y) => (rings(band(x, y)) ? pal.ringDark : pal.tailC) });
}

function feet(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H, A, D } = s;
  const cy = (l: boolean) => (s.sit ? 36 : 35.8) - (s.lift === (l ? 'l' : 'r') ? 1 : 0);
  const foot = (cx: number, y: number, rx: number, ry: number) => blob(g, W, H, ell(cx, y, rx, ry, 2.2), pal.paw, { lt: 0.16, dk: -0.2, l: 1, d: 1 });
  if (view === 'side') {
    const swing = s.lift ? 2 : 0;
    const back = s.lift === 'l' ? -1 : 1;
    foot(A - D.footDx + 1 - swing * back * 0.5, cy(true), D.footRx - 0.1, D.footRy - 0.1);
    foot(A + D.footDx / 2 + swing * back * 0.5, cy(false), D.footRx - 0.1, D.footRy - 0.1);
    return;
  }
  if (s.sit) {
    foot(A - D.sitFootDx, cy(true), D.footRx + 0.4, D.footRy - 0.1);
    foot(A + D.sitFootDx, cy(false), D.footRx + 0.4, D.footRy - 0.1);
    return;
  }
  foot(A - D.footDx, cy(true), D.footRx, D.footRy);
  foot(A + D.footDx, cy(false), D.footRx, D.footRy);
}

function torso(g: Ctx, pal: Pal, s: Geo, view: View, custom?: FolkCustom) {
  const { W, H, D } = s;
  const top = s.torsoTop;
  const bot = s.torsoBot;
  const cy = (top + bot) / 2;
  const ry = (bot - top) / 2;
  blob(g, W, H, ell(s.tcx, cy, s.trx, ry, 2.3), pal.fur, { lt: 0.16, dk: -0.2, l: 1.8, d: 1.9 });
  if (view !== 'back') {
    const bx = view === 'side' ? s.tcx + 4 : s.tcx;
    const brx = view === 'side' ? D.bRxS : D.bRx;
    // the belly is the heart of a plush raccoon: big, round, soft
    blob(g, W, H, ell(bx, cy + 0.6, brx, ry - 1.1, 2.05), pal.belly, { lt: 0.12, dk: -0.12, l: 1.6, d: 1.7 });
  }
  const extra = custom?.extra;
  if (extra) bodyAcc(g, extra.kind, extra.c1, extra.c2, Math.round(s.tcx), Math.round(top) + 8, Math.round(s.trx) + 1, view);
}

function arms(g: Ctx, pal: Pal, s: Geo, view: View, pose: FolkPose) {
  const { W, H, A, D } = s;
  const dy = s.armDy;
  const arm = (cx: number, cy: number, rx = D.armRx, ry = D.armRy, pawTop = false) => {
    const m = ell(cx, cy, rx, ry, 2.2);
    // hand: the dark end of the arm (top end when raised); some raccoons have dark arms all the way
    const pawAt = pawTop ? (y: number) => y < cy - ry + 2.4 : (y: number) => y > cy + ry - 2.4;
    blob(g, W, H, m, pal.darkLimbs ? pal.paw : pal.fur, { lt: 0.16, dk: -0.2, l: 1.2, d: 1.3, pick: (_x, y) => (pal.darkLimbs || pawAt(y) ? pal.paw : pal.fur) });
  };
  const armY = D.armY;
  if (view === 'side') {
    const swing = pose.legs === 'a' ? 1.4 : pose.legs === 'b' ? -1.4 : 0;
    if (pose.arms === 'read') { arm(A + D.armDx / 2, armY + 0.4, D.armRx - 0.2, D.armRy - 0.6); return; }
    arm(s.tcx - 2 + swing, armY + dy * 0.5 + (s.sit ? 2 : 0), D.armRx + 0.1, D.armRy - 0.3);
    return;
  }
  const lowL = pose.legs === 'a' ? 0 : pose.legs === 'b' ? 1 : 0.5;
  const lowR = pose.legs === 'b' ? 0 : pose.legs === 'a' ? 1 : 0.5;
  const baseY = armY + (s.sit ? 2 : 0);
  const mood = pose.expr === 'happy' || pose.expr === 'surprised' ? 0.8 : 0;
  if (pose.arms === 'cook1' || pose.arms === 'cook2') {
    const up = pose.arms === 'cook1' ? 0 : 1;
    arm(A - D.armDx + 2, baseY - 0.4 - up);
    arm(A + D.armDx - 2, baseY - 0.4 + up - 1);
    return;
  }
  if (pose.arms === 'read') {
    arm(A - D.armDx + 3, baseY + 0.4, D.armRx - 0.2, D.armRy - 0.6);
    arm(A + D.armDx - 3, baseY + 0.4, D.armRx - 0.2, D.armRy - 0.6);
    return;
  }
  if (pose.arms === 'wave1' || pose.arms === 'wave2') {
    // the raised paw goes on the side without the tail so it reads on its own
    const w = pose.arms === 'wave1' ? 0 : 1;
    arm(A - D.armDx - 3.4 - w * 0.6, baseY - 7 - w * 1.2, D.armRx - 0.2, D.armRy + 0.6, true);
    arm(A + D.armDx, baseY - 0.2);
    return;
  }
  arm(A - D.armDx - mood, baseY + dy + lowL - 0.5);
  arm(A + D.armDx + mood, baseY + dy + lowR - 0.5);
}

function ears(g: Ctx, pal: Pal, s: Geo, view: View) {
  const { W, H, D } = s;
  const cyE = s.hy - s.hry + 0.6;
  const ear = (cx: number, rx: number, ry: number, inner: boolean) => {
    blob(g, W, H, ell(cx, cyE + 0.4, rx, ry, 2), inner ? pal.earOuter : pal.fur, { lt: 0.12, dk: -0.18, l: 1.1, d: 1.2 });
    // the inside of the ear is dark or cream; from behind a smaller dark patch stays, so the ears still read as raccoon ears
    if (inner) blob(g, W, H, ell(cx + (view === 'side' ? 0.3 : 0), cyE + 1, rx - 1.7, ry - 1.6, 2), pal.inner);
    else blob(g, W, H, ell(cx, cyE + 0.8, rx - 1.5, ry - 1.4, 2), tone(pal.fur, -0.3));
  };
  if (view === 'side') {
    ear(s.hx - D.earDx * 0.58, D.earRx - 0.1, D.earRy - 0.1, true); // near ear
    ear(s.hx + D.earDx * 0.5, D.earRx - 0.5, D.earRy - 0.3, true); // far ear, a touch smaller so it reads as farther away
  } else {
    ear(s.hx - D.earDx, D.earRx, D.earRy, view === 'front');
    ear(s.hx + D.earDx, D.earRx, D.earRy, view === 'front');
  }
}

function head(g: Ctx, pal: Pal, s: Geo) {
  const { W, H } = s;
  blob(g, W, H, ell(s.hx, s.hy, s.hrx, s.hry, 2.3), pal.fur, { lt: 0.14, dk: -0.2, l: 1.9, d: 1.9 });
}

// ------------------------------------------------------------------ face (painted after the contour pass)
function face(g: Ctx, pal: Pal, s: Geo, view: View, expr: FolkExpr) {
  const { W, H, A } = s;
  if (view === 'back') {
    // the stripe carries on over the crown so a striped one is recognisable from behind
    if (pal.stripe) blob(g, W, H, box(A - 2, s.hy - s.hry + 0.4, A + 2, s.hy - 3.4), pal.stripe, {});
    return;
  }
  if (view === 'front') return faceFront(g, pal, s, expr);
  return faceSide(g, pal, s, expr);
}

/** One eye on the columns x0..x0+w-1. `left` says which side of the face it is on (the outside is the left edge of a left eye). */
function eyeAt(g: Ctx, pal: Pal, x0: number, w: number, h: number, y0: number, left: boolean, expr: FolkExpr) {
  const ink = pal.eye;
  // columns from the inside of the face outwards, plus one extra beyond the outer edge for closed / happy lines
  const cols = Array.from({ length: w + 1 }, (_, k) => (left ? x0 + w - 1 - k : x0 + k));
  const row = (c: number, y: number, col = ink) => px(g, c, y, col);
  switch (expr) {
    case 'blink':
    case 'sleep':
      cols.forEach((c) => row(c, y0 + 1));
      if (expr === 'sleep') row(cols[w], y0);
      break;
    case 'happy':
      cols.forEach((c, k) => row(c, k === 0 || k === w ? y0 + 2 : y0 + 1));
      break;
    case 'surprised':
      px(g, x0, y0 - 1, ink, w, h + 1);
      px(g, x0, y0 - 1, '#ffffff', 1, 2);
      break;
    case 'sad':
      px(g, x0, y0, ink, w, h);
      px(g, x0, y0 + h - 1, '#ffffff'); // the shine slips to the bottom: wet eyes
      cols.slice(0, w).forEach((c, k) => row(c, k < w / 2 ? y0 - 2 : y0 - 1)); // brows slant up towards the middle
      break;
    case 'smug':
      cols.forEach((c) => row(c, y0 + 1)); // heavy lid
      px(g, x0, y0 + 2, ink, w, 1);
      px(g, x0, y0 + 2, '#ffffff');
      break;
    default:
      px(g, x0, y0, ink, w, h);
      px(g, x0, y0, '#ffffff'); // single highlight on the top-left
  }
}

/** eye columns of the left eye (and the mirrored right eye) */
function eyeCols(s: Geo, cxm: number) {
  const { eyeD: d, eyeW: w } = s.D;
  const left = cxm - d - w + 1;
  return { left, right: cxm + d - 1, w };
}

function noseMouth(g: Ctx, pal: Pal, s: Geo, cxm: number, ey: number, expr: FolkExpr) {
  const ny = ey + 3;
  const nw = s.D.noseW;
  px(g, cxm - nw / 2, ny, pal.nose, nw, 1);
  px(g, cxm - 1, ny + 1, pal.nose, 2, 1);
  px(g, cxm - nw / 2, ny, tone(pal.nose, 0.35)); // glint
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

function faceFront(g: Ctx, pal: Pal, s: Geo, expr: FolkExpr) {
  const { W, H, D } = s;
  const hx = s.hx;
  const hy = s.hy;
  const cxm = Math.round(hx); // axis column pair: (cxm - 1, cxm)
  const maskDx = D.eyeD + D.eyeW / 2 - 1; // the mask is centred on the eye
  // pale brow patches over the mask (only some of them have them)
  if (pal.brow) for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * (maskDx + 0.6), hy - 3.6, D.maskRx * 0.8, 1.9, 2.2), pal.brow, { lt: 0.04, dk: -0.08, l: 1, d: 1 });
  // mask: two soft patches and a bridge, flat so the eyes read inside them
  for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * maskDx, hy + 0.5, D.maskRx, D.maskRy, 2.2), pal.mask, {});
  if (pal.stripe) blob(g, W, H, box(hx - 2, hy - 2, hx + 2, hy + 1.4), pal.mask, {}); // the striped one has the mask joined by the stripe
  // forehead stripe: wider in the middle, tapering into the bridge of the mask
  if (pal.stripe) {
    const sw = Math.round(D.hrx / 4);
    blob(g, W, H, box(hx - sw + 1, hy - s.hry + 0.4, hx + sw - 1, hy - 5), pal.stripe, {});
    blob(g, W, H, box(hx - sw, hy - 5, hx + sw, hy - 2.4), pal.stripe, {});
    blob(g, W, H, box(hx - 1, hy - 2.4, hx + 1, hy - 1.4), pal.stripe, {});
  }
  // cheeks and muzzle: pale cream with a soft rim
  for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * D.hrx * 0.6, hy + s.hry * 0.61, D.hrx * 0.23, s.hry * 0.28, 2.2), pal.cheek, { lt: 0.1 });
  blob(g, W, H, ell(hx, hy + s.hry * 0.55, D.hrx * 0.44, s.hry * 0.41, 2.3), pal.cream, { lt: 0.06, dk: -0.1, l: 1.2, d: 1.2 });
  const ey = Math.round(hy - 1.2);
  const c = eyeCols(s, cxm);
  eyeAt(g, pal, c.left, c.w, D.eyeH, ey, true, expr);
  eyeAt(g, pal, c.right, c.w, D.eyeH, ey, false, expr);
  noseMouth(g, pal, s, cxm, ey, expr);
}

function faceSide(g: Ctx, pal: Pal, s: Geo, expr: FolkExpr) {
  const { W, H, D } = s;
  const hx = s.hx;
  const hy = s.hy;
  const cx = Math.round(hx);
  const k = D.hrxS / 11;
  blob(g, W, H, ell(hx + 5 * k, hy + 0.5, D.maskRx, D.maskRy, 2.2), pal.mask, {});
  if (pal.stripe) blob(g, W, H, ell(hx + 1.4, hy - s.hry * 0.7, D.hrxS * 0.25, s.hry * 0.29, 2), pal.stripe, {});
  // muzzle sticks out, cheek puffs behind it
  blob(g, W, H, ell(hx + 3 * k, hy + s.hry * 0.61, D.hrxS * 0.29, s.hry * 0.29, 2.2), pal.cheek, { lt: 0.1 });
  blob(g, W, H, ell(hx + 7.6 * k, hy + s.hry * 0.55, D.hrxS * 0.35, s.hry * 0.39, 2.3), pal.cream, { lt: 0.06, dk: -0.1, l: 1.2, d: 1.2 });
  const ey = Math.round(hy - 1.2);
  // the eye on the near side of the face: columns counted from the front of the head
  eyeAt(g, pal, cx + Math.round(4 * k), D.eyeW, D.eyeH, ey, false, expr);
  px(g, cx + Math.round(9 * k), ey + 2, pal.nose, 2, 2);
  px(g, cx + Math.round(9 * k), ey + 2, tone(pal.nose, 0.35));
  const my = ey + 6;
  const mc = pal.mouth;
  const mx = cx + Math.round(5 * k);
  if (expr === 'happy') { px(g, mx, my, mc, 4, 1); px(g, mx + 1, my + 1, '#d98b8b', 2, 1); }
  else if (expr === 'surprised') px(g, mx + 1, my, mc, 2, 2);
  else if (expr === 'sad') { px(g, mx + 1, my, mc, 3, 1); px(g, mx, my + 1, mc); }
  else if (expr === 'smug') { px(g, mx, my + 1, mc, 3, 1); px(g, mx + 3, my, mc); }
  else px(g, mx, my, mc, 3, 1);
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

/** One frame of a plush raccoon. `left` is drawn as the mirror of `right`, like every folk sheet. */
export function plushFrame(spec: FolkSpec, pose: FolkPose, custom: FolkCustom | undefined, W: number, H: number): HTMLCanvasElement {
  const pal = palette(spec);
  const view: View = pose.dir === 'down' ? 'front' : pose.dir === 'up' ? 'back' : 'side';
  const s = geo(spec, W, H, pose, view);
  const layers: Layer[] = [];
  if (view !== 'back') layers.push((g) => tail(g, pal, s, view));
  layers.push((g) => feet(g, pal, s, view));
  // the wardrobe item the player lent replaces the character's own (Spicy's apron and bandana)
  const apron = custom?.extra ? undefined : spec.deco?.find((d) => d.k === 'apron');
  layers.push((g) => {
    torso(g, pal, s, view, custom);
    if (apron && apron.k === 'apron') bodyAcc(g, 'apron', apron.c, apron.c2 ?? shade(apron.c, -0.18), Math.round(s.tcx), Math.round(s.torsoBot) - 5, Math.round(s.trx) + 1, view); // ends at the hem of the body, feet stay visible
  });
  layers.push((g) => arms(g, pal, s, view, pose));
  if (view === 'back') layers.push((g) => tail(g, pal, s, view));
  layers.push((g) => ears(g, pal, s, view));
  layers.push((g) => head(g, pal, s));
  const item = custom?.head ?? (spec.hat && spec.hat.kind === 'bandana' ? { kind: 'bandana', c1: spec.hat.c, c2: spec.hat.c2 ?? shade(spec.hat.c, -0.25) } : undefined);
  if (item) layers.push((g) => headAcc(g, item.kind, item.c1, item.c2, Math.round(s.hx), Math.round(s.hy - s.hry) - 1, Math.round(s.D.hrx * 0.67), view));
  const canvas = stack(W, H, pal.ink, layers, (o) => {
    face(o, pal, s, view, pose.expr);
    if (pose.arms === 'read') {
      const A = s.A;
      const by = 28;
      const bw = 2 * Math.floor(s.D.trx * 0.4) + 1;
      px(o, A - (bw - 1) / 2, by, '#8a5a3c', bw, 6);
      px(o, A - (bw - 1) / 2, by, '#e9d3a5', bw, 5);
      px(o, A - (bw - 1) / 2 + 1, by + 1, '#f6e7c4', 3, 2);
      px(o, A, by, '#8a5a3c', 1, 5);
    }
  });
  return pose.dir === 'left' ? mirror(canvas) : canvas;
}
