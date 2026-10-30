/**
 * The three raccoons of Midnight Maki, drawn from the real plush toys (Santi and Sofi's photos):
 *  - Pip: the biggest, grey fleece, a long pointed snout, a dark bandit mask sweeping back, cream brows and cheeks, a grey
 *    stripe from the nose to the crown, tiny button eyes, cream ears (the left one with a brown inside), dark round paws.
 *  - Rigg: medium, rust-orange long fur like a red panda, big black eye patches under white brows, a round white muzzle,
 *    white chest, black arms and legs, a little medal on the chest, a thick ringed tail.
 *  - Spicy Bacon: the smallest and the most playful, fluffy grey, a big head with round black patches and big glossy brown
 *    eyes, a white muzzle with a big black nose, a white bib, black-tipped ears; red bandana and apron of the kitchen.
 *
 * Drawn straight in output pixels with the plush toolkit (plushRaccoon.ts): cel shading, a 1px ink contour per part,
 * no scaling and no images. Same 30-pose contract as every folk sheet (FRAMES in characters.ts).
 */
import { px, shade, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';
import { blob, box, ell, mirror, stack, tailMask, tone, type Layer, type Mask } from './plushRaccoon';
import type { FolkCustom, FolkExpr, FolkPose } from './folk';

export type TrioId = 'pip' | 'rigg' | 'spicy';
type View = 'front' | 'side' | 'back';
type P2 = [number, number];

interface Look {
  W: number; // frame width (height is always 39, feet on the last rows)
  hy: number; hrx: number; hry: number; hrxS: number; hp: number; // head
  tTop: number; trx: number; trxS: number; bRx: number; bRy: number; // torso, belly
  armDx: number; armRx: number; armRy: number; armY: number;
  footDx: number; footRx: number; footRy: number;
  earDx: number; earRx: number; earRy: number; earPoint: number; // 0 round .. 1 pointed
  tail: { front: [P2, P2, P2]; side: [P2, P2, P2]; back: [number, number, number]; r: [number, number, number] };
  hop: number; // extra lift of the walk frames (Spicy bounces)
  fur: string; furLight: string; dark: string; cream: string; belly: string; limb: string; armLimb: boolean;
  ear: string; earIn: string; earBack: string; tailA: string; tailB: string; nose: string; eye: string; ink: string;
}

const LOOKS: Record<TrioId, Look> = {
  pip: {
    W: 36, hy: 19, hrx: 12, hry: 8, hrxS: 11, hp: 2.3,
    tTop: 25, trx: 11, trxS: 9, bRx: 7, bRy: 3.8,
    armDx: 10, armRx: 2.8, armRy: 4.1, armY: 29.6,
    footDx: 6, footRx: 3.6, footRy: 2.5,
    earDx: 8.4, earRx: 3.3, earRy: 3.6, earPoint: 0.35,
    tail: { front: [[7, 31.2], [13, 31.2], [12.8, 22.6]], side: [[-5, 31.4], [-10.4, 31.8], [-10.2, 22.4]], back: [6.2, 5.6, 30.6], r: [3, 4.3, 3] },
    hop: 0,
    fur: '#a3a0a7', furLight: '#b6b3b8', dark: '#6a6672', cream: '#efe6d8', belly: '#b4b1b7', limb: '#56535d', armLimb: false,
    ear: '#efe6d8', earIn: '#7d4a34', earBack: '#8e8b93', tailA: '#a3a0a7', tailB: '#5d5a64', nose: '#1c1a20', eye: '#121016', ink: '#2c2830',
  },
  rigg: {
    W: 34, hy: 21, hrx: 10.5, hry: 7.5, hrxS: 9.5, hp: 2.2,
    tTop: 26, trx: 8.5, trxS: 7.2, bRx: 4.6, bRy: 4.2,
    armDx: 8, armRx: 2.3, armRy: 3.8, armY: 30.2,
    footDx: 4.6, footRx: 2.9, footRy: 2.4,
    earDx: 7.4, earRx: 3, earRy: 3.6, earPoint: 0.6,
    tail: { front: [[5.6, 31], [12, 31], [11.8, 22]], side: [[-4, 31.2], [-10, 31.6], [-9.8, 22.2]], back: [5.8, 5.6, 30.6], r: [2.9, 4.2, 2.8] },
    hop: 0,
    fur: '#b0603c', furLight: '#c77a52', dark: '#1f1a1f', cream: '#f1ebe3', belly: '#f1ebe3', limb: '#262026', armLimb: true,
    ear: '#b0603c', earIn: '#f1ebe3', earBack: '#3a2a26', tailA: '#b0603c', tailB: '#6b3324', nose: '#141116', eye: '#0c0a0f', ink: '#2a1f1e',
  },
  spicy: {
    W: 30, hy: 22.5, hrx: 9.5, hry: 7, hrxS: 8.6, hp: 2.15,
    tTop: 27.5, trx: 6.6, trxS: 5.8, bRx: 3.6, bRy: 3.3,
    armDx: 6.4, armRx: 2, armRy: 3.2, armY: 31,
    footDx: 3.6, footRx: 2.5, footRy: 2.2,
    earDx: 6.6, earRx: 2.8, earRy: 3.4, earPoint: 0.55,
    tail: { front: [[4.6, 31.4], [10.6, 31.4], [10.4, 23.4]], side: [[-3.4, 31.6], [-9, 32], [-8.8, 23.6]], back: [4.8, 4.8, 31], r: [2.5, 3.7, 2.6] },
    hop: 1,
    fur: '#9c9aa0', furLight: '#b3b1b6', dark: '#18151b', cream: '#efebe6', belly: '#efebe6', limb: '#77757d', armLimb: false,
    ear: '#9c9aa0', earIn: '#f1e7dc', earBack: '#6e6c74', tailA: '#9c9aa0', tailB: '#5f5d66', nose: '#141116', eye: '#8a5a2e', ink: '#28252c',
  },
};

/** Frame width of each raccoon's sheet (the height is FOLK_H, 39). */
export const TRIO_W: Record<TrioId, number> = { pip: LOOKS.pip.W, rigg: LOOKS.rigg.W, spicy: LOOKS.spicy.W };

/** a rotated ellipse (for masks that sweep back diagonally) */
const rell = (cx: number, cy: number, rx: number, ry: number, ang: number): Mask => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
  };
};

