/** Wallpapers of the NoriPhone: small pixel-art canvases, drawn once and cached. Sprites of the game are reused for the special ones. */
import { ellipse, makeCanvas, px, rng, shade, type Ctx } from '../../art/pixel';

type Painter = (g: Ctx, w: number, h: number) => void | Promise<void>;
interface Paper { w: number; h: number; paint: Painter }

const sky = (g: Ctx, w: number, h: number, stops: [number, string][]) => {
  for (let y = 0; y < h; y++) {
    let col = stops[0][1];
    for (const [at, c] of stops) if (y / h >= at) col = c;
    px(g, 0, y, col, w, 1);
  }
};

const stars = (g: Ctx, w: number, h: number, seed: number, n: number, col = '#fff6c8', maxY = 0.8) => {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h * maxY);
    px(g, x, y, col);
    if (i % 5 === 0) {
      px(g, x - 1, y, col);
      px(g, x + 1, y, col);
      px(g, x, y - 1, col);
      px(g, x, y + 1, col);
    }
  }
};

const dither = (g: Ctx, w: number, h: number, a: string, b: string) => {
  px(g, 0, 0, a, w, h);
  for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) px(g, x, y, b, 1, 1);
};

const marble = (g: Ctx, x: number, y: number, r: number, col: string) => {
  ellipse(g, x, y, r, r, shade(col, -0.4));
  ellipse(g, x, y, r - 1, r - 1, col);
  px(g, x - Math.floor(r / 2), y - Math.floor(r / 2), '#ffffff', 1, 1);
  px(g, x, y - 1, shade(col, 0.4), 1, Math.max(1, r - 1));
};

async function sprite(g: Ctx, id: string, x: number, y: number, expr: 'neutral' | 'happy' = 'happy') {
  const [{ folkFrame }, { FOLK_SPECS }] = await Promise.all([import('../../art/folk'), import('../../data/folkSpecs')]);
  g.drawImage(folkFrame(FOLK_SPECS[id], { dir: 'down', legs: 'idle', expr }), x, y);
}

async function prop(g: Ctx, id: string, x: number, y: number) {
  const [{ drawObject }, { PROPS }] = await Promise.all([import('../../art/objects'), import('../../data/props')]);
  const d = PROPS[id];
  g.drawImage(drawObject(d.kind, d.sw, d.sh, d.c1, d.c2, d.variant ?? 0, 7, d.label, d.stage), x, y);
}

async function icon(g: Ctx, spec: Record<string, string>, x: number, y: number) {
  const { iconCanvas } = await import('../../art/icons');
  g.drawImage(iconCanvas(spec as never), x, y);
}

