import { bootExploration, visit } from './helpers/exploration';
import { expect, test, type Page } from '@playwright/test';
const S = '/tmp/claude-0/-home-user-midnight-maki/792fa815-189c-51d5-8f6f-ec0f60ab2861/scratchpad';
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
async function begin(page: Page) { await bootExploration(page); await page.evaluate(() => (window as any).mmDebug.clock.resume()); await expect(page.locator('.hud-digital')).toBeVisible(); }
test('kitchen look', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await begin(page);
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('.coach button').forEach(b => b.click()));
  await visit(page, 'restaurant', 6, 3, 1, 40);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}/kit-1.png` });
  console.log('ERR', JSON.stringify(errors));
});
