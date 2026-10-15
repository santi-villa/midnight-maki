import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';
const SHOPS = ['bento', 'taro', 'yuki'];
async function begin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug&st');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    g.save.time.day = 4;
    g.addCoins(1000);
    g.save.quests.done = ['prologue'];
    g.save.quests.active = {};
    g.setFlag('intro_done');

    for (const id of ['taro', 'bento', 'yuki']) g.setFlag('met_shop_' + id);
    (window as any).mmDebug.clock.pause();
  });
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('plaza', 26, 20, 'up', false));
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

test('Bento, Taro and Yuki have small closed/transition plaques and no open facade signs', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await begin(page);
  for (const [period, minutes, phase] of [[0, 0, 'closed'], [0, 29.75, 'setup'], [0, 30, 'open'], [1, 10, 'open'], [1, 80, 'open'], [2, 30, 'open'], [3, 59.5, 'open'], [3, 60, 'closing'], [3, 70, 'closed']] as const) {
    await at(page, period, minutes);
    const list = await signs(page);
    expect(list.length).toBe(phase === 'open' ? 0 : 3);
    for (const sign of list) {
      expect(sign.phase).toBe(phase); expect(sign.type).toBe('Image');
      expect(sign.width).toBeLessThanOrEqual(29); expect(sign.height).toBe(11);
      expect(sign.depth).toBeGreaterThan(sign.y + 2);
    }
    const states = await page.evaluate(async () => {
      const { shopGate } = await import('/src/systems/npcs.ts');
      return ['bento', 'taro', 'yuki'].map((id) => shopGate(id).phase);
    });
    expect(states).toEqual(SHOPS.map(() => phase));
  }
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    w.player.teleport(26, 20);
    w.cameras.main.centerOn(w.player.x, w.player.y);
  });
  await page.waitForTimeout(4300);
  await page.screenshot({ path: info.outputPath('taro-closed.png') });
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
    await expect(page.locator('.toast').filter({ hasText: 'Horario: 08:00–23:00' }).last()).toBeVisible();
    await at(page, 0, 30);
    await page.evaluate(async (id) => (await import('/src/ui/shops.ts')).openShop(id), id);
    await expect(page.locator('.panel')).toContainText('Horario: 08:00–23:00');
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
  await expect.poll(async () => (await signs(page)).find(s => s.id === 'taro')?.phase).toBe('closed');
  await page.evaluate(() => (window as any).mmDebug.game.setFlag('shop_shut_taro', false));
  await expect(page.locator('.panel .slot button').first()).toBeEnabled();
  await expect.poll(async () => (await signs(page)).some(s => s.id === 'taro')).toBe(false);
});
