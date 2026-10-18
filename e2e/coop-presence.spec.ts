import { finishArrival } from './helpers/arrival';
import { expect, test } from '@playwright/test';

/** Two tabs of the same browser stand in for two players (same save, but each runs on its own). */
test('a guest enters the host restaurant and both see each other walk', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const errors: string[] = [];
  ctx.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  const a = await ctx.newPage();
  await a.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
  await a.goto('/?debug&coop-local&st');
  await a.locator('.tt.ready').click(); await a.locator('.tt.armed').waitFor();
  await a.getByRole('button', { name: 'Nueva partida' }).click(); await a.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await a.getByRole('button', { name: 'Comenzar' }).click();
  await a.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(a);
  await a.evaluate(() => (window as any).mmDebug.storage.saveGame('test'));
  const b = await ctx.newPage();
  await b.goto('/?debug&coop-local&st');
  await b.locator('.tt.ready').click(); await b.locator('.tt.armed').waitFor();
  await b.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug?.world?.player && (window as any).mmDebug.game.loaded), { timeout: 30_000 }).toBe(true);

  await a.addStyleTag({ content: '.coach { visibility: hidden !important; }' });
  await b.addStyleTag({ content: '.coach { visibility: hidden !important; }' });
  const own = await b.evaluate(() => {
    const m = (window as any).mmDebug; m.clock.pause(); m.game.setFlag('weather', 'clear');
    return { decor: JSON.stringify(m.game.save.decor), roomStyle: JSON.stringify(m.game.save.roomStyle), level: m.game.save.restaurant.level, time: { ...m.game.save.time }, quests: JSON.stringify(m.game.save.quests), story: JSON.stringify(m.game.save.story) };
  });
  await a.evaluate(() => { const m = (window as any).mmDebug; m.clock.pause(); m.game.save.restaurant.level = 2; m.game.setFlag('weather', 'rain'); });
  const code = await a.evaluate(() => (window as any).mmDebug.coop.host());
  await b.evaluate((c) => (window as any).mmDebug.coop.join(c), code);
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase)).toBe('connected');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.coop.state().world !== null)).toBe(true);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.world.zoneId), { timeout: 15_000 }).toBe('restaurant');
  // each sees the other as a second character in the room
  await expect.poll(() => a.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => b.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 15_000 }).toBe(true);
  await a.evaluate(() => (window as any).mmDebug.world.player.teleport(6, 10));
  await b.evaluate(() => (window as any).mmDebug.world.player.teleport(8, 10));
  await expect.poll(() => a.evaluate(() => Math.abs((window as any).mmDebug.world.remote.x - (8 * 16 + 8)) < 1)).toBe(true);
  await expect.poll(() => b.evaluate(() => Math.abs((window as any).mmDebug.world.remote.x - (6 * 16 + 8)) < 1)).toBe(true);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.game.save.restaurant.level)).toBe(2);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.game.flag('weather'))).toBe('rain');
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.audio.ambKind)).toBe('rain_inside');
  await expect(b.locator('.dlg')).toHaveCount(0);
  expect(await b.evaluate(() => Object.keys((window as any).mmDebug.game.save.flags).some(k => k.startsWith('rainday_')))).toBe(false);
  if (process.env.SHOTS) { await a.screenshot({ path: process.env.SHOTS + '/coop-host.png' }); await b.screenshot({ path: process.env.SHOTS + '/coop-guest.png' }); }
  // Weather changes after arrival also reach the guest, even while the host's clock is paused.
  await a.evaluate(() => (window as any).mmDebug.game.setFlag('weather', 'clear'));
  await expect.poll(async () => {
    const host = await a.evaluate(() => { const m = (window as any).mmDebug; return { weather: m.game.flag('weather'), phase: m.coop.state().phase, floorT: m.world.floorT }; });
    const guest = await b.evaluate(() => { const m = (window as any).mmDebug; return { weather: m.game.flag('weather'), mirror: m.mirror.on, snapshot: m.mirror.snap.weather }; });
    return { hostWeather: host.weather, phase: host.phase, guest };
  }, { timeout: 10_000 }).toEqual({ hostWeather: 'clear', phase: 'connected', guest: { weather: 'clear', mirror: true, snapshot: 'clear' } });
  await a.evaluate(() => (window as any).mmDebug.game.setFlag('weather', 'rain'));
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.game.flag('weather'))).toBe('rain');
  // the guest save is not written while visiting
  expect(await b.evaluate(() => (window as any).mmDebug.storage.saveIsBlocked())).toBe(true);
  const stored = await b.evaluate(async () => JSON.stringify(await (window as any).mmDebug.storage.loadGame()));
  expect(await b.evaluate(() => (window as any).mmDebug.storage.saveGame('x'))).toBe(true);
  expect(await b.evaluate(async () => JSON.stringify(await (window as any).mmDebug.storage.loadGame()))).toBe(stored);
  // leaving puts the guest back where they were
  await b.evaluate(() => (window as any).mmDebug.coop.leave());
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase), { timeout: 10_000 }).toBe('closed');
  await expect.poll(() => a.evaluate(() => !!(window as any).mmDebug.world.remote), { timeout: 10_000 }).toBe(false);
  await expect.poll(() => b.evaluate(() => (window as any).mmDebug.storage.saveIsBlocked())).toBe(false);
  expect(await b.evaluate(() => {
    const m = (window as any).mmDebug;
    return { decor: JSON.stringify(m.game.save.decor), roomStyle: JSON.stringify(m.game.save.roomStyle), level: m.game.save.restaurant.level, time: { ...m.game.save.time }, quests: JSON.stringify(m.game.save.quests), story: JSON.stringify(m.game.save.story) };
  })).toEqual(own);
  expect(await b.evaluate(() => (window as any).mmDebug.game.flag('weather'))).toBe('clear');
  // Fixed room stays open, accepts the same guest again and handles a closed guest tab.
  const fixed = await a.evaluate(() => (window as any).mmDebug.coop.host('ABC234'));
  await b.evaluate(c => (window as any).mmDebug.coop.join(c), fixed);
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase)).toBe('connected');
  await b.close();
  await expect.poll(() => a.evaluate(() => (window as any).mmDebug.coop.state().phase)).toBe('waiting');
  await expect.poll(() => a.evaluate(() => !!(window as any).mmDebug.world.remote)).toBe(false);
  await a.evaluate(() => (window as any).mmDebug.coop.leave());
  const backend = await a.evaluate(async () => {
    history.replaceState(null, '', '/?debug');
    const { cloud } = await import('/src/cloud/cloud.ts');
    const { databaseConfigured } = await import('/src/coop/firebaseTransport.ts');
    const s = cloud.status();
    return { configured: s.configured, database: databaseConfigured(), authenticated: !!s.user, ready: s.ready };
  });
  console.log('Firebase real (sin credenciales):', backend);
  if (backend.configured && backend.database && !backend.authenticated) {
    await expect(a.evaluate(() => (window as any).mmDebug.coop.host())).rejects.toThrow(/cuenta/);
  }
  expect(errors).toEqual([]);
  await ctx.close();
});
