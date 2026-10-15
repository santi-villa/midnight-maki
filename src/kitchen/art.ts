/** Drawing for the preparation table: wood top slightly tilted, bamboo mat, nori, rice, rolls, pieces. Board pixels, no smoothing. */
import { kitchenOval } from '../art/cooking';
import { INGREDIENT_ALIASES, ITEMS_BY_ID } from '../data/items';
import { shade } from '../art/pixel';
import { RICE_H, RICE_W, type RiceMask } from './rice';

export type G = CanvasRenderingContext2D;
export interface R { x: number; y: number; w: number; h: number }
export const NORI = '#2f3b33';
export const RICE_C = '#fbf7ee';

export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

export function ingColor(id: string): string {
  const it = ITEMS_BY_ID[INGREDIENT_ALIASES[id] ?? id] ?? ITEMS_BY_ID[id];
  return it?.icon.c1 ?? '#e8826f';
}
export function ingLight(id: string): string {
  const it = ITEMS_BY_ID[INGREDIENT_ALIASES[id] ?? id] ?? ITEMS_BY_ID[id];
  return it?.icon.c2 ?? shade(ingColor(id), 0.3);
}

/** the wood table: planks, grain, a darker far edge and a lip near the player (a gentle tilt) */
export function drawTable(g: G, W: number, H: number) {
  rect(g, 0, 0, W, H, '#7a4f36');
  for (let y = 0, i = 0; y < H; y += 22, i++) {
    rect(g, 0, y, W, 22, i % 2 ? '#7d5238' : '#774d34');
    rect(g, 0, y, W, 1, '#5d3a28');
    for (let k = 0; k < 7; k++) rect(g, Math.floor(hash(i * 9 + k) * W), y + 4 + Math.floor(hash(i * 5 + k) * 14), 10 + Math.floor(hash(k + i) * 16), 1, '#8a5d41');
  }
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(20,10,5,.35)'); grad.addColorStop(0.35, 'rgba(20,10,5,0)'); grad.addColorStop(1, 'rgba(255,230,190,.07)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  rect(g, 0, H - 5, W, 5, '#53331f'); rect(g, 0, H - 6, W, 1, '#9b6a49');
}

export function drawShelfBoard(g: G, W: number, h: number) {
  rect(g, 0, 0, W, h, '#4a2f20'); rect(g, 0, h - 3, W, 3, '#2f1c12'); rect(g, 0, 0, W, 1, '#6d4630');
}

export function drawBowl(g: G, cx: number, cy: number, sprite: HTMLCanvasElement | null, left: number, dim: boolean, hot = false) {
  kitchenOval(g, cx + 1, cy + 8, 15, 5, 'rgba(0,0,0,.35)');
  kitchenOval(g, cx, cy + 6, 14, 6, hot ? '#c98f52' : '#9a6a47');
  kitchenOval(g, cx, cy + 4, 13, 5, '#d9c9a8');
  kitchenOval(g, cx, cy + 3, 11, 4, '#efe3c6');
  if (sprite) { g.globalAlpha = dim ? 0.35 : 1; g.drawImage(sprite, cx - 16, cy - 15); g.globalAlpha = 1; }
  if (left > 1) { rect(g, cx + 8, cy - 14, 11, 9, '#2b2236'); g.fillStyle = '#fff3d0'; g.font = '8px monospace'; g.textBaseline = 'top'; g.fillText(String(left), cx + 10, cy - 13); }
}

export function drawMat(g: G, m: R, lifted = 0) {
  rect(g, m.x + 2, m.y + 4, m.w, m.h, 'rgba(0,0,0,.28)');
  rect(g, m.x, m.y, m.w, m.h, '#d6bb82');
  for (let x = m.x + 2; x < m.x + m.w; x += 3) { rect(g, x, m.y, 1, m.h, '#b99a5c'); rect(g, x + 1, m.y, 1, m.h, '#e5d09b'); }
  rect(g, m.x, m.y, m.w, 2, '#8b6b3f'); rect(g, m.x, m.y + m.h - 2, m.w, 2, '#8b6b3f');
  for (const sx of [m.x + 14, m.x + m.w - 15]) { rect(g, sx, m.y, 2, m.h, '#f1ead2'); rect(g, sx - 1, m.y + m.h - 2, 4, 2, '#f1ead2'); }
  void lifted;
}

