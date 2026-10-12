/**
 * Storybook slides for the opening: still pixel-art illustrations (no motion) with text and sound.
 * Each picture can be replaced by a hand-made image dropped at public/intro/<n>.jpg (or .png).
 */
import { drawCharacter } from '../art/characters';
import { brightGrass, pathTile } from '../art/nature';
import { drawObject } from '../art/objects';
import { ctx2d, ellipse, makeCanvas, px, rng, shade, type Ctx } from '../art/pixel';
import type { Appearance } from '../core/types';

export const SW = 256;
export const SH = 144;
const INK = '#1c1420';

function sky(c: Ctx, stops: [number, string][]) {
  for (let y = 0; y < SH; y++) {
    let col = stops[0][1];
    for (const [at, cc] of stops) if (y / SH >= at) col = cc;
    px(c, 0, y, col, SW, 1);
  }
}

/** Character drawn at an integer scale (nearest neighbour). */
function bigChar(c: Ctx, a: Appearance, dir: 'up' | 'down' | 'left' | 'right', x: number, y: number, scale: number) {
  const t = makeCanvas(20, 30);
  drawCharacter(ctx2d(t), 0, 0, a, { dir, legs: 'idle', expr: 'neutral' });
  c.imageSmoothingEnabled = false;
  c.drawImage(t, x, y, 20 * scale, 30 * scale);
}

function rainStreaks(c: Ctx, x0: number, y0: number, w: number, h: number, seed: number, col = 'rgba(190,212,236,.55)') {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    const x = x0 + Math.floor(r() * w);
    const y = y0 + Math.floor(r() * h);
    px(c, x, y, col, 1, 3);
    px(c, x - 1, y + 3, col, 1, 2);
  }
}

// ------------------------------------------------------------------ 1. the grey city, a rainy night
function city(c: Ctx, a: Appearance) {
  const r = rng(11);
  // the room: dark wall around a big window
  px(c, 0, 0, '#2a2236', SW, SH);
  for (let x = 0; x < SW; x += 12) px(c, x, 0, '#30283e', 6, SH);
  const wx = 52;
  const wy = 12;
  const ww = 152;
  const wh = 92;
  // outside: night sky + skyline
  const out = makeCanvas(ww, wh);
  const o = ctx2d(out);
  for (let y = 0; y < wh; y++) px(o, 0, y, y < 30 ? '#141a38' : y < 60 ? '#1d2448' : '#262c52', ww, 1);
  for (let i = 0; i < 16; i++) {
    const bw = 10 + Math.floor(r() * 16);
    const bh = 30 + Math.floor(r() * 50);
    const bx = Math.floor(r() * (ww - bw));
    const tone = r() < 0.5 ? '#3a3d5c' : '#33354f';
    px(o, bx, wh - bh, tone, bw, bh);
    px(o, bx, wh - bh, shade(tone, 0.12), bw, 1);
    for (let yy = wh - bh + 3; yy < wh - 3; yy += 5)
      for (let xx = bx + 2; xx < bx + bw - 2; xx += 4) if (r() < 0.32) px(o, xx, yy, r() < 0.7 ? '#f2d58a' : '#9fc8ff', 2, 2);
  }
  rainStreaks(o, 0, 0, ww, wh, 3);
  c.drawImage(out, wx, wy);
  // window frame with a cross bar and drops on the glass
  px(c, wx - 4, wy - 4, '#4a3a2c', ww + 8, 4);
  px(c, wx - 4, wy + wh, '#4a3a2c', ww + 8, 6);
  px(c, wx - 4, wy, '#4a3a2c', 4, wh);
  px(c, wx + ww, wy, '#4a3a2c', 4, wh);
  px(c, wx + ww / 2 - 2, wy, '#4a3a2c', 4, wh);
  px(c, wx, wy + wh / 2 - 1, '#4a3a2c', ww, 3);
  px(c, wx - 6, wy + wh + 2, '#5c4836', ww + 12, 5);
  px(c, wx - 6, wy + wh + 2, '#7a604a', ww + 12, 1);
  for (let i = 0; i < 14; i++) ellipse(c, wx + 4 + r() * (ww - 8), wy + 4 + r() * (wh - 8), 0.8, 1.2, 'rgba(220,235,255,.6)');
  // warm desk lamp on the sill and a mug
  ellipse(c, 34, 60, 34, 30, 'rgba(255,190,110,.10)');
  px(c, 28, 92, INK, 12, 12);
  px(c, 29, 93, '#d9a43c', 10, 3);
  px(c, 33, 96, '#5a4636', 2, 10);
  px(c, 22, 106, '#5c4836', 30, 4);
  px(c, 220, 102, INK, 8, 8);
  px(c, 221, 103, '#e8e2d6', 6, 6);
  px(c, 228, 104, INK, 2, 4);
  // Sofi from behind, looking out
  bigChar(c, a, 'up', SW / 2 - 30, SH - 92, 3);
  // vignette
  for (let i = 0; i < 18; i++) {
    const al = (0.55 * (18 - i)) / 18;
    px(c, i, 0, `rgba(10,6,20,${al / 3})`, 1, SH);
    px(c, SW - 1 - i, 0, `rgba(10,6,20,${al / 3})`, 1, SH);
  }
}

