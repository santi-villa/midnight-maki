import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

async function begin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('.book-page.in .book-text')).toHaveText(/La lluvia golpeaba/, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

test('intro: tap and keyboard advance the lines, and skip closes the letter', async ({ page }) => {
  await begin(page);
  await expect(page.locator('.book-page.in .book-photo')).toBeVisible();
  await page.locator('.book-page.in').click();
  await expect(page.locator('.book-page.in .book-text')).toHaveText(/otro día como cualquier otro/);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-page.in .book-text')).toHaveText(/no estaba buscando una aventura/);

  const close = page.getByRole('button', { name: 'Cerrar carta' });
  for (let i = 0; i < 16 && !(await close.isVisible().catch(() => false)); i++) {
    await page.waitForTimeout(300);
    await page.locator('.book-page.in').click();
  }
  await expect(close).toBeVisible();
  await expect(page.getByText('ofrecerte la posibilidad de hacerte cargo')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await expect(page.locator('.book')).toHaveCount(0);
  await expect(page.locator('.letter-wrap')).toHaveCount(0);
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi', { timeout: 15_000 });
});

test('intro: the picture and the caption fit a wide window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await begin(page);
  const caption = await page.locator('.book-caption').boundingBox();
  const photo = await page.locator('.book-photo').boundingBox();
  expect(caption).toBeTruthy();
  expect(photo).toBeTruthy();
  expect(caption!.y + caption!.height).toBeLessThanOrEqual(720);
  expect(photo!.y).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi', { timeout: 15_000 });
});

for (const [width, height] of [[320, 740], [1280, 720]]) {
  test(`intro text stays inside the illustration and never resizes it (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await begin(page);
    const photo = page.locator('.book-page.in .book-photo');
    const initial = await photo.boundingBox();
    for (let i = 0; i < 3; i++) {
      const box = await photo.boundingBox(); const caption = await page.locator('.book-page.in .book-caption').boundingBox();
      expect(box).toEqual(initial);
      expect(caption!.x).toBeGreaterThanOrEqual(box!.x); expect(caption!.y).toBeGreaterThanOrEqual(box!.y);
      expect(caption!.x + caption!.width).toBeLessThanOrEqual(box!.x + box!.width);
      expect(caption!.y + caption!.height).toBeLessThanOrEqual(box!.y + box!.height);
      expect(await page.locator('.book-page.in .book-caption').evaluate(el => el.parentElement!.className)).toBe('book-pic');
      if (i < 2) { await page.locator('.book-page.in').click(); await page.waitForTimeout(350); }
    }
    await page.screenshot({ path: info.outputPath(`intro-overlay-${width}.png`) });
    await page.getByRole('button', { name: 'Saltar intro ›' }).click();
    await expect(page.locator('.dlg')).toContainText('Adentro hay luz tibia');
    const lines = await finishArrival(page);
    expect(lines.join(' ')).toContain('¡CRASH! El frasco cae');
    await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  });
}
