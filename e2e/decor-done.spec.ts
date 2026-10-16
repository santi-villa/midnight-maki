import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';
test('decorating: a chosen piece stays with Listo and goes back with Cancelar', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await page.evaluate(async () => {
    const d = (window as any).mmDebug;
    for (const id of ['cushion_rose']) d.game.save.furnitureOwned[id] = 1;
    await d.world.enterZone('home', 3, 5, 'down', false, true);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as any).mmDebug.decor.startDecor());
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Colocar' })).toHaveCount(0);
  const count = () => page.evaluate(() => { const g = (window as any).mmDebug.game; return { owned: g.save.furnitureOwned.cushion_rose ?? 0, placed: Object.values(g.save.decor).flat().filter((p: any) => p.id === 'cushion_rose').length }; });
  const base = await count();
  // choose a piece, then Cancelar: nothing changes
  await page.locator('.decor-chip', { hasText: /Dormitorio|Cuarto|Cama/ }).first().click().catch(() => {});
  await page.locator('.decor-card', { hasText: 'Zabuton rosa' }).first().click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(await count()).toEqual(base);
  // choose again and press Listo: it is placed without any other button
  await page.evaluate(() => (window as any).mmDebug.decor.startDecor());
  await page.locator('.decor-chip', { hasText: /Dormitorio|Cuarto|Cama/ }).first().click().catch(() => {});
  await page.locator('.decor-card', { hasText: 'Zabuton rosa' }).first().click();
  await page.getByRole('button', { name: 'Listo' }).click();
  const after = await count();
  expect(after.owned).toBe(base.owned - 1);
  expect(after.placed).toBe(base.placed + 1);
});
