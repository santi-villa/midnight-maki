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
  await page.locator('.dlg').click({ timeout: 15_000 });
  await expect(page.locator('.hud-quest')).toContainText('Entrá a Midnight Maki', { timeout: 15_000 });
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
  await page.locator('.dlg').click({ timeout: 15_000 });
  await expect(page.locator('.hud-quest')).toContainText('Entrá a Midnight Maki', { timeout: 15_000 });
});
