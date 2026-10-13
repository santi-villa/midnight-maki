import { expect, test, type Page } from '@playwright/test';

async function plaza(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, ambience: 0, sfx: 0, perf: 'high' })));
  await page.goto('/?debug&st'); await page.locator('.tt.ready').waitFor();
  await page.evaluate(async () => {
    const { game, newSave } = await import('/src/core/state.ts');
    game.load(newSave()); game.save.time.day = 4; game.save.time.period = 2; game.save.time.minutes = 20;
    game.save.quests.done = ['prologue']; game.setFlag('intro_done');
    (window as any).__mm.scene.stop('title'); (window as any).__mm.scene.start('world');
    document.getElementById('ui')!.replaceChildren();
  });
  await page.waitForFunction(() => (window as any).mmDebug.world.sys.isActive());
  await page.evaluate(async () => { const d = (window as any).mmDebug; await d.world.enterZone('plaza', 14, 13, 'up', false); d.clock.pause(); d.world.quirkT = d.world.chatIn = 1e9; });
  await page.waitForTimeout(500);
}

test('the fountain neighborhood has stable ambient brightness while the clock is paused', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 628 }); await plaza(page);
  await page.evaluate(() => { (window as any).mmDebug.game.save.time.minutes = 82; });
  await page.waitForTimeout(500);
  const luminance: number[] = [];
  const before = await page.evaluate(() => (window as any).mmDebug.world.ls.tint);
  for (let i = 0; i < 10; i++) {
    const shot = await page.screenshot(i === 0 ? { path: info.outputPath('fountain-dusk.png') } : {});
    luminance.push(await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(500, 130, 350, 330).data;
      let total = 0; for (let j = 0; j < px.length; j += 4) total += (px[j] + px[j + 1] + px[j + 2]) / 3;
      return total / (px.length / 4);
    }, shot.toString('base64')));
    await page.waitForTimeout(100);
  }
  expect(Math.max(...luminance) - Math.min(...luminance)).toBeLessThan(1.5);
  expect(await page.evaluate(() => (window as any).mmDebug.clock.period)).toBe(2);
  expect(await page.evaluate(() => (window as any).mmDebug.world.ls.tint)).toBe(before);
});

for (const width of [390, 1280]) {
  test(`neighbors sit on benches, the cat faces its walk and simultaneous speech stays separated (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 }); await plaza(page);
    const seated = await page.evaluate(() => {
      const w = (window as any).mmDebug.world;
      return ['yuki', 'taro', 'ume'].map(id => { const a = w.npc(id); return { id, act: a.act, lift: a.seatLift, solid: w.zone.grid.isSolid(a.tx, a.ty), spriteY: a.sprite.y, feet: a.y }; });
    });
    for (const n of seated) { expect(n.act).toBe('sit'); expect(n.lift).toBe(12); expect(n.solid).toBe(false); expect(n.feet - n.spriteY).toBe(12); }
    await page.screenshot({ path: info.outputPath(`benches-${width}.png`) });
    const direction = await page.evaluate(() => {
      const w = (window as any).mmDebug.world;
      const cat = w.critters.find((c: any) => c.kind === 'cat');
      cat.s.setPosition(16 * 16 + 8, 16 * 16 + 12); cat.t = 100;
      const x = cat.s.x;
      cat.vx = -10; w.updateCritters(0.1); const left = { x: cat.s.x, flip: cat.s.flipX };
      cat.vx = 10; w.updateCritters(0.1); return { x, left, right: { x: cat.s.x, flip: cat.s.flipX } };
    });
    expect(direction.left.x).toBeLessThan(direction.x); expect(direction.left.flip).toBe(false);
    expect(direction.right.x).toBeGreaterThan(direction.left.x); expect(direction.right.flip).toBe(true);
    await page.evaluate(() => {
      const w = (window as any).mmDebug.world;
      const [a, b] = [w.npc('taro'), w.npc('yuki')];
      a.teleport(15, 14); b.teleport(16, 14); a.emote('Vamos a preparar té y leer un rato.', 5); b.emote('¡Me gusta esa idea! Traje un libro.', 5);
    });
    await page.waitForTimeout(300);
    const rects = await page.evaluate(() => {
      const w = (window as any).mmDebug.world;
      return ['taro', 'yuki'].map(id => { const b = w.npc(id).bubble; return { x: b.x - b.displayWidth / 2, y: b.y - b.displayHeight, width: b.displayWidth, height: b.displayHeight }; });
    });
    const [a, b] = rects;
    expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false);
    await page.screenshot({ path: info.outputPath(`speech-${width}.png`) });
  });
}
