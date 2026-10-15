/**
 * Illustrated icons for the NoriPhone home screen.
 * Drawn as grids first (no canvas) so they can be checked without a browser, then painted at phone-pixel size.
 */
import { PAL } from '../../art/palette';
import { ctx2d, makeCanvas } from '../../art/pixel';

export type Grid = string[][];

const INK = PAL.ink;
const W = 32;

const FUR = '#8d8680';
const FUR_LT = '#c4beb4';
const MASK = '#2a2430';
const CREAM = '#f6ead2';
const PAPER = '#fffdf8';
const SILVER = '#d5dbe3';
const METAL = '#5c6670';
const GOLD = '#f0c14a';
const GOLD_LT = '#ffe7a3';
const RED = '#e23d3d';
const PINK = '#f48aaa';
const PINK_LT = '#ffd5e0';
const GREEN = '#4f8a3e';
const GREEN_LT = '#8fce6a';
const BLUE = '#3d6eae';
const SKY = '#9fd4f5';
const WOOD = '#8a5a38';
const WOOD_DK = '#5c3b28';
const WOOD_LT = '#e2b06a';
const NORI = '#2c3b30';
const RICE = '#f6f1e6';

export function blank(w = W, h = W): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ''));
}

function dot(g: Grid, x: number, y: number, col: string, w = 1, h = 1) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const xx = x0 + i;
      const yy = y0 + j;
      if (yy < 0 || xx < 0 || yy >= g.length || xx >= g[0].length) continue;
      g[yy][xx] = col;
    }
  }
}

function oval(g: Grid, cx: number, cy: number, rx: number, ry: number, col: string) {
  const rrx = Math.max(0.5, rx);
  const rry = Math.max(0.5, ry);
  for (let y = Math.floor(cy - rry); y <= Math.ceil(cy + rry); y++) {
    const dy = y - cy;
    const span = rrx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (rry * rry)));
    const x0 = Math.round(cx - span);
    const x1 = Math.round(cx + span);
    for (let x = x0; x <= x1; x++) {
      if (y < 0 || x < 0 || y >= g.length || x >= g[0].length) continue;
      g[y][x] = col;
    }
  }
}

function punch(g: Grid, cx: number, cy: number, rx: number, ry: number) {
  oval(g, cx, cy, rx, ry, '');
  // oval writes '' which is the punch. Re-clear in case a later pass needs the same shape.
}

export function outline(g: Grid, col = INK) {
  const h = g.length;
  const w = g[0].length;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== '';
  const mark: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push([x, y]);
    }
  }
  for (const [x, y] of mark) g[y][x] = col;
}

function blit(dst: Grid, src: Grid, ox: number, oy: number) {
  for (let y = 0; y < src.length; y++) {
    for (let x = 0; x < src[0].length; x++) {
      const col = src[y][x];
      if (!col) continue;
      const xx = ox + x;
      const yy = oy + y;
      if (yy < 0 || xx < 0 || yy >= dst.length || xx >= dst[0].length) continue;
      dst[yy][xx] = col;
    }
  }
}

function framed(draw: (g: Grid) => void, w = W, h = W): Grid {
  const g = blank(w, h);
  draw(g);
  outline(g);
  return g;
}

function camera(g: Grid) {
  dot(g, 3, 12, SILVER, 25, 15);
  dot(g, 3, 12, PAPER, 25, 3);
  dot(g, 7, 7, SILVER, 12, 6);
  dot(g, 8, 8, PAPER, 10, 2);
  dot(g, 21, 5, GOLD, 7, 6);
  dot(g, 22, 6, GOLD_LT, 3, 2);
  dot(g, 4, 9, GOLD, 4, 3);
  oval(g, 15, 20, 6.2, 6.2, '#243044');
  oval(g, 15, 20, 3.4, 3.4, '#6aa6dc');
  dot(g, 12, 17, PAPER, 3, 2);
}

