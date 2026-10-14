import { expect, test } from '@playwright/test';
for (const [width, height] of [[390, 844], [1280, 720]]) {
  test(`initial lantern loader gives honest feedback and fades to the ready menu (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    let release!: () => void;
    await page.route('**/src/main.ts*', async route => { await new Promise<void>(resolve => { release = resolve; }); await route.continue(); });
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#boot')).toBeVisible();
    await expect(page.locator('#boot .boot-title')).toHaveText('MAKI & MAPACHES');
    await expect(page.locator('#boot')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#boot .bar, #boot progress')).toHaveCount(0);
    const box = await page.locator('#boot .boot-title').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`boot-${width}.png`) });
    await expect.poll(() => typeof release).toBe('function');
    release();
    await expect(page.locator('.tt.ready')).toBeVisible();
    await expect(page.locator('#boot')).toHaveCount(0);
    await page.locator('.tt').click();
    await expect(page.getByRole('button', { name: 'Nueva partida' })).toBeVisible();
  });
}

test('keeps the loader until the title illustration is decoded, with no fallback flash', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/title/title-*.webp', async route => { await gate; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  await page.locator('.tt').waitFor({ state: 'attached' });
  await expect(page.locator('#boot')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator('#boot')).not.toHaveClass(/out/);
  await expect(page.locator('.tt')).not.toHaveClass(/ready|no-bg/);
  expect(await page.locator('.tt').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  release();
  await expect(page.locator('.tt.ready')).toBeVisible();
  await expect(page.locator('#boot')).toHaveCount(0);
});

test('a missing title illustration still reveals a usable fallback menu', async ({ page }) => {
  await page.route('**/title/title-*.webp', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await expect(page.locator('.tt.no-bg')).toBeVisible();
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.locator('.tt').click();
  await expect(page.getByRole('button', { name: 'Nueva partida' })).toBeVisible();
});
