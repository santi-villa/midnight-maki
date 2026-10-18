import { bootExploration, visit } from './helpers/exploration';
import { expect, test, type Page } from '@playwright/test';
const SHOPS = ['bento', 'taro', 'yuki'];
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
async function begin(page: Page) {
  await bootExploration(page);
  await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    g.save.time.day = 4; g.addCoins(1000); g.save.quests.done = ['prologue']; g.save.quests.active = {};
    for (const id of ['taro', 'bento', 'yuki']) g.setFlag('met_shop_' + id);
  });
  await visit(page, 'plaza', 26, 20, 1, 40);
}
async function at(page: Page, period: number, minutes: number) {
  await page.evaluate(async ({ period, minutes }) => {
    const g = (window as any).mmDebug.game;
    g.save.time.period = period; g.save.time.minutes = minutes;
    (await import('/src/core/events.ts')).bus.emit('time:changed', { day: g.save.time.day, period });
  }, { period, minutes });
}
async function signs(page: Page) {
  return page.evaluate(() => (window as any).mmDebug.world.shopSigns.filter((s: any) => ['taro', 'bento', 'yuki'].includes(s.getData('shopId')))
    .map((s: any) => ({ id: s.getData('shopId'), phase: s.getData('phase'), width: s.displayWidth, height: s.displayHeight, type: s.type, x: s.x, y: s.y, depth: s.depth })));
}

test('shop shutters follow service phases, animate and replace facade plaques', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await begin(page);
  const levels = () => page.evaluate(() => (window as any).mmDebug.world.shopFacades.map((f: any) => ({ shop: f.shop, level: f.level, target: f.target, width: f.shutter.width, height: f.shutter.height })));
  for (const [period, minutes] of [[0, 0], [0, 28], [0, 30], [1, 40], [2, 59.5], [2, 60], [2, 65], [3, 30], [3, 35]]) {
    await at(page, period, minutes);
    const expected = await page.evaluate(async () => {
      const { shopGate } = await import('/src/systems/npcs.ts');
      return Object.fromEntries(['bento', 'taro', 'yuki', 'library'].map(id => {
        const phase = shopGate(id).phase; return [id, phase === 'open' ? 0 : phase === 'closed' ? 1 : 0.5];
      }));
    });
    await expect.poll(async () => (await levels()).filter(f => f.shop in expected).every(f => Math.abs(f.level - expected[f.shop]) < 0.001)).toBe(true);
    expect(await signs(page)).toEqual([]);
  }
  // Opening is a real intermediate crop, not an instant texture swap.
  await at(page, 0, 30);
  await page.waitForTimeout(100);
  expect((await levels()).some(f => f.level > 0 && f.level < 1)).toBe(true);
  await page.waitForTimeout(500);
  // Frame the actual doorway for open, half-open and closed screenshots.
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world, f = w.shopFacades.find((f: any) => f.shop === 'bento');
    w.cameras.main.stopFollow(); w.cameras.main.setZoom(4); w.cameras.main.centerOn(f.img.x, f.img.y - 30);
  });
  await page.screenshot({ path: 'docs/art/arte/etapa-4/persiana-abierta.png' });
  await at(page, 0, 28); await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/art/arte/etapa-4/persiana-a-medias.png' });
  await at(page, 0, 0); await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/art/arte/etapa-4/persiana-cerrada.png' });
  await page.evaluate(async () => {
    (await import('/src/core/settings.ts')).settings.reduceMotion = true;
  });
  await at(page, 0, 30);
  expect((await levels()).every(f => f.level === 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('a closed shop keeps its door shut and still refuses trade', async ({ page }) => {
  await begin(page);
  for (const id of SHOPS) {
    await at(page, 3, 70);
    const stayed = await page.evaluate(async (id) => {
      const w = (window as any).mmDebug.world;
      const before = w.zoneId;
      const entered = await w.enterZone('shop_' + id, 5, 6, 'up', false);
      return { entered, zone: w.zoneId, before };
    }, id);
    expect(stayed.entered).toBe(false);
    expect(stayed.zone).toBe(stayed.before);
    await expect(page.locator('.toast').filter({ hasText: 'La puerta está cerrada' }).last()).toBeVisible();
    await page.evaluate(async (id) => (await import('/src/ui/shops.ts')).openShop(id), id);
    await expect(page.locator('.panel')).toHaveCount(0);
    const hours = id === 'taro' ? '08:00–22:00' : '08:00–20:00';
    await expect(page.locator('.toast').filter({ hasText: `Horario: ${hours}` }).last()).toBeVisible();
    await at(page, 0, 30);
    await page.evaluate(async (id) => (await import('/src/ui/shops.ts')).openShop(id), id);
    await expect(page.locator('.panel')).toContainText(`Horario: ${hours}`);
    await expect(page.locator('.panel .slot button').first()).toBeEnabled();
    await page.keyboard.press('Escape');
  }
});

test('purchase and sale callbacks recheck service; open menus react to closure and reopening', async ({ page }) => {
  await begin(page); await at(page, 0, 30);
  await page.evaluate(async () => (await import('/src/ui/shops.ts')).openShop('taro'));
  const rice = page.locator('.panel .slot').filter({ hasText: /Arroz/ }).first();
  // A queued click must not buy after a silent clock change, even before any UI refresh.
  const buyButton = await rice.getByRole('button', { name: 'Comprar', exact: true }).elementHandle();
  const before = await page.evaluate(() => ({ coins: (window as any).mmDebug.game.coins, rice: (window as any).mmDebug.game.count('rice') }));
  await page.evaluate(() => { (window as any).mmDebug.game.save.time.period = 3; (window as any).mmDebug.game.save.time.minutes = 60; });
  await buyButton!.evaluate((el: HTMLButtonElement) => el.click());
  const after = await page.evaluate(() => ({ coins: (window as any).mmDebug.game.coins, rice: (window as any).mmDebug.game.count('rice') }));
  expect(after).toEqual(before);
  await at(page, 0, 30);
  await page.locator('.panel .tab').filter({ hasText: /^Vender$/ }).click();
  const sellButton = await page.locator('.panel .slot').filter({ hasText: /Arroz/ }).first().getByRole('button', { name: 'Vender', exact: true }).elementHandle();
  await page.evaluate(() => { (window as any).mmDebug.game.save.time.period = 3; (window as any).mmDebug.game.save.time.minutes = 60; });
  await sellButton!.evaluate((el: HTMLButtonElement) => el.click());
  expect(await page.evaluate(() => ({ coins: (window as any).mmDebug.game.coins, rice: (window as any).mmDebug.game.count('rice') }))).toEqual(before);
  await at(page, 0, 30);
  await page.evaluate(() => (window as any).mmDebug.game.setFlag('shop_shut_taro'));
  await expect(page.locator('.panel .slot button').first()).toBeDisabled();
  await expect(page.locator('.panel')).toContainText('hoy no abre');
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.shopFacades.find((f: any) => f.shop === 'taro')?.target)).toBe(1);
  await page.evaluate(() => (window as any).mmDebug.game.setFlag('shop_shut_taro', false));
  await expect(page.locator('.panel .slot button').first()).toBeEnabled();
  await expect.poll(async () => (await signs(page)).some(s => s.id === 'taro')).toBe(false);
});