function photos(g: Grid) {
  dot(g, 11, 2, PAPER, 16, 17);
  dot(g, 13, 4, SKY, 12, 8);
  dot(g, 13, 10, GREEN, 12, 3);
  dot(g, 17, 7, PAPER, 4, 4);
  dot(g, 15, 9, PAPER, 3, 3);
  dot(g, 3, 10, PAPER, 16, 18);
  dot(g, 5, 12, '#7ec4ef', 12, 8);
  dot(g, 5, 18, '#6aaa4a', 12, 3);
  dot(g, 8, 15, PAPER, 5, 4);
  dot(g, 10, 13, PAPER, 3, 3);
}

function map(g: Grid) {
  dot(g, 3, 3, '#7dba5a', 26, 26);
  dot(g, 3, 3, '#b6e292', 26, 5);
  dot(g, 5, 21, CREAM, 6, 5);
  dot(g, 9, 17, CREAM, 5, 6);
  dot(g, 13, 13, CREAM, 5, 6);
  dot(g, 17, 8, CREAM, 6, 6);
  oval(g, 8, 11, 3, 3, '#2f6b32');
  dot(g, 8, 13, WOOD_DK, 1, 3);
  oval(g, 23, 22, 3, 3, '#2f6b32');
  dot(g, 23, 24, WOOD_DK, 1, 3);
  oval(g, 22, 10, 3.4, 3.4, RED);
  dot(g, 21, 8, '#ffd0d0', 2, 2);
  dot(g, 22, 13, WOOD_DK, 1, 4);
}

function quests(g: Grid) {
  dot(g, 7, 7, CREAM, 16, 21);
  dot(g, 11, 3, SILVER, 8, 6);
  dot(g, 13, 5, METAL, 4, 2);
  for (const y of [12, 18, 24]) {
    dot(g, 10, y, y === 24 ? '#d4c4a4' : GREEN, 3, 3);
    dot(g, 15, y + 1, '#d4c4a4', 6, 1);
  }
  oval(g, 24, 9, 3.3, 3.3, RED);
  dot(g, 24, 7, PAPER, 1, 3);
  dot(g, 24, 11, PAPER);
}

function heart(g: Grid) {
  oval(g, 11, 12, 7, 6.5, PINK);
  oval(g, 21, 12, 7, 6.5, PINK);
  for (let i = 0; i < 13; i++) dot(g, 6 + i, 14 + i, PINK, 20 - i * 2, 1);
  oval(g, 8, 10, 2.4, 1.6, PINK_LT);
}

function raccoonFace(g: Grid) {
  oval(g, 5, 4, 2.2, 2.2, FUR);
  oval(g, 12, 4, 2.2, 2.2, FUR);
  oval(g, 5, 4, 1, 1, FUR_LT);
  oval(g, 12, 4, 1, 1, FUR_LT);
  oval(g, 8.5, 9, 6, 5, FUR);
  dot(g, 3, 8, MASK, 11, 3);
  dot(g, 4, 8, PAPER, 2, 2);
  dot(g, 11, 8, PAPER, 2, 2);
  dot(g, 5, 9, MASK);
  dot(g, 12, 9, MASK);
  oval(g, 8.5, 12, 2.6, 1.8, CREAM);
  dot(g, 8, 12, MASK, 2, 1);
}

function friends(g: Grid) {
  blit(g, framed(heart), 0, 0);
  blit(g, framed(raccoonFace, 18, 18), 14, 14);
}

function collections(g: Grid) {
  dot(g, 5, 12, '#d4535c', 22, 15);
  dot(g, 5, 12, '#f0a0a4', 22, 3);
  dot(g, 14, 6, GOLD, 4, 21);
  dot(g, 5, 18, GOLD, 22, 3);
  oval(g, 11, 8, 3, 3, GOLD);
  oval(g, 20, 8, 3, 3, GOLD);
  dot(g, 13, 7, GOLD_LT, 2, 2);
  dot(g, 19, 7, GOLD_LT, 2, 2);
}

