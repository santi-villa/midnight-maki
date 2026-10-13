import { expect, test } from '@playwright/test';
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`new game can immediately explore the restaurant and resume its first task (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, ambience: 0, sfx: 0, joystick: false })));
    await page.goto('/?debug&st');
    await page.locator('.tt').click();
    await page.getByRole('button', { name: 'Nueva partida' }).click();
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await page.getByRole('button', { name: 'Saltar intro ›' }).click();
    await expect(page.locator('.game-hud .hud-top')).toBeVisible();
    await expect(page.locator('.hud-quest')).toContainText('Hablá con Spicy Beacon');
    await expect(page.locator('.dlg')).toHaveCount(0);
    const initial = await page.evaluate(() => {
      const { world: w, game: g, clock, audio } = (window as any).mmDebug;
      return { zone: w.zoneId, x: w.player.tx, y: w.player.ty, dir: w.player.dir, solid: w.zone.grid.isSolid(w.player.tx, w.player.ty),
        locked: w.inputLocked, paused: clock.paused, done: g.save.quests.done, step: g.save.quests.active.prologue.step, track: audio.currentTrack() };
    });
    expect(initial).toMatchObject({ zone: 'restaurant', x: 8, y: 12, dir: 'up', solid: false, locked: 0, paused: false, step: 0, track: 'restaurant_night' });
    expect(initial.done).not.toContain('prologue');
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.player.ty)).toBeLessThan(initial.y);
    const saved = await page.evaluate(async () => (window as any).mmDebug.storage.saveGame('arrival-test'));
    expect(saved).toBe(true);
    await page.reload();
    await page.locator('.tt').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('.hud-quest')).toContainText('Hablá con Spicy Beacon');
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('restaurant');
    await expect(page.locator('.dlg')).toHaveCount(0);
  });
}

test('a previous plaza save keeps its location and unfinished prologue when continued', async ({ page }) => {
  await page.goto('/?debug&st');
  await page.locator('.tt').waitFor();
  await page.evaluate(async () => {
    const { game, newSave } = await import('/src/core/state.ts');
    const { saveGame } = await import('/src/persistence/storage.ts');
    const save = newSave('Partida anterior');
    save.player.zone = 'plaza'; save.player.x = 15; save.player.y = 22;
    save.flags.arrived = true;
    save.quests.active.prologue = { step: 0, progress: {} }; save.quests.tracked = 'prologue';
    game.load(save);
    if (!(await saveGame('legacy-arrival'))) throw new Error('Fixture could not be saved');
  });
  await page.reload(); await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('plaza');
  await expect(page.locator('.hud-quest')).toContainText('Hablá con Spicy Beacon');
  expect(await page.evaluate(() => (window as any).mmDebug.game.save.quests.done.includes('prologue'))).toBe(false);
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('restaurant', 8, 12, 'up', false));
  await expect(page.locator('.dlg')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).mmDebug.game.has('intro_done'))).toBe(false);
});
