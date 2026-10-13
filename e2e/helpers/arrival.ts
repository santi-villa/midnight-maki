import { expect, type Page } from '@playwright/test';
/** Finish the automatic encounter with real dialogue/choice input; never set story flags. */
export async function finishArrival(page: Page): Promise<string[]> {
  const lines: string[] = [];
  for (let i = 0; i < 450; i++) {
    if (await page.evaluate(() => (window as any).mmDebug.game.has('intro_done'))) {
      await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
      return lines;
    }
    const choice = page.locator('.dlg .choices button').first();
    if (await choice.isVisible()) await choice.click();
    else if (await page.locator('.dlg').isVisible()) {
      const text = await page.locator('.dlg .text').textContent();
      if (text && lines[lines.length - 1] !== text) lines.push(text);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(60);
  }
  throw new Error('Automatic arrival encounter did not finish');
}