interface Geo {
  L: Look; W: number; H: number; A: number; view: View; sit: boolean; dy: number;
  hx: number; hy: number; hrx: number; torsoTop: number; torsoBot: number; trx: number; tcx: number;
  armDy: number; lift: 'l' | 'r' | null; sway: number;
}

function geo(L: Look, pose: FolkPose, view: View): Geo {
  const W = L.W, A = W / 2, side = view === 'side';
  const sit = !!pose.sit;
  const walking = pose.legs !== 'idle';
  const dy = (pose.bob ?? 0) - (walking ? L.hop : 0) + (sit ? 2 : 0);
  let armDy = 0;
  if (pose.expr === 'happy' || pose.expr === 'surprised') armDy = -2;
  else if (pose.expr === 'sad') armDy = 1;
  return {
    L, W, H: 39, A, view, sit, dy,
    hx: A + (side ? 2 : 0) + (pose.expr === 'sad' && !side ? -1 : 0),
    hy: L.hy + dy + (pose.expr === 'sad' ? 1 : 0),
    hrx: side ? L.hrxS : L.hrx,
    torsoTop: L.tTop + dy, torsoBot: 35, trx: side ? L.trxS : L.trx, tcx: A + (side ? -1 : 0),
    armDy,
    lift: pose.legs === 'a' ? 'l' : pose.legs === 'b' ? 'r' : null,
    sway: pose.legs === 'a' ? -1 : pose.legs === 'b' ? 1 : 0,
  };
}

