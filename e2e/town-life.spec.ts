import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, station = true) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, sfx: 0, ambience: 0, textSpeed: 0, perf: 'high' })));
  await page.goto('/?debug&st');
  await page.waitForSelector('.tt.ready');
  await page.evaluate(async (station) => {
    const { game, newSave } = await import('/src/core/state.ts');
    const { resetService } = await import('/src/restaurant/service.ts');
    const { ensureDefaultDecor } = await import('/src/world/zoneRuntime.ts');
    game.load(newSave('Vida del pueblo'));
    game.save.time.day = 4; game.save.time.period = 1; game.save.time.minutes = 20;
    game.save.quests.done = ['prologue'];
    for (const flag of ['intro_done', 'unlock_garden', 'unlock_forest', 'unlock_beach']) game.setFlag(flag);
    if (station) game.setFlag('unlock_station');
    ensureDefaultDecor();
    resetService();
    const phaser = (window as any).__mm;
    phaser.scene.stop('title'); phaser.scene.start('world');
    document.getElementById('ui')!.replaceChildren();
  }, station);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world.sys.isActive())).toBe(true);
  await page.evaluate(async () => {
    const { world: w, clock } = (window as any).mmDebug;
    clock.resetPause();
    await w.enterZone('plaza', 9, 11, 'down', false);
    w.scene.pause();
    w.update(0, 50);
    w.quirkT = 1e9; w.chatIn = 1e9;
  });
}

async function step(page: Page, seconds: number) {
  await page.evaluate((seconds) => {
    const w = (window as any).mmDebug.world;
    for (let i = 0; i < seconds * 20; i++) w.update(0, 50);
  }, seconds);
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    const service = await import('/src/restaurant/service.ts');
    return {
      visitors: [...w.visitors.values()].map((v: any) => ({ id: v.id, stage: v.stage, origin: v.origin, position: v.trips[0].position, greeted: v.greeted })),
      guests: service.guestViews(), audit: service.serviceAudit(),
      bodies: [...w.guests.entries()].map(([id, b]: any) => ({ id, texture: b.actor.sprite.texture.key, act: b.actor.act })),
      pip: w.town.residents.get('pip').trip.position,
    };
  });
}

async function shot(page: Page, path: string) {
  await page.evaluate(() => { (window as any).mmDebug.world.scene.resume(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { (window as any).mmDebug.world.scene.pause(); });
  await page.screenshot({ path });
}

test('visitors walk from the station, Pip hosts them, and they return outside after eating', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await step(page, 5);
  const arrival = (await snapshot(page)).visitors[0];
  expect(arrival.origin.zone).toBe('station');
  expect(arrival.position.zone).toBe('station');
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('station', 14, 12, 'down', false));
  await step(page, 0.1);
  const originalTexture = (await snapshot(page)).bodies.find((b: any) => b.id === arrival.id + ':0')!.texture;
  await step(page, 5);
  expect((await snapshot(page)).visitors.find((v: any) => v.id === arrival.id)!.position.zone).toBe('plaza');
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('restaurant', 6, 8, 'down', false));
  await step(page, 16);
  const seated = await snapshot(page);
  const guest = seated.guests.find((g: any) => g.id === arrival.id)!;
  expect(guest, JSON.stringify(seated)).toBeDefined();
  expect(guest.phase).toBe('waiting_order');
  expect(seated.visitors.find((v: any) => v.id === arrival.id)!.greeted).toBe(true);
  expect(seated.bodies.find((b: any) => b.id === arrival.id + ':0')!.texture).toBe(originalTexture);
  expect(seated.bodies.find((b: any) => b.id === arrival.id + ':0')!.act).toBe('sit');
  expect(seated.audit).toEqual([]);
  await shot(page, 'test-results/pip-hosting.png');
  await page.evaluate(async (tableId) => {
    const service = await import('/src/restaurant/service.ts');
    const m = (window as any).mmDebug;
    service.takeOrderAt(tableId);
    service.stagePlate(m.game.save.orders[0].uid, 2);
    service.deliverTo(tableId);
    m.world.enqueueMeal = () => {};
    m.world.visitorIn = 1e9;
  }, guest.tableId!);
  await step(page, 12);
  expect((await snapshot(page)).guests.find((g: any) => g.id === arrival.id)!.phase).toBe('leaving');
  await page.evaluate((id) => {
    const w = (window as any).mmDebug.world;
    for (let i = 0; i < 200 && w.visitors.get(id).trips[0].position.zone === 'restaurant'; i++) w.update(0, 50);
  }, arrival.id);
  const leaving = (await snapshot(page)).visitors.find((v: any) => v.id === arrival.id)!;
  expect(leaving.position.zone).toBe('plaza');
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('plaza', 9, 11, 'down', false));
  await step(page, 0.1);
  expect((await snapshot(page)).bodies.find((b: any) => b.id === arrival.id + ':0')!.texture).toBe(originalTexture);
  await step(page, 20);
  expect((await snapshot(page)).visitors.some((v: any) => v.id === arrival.id)).toBe(false);
  expect((await snapshot(page)).audit).toEqual([]);
  expect(errors).toEqual([]);
});