export function drawNori(g: G, s: R, seed = 1) {
  rect(g, s.x + 2, s.y + 3, s.w, s.h, 'rgba(0,0,0,.3)');
  rect(g, s.x, s.y, s.w, s.h, NORI);
  rect(g, s.x, s.y, s.w, 1, '#63805a');
  for (let y = s.y + 4; y < s.y + s.h; y += 5) for (let x = s.x + 3; x < s.x + s.w - 4; x += 9) { if (hash(x * 3 + y + seed) > 0.3) rect(g, x + Math.floor(hash(y) * 3), y, 4, 1, '#455b3c'); }
  rect(g, s.x, s.y + s.h - 1, s.w, 1, '#1e2a24');
}

export function drawRiceMask(g: G, s: R, m: RiceMask, seed = 1) {
  const cw = s.w / RICE_W, ch = s.h / RICE_H;
  for (let y = 0; y < RICE_H; y++) for (let x = 0; x < RICE_W; x++) {
    const v = m.v[y * RICE_W + x]; if (v < 0.12) continue;
    const px = Math.floor(s.x + x * cw), py = Math.floor(s.y + y * ch), w = Math.ceil(cw), hh = Math.ceil(ch);
    const hv = hash(x * 13 + y * 7 + seed);
    rect(g, px, py, w, hh, v < 0.35 ? (hv > 0.5 ? '#bdc0aa' : '#8d9a86') : v < 0.75 ? '#efe9d8' : v > 1.05 ? '#ffffff' : RICE_C);
    if (v >= 0.4 && hv > 0.62) rect(g, px + 1, py + 1, 2, 1, '#dcd5c1');
    if (v >= 0.4 && hv < 0.18) rect(g, px + 2, py, 1, 2, '#ffffff');
  }
}

export function drawRiceBall(g: G, cx: number, cy: number, size: number) {
  const r = Math.max(3, size);
  kitchenOval(g, cx + 1, cy + r * 0.45, r + 1, r * 0.5, 'rgba(0,0,0,.3)');
  kitchenOval(g, cx, cy, r, r * 0.8, '#d9d2bf');
  kitchenOval(g, cx, cy - 1, r - 1, r * 0.75, RICE_C);
  for (let i = 0; i < 9; i++) rect(g, cx - r * 0.6 + hash(i) * r * 1.2, cy - r * 0.4 + hash(i + 9) * r * 0.6, 2, 1, i % 2 ? '#e2dac6' : '#ffffff');
}

/** a long ingredient strip lying across the rice (also used on top of rolls) */
export function drawStrip(g: G, id: string, x: number, y: number, len: number, seed: number, thick = 6) {
  const c = ingColor(id), l = ingLight(id), d = shade(c, -0.3);
  const wob = (i: number) => Math.round((hash(seed + i * 3.1) - 0.5) * 2);
  const th = id === 'avocado' || id === 'cream' ? thick - 1 : thick;
  const x0 = Math.round(x - len / 2);
  for (let i = 0; i < len; i += 4) {
    const yy = Math.round(y) + wob(i);
    rect(g, x0 + i, yy + th - 1, Math.min(4, len - i), 2, d);
    rect(g, x0 + i, yy, Math.min(4, len - i), th, c);
    rect(g, x0 + i, yy, Math.min(4, len - i), 1, l);
    if (id === 'salmon' || id === 'tuna') if (hash(seed + i) > 0.5) rect(g, x0 + i + 1, yy + 2, 2, 1, l);
    if (id === 'cucumber' && i % 8 === 0) rect(g, x0 + i + 1, yy + 1, 2, 1, '#e3ebbe');
    if (id === 'tempura' && hash(seed + i) > 0.5) rect(g, x0 + i, yy + 1, 3, 2, '#e8c36a');
  }
  rect(g, x0 - 1, Math.round(y) + 1, 1, th - 2, d); rect(g, x0 + len, Math.round(y) + 1, 1, th - 2, d);
}

export interface RollGeo { x: number; w: number; cy: number; r: number }

