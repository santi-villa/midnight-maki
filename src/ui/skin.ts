/**
 * UI skin generated at startup (style guide: the "Botones del juego" board): warm wooden planks,
 * a log frame with round log ends, stone-framed buttons, parchment, and chunky pixel icons.
 * Everything is published as CSS custom properties holding data URLs, so the stylesheet stays declarative.
 */
import { ctx2d, ellipse, makeCanvas, px, shade, type Ctx } from '../art/pixel';

const INK = '#2b1d17';
const W1 = '#a8714a';
const W2 = '#bf8a5c';
const W3 = '#8e5d3c';

function url(c: HTMLCanvasElement) {
  return `url("${c.toDataURL()}")`;
}

/** Tileable plank texture (32x32). */
function planks(): HTMLCanvasElement {
  const c = makeCanvas(32, 32);
  const g = ctx2d(c);
  const rows = [W1, W2, W3, W1];
  rows.forEach((col, i) => {
    const y = i * 8;
    px(g, 0, y, col, 32, 8);
    px(g, 0, y, shade(col, 0.12), 32, 1);
    px(g, 0, y + 7, shade(col, -0.35), 32, 1);
    px(g, (i * 11 + 5) % 28, y + 3, shade(col, -0.12), 7, 1);
    px(g, (i * 7 + 18) % 28, y + 5, shade(col, -0.1), 5, 1);
    px(g, (i * 13 + 9) % 30, y + 1, shade(col, -0.35), 1, 6);
  });
  return c;
}

/** Parchment texture (16x16). */
function parchment(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const g = ctx2d(c);
  px(g, 0, 0, '#f6ead0', 16, 16);
  for (const [x, y] of [[2, 3], [9, 1], [13, 7], [5, 10], [11, 13], [1, 14], [7, 6]]) px(g, x, y, '#eedfbf');
  return c;
}

/** 9-slice log frame (24x24, 8px corners): dark wood rim with round log ends at the corners. */
function logFrame(): HTMLCanvasElement {
  const c = makeCanvas(24, 24);
  const g = ctx2d(c);
  // rim
  px(g, 0, 0, INK, 24, 24);
  px(g, 1, 1, '#7a4c30', 22, 22);
  px(g, 2, 2, '#9a6440', 20, 20);
  px(g, 2, 2, '#b07a50', 20, 1);
  px(g, 2, 2, '#b07a50', 1, 20);
  px(g, 5, 5, INK, 14, 14);
  g.clearRect(6, 6, 12, 12);
  // log ends
  for (const [x, y] of [[3.5, 3.5], [19.5, 3.5], [3.5, 19.5], [19.5, 19.5]]) {
    ellipse(g, x, y, 3.6, 3.6, INK);
    ellipse(g, x, y, 2.8, 2.8, '#d9a970');
    ellipse(g, x, y, 1.6, 1.6, '#b98552');
    px(g, Math.round(x), Math.round(y), '#8e5d3c');
  }
  return c;
}

/** 9-slice stone frame (18x18, 6px corners) around a wooden centre. */
function stoneFrame(pressed = false): HTMLCanvasElement {
  const c = makeCanvas(18, 18);
  const g = ctx2d(c);
  px(g, 0, 0, INK, 18, 18);
  px(g, 1, 1, '#8f8a94', 16, 16);
  // stone blocks
  const blocks: [number, number, number, number][] = [[1, 1, 6, 4], [7, 1, 5, 4], [12, 1, 5, 4], [1, 5, 4, 8], [13, 5, 4, 8], [1, 13, 5, 4], [6, 13, 6, 4], [12, 13, 5, 4]];
  for (const [x, y, w, h] of blocks) {
    px(g, x, y, '#5e5964', w, h);
    px(g, x, y, pressed ? '#9d98a2' : '#b9b4bd', w - 1, h - 1);
    px(g, x, y, pressed ? '#aaa5ae' : '#d2cdd5', w - 1, 1);
  }
  // wooden centre
  px(g, 5, 5, INK, 8, 8);
  px(g, 6, 6, pressed ? '#8e5d3c' : '#a8714a', 6, 6);
  px(g, 6, 6, pressed ? '#9a6440' : '#c08a5a', 6, 1);
  return c;
}

