/** Pip, standing on two feet, with the plush reference's markings and soft build.
 * All frames are generated once, on an integer pixel grid. No external images.
 */
import { ctx2d, makeCanvas, outline, px, type Ctx } from './pixel';
import { bodyAcc, headAcc } from './raccoon';
import type { FolkCustom, FolkPose } from './folk';
import type { Dir } from '../core/types';

export const PIP_W = 48, PIP_H = 39, PIP_COUNT = 66;
const C = { ink: '#302d39', fur: '#88868d', light: '#aaa5aa', shade: '#64636f',
  cream: '#eee5d3', creamShade: '#c8bdaf', mask: '#41404d', paw: '#373542', eye: '#171821' };

/** Ellipses with flat colour clusters, without antialiasing or fractional pixels. */
function oval(g: Ctx, x: number, y: number, rx: number, ry: number, color: string, shaded = false) {
  for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
    if (xx * xx / (rx * rx) + yy * yy / (ry * ry) > 1) continue;
    px(g, x + xx, y + yy, shaded && yy > ry - 3 ? C.shade : shaded && yy < -ry + 2 && xx < 3 ? C.light : color);
  }
}

function tail(g: Ctx, side: boolean, sway: number) {
  const points = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16, u = 1 - t;
    const a = side ? [20, 31] : [32, 31];
    const b = side ? [8, 32] : [44, 32];
    const c = side ? [11, 23 + sway] : [40, 23 + sway];
    return { x: u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], y: u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], t };
  });
  for (let y = 18; y <= 35; y++) for (let x = 1; x < 47; x++) {
    let best = Infinity, band = 0;
    for (const p of points) {
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < best) { best = d; band = p.t; }
    }
    if (best <= 10) px(g, x, y, Math.floor(band * 4.9) % 2 ? C.mask : C.fur);
  }
}

export function pipFrame(p: FolkPose, custom?: FolkCustom, phase = 0, mouth = false): HTMLCanvasElement {
  const cv = makeCanvas(PIP_W, PIP_H), g = ctx2d(cv);
  const side = p.dir === 'left' || p.dir === 'right', back = p.dir === 'up';
  const asleep = p.expr === 'sleep', sit = !!p.sit;
  const stride = p.legs !== 'idle';
  const foot = stride ? Math.round(Math.sin(phase * Math.PI * 2) * 2) : 0;
  const lift = stride ? Math.max(0, Math.round(Math.cos(phase * Math.PI * 2))) : 0;
  const breath = p.bob && !stride ? 1 : 0;
  // Tail belongs to the rump. Its tip follows a slower, delayed arc.
  const sway = stride ? Math.round(Math.sin(phase * Math.PI * 2 - .7)) : breath;
  tail(g, side, sway);
  // Two planted feet, a pear-shaped upright torso and independent arms.
  oval(g, side ? 20 - foot : 19 - foot, 35 - lift, 4, 2, C.paw);
  oval(g, side ? 28 + foot : 29 + foot, 35, 4, 2, C.paw);
  oval(g, 24, 27 - breath, side ? 9 : 10, sit ? 9 : 8, C.fur, true);
  oval(g, 24, 32, side ? 7 : 8, 2, C.shade);
  if (!back) {
    oval(g, side ? 27 : 24, 28, side ? 5 : 7, 6, C.creamShade);
    oval(g, side ? 27 : 24, 27, side ? 4 : 6, 5 + breath, C.cream);
  }
  // Heavy round head settles into the shoulders; it never bounces with the feet.
  const hx = side ? 27 : 24, hy = sit ? 18 : 17;
  const rx = side ? 10 : 13;
  for (const ex of side ? [hx - 5, hx + 3] : [hx - 9, hx + 9]) {
    oval(g, ex, hy - 8, 4, 4, C.fur);
    oval(g, ex, hy - 8, 2, 2, back ? C.shade : C.cream);
    if (!back) px(g, ex, hy - 7, '#896956');
  }
  oval(g, hx, hy, rx, 10, C.fur, true);
  px(g, hx - 4, hy - 7, C.light, 3, 1);
  if (back) {
    px(g, hx - 2, hy - 9, C.mask, 4, 8);
    px(g, hx - 1, hy - 8, C.shade, 1, 6);
  } else {
    // Cream brow and cheeks surround two separate dark eye patches.
    oval(g, side ? hx + 3 : hx, hy + 2, side ? 7 : 12, 6, C.creamShade);
    oval(g, side ? hx + 4 : hx, hy + 1, side ? 7 : 12, 6, C.cream);
    const eyes = side ? [hx + 3] : [hx - 6, hx + 6];
    for (const ex of eyes) {
      oval(g, ex, hy, side ? 4 : 4, 5, C.mask);
      if (asleep || p.expr === 'blink' || p.expr === 'happy') {
        px(g, ex - 1, hy + 1, C.eye, 3, 1);
        if (p.expr === 'happy') px(g, ex, hy, C.eye);
      } else {
        px(g, ex, hy - 1, C.eye, 2, 3);
        px(g, ex, hy - 1, '#fff3df');
        if (p.expr === 'surprised') px(g, ex, hy + 2, C.eye, 2, 1);
        if (p.expr === 'sad') px(g, ex - 1, hy - 2, C.shade, 3, 1);
      }
    }
    // Pip's distinctive stripe down the forehead and toward the nose.
    if (!side) {
      px(g, hx - 2, hy - 9, C.mask, 5, 7);
      px(g, hx - 1, hy - 3, C.mask, 3, 6);
    }
    const nx = side ? hx + 8 : hx;
    oval(g, nx - (side ? 1 : 0), hy + 5, side ? 5 : 6, 4, C.cream);
    px(g, nx - 1, hy + 3, C.eye, 3, 2);
    px(g, nx - 1, hy + 3, '#67616a');
    px(g, nx, hy + 5, C.eye, 1, 2);
    px(g, nx + (side ? -3 : -3), hy + 7, C.mask, 3, 1);
    if (!side) px(g, nx + 1, hy + 7, C.mask, 3, 1);
    if (mouth) px(g, nx - 1, hy + 7, '#875862', 3, 2);
  }
  // Short arms swing opposite the feet, rather than acting as extra legs.
  const wave = p.arms?.startsWith('wave');
  if (!side) oval(g, 14, 28 + (foot > 0 ? 1 : 0), 3, 4, C.paw);
  oval(g, side ? 27 - Math.sign(foot) : 34, wave ? (p.arms === 'wave2' ? 16 : 18) : 28 - Math.sign(foot), 3, 4, C.paw);
  px(g, side ? 26 - Math.sign(foot) : 13, 27, '#514c59', 2, 1);
  if (p.arms === 'read') {
    px(g, 16, 28, '#795741', 17, 7); px(g, 17, 28, C.cream, 7, 5); px(g, 25, 28, C.cream, 7, 5);
    px(g, 24, 29, '#ad9779', 1, 6); px(g, 18, 30, C.creamShade, 4, 1); px(g, 26, 31, C.creamShade, 4, 1);
  } else if (p.arms?.startsWith('cook')) {
    px(g, 18, 31, C.cream, 13, 2); px(g, 21, 30, '#bd7765', 7, 1);
    px(g, p.arms === 'cook1' ? 28 : 30, 26, '#a78058', 1, 5);
  }
  const view = back ? 'back' : side ? 'side' : 'front';
  if (custom?.extra) bodyAcc(g, custom.extra.kind, custom.extra.c1, custom.extra.c2 ?? custom.extra.c1, side ? 23 : 24, 28, 9, view);
  if (custom?.head) headAcc(g, custom.head.kind, custom.head.c1, custom.head.c2 ?? custom.head.c1, hx, hy - 10, rx, view);
  outline(cv, C.ink);
  if (p.dir !== 'left') return cv;
  const flipped = makeCanvas(PIP_W, PIP_H), f = ctx2d(flipped);
  f.translate(PIP_W, 0); f.scale(-1, 1); f.drawImage(cv, 0, 0);
  return flipped;
}