// ------------------------------------------------------------------ body parts
function tail(g: Ctx, s: Geo) {
  const { L, W, H, A } = s;
  const lift = s.sit ? 2.5 : 0;
  const [r0, rMax, rTip] = L.tail.r;
  let m: Mask, band: (x: number, y: number) => number;
  if (s.view === 'back') {
    const [rx, ry, cy0] = L.tail.back;
    const cx = A + s.sway * 0.8, cy = cy0 + lift;
    m = ell(cx, cy, rx, ry, 2.3);
    band = (_x, y) => (y - (cy - ry)) / (ry * 2);
  } else {
    const side = s.view === 'side';
    const [p0, p1, p2] = side ? L.tail.side : L.tail.front;
    const sw = side ? s.sway * -0.4 : s.sway * 0.5;
    const t = tailMask([A + p0[0], p0[1] + lift], [A + p1[0] + sw, p1[1] + lift], [A + p2[0] + sw * 0.8, p2[1] + lift], r0, rMax, rTip);
    m = t.mask; band = t.band;
  }
  const rings = (t: number) => (t > 0.14 && t < 0.28) || (t > 0.42 && t < 0.56) || (t > 0.7 && t < 0.84) || t >= 0.93;
  blob(g, W, H, m, L.tailA, { lt: 0.14, dk: -0.2, l: 1.4, d: 1.5, pick: (x, y) => (rings(band(x, y)) ? L.tailB : L.tailA) });
}

function feet(g: Ctx, s: Geo) {
  const { L, W, H, A } = s;
  const cy = (l: boolean) => (s.sit ? 36 : 35.8) - (s.lift === (l ? 'l' : 'r') ? 1 : 0);
  const foot = (cx: number, y: number, rx: number, ry: number) => blob(g, W, H, ell(cx, y, rx, ry, 2.2), L.limb, { lt: 0.16, dk: -0.2, l: 1, d: 1 });
  if (s.view === 'side') {
    const swing = s.lift ? 2 : 0, back = s.lift === 'l' ? -1 : 1;
    foot(A - L.footDx + 1 - swing * back * 0.5, cy(true), L.footRx - 0.1, L.footRy - 0.1);
    foot(A + L.footDx / 2 + swing * back * 0.5, cy(false), L.footRx - 0.1, L.footRy - 0.1);
    return;
  }
  const dx = s.sit ? L.footDx + 2 : L.footDx;
  foot(A - dx, cy(true), L.footRx, L.footRy);
  foot(A + dx, cy(false), L.footRx, L.footRy);
}

function torso(g: Ctx, s: Geo, id: TrioId, custom?: FolkCustom) {
  const { L, W, H } = s;
  const top = s.torsoTop, bot = s.torsoBot, cy = (top + bot) / 2, ry = (bot - top) / 2;
  blob(g, W, H, ell(s.tcx, cy, s.trx, ry, 2.3), L.fur, { lt: 0.16, dk: -0.2, l: 1.8, d: 1.9 });
  if (s.view !== 'back') {
    const side = s.view === 'side';
    const bx = side ? s.tcx + s.trx * 0.45 : s.tcx;
    const brx = side ? L.bRx * 0.62 : L.bRx;
    // Rigg's and Spicy's white chest runs up under the chin; Pip has a soft lighter belly
    const bcy = id === 'pip' ? cy + 0.8 : cy - 0.4;
    blob(g, W, H, ell(bx, bcy, brx, L.bRy + (id === 'pip' ? 0 : 0.6), 2.1), L.belly, { lt: 0.1, dk: -0.12, l: 1.4, d: 1.5 });
    if (id === 'rigg' && !side) { px(g, Math.round(s.tcx) - 1, Math.round(top) + 2, '#d9b45a', 2, 2); px(g, Math.round(s.tcx) - 1, Math.round(top) + 2, '#f3dc94'); }
  }
  if (custom?.extra) bodyAcc(g, custom.extra.kind, custom.extra.c1, custom.extra.c2, Math.round(s.tcx), Math.round(top) + 8, Math.round(s.trx) + 1, s.view);
}