test('Bento exits the bakery at its actual street door when Sofi follows him', async ({ page }) => {
  await boot(page, false);
  await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    w.visitorIn = 1e9;
    await w.enterZone('shop_bento', 7, 5, 'down', false);
    (window as any).mmDebug.game.save.time.period = 2;
    (window as any).mmDebug.game.save.time.minutes = 20;
    w.spawnNpcs(true);
  });
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    for (let i = 0; i < 160 && w.town.residents.get('bento').trip.position.zone !== 'plaza'; i++) w.update(0, 50);
  });
  const pos = await page.evaluate(() => (window as any).mmDebug.world.town.residents.get('bento').trip.position);
  expect(pos.zone).toBe('plaza');
  expect(pos.x).toBeGreaterThanOrEqual(5);
  expect(pos.y).toBeCloseTo(19, 0);
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('plaza', 7, 19, 'down', false));
  const actor = await page.evaluate(() => {
    const w = (window as any).mmDebug.world, a = w.npc('bento');
    return { x: (a.x - 8) / 16, y: (a.y - 14) / 16, position: w.town.residents.get('bento').trip.position };
  });
  expect(actor.x).toBeCloseTo(actor.position.x);
  expect(actor.y).toBeCloseTo(actor.position.y);
  await step(page, 14);
  expect(await page.evaluate(() => (window as any).mmDebug.world.town.residents.get('bento').trip.position.zone)).toBe('restaurant');
});

test('neighbors take turns in a contextual conversation, and pause freezes it', async ({ page }) => {
  await boot(page, false);
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    w.visitorIn = 1e9;
    const g = (window as any).mmDebug.game;
    g.setFlag('at_taro', 'plaza,13,15,talk');
    g.setFlag('at_yuki', 'plaza,14,15,talk');
    for (const [id, n] of w.npcs) {
      if (id === 'taro' || id === 'yuki') continue;
      n.t = 9999;
    }
    w.spawnNpcs(false);
    for (const id of ['taro', 'yuki']) w.npcs.get(id).t = 5;
    w.chatIn = 0;
  });
  await step(page, 1.2);
  expect(await page.evaluate(() => !!(window as any).mmDebug.world.conversation)).toBe(true);
  await step(page, 1);
  const first = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return { index: w.conversation.index, text: w.npc('taro').bubble?.text, wait: w.conversation.wait };
  });
  expect(first.text).toContain('cintas');
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
  await step(page, 8);
  expect(await page.evaluate(() => (window as any).mmDebug.world.conversation.wait)).toBe(first.wait);
  await page.evaluate(() => (window as any).mmDebug.clock.resume());
  await step(page, 4);
  expect(await page.evaluate(() => (window as any).mmDebug.world.npc('yuki').bubble?.text)).toContain('moños');
  expect(await page.evaluate(() => (window as any).mmDebug.world.npc('taro').bubble)).toBeNull();
  await shot(page, 'test-results/neighbors-talking.png');
  const bounds = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    const text = w.npc('yuki').bubble;
    const view = w.cameras.main.worldView;
    return { left: text.x - text.displayWidth / 2, right: text.x + text.displayWidth / 2, viewLeft: view.x, viewRight: view.right };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.viewLeft);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewRight);
  await page.evaluate(async () => (window as any).mmDebug.world.enterZone('restaurant', 6, 8, 'down', false));
  expect(await page.evaluate(() => (window as any).mmDebug.world.conversation)).toBeNull();
});
