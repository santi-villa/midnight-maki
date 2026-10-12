/** 16x16 procedural icons for items, dishes, collectibles and UI. Cached as canvases. */
import { PAL } from './palette';
import { ctx2d, ellipse, makeCanvas, outline, px, shade, type Ctx } from './pixel';

export interface IconSpec { type: string; c1?: string; c2?: string; c3?: string; }

type F = (c: Ctx, c1: string, c2: string, c3: string) => void;
const W = PAL.white;
const RICE = '#fbf7ee';
const NORI = '#2f3b33';

const T: Record<string, F> = {
  grain(c) {
    ellipse(c, 8, 10, 6, 4, '#c27f86');
    px(c, 2, 9, '#a85f68', 13, 1);
    ellipse(c, 8, 8, 5, 3, RICE);
    px(c, 6, 6, '#ffffff', 2, 1);
  },
  sheet(c) {
    px(c, 2, 3, NORI, 12, 10);
    px(c, 3, 4, '#3d4b40', 10, 1);
    px(c, 4, 8, '#3d4b40', 7, 1);
  },
  fillet(c, c1, c2) {
    for (let i = 0; i < 6; i++) px(c, 3 + i, 4 + i, c1, 9 - i, 3);
    px(c, 3, 4, c1, 10, 6);
    for (let i = 0; i < 4; i++) px(c, 5 + i * 2, 4, c2, 1, 6);
  },
  veg(c, c1, c2) {
    px(c, 3, 7, c1, 10, 4);
    px(c, 2, 8, c1, 12, 2);
    px(c, 4, 8, c2, 8, 1);
    px(c, 13, 7, shade(c1, 0.3), 1, 2);
  },
  round(c, c1, c2) {
    ellipse(c, 8, 9, 5, 5, c1);
    ellipse(c, 8, 9, 2, 2, c2);
    px(c, 5, 6, shade(c1, 0.35), 2, 1);
  },
  egg(c, c1) {
    px(c, 3, 5, c1, 10, 7);
    px(c, 3, 5, shade(c1, 0.3), 10, 1);
    px(c, 3, 8, shade(c1, -0.15), 10, 1);
    px(c, 4, 11, NORI, 8, 1);
  },
  shrimp(c, c1) {
    for (let i = 0; i < 7; i++) px(c, 3 + i, 5 + Math.round(Math.sin(i / 2) * 2), c1, 3, 3);
    px(c, 10, 9, shade(c1, -0.2), 3, 2);
    px(c, 4, 6, W, 1, 1);
  },
  blob(c, c1) {
    ellipse(c, 8, 10, 5, 3, c1);
    ellipse(c, 8, 8, 3, 2, c1);
    px(c, 6, 7, shade(c1, 0.35), 2, 1);
  },
  flakes(c, c1) {
    for (const [x, y] of [[3, 6], [7, 5], [11, 7], [5, 9], [9, 10], [12, 11], [4, 12]]) px(c, x, y, c1, 2, 2);
  },
  roe(c, c1) {
    for (let y = 6; y < 13; y += 2) for (let x = 4 + (y % 4); x < 13; x += 2) px(c, x, y, c1, 1, 1);
    for (let y = 7; y < 13; y += 2) for (let x = 5; x < 12; x += 3) px(c, x, y, shade(c1, -0.2), 1, 1);
  },
  mush(c, c1) {
    px(c, 7, 8, PAL.cream, 3, 6);
    ellipse(c, 8, 7, 5, 3, c1);
    px(c, 5, 6, PAL.cream);
    px(c, 10, 5, PAL.cream);
  },
  flower(c, c1, c2) {
    px(c, 8, 9, PAL.forest, 1, 6);
    px(c, 9, 11, PAL.forest, 2, 1);
    for (const [x, y] of [[8, 3], [5, 6], [11, 6], [6, 9], [10, 9]]) ellipse(c, x, y, 2, 2, c1);
    px(c, 7, 6, c2, 2, 2);
  },
  shell(c, c1) {
    for (let j = 0; j < 8; j++) px(c, 8 - j, 4 + j, c1, 1 + j * 2, 1);
    for (let i = 0; i < 4; i++) px(c, 5 + i * 2, 6, shade(c1, -0.25), 1, 6);
    px(c, 6, 12, shade(c1, -0.3), 5, 1);
  },
  fish(c, c1, c2) {
    ellipse(c, 7, 8, 5, 3, c1);
    px(c, 11, 6, c1, 1, 5);
    px(c, 12, 5, c1, 2, 7);
    px(c, 4, 7, PAL.ink);
    px(c, 3, 9, c2, 8, 1);
    px(c, 6, 6, shade(c1, 0.3), 3, 1);
  },
  bug(c, c1, c2) {
    ellipse(c, 5, 6, 3, 3, c1);
    ellipse(c, 11, 6, 3, 3, c1);
    ellipse(c, 5, 11, 2, 2, c2);
    ellipse(c, 11, 11, 2, 2, c2);
    px(c, 8, 4, PAL.ink, 1, 10);
    px(c, 7, 3, PAL.ink);
    px(c, 9, 3, PAL.ink);
  },
  beetle(c, c1, c2) {
    ellipse(c, 8, 9, 4, 5, c1);
    px(c, 8, 5, c2, 1, 9);
    ellipse(c, 8, 4, 2, 1, PAL.ink);
    for (const y of [7, 10, 12]) {
      px(c, 3, y, PAL.ink, 1, 1);
      px(c, 12, y, PAL.ink, 1, 1);
    }
  },
  seed(c, c1) {
    px(c, 3, 3, PAL.cream2, 10, 11);
    px(c, 3, 3, PAL.woodL, 10, 2);
    ellipse(c, 8, 10, 2, 2, c1);
    px(c, 8, 7, PAL.forest, 1, 2);
  },
  sprout(c, c1) {
    px(c, 4, 11, PAL.woodD, 8, 3);
    px(c, 8, 6, PAL.forest, 1, 5);
    ellipse(c, 6, 6, 2, 1, c1);
    ellipse(c, 10, 5, 2, 1, c1);
  },
  leaf(c, c1) {
    for (let i = 0; i < 8; i++) px(c, 4 + i, 11 - i, c1, 3, 2);
    px(c, 4, 12, shade(c1, -0.3), 1, 1);
  },
  gem(c, c1) {
    px(c, 5, 4, c1, 6, 2);
    px(c, 4, 6, c1, 8, 3);
    for (let j = 0; j < 4; j++) px(c, 5 + j, 9 + j, c1, 6 - j * 2, 1);
    px(c, 6, 5, shade(c1, 0.5), 2, 2);
  },
  wood(c) {
    px(c, 2, 6, PAL.wood, 12, 5);
    px(c, 2, 6, PAL.woodL, 12, 1);
    ellipse(c, 13, 8, 2, 2, PAL.woodL);
    px(c, 13, 8, PAL.woodD);
  },
  letter(c, c1) {
    px(c, 2, 4, c1, 12, 9);
    for (let i = 0; i < 6; i++) px(c, 2 + i, 4 + i, shade(c1, -0.3), 1, 1), px(c, 13 - i, 4 + i, shade(c1, -0.3), 1, 1);
    px(c, 7, 9, PAL.red, 2, 2);
  },
  key(c, c1) {
    ellipse(c, 5, 6, 3, 3, c1);
    c.clearRect(5, 6, 1, 1);
    px(c, 7, 6, c1, 7, 2);
    px(c, 11, 8, c1, 1, 2);
    px(c, 13, 8, c1, 1, 3);
  },
  book(c, c1) {
    px(c, 3, 3, c1, 10, 11);
    px(c, 4, 3, shade(c1, 0.2), 1, 11);
    px(c, 6, 6, PAL.cream, 5, 1);
    px(c, 3, 13, PAL.cream, 10, 1);
  },
  photo(c, c1) {
    px(c, 2, 3, PAL.white, 12, 11);
    px(c, 3, 4, c1, 10, 7);
    ellipse(c, 6, 8, 1, 1, '#8d8a93');
    ellipse(c, 10, 8, 1, 1, '#8d8a93');
  },
  coin(c) {
    ellipse(c, 8, 8, 5, 5, PAL.goldD);
    ellipse(c, 8, 8, 4, 4, PAL.gold);
    px(c, 7, 5, PAL.goldD, 2, 6);
  },
  star(c, c1) {
    px(c, 7, 2, c1, 2, 12);
    px(c, 2, 6, c1, 12, 3);
    px(c, 5, 4, c1, 6, 8);
    px(c, 4, 11, c1, 2, 2);
    px(c, 10, 11, c1, 2, 2);
    px(c, 7, 6, '#fff6c8', 2, 2);
  },
  spoon(c) {
    ellipse(c, 5, 5, 3, 2, '#c9ccd6');
    for (let i = 0; i < 7; i++) px(c, 7 + i, 6 + i, '#a9acb6', 1, 1);
  },
  bottle(c, c1) {
    px(c, 6, 2, PAL.woodL, 4, 2);
    px(c, 5, 4, c1, 6, 10);
    px(c, 6, 5, shade(c1, 0.4), 1, 7);
    px(c, 7, 7, PAL.cream, 3, 4);
  },
  maki(c, c1, c2) {
    // three pieces of rolled sushi
    for (const [x, y] of [[4, 6], [11, 6], [7.5, 11]]) {
      ellipse(c, x, y, 3, 3, NORI);
      ellipse(c, x, y, 2, 2, RICE);
      px(c, Math.round(x) - 1, y - 1, c1, 2, 2);
      if (c2) px(c, Math.round(x), y, c2, 1, 1);
    }
  },
  uramaki(c, c1, c2, c3) {
    for (const [x, y] of [[4, 6], [11, 6], [7.5, 11]]) {
      ellipse(c, x, y, 3, 3, RICE);
      ellipse(c, x, y, 1, 1, NORI);
      px(c, Math.round(x) - 1, y - 1, c1, 2, 2);
      if (c2) px(c, Math.round(x) - 3, y - 3, c2, 6, 1);
      if (c3) px(c, Math.round(x) + 1, y + 1, c3, 1, 1);
    }
  },
  nigiri(c, c1, c2) {
    for (const x of [2, 9]) {
      px(c, x, 9, RICE, 6, 4);
      px(c, x, 12, '#e6dfcf', 6, 1);
      px(c, x - 1, 6, c1, 7, 4);
      px(c, x, 6, shade(c1, 0.3), 5, 1);
      if (c2) px(c, x + 2, 7, c2, 2, 3);
    }
  },
  onigiri(c, c1) {
    for (let j = 0; j < 10; j++) px(c, 8 - Math.floor(j * 0.6), 3 + j, RICE, 1 + Math.floor(j * 0.6) * 2, 1);
    px(c, 5, 9, NORI, 7, 4);
    px(c, 7, 6, c1, 2, 2);
  },
  temaki(c, c1, c2) {
    for (let j = 0; j < 11; j++) px(c, 6 + Math.floor(j / 3), 3 + j, NORI, 8 - Math.floor(j / 1.6), 1);
    ellipse(c, 9, 4, 4, 2, RICE);
    px(c, 7, 3, c1, 3, 2);
    px(c, 10, 3, c2, 2, 2);
  },
  gunkan(c, c1) {
    for (const x of [2, 9]) {
      px(c, x, 7, NORI, 6, 6);
      px(c, x + 1, 5, c1, 4, 3);
      px(c, x + 1, 5, shade(c1, 0.3), 2, 1);
    }
  },
  special(c, c1, c2, c3) {
    // fancy plate with roll and garnish
    ellipse(c, 8, 10, 7, 4, '#d8d2c8');
    ellipse(c, 8, 9, 6, 3, PAL.white);
    for (const x of [4, 8, 12]) {
      ellipse(c, x, 8, 2, 2, c1);
      px(c, x - 1, 7, c2, 2, 1);
    }
    px(c, 7, 4, c3, 2, 2);
    px(c, 6, 5, c3, 1, 1);
  },
  failed(c) {
    ellipse(c, 8, 10, 6, 3, '#d8d2c8');
    ellipse(c, 7, 9, 4, 2, '#9a8f7a');
    px(c, 9, 7, '#6f8f62', 2, 2);
    px(c, 5, 8, '#b2585e', 1, 1);
  },
  // ---- UI icons
  bag(c) {
    px(c, 3, 5, PAL.wood, 10, 9);
    px(c, 3, 5, PAL.woodL, 10, 2);
    px(c, 5, 2, PAL.woodD, 6, 1);
    px(c, 5, 2, PAL.woodD, 1, 3);
    px(c, 10, 2, PAL.woodD, 1, 3);
    px(c, 7, 8, PAL.gold, 2, 2);
  },
  journal(c) {
    px(c, 3, 2, '#3b4470', 10, 12);
    px(c, 4, 2, '#4a5590', 1, 12);
    px(c, 6, 5, PAL.gold, 5, 1);
    px(c, 7, 7, PAL.gold, 3, 3);
  },
  menu(c) {
    for (const y of [4, 7, 10]) px(c, 3, y, PAL.woodDD, 10, 2);
  },
  sun(c) {
    ellipse(c, 8, 8, 3, 3, PAL.gold);
    for (const [x, y] of [[8, 2], [8, 13], [2, 8], [13, 8], [4, 4], [11, 4], [4, 11], [11, 11]]) px(c, x, y, PAL.goldD, 1, 1);
  },
  afternoon(c) {
    ellipse(c, 8, 8, 4, 4, '#f2b36d');
    px(c, 6, 6, '#f8d39a', 2, 2);
  },
  dusk(c) {
    ellipse(c, 8, 10, 5, 5, '#e88a6f');
    px(c, 2, 10, PAL.night2, 13, 5);
    px(c, 2, 10, '#c27f86', 13, 1);
  },
  moon(c) {
    ellipse(c, 8, 8, 5, 5, '#f4e3a8');
    c.globalCompositeOperation = 'destination-out';
    ellipse(c, 10, 6, 4, 4, '#000');
    c.globalCompositeOperation = 'source-over';
    px(c, 5, 9, '#e0cc8c', 2, 2);
  },
  camera(c) {
    px(c, 2, 5, '#3d3a4a', 12, 8);
    px(c, 5, 3, '#3d3a4a', 4, 2);
    ellipse(c, 8, 9, 3, 3, PAL.lav);
    ellipse(c, 8, 9, 1, 1, PAL.night);
  },
  heart(c, c1) {
    ellipse(c, 5, 6, 3, 3, c1);
    ellipse(c, 11, 6, 3, 3, c1);
    for (let j = 0; j < 6; j++) px(c, 3 + j, 8 + j, c1, 11 - j * 2, 1);
    px(c, 4, 5, '#ffffff');
  },
  gift(c, c1, c2) {
    px(c, 3, 6, c1, 10, 8);
    px(c, 2, 5, c1, 12, 2);
    px(c, 7, 5, c2, 2, 9);
    px(c, 5, 3, c2, 2, 2);
    px(c, 9, 3, c2, 2, 2);
  },
};

const cache = new Map<string, HTMLCanvasElement>();

export function iconCanvas(spec: IconSpec): HTMLCanvasElement {
  const key = `${spec.type}|${spec.c1}|${spec.c2}|${spec.c3}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(16, 16);
  const ctx = ctx2d(c);
  const fn = T[spec.type] ?? T.gift;
  fn(ctx, spec.c1 ?? PAL.rose, spec.c2 ?? '', spec.c3 ?? PAL.gold);
  outline(c, 'rgba(42,34,48,0.85)');
  cache.set(key, c);
  return c;
}

/** Returns a fresh copy (canvas elements can only live in one DOM place). */
export function iconElement(spec: IconSpec, cls = ''): HTMLCanvasElement {
  const src = iconCanvas(spec);
  const c = makeCanvas(16, 16);
  ctx2d(c).drawImage(src, 0, 0);
  if (cls) c.className = cls;
  return c;
}

export function iconDataURL(spec: IconSpec): string {
  return iconCanvas(spec).toDataURL();
}
