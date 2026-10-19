import { bootExploration } from './helpers/exploration';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
async function begin(page: Page) {
  await bootExploration(page);
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await expect(page.locator('.hud-digital')).toBeVisible();
}

test('escape menu matches the wooden two-column board', async ({ page }) => {
  await begin(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('Escape');
  const board = page.locator('.pause-sheet');
  await expect(board).toBeVisible();
  await expect(board).toContainText('El juego está en pausa.');
  await expect(board.getByRole('button', { name: 'Reanudar' })).toBeVisible();
  await expect(board.getByRole('button', { name: 'Guardar y salir' })).toBeVisible();
  const guardar = await board.getByRole('button', { name: 'Guardar', exact: true }).boundingBox();
  const cargar = await board.getByRole('button', { name: /Cargar/ }).boundingBox();
  expect(guardar && cargar).toBeTruthy();
  expect(Math.abs(guardar!.y - cargar!.y)).toBeLessThan(8);
  expect(cargar!.x).toBeGreaterThan(guardar!.x + guardar!.width - 4);
  await expect(board.getByRole('button', { name: /Mochila/ })).toHaveCount(0);
  const sheet = await board.boundingBox();
  expect(sheet!.width).toBeLessThan(520);
  expect(sheet!.x).toBeGreaterThan(200);
  await page.screenshot({ path: 'docs/art/pausa/pc.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await board.boundingBox();
  expect(narrow!.x).toBeGreaterThanOrEqual(0);
  expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(390);
  const clipped = await board.locator('.pause-item span').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  expect(clipped).toEqual([]);
  await page.screenshot({ path: 'docs/art/pausa/menu-390.png' });

  await expect(board.getByRole('button', { name: 'Descansar un rato' })).toBeVisible();
  await board.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.locator('.panel-head', { hasText: 'Ajustes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).mmDebug.clock.paused)).toBe(false);
});

test.describe('touch pause', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  test('pause icon fits small screens and actually stops and resumes exploration', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await begin(page);
    for (const [width, height] of [[320, 740], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const pause = page.getByRole('button', { name: /^Pausa/ });
      await expect(pause).toBeVisible();
      const rect = await pause.boundingBox(), status = await page.locator('.hud-status-wrap').boundingBox();
      expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.x).toBeGreaterThanOrEqual(status!.x + status!.width);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width); expect(rect!.y + rect!.height).toBeLessThanOrEqual(height);
      await page.screenshot({ path: `docs/art/pausa/hud-${width}.png` });
      await pause.tap();
      const board = page.locator('.pause-sheet');
      await expect(board).toBeVisible(); await expect(board).toHaveCount(1);
      expect(await page.evaluate(() => {
        const m = (window as any).mmDebug, before = m.game.save.time.minutes;
        m.clock.tick(10);
        return { paused: m.clock.paused, canAct: m.world.canAct(), unchanged: m.game.save.time.minutes === before };
      })).toEqual({ paused: true, canAct: false, unchanged: true });
      if (width === 390) await page.screenshot({ path: 'docs/art/pausa/tactil.png' });
      await board.getByRole('button', { name: 'Reanudar' }).tap();
      await expect(board).toHaveCount(0);
      expect(await page.evaluate(() => ({ paused: (window as any).mmDebug.clock.paused, canAct: (window as any).mmDebug.world.canAct() }))).toEqual({ paused: false, canAct: true });
    }
    const before = await page.evaluate(() => (window as any).mmDebug.game.save.time.minutes);
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.game.save.time.minutes)).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });
});
