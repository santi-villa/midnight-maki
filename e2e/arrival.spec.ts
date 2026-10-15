import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`new game automatically meets Pip then explores and resumes the cooking lesson (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, ambience: 0, sfx: 0, joystick: false })));
    await page.goto('/?debug&st');
    await page.locator('.tt').click();
    await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await page.getByRole('button', { name: 'Saltar intro ›' }).click();
    await expect(page.locator('.dlg')).toContainText('Adentro hay luz tibia');
    const lines = await finishArrival(page);
    expect(lines.join(' ')).toContain('¡CRASH! El frasco cae');
    await expect(page.locator('.game-hud .hud-top')).toBeVisible();
    await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
    await expect(page.locator('.dlg')).toHaveCount(0);
    const initial = await page.evaluate(() => {
      const { world: w, game: g, clock, audio } = (window as any).mmDebug;
      return { zone: w.zoneId, x: w.player.tx, y: w.player.ty, dir: w.player.dir, solid: w.zone.grid.isSolid(w.player.tx, w.player.ty),
        locked: w.inputLocked, paused: clock.paused, done: g.save.quests.done, step: g.save.quests.active.prologue.step, track: audio.currentTrack() };
    });
    expect(initial).toMatchObject({ zone: 'restaurant', x: 8, y: 12, dir: 'up', solid: false, locked: 0, paused: false, step: 1, track: 'restaurant_night' });
    expect(initial.done).not.toContain('prologue');
    const key = await page.evaluate(() => {
      const w = (window as any).mmDebug.world;
      const p = w.player;
      return [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, -1, 'ArrowUp']].find(([dx, dy]) => !w.zone.grid.isSolid(p.tx + Number(dx), p.ty + Number(dy)))![2] as string;
    });
    const feet = await page.evaluate(() => ({ x: (window as any).mmDebug.world.player.x, y: (window as any).mmDebug.world.player.y }));
    await page.keyboard.down(key);
    try { await expect.poll(() => page.evaluate(({ x, y }) => { const p = (window as any).mmDebug.world.player; return Math.hypot(p.x - x, p.y - y); }, feet)).toBeGreaterThan(5); }
    finally { await page.keyboard.up(key); }
    const saved = await page.evaluate(async () => (window as any).mmDebug.storage.saveGame('arrival-test'));
    expect(saved).toBe(true);
    await page.reload();
    await page.locator('.tt').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('.hud-quest')).toContainText('Aprendé a preparar sushi');
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
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
  await expect(page.locator('.hud-quest')).toContainText('Hablá con Spicy Beacon');
  expect(await page.evaluate(() => (window as any).mmDebug.game.save.quests.done.includes('prologue'))).toBe(false);
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('restaurant', 8, 12, 'up', false));
  await finishArrival(page);
  await expect(page.locator('.dlg')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).mmDebug.game.has('intro_done'))).toBe(true);
  expect(await page.evaluate(() => (window as any).mmDebug.game.has('tut_spicy'))).toBe(false);
});