function arms(g: Ctx, s: Geo, pose: FolkPose) {
  const { L, W, H, A } = s;
  const arm = (cx: number, cy: number, rx = L.armRx, ry = L.armRy, pawTop = false) => {
    const pawAt = pawTop ? (y: number) => y < cy - ry + 2.2 : (y: number) => y > cy + ry - 2.2;
    blob(g, W, H, ell(cx, cy, rx, ry, 2.2), L.armLimb ? L.limb : L.fur, { lt: 0.16, dk: -0.2, l: 1.2, d: 1.3, pick: (_x, y) => (L.armLimb || pawAt(y) ? L.limb : L.fur) });
  };
  const y0 = L.armY + (s.sit ? 2 : 0) + s.dy * 0.5;
  if (s.view === 'side') {
    const swing = pose.legs === 'a' ? 1.4 : pose.legs === 'b' ? -1.4 : 0;
    arm(s.tcx - 1.5 + swing, y0 + s.armDy * 0.5, L.armRx + 0.1, L.armRy - 0.3);
    return;
  }
  const lowL = pose.legs === 'a' ? 0 : pose.legs === 'b' ? 1 : 0.5;
  const lowR = pose.legs === 'b' ? 0 : pose.legs === 'a' ? 1 : 0.5;
  const mood = pose.expr === 'happy' || pose.expr === 'surprised' ? 0.8 : 0;
  if (pose.arms === 'cook1' || pose.arms === 'cook2') {
    const up = pose.arms === 'cook1' ? 0 : 1;
    arm(A - L.armDx + 2, y0 - 0.4 - up); arm(A + L.armDx - 2, y0 - 1.4 + up);
    return;
  }
  if (pose.arms === 'read') {
    arm(A - L.armDx + 2.6, y0 + 0.4, L.armRx - 0.2, L.armRy - 0.6); arm(A + L.armDx - 2.6, y0 + 0.4, L.armRx - 0.2, L.armRy - 0.6);
    return;
  }
  if (pose.arms === 'wave1' || pose.arms === 'wave2') {
    const w = pose.arms === 'wave1' ? 0 : 1;
    arm(A - L.armDx - 3.2 - w * 0.6, y0 - 7 - w * 1.2, L.armRx - 0.2, L.armRy + 0.6, true);
    arm(A + L.armDx, y0 - 0.2);
    return;
  }
  arm(A - L.armDx - mood, y0 + s.armDy + lowL - 0.5);
  arm(A + L.armDx + mood, y0 + s.armDy + lowR - 0.5);
}

/** a round ear that narrows to a soft point (earPoint) */
const earMask = (cx: number, cy: number, rx: number, ry: number, point: number): Mask => (x, y) => {
  const v = (y - cy) / ry;
  if (Math.abs(v) > 1) return false;
  const narrow = v < 0 ? 1 - point * Math.pow(-v, 1.4) : 1;
  return Math.abs(x - cx) <= rx * Math.sqrt(1 - v * v) * narrow + 0.2;
};

function ears(g: Ctx, s: Geo, id: TrioId) {
  const { L, W, H } = s;
  const cy = s.hy - L.hry + 0.4;
  const ear = (cx: number, rx: number, ry: number, inner: boolean, brownIn: boolean) => {
    blob(g, W, H, earMask(cx, cy, rx, ry, L.earPoint), s.view === 'back' ? L.earBack : L.ear, { lt: 0.12, dk: -0.16, l: 1.1, d: 1.2 });
    if (inner) blob(g, W, H, earMask(cx, cy + 1, rx - 1.4, ry - 1.4, L.earPoint), brownIn ? L.earIn : id === 'pip' ? tone(L.ear, -0.1) : L.earIn);
    // Spicy's ears end in a little black tuft
    if (id === 'spicy') blob(g, W, H, (x, y) => earMask(cx, cy, rx, ry, L.earPoint)(x, y) && y < cy - ry + 1.6, L.dark);
  };
  if (s.view === 'side') {
    ear(s.hx - L.earDx * 0.55, L.earRx - 0.1, L.earRy - 0.1, true, id === 'pip');
    ear(s.hx + L.earDx * 0.45, L.earRx - 0.5, L.earRy - 0.4, true, false);
    return;
  }
  ear(s.hx - L.earDx, L.earRx, L.earRy, s.view === 'front', id === 'pip');
  ear(s.hx + L.earDx, L.earRx, L.earRy, s.view === 'front', false);
}