export function pipMotion(dir: Dir, act: string, moving: boolean, time: number, blink: boolean, fallback: number): number {
  const dirs = ['down', 'up', 'right', 'left'] as const;
  if (moving) return 30 + dirs.indexOf(dir) * 8 + Math.floor(time * 10) % 8;
  if (act === 'read') return dir === 'up' ? 3 : blink ? 62 : 28;
  if (act === 'sit' || act === 'eat' || act === 'drink') return blink ? 63 : 29;
  if (act === 'talk') return blink ? 12 : Math.floor(time * 3) % 3 === 1 ? 64 : 0;
  if (act === 'play') return Math.floor(time * 2) % 4 === 1 ? 65 : 0;
  if (act === 'idle' || act === 'look' || act === 'work') {
    if (blink && dir !== 'up') return { down: 12, right: 16, left: 17 }[dir];
    return time % 3.6 > 2.4 ? 20 + dirs.indexOf(dir) : dirs.indexOf(dir) * 3;
  }
  return fallback;
}

export function buildPipSheet(custom?: FolkCustom) {
  const cv = makeCanvas(PIP_W * PIP_COUNT, PIP_H), g = ctx2d(cv);
  const poses: FolkPose[] = [];
  for (const dir of ['down', 'up', 'right', 'left'] as const) for (const legs of ['idle', 'a', 'b'] as const) poses.push({ dir, legs, expr: 'neutral' });
  for (const expr of ['blink', 'happy', 'surprised', 'sleep'] as const) poses.push({ dir: 'down', legs: 'idle', expr });
  poses.push({ dir: 'right', legs: 'idle', expr: 'blink' }, { dir: 'left', legs: 'idle', expr: 'blink' });
  for (const expr of ['sad', 'smug'] as const) poses.push({ dir: 'down', legs: 'idle', expr });
  for (const dir of ['down', 'up', 'right', 'left'] as const) poses.push({ dir, legs: 'idle', expr: 'neutral', bob: 1 });
  for (const arms of ['cook1', 'cook2', 'wave1', 'wave2', 'read'] as const) poses.push({ dir: 'down', legs: 'idle', expr: 'neutral', arms });
  poses.push({ dir: 'down', legs: 'idle', expr: 'neutral', sit: true });
  poses.forEach((p, i) => g.drawImage(pipFrame(p, custom, p.legs === 'a' ? .25 : .75), i * PIP_W, 0));
  let i = 30;
  for (const dir of ['down', 'up', 'right', 'left'] as const) for (let step = 0; step < 8; step++) {
    g.drawImage(pipFrame({ dir, legs: 'a', expr: 'neutral' }, custom, step / 8), i++ * PIP_W, 0);
  }
  g.drawImage(pipFrame({ dir: 'down', legs: 'idle', expr: 'blink', arms: 'read' }, custom), 62 * PIP_W, 0);
  g.drawImage(pipFrame({ dir: 'down', legs: 'idle', expr: 'blink', sit: true }, custom), 63 * PIP_W, 0);
  g.drawImage(pipFrame({ dir: 'down', legs: 'idle', expr: 'neutral' }, custom, 0, true), 64 * PIP_W, 0);
  g.drawImage(pipFrame({ dir: 'down', legs: 'idle', expr: 'neutral', bob: 1 }, custom), 65 * PIP_W, 0);
  return { canvas: cv, fw: PIP_W, fh: PIP_H };
}