/** Light wooden plank button (12x12, 4px corners). */
function plankButton(col: string): HTMLCanvasElement {
  const c = makeCanvas(12, 12);
  const g = ctx2d(c);
  px(g, 1, 0, INK, 10, 12);
  px(g, 0, 1, INK, 12, 10);
  px(g, 1, 1, col, 10, 10);
  px(g, 1, 1, shade(col, 0.22), 10, 2);
  px(g, 1, 9, shade(col, -0.25), 10, 2);
  return c;
}

// ------------------------------------------------------------------ icons (16x16)
type IconFn = (g: Ctx) => void;
const ICONS: Record<string, IconFn> = {
  menu(g) {
    for (const y of [3, 7, 11]) {
      px(g, 2, y, '#513722', 12, 3);
      px(g, 3, y, '#efd7ae', 10, 1);
    }
  },
  clipboard(g) {
    px(g, 3, 2, INK, 11, 14);
    px(g, 4, 3, '#d0a574', 9, 12);
    px(g, 5, 4, '#f4e8c9', 7, 10);
    px(g, 6, 0, INK, 5, 4);
    px(g, 7, 1, '#c1c1aa', 3, 2);
    for (const y of [6, 9, 12]) {
      px(g, 6, y, '#7b694e'); px(g, 8, y, '#a28d67', 3, 1);
    }
  },
  wood_gear(g) {
    for (const [x, y, w, hh] of [[6, 1, 4, 14], [1, 6, 14, 4], [3, 3, 10, 10]]) px(g, x, y, INK, w, hh);
    for (const [x, y, w, hh] of [[7, 2, 2, 12], [2, 7, 12, 2], [4, 4, 8, 8]]) px(g, x, y, '#dcc098', w, hh);
    ellipse(g, 7.5, 7.5, 3.2, 3.2, INK);
    ellipse(g, 7.5, 7.5, 1.8, 1.8, '#a77b55');
  },
  talk(g) {
    px(g, 1, 2, INK, 14, 10);
    px(g, 2, 1, INK, 12, 12);
    px(g, 2, 2, '#dff2ff', 12, 10);
    px(g, 3, 2, '#ffffff', 10, 2);
    px(g, 4, 12, INK, 3, 3);
    px(g, 5, 12, '#dff2ff', 1, 2);
    for (const x of [4, 7, 10]) {
      px(g, x, 6, '#5b8fd6', 2, 2);
      px(g, x, 6, '#8fb8ee', 1, 1);
    }
  },
  act(g) {
    // open hand
    px(g, 2, 4, INK, 9, 11);
    for (const [x, h] of [[2, 6], [4, 8], [6, 9], [8, 8]]) px(g, x, 12 - h, INK, 3, h);
    for (const [x, h] of [[3, 5], [5, 7], [7, 8], [9, 7]]) px(g, x, 13 - h, '#f2c6a0', 1, h - 1);
    px(g, 3, 8, '#f2c6a0', 7, 6);
    px(g, 3, 13, '#d9a27a', 7, 1);
    px(g, 1, 9, INK, 2, 3);
    // exclamation
    px(g, 12, 1, INK, 4, 10);
    px(g, 13, 2, '#e0424f', 2, 6);
    px(g, 12, 12, INK, 4, 4);
    px(g, 13, 13, '#e0424f', 2, 2);
  },
  bag(g) {
    px(g, 4, 1, INK, 8, 4);
    px(g, 5, 2, '#8a5634', 6, 2);
    px(g, 6, 2, INK, 4, 1);
    px(g, 1, 4, INK, 14, 12);
    px(g, 2, 5, '#a86a3f', 12, 10);
    px(g, 2, 5, '#c48550', 12, 1);
    px(g, 2, 5, '#7a4a2c', 12, 4);
    px(g, 2, 5, '#9a6038', 12, 1);
    px(g, 4, 9, '#7a4a2c', 3, 4);
    px(g, 9, 9, '#7a4a2c', 3, 4);
    px(g, 5, 8, '#e0c060', 1, 2);
    px(g, 10, 8, '#e0c060', 1, 2);
    px(g, 2, 14, '#7a4a2c', 12, 1);
  },
  gear(g) {
    const cog = (cx: number, cy: number, r: number, col: string) => {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) ellipse(g, cx + dx * r, cy + dy * r, 1.4, 1.4, INK);
      ellipse(g, cx, cy, r, r, INK);
      ellipse(g, cx, cy, r - 1, r - 1, col);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) px(g, Math.round(cx + dx * r), Math.round(cy + dy * r), col);
      ellipse(g, cx, cy, r * 0.4, r * 0.4, INK);
    };
    cog(6, 6, 4.4, '#9a96a6');
    cog(11.5, 11.5, 3.2, '#c08a5a');
  },
  scroll(g) {
    px(g, 2, 2, INK, 12, 13);
    px(g, 3, 3, '#f2dfb0', 10, 11);
    px(g, 1, 1, INK, 14, 3);
    px(g, 2, 2, '#d8bf86', 12, 1);
    px(g, 1, 13, INK, 14, 3);
    px(g, 2, 14, '#d8bf86', 12, 1);
    px(g, 7, 5, INK, 3, 5);
    px(g, 8, 5, '#f2c22e', 1, 4);
    px(g, 7, 11, INK, 3, 2);
    px(g, 8, 11, '#f2c22e', 1, 1);
  },
  map(g) {
    // folded paper map with a red pin
    px(g, 1, 2, INK, 14, 13);
    px(g, 2, 3, '#f2dfb0', 4, 11);
    px(g, 6, 3, '#e6cf98', 4, 11);
    px(g, 10, 3, '#f2dfb0', 4, 11);
    px(g, 6, 3, '#c9a96a', 1, 11);
    px(g, 10, 3, '#c9a96a', 1, 11);
    px(g, 3, 9, '#5db449', 3, 3);
    px(g, 7, 5, '#3ea8e4', 2, 4);
    px(g, 11, 10, '#5db449', 2, 2);
    for (const [x, y] of [[3, 6], [5, 7], [7, 9], [9, 10]]) px(g, x, y, '#b07a4c');
    ellipse(g, 11.5, 5, 2.4, 2.4, INK);
    ellipse(g, 11.5, 5, 1.6, 1.6, '#e0424f');
    px(g, 11, 4, '#ffb0b0');
    px(g, 11, 7, INK, 1, 3);
  },
  lantern(g) {
    px(g, 7, 0, INK, 2, 2);
    px(g, 4, 2, INK, 8, 2);
    px(g, 5, 2, '#5a3726', 6, 1);
    ellipse(g, 7.5, 8.5, 6, 5.5, INK);
    ellipse(g, 7.5, 8.5, 5, 4.6, '#f06a3a');
    ellipse(g, 7, 8, 3.2, 3.4, '#ffb45a');
    ellipse(g, 6.5, 7.5, 1.6, 2, '#ffe6a0');
    for (const y of [6, 9, 11]) px(g, 3, y, '#c94a2a', 10, 1);
    px(g, 4, 13, INK, 8, 2);
    px(g, 5, 13, '#5a3726', 6, 1);
    px(g, 7, 15, '#c94a2a', 2, 1);
  },
  maki(g) {
    ellipse(g, 7.5, 7.5, 7, 7, INK);
    ellipse(g, 7.5, 7.5, 6.2, 6.2, '#22301f');
    ellipse(g, 7.5, 7.5, 4.8, 4.8, '#f6f1e6');
    ellipse(g, 7.5, 7.5, 2.4, 2.4, '#f06c4f');
    px(g, 5, 6, '#7fbf4f', 2, 2);
    px(g, 9, 9, '#f2c66d', 2, 1);
    px(g, 4, 4, '#ffffff', 2, 1);
  },
  coin(g) {
    ellipse(g, 7.5, 8, 6.5, 6.5, INK);
    ellipse(g, 7.5, 8, 5.5, 5.5, '#f2c22e');
    ellipse(g, 6.5, 7, 3, 3, '#ffe27a');
    px(g, 7, 5, '#c9961a', 2, 6);
  },
  gift(g) {
    px(g, 2, 6, INK, 12, 9);
    px(g, 3, 7, '#e07080', 10, 7);
    px(g, 3, 7, '#f4b8be', 10, 2);
    px(g, 7, 3, INK, 2, 12);
    px(g, 8, 4, '#f2c66d', 1, 10);
    px(g, 3, 6, INK, 10, 2);
    px(g, 4, 6, '#f2c66d', 8, 1);
    px(g, 4, 2, INK, 3, 3);
    px(g, 9, 2, INK, 3, 3);
    px(g, 5, 3, '#ffe08a', 2, 2);
    px(g, 9, 3, '#ffe08a', 2, 2);
  },
  door(g) {
    px(g, 2, 1, INK, 12, 14);
    px(g, 3, 2, '#a8734d', 10, 12);
    px(g, 3, 2, '#d7a56e', 10, 2);
    px(g, 7, 2, INK, 2, 12);
    px(g, 4, 3, '#f2c66d', 2, 2);
    px(g, 10, 3, '#f2c66d', 2, 2);
    px(g, 5, 8, '#2b1d17', 1, 2);
    px(g, 10, 8, '#f6ecd6', 1, 2);
    px(g, 3, 13, '#7a4c30', 10, 1);
  },
  bed(g) {
    px(g, 1, 6, INK, 14, 9);
    px(g, 2, 7, '#f6ecd6', 12, 7);
    px(g, 2, 7, '#fffaf2', 12, 2);
    px(g, 2, 7, INK, 5, 7);
    px(g, 3, 8, '#f0d0d4', 3, 5);
    px(g, 8, 10, '#e8a0b0', 5, 2);
    px(g, 2, 13, '#c48a5a', 12, 1);
  },
  decor(g) {
    px(g, 6, 9, INK, 4, 5);
    px(g, 7, 10, '#7eb0c8', 2, 3);
    px(g, 5, 13, INK, 6, 2);
    px(g, 6, 13, '#b7dcea', 4, 1);
    px(g, 7, 3, INK, 2, 7);
    px(g, 8, 5, '#6f9e5a', 1, 4);
    px(g, 3, 1, INK, 6, 6);
    px(g, 4, 2, '#f0a0b0', 4, 4);
    px(g, 5, 3, '#fff0f4', 1, 1);
    px(g, 10, 4, INK, 4, 4);
    px(g, 11, 5, '#f2c66d', 2, 2);
  },
};