// ------------------------------------------------------------------ 2. a letter under the door
function letterSlide(c: Ctx) {
  // floor boards
  for (let y = 0; y < SH; y += 9) {
    px(c, 0, y, ['#5a3e30', '#4f3628', '#62453a'][(y / 9) % 3], SW, 9);
    px(c, 0, y + 8, '#3a2820', SW, 1);
    px(c, ((y * 37) % 200) + 20, y, '#3a2820', 1, 8);
  }
  // door bottom with light leaking underneath
  px(c, 0, 0, '#3a2a22', SW, 52);
  for (let x = 6; x < SW; x += 40) {
    px(c, x, 4, '#4a362c', 34, 40);
    px(c, x, 4, '#55403a', 34, 2);
  }
  px(c, 0, 52, '#120c10', SW, 4);
  px(c, 0, 55, '#f2c66d', SW, 2);
  for (let y = 57; y < 74; y++) px(c, 0, y, `rgba(242,198,109,${0.32 - (y - 57) * 0.018})`, SW, 1);
  // the envelope, half slid in, with a star seal
  const ex = 88;
  const ey = 58;
  px(c, ex - 1, ey - 1, INK, 82, 50);
  px(c, ex, ey, '#f3e6c8', 80, 48);
  px(c, ex, ey, '#fbf3df', 80, 3);
  for (let i = 0; i < 40; i++) {
    px(c, ex + i, ey + Math.floor(i * 0.55), '#d9c8a4');
    px(c, ex + 79 - i, ey + Math.floor(i * 0.55), '#d9c8a4');
  }
  ellipse(c, ex + 40, ey + 24, 8, 8, '#8e2a2a');
  ellipse(c, ex + 40, ey + 24, 6.5, 6.5, '#b8402e');
  const sx = ex + 40;
  const sy = ey + 24;
  px(c, sx - 1, sy - 5, '#f2c66d', 2, 10);
  px(c, sx - 5, sy - 1, '#f2c66d', 10, 2);
  px(c, sx - 3, sy - 3, '#f2c66d', 6, 6);
  px(c, sx - 1, sy - 1, '#fff3c0', 2, 2);
  // soft shadow
  px(c, ex + 2, ey + 48, 'rgba(0,0,0,.35)', 80, 3);
}

// ------------------------------------------------------------------ 3. the train along the coast at dawn
function train(c: Ctx) {
  const r = rng(29);
  sky(c, [[0, '#f7b98c'], [0.18, '#f9c99a'], [0.34, '#fbd9ae'], [0.48, '#fde8c4']]);
  // sun
  ellipse(c, 196, 62, 16, 16, '#fff2c8');
  ellipse(c, 196, 62, 12, 12, '#fffbe8');
  // clouds
  for (const [x, y, w] of [[30, 20, 34], [120, 14, 28], [210, 26, 22]] as const) {
    ellipse(c, x, y, w / 2, 4, '#fff1dc');
    ellipse(c, x + 6, y - 3, w / 3, 4, '#fff6e8');
  }
  // sea
  for (let y = 72; y < SH; y++) px(c, 0, y, y < 76 ? '#7ccbe8' : y < 100 ? '#4fb2e2' : '#3ea8e4', SW, 1);
  for (let i = 0; i < 40; i++) px(c, Math.floor(r() * SW), 76 + Math.floor(r() * 60), '#c9f0ff', 3 + Math.floor(r() * 4), 1);
  px(c, 160, 74, '#fff6d8', 70, 1);
  // hills on the left falling to the coast
  for (let x = 0; x < SW; x++) {
    const hTop = 64 + Math.round(Math.sin(x / 26) * 6 + x * 0.12);
    if (hTop < 96) {
      px(c, x, hTop, '#5db449', 1, 96 - hTop);
      px(c, x, hTop, '#7ccb59', 1, 2);
    }
  }
  for (let i = 0; i < 9; i++) {
    const tx = 10 + i * 18 + Math.floor(r() * 6);
    const ty = 70 + Math.round(tx * 0.12) - 2;
    if (ty < 92) {
      ellipse(c, tx, ty, 5, 4, '#2f8a3e');
      ellipse(c, tx - 1, ty - 1, 4, 3, '#46a846');
      px(c, tx - 2, ty - 3, '#7ccb59', 2, 1);
    }
  }
  // embankment + rails
  px(c, 0, 100, '#c9a77a', SW, 6);
  px(c, 0, 100, '#e0c296', SW, 1);
  px(c, 0, 106, '#6f6a72', SW, 2);
  for (let x = 0; x < SW; x += 5) px(c, x, 104, '#7a4c30', 3, 3);
  px(c, 0, 103, '#a8a2a8', SW, 1);
  // the train: engine + two cars, cream and red
  const cars: [number, number][] = [[44, 52], [100, 52], [156, 46]];
  cars.forEach(([x, w], i) => {
    px(c, x - 1, 78, INK, w + 2, 26);
    px(c, x, 79, '#f3e6c8', w, 12);
    px(c, x, 91, '#c94a3f', w, 12);
    px(c, x, 79, '#fff8e6', w, 1);
    for (let wx = x + 4; wx < x + w - 8; wx += 11) {
      px(c, wx, 82, INK, 8, 7);
      px(c, wx + 1, 83, i === 2 ? '#9fd8f6' : '#f7dc8f', 6, 5);
    }
    for (const wx of [x + 6, x + w - 12]) {
      ellipse(c, wx + 3, 103, 3, 3, INK);
      ellipse(c, wx + 3, 103, 1.6, 1.6, '#6f6a72');
    }
    if (i < 2) px(c, x + w + 1, 92, INK, 4, 3);
  });
  // engine nose
  px(c, 202, 84, INK, 10, 20);
  px(c, 202, 85, '#c94a3f', 9, 18);
  ellipse(c, 210, 92, 2, 2, '#fff2a0');
  // a silhouette in the last window
  ellipse(c, 165, 85, 2.2, 2.4, '#5b3a2e');
  // gulls
  for (const [gx, gy] of [[60, 34], [72, 28], [140, 40]] as const) {
    px(c, gx, gy, '#ffffff', 3, 1);
    px(c, gx + 3, gy - 1, '#ffffff', 1, 1);
    px(c, gx + 4, gy, '#ffffff', 3, 1);
  }
}

