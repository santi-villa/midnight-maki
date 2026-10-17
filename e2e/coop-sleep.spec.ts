import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** The day only passes when both players go to bed, and a sign tells when the friend leaves. */
test('the host waits for the guest to sleep, then the day passes for both; leaving shows a sign', async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const a = await ctx.newPage();
  await a.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await a.goto('/?debug&coop-local');
  await a.locator('.tt').click();
  await a.getByRole('button', { name: 'Nueva partida' }).click(); await a.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await a.getByRole('button', { name: 'Comenzar' }).click();
  await a.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(a);
  await a.evaluate(() => (window as any).mmDebug.storage.saveGame('test'));
  const b = await ctx.newPage();
  await b.goto('/?debug&coop-local');
  await b.locator('.tt').click();
  await b.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug?.world?.player && (window as any).mmDebug.game.loaded), { timeout: 30_000 }).toBe(true);
  const code = await a.evaluate(() => (window as any).mmDebug.coop.host());
  await b.evaluate((c) => (window as any).mmDebug.coop.join(c), code);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.mirror.on)).toBe(true);
  await expect(a.locator('.coop-sign', { hasText: 'entró a tu restaurante' })).toBeVisible();

  // the host goes to bed for a night that reaches the morning: the gate waits for the guest
  const day0 = await a.evaluate(() => (window as any).mmDebug.game.save.time.day as number);
  await a.evaluate(() => { (window as any).__gate = import('/src/coop/sleepTogether.ts').then((m) => m.coopSleepGate(8, '07:00', false)).then((ok) => { (window as any).__gateOk = ok; }); });
  await expect(b.locator('.coop-sign', { hasText: 'quiere dormir' })).toBeVisible({ timeout: 10_000 });
  await expect(a.locator('.coop-sign', { hasText: 'Esperando' })).toBeVisible({ timeout: 10_000 });
  await a.waitForTimeout(1500);
  expect(await a.evaluate(() => (window as any).__gateOk)).toBeUndefined();

  // the guest goes to bed too: now the host may sleep, and the guest sleeps through the night
  await b.locator('.coop-sign', { hasText: 'quiere dormir' }).getByRole('button', { name: 'Dormir' }).click();
  await expect.poll(() => a.evaluate(() => (window as any).__gateOk), { timeout: 10_000 }).toBe(true);
  await a.waitForTimeout(2500);
  await a.evaluate(() => { (window as any).mmDebug.game.save.time.day += 1; });   // the host's morning
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.mirror.snap.time.day), { timeout: 20_000 }).toBe(day0 + 1);
  await expect(b.locator('.coop-sign', { hasText: 'Amaneció' })).toBeVisible({ timeout: 30_000 });

  // the host cancels a wait: nothing happens and the guest's sign goes away
  await a.evaluate(() => { (window as any).__gateOk = undefined; (window as any).__gate = import('/src/coop/sleepTogether.ts').then((m) => m.coopSleepGate(8, '07:00', false)).then((ok) => { (window as any).__gateOk = ok; }); });
  await expect(a.locator('.coop-sign', { hasText: 'Esperando' })).toBeVisible({ timeout: 10_000 });
  await a.locator('.coop-sign', { hasText: 'Esperando' }).getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(() => a.evaluate(() => (window as any).__gateOk), { timeout: 10_000 }).toBe(false);
  await expect(b.locator('.coop-sign', { hasText: 'quiere dormir' })).toHaveCount(0, { timeout: 10_000 });

  // the guest leaves: the host sees a sign
  await b.evaluate(() => (window as any).mmDebug.coop.leave());
  await expect(a.locator('.coop-sign', { hasText: 'salió' })).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});
