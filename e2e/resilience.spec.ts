import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

async function begin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0.5 }));
    const play = HTMLMediaElement.prototype.play;
    (window as any).audioElements = new Set<HTMLMediaElement>();
    (window as any).blockRain = 0;
    (window as any).rainAttempts = 0;
    HTMLMediaElement.prototype.play = function () {
      (window as any).audioElements.add(this);
      if (this.src.includes('rain_window')) {
        (window as any).rainAttempts++;
        if ((window as any).blockRain-- > 0) return Promise.reject(new DOMException('Autoplay restricted', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });
  await page.goto('/?debug&st');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('.book-page.in .book-text')).toHaveText(/La lluvia golpeaba/);
}

async function ambience(page: Page, level: number) {
  await page.evaluate(async (level) => {
    const { settings } = await import('/src/core/settings.ts');
    const { bus } = await import('/src/core/events.ts');
    settings.ambience = level;
    bus.emit('settings:changed', {});
  }, level);
}

test('mobile audio retries stay handled, recover, and cannot resurrect stopped intro layers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await begin(page);
  await ambience(page, 0);
  await expect.poll(() => page.evaluate(() => [...(window as any).audioElements].find((el: any) => el.src.includes('rain_window'))?.paused)).toBe(true);
  await page.evaluate(() => { (window as any).blockRain = 2; });
  await ambience(page, 0.5);
  await expect.poll(() => page.evaluate(() => (window as any).rainAttempts)).toBe(2);
  await page.locator('.book-page.in').click();
  await expect.poll(() => page.evaluate(() => (window as any).rainAttempts)).toBe(3);
  await page.waitForTimeout(300);
  await page.locator('.book-page.in').click();
  await expect.poll(() => page.evaluate(() => [...(window as any).audioElements].find((el: any) => el.src.includes('rain_window'))?.paused)).toBe(false);
  expect(errors).toEqual([]);
  await expect(page.locator('.toast').filter({ hasText: 'Algo raro' })).toHaveCount(0);
  // Queue another restricted play, then skip before a successful gesture.
  await ambience(page, 0);
  await page.waitForTimeout(300);
  await page.evaluate(() => { (window as any).blockRain = 20; });
  await ambience(page, 0.5);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await expect(page.locator('.book')).toHaveCount(0);
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => [...(window as any).audioElements].filter((el: any) => el.getAttribute('src')?.includes('/audio/intro/') && !el.paused).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('IndexedDB abort is reported as failed, preserves progress and successfully retries', async ({ page }) => {
  await begin(page);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  const result = await page.evaluate(async () => {
    const { game, storage } = (window as any).mmDebug;
    const oldCoins = game.coins;
    const saved = await storage.saveGame('baseline');
    game.addCoins(73);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      const req = original.call(this, value, key);
      if (key === 'main') this.transaction.abort();
      return req;
    };
    let failed;
    try { failed = await storage.saveGame('abort-test'); }
    finally { IDBObjectStore.prototype.put = original; }
    const dirty = game.dirty;
    const oldSave = await storage.loadGame();
    const retry = await storage.saveGame('retry');
    const loaded = await storage.loadGame();
    return { saved, failed, dirty, previousCoins: oldSave.coins, oldCoins, retry, restoredCoins: loaded.coins, currentCoins: game.coins };
  });
  expect(result).toMatchObject({ saved: true, failed: false, dirty: true, retry: true });
  expect(result.previousCoins).toBe(result.oldCoins);
  expect(result.restoredCoins).toBe(result.currentCoins);
  await expect(page.locator('.toast').filter({ hasText: 'No se pudo guardar' })).toBeVisible();
  await page.reload();
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.game.coins)).toBe(result.currentCoins);
});

test('manual save never announces failed writes; failed imports roll back and successful imports preserve their location', async ({ page }) => {
  await begin(page);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  const originalCoins = await page.evaluate(async () => {
    const d = (window as any).mmDebug;
    await d.storage.saveGame('baseline');
    d.game.addCoins(5);
    (await import('/src/ui/settingsPanel.ts')).openSettings(true);
    return d.game.coins;
  });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).originalPut = original;
    IDBObjectStore.prototype.put = function(value, key) {
      const req = original.call(this, value, key);
      if (key === 'main') this.transaction.abort();
      return req;
    };
  });
  await page.getByRole('button', { name: 'Guardar ahora' }).click();
  await expect(page.locator('.toast').filter({ hasText: 'No se pudo guardar' })).toBeVisible();
  await expect(page.locator('.toast').filter({ hasText: /^Partida guardada\.$/ })).toHaveCount(0);
  const code = await page.evaluate(async () => {
    const { saveCode } = await import('/src/persistence/storage.ts');
    const game = (window as any).mmDebug.game;
    const previous = game.save;
    game.save = structuredClone(previous);
    game.save.coins = 777;
    game.save.player.zone = 'beach'; game.save.player.x = 8; game.save.player.y = 9;
    game.save.flags.unlock_beach = true;
    const code = saveCode();
    game.save = previous;
    return code;
  });
  await page.getByRole('button', { name: 'Pegar código', exact: true }).click();
  await page.locator('textarea').fill(code);
  await page.getByRole('button', { name: 'Restaurar desde el código' }).click();
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => (window as any).mmDebug.game.coins)).toBe(originalCoins);
  expect(await page.evaluate(() => (window as any).mmDebug.game.dirty)).toBe(true);
  await expect(page.locator('.panel')).toContainText('Ajustes');
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).originalPut; });
  await page.getByRole('button', { name: 'Restaurar desde el código' }).click();
  await expect(page.locator('.tt.ready')).toBeVisible({ timeout: 15_000 });
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('beach');
  expect(await page.evaluate(() => (window as any).mmDebug.game.coins)).toBe(777);
  expect(await page.evaluate(() => ({ x: (window as any).mmDebug.game.save.player.x, y: (window as any).mmDebug.game.save.player.y }))).toEqual({ x: 8, y: 9 });
});
