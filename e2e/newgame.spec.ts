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

test('new game → restaurant → cook first sushi → progress persists', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0, cookStyle: 'board' })));
  await page.goto('/?debug');
  await page.locator('.tt').click(); // first tap reveals the menu
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  // the picture sequence can be skipped, including the letter
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
  await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
  // Pip's original encounter already ran without any NPC interaction.
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
  // the board is a logical 320x240 (landscape) or 220x300 (portrait) table; gestures are real mouse input
  const [BW, BH] = await page.evaluate(() => [(window as any).__board.W, (window as any).__board.H]);
  const pt = async (x: number, y: number) => { const box = (await board.boundingBox())!; return { x: box.x + (x / BW) * box.width, y: box.y + (y / BH) * box.height }; };
  const drag = async (from: [number, number], to: [number, number], steps = 8) => {
    const box = (await board.boundingBox())!, at = (x: number, y: number) => ({ x: box.x + (x / BW) * box.width, y: box.y + (y / BH) * box.height });
    const a = at(...from); await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { const q = at(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps); await page.mouse.move(q.x, q.y); await page.waitForTimeout(12); }
    await page.mouse.up(); await page.waitForTimeout(100);
  };
  const shelf = (i: number, n: number): [number, number] => [BW / 2 + (i - (n - 1) / 2) * Math.min(52, BW / n), 20];
  const matW = Math.min(184, BW - 16), matX = (BW - matW) / 2, sheet = { x: matX + (matW - 150) / 2, y: 62 };
  const rollY = 46 + 108 / 2 - 4;
  // nori onto the mat, then the rice has to be cooked in the pot (Plancha tab) before it can be used
  await drag(shelf(0, 1), [BW / 2, 96]);
  await expect(page.locator('#cook-instruction')).toContainText('Falta hacer arroz');
  await page.getByRole('button', { name: 'Ir a la olla' }).click();
  await page.locator('.gr-pot').click();
  await expect(page.locator('.gr-pot .gr-label')).toContainText(/En su punto/, { timeout: 30_000 });
  await page.locator('.gr-pot').click();
  await page.getByText('Mesa', { exact: true }).first().click();
  // rice ball onto the nori, then real strokes spread it
  await drag(shelf(0, 1), [BW / 2, sheet.y + 38]);
  for (let pass = 0; pass < 3; pass++) for (let row = 0; row < 8; row++) { const y = sheet.y + 5 + row * 9; await drag([sheet.x + 3, y], [sheet.x + 147, y + 2], 14); }
  // at ~93% coverage the rice finishes by itself; otherwise the player confirms it
  if (await page.locator('.cook-steps .s.now').textContent() === 'Arroz') await page.getByRole('button', { name: 'Listo el arroz' }).click({ timeout: 5000 }).catch(() => {});
  await expect(page.locator('.cook-steps .s.now')).toHaveText('Relleno', { timeout: 5000 });
  await drag(shelf(0, 1), [BW / 2, sheet.y + 34]);
  await page.getByRole('button', { name: 'Listo el relleno' }).click();
  // roll slowly, then press and hold
  await drag([BW / 2, 148], [BW / 2, 52], 64);
  const c = await pt(BW / 2, rollY); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
  await expect(page.locator('.cook-steps .s.now')).toHaveText('Porciones', { timeout: 12_000 });
  // cut along the marks, middle first
  for (const m of [0.5, 0.333, 0.167, 0.667, 0.833]) { const x = sheet.x + m * 150; await drag([x, rollY - 16], [x, rollY + 20], 6); }
  await expect(page.locator('.cook-steps .s.now')).toHaveText('Emplatar', { timeout: 8_000 });
  // every piece goes to the plate by hand
  const plateCy = 46 + 108 + Math.round((BH - 154) / 2) + 1;
  for (let i = 0; i < 6; i++) { const gap = Math.min(21, (matW - 20) / 6); await drag([BW / 2 + (i - 2.5) * gap, 46 + 108 * 0.55], [BW / 2 + ((i % 3) - 1) * 24, plateCy + (i < 3 ? -8 : 10)], 6); }
  await page.getByRole('button', { name: 'Servir', exact: true }).click();
  // the dish is handed over as soon as it is judged; leaving the kitchen shows the plated dish
  await expect(page.locator('.cook-progress')).toHaveText('¡Listo!', { timeout: 10_000 });
  await expect(page.locator('.cook canvas.board')).toHaveCount(0, { timeout: 10_000 }); // the verdict shows for a moment, then the dish is handed over
  // with no orders left the kitchen closes by itself ("Por ahora no hay pedidos")
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
