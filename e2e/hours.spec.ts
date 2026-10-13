import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

/** Advances dialogue until it closes (or a choice appears, which is answered with the first option). */
async function advance(page: Page, rounds = 120) {
  await page.locator('.dlg').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  let idle = 0;
  for (let i = 0; i < rounds && idle < 6; i++) {
    const choice = page.locator('.dlg .choices button').first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
      idle = 0;
    } else if (await page.locator('.dlg').isVisible().catch(() => false)) {
      await page.locator('.dlg').click();
      idle = 0;
    } else idle++;
    await page.waitForTimeout(100);
  }
}

async function live(page: Page) {
  return page.evaluate(async () => {
    const service = await import('/src/restaurant/service.ts');
    const schedule = await import('/src/systems/schedule.ts');
    const g = (window as any).mmDebug.game;
    return {
      guests: service.guestViews().map((v: { phase: string }) => v.phase) as string[],
      phase: schedule.restaurantPhase(g.save.time.period, g.save.time.minutes) as string,
      served: g.save.restaurant.served as number,
      coins: g.coins as number,
      day: g.save.time.day as number,
      orders: g.save.orders.length as number,
    };
  });
}

test('a full day opens, closes, sleeps and can be skipped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug&st');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  // Pip's original encounter already ran without any NPC interaction.
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  await page.keyboard.press('Escape');

  // The prologue leaves us in the restaurant at dusk, which is an open period.
  // Standing here starts the shift. Late night must announce the close.
  await page.waitForTimeout(1500);
  const opened = await live(page);
  expect(opened.phase).toBe('open');
  await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    g.save.time.period = 3;
    g.save.time.minutes = 80;
  });
  await expect.poll(async () => page.locator('.toast').allTextContents().then((t) => t.join(' ')), { timeout: 5000 }).toMatch(/cierra/);

  const saved = await page.evaluate(async () => (window as any).mmDebug.storage.saveGame('hours'));
  expect(saved).toBe(true);

  const beforeSleep = await live(page);
  await page.evaluate(() => (window as any).mmDebug.clock.newDay());
  const morning = await live(page);
  expect(morning.day).toBe(beforeSleep.day + 1);
  expect(morning.phase).toBe('closed');
  expect(morning.guests).toEqual([]);
  expect(morning.coins).toBeGreaterThanOrEqual(beforeSleep.coins);

  await page.waitForTimeout(3000);
  expect((await live(page)).guests).toEqual([]);

  await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    g.save.time.period = 1;
    g.save.time.minutes = 20;
  });
  await expect.poll(async () => (await live(page)).guests.length, { timeout: 25_000 }).toBeGreaterThan(0);
  const serving = await live(page);
  expect(serving.phase).toBe('open');

  // Leaving the clock in the frozen night must not throw or keep the door open.
  await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    g.save.time.period = 3;
    g.save.time.minutes = 90;
  });
  await expect.poll(async () => (await live(page)).phase, { timeout: 4000 }).toBe('closing');
  await page.waitForTimeout(3000);
  const late = await live(page);
  expect(late.phase).toBe('closing');
  expect(late.guests.every((phase) => phase === 'leaving' || phase === 'waiting_food' || phase === 'eating' || phase === 'paying')).toBe(true);

  await page.evaluate(() => {
    (window as any).mmDebug.world.onInteract({ kind: 'interact', def: { id: 'o', x: 7, y: 5, label: '', action: 'orders' }, label: '' });
  });
  await expect(page.locator('.panel')).toContainText('Horario');
  await expect(page.locator('.panel')).toContainText(/Cerrando|Cerrado/);

  await page.evaluate(() => (window as any).mmDebug.clock.newDay());
  const next = await live(page);
  expect(next.phase).toBe('closed');
  expect(next.guests).toEqual([]);
  expect(errors).toEqual([]);
});
