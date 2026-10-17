import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** Two tabs stand in for two players: the guest sees the host's customers and serves them through the host. */
test('a guest sees the host customers, takes the order, carries the plate and delivers it', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const a = await ctx.newPage();
  await a.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await a.goto('/?debug&coop-local');
  await a.locator('.tt').click();
  await a.getByRole('button', { name: 'Nueva partida' }).click(); await a.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await a.getByRole('button', { name: 'Comenzar' }).click();
  await a.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(a);
  await a.evaluate(() => { const { game } = (window as any).mmDebug; game.save.time.period = 1; game.save.time.minutes = 30; });
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.service.tableJobs().find((j: any) => j.phase === 'waiting_order')?.tableId ?? null), { timeout: 150_000, intervals: [5000] }).not.toBeNull();
  await a.evaluate(() => (window as any).mmDebug.storage.saveGame('test'));

  const b = await ctx.newPage();
  await b.goto('/?debug&coop-local');
  await b.locator('.tt').click();
  await b.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug?.world?.player && (window as any).mmDebug.game.loaded), { timeout: 30_000 }).toBe(true);
  const code = await a.evaluate(() => (window as any).mmDebug.coop.host());
  await b.evaluate((c) => (window as any).mmDebug.coop.join(c), code);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.mirror.on)).toBe(true);

  // the guest sees the customer sitting at the table, as the host does
  const tableId = await a.evaluate(() => (window as any).mmDebug.service.tableJobs().find((j: any) => j.phase === 'waiting_order').tableId as string);
  await expect.poll(() => b.evaluate((t) => (window as any).mmDebug.service.tableJobs().some((j: any) => j.tableId === t && j.phase === 'waiting_order'), tableId), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.world.guests.size), { timeout: 15_000 }).toBeGreaterThan(0);
  if (process.env.SHOTS) { await a.screenshot({ path: process.env.SHOTS + '/coop2-host.png' }); await b.screenshot({ path: process.env.SHOTS + '/coop2-guest.png' }); }

  // the guest takes the order: it is written in the host game
  await b.evaluate((t) => (window as any).mmDebug.service.takeOrderAt(t), tableId);
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.game.save.orders.length), { timeout: 10_000 }).toBeGreaterThan(0);
  const uid = await a.evaluate(() => (window as any).mmDebug.game.save.orders[0].uid as number);
  // the host cooks (here: plates) and the guest sees it on the tray
  await a.evaluate((u) => (window as any).mmDebug.service.stagePlate(u, 2, 0), uid);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.trayOrders().length), { timeout: 10_000 }).toBe(1);
  await b.evaluate((u) => (window as any).mmDebug.service.pickupPlate(u), uid);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.carriedOrders().length), { timeout: 10_000 }).toBe(1);
  await b.evaluate((t) => (window as any).mmDebug.service.deliverTo(t), tableId);
  await expect.poll(() => a.evaluate((u) => (window as any).mmDebug.service.plateState(u), uid), { timeout: 10_000 }).toBe('delivered');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.carriedOrders().length), { timeout: 10_000 }).toBe(0);
  await ctx.close();
});
