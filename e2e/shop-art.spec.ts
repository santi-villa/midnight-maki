import { expect, test } from '@playwright/test';
import { bootExploration, visit } from './helpers/exploration';
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('customer outfits follow weather and interiors, with all actor frames and distinct portraits', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page); await visit(page, 'plaza', 17, 21, 1, 40);
  const inspect = () => page.evaluate(() => [...(window as any).mmDebug.world.guests.values()].map((g: any) => ({
    id: g.actor.id, texture: g.actor.sprite.texture.key, width: g.actor.sprite.frame.width, height: g.actor.sprite.frame.height,
    allFrames: Array.from({ length: 47 }, (_, i) => g.actor.sprite.texture.has(i)).every(Boolean),
  })));
  await page.evaluate(async () => {
    const m = (window as any).mmDebug, w = m.world;
    const { Journey } = await import('/src/systems/journeys.ts');
    w.visitors.clear();
    // Place real journey objects to inspect each production customer texture without waiting for random arrivals.
    ['c_tourist', 'c_student', 'c_couple', 'c_writer', 'c_sailor', 'c_runner'].forEach((customer, i) => {
      const origin = { zone: 'plaza', x: 11 + i * 2, y: 21 };
      w.visitors.set('art' + i, { id: 'art' + i, customer, customers: [customer], origin, trips: [new Journey(origin, w.town.grid)], stage: 'arriving', greeted: false });
    });
    w.syncGuests(); w.cameras.main.stopFollow(); w.cameras.main.setZoom(4); w.cameras.main.centerOn(17 * 16, 20 * 16);
  });
  const dry = await inspect();
  expect(dry).toHaveLength(6);
  expect(dry.every(g => g.width === 28 && g.height === 40 && g.allFrames && !g.texture.endsWith('_rain'))).toBe(true);
  await page.screenshot({ path: 'docs/art/arte/etapa-4/clientes-seco.png' });
  await page.evaluate(() => { const m = (window as any).mmDebug; m.game.setFlag('weather', 'rain'); m.world.syncGuests(); });
  await page.waitForTimeout(750);
  expect((await inspect()).every(g => g.texture.endsWith('_rain') && g.allFrames)).toBe(true);
  await page.screenshot({ path: 'docs/art/arte/etapa-4/clientes-lluvia.png' });
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    [...w.visitors.values()].forEach((v: any, i) => v.trips[0].place({ zone: 'restaurant', x: 5 + i * 2, y: 11 }));
  });
  await visit(page, 'restaurant', 10, 10, 1, 40);
  expect((await inspect()).every(g => !g.texture.endsWith('_rain') && g.allFrames)).toBe(true);
  expect((await inspect()).map(g => g.id)).toEqual(dry.map(g => g.id));
  const portraits = await page.evaluate(async () => {
    const { portraitSrc, speakerFace } = await import('/src/dialogue/speakerFace.ts');
    return ['c_tourist', 'c_writer', 'c_sailor'].map(id => portraitSrc(speakerFace(id)));
  });
  expect(new Set(portraits).size).toBe(3);
  await page.evaluate(async () => {
    const { say } = await import('/src/dialogue/dialogue.ts');
    void say('narr', 'Los faroles de Villa Nori iluminan una nueva historia.');
  });
  const portrait = page.locator('.dlg .portrait');
  await expect(portrait).toBeVisible();
  expect(await portrait.evaluate((e: HTMLImageElement) => ({ w: e.naturalWidth, h: e.naturalHeight }))).toEqual({ w: 96, h: 96 });
  await page.screenshot({ path: 'docs/art/arte/etapa-4/narrador.png' });
  await page.keyboard.press('Space');
  expect(errors).toEqual([]);
});