const PAPERS: Record<string, Paper> = {
  crema: { w: 56, h: 104, paint: (g, w, h) => dither(g, w, h, '#f3e8cd', '#e8d9b4') },
  rosa: { w: 56, h: 104, paint: (g, w, h) => dither(g, w, h, '#f7d6dc', '#efbfc9') },
  menta: { w: 56, h: 104, paint: (g, w, h) => dither(g, w, h, '#d3ecdf', '#b8dcc8') },
  noche: {
    w: 56, h: 104,
    paint: (g, w, h) => {
      sky(g, w, h, [[0, '#121838'], [0.35, '#1c2552'], [0.65, '#2f3a7a'], [0.88, '#47509a']]);
      stars(g, w, h, 5, 46);
      ellipse(g, 41, 18, 7, 7, '#fff3c4');
      ellipse(g, 44, 16, 6, 6, '#1c2552');
      px(g, 0, h - 14, '#0f1330', w, 14);
      for (let x = 0; x < w; x++) px(g, x, h - 14 - Math.round(3 + 3 * Math.sin(x / 5)), '#0f1330');
    },
  },
  faroles: {
    w: 56, h: 104,
    paint: (g, w, h) => {
      sky(g, w, h, [[0, '#26193a'], [0.6, '#3a2446']]);
      const r = rng(11);
      for (let i = 0; i < 9; i++) {
        const x = 6 + Math.floor(r() * (w - 12));
        const y = 10 + Math.floor(r() * (h - 30));
        const col = i % 3 === 0 ? '#f6e3c8' : '#d9564a';
        px(g, x, 0, '#4a3428', 1, y);
        ellipse(g, x, y + 4, 4, 5, shade(col, -0.35));
        ellipse(g, x, y + 4, 3, 4, col);
        px(g, x - 1, y + 2, shade(col, 0.4), 2, 2);
        px(g, x - 3, y - 1, '#2b1d17', 7, 1);
        px(g, x - 3, y + 9, '#2b1d17', 7, 1);
      }
      stars(g, w, h, 3, 16, '#ffd89a', 0.9);
    },
  },
  sakura: {
    w: 56, h: 104,
    paint: (g, w, h) => {
      sky(g, w, h, [[0, '#fde7ee'], [0.6, '#fbd6e2']]);
      for (let i = 0; i < 40; i++) { px(g, w - 4 - i, 2 + Math.round(i * 0.55), '#6a4630', 3, 2); }
      const r = rng(4);
      for (let i = 0; i < 26; i++) {
        const x = 12 + Math.floor(r() * (w - 8));
        const y = 2 + Math.floor(r() * 30);
        ellipse(g, x, y, 3, 2.5, i % 2 ? '#f29ab4' : '#fbc0d1');
        px(g, x, y, '#ffffff');
      }
      for (let i = 0; i < 24; i++) {
        const x = Math.floor(r() * w);
        const y = 40 + Math.floor(r() * (h - 40));
        px(g, x, y, '#f29ab4', 2, 1);
        px(g, x + 1, y + 1, '#ffffff', 1, 1);
      }
      px(g, 0, h - 8, '#bfe0a4', w, 8);
      px(g, 0, h - 8, '#a6cf8a', w, 1);
    },
  },
  sushi: {
    w: 56, h: 104,
    paint: async (g, w, h) => {
      dither(g, w, h, '#f6ecd3', '#efe0bf');
      const kinds: Record<string, string>[] = [{ type: 'maki', c1: '#6f9e5a' }, { type: 'nigiri', c1: '#ef9a78' }, { type: 'onigiri', c1: '#c4505a' }, { type: 'uramaki', c1: '#e8826f', c2: '#f3e6c8', c3: '#7fa356' }];
      let n = 0;
      for (let y = 4; y < h - 8; y += 18) for (let x = (Math.floor(y / 18) % 2) * 9 - 4; x < w; x += 18) await icon(g, kinds[n++ % kinds.length], x, y);
    },
  },
  pip: {
    w: 56, h: 104,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#b9c5e4'], [0.6, '#d3d9ee']]);
      stars(g, w, h, 8, 22, '#f2c66d', 0.85);
      for (const [x, y, r, c] of [[10, 18, 4, '#e8826f'], [44, 30, 3, '#7fa356'], [14, 52, 3, '#9686bd'], [46, 62, 4, '#f2c66d'], [8, 84, 3, '#6fb0d8']] as const) marble(g, x, y, r, c);
      await sprite(g, 'pip', 16, 58);
    },
  },
  spicy: {
    w: 56, h: 104,
    paint: async (g, w, h) => {
      dither(g, w, h, '#f4cdb9', '#eeb9a0');
      const kinds: Record<string, string>[] = [{ type: 'maki', c1: '#e0403a' }, { type: 'nigiri', c1: '#ef9a78' }];
      for (let y = 2; y < 56; y += 17) for (let x = ((y / 17) % 2) * 9 - 4; x < w; x += 18) await icon(g, kinds[(x + y) % 2 ? 0 : 1], x, y);
      await sprite(g, 'spicy', 16, 62);
    },
  },
  rigg: {
    w: 56, h: 104,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#161c3e'], [0.7, '#27306a']]);
      stars(g, w, h, 9, 30, '#fff6c8', 0.5);
      const cols = ['#c25a6a', '#d9a24a', '#5f8a47', '#9686bd', '#e8e2d2', '#3b6f9c'];
      for (const x0 of [0, w - 12]) {
        px(g, x0, 0, '#3b2a1e', 12, h);
        for (let y = 6; y < h - 4; y += 12) {
          px(g, x0, y + 9, '#5a4030', 12, 2);
          for (let k = 0; k < 5; k++) px(g, x0 + 1 + k * 2, y + (k % 3), cols[(k + y) % cols.length], 2, 9 - (k % 3));
        }
      }
      await sprite(g, 'rigg', 16, 62);
    },
  },
  tres: {
    w: 56, h: 104,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#6a5aa8'], [0.45, '#e58f98'], [0.75, '#f6c78a']]);
      stars(g, w, h, 12, 18, '#fff6c8', 0.35);
      px(g, 0, h - 22, '#3b4a3a', w, 22);
      await sprite(g, 'rigg', -4, 56);
      await sprite(g, 'spicy', 36, 56);
      await sprite(g, 'pip', 16, 62);
    },
  },
  maki: {
    w: 120, h: 210,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#1a2250'], [0.4, '#33407e'], [0.7, '#f0b080']]);
      stars(g, w, h, 21, 50, '#fff6c8', 0.4);
      px(g, 0, h - 60, '#4f7a46', w, 60);
      px(g, 0, h - 60, '#6a9a58', w, 2);
      await prop(g, 'bld_restaurant_s2', 4, h - 150);
      px(g, 0, h - 28, '#c9b28a', w, 28);
    },
  },
  nori: {
    w: 120, h: 210,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#9fd3f0'], [0.5, '#d6ecf6']]);
      px(g, 0, h - 90, '#7fb35a', w, 90);
      px(g, 0, h - 90, '#95c870', w, 2);
      px(g, 0, h - 40, '#d8c9a4', w, 40);
      await prop(g, 'bld_bakery', -26, h - 160);
      await prop(g, 'bld_clothes', 36, h - 130);
      await prop(g, 'sakura', 8, h - 112);
      await prop(g, 'lamppost', 94, h - 74);
    },
  },
  recuerdo: {
    w: 120, h: 210,
    paint: async (g, w, h) => {
      sky(g, w, h, [[0, '#0f1330'], [0.5, '#232d68'], [0.78, '#3f4f9a']]);
      stars(g, w, h, 33, 70, '#fff6c8', 0.6);
      for (const [x, y] of [[26, 30], [60, 18], [94, 30]]) {
        px(g, x, y, '#f2c66d', 3, 3);
        px(g, x + 1, y - 2, '#f2c66d', 1, 7);
        px(g, x - 1, y + 1, '#f2c66d', 5, 1);
      }
      px(g, 0, h - 56, '#27306a', w, 56);
      for (let y = h - 54; y < h; y += 4) px(g, (y % 8) * 3, y, '#4a5aa8', 14, 1);
      await prop(g, 'lighthouse', 36, h - 130);
    },
  },
};

export const WALLPAPER_IDS = Object.keys(PAPERS);
const cache = new Map<string, HTMLCanvasElement>();

/** The canvas of a wallpaper (it is reused: do not draw on it). Unknown ids fall back to the cream one. */
export async function wallpaperCanvas(id: string): Promise<HTMLCanvasElement> {
  const key = PAPERS[id] ? id : 'crema';
  const hit = cache.get(key);
  if (hit) return hit;
  const p = PAPERS[key];
  const c = makeCanvas(p.w, p.h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  try {
    await p.paint(g, p.w, p.h);
  } catch (err) {
    console.error('[phone] wallpaper failed', key, err);
  }
  cache.set(key, c);
  return c;
}

/** A copy sized for a small preview tile. */
export async function wallpaperTile(id: string, w = 28, h = 50): Promise<HTMLCanvasElement> {
  const src = await wallpaperCanvas(id);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const k = Math.max(w / src.width, h / src.height);
  g.drawImage(src, (w - src.width * k) / 2, (h - src.height * k) / 2, src.width * k, src.height * k);
  return c;
}
