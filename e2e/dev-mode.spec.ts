import { bootExploration } from './helpers/exploration';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

async function playing(page: Page) {
  await bootExploration(page);
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await expect(page.locator('.hud-digital')).toBeVisible();
}

test('developer mode warps to a locked place and can open the roads', async ({ page }) => {
  await playing(page);
  await page.keyboard.press('Escape');
  const board = page.locator('.pause-sheet');
  await expect(board.getByRole('button', { name: 'Modo prueba' })).toBeVisible();
  await board.getByRole('button', { name: 'Modo prueba' }).click();
  const panel = page.locator('.panel', { has: page.getByRole('heading', { name: 'Modo prueba' }) });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Bosque Susurrante' }).click();
  await expect.poll(() => page.evaluate(() => {
    const m = (window as any).mmDebug;
    return m.world.zoneId === 'forest' && m.world.canAct() && !m.clock.paused;
  }), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => (window as any).mmDebug.game.has('unlock_forest'))).toBe(false);

  await page.keyboard.press('F8');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Abrir caminos y tiendas' }).click();
  await expect.poll(() => page.evaluate(() => {
    const game = (window as any).mmDebug.game;
    return game.has('unlock_beach') && game.has('unlock_forest') && game.has('unlock_garden') && game.has('unlock_station') && game.has('shop_force_taro') && !game.has('ch1_done');
  })).toBe(true);
});
