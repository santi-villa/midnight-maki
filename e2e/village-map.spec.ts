import { expect, test } from '@playwright/test';
test.use({ baseURL: process.env.VILLAGE_TEST_URL ?? 'http://localhost:5174', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('approved village renders in play and walking crosses real streets and interior doors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0, sfx: 0 })));
  await page.goto('/?debug&st');
  await page.locator('.tt.ready').waitFor();
  await page.evaluate(async () => {
    // Use the modules already loaded by the app, including Vite's current HMR query.
    const loaded = (path: string) => performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === path) ?? path;
    const { newSave } = await import(loaded('/src/core/state.ts'));
    const { continueGame } = await import(loaded('/src/core/flow.ts'));
    const s = newSave('Sofi'); Object.assign(s.player, { zone: 'garden', x: 35, y: 24 });
    delete s.flags.village_layout; s.coins = 721; s.inventory.wood = 9;
    s.time = { day: 3, period: 1, minutes: 20 }; s.restaurant.level = 7;
    for (const f of ['intro_done', 'unlock_beach', 'unlock_forest', 'unlock_garden', 'unlock_station', 'unlock_lighthouse_view', 'lighthouse_open', 'market_visited', 'garden_night', 'ch1_started']) s.flags[f] = true;
    s.quests.done = ['prologue'];
    document.querySelector('.tt')!.remove(); await continueGame(s);
    const debug = (window as any).mmDebug;
    debug.clock.pause(); debug.world.onEnterZone = async () => {};
  });
  expect(await page.evaluate(() => {
    const { save } = (window as any).mmDebug.game;
    return { zone: save.player.zone, x: save.player.x, y: save.player.y, coins: save.coins, wood: save.inventory.wood, done: save.quests.done };
  })).toMatchObject({ zone: 'garden', x: 21, y: 14, coins: 721, wood: 9, done: ['prologue'] });
  for (const [zone, x, y] of [['plaza', 23, 16], ['residential', 20, 16], ['harbor', 24, 8], ['garden', 20, 14], ['beach', 18, 6]] as const) {
    await page.evaluate(async ({ zone, x, y }) => {
      const w = (window as any).mmDebug.world;
      await w.enterZone(zone, x, y, 'down', false, true);
      w.cameras.main.stopFollow(); w.cameras.main.setZoom(2.3); w.cameras.main.centerOn(x * 16, y * 16);
      document.getElementById('ui')!.style.display = 'none';
    }, { zone, x, y });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/villa-nori-${zone}.png` });
  }
  // Use the actor's real movement and the scene's walk-door handler at a district seam.
  await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    const loaded = performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === '/src/data/zones.ts')!;
    const { ZONES } = await import(loaded);
    const d = ZONES.plaza.doors.find(d => d.to === 'residential')!;
    await w.enterZone('plaza', d.x - 2, d.y, 'right', false, true);
    if (!w.player.walkTo(w.zone.grid, d.x, d.y)) throw new Error('No walking route to residential bridge');
    (window as any).mmDebug.clock.resume();
  });
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('residential');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('residential');
  // Door entry and exit must both use the new restaurant address.
  await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    const loaded = performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === '/src/data/zones.ts')!;
    const { ZONES } = await import(loaded);
    const d = ZONES.plaza.doors.find(d => d.to === 'restaurant')!;
    await w.enterZone('plaza', d.x, d.y + 2, 'up', false, true);
    if (!w.player.walkTo(w.zone.grid, d.x, d.y)) throw new Error('No route to restaurant threshold');
  });
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
  await page.waitForFunction(() => !(window as any).mmDebug.world.transitioning && !(window as any).mmDebug.world.inputLocked);
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    if (!w.player.walkTo(w.zone.grid, 8, 13)) throw new Error('Restaurant exit blocked');
  });
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('plaza');
  await page.waitForFunction(() => !(window as any).mmDebug.world.transitioning);
  await page.evaluate(async () => {
    const { world: w, game, clock } = (window as any).mmDebug;
    clock.pause(); game.save.time.period = 3;
    await w.enterZone('plaza', 24, 17, 'down', false, true);
    w.cameras.main.stopFollow(); w.cameras.main.setZoom(2.3); w.cameras.main.centerOn(23 * 16, 16 * 16);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/villa-nori-noche.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { world: w, game } = (window as any).mmDebug; game.save.time.period = 1;
    await w.enterZone('plaza', 24, 17, 'down', false, true);
    document.getElementById('ui')!.style.display = '';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/villa-nori-movil.png' });
  expect(errors).toEqual([]);
});
