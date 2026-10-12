/** Low level pixel-art helpers. All game art is generated at runtime from code (original assets). */

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function px(ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
}

/** amt in -1..1 ; negative darkens (towards a warm dark), positive lightens (towards cream). */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) {
    const t = -amt;
    // darken towards a purple-ish ink, keeps palette cozy instead of grey
    return rgbToHex(r + (42 - r) * t, g + (30 - g) * t, b + (48 - b) * t);
  }
  return rgbToHex(r + (255 - r) * amt, g + (248 - g) * amt, b + (230 - b) * amt);
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/**
 * Draws a character-template: array of equal-length strings, each char maps to a color via `pal`.
 * '.' and ' ' are transparent. Unknown chars are skipped. `flip` mirrors horizontally.
 */
export function drawTemplate(
  ctx: Ctx,
  rows: readonly string[],
  pal: Record<string, string | undefined>,
  ox = 0,
  oy = 0,
  flip = false,
): void {
  const w = rows[0]?.length ?? 0;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + (flip ? w - 1 - x : x), oy + y, 1, 1);
    }
  }
}

/** Seeded deterministic RNG (mulberry32) so generated tiles look identical every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Upscale a canvas region into a new canvas (nearest neighbour). */
export function scaled(src: HTMLCanvasElement, scale: number, sx = 0, sy = 0, sw = src.width, sh = src.height): HTMLCanvasElement {
  const c = makeCanvas(sw * scale, sh * scale);
  const ctx = ctx2d(c);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
  return c;
}

/** Draw a filled pixel ellipse */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** Adds a 1px outline (in `color`) around all opaque pixels of a canvas. */
export function outline(c: HTMLCanvasElement, color: string): void {
  const ctx = ctx2d(c);
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const a = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
  const pts: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
}