function recipes(g: Grid) {
  oval(g, 17, 17, 11, 11, NORI);
  oval(g, 17, 17, 8, 8, RICE);
  oval(g, 17, 17, 3.6, 3.6, '#e07a32');
  dot(g, 13, 15, GREEN, 3, 3);
  dot(g, 19, 19, GOLD, 3, 2);
  dot(g, 12, 12, PAPER, 3, 2);
  dot(g, 4, 6, GREEN, 7, 3);
  dot(g, 3, 8, GREEN_LT, 6, 2);
  dot(g, 6, 5, GREEN_LT, 2, 2);
}

function restaurant(g: Grid) {
  for (let i = 0; i < 8; i++) dot(g, 5 + Math.floor(i * 0.7), 3 + i, BLUE, 22 - Math.floor(i * 1.4), 1);
  dot(g, 2, 11, '#2c4570', 28, 4);
  dot(g, 4, 11, '#6ea0d8', 24, 1);
  dot(g, 6, 15, CREAM, 20, 14);
  dot(g, 11, 15, '#c4505a', 10, 3);
  dot(g, 13, 20, WOOD, 6, 9);
  dot(g, 14, 21, WOOD_LT, 4, 7);
  dot(g, 17, 24, GOLD);
  dot(g, 8, 20, SKY, 4, 4);
  dot(g, 20, 20, SKY, 4, 4);
  dot(g, 9, 21, PAPER);
  dot(g, 21, 21, PAPER);
}

/** a crate with a rice sack: the supplies app */
function supplies(g: Grid) {
  dot(g, 4, 14, INK, 24, 15);
  dot(g, 5, 15, WOOD, 22, 13);
  dot(g, 5, 15, WOOD_LT, 22, 2);
  dot(g, 5, 21, '#7a4a2f', 22, 1);
  dot(g, 15, 15, '#7a4a2f', 2, 13);
  dot(g, 9, 6, INK, 9, 9);   // rice sack
  dot(g, 10, 7, CREAM, 7, 7);
  dot(g, 12, 5, INK, 3, 2);
  dot(g, 11, 9, '#c4505a', 5, 1);
  dot(g, 19, 9, INK, 8, 6);  // small box
  dot(g, 20, 10, '#d9a05b', 6, 4);
}

/** a waiter with a tray: the staff app */
function staff(g: Grid) {
  dot(g, 11, 3, CREAM, 10, 4);          // hat
  dot(g, 12, 6, CREAM, 8, 2);
  dot(g, 11, 8, '#f0c9a8', 10, 8);      // face
  dot(g, 13, 11, INK, 2, 2);
  dot(g, 18, 11, INK, 2, 2);
  dot(g, 14, 14, '#c4505a', 4, 1);
  dot(g, 8, 17, BLUE, 16, 10);          // jacket
  dot(g, 14, 17, CREAM, 4, 6);          // apron
  dot(g, 3, 20, WOOD, 11, 2);           // tray on the raised hand
  dot(g, 5, 18, CREAM, 6, 2);
  dot(g, 6, 17, '#c4505a', 4, 1);
}

function calendar(g: Grid) {
  dot(g, 5, 6, RED, 22, 7);
  dot(g, 5, 12, PAPER, 22, 16);
  for (const x of [10, 16, 21]) dot(g, x, 3, SILVER, 3, 5);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) dot(g, 8 + col * 5, 15 + row * 4, '#e4d3b4', 3, 2);
  }
  dot(g, 13, 15, GOLD, 3, 2);
  dot(g, 8, 8, PAPER, 4, 2);
}

function memories(g: Grid) {
  dot(g, 6, 3, WOOD, 20, 4);
  dot(g, 6, 25, WOOD, 20, 4);
  dot(g, 14, 6, WOOD_DK, 4, 20);
  for (let i = 0; i < 8; i++) {
    dot(g, 8 + i, 7 + i, SKY, 16 - i * 2, 1);
    dot(g, 8 + i, 24 - i, GOLD, 16 - i * 2, 1);
  }
  dot(g, 15, 15, GOLD, 2, 3);
  dot(g, 8, 4, WOOD_LT, 16, 1);
}

