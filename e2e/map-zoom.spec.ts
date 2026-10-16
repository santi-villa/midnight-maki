import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

test('the world map zooms with buttons and goes back to the full view', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await page.keyboard.press('m');
  const stage = page.locator('.wm-stage').first();
  await expect(stage).toBeVisible();
  const w0 = (await stage.boundingBox())!.width;
  await page.getByRole('button', { name: 'Acercar' }).click();
  await page.getByRole('button', { name: 'Acercar' }).click();
  await expect(page.locator('.wm-zoom-pct')).toHaveText('196%');
  expect((await stage.boundingBox())!.width).toBeGreaterThan(w0 * 1.8);
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/map-zoom.png' });
  await page.getByRole('button', { name: 'Vista completa' }).click();
  await expect(page.locator('.wm-zoom-pct')).toHaveText('100%');
  expect(Math.abs((await stage.boundingBox())!.width - w0)).toBeLessThan(20);
});
