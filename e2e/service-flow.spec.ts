import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** Serving feels like part of the room: coins pop beside the counter and the guest talks in a bubble, with no windows. */
test('a paid meal shows a bubble and a coin pop and never opens a dialogue window', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');

  // before 8:00 the restaurant is closed: no customer, so no arrow for "serve orders"
  const early = await page.evaluate(async () => {
    const { game } = (window as any).mmDebug;
    game.save.time.period = 0; game.save.time.minutes = 5;
    const { serviceGuide } = await import('/src/restaurant/service.ts');
    return serviceGuide();
  });
  expect(early).toBeNull();

  // coins pop beside the counter with the real amount
  await page.evaluate(() => (window as any).mmDebug.game.addCoins(12, 'test'));
  await expect(page.locator('.hud-coins .coin-pop')).toHaveText(/\+12/);

  // open the doors and let a guest walk in and sit
  await page.evaluate(() => { const { game } = (window as any).mmDebug; game.save.time.period = 1; game.save.time.minutes = 30; });
  await expect.poll(() => page.evaluate(async () => (await import('/src/restaurant/service.ts')).tableJobs().find((j: any) => j.phase === 'waiting_order')?.tableId ?? null), { timeout: 90_000 }).not.toBeNull();
  const guide = await page.evaluate(async () => (await import('/src/restaurant/service.ts')).serviceGuide());
  expect(guide).toMatchObject({ tableId: expect.any(String) });

  // take the order, plate it, deliver it
  const tableId = (guide as any).tableId as string;
  await page.evaluate(async (t) => {
    const s = await import('/src/restaurant/service.ts');
    s.takeOrderAt(t);
    const uid = (window as any).mmDebug.game.save.orders.find((o: any) => !o.special)?.uid;
    s.stagePlate(uid, 2, 0); s.pickupPlate(uid); s.deliverTo(t);
  }, tableId);
  const coinsBefore = await page.evaluate(() => (window as any).mmDebug.game.coins);
  // eating finishes by itself: the guest says something and the coins arrive without any dialogue window
  let sawBubble = false, sawDialogue = false;
  for (let i = 0; i < 400; i++) {
    if (await page.locator('.dlg').isVisible().catch(() => false)) sawDialogue = true;
    const coins = await page.evaluate(() => (window as any).mmDebug.game.coins);
    if (coins > coinsBefore) { sawBubble = await page.evaluate(() => (window as any).mmDebug.world.guests && [...(window as any).mmDebug.world.guests.values()].some((g: any) => g.actor.bubble)); break; }
    await page.waitForTimeout(500);
  }
  await expect(page.locator('.hud-coins .coin-pop')).toBeVisible();
  expect(sawBubble).toBe(true);
  expect(sawDialogue).toBe(false);
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/service-flow.png' });
});
