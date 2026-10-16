import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

/** A bot that plays the prompts like a careful person: taps when the ring meets the circle, releases on the gold mark, picks the right ingredients. */
const BOT = `(() => {
  const w = window; if (w.__bot) return; w.__bot = { held: false, lastTap: 0, lastItem: 0 };
  const fire = (el, type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: w.__botTouch ? 'touch' : 'mouse', isPrimary: true }));
  const step = () => {
    const b = w.__bot, now = performance.now();
    const ring = document.querySelector('.act-ring'), pad = document.querySelector('.act-pad:not(.hold)');
    if (ring && pad) {
      const m = /scale\\(([\\d.]+)\\)/.exec(ring.style.transform || ''); const s = m ? parseFloat(m[1]) : 9;
      if (s <= 1.07 && now - b.lastTap > 450 && ring.style.opacity === '1') { b.lastTap = now; fire(pad, 'pointerdown'); fire(pad, 'pointerup'); }
    }
    const hold = document.querySelector('.act-pad.hold'), fill = document.querySelector('.act-fill'), mark = document.querySelector('.act-mark');
    if (hold && fill && mark) {
      if (b.pad !== hold) { b.pad = hold; b.held = false; }
      const target = parseFloat(mark.style.left) || 80, cur = parseFloat(fill.style.width) || 0;
      if (!b.held && now - b.lastTap > 700) { b.held = true; b.lastTap = now; fire(hold, 'pointerdown'); }
      else if (b.held && cur >= target - 1.2) { b.held = false; b.lastTap = now; fire(hold, 'pointerup'); }
    }
    const item = document.querySelector('.act-item:not(.decoy):not(.empty)');
    if (item && now - b.lastItem > 220) { b.lastItem = now; item.click(); }
    w.__botRaf = requestAnimationFrame(step);
  };
  w.__botRaf = requestAnimationFrame(step);
})()`;

async function boot(page: Page, touch: boolean) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
  await page.evaluate((t) => {
    const g = (window as any).mmDebug.game;
    for (const [k, v] of Object.entries({ rice: 4, nori: 4, cucumber: 4, salmon: 2 })) g.addItem(k, v as number, 'test');
    if (!g.save.recipesKnown.includes('kappa')) g.save.recipesKnown.push('kappa');
    (window as any).__botTouch = t;
  }, touch);
}

for (const [name, size, touch] of [['desktop', { width: 1000, height: 640 }, false], ['phone', { width: 390, height: 780 }, true]] as const) {
  test(`a maki is cooked as an act in the kitchen with ${name} input and pays like any dish`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size); 
    await boot(page, touch);
    const coins0 = await page.evaluate(() => (window as any).mmDebug.game.coins);
    await page.evaluate(() => { void (window as any).mmDebug.kitchen.enterKitchen(-1, 'kappa'); });
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.cookActive)).toBe(true);
    await expect(page.locator('.ks.dock')).toBeVisible();
    await page.evaluate(BOT);
    let sawPot = false, shot = 0;
    for (let i = 0; i < 400; i++) {
      if (await page.locator('.act-final').isVisible().catch(() => false)) break;
      // the rice comes from the pot in the stove tab
      if (await page.locator('.act-go').isVisible().catch(() => false)) {
        sawPot = true;
        await page.locator('.act-go').click();
        await page.locator('.gr-pot').click();
        await expect(page.locator('.gr-pot .gr-label')).toContainText(/En su punto/, { timeout: 40_000 });
        await page.locator('.gr-pot').click();
        await page.getByRole('tab', { name: 'Mesa' }).click().catch(async () => { await page.getByText('Mesa', { exact: true }).first().click(); });
      }
      if (process.env.SHOTS && i % 25 === 0 && shot < 8) await page.screenshot({ path: `${process.env.SHOTS}/act-${name}-${shot++}.png` });
      await page.waitForTimeout(250);
    }
    expect(sawPot).toBe(true);
    await expect(page.locator('.act-final')).toBeVisible();
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/act-${name}-final.png` });
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.game.save.recipesCooked.kappa), { timeout: 8000 }).toBe(1);
    await page.getByRole('button', { name: 'Salir de la cocina' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.cookActive)).toBe(false);
    expect(await page.evaluate(() => (window as any).mmDebug.game.coins)).toBeGreaterThan(coins0);
  });
}
