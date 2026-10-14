import { expect, test } from '@playwright/test';

for (const [width, height] of [[1280, 800], [390, 844]]) {
  test(`restoration rewards, optional lore and walk-in preview survive saves (${width}px)`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
    await page.goto('/?debug'); await page.waitForSelector('.tt.ready');
    // Explicit progressed fixture; this checks new UI integrations, not organic story completion.
    await page.evaluate(async () => {
      document.querySelector('.tt')?.remove();
      const { game, newSave } = await import('/src/core/state.ts');
      const s = newSave(); s.flags.intro_done = true; s.flags.ch3_done = true;
      s.flags.proj_plaza_garden_1 = true; s.flags.proj_plaza_garden_2 = true; s.flags.proj_work_plaza_garden_3 = 0;
      s.restaurant.level = 3; s.coins = 220; s.inventory.wood = 3; s.inventory.ginger = 2;
      s.recipeMastery = { kappa: { n: 4, g: 4, p: 4 } };
      s.recipesKnown.push('california');
      s.flags.daily_state = JSON.stringify({ day: 1, week: 0, daily: [{ id: 'ui_reward', kind: 'gather', base: 0, goal: 1, coins: 40, claimed: false }], weekly: [] });
      s.stats.gathered = 1; game.load(s);
      const { projectsSection } = await import('/src/ui/projects.ts');
      const { errandsSection } = await import('/src/ui/errands.ts');
      const { h, panel } = await import('/src/ui/dom.ts');
      const projects = projectsSection(async () => true);
      panel({ title: 'Cartelera de prueba', body: h('div', null, errandsSection(projects.refresh), projects) });
    });
    const project = page.locator('[data-project-id="plaza_garden"]');
    await expect(project.getByRole('button', { name: 'Construir etapa' })).toBeDisabled();
    await page.getByRole('button', { name: 'Recibir premio', exact: true }).click();
    await expect(project.getByRole('button', { name: 'Construir etapa' })).toBeEnabled();
    await project.getByRole('button', { name: 'Construir etapa' }).click();
    await expect(project).toContainText('3/4');
    await page.getByRole('button', { name: 'Álbum del pueblo · Recuerdos de las restauraciones' }).click();
    await page.getByRole('button', { name: 'Descubrir recuerdo', exact: true }).click();
    await expect(page.locator('.dlg')).toBeVisible();
    for (let i = 0; i < 30 && await page.locator('.dlg').count(); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(60); }
    await expect(page.locator('.panel').last()).toContainText('Guardado en el álbum');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await page.evaluate(async () => (await import('/src/restaurant/kitchen.ts')).openKitchen());
    await page.getByRole('button', { name: 'Elegir receta', exact: true }).click();
    await expect(page.locator('.card').filter({ hasText: 'Kappa maki' }).locator('.coin')).toHaveText('13–16 ●');
    await expect(page.locator('.card').filter({ hasText: 'California roll' }).locator('.coin')).toHaveText('26–32 ●');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(async () => { if (!await (await import('/src/persistence/storage.ts')).saveGame('progression')) throw Error('save failed'); });
    await page.reload(); await page.waitForSelector('.tt.ready');
    const saved = await page.evaluate(async () => {
      const s = await (await import('/src/persistence/storage.ts')).loadGame();
      return { project: s!.flags.proj_plaza_garden_3, memory: s!.flags.town_memory_tea, coins: s!.coins, storyDone: !!s!.flags.story_done };
    });
    expect(saved).toEqual({ project: true, memory: true, coins: 0, storyDone: false }); expect(errors).toEqual([]);
  });
}
