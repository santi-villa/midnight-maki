import { expect, test } from '@playwright/test';
import { bootExploration, visit } from './helpers/exploration';
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('residents walk home before lights turn off and leave again after waking', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page); await visit(page, 'plaza', 43, 23, 3, 0);
  await page.evaluate(() => {
    const m = (window as any).mmDebug, w = m.world;
    w.neighborLife.sync(); w.town.sync();
    // Start one real resident at the path outside her home, then advance her actual journey.
    const r = w.neighborLife.state.get('mame');
    r.trip.place({ zone: 'plaza', x: 42, y: 24 });
    m.game.save.time.minutes = 40; // 22:20, Mame is an early worker
    w.neighborLife.sync();
  });
  await page.waitForTimeout(100);
  const leaving = await page.evaluate(() => {
    const w = (window as any).mmDebug.world, r = w.neighborLife.state.get('mame');
    return { home: r.n.home, zone: r.trip.position.zone, settled: r.trip.settled, lamp: w.homeLightLevel(r.n.home) };
  });
  expect(leaving).toMatchObject({ zone: 'plaza', settled: false, lamp: 1 });
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await page.waitForTimeout(200);
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
  await page.screenshot({ path: 'docs/art/vida/etapa-3/vecina-camino-a-casa.png' });
  const journey = await page.evaluate(() => {
    const w = (window as any).mmDebug.world, r = w.neighborLife.state.get('mame');
    const seen: string[] = [];
    for (let i = 0; i < 1400 && !r.trip.settled; i++) { w.neighborLife.tick(0.05); if (seen.at(-1) !== r.trip.position.zone) seen.push(r.trip.position.zone); }
    return { seen, settled: r.trip.settled, zone: r.trip.position.zone, home: r.n.home };
  });
  expect(journey.settled).toBe(true); expect(journey.zone).toBe(journey.home);
  expect(journey.seen).toContain('plaza'); expect(journey.seen).toContain(journey.home);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => { const w = (window as any).mmDebug.world; return w.homeLightLevel(w.neighborLife.state.get('mame').n.home); })).toBe(0);
  await page.screenshot({ path: 'docs/art/vida/etapa-3/casa-ventana-apagada.png' });
  await visit(page, journey.home, 5, 5, 3, 40);
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.neighborBodies.get('mame')?.actor.act)).toBe('sleep');
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
  await page.screenshot({ path: 'docs/art/vida/etapa-3/vecina-durmiendo.png' });
  await page.evaluate(() => {
    const m = (window as any).mmDebug;
    m.game.save.time.period = 0; m.game.save.time.minutes = 60;
    m.world.neighborLife.sync();
  });
  expect(await page.evaluate(() => (window as any).mmDebug.world.neighborLife.state.get('mame').place.act)).not.toBe('sleep');
  expect(errors).toEqual([]);
});

test('pets follow short safe routes, sleep at night, and Miso is a local companion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page); await visit(page, 'plaza', 15, 20, 1, 40);
  const moved = await page.evaluate(() => {
    const w = (window as any).mmDebug.world, pets = w.pets;
    const p = pets.pets.find((p: any) => p.spot.kind === 'dog_golden');
    const start = { x: p.s.x, y: p.s.y }; p.pause = 0;
    for (let i = 0; i < 100; i++) pets.update(0.05, w.player);
    return { distance: Math.hypot(p.s.x - start.x, p.s.y - start.y), solid: w.zone.grid.isSolid(Math.floor(p.s.x / 16), Math.floor((p.s.y - 1) / 16)), route: p.spot.route.length };
  });
  expect(moved.distance).toBeGreaterThan(2); expect(moved.solid).toBe(false); expect(moved.route).toBe(3);
  await page.screenshot({ path: 'docs/art/vida/etapa-3/mascotas-paseando.png' });
  await page.evaluate(() => {
    const m = (window as any).mmDebug, w = m.world; m.clock.place(3, 40); w.pets.setNight(true);
    for (let i = 0; i < 600; i++) w.pets.update(0.05, w.player);
  });
  expect(await page.evaluate(() => (window as any).mmDebug.world.pets.pets.filter((p: any) => p.spot.route).every((p: any) => p.sleeping && !p.path.length && p.z.visible))).toBe(true);
  await page.screenshot({ path: 'docs/art/vida/etapa-3/mascotas-descansando.png' });
  await visit(page, 'restaurant', 17, 11, 1, 40);
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world, p = w.pets.pets.find((p: any) => p.spot.name === 'Miso');
    w.player.x = p.s.x - 16; w.player.y = p.s.y;
    (window as any).catBefore = JSON.stringify({ coins: (window as any).mmDebug.game.save.coins, relationships: (window as any).mmDebug.game.save.relationships });
    (window as any).mmDebug.clock.resume();
  });
  await expect(page.getByRole('button', { name: /Acariciar a Miso/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Acariciar a Miso/ }).first().click();
  await expect(page.locator('.toast')).toContainText('Miso');
  expect(await page.evaluate(() => {
    const g = (window as any).mmDebug.game;
    return JSON.stringify({ coins: g.save.coins, relationships: g.save.relationships }) === (window as any).catBefore;
  })).toBe(true);
  await page.screenshot({ path: 'docs/art/vida/etapa-3/miso-acariciar.png' });
  await page.locator('#ui').evaluate(e => { e.style.visibility = 'hidden'; });
  await page.screenshot({ path: 'docs/art/vida/etapa-3/miso-detalle.png' });
  await page.locator('#ui').evaluate(e => { e.style.visibility = ''; });
  expect(errors).toEqual([]);
});