function head(g: Ctx, s: Geo, id: TrioId) {
  const { L, W, H } = s;
  const m = ell(s.hx, s.hy, s.hrx, L.hry, L.hp);
  blob(g, W, H, m, L.fur, { lt: 0.15, dk: -0.2, l: 1.9, d: 1.9 });
  // long fur: Rigg's cheeks stick out in two soft tufts; Spicy has a fluffy crown
  if (id === 'rigg' && s.view === 'front') for (const sg of [-1, 1]) blob(g, W, H, ell(s.hx + sg * (s.hrx - 0.8), s.hy + 3, 1.8, 1.5, 2), L.cream, { dk: -0.08 });
  if (id === 'spicy' && s.view !== 'side') blob(g, W, H, (x, y) => y < s.hy - L.hry + 1.6 && y > s.hy - L.hry - 1.2 && Math.abs(x - s.hx) < 2.2 && (Math.floor(x) % 2 === 0), L.fur);
}

// ------------------------------------------------------------------ faces (after the contour pass)
function eyesFront(g: Ctx, s: Geo, id: TrioId, expr: FolkExpr, lx: number, rx: number, ey: number, w: number, h: number) {
  const { L } = s;
  const ink = id === 'spicy' ? '#140f12' : L.eye;
  // a closed eye inside a black patch is drawn pale so it still reads
  const lid = id === 'pip' ? ink : '#efebe6';
  const one = (x0: number, left: boolean) => {
    const out = left ? x0 - 1 : x0 + w; // the column beyond the outer edge
    switch (expr) {
      case 'blink':
      case 'sleep':
        px(g, Math.min(x0, out), ey + 1, lid, w + 1, 1);
        return;
      case 'happy':
        for (let k = 0; k < w + 1; k++) px(g, Math.min(x0, out) + k, k === 0 || k === w ? ey + 2 : ey + 1, lid);
        return;
      case 'surprised':
        px(g, x0, ey - 1, ink, w, h + 1);
        px(g, x0, ey - 1, '#ffffff', 1, 1);
        return;
      default:
        px(g, x0, ey, ink, w, h);
        if (id === 'spicy') { px(g, x0 + w - 1, ey + h - 1, '#2a1a12'); px(g, x0, ey, '#ffffff'); px(g, x0 + 1, ey + 1, '#c08550'); }
        else if (id === 'rigg') { px(g, x0, ey, '#ffffff'); px(g, x0 + w - 1, ey + h - 1, '#3fb7a8'); }
        else px(g, x0, ey, '#ffffff');
        if (expr === 'sad') px(g, x0 + (left ? w - 1 : 0), ey - 2, lid);
        if (expr === 'smug') px(g, x0, ey, L.dark, w, 1);
    }
  };
  one(lx, true);
  one(rx, false);
}

function mouthFront(g: Ctx, cx: number, my: number, expr: FolkExpr, col: string) {
  switch (expr) {
    case 'happy': px(g, cx - 2, my, col, 4, 1); px(g, cx - 1, my + 1, '#d98b8b', 2, 1); break;
    case 'surprised': px(g, cx - 1, my, col, 2, 2); break;
    case 'sad': px(g, cx - 1, my, col, 2, 1); px(g, cx - 2, my + 1, col); px(g, cx + 1, my + 1, col); break;
    case 'smug': px(g, cx - 2, my + 1, col, 3, 1); px(g, cx + 1, my, col); break;
    default: px(g, cx - 2, my, col); px(g, cx + 1, my, col); px(g, cx - 1, my + 1, col, 2, 1);
  }
}