/** the roll as a cylinder on its side; rice outside for uramaki, nori outside for maki */
export function drawRoll(g: G, ro: RollGeo, o: { outer: 'nori' | 'rice'; fills: string[]; seed: number; shadow?: boolean }) {
  const { x, w, cy, r } = ro;
  if (o.shadow !== false) kitchenOval(g, x + w / 2 + 2, cy + r * 0.9, w / 2 + 2, Math.max(2, r * 0.4), 'rgba(0,0,0,.3)');
  const body = o.outer === 'rice' ? RICE_C : NORI, hi = o.outer === 'rice' ? '#ffffff' : '#5c7553', lo = o.outer === 'rice' ? '#d9d2bf' : '#1e2a24';
  rect(g, x, cy - r, w, r * 2, body);
  rect(g, x, cy - r, w, Math.max(1, Math.round(r * 0.35)), hi);
  rect(g, x, cy + r - Math.max(2, Math.round(r * 0.3)), w, Math.max(2, Math.round(r * 0.3)), lo);
  if (o.outer === 'rice') for (let i = 0; i < w; i += 5) rect(g, x + i + hash(o.seed + i) * 3, cy - r * 0.6 + hash(o.seed + i + 1) * r * 1.2, 1, 1, i % 2 ? '#e3dbc6' : '#555');
  else for (let i = 0; i < w; i += 11) rect(g, x + i, cy - r * 0.2, 5, 1, '#455b3c');
  // end caps show the inside
  for (const side of [0, 1]) {
    const ex = side ? x + w : x;
    kitchenOval(g, ex, cy, Math.max(2, r * 0.45), r, side ? lo : body);
    if (r >= 6) {
      kitchenOval(g, ex, cy, Math.max(1, r * 0.3), r - 2, RICE_C);
      o.fills.forEach((f, i) => { const a = (i / Math.max(1, o.fills.length)) * 6.28; rect(g, ex - 1, cy + Math.sin(a) * r * 0.35 - 1, 2, 2, ingColor(f)); });
    }
  }
}

export interface PieceLook { kind: 'maki' | 'nigiri' | 'onigiri' | 'gunkan' | 'cone'; fills: string[]; outer: 'nori' | 'rice'; top?: string; wrapped?: boolean; deco: string[]; seed: number; glaze?: boolean }

/** one finished piece, seen from above and in front; (x,y) is its centre */
export function drawPiece(g: G, p: PieceLook, x: number, y: number, R = 8, lift = 0) {
  x = Math.round(x); y = Math.round(y - lift);
  kitchenOval(g, x + 1, y + R * 0.7 + lift, R, R * 0.45, 'rgba(0,0,0,' + (lift ? 0.18 : 0.32) + ')');
  if (p.kind === 'maki') {
    kitchenOval(g, x, y + 1, R, R * 0.85, p.outer === 'rice' ? '#d9d2bf' : '#1e2a24');
    kitchenOval(g, x, y, R, R * 0.85, p.outer === 'rice' ? RICE_C : NORI);
    if (p.outer === 'rice') {
      for (let i = 0; i < 7; i++) rect(g, x - R * 0.7 + hash(p.seed + i) * R * 1.4, y - R * 0.5 + hash(p.seed + i + 4) * R, 1, 1, i % 3 ? '#e3dbc6' : '#3a3a3a');
      kitchenOval(g, x, y, R - 3, R * 0.85 - 3, NORI);
    }
    kitchenOval(g, x, y, R - 2 - (p.outer === 'rice' ? 2 : 0), Math.max(2, R * 0.85 - 2 - (p.outer === 'rice' ? 2 : 0)), RICE_C);
    p.fills.slice(0, 4).forEach((f, i) => { const a = (i / Math.min(4, p.fills.length)) * 6.28 + p.seed; const px = x + Math.cos(a) * R * 0.28 * (p.fills.length > 1 ? 1 : 0), py = y + Math.sin(a) * R * 0.22 * (p.fills.length > 1 ? 1 : 0); rect(g, px - 2, py - 1, 4, 3, ingColor(f)); rect(g, px - 2, py - 1, 4, 1, ingLight(f)); });
    if (p.top) { rect(g, x - 3, y - R * 0.85 - 1, 7, 2, ingColor(p.top)); }
  } else if (p.kind === 'cone') {
    g.fillStyle = NORI; g.beginPath(); g.moveTo(x - R, y - R * 0.2); g.lineTo(x + R * 1.1, y + R * 0.9); g.lineTo(x - R * 0.2, y + R * 0.9); g.closePath(); g.fill();
    g.fillStyle = '#63805a'; g.fillRect(x - R + 1, y - R * 0.2, R, 1);
    p.fills.slice(0, 4).forEach((f, i) => rect(g, x - R - 1 + i * 3, y - R * 0.5 - (i % 2) * 2, 4, 3, ingColor(f)));
    rect(g, x - R + 1, y - R * 0.3, 6, 2, RICE_C);
  } else {
    // nigiri / onigiri / gunkan: a rice body with something on or around it
    const rw = p.kind === 'onigiri' ? R + 1 : R, rh = p.kind === 'onigiri' ? R * 0.8 : R * 0.6;
    if (p.kind === 'onigiri') {
      g.fillStyle = '#d9d2bf'; g.beginPath(); g.moveTo(x, y - rh - 1); g.lineTo(x + rw + 1, y + rh); g.lineTo(x - rw - 1, y + rh); g.closePath(); g.fill();
      g.fillStyle = RICE_C; g.beginPath(); g.moveTo(x, y - rh); g.lineTo(x + rw, y + rh - 1); g.lineTo(x - rw, y + rh - 1); g.closePath(); g.fill();
      rect(g, x - rw * 0.5, y + rh * 0.2, rw, rh * 0.8, NORI);
    } else {
      kitchenOval(g, x, y + 1, rw, rh, '#d9d2bf'); kitchenOval(g, x, y, rw, rh, RICE_C);
    }
    if (p.fills.length && p.kind === 'onigiri') rect(g, x - 2, y - 1, 4, 3, ingColor(p.fills[0]));
    if (p.kind === 'gunkan') { rect(g, x - rw, y - 2, rw * 2 + 1, rh + 3, NORI); rect(g, x - rw, y - 2, rw * 2 + 1, 1, '#5c7553'); kitchenOval(g, x, y - 2, rw - 1, 3, RICE_C); }
    if (p.top) {
      const c = ingColor(p.top), l = ingLight(p.top);
      if (p.kind === 'gunkan') { kitchenOval(g, x, y - 4, rw - 1, 4, shade(c, -0.25)); kitchenOval(g, x, y - 5, rw - 2, 3, c); rect(g, x - 2, y - 6, 3, 1, l); }
      else { kitchenOval(g, x, y - rh * 0.5, rw + 1, rh * 0.8, shade(c, -0.3)); kitchenOval(g, x, y - rh * 0.5 - 1, rw + 1, rh * 0.75, c); rect(g, x - rw + 2, y - rh * 0.5 - 2, rw, 1, l); }
    }
    if (p.wrapped && p.kind !== 'gunkan' && p.kind !== 'onigiri') { rect(g, x - 2, y - rh - 3, 5, rh * 2 + 5, NORI); rect(g, x - 2, y - rh - 3, 1, rh * 2 + 5, '#5c7553'); }
  }
  p.deco.forEach((d, i) => {
    const dx = x + (hash(p.seed + i * 2) - 0.5) * R, dy = y - R * 0.3 + (hash(p.seed + i * 2 + 1) - 0.5) * 2;
    if (d === 'sesame') for (let k = 0; k < 4; k++) rect(g, dx + k * 2 - 3, dy + (k % 2), 1, 1, '#f1e4b8');
    else rect(g, dx - 1, dy - 1, 3, 2, ingColor(d));
  });
}

