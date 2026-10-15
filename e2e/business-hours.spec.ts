import { expect, test } from '@playwright/test';
import { finishArrival } from './helpers/arrival';

for (const width of [390, 1280]) {
  test(`08:00–23:00 matches HUD, counters, purchases, library and saved progress (${width}px)`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
    await page.goto('/?debug&st'); await page.locator('.tt').click();
    await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {}); await page.getByRole('button', { name: 'Comenzar' }).click();
    await page.getByRole('button', { name: 'Saltar intro ›' }).click(); await finishArrival(page);
    await page.evaluate(() => {
      const d = (window as any).mmDebug, g = d.game;
      g.save.time.day = 4; g.save.quests.done = ['prologue']; g.setFlag('unlock_beach'); g.addCoins(2000);
      for (const id of ['taro', 'bento', 'yuki', 'sumi', 'nami']) g.setFlag('met_shop_' + id);
      d.clock.pause();
    });
    const at = async (period: number, minutes: number) => page.evaluate(async ({ period, minutes }) => {
      const d = (window as any).mmDebug; d.game.save.time.period = period; d.game.save.time.minutes = minutes;
      (await import('/src/core/events.ts')).bus.emit('time:changed', { day: d.game.save.time.day, period });
    }, { period, minutes });
    for (const [period, minutes, text, open] of [[0, 29.75, '07:59', false], [0, 30, '08:00', true], [1, 30, '14:00', true], [2, 15, '18:30', true], [3, 59.5, '22:59', true], [3, 60, '23:00', false], [3, 90, '00:00', false]] as const) {
      await at(period, minutes); await expect(page.locator('.hud-digital')).toHaveText(text);
      const states = await page.evaluate(async () => {
        const { SHOP_PLACES, restaurantPhase } = await import('/src/systems/schedule.ts');
        const { shopGate } = await import('/src/systems/npcs.ts');
        const t = (window as any).mmDebug.game.save.time;
        return [...SHOP_PLACES.map(p => shopGate(p.id).open), restaurantPhase(t.period, t.minutes) === 'open'];
      });
      expect(states).toEqual(states.map(() => open));
    }
    await at(2, 15);
    await page.evaluate(async () => { const w = (window as any).mmDebug.world; await w.enterZone('shop_taro', 5, 6, 'up', false); (await import('/src/ui/shops.ts')).openShop('taro'); });
    const rice = page.locator('.panel .slot').filter({ hasText: /Arroz/ }).first();
    const before = await page.evaluate(() => ({ coins: (window as any).mmDebug.game.coins, rice: (window as any).mmDebug.game.count('rice') }));
    await rice.getByRole('button', { name: 'Comprar', exact: true }).click();
    const bought = await page.evaluate(() => ({ coins: (window as any).mmDebug.game.coins, rice: (window as any).mmDebug.game.count('rice') }));
    expect(bought.rice).toBe(before.rice + 1); expect(bought.coins).toBeLessThan(before.coins);
    await at(3, 59.5); await expect(rice.getByRole('button', { name: 'Comprar', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`taro-open-2259-${width}.png`) });
    await at(3, 60); await expect(page.locator('.panel .slot button').first()).toBeDisabled();
    await expect(page.locator('.panel')).toContainText('08:00–23:00'); await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const d = (window as any).mmDebug; await d.world.enterZone('library', 6, 7, 'up', false);
      d.game.save.quests.active.sq_rigg_book = { step: 0, progress: {} };
      const def = d.world.zone.def.interact.find((i: any) => i.action === 'library');
      d.world.onInteract({ kind: 'interact', def, label: '' });
    });
    await expect(page.locator('.dlg')).toHaveCount(0);
    expect(await page.evaluate(() => !!(window as any).mmDebug.game.flag('rigg_book_found'))).toBe(false);
    await page.evaluate(() => (window as any).mmDebug.clock.newDay()); await at(0, 30);
    await page.evaluate(() => {
      const d = (window as any).mmDebug, def = d.world.zone.def.interact.find((i: any) => i.action === 'library');
      d.world.onInteract({ kind: 'interact', def, label: '' });
    });
    await expect(page.locator('.dlg')).toContainText('Mapas de la costa'); await page.locator('.dlg').click();
    await expect(page.locator('.dlg')).toHaveCount(0);
    const saved = await page.evaluate(async () => {
      const d = (window as any).mmDebug; const ok = await d.storage.saveGame('business-hours'); const read = await d.storage.loadGame();
      return { ok, coins: read.coins, rice: read.inventory.rice, found: read.flags.rigg_book_found, zone: read.player.zone };
    });
    expect(saved).toMatchObject({ ok: true, coins: bought.coins, rice: bought.rice, found: true, zone: 'library' });
    await page.reload(); await page.locator('.tt').click(); await page.getByRole('button', { name: 'Continuar' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('library');
    await page.evaluate(async () => { const w = (window as any).mmDebug.world; await w.enterZone('plaza', 14, 21, 'up', false); w.player.walkTo(w.zone.grid, 11, 24); });
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('library');
    expect(errors).toEqual([]);
  });
}
