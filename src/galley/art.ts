/**
 * Pixel art for the things you carry and set down in the kitchen. Built from the game's own ingredient and recipe icons,
 * so the look matches the rest: a cut ingredient is the same icon split into slices, a cooked one is warmer, cooked rice is a
 * bowl, a dish sits on a little plate. Canvases are small (18x16) and cached by what they show.
 */
import { iconCanvas } from '../art/icons';
import { ctx2d, ellipse, makeCanvas, px } from '../art/pixel';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES_BY_ID } from '../data/recipes';
import { DRINK_BY_ID } from '../restaurant/drinkData';
import type { GItem } from './prep';

export const ITEM_W = 20; // 18x16 of art plus a one pixel contour all around
export const ITEM_H = 18;
const INK = '#2b1d17';
const cache = new Map<string, HTMLCanvasElement>();

export function itemKey(i: GItem): string {
  // (the carried look is cached apart, see galleyItemCanvas)
  if (i.kind === 'cup') return 'cup';
  if (i.kind === 'drink') return `k|${i.drink}`;
  return i.kind === 'dish' ? `d|${i.recipe}|${i.dq}` : `i|${i.ing}|${i.form}|${i.q >= 3 ? 3 : 2}`;
}

/** What the raw ingredient looks like (falls back to a lump for anything without an icon). */
function base(ing: string): HTMLCanvasElement {
  return iconCanvas(ITEMS_BY_ID[ing]?.icon ?? { type: 'blob', c1: '#d9c7a3' });
}

/** The icon cut into three slices that are pulled slightly apart and staggered. */
function sliced(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(ITEM_W, ITEM_H);
  const g = ctx2d(c);
  const cuts: [number, number][] = [[0, 5], [5, 6], [11, 5]];
  cuts.forEach(([sx, sw], i) => {
    g.drawImage(src, sx, 0, sw, 16, i * 6, i === 1 ? 1 : 0, sw, 16);
    // a light cut face on the left of each slice
    px(g, i * 6, 5 + (i === 1 ? 1 : 0), 'rgba(255,248,230,0.55)', 1, 6);
  });
  return c;
}

/** Warm up what has been cooked: a brown wash over the opaque pixels and a couple of toasted specks. */
function toasted(c: HTMLCanvasElement): HTMLCanvasElement {
  const g = ctx2d(c);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(150, 88, 28, 0.34)';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  for (const [x, y] of [[5, 6], [10, 9], [8, 4]]) px(g, x, y, '#6b3d18');
  return c;
}

function bowl(): HTMLCanvasElement {
  const c = makeCanvas(ITEM_W, ITEM_H);
  const g = ctx2d(c);
  ellipse(g, 9, 11, 7, 4, INK);
  ellipse(g, 9, 10.5, 6, 3.2, '#8a603e');
  ellipse(g, 9, 8, 5.5, 3.6, INK);
  ellipse(g, 9, 7.6, 4.8, 3, '#fbf7ee');
  px(g, 6, 6, '#ffffff', 2, 1);
  px(g, 10, 8, '#e8dfcf');
  px(g, 7, 9, '#e8dfcf');
  px(g, 3, 11, '#c9a24a', 12, 1);
  return c;
}

function plate(dish: Extract<GItem, { kind: 'dish' }>): HTMLCanvasElement {
  const c = makeCanvas(ITEM_W, ITEM_H);
  const g = ctx2d(c);
  ellipse(g, 9, 12.5, 8.6, 3.3, INK);
  ellipse(g, 9, 12, 7.8, 2.6, dish.dq === 2 ? '#f6dc8a' : '#f6f1e6');
  ellipse(g, 9, 12, 6, 1.7, '#fffaf0');
  const r = RECIPES_BY_ID[dish.recipe];
  if (r) g.drawImage(iconCanvas(r.icon), 1, -2);
  return c;
}

/** A glass; with `fill` it holds a drink of that colour (a straw and a highlight). */
function glass(fill?: string): HTMLCanvasElement {
  const c = makeCanvas(ITEM_W, ITEM_H);
  const g = ctx2d(c);
  px(g, 5, 4, INK, 8, 10); px(g, 6, 13, INK, 6, 1);
  px(g, 6, 4, 'rgba(230,242,248,0.9)', 6, 9);
  if (fill) { px(g, 6, 7, fill, 6, 6); px(g, 6, 6, '#fffaf0', 6, 1); px(g, 11, 1, '#c94a3f', 1, 6); px(g, 10, 1, '#c94a3f', 2, 1); }
  px(g, 7, 5, '#ffffff', 1, 3);
  return c;
}