export function drawKnifeAt(g: G, x: number, y: number, angle = 0) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(angle);
  rect(g, -2, -34, 4, 20, '#553c32'); rect(g, -1, -33, 2, 18, '#a87549');
  rect(g, -3, -14, 7, 22, '#768f8a'); rect(g, -2, -13, 5, 20, '#c9ddd4'); rect(g, -2, -13, 1, 20, '#f4f8e7'); rect(g, -3, 8, 7, 1, '#4a5d58');
  g.restore();
}

export function drawHand(g: G, x: number, y: number, press = false) {
  x = Math.round(x); y = Math.round(y);
  kitchenOval(g, x + 1, y + 6, 8, 3, 'rgba(0,0,0,.25)');
  kitchenOval(g, x, y, 8, 5, '#e9b99a'); kitchenOval(g, x, y - 1, 7, 4, '#f4cfb4');
  for (let i = -2; i <= 2; i++) rect(g, x + i * 3 - 1, y - 7 + (press ? 2 : 0), 2, 4, '#f4cfb4');
}

export function drawPlateDeco(g: G, id: string, x: number, y: number, seed: number) {
  x = Math.round(x); y = Math.round(y);
  if (id === 'deco_wasabi' || id === 'wasabi') { kitchenOval(g, x, y, 4, 3, '#4d7a3a'); kitchenOval(g, x - 1, y - 1, 3, 2, '#8bbf5d'); rect(g, x - 2, y - 2, 1, 1, '#c5e39a'); }
  else if (id === 'deco_ginger') { for (let i = 0; i < 4; i++) kitchenOval(g, x - 4 + i * 2, y + (i % 2), 4, 3, i % 2 ? '#f0a7ab' : '#f7c1c1'); }
  else if (id === 'sesame') for (let k = 0; k < 7; k++) rect(g, x + hash(seed + k) * 12 - 6, y + hash(seed + k + 7) * 6 - 3, 1, 1, '#f1e4b8');
  else if (id === 'deco_sauce') { kitchenOval(g, x, y, 5, 3, '#3a2418'); kitchenOval(g, x - 1, y - 1, 3, 1, '#7a5035'); }
  else { kitchenOval(g, x, y, 4, 3, shade(ingColor(id), -0.2)); kitchenOval(g, x, y - 1, 3, 2, ingColor(id)); }
}
