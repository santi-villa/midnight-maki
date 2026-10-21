import { expect, test, type Page } from '@playwright/test';
import { bootExploration, visit } from './helpers/exploration';

async function settings(page: Page) {
  await page.evaluate(async () => (await import('/src/ui/settingsPanel.ts' as string)).openSettings(true));
  await page.getByRole('tab', { name: 'Comodidad', exact: true }).click();
  return page.getByRole('slider', { name: 'Tamaño de la interfaz', exact: true });
}

test('interface size shrinks chrome, persists, and preserves controls across viewports', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const shot = async (name: string) => page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : info.outputPath(`${name}.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await bootExploration(page);
  await visit(page, 'restaurant', 7, 4, 0);
  await page.evaluate(async () => (await import('/src/galley/index.ts' as string)).galley().takeFromFridge('player', 'rice'));
  await expect(page.locator('.gl-tickets')).toBeVisible();
  await shot('hud-100');
  const canvasBefore = await page.locator('#game canvas').boundingBox();
  const hudBefore = await page.locator('.hud-digital').boundingBox();
  let slider = await settings(page);
  await slider.scrollIntoViewIfNeeded();
  await shot('ajustes-100');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', '70%');
  await shot('ajustes-70');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_settings')!).uiScale)).toBe(0.7);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  expect(await page.locator('#game canvas').boundingBox()).toEqual(canvasBefore);
  const hudAfter = await page.locator('.hud-digital').boundingBox();
  expect(hudAfter!.width / hudBefore!.width).toBeCloseTo(0.7, 1);
  const tickets = await page.locator('.gl-tickets').boundingBox();
  const buttons = await page.locator('.hud-buttons').boundingBox();
  expect(tickets!.y).toBeGreaterThanOrEqual(buttons!.y + buttons!.height);
  expect(tickets!.x).toBeCloseTo(buttons!.x, 0);
  await page.waitForTimeout(350);
  await shot('hud-70');

  for (const size of [{ width: 320, height: 640 }, { width: 412, height: 915 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    await page.evaluate(async () => (await import('/src/ui/phone/phone.ts' as string)).closePhone());
    const peek = page.getByRole('button', { name: 'Abrir NoriPhone', exact: true });
    await expect(peek).toBeVisible();
    await peek.tap();
    await expect(page.getByRole('button', { name: 'Cerrar NoriPhone', exact: true })).toBeVisible();
    await page.waitForTimeout(350);
    const phone = await page.locator('.noriphone-device').boundingBox();
    expect(phone!.x).toBeGreaterThanOrEqual(0);
    expect(phone!.y).toBeGreaterThanOrEqual(0);
    expect(phone!.x + phone!.width).toBeLessThanOrEqual(size.width + 1);
    expect(phone!.y + phone!.height).toBeLessThanOrEqual(size.height + 1);
    expect(phone!.x + phone!.width / 2).toBeCloseTo(size.width / 2, 0);
    await shot(`phone-70-${size.width}`);
    await page.getByRole('button', { name: 'Cerrar NoriPhone', exact: true }).tap();
    slider = await settings(page);
    await slider.scrollIntoViewIfNeeded();
    await shot(`ajustes-70-${size.width}`);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).tap();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#game canvas').tap({ position: { x: 180, y: 400 } });
  const joy = page.locator('.game-joystick');
  await expect(joy).toBeVisible();
  const box = await joy.boundingBox();
  await joy.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: box!.x + box!.width / 2 + 20, clientY: box!.y + box!.height / 2 });
  const vector = await page.evaluate(() => (window as any).mmDebug.world.joy);
  expect(vector.x).toBeGreaterThan(0.5);
  expect(Math.abs(vector.y)).toBeLessThan(0.01);
  await joy.dispatchEvent('pointerup', { pointerId: 7 });
  await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    (await import('/src/galley/index.ts' as string)).galley().perform('player', 'fridge', 'return');
    w.player.stop(); w.player.teleport(1, 3); w.galleyView.act('fridge', 'open');
  });
  await expect(page.locator('.gl-fridge')).toBeVisible();
  await shot('heladera-70');
  await page.keyboard.press('Escape');
  await expect(page.locator('.gl-fridge')).toHaveCount(0);

  // A fresh document shares storage, without the boot helper's initialization script.
  const restored = await context.newPage();
  await restored.goto('/?debug');
  await restored.locator('.tt.ready').waitFor();
  expect(await restored.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim())).toBe('0.7');
  const title = await restored.locator('.tt').boundingBox();
  const viewport = restored.viewportSize()!;
  expect(title!.width).toBeCloseTo(viewport.width, 0);
  expect(title!.height).toBeCloseTo(viewport.height, 0);
  await restored.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/portada-70.png` : info.outputPath('portada-70.png') });
  await restored.locator('.tt.ready').click();
  await expect(restored.getByRole('button', { name: 'Nueva partida', exact: true })).toBeVisible();
  await restored.waitForTimeout(500);
  const menu = await restored.locator('.tt-menu').boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(viewport.height + 1);
  await restored.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/menu-70.png` : info.outputPath('menu-70.png') });
  await restored.close();

  slider = await settings(page);
  await page.getByRole('button', { name: 'Restablecer tamaño', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuetext', '100%');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_settings')!).uiScale)).toBe(1);
  expect(errors).toEqual([]);
});
