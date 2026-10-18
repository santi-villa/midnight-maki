import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** Two tabs stand in for two players: the guest sees the host's customers and serves them through the host. */
test('a guest sees the host customers, takes the order, carries the plate and delivers it', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const a = await ctx.newPage();
  await a.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await a.goto('/?debug&coop-local');
  await a.locator('.tt.ready').click(); await a.locator('.tt.armed').waitFor();
  await a.getByRole('button', { name: 'Nueva partida' }).click(); await a.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await a.getByRole('button', { name: 'Comenzar' }).click();
  await a.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(a);
  await a.evaluate(() => { const { game } = (window as any).mmDebug; game.save.time.period = 1; game.save.time.minutes = 30; });
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.service.tableJobs().find((j: any) => j.phase === 'waiting_order')?.tableId ?? null), { timeout: 150_000, intervals: [5000] }).not.toBeNull();
  await a.evaluate(() => (window as any).mmDebug.storage.saveGame('test'));

  const b = await ctx.newPage();
  await b.goto('/?debug&coop-local');
  await b.locator('.tt.ready').click(); await b.locator('.tt.armed').waitFor();
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

  // the host's customers speak: the guest sees the same bubble
  const guestKey = await a.evaluate(() => [...(window as any).mmDebug.world.guests.keys()][0] as string);
  await a.evaluate((k) => (window as any).mmDebug.world.sayLine('guest:' + k, 'Hola desde el salón', 4), guestKey);
  await expect.poll(() => b.evaluate((k) => (window as any).mmDebug.world.guests.get(k)?.actor.bubble?.text ?? '', guestKey), { timeout: 10_000 }).toContain('Hola desde el salón');

  // the guest takes the order: it is written in the host game
  await b.evaluate((t) => (window as any).mmDebug.service.takeOrderAt(t), tableId);
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.game.save.orders.length), { timeout: 10_000 }).toBeGreaterThan(0);
  const uid = await a.evaluate(() => (window as any).mmDebug.game.save.orders[0].uid as number);
  // the guest starts cooking in the host kitchen: the host's ingredients are spent, and given back when the dish is dropped
  const stock = await a.evaluate(async (uid) => {
    const g = (window as any).mmDebug.game, order = g.save.orders.find((o: any) => o.uid === uid);
    const { RECIPES_BY_ID } = await import('/src/data/recipes.ts');
    const ingredients = Object.entries(RECIPES_BY_ID[order.recipe].ingredients);
    g.save.pantry = {}; g.save.inventory = Object.fromEntries(ingredients.map(([id, qty]) => [id, qty + 3]));
    const [id, qty] = ingredients[0]; return { id, qty, before: g.countUsable(id) };
  }, uid);
  await expect.poll(() => b.evaluate(id => (window as any).mmDebug.mirror.snap.pantry[id] ?? 0, stock.id), { timeout: 10_000 }).toBe(stock.before);
  await b.evaluate((u) => { void (window as any).mmDebug.kitchen.cookOrder(u); }, uid);
  await expect(b.locator('.ks')).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => a.evaluate(id => (window as any).mmDebug.game.countUsable(id), stock.id), { timeout: 10_000 }).toBe(stock.before - stock.qty);
  await b.locator('.ks .close-x').click();
  await b.locator('.ks .close-x').click();
  await expect(b.locator('.ks')).toHaveCount(0);
  await expect.poll(() => a.evaluate(id => (window as any).mmDebug.game.countUsable(id), stock.id), { timeout: 10_000 }).toBe(stock.before);
  // a finished dish arrives at the host tray with its quality
  await b.evaluate((u) => { const m = (window as any).mmDebug.mirror; m.ask('cookTake', { uid: u }); setTimeout(() => m.ask('plate', { uid: u, q: 2, b: 0 }), 900); }, uid);
  await expect.poll(() => a.evaluate((u) => (window as any).mmDebug.service.plateState(u), uid), { timeout: 10_000 }).toBe('plated');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.trayOrders().length), { timeout: 10_000 }).toBe(1);
  await b.evaluate((u) => (window as any).mmDebug.service.pickupPlate(u), uid);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.carriedOrders().length), { timeout: 10_000 }).toBe(1);
  await b.evaluate((t) => (window as any).mmDebug.service.deliverTo(t), tableId);
  await expect.poll(() => a.evaluate((u) => (window as any).mmDebug.service.plateState(u), uid), { timeout: 10_000 }).toBe('delivered');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.service.carriedOrders().length), { timeout: 10_000 }).toBe(0);
  await ctx.close();
});
