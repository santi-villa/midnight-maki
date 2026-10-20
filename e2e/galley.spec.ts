import { expect, test, type Page } from '@playwright/test';
import { bootExploration, visit } from './helpers/exploration';

/** The physical kitchen end to end: fridge → rice cooker → cutting board (reflex bar) → assembly → pass → a real order is paid. */

const stand = (page: Page, tx: number, ty: number) => page.evaluate(([x, y]) => {
  const w = (window as any).mmDebug.world;
  w.player.stop();
  w.player.teleport(x as number, y as number);
}, [tx, ty]);

const act = (page: Page, station: string, verb: string) => page.evaluate(([s, v]) => (window as any).mmDebug.world.galleyView.act(s, v), [station, verb]);
const held = (page: Page) => page.evaluate(async () => (await import('/src/galley/index.ts' as string)).galley().held('player').map((i: any) => `${i.ing ?? i.recipe}:${i.form ?? 'dish'}`));

async function fromFridge(page: Page, name: RegExp) {
  await stand(page, 1, 3);
  await act(page, 'fridge', 'open');
  await page.locator('.gl-choice', { hasText: name }).click();
}

test('cook sushi in the physical kitchen from the fridge to the pass', async ({ page }) => {
  test.setTimeout(120_000);
  await bootExploration(page);
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await visit(page, 'restaurant', 7, 4);
  await page.evaluate(() => {
    const m = (window as any).mmDebug, g = m.game;
    g.save.inventory = {};
    for (const [k, v] of Object.entries({ rice: 4, nori: 4, cucumber: 4, salmon: 2 })) g.addItem(k, v as number, 'test');
    if (!g.save.recipesKnown.includes('kappa')) g.save.recipesKnown.push('kappa');
    g.save.orders.push({ uid: 9001, recipe: 'kappa', customer: 'bento', reward: 40 });
    m.clock.pause();
  });
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/galley-0-kitchen.png` });

  // the real controls: standing at the fridge, E opens it; at the assembly table only that table's actions show
  await stand(page, 1, 3);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.contextOffer.primary?.id)).toBe('gl:fridge:open');
  await page.keyboard.press('e');
  await expect(page.locator('.gl-fridge')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.gl-fridge')).toHaveCount(0);
  await stand(page, 2, 4);
  expect(await page.evaluate(() => (window as any).mmDebug.world.galleyView.actions().map((a: any) => a.action.id))).toEqual([]);

  // rice → cooker → start → wait → take → hangiri
  await fromFridge(page, /Arroz/);
  expect(await held(page)).toEqual(['rice:raw']);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/galley-1-carry.png` });
  await stand(page, 3, 3);
  await act(page, 'rice', 'put');
  await act(page, 'rice', 'start');
  await page.evaluate(async () => (await import('/src/galley/index.ts' as string)).galley().tick(30));
  await act(page, 'rice', 'take');
  expect(await held(page)).toEqual(['rice:cooked']);
  await stand(page, 4, 3);
  await act(page, 'hangiri', 'put');

  // cucumber → board → reflex bar
  await fromFridge(page, /Pepino/);
  await stand(page, 5, 3);
  await act(page, 'board_1', 'chop');
  await expect(page.locator('.gl-cut')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/galley-2-cut.png` });
  await page.keyboard.press('Space');
  await expect(page.locator('.gl-verdict.show')).toBeVisible();
  await page.waitForTimeout(600);
  await act(page, 'board_1', 'take');
  expect((await held(page))[0]).toMatch(/cucumber:cut/);

  // everything to the assembly table
  await stand(page, 2, 4);
  await act(page, 'assembly', 'put');
  await stand(page, 4, 3);
  await act(page, 'hangiri', 'take');
  await stand(page, 3, 4);
  await act(page, 'assembly', 'put');
  await fromFridge(page, /alga|nori/i);
  await stand(page, 2, 4);
  await act(page, 'assembly', 'put');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/galley-3-assembly.png` });
  await act(page, 'assembly', 'assemble');
  await page.waitForTimeout(2200);
  await act(page, 'assembly', 'take');
  expect((await held(page))[0]).toBe('kappa:dish');

  // the pass pays the real order
  const coins0 = await page.evaluate(() => (window as any).mmDebug.game.coins);
  await stand(page, 7, 3);
  await act(page, 'pass', 'deliver');
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.game.coins)).toBeGreaterThan(coins0);
  expect(await held(page)).toEqual([]);
  expect(await page.evaluate(() => (window as any).mmDebug.errorReports?.length ?? 0)).toBe(0);
});

test('the rice-maker employee walks and stocks the hangiri by itself', async ({ page }) => {
  test.setTimeout(120_000);
  await bootExploration(page);
  await visit(page, 'restaurant', 7, 4);
  await page.evaluate(() => {
    const m = (window as any).mmDebug, g = m.game;
    g.save.inventory = {};
    g.addItem('rice', 8, 'test');
    g.save.restaurant.upgrades.push('rice_big', 'rice_hand');
    m.clock.resume();
  });
  await expect.poll(async () => {
    await page.evaluate(async () => { const g = (await import('/src/galley/index.ts' as string)).galley(); const c = g.station('rice'); if (c.phase === 'cooking') g.tick(30); });
    return page.evaluate(async () => (await import('/src/galley/index.ts' as string)).galley().station('hangiri').items.length);
  }, { timeout: 90_000, intervals: [500] }).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => (window as any).mmDebug.errorReports?.length ?? 0)).toBe(0);
});
