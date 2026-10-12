import { expect, test } from '@playwright/test';

test('folk sprites: every character renders all 30 frames, 4 directions differ, expressions differ', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForSelector('.tt.ready');
  const report = await page.evaluate(async () => {
    const folk = await import('/src/art/folk.ts');
    const { FOLK_SPECS } = await import('/src/data/folkSpecs.ts');
    const out: Record<string, any> = {};
    const key = (cv: HTMLCanvasElement, f: number, fw: number, fh: number) => {
      const d = cv.getContext('2d')!.getImageData(f * fw, 0, fw, fh).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + (i >> 2)) >>> 0; }
      return { hash: s, opaque: n };
    };
    for (const [id, spec] of Object.entries(FOLK_SPECS) as [string, any][]) {
      const { canvas, fw, fh } = folk.buildFolkSheet(spec);
      const frames = Array.from({ length: 30 }, (_, f) => key(canvas, f, fw, fh));
      // bottom-most opaque row must be the feet (figure stands on the last rows)
      const d = canvas.getContext('2d')!.getImageData(0, 0, fw, fh).data;
      let lowest = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3]) lowest = y;
      out[id] = { fw, fh, sheetW: canvas.width, empty: frames.filter((f) => f.opaque < 100).length, down: frames[0].hash, up: frames[3].hash, right: frames[6].hash, left: frames[9].hash, blink: frames[12].hash, happy: frames[13].hash, walkA: frames[1].hash, walkB: frames[2].hash, cook: frames[24].hash, wave: frames[26].hash, sit: frames[29].hash, lowest };
    }
    return out;
  });
  expect(Object.keys(report).length).toBe(15);
  for (const [id, r] of Object.entries<any>(report)) {
    expect(r.sheetW, id).toBe(r.fw * 30);
    expect(r.fh, id).toBe(39);
    expect(r.empty, id).toBe(0);
    expect(r.lowest, id).toBeGreaterThanOrEqual(r.fh - 3); // feet on the last rows
    expect(new Set([r.down, r.up, r.right, r.left]).size, id).toBe(4);
    expect(r.blink, id).not.toBe(r.down);
    expect(r.happy, id).not.toBe(r.down);
    expect(r.walkA, id).not.toBe(r.walkB);
    expect(r.cook, id).not.toBe(r.down);
    expect(r.wave, id).not.toBe(r.down);
    expect(r.sit, id).not.toBe(r.down);
  }
});
