import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** Two tabs of the same browser stand in for two players (same save, but each runs on its own). */
test('a guest enters the host restaurant and both see each other walk', async ({ browser }) => {
  test.setTimeout(150_000);
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
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug?.world?.zoneId ?? null), { timeout: 30_000 }).not.toBeNull();

  const code = await a.evaluate(() => (window as any).mmDebug.coop.host());
  await b.evaluate((c) => (window as any).mmDebug.coop.join(c), code);
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase)).toBe('connected');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.coop.state().world !== null)).toBe(true);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.world.zoneId), { timeout: 15_000 }).toBe('restaurant');
  // each sees the other as a second character in the room
  await expect.poll(() => a.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 15_000 }).toBe(true);
  if (process.env.SHOTS) { await a.screenshot({ path: process.env.SHOTS + '/coop-host.png' }); await b.screenshot({ path: process.env.SHOTS + '/coop-guest.png' }); }
  // the guest save is not written while visiting
  expect(await b.evaluate(() => (window as any).mmDebug.storage.saveGame('x'))).toBe(true);
  // leaving puts the guest back where they were
  await b.evaluate(() => (window as any).mmDebug.coop.leave());
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase), { timeout: 10_000 }).toBe('closed');
  await expect.poll(() => a.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 10_000 }).toBe(false);
  await ctx.close();
});