/** One pixel contour around whatever is drawn, so small things keep their silhouette over wood and dark counters. */
function contoured(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = makeCanvas(ITEM_W, ITEM_H);
  const g = ctx2d(c);
  const tint = makeCanvas(src.width, src.height);
  const t = ctx2d(tint);
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, src.width, src.height);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(tint, 1 + dx, 1 + dy);
  g.drawImage(src, 1, 1);
  return c;
}

/**
 * Shape cues that do not rely on colour: raw is whole, cut shows knife marks, cooked shows steam, a plate sits on a dish,
 * a glass holds a drink. Drawn in the corner of the 18x16 art.
 */
function cue(c: HTMLCanvasElement, form: string) {
  const g = ctx2d(c);
  if (form === 'cut' || form === 'cooked_cut') { px(g, 14, 1, INK, 3, 1); px(g, 13, 2, '#fffaf0', 2, 1); px(g, 15, 0, '#fffaf0'); px(g, 16, 2, INK); }
  if (form === 'cooked' || form === 'cooked_cut') { px(g, 1, 1, '#ffffff'); px(g, 2, 0, '#ffffff'); px(g, 3, 1, '#ffffff'); }
}

/** The sprite of a thing in somebody's hands (`carried`: cream contour) or on a surface (dark contour). */
export function galleyItemCanvas(item: GItem, carried = false): HTMLCanvasElement {
  const key = itemKey(item) + (carried ? '|held' : '');
  const hit = cache.get(key);
  if (hit) return hit;
  const flat = flatCanvas(item);
  const c = contoured(flat, carried ? '#fff4d6' : INK);
  cache.set(key, c);
  return c;
}

function flatCanvas(item: GItem): HTMLCanvasElement {
  let c: HTMLCanvasElement;
  if (item.kind === 'cup') c = glass();
  else if (item.kind === 'drink') c = glass(DRINK_BY_ID[item.drink]?.icon.c1 ?? '#91ab69');
  else if (item.kind === 'dish') c = plate(item);
  else if (item.ing === 'rice' && (item.form === 'cooked' || item.form === 'cooked_cut')) c = bowl();
  else {
    const src = base(item.ing);
    const cut = item.form === 'cut' || item.form === 'cooked_cut';
    c = cut ? sliced(src) : (() => { const o = makeCanvas(ITEM_W, ITEM_H); ctx2d(o).drawImage(src, 1, 0); return o; })();
    if (item.form === 'cooked' || item.form === 'cooked_cut') toasted(c);
    cue(c, item.form);
  }
  // a prepared piece that came out perfect carries a tiny gold glint
  if (item.kind === 'ing' && item.q >= 3 && item.form !== 'raw') { const g = ctx2d(c); px(g, 15, 5, '#fff2b0'); px(g, 14, 6, '#f2c66d'); px(g, 16, 6, '#f2c66d'); px(g, 15, 7, '#f2c66d'); }
  return c;
}

/** The fridge with its door open: what you see for a moment when somebody takes something out. 16x32, drawn over the fridge. */
export function fridgeOpenCanvas(): HTMLCanvasElement {
  const key = 'fridge-open';
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(16, 32);
  const g = ctx2d(c);
  px(g, 1, 3, INK, 14, 28);
  px(g, 2, 4, '#dfe8ee', 10, 26);
  px(g, 3, 5, '#fff7e0', 8, 24);
  for (const y of [11, 18, 25]) px(g, 3, y, '#9fb3c2', 8, 1);
  px(g, 4, 6, '#e8826f', 3, 4); px(g, 8, 7, '#a3c46f', 2, 3);
  px(g, 4, 13, '#f6ecd6', 4, 4); px(g, 9, 13, '#78adb6', 2, 4);
  px(g, 4, 20, '#c94a3f', 3, 4); px(g, 8, 20, '#f2c66d', 3, 4);
  // the swung door, seen edge-on
  px(g, 12, 3, INK, 3, 28);
  px(g, 13, 4, '#f4f7f9', 1, 26);
  px(g, 13, 14, '#8f94a1', 1, 4);
  cache.set(key, c);
  return c;
}

export const PIXEL_BITS = ['#fff2b0', '#f2c66d', '#ffffff'];
