import { expect, test, type Page } from '@playwright/test';
async function begin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, ambience: 0, sfx: 0, textSpeed: 0 })));
  await page.goto('/?debug&st'); await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await expect(page.locator('.hud-digital')).toBeVisible();
}
test('digital time, hands and period stay in sync across midnight and while paused', async ({ page }) => {
  await begin(page);
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
  for (const [period, minutes, text, label] of [[0, 0, '06:00', 'Mañana'], [1, 10, '12:40', 'Tarde'], [2, 45, '19:30', 'Atardecer'], [3, 89.5, '23:59', 'Noche'], [3, 90, '00:00', 'Noche']] as const) {
    await page.evaluate(({ period, minutes }) => { const t = (window as any).mmDebug.game.save.time; t.period = period; t.minutes = minutes; }, { period, minutes });
    await expect(page.locator('.hud-digital')).toHaveText(text);
    await expect(page.locator('.hud-clock')).toHaveAttribute('data-time', text);
    await expect(page.locator('.hud-digital')).toHaveAttribute('datetime', text);
    await expect(page.locator('.hud-status .time')).toHaveText(label);
  }
  await page.waitForTimeout(1300); await expect(page.locator('.hud-digital')).toHaveText('00:00');
  await page.evaluate(() => (window as any).mmDebug.clock.newDay());
  await expect(page.locator('.hud-digital')).toHaveText('06:00');
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await expect(page.locator('.hud-digital')).not.toHaveText('06:00', { timeout: 4000 });
});
test('time and buttons fit PC and small phones in both orientations', async ({ page }, info) => {
  await begin(page);
  for (const [width, height] of [[320, 740], [390, 844], [844, 390], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    const rects = await page.locator('.hud-status-wrap, .hud-buttons, .hud-digital, .hud-clock, .hud-quest').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
    const quest = rects[rects.length - 1];
    const pair = await page.locator('.hud-time-row').boundingBox();
    expect(pair).toBeTruthy();
    for (const r of rects) { expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(width); expect(r.bottom).toBeLessThanOrEqual(height); }
    const s = await page.locator('.hud-status-wrap').boundingBox();
    const b = await page.locator('.hud-buttons').boundingBox();
    expect(s!.x + s!.width).toBeLessThanOrEqual(b!.x);
    const d = await page.locator('.hud-digital').boundingBox();
    const a = await page.locator('.hud-clock').boundingBox();
    expect(a!.x + a!.width).toBeLessThan(d!.x);
    expect(quest.top).toBeGreaterThan(pair!.y + pair!.height);
    await page.screenshot({ path: info.outputPath(`hud-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Contraer fecha y monedas' }).click();
  await expect(page.locator('.hud-digital')).toBeVisible(); await expect(page.locator('.hud-clock')).toBeVisible();
  await expect(page.locator('.hud-date')).toBeHidden();
});
