import { expect, test } from '@playwright/test';
import { finishArrival } from './helpers/arrival';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0, sfx: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt.ready').waitFor();
  await page.locator('.tt-prompt').tap();
  await page.locator('.tt.armed').waitFor();
});

test('settings categories preserve changes and expose touch and keyboard controls', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Opciones', exact: true }).tap();
  const panel = page.locator('.settings-panel');
  await expect(panel.getByRole('slider', { name: 'Música', exact: true })).toBeVisible();
  await panel.getByRole('slider', { name: 'Música', exact: true }).evaluate((el: HTMLInputElement) => {
    el.value = '0.35'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await panel.getByRole('tab', { name: 'Controles', exact: true }).tap();
  await expect(panel.getByRole('switch', { name: 'Joystick virtual' })).toBeVisible();
  await expect(panel.locator('.keyboard-settings')).not.toHaveAttribute('open');
  await panel.locator('summary').tap();
  await expect(panel.getByRole('radiogroup', { name: 'Atajo del NoriPhone' })).toBeVisible();
  await panel.getByRole('tab', { name: 'Comodidad', exact: true }).tap();
  await expect(panel.getByRole('radiogroup', { name: 'Tamaño de texto' })).toBeVisible();
  await panel.getByRole('radiogroup', { name: 'Tamaño de texto' }).getByRole('radio', { name: 'Grande', exact: true }).tap();
  await page.waitForTimeout(350);
  const overflow = await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: info.outputPath('ajustes-comodidad.png') });
  await panel.getByRole('tab', { name: 'Sonido', exact: true }).tap();
  await expect(panel.getByRole('slider', { name: 'Música', exact: true })).toHaveValue('0.35');
  await panel.getByRole('button', { name: 'Cerrar', exact: true }).tap();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_settings')!).textScale)).toBe(1.15);
});

test('compact mission and phone remain usable and saves continue in the restaurant', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).tap();
  const picker = page.locator('.save-picker');
  await expect(picker).toBeVisible();
  expect((await picker.boundingBox())!.height).toBeLessThan(700);
  await page.getByText('Partida 1', { exact: true }).tap();
  await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
  await page.getByRole('button', { name: 'Saltar intro ›' }).tap();
  await finishArrival(page);
  // Dismiss real one-time tips so the capture represents normal exploration.
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(700);
    const tip = page.getByRole('button', { name: '¡Entendido!', exact: true });
    if (await tip.isVisible()) await tip.tap();
  }
  const quest = page.locator('.hud-quest');
  await expect(quest).toHaveAttribute('aria-expanded', 'false');
  await expect(quest.locator('.step')).toBeVisible();
  expect((await quest.boundingBox())!.height).toBeLessThan(85);
  await quest.tap(); await expect(quest).toHaveAttribute('aria-expanded', 'true');
  await quest.tap();
  await page.waitForTimeout(350);
  await page.screenshot({ path: info.outputPath('hud-compacto.png') });
  const launcher = page.getByRole('button', { name: 'Abrir NoriPhone', exact: true });
  const bounds = (await launcher.boundingBox())!;
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await launcher.tap();
  const phone = page.getByRole('dialog', { name: 'NoriPhone', exact: true });
  await expect(phone).toBeVisible();
  await expect(phone.getByRole('button', { name: 'Misiones. Historia y objetivos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).mmDebug.clock.paused)).toBe(true);
  await page.waitForTimeout(450);
  await page.screenshot({ path: info.outputPath('noriphone.png') });
  await page.getByRole('button', { name: 'Cerrar NoriPhone', exact: true }).tap();
  await expect(phone).toHaveCount(0);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
  await page.evaluate(() => (window as any).mmDebug.storage.saveGame('manual'));
  await page.reload();
  await page.locator('.tt.ready').waitFor();
  await page.locator('.tt-prompt').tap(); await page.locator('.tt.armed').waitFor();
  await page.getByRole('button', { name: 'Continuar', exact: true }).tap();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world?.zoneId)).toBe('restaurant');
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
  expect(errors).toEqual([]);
});
