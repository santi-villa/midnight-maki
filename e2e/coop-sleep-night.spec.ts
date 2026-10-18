import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** The real bed flow: the host's night waits for the guest, then both sleep and wake on the next day. */
test('a night that reaches the morning waits for the guest, then the day passes for both', async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const a = await ctx.newPage();
  await a.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await a.goto('/?debug&coop-local');
  await a.locator('.tt.ready').click(); await a.locator('.tt.armed').waitFor();
  await a.getByRole('button', { name: 'Nueva partida' }).click(); await a.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await a.getByRole('button', { name: 'Comenzar' }).click();
  await a.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(a);
  await a.evaluate(() => (window as any).mmDebug.storage.saveGame('test'));
  const b = await ctx.newPage();
  await b.goto('/?debug&coop-local');
  await b.locator('.tt.ready').click(); await b.locator('.tt.armed').waitFor();
  await b.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug?.world?.player && (window as any).mmDebug.game.loaded), { timeout: 30_000 }).toBe(true);
  const code = await a.evaluate(() => (window as any).mmDebug.coop.host());
  await b.evaluate((c) => (window as any).mmDebug.coop.join(c), code);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.mirror.on)).toBe(true);
  await expect(a.locator('.coop-sign', { hasText: 'entró a tu restaurante' })).toBeVisible();

  // the host goes to bed for a night that reaches the morning: the gate waits for the guest
  const day0 = await a.evaluate(() => (window as any).mmDebug.game.save.time.day as number);
  await a.evaluate(() => { const g = (window as any).mmDebug.game; g.save.time.period = 3; g.save.time.minutes = 5; (window as any).__gate = import('/src/systems/sleep.ts').then((m) => m.sleepNow({ hours: 10 })).then(() => { (window as any).__gateOk = 'done'; }); });
  await expect(b.locator('.coop-sign', { hasText: 'quiere dormir' })).toBeVisible({ timeout: 10_000 });
  await expect(a.locator('.coop-sign', { hasText: 'Esperando' })).toBeVisible();
  await b.locator('.coop-sign', { hasText: 'quiere dormir' }).getByRole('button', { name: 'Dormir' }).click();
  await expect(a.getByText('Fin del día')).toBeVisible({ timeout: 15_000 });
  await expect(b.locator('.fade.on')).toHaveCount(1, { timeout: 15_000 });
  await a.getByRole('button', { name: 'Dormir' }).click();
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.game.save.time.day), { timeout: 30_000 }).toBe(day0 + 1);
  await expect(b.locator('.coop-sign', { hasText: 'Amaneció' })).toBeVisible({ timeout: 40_000 });
  await ctx.close();
});
