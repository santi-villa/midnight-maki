import { expect, test, type Page } from '@playwright/test';
test.use({ baseURL: process.env.VILLAGE_TEST_URL ?? 'http://localhost:5174', deviceScaleFactor: 1 });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => performance.setResourceTimingBufferSize(3000)); });
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    await page.screenshot({ path: info.outputPath('failure.png') }).catch(() => {});
    const state = await page.evaluate(() => {
      const d = (window as any).mmDebug;
      return { paused: d?.clock.paused, busy: d?.world.galleyBusy, locked: d?.world.inputLocked, text: document.querySelector('#ui')?.textContent };
    }).catch(() => null);
    await info.attach('ui-state', { body: JSON.stringify(state), contentType: 'application/json' });
  }
});
async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0, sfx: 0 })));
  await page.goto('/?debug&st', { waitUntil: 'domcontentloaded' });
  // The development server can rebuild its dependency cache on its first request.
  try { await page.locator('.tt.ready').waitFor({ timeout: 20000 }); }
  catch { await page.reload(); await page.locator('.tt.ready').waitFor({ timeout: 20000 }); }
  await page.evaluate(async () => {
    const loaded = (path: string) => performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === path) ?? path;
    const { newSave } = await import(loaded('/src/core/state.ts'));
    const { continueGame } = await import(loaded('/src/core/flow.ts'));
    const save = newSave('Sofi'); Object.assign(save.player, { zone: 'restaurant', x: 1, y: 3 });
    save.flags.intro_done = true; save.flags.galley_tut_done = true; save.quests.done = ['prologue']; save.time = { day: 3, period: 1, minutes: 20 };
    document.querySelector('.tt')!.remove(); await continueGame(save);
    (window as any).mmDebug.world.onEnterZone = async () => {};
  });
  await page.addStyleTag({ content: '.coach, .toast-wrap { visibility:hidden !important }' });
}
for (const size of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`phone apps stay inside the device and kitchen menus follow their stations (${size.width})`, async ({ page }) => {
    test.setTimeout(120000); await page.setViewportSize(size);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await boot(page);
    await expect.poll(() => page.evaluate(() => {
      const w = (window as any).mmDebug.world, cam = w.cameras.main;
      return w.kitchenFramed && !cam.panEffect.isRunning && !cam.zoomEffect.isRunning;
    })).toBe(true);
    const visible = await page.evaluate(() => {
      const w = (window as any).mmDebug.world, v = w.cameras.main.worldView;
      return { x: v.x, y: v.y, right: v.right, bottom: v.bottom };
    });
    expect(visible.x).toBeLessThanOrEqual(0); expect(visible.right).toBeGreaterThanOrEqual(14 * 16);
    expect(visible.y).toBeLessThanOrEqual(-16); expect(visible.bottom).toBeGreaterThanOrEqual(7 * 16);
    await page.screenshot({ path: `docs/cocina-encuadre-${size.width}.png` });
    await page.evaluate(() => (window as any).mmDebug.world.galleyView.act('fridge', 'open'));
    const fridge = page.locator('.gl-fridge'); await expect(fridge).toBeVisible(); await page.waitForTimeout(100);
    const anchor = await page.evaluate(() => (window as any).mmDebug.world.galleyView.anchorFor('fridge')());
    const box = (await fridge.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width); expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(Math.abs(box.y - anchor.y)).toBeLessThan(size.height / 2);
    await page.screenshot({ path: `docs/heladera-cercana-${size.width}.png` });
    await page.keyboard.press('Escape'); await expect(fridge).toHaveCount(0);
    await page.evaluate(() => (window as any).mmDebug.world.galleyView.act('fridge', 'pantry'));
    await expect(page.locator('.action-backdrop .panel')).toBeVisible();
    const pantry = (await page.locator('.action-backdrop .panel').boundingBox())!;
    expect(pantry.x).toBeGreaterThanOrEqual(0); expect(pantry.y).toBeGreaterThanOrEqual(0);
    expect(pantry.x + pantry.width).toBeLessThanOrEqual(size.width); expect(pantry.y + pantry.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path: `docs/despensa-cercana-${size.width}.png` });
    await page.keyboard.press('Escape');
    const launcher = page.getByRole('button', { name: 'Abrir NoriPhone', exact: true });
    const peek = (await launcher.boundingBox())!;
    await launcher.click({ position: { x: peek.width / 2, y: 18 } });
    await expect(page.locator('.noriphone-device')).toHaveClass(/is-open/); await page.waitForTimeout(400);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-app="friends"]')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-app="bag"]')).toBeVisible();
    for (const app of ['bag', 'quests', 'map', 'recipes', 'restaurant', 'supplies', 'staff', 'agenda']) {
      await page.locator(`[data-app="${app}"]`).click();
      const panel = page.locator('.pn-app-host > .panel-backdrop:not([hidden]) > .panel');
      await expect(panel).toBeVisible();
      expect(await page.locator('#ui > .panel-backdrop').count()).toBe(0);
      const screen = (await page.locator('.noriphone-screen').boundingBox())!, p = (await panel.boundingBox())!;
      expect(p.x).toBeGreaterThanOrEqual(screen.x - 1); expect(p.y).toBeGreaterThanOrEqual(screen.y - 1);
      expect(p.x + p.width).toBeLessThanOrEqual(screen.x + screen.width + 1);
      expect(p.y + p.height).toBeLessThanOrEqual(screen.y + screen.height + 1);
      if (app === 'recipes') await page.screenshot({ path: `docs/celular-app-${size.width}.png` });
      await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
    }
    await page.locator('[data-app="camera"]').click();
    await expect(page.locator('.pn-app-host .pn-camera')).toBeVisible();
    await expect.poll(() => page.locator('.cam-live').evaluate((el: HTMLCanvasElement) => {
      const pixels = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data, colors = new Set<string>();
      for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      return colors.size;
    })).toBeGreaterThan(20);
    await page.screenshot({ path: `docs/celular-camara-${size.width}.png` });
    await page.getByRole('button', { name: 'Acercar', exact: true }).click();
    await page.getByRole('button', { name: 'Sacar foto', exact: true }).click();
    await expect(page.locator('.pn-app-host').getByRole('button', { name: 'Guardar en el álbum', exact: true })).toBeVisible();
    expect(await page.locator('#ui > .panel-backdrop').count()).toBe(0);
    await page.locator('.pn-app-host').getByRole('button', { name: 'Guardar en el álbum', exact: true }).click();
    expect(await page.evaluate(() => (window as any).mmDebug.game.save.photos.length)).toBe(1);
    await page.getByRole('tab', { name: 'Gente, página 2 de 3', exact: true }).click();
    for (const app of ['friends', 'clients', 'photos', 'collections', 'calendar', 'memories', 'investigation']) {
      await page.locator(`[data-app="${app}"]`).click();
      const panel = page.locator('.pn-app-host > .panel-backdrop:not([hidden]) > .panel');
      await expect(panel).toBeVisible(); expect(await page.locator('#ui > .panel-backdrop').count()).toBe(0);
      await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
    }
    await page.getByRole('tab', { name: 'Sistema, página 3 de 3', exact: true }).click();
    await page.locator('[data-app="more"]').click();
    await expect(page.locator('.pn-app-host .pause-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('[data-app="settings"]').click();
    await expect(page.locator('.pn-app-host .settings-panel')).toBeVisible();
    await page.evaluate(() => {
      const url = performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === '/src/ui/dom.ts')!;
      void import(url).then(m => { (window as any).phoneConfirmation = m.confirmBox('¿Guardar este ajuste?'); });
    });
    await expect(page.locator('.pn-app-host > .panel-backdrop')).toHaveCount(2);
    await expect(page.locator('.pn-app-host .settings-panel')).toBeHidden();
    await page.locator('.pn-app-host').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.locator('.pn-app-host .settings-panel')).toBeVisible();
    if (size.width === 390) {
      await page.getByRole('tab', { name: 'Comodidad', exact: true }).click();
      const scale = page.getByRole('slider', { name: 'Tamaño de la interfaz', exact: true });
      await scale.focus(); await scale.press('Home'); await expect(scale).toHaveAttribute('aria-valuetext', '70%');
      for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }, size]) {
        await page.setViewportSize(viewport); await page.waitForTimeout(120);
        const phone = (await page.locator('.noriphone-device').boundingBox())!;
        expect(phone.x).toBeGreaterThanOrEqual(0); expect(phone.y).toBeGreaterThanOrEqual(0);
        expect(phone.x + phone.width).toBeLessThanOrEqual(viewport.width + 1); expect(phone.y + phone.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      await page.screenshot({ path: 'docs/celular-interfaz-70.png' });
    }
    await page.getByRole('button', { name: 'Cerrar celular', exact: true }).click();
    await expect(page.locator('.pn-app-host > *')).toHaveCount(0);
    await expect(page.locator('.noriphone-device')).not.toHaveClass(/is-open/);
    expect(await page.evaluate(() => (window as any).mmDebug.clock.paused)).toBe(false);
    expect(await page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('both loading screens show a fuller pink petal layer behind their card', async ({ page }) => {
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await expect(page.locator('#boot .petal')).toHaveCount(28);
  await page.screenshot({ path: 'docs/carga-petalos-inicial.png' });
  await page.unroute('**/src/main.ts');
  await page.goto('/?debug&st', { waitUntil: 'domcontentloaded' });
  await page.locator('.tt.ready').waitFor();
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === '/src/ui/dom.ts')!;
    (window as any).loadingPreview = (await import(url)).openStartLoad();
    (window as any).loadingPreview.set(42, 100);
  });
  await expect(page.locator('.load-petals i')).toHaveCount(28);
  await page.screenshot({ path: 'docs/carga-petalos-partida.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.load-petals')).toBeHidden();
  await page.evaluate(() => (window as any).loadingPreview.close());
});