function investigation(g: Grid) {
  dot(g, 3, 8, CREAM, 16, 18);
  dot(g, 6, 12, '#d4c4a4', 10, 1);
  dot(g, 6, 15, '#d4c4a4', 8, 1);
  dot(g, 6, 18, '#d4c4a4', 9, 1);
  dot(g, 6, 21, '#d4c4a4', 6, 1);
  oval(g, 20, 14, 6.5, 6.5, '#d7f0ff');
  oval(g, 20, 14, 4, 4, '#f4fbff');
  dot(g, 17, 11, PAPER, 3, 2);
  dot(g, 23, 19, WOOD, 3, 3);
  dot(g, 25, 21, WOOD, 3, 3);
  dot(g, 27, 23, WOOD_DK, 3, 3);
}

function bag(g: Grid) {
  oval(g, 15, 18, 10, 10, WOOD);
  dot(g, 7, 8, WOOD_DK, 16, 7);
  dot(g, 8, 9, WOOD_LT, 14, 2);
  dot(g, 9, 18, '#a56b3c', 12, 7);
  dot(g, 13, 20, GOLD, 4, 3);
  dot(g, 5, 10, WOOD_DK, 3, 12);
  dot(g, 22, 15, BLUE, 7, 9);
  dot(g, 23, 16, SKY, 5, 3);
  dot(g, 24, 20, PAPER, 3, 1);
}

function customize(g: Grid) {
  dot(g, 7, 5, WOOD_DK, 2, 22);
  dot(g, 20, 8, WOOD_DK, 2, 20);
  dot(g, 9, 5, PINK, 11, 8);
  dot(g, 10, 6, PINK_LT, 6, 2);
  dot(g, 12, 15, '#5aa0e0', 11, 8);
  dot(g, 13, 16, SKY, 6, 2);
  dot(g, 6, 3, GOLD, 4, 3);
  dot(g, 19, 6, GOLD, 4, 3);
}

function settings(g: Grid) {
  const gear = (cx: number, cy: number, r: number, col: string) => {
    const layer = blank();
    oval(layer, cx, cy, r, r, col);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      dot(layer, cx + Math.cos(a) * (r + 1.6) - 1.5, cy + Math.sin(a) * (r + 1.6) - 1.5, col, 3, 3);
    }
    const hole = r * 0.36;
    punch(layer, cx, cy, hole, hole);
    outline(layer);
    blit(g, layer, 0, 0);
    punch(g, cx, cy, hole * 0.7, hole * 0.7);
  };
  gear(13, 13, 7, SILVER);
  gear(21, 21, 5.2, WOOD_LT);
}

function more(g: Grid) {
  const row = (y: number, knob: number, col: string) => {
    dot(g, 3, y, '#e4d3b4', 22, 3);
    dot(g, knob, y - 2, col, 6, 7);
  };
  row(7, 5, WOOD);
  row(15, 15, GOLD);
  row(23, 8, GREEN);
}

function paw(g: Grid) {
  oval(g, 11, 16, 5.4, 3.6, WOOD);
  oval(g, 11, 16, 3, 2, WOOD_LT);
  oval(g, 3, 7, 2.1, 2.1, WOOD);
  oval(g, 8, 4, 2.1, 2.1, WOOD);
  oval(g, 14, 4, 2.1, 2.1, WOOD);
  oval(g, 18, 8, 1.9, 1.9, WOOD);
}

function leaf(g: Grid) {
  const widths = [2, 4, 6, 8, 10, 12, 10, 8, 6, 4, 2];
  widths.forEach((w, i) => dot(g, 8 - w / 2, 1 + i, i % 2 ? GREEN : GREEN_LT, w, 1));
  dot(g, 8, 2, '#2f6b32', 1, 9);
  dot(g, 6, 5, '#2f6b32', 2, 1);
  dot(g, 9, 7, '#2f6b32', 2, 1);
  dot(g, 8, 12, WOOD_DK, 1, 3);
}

function cherry(g: Grid) {
  dot(g, 2, 3, WOOD_DK, 8, 1);
  dot(g, 8, 3, GREEN, 2, 4);
  dot(g, 6, 6, GREEN, 2, 3);
  oval(g, 5, 11, 3.2, 3.2, RED);
  oval(g, 11, 12, 3.2, 3.2, '#c43838');
  dot(g, 4, 10, '#ffd0d0', 2, 1);
  dot(g, 10, 11, '#ffd0d0', 2, 1);
}

