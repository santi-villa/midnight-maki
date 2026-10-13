import { expect, test } from '@playwright/test';

test('customer sheets follow the shared layout plus eating frames', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForSelector('.tt.ready');
  const report = await page.evaluate(async () => {
    const { buildCustomerSheet, CUSTOMER_IDS } = await import('/src/art/customerSheet.ts');
    const out: Record<string, any> = {};
    for (const id of CUSTOMER_IDS) {
      const { canvas, fw, fh, count } = buildCustomerSheet(id);
      const g = canvas.getContext('2d')!;
      const sig = (f: number) => {
        const d = g.getImageData(f * fw, 0, fw, fh).data;
        let n = 0, s = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + i) >>> 0; }
        return { n, s };
      };
      const all = Array.from({ length: count }, (_, f) => sig(f));
      out[id] = { fw, fh, count, w: canvas.width, empty: all.filter((a) => a.n < 100).length, down: all[0].s, walkA: all[1].s, walkB: all[2].s, right: all[6].s, left: all[9].s, sit: all[29].s, sit2: all[34].s, eat: [30, 31, 32, 33].map((f) => all[f].s) };
    }
    return out;
  });
  expect(Object.keys(report)).toHaveLength(8);
  for (const [id, r] of Object.entries<any>(report)) {
    expect([r.fw, r.fh, r.count], id).toEqual([28, 40, 35]);
    expect(r.w, id).toBe(28 * 35);
    expect(r.empty, id).toBe(0);
    expect(r.walkA, id).not.toBe(r.walkB);
    expect(r.left, id).not.toBe(r.right); // mirrored, so different pixels
    expect(r.sit, id).not.toBe(r.sit2);
    expect(new Set(r.eat).size, id).toBe(4);
  }
});
