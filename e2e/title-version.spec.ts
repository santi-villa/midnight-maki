import { expect, test } from '@playwright/test';

test('the title screen shows which build is running', async ({ page }) => {
  await page.goto('/');
  const v = page.locator('.tt-version');
  await expect(v).toBeVisible({ timeout: 20_000 });
  await expect(v).toHaveText(/^v\d+\.\d+\.\d+ · /);
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/title-version.png' });
});
