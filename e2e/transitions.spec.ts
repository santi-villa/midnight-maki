import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';
async function begin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, ambience: 0, sfx: 0, textSpeed: 0, joystick: false })));
  await page.goto('/?debug&st'); await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.hud-top')).toBeVisible();
  await page.evaluate(async () => {
    const { world: w, game: g } = (window as any).mmDebug;
    g.setFlag('intro_done'); g.setFlag('tut_spicy'); g.save.quests.done = ['prologue'];
    await w.enterZone('plaza', 5, 19, 'up', false);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    (window as any).mounts = []; (window as any).openings = [];
    const original = w.mountZone.bind(w);
    w.mountedFrames = 0;
    w.game.events.on('postrender', () => w.mountedFrames++);
    w.mountZone = (...args: any[]) => {
      const curtain = document.querySelector('.door-curtain') as HTMLElement;
      const a = document.querySelector('.door-left')!.getBoundingClientRect();
      const b = document.querySelector('.door-right')!.getBoundingClientRect();
      (window as any).mounts.push({ to: args[0].def.id, phase: curtain.dataset.phase, covered: a.left <= 0 && b.right >= innerWidth && a.right >= b.left, blocked: !w.canAct() });
      w.mountedFrames = 0; return original(...args);
    };
    new MutationObserver(() => {
      const c = document.querySelector('.door-curtain') as HTMLElement;
      if (c.dataset.phase === 'opening') (window as any).openings.push({ zone: w.zoneId, frames: w.mountedFrames });
    }).observe(document.querySelector('.door-curtain')!, { attributes: true });
  });
}
async function walkDoor(page: Page, to: string) {
  await page.evaluate(async (to) => {
    const w = (window as any).mmDebug.world;
    const d = w.zone.def.doors.find((d: any) => d.to === to);
    if (!d) throw new Error('Fixture door missing');
    const candidates = [[d.x, d.y + 1], [d.x, d.y - 1], [d.x - 1, d.y], [d.x + 1, d.y]];
    const from = candidates.find(([x, y]) => !w.zone.grid.isSolid(x, y))!;
    w.player.teleport(from[0], from[1]);
    if (d.walk) {
      if (!w.player.walkTo(w.zone.grid, d.x, d.y)) throw new Error('Fixture door unreachable');
    } else await w.onInteract({ kind: 'door', def: d, label: d.label });
  }, to);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe(to);
  if (await page.locator('.door-curtain').count()) await expect(page.locator('.door-curtain')).not.toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.transitioning)).toBe(false);
}
for (const width of [390, 1280]) {
  test(`physical entry and exits cover the old frame and render interiors before opening (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await begin(page);
    for (const id of ['restaurant', 'shop_bento', 'shop_taro', 'shop_yuki', 'library']) {
      await walkDoor(page, id);
      const inside = await page.evaluate(() => { const w = (window as any).mmDebug.world; return { solid: w.zone.grid.isSolid(w.player.tx, w.player.ty), dir: w.player.dir }; });
      expect(inside).toMatchObject({ solid: false, dir: 'up' });
      if (id === 'library') await page.screenshot({ path: info.outputPath(`library-${width}.png`) });
      await walkDoor(page, 'plaza');
    }
    // Upstairs and the storage room use the same curtains without changing their doors/locks.
    await walkDoor(page, 'restaurant');
    await walkDoor(page, 'home'); await walkDoor(page, 'restaurant');
    await page.evaluate(() => (window as any).mmDebug.game.setFlag('storage_open'));
    await walkDoor(page, 'storage'); await walkDoor(page, 'restaurant');
    const results = await page.evaluate(() => ({ mounts: (window as any).mounts, openings: (window as any).openings }));
    expect(results.mounts.length).toBeGreaterThanOrEqual(15);
    for (const m of results.mounts) expect(m).toMatchObject({ phase: 'covered', covered: true, blocked: true });
    for (const opening of results.openings) expect(opening.frames).toBeGreaterThanOrEqual(2);
    expect(results.openings.length).toBeGreaterThanOrEqual(results.mounts.length);
    expect(errors).toEqual([]);
  });
}

test('rejects duplicates, restores a failed render, preserves saves and releases controls', async ({ page }) => {
  await begin(page);
  const result = await page.evaluate(async () => {
    const { world: w, game: g, storage } = (window as any).mmDebug;
    const before = performance.now();
    const minute = g.save.time.minutes;
    const first = w.enterZone('shop_taro', 5, 6, 'up');
    const duplicate = await w.enterZone('shop_yuki', 5, 6, 'up');
    await first;
    const elapsed = performance.now() - before;
    const frozen = g.save.time.minutes === minute;
    const previous = { zone: w.zoneId, x: w.player.tx, y: w.player.ty, dir: w.player.dir };
    const original = w.waitForRender.bind(w);
    let fail = true;
    w.waitForRender = () => { if (fail) { fail = false; return Promise.reject(new Error('Injected render failure')); } return original(); };
    let caught = false;
    try { await w.enterZone('shop_yuki', 5, 6, 'up'); } catch { caught = true; }
    finally { w.waitForRender = original; }
    const restored = { zone: w.zoneId, x: w.player.tx, y: w.player.ty, dir: w.player.dir };
    const saved = await storage.saveGame('transition-recovery');
    const read = await storage.loadGame();
    return { duplicate, caught, elapsed, frozen, previous, restored, saved, storedZone: read.player.zone, canAct: w.canAct(), coins: g.coins };
  });
  expect(result.elapsed).toBeGreaterThanOrEqual(400); expect(result.elapsed).toBeLessThan(2000);
  expect(result.frozen).toBe(true);
  expect(result.duplicate).toBe(false); expect(result.caught).toBe(true);
  expect(result.restored).toEqual(result.previous); expect(result.saved).toBe(true);
  expect(result.storedZone).toBe(result.previous.zone); expect(result.canAct).toBe(true);
  await expect(page.locator('.door-curtain')).not.toHaveClass(/active/);
  await walkDoor(page, 'plaza');
});

test('reduced motion uses a simple cover and retains entry/exit and frame readiness', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await begin(page);
  // The reduced-motion intro uses the fade; no curtain DOM is required.
  await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    await w.enterZone('library', 6, 7, 'up');
  });
  await expect(page.locator('.fade')).not.toHaveClass(/on|busy/);
  expect(await page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
  await walkDoor(page, 'plaza');
});

test('a failed first arrival returns to a usable title and can start again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, ambience: 0, sfx: 0, textSpeed: 0 })));
  await page.goto('/?debug&st'); await page.locator('.tt').click();
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    const render = w.waitForRender.bind(w);
    let fail = true;
    w.waitForRender = () => { if (fail) { fail = false; return Promise.reject(new Error('Injected initial render failure')); } return render(); };
  });
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await expect(page.locator('.tt.ready')).toBeVisible();
  await expect(page.locator('.door-curtain')).not.toHaveClass(/active/);
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.hud-top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.canAct())).toBe(true);
});

test('library reading and Rigg’s existing book quest remain usable and save inside the new room', async ({ page }) => {
  await begin(page); await walkDoor(page, 'library');
  await page.evaluate(() => {
    const d = (window as any).mmDebug;
    d.game.save.quests.active.sq_rigg_book = { step: 0, progress: {} };
    const def = d.world.zone.def.interact.find((i: any) => i.action === 'library');
    void d.world.onInteract({ kind: 'interact', def, label: def.label });
  });
  await expect(page.locator('.dlg')).toContainText('Mapas de la costa');
  await page.locator('.dlg').click();
  await page.evaluate(async () => (await import('/src/ui/worldmap.ts')).openWorldMap());
  await expect(page.locator('.wmap-plate.here')).toContainText('Plaza');
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(async () => {
    const d = (window as any).mmDebug;
    const ok = await d.storage.saveGame('library-test');
    const read = await d.storage.loadGame();
    return { ok, found: read.flags.rigg_book_found, zone: read.player.zone };
  });
  expect(saved).toEqual({ ok: true, found: true, zone: 'library' });
  await page.reload(); await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.zoneId)).toBe('library');
  await walkDoor(page, 'plaza');
});