function charm(g: Grid) {
  dot(g, 9, 0, WOOD_DK, 2, 4);
  oval(g, 4, 6, 2.2, 2.2, FUR);
  oval(g, 16, 6, 2.2, 2.2, FUR);
  oval(g, 6, 9, 3, 3, FUR);
  oval(g, 14, 9, 3, 3, FUR);
  oval(g, 6, 9, 1.3, 1.3, '#f4c0c8');
  oval(g, 14, 9, 1.3, 1.3, '#f4c0c8');
  oval(g, 10, 15, 7, 6, FUR);
  dot(g, 4, 14, MASK, 13, 4);
  dot(g, 5, 14, PAPER, 3, 3);
  dot(g, 12, 14, PAPER, 3, 3);
  dot(g, 6, 15, MASK, 2, 2);
  dot(g, 13, 15, MASK, 2, 2);
  oval(g, 10, 18, 3, 2.2, CREAM);
  dot(g, 9, 18, MASK, 2, 1);
  oval(g, 10, 24, 6, 4.2, FUR);
  oval(g, 10, 25, 3.4, 2.2, CREAM);
  oval(g, 6, 28, 2.2, 1.5, FUR);
  oval(g, 14, 28, 2.2, 1.5, FUR);
}

function signals(g: Grid) {
  for (let i = 0; i < 4; i++) dot(g, 1 + i * 4, 8 - i * 2, INK, 2, 3 + i * 2);
  dot(g, 18, 8, INK, 2, 2);
  dot(g, 16, 6, INK, 6, 1);
  dot(g, 17, 6, CREAM, 4, 1);
  dot(g, 15, 4, INK, 8, 1);
  dot(g, 16, 4, CREAM, 6, 1);
  dot(g, 26, 2, INK, 9, 8);
  dot(g, 27, 3, CREAM, 7, 6);
  dot(g, 27, 3, GREEN_LT, 5, 6);
  dot(g, 35, 4, INK, 2, 4);
}

const DRAW: Record<string, (g: Grid) => void> = {
  camera, photos, map, quests, friends, collections, recipes, restaurant, supplies, staff, clients: staff, calendar, memories, investigation, bag, customize, settings, more,
};

let cache: Record<string, Grid> | null = null;

export function phoneArtGrids(): Record<string, Grid> {
  if (cache) return cache;
  const out: Record<string, Grid> = {};
  for (const [id, draw] of Object.entries(DRAW)) {
    if (id === 'friends' || id === 'settings') {
      out[id] = blank();
      draw(out[id]);
    } else out[id] = framed(draw);
  }
  out.paw = framed(paw, 22, 22);
  out.leaf = framed(leaf, 16, 16);
  out.cherry = framed(cherry, 16, 16);
  out.charm = framed(charm, 20, 32);
  out.signals = blank(38, 12);
  signals(out.signals);
  cache = out;
  return out;
}

function paint(g: Grid): HTMLCanvasElement {
  const canvas = makeCanvas(g[0].length, g.length);
  const ctx = ctx2d(canvas);
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) if (g[y][x]) ctx.fillStyle = g[y][x], ctx.fillRect(x, y, 1, 1);
  }
  canvas.className = 'pn-art';
  canvas.draggable = false;
  return canvas;
}

export function phoneAppIcon(id: string): HTMLCanvasElement | null {
  const g = phoneArtGrids()[id];
  return g ? paint(g) : null;
}

export function phoneDeco(kind: 'paw' | 'leaf' | 'cherry'): HTMLCanvasElement {
  return paint(phoneArtGrids()[kind]);
}

export function phoneCharm(): HTMLCanvasElement {
  return paint(phoneArtGrids().charm);
}

export function phoneSignals(): HTMLCanvasElement {
  const canvas = paint(phoneArtGrids().signals);
  canvas.classList.add('pn-signals');
  return canvas;
}
