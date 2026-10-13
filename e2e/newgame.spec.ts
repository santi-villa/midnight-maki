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

test('new game → restaurant → cook first sushi → progress persists', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await page.goto('/?debug');
  await page.locator('.tt').click(); // first tap reveals the menu
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  // the picture sequence can be skipped, including the letter
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
  await expect(page.locator('.hud-quest')).toContainText('Hablá con Spicy Beacon');
  // The original encounter is still required; it starts on a deliberate conversation.
  await page.evaluate(() => { (window as any).mmDebug.world.onInteract({ kind: 'npc', id: 'spicy', label: '' }); });
  await advance(page);
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');

  // talk to Spicy (tutorial) by tapping the interact button near him
  await page.evaluate(() => { (window as any).mmDebug.world.onInteract({ kind: 'npc', id: 'spicy', label: '' }); });
  await page.waitForTimeout(300);
  await advance(page);

  // cook the practice order with real gestures
  await page.evaluate(() => { (window as any).mmDebug.world.onInteract({ kind: 'interact', def: { id: 'o', x: 7, y: 5, label: '', action: 'orders' }, label: '' }); });
  await page.locator('.panel .card').filter({ hasText: 'Pedido de práctica' }).getByRole('button', { name: 'Cocinar' }).click();
  const board = page.locator('.cook canvas.board');
  await expect(board).toBeVisible();
  const box = (await board.boundingBox())!;
  const dims = await board.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  const pt = (x: number, y: number) => ({ x: box.x + (x / dims[0]) * box.width, y: box.y + (y / dims[1]) * box.height });
  const dragTo = async (id: string, x: number, y: number) => {
    const src = (await page.locator(`.cook-tray .ing[data-id="${id}"]`).boundingBox())!;
    await page.mouse.move(src.x + 10, src.y + 10);
    await page.mouse.down();
    const p = pt(x, y);
    await page.mouse.move(p.x, p.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(350);
  };
  const swipe = async (x1: number, y1: number, x2: number, y2: number) => {
    const a = pt(x1, y1);
    const b = pt(x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const W = dims[0];
  const matY = Math.round(dims[1] * 0.3);
  await dragTo('nori', W / 2, matY + 50);
  await dragTo('rice', W / 2, matY + 50);
  for (let y = matY + 4; y <= matY + 100; y += 8) await swipe(W / 2 - 100, y, W / 2 + 100, y);
  await dragTo('cucumber', W / 2, matY + 60);
  for (let i = 0; i < 3; i++) await swipe(W / 2, matY + 90, W / 2, matY + 20);
  // The cooking mark comes between rolling and cutting. Tap until it advances.
  for (let i = 0; i < 12 && (await page.locator('.cook-steps .s.now').textContent()) === 'Enrollar'; i++) {
    await board.click();
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.cook-steps .s.now')).toHaveText('Porciones', { timeout: 12_000 });
  for (const f of [0.2, 0.4, 0.6, 0.8]) await swipe(W * f, matY + 10, W * f, matY + 90);
  await page.getByRole('button', { name: 'Servir todo' }).click();
  // the plated dish is shown first; a tap serves it
  await expect(page.locator('.plate-show')).toBeVisible({ timeout: 10_000 });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await page.locator('.plate-show').click();
  await advance(page);

  const state = await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    return { served: g.save.restaurant.served, coins: g.coins };
  });
  expect(state.served).toBe(1);
  expect(state.coins).toBeGreaterThan(120);

  // persist and reload
  await page.evaluate(async () => { await (window as any).mmDebug.storage.saveGame('e2e'); });
  await page.reload();
  await page.locator('.tt').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug?.game?.save?.restaurant?.served)).toBe(1);
});