test('station cards still allow a full sushi order from the fridge to the pass', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await boot(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const act = async (station: string, verb: string, x: number, y: number) => {
    await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.galleyBusy)).toBe(false);
    await page.evaluate(({ station, verb, x, y }) => {
      const w = (window as any).mmDebug.world; w.player.stop(); w.player.teleport(x, y); w.galleyView.act(station, verb);
    }, { station, verb, x, y });
  };
  const fridge = async (name: RegExp) => {
    await act('fridge', 'open', 1, 3);
    await expect(page.locator('.gl-fridge')).toBeVisible({ timeout: 3000 });
    const item = page.locator('.gl-choice', { hasText: name }); await expect(item).toBeVisible({ timeout: 3000 }); await item.click();
  };
  await page.evaluate(() => { const g = (window as any).mmDebug.game; g.save.orders.push({ uid: 9001, recipe: 'kappa', customer: 'bento', reward: 40 }); });
  await fridge(/Arroz/); await act('rice', 'put', 3, 3);
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === '/src/galley/index.ts')!;
    (await import(url)).galley().tick(30);
  });
  await act('rice', 'take', 3, 3); await act('hangiri', 'put', 4, 3);
  await fridge(/Pepino/); await act('board_1', 'chop', 5, 3);
  await expect(page.locator('.gl-cut.action-card')).toBeVisible();
  await page.screenshot({ path: 'docs/corte-junto-tabla.png' });
  const cuts = Number((await page.locator('.gl-cut-step').textContent())!.match(/de (\d+)/)![1]);
  for (let n = 1; n <= cuts; n++) {
    await expect(page.locator('.gl-cut:not(.done) .gl-cut-step')).toHaveText(` · corte ${n} de ${cuts}`);
    await page.keyboard.press('Space');
  }
  await expect(page.locator('.gl-cut')).toHaveCount(0); await page.waitForTimeout(600);
  await act('board_1', 'take', 5, 3); await act('assembly', 'put', 2, 4);
  await act('hangiri', 'take', 4, 3); await act('assembly', 'put', 3, 4);
  await fridge(/nori/i); await act('assembly', 'put', 2, 4); await act('assembly', 'assemble', 2, 4);
  await page.waitForTimeout(2200); await act('assembly', 'take', 2, 4);
  const coins = await page.evaluate(() => (window as any).mmDebug.game.coins);
  await act('pass', 'deliver', 7, 3);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.game.coins)).toBeGreaterThan(coins);
  expect(errors).toEqual([]);
});
