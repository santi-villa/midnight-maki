import { expect, test } from '@playwright/test';

/** The plush raccoons (src/art/plushRaccoon.ts): each sheet keeps the shared 30-frame contract and every direction / mood really differs. */
for (const [id, width] of [['pip', 34], ['rigg', 34], ['spicy', 34]] as const) test(`${id} plush sheet: size, feet, mirror, faces, tail in every direction`, async ({ page }) => {
  await page.goto('/?debug');
  const r = await page.evaluate(async (id) => {
    const { buildFolkSheet } = await import('/src/art/folk.ts' as string);
    const { FOLK_SPECS } = await import('/src/data/folkSpecs.ts' as string);
    const { shade } = await import('/src/art/pixel.ts' as string);
    const spec = FOLK_SPECS[id];
    const { canvas, fw, fh } = buildFolkSheet(spec);
    const g = canvas.getContext('2d')!;
    const frame = (i: number) => g.getImageData(i * fw, 0, fw, fh).data;
    const at = (d: Uint8ClampedArray, x: number, y: number) => { const k = (y * fw + x) * 4; return [d[k], d[k + 1], d[k + 2], d[k + 3]] as const; };
    const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const same = (c: readonly number[], h: number[]) => c[3] === 255 && c[0] === h[0] && c[1] === h[1] && c[2] === h[2];
    const count = (d: Uint8ClampedArray, h: number[], x0 = 0, x1 = fw, y0 = 0, y1 = fh) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (same(at(d, x, y), h)) n++; return n; };
    const eye = hex(spec.eye);
    const ring = hex(spec.plush.ring ?? shade(spec.tail.c, -0.42));
    const key = (i: number) => Array.from(frame(i)).join(',');
    const rows = (d: Uint8ClampedArray) => { let top = fh, bot = -1; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (at(d, x, y)[3] > 0) { top = Math.min(top, y); bot = Math.max(bot, y); } return [top, bot]; };
    const out: Record<string, unknown> = { fw, fh, width: canvas.width };
    out.vertical = Array.from({ length: 30 }, (_, i) => rows(frame(i)));
    // the left idle frame is the right one mirrored
    let mirrored = true;
    const r6 = frame(6), l9 = frame(9);
    for (let y = 0; y < fh && mirrored; y++) for (let x = 0; x < fw; x++) { const a = at(r6, x, y), b = at(l9, fw - 1 - x, y); if (a.some((v, k) => v !== b[k])) { mirrored = false; break; } }
    out.mirrored = mirrored;
    // front silhouette of the head (above the tail curl) is symmetric
    const f0 = frame(0);
    let sym = true;
    for (let y = 12; y < 17; y++) for (let x = 3; x < fw / 2; x++) if ((at(f0, x, y)[3] > 0) !== (at(f0, fw - 1 - x, y)[3] > 0)) sym = false;
    out.headSymmetric = sym;
    out.eyesFront = [count(f0, eye, 0, fw / 2), count(f0, eye, fw / 2, fw)];
    out.eyesBack = count(frame(3), eye);
    out.tailPx = { front: count(f0, ring, fw - 7, fw), right: count(frame(6), ring, 0, 12), left: count(frame(9), ring, fw - 12, fw), back: count(frame(3), ring, 6, fw - 6, 26, 38) };
    const distinct = (ids: number[]) => new Set(ids.map(key)).size === ids.length;
    out.walkDistinct = distinct([0, 1, 2]) && distinct([3, 4, 5]) && distinct([6, 7, 8]) && distinct([9, 10, 11]);
    out.moodsDistinct = distinct([0, 12, 13, 14, 15, 18, 19]);
    out.actionsDistinct = distinct([0, 24, 25, 26, 27, 28, 29]);
    return out;
  }, id);
  expect(r.fw).toBe(width);
  expect(r.fh).toBe(39);
  expect(r.width).toBe(width * 30);
  const v = r.vertical as number[][];
  // feet on the last rows in every standing frame; nothing above the ears (the transparent pad is for hats)
  for (let i = 0; i < 30; i++) { if (i === 15) continue; expect(v[i][1], `frame ${i} feet`).toBeGreaterThanOrEqual(37); expect(v[i][0], `frame ${i} top`).toBeGreaterThanOrEqual(4); }
  expect(r.mirrored).toBe(true);
  if (id !== 'spicy') expect(r.headSymmetric).toBe(true); // her bandana knot sits on one side
  expect(r.eyesFront).toEqual([expect.any(Number), expect.any(Number)]);
  const [el, er] = r.eyesFront as number[];
  expect(el).toBeGreaterThan(2);
  expect(el).toBe(er);
  expect(r.eyesBack).toBe(0);
  const t = r.tailPx as Record<string, number>;
  for (const k of ['front', 'right', 'left', 'back']) expect(t[k], `tail ${k}`).toBeGreaterThan(3);
  expect(r.walkDistinct).toBe(true);
  expect(r.moodsDistinct).toBe(true);
  expect(r.actionsDistinct).toBe(true);
});