// ------------------------------------------------------------------ 4. arrival at Villa Nori, sunset
function arrival(c: Ctx, a: Appearance) {
  const r = rng(53);
  sky(c, [[0, '#6a5aa8'], [0.12, '#a36aa8'], [0.24, '#e48a8a'], [0.36, '#f6b27c']]);
  for (let i = 0; i < 14; i++) px(c, Math.floor(r() * SW), Math.floor(r() * 18), '#f6ecd6');
  // ground: grass + path to the restaurant
  const g = brightGrass(1);
  const p = pathTile;
  for (let ty = 3; ty < 10; ty++)
    for (let tx = 0; tx < 16; tx++) {
      const onPath = (tx === 7 || tx === 8) && ty >= 6;
      (onPath ? p : g)(c, tx * 16, ty * 16, r);
    }
  // trees left and right
  const put = (kind: string, w: number, h: number, x: number, y: number, c1 = '', c2 = '', rot = 0, label?: string) => {
    const s = drawObject(kind, w, h, c1, c2, rot, 7, label);
    c.drawImage(s, x - w / 2, y - h);
  };
  put('pine', 32, 50, 14, 74, '#46a846');
  put('tree', 44, 56, 40, 80, '#46a846');
  put('sakura', 44, 56, 230, 78);
  put('tree', 44, 56, 206, 70, '#46a846');
  // Midnight Maki, lit
  put('building', 112, 90, 128, 94, '#f3e3c3', '#2f4f7a', 0, 'MIDNIGHT MAKI');
  put('lamppost', 16, 32, 92, 110);
  put('lamppost', 16, 32, 164, 110);
  put('paperlantern', 16, 26, 72, 96, '#d9675f');
  put('paperlantern', 16, 26, 184, 96, '#d9675f');
  // sunset wash
  for (let y = 0; y < SH; y++) px(c, 0, y, `rgba(255,150,90,${0.05 + (y / SH) * 0.12})`, SW, 1);
  // window glow
  ellipse(c, 128, 74, 44, 16, 'rgba(255,214,140,.16)');
  // Sofi with her suitcase, seen from behind
  bigChar(c, a, 'up', 112, 86, 2);
  px(c, 146, 130, INK, 12, 10);
  px(c, 147, 131, '#b0533f', 10, 8);
  px(c, 150, 128, INK, 4, 3);
}

export type SlideId = 'city' | 'letter' | 'train' | 'arrival';

export function paintSlide(id: SlideId, a: Appearance): HTMLCanvasElement {
  const cv = makeCanvas(SW, SH);
  const c = ctx2d(cv);
  if (id === 'city') city(c, a);
  else if (id === 'letter') letterSlide(c);
  else if (id === 'train') train(c);
  else arrival(c, a);
  return cv;
}