function face(g: Ctx, s: Geo, id: TrioId, expr: FolkExpr) {
  const { L, W, H } = s;
  const hx = s.hx, hy = s.hy, cx = Math.round(hx);
  if (s.view === 'back') {
    if (id === 'pip') blob(g, W, H, box(hx - 2, hy - L.hry + 0.4, hx + 2, hy - 2), L.dark);
    return;
  }
  const mouth = tone(L.nose, 0.05);
  if (s.view === 'side') {
    const k = s.hrx / 11;
    if (id === 'pip') {
      blob(g, W, H, rell(hx + 4.6 * k, hy - 0.4, 5, 2.2, -0.35), L.dark);
      blob(g, W, H, rell(hx + 4.2 * k, hy - 3.4, 3.6, 1.4, -0.3), L.cream);
      blob(g, W, H, ell(hx + 2.8 * k, hy + 4.4, 3.4, 2.4, 2.2), L.cream, { lt: 0.06 });
      // the long snout sticks out past the head
      blob(g, W, H, (x, y) => ell(hx + 8.6 * k, hy + 3.6, 4.6, 2.6, 2.2)(x, y), L.cream, { dk: -0.08, d: 1 });
      px(g, cx + Math.round(12.4 * k), Math.round(hy + 2.4), L.nose, 2, 2);
      px(g, cx + Math.round(5 * k), Math.round(hy - 1.6), L.eye, 2, 2);
      px(g, cx + Math.round(5 * k), Math.round(hy - 1.6), '#ffffff');
      px(g, cx + Math.round(8.6 * k), Math.round(hy + 5.4), mouth, 3, 1);
      return;
    }
    const eyeX = cx + Math.round(4.4 * k), ey = Math.round(hy - 1.4);
    if (id === 'rigg') blob(g, W, H, rell(hx + 6.2 * k, hy - 3.6, 3.2, 1.4, -0.2), L.cream);
    blob(g, W, H, ell(hx + 4.8 * k, hy + 0.2, 3.2, 2.9, 2.1), L.dark);
    blob(g, W, H, ell(hx + 7.8 * k, hy + 3.6, 3.6, 2.6, 2.2), L.cream, { dk: -0.08, d: 1 });
    px(g, cx + Math.round(10.6 * k), Math.round(hy + 1.6), L.nose, 2, 2);
    if (expr === 'blink' || expr === 'sleep' || expr === 'happy') px(g, eyeX - 1, ey + 1, '#efebe6', 3, 1);
    else {
      px(g, eyeX, ey, id === 'spicy' ? '#140f12' : L.eye, 2, 3);
      px(g, eyeX, ey, '#ffffff');
      if (id === 'spicy') px(g, eyeX + 1, ey + 1, '#c08550');
    }
    px(g, cx + Math.round(7.4 * k), Math.round(hy + 5), mouth, 3, 1);
    return;
  }
  // ---- front
  if (id === 'pip') {
    // cream brows sweep up to the ears, the dark mask sweeps back under them, the grey stripe runs to the crown
    for (const sg of [-1, 1]) blob(g, W, H, rell(hx + sg * 5.4, hy - 3, 4.4, 1.9, sg * 0.42), L.cream, { dk: -0.06 });
    for (const sg of [-1, 1]) blob(g, W, H, rell(hx + sg * 6, hy + 0.2, 5, 2.3, sg * 0.38), L.dark);
    blob(g, W, H, (x, y) => y >= hy - L.hry + 0.4 && y < hy + 2 && Math.abs(x - hx) <= 1.2 + Math.max(0, (hy - y) * 0.22), L.dark);
    for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * 7.6, hy + 4.4, 3, 2.4, 2.1), L.cream, { dk: -0.06 });
    // a pointed snout: narrower towards the nose
    blob(g, W, H, (x, y) => {
      const v = (y - (hy + 3.8)) / 3.6;
      if (Math.abs(v) > 1) return false;
      return Math.abs(x - hx) <= 4.4 * Math.sqrt(1 - v * v) * (v > 0 ? 1 - v * 0.45 : 1);
    }, L.cream, { lt: 0.04, dk: -0.08, l: 1, d: 1 });
    const ey = Math.round(hy - 0.6);
    if (expr === 'blink' || expr === 'sleep') { px(g, cx - 7, ey + 1, L.eye, 3, 1); px(g, cx + 4, ey + 1, L.eye, 3, 1); }
    else if (expr === 'happy') { for (const x0 of [cx - 7, cx + 4]) { px(g, x0, ey + 1, L.eye); px(g, x0 + 1, ey, L.eye); px(g, x0 + 2, ey + 1, L.eye); } }
    else eyesFront(g, s, id, expr, cx - 6, cx + 4, ey, 2, expr === 'surprised' ? 3 : 2);
    px(g, cx - 1, Math.round(hy + 5.6), L.nose, 2, 2);
    px(g, cx - 1, Math.round(hy + 5.6), tone(L.nose, 0.35));
    mouthFront(g, cx, Math.round(hy + 7.4), expr === 'neutral' || expr === 'blink' ? 'sleep' : expr, mouth);
    return;
  }
  const big = id === 'spicy';
  const pDx = big ? 3.9 : 4.6, pRx = big ? 3.3 : 3.5, pRy = big ? 3.1 : 3;
  if (id === 'rigg') for (const sg of [-1, 1]) blob(g, W, H, rell(hx + sg * 5, hy - 3.4, 3.6, 1.6, sg * 0.3), L.cream);
  // a pale ring around Spicy's patches, like the plush
  if (big) for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * pDx, hy + 0.2, pRx + 0.9, pRy + 0.8, 2.1), '#cfccd2');
  for (const sg of [-1, 1]) blob(g, W, H, ell(hx + sg * pDx, hy + 0.2, pRx, pRy, 2.1), L.dark);
  blob(g, W, H, ell(hx, hy + 4.2, big ? 3.8 : 3.6, big ? 2.8 : 2.6, 2.2), L.cream, { dk: -0.08, d: 1 });
  const w = big ? 2 : 2, h = big ? 3 : 2;
  const ey = Math.round(hy - 0.8);
  const lx = cx - Math.round(pDx) - 1, rx = cx + Math.round(pDx) - 1;
  eyesFront(g, s, id, expr, lx, rx, ey, w, h);
  // Rigg's lashes: a tiny flick at the outer top of each patch
  if (id === 'rigg' && expr !== 'sleep') { px(g, lx - 2, ey - 2, L.ink); px(g, rx + w + 1, ey - 2, L.ink); }
  const nw = big ? 4 : 2;
  px(g, cx - nw / 2, Math.round(hy + 2.6), L.nose, nw, 2);
  px(g, cx - nw / 2, Math.round(hy + 2.6), tone(L.nose, 0.4));
  mouthFront(g, cx, Math.round(hy + 5), expr, mouth);
}