function icon(name: string): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  ICONS[name](ctx2d(c));
  return c;
}

const urls: Record<string, string> = {};
export function skinIcon(name: string): string {
  if (!urls[name]) urls[name] = icon(name).toDataURL();
  return urls[name];
}

export function skinIconEl(name: string, cls = 'skin-icon'): HTMLImageElement {
  const img = new Image(32, 32);
  img.src = skinIcon(name);
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  return img;
}

let installed = false;
export function installSkin() {
  if (installed) return;
  installed = true;
  const r = document.documentElement.style;
  r.setProperty('--tx-planks', url(planks()));
  r.setProperty('--tx-parchment', url(parchment()));
  r.setProperty('--tx-logframe', url(logFrame()));
  r.setProperty('--tx-stone', url(stoneFrame()));
  r.setProperty('--tx-stone-down', url(stoneFrame(true)));
  r.setProperty('--maki-icon', `url("${skinIcon('maki')}")`);
  r.setProperty('--tx-plank-btn', url(plankButton('#e9c58f')));
  r.setProperty('--tx-plank-btn-gold', url(plankButton('#f2c66d')));
  r.setProperty('--tx-plank-btn-rose', url(plankButton('#e8a7ad')));
  r.setProperty('--tx-plank-btn-sage', url(plankButton('#a9c99a')));
}