/** One frame of Pip, Rigg or Spicy Bacon. `left` is the mirror of `right`. */
export function trioFrame(id: TrioId, pose: FolkPose, custom?: FolkCustom): HTMLCanvasElement {
  const L = LOOKS[id];
  const view: View = pose.dir === 'down' ? 'front' : pose.dir === 'up' ? 'back' : 'side';
  const s = geo(L, pose, view);
  const layers: Layer[] = [];
  if (view !== 'back') layers.push((g) => tail(g, s));
  layers.push((g) => feet(g, s));
  layers.push((g) => {
    torso(g, s, id, custom);
    // Spicy's own apron, unless the player lent another body item
    if (id === 'spicy' && !custom?.extra) bodyAcc(g, 'apron', '#f6e6d6', '#e8b09e', Math.round(s.tcx), Math.round(s.torsoBot) - 5, Math.round(s.trx) + 1, view);
  });
  layers.push((g) => arms(g, s, pose));
  if (view === 'back') layers.push((g) => tail(g, s));
  layers.push((g) => ears(g, s, id));
  layers.push((g) => head(g, s, id));
  const item = custom?.head ?? (id === 'spicy' ? { kind: 'bandana', c1: '#c9482f', c2: '#962f24' } : undefined);
  if (item) layers.push((g) => headAcc(g, item.kind, item.c1, item.c2, Math.round(s.hx), Math.round(s.hy - L.hry) - 1, Math.round(L.hrx * 0.67), view));
  const canvas = stack(L.W, 39, L.ink, layers, (o) => {
    face(o, s, id, pose.expr);
    if (pose.arms === 'read') {
      const bw = 2 * Math.floor(s.trx * 0.4) + 1, bx = s.A - (bw - 1) / 2, by = Math.round(s.torsoTop) + 3;
      px(o, bx, by, '#8a5a3c', bw, 6); px(o, bx, by, '#e9d3a5', bw, 5); px(o, bx + 1, by + 1, '#f6e7c4', 3, 2); px(o, s.A, by, '#8a5a3c', 1, 5);
    }
  });
  return pose.dir === 'left' ? mirror(canvas) : canvas;
}

void shade;
