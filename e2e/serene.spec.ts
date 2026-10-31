import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('Serene renders complete native props and terrain when continuing an existing save', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0, sfx: 0 })));
  await page.goto('/?debug&st');
  await page.locator('.tt.ready').waitFor();
  const atlas = await page.evaluate(async () => {
    const catalog = await (await fetch('/src/assets/serene/catalog.json')).json();
    const { sereneObject, drawSereneTile } = await import('/src/art/serene.ts');
    const { propCanvas } = await import('/src/scenes/textures.ts');
    const { PROPS } = await import('/src/data/props.ts');
    const image = (window as any).__mm.textures.get('serene-village').getSourceImage();
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    source.getContext('2d')!.drawImage(image, 0, 0);
    const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);
    const props = catalog.pieces.flatMap((piece: any) => piece.replaces.map((id: string) => {
      const d = PROPS[id], c = propCanvas(id), f = piece.atlas;
      const original = source.getContext('2d')!.getImageData(f.x, f.y, f.w, f.h).data;
      const rendered = c.getContext('2d')!.getImageData(Math.floor((c.width - f.w) / 2), c.height - f.h, f.w, f.h).data;
      return { id, selected: !!sereneObject(id, d.sw, d.sh), exactPixels: same(original, rendered) };
    }));
    const ground = Object.entries(catalog.tiles).map(([id, piece]: [string, any]) => {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const f = piece.atlas;
      const drawn = drawSereneTile(c.getContext('2d')!, 0, 0, id as 'grass' | 'dirt');
      return drawn && same(source.getContext('2d')!.getImageData(f.x, f.y, 16, 16).data, c.getContext('2d')!.getImageData(0, 0, 16, 16).data);
    });
    return { props, ground };
  });
  expect(atlas.props).toHaveLength(10);
  expect(atlas.props.every((p: any) => p.selected && p.exactPixels)).toBe(true);
  expect(atlas.ground).toEqual([true, true]);
  await page.evaluate(async () => {
    const { newSave } = await import('/src/core/state.ts');
    const { continueGame } = await import('/src/core/flow.ts');
    const s = newSave('Sofi'); s.player.zone = 'forest'; s.player.x = 14; s.player.y = 22;
    s.time = { day: 3, period: 1, minutes: 10 };
    s.flags.intro_done = true; s.quests.done = ['prologue'];
    document.querySelector('.tt')!.remove();
    await continueGame(s);
    (window as any).mmDebug.clock.pause();
  });
  for (const [zone, x, y] of [['forest', 15, 13], ['garden', 15, 10], ['plaza', 18, 13]] as const) {
    await page.evaluate(async ({ zone, x, y }) => {
      const w = (window as any).mmDebug.world;
      await w.enterZone(zone, x, y, 'down', false, true);
      w.cameras.main.stopFollow(); w.cameras.main.setZoom(2.5); w.cameras.main.centerOn(x * 16, y * 16);
      document.getElementById('ui')!.style.display = 'none';
    }, { zone, x, y });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `docs/serene-${zone}.png` });
  }
  // Confirm that scenery replacement does not consume or mutate existing progress.
  expect(await page.evaluate(() => (window as any).mmDebug.game.save.player.name)).toBe('Sofi');
  expect(errors).toEqual([]);
});

for (const mode of ['classic', 'missing']) {
  test(`Serene ${mode} leaves terrain and props drawable`, async ({ page }) => {
    if (mode === 'missing') await page.route('**/src/assets/serene/atlas.png*', route => route.request().resourceType() === 'script' ? route.continue() : route.abort());
    await page.goto('/?debug&st' + (mode === 'classic' ? '&serene=classic' : ''));
    await page.locator('.tt.ready').waitFor();
    expect(await page.evaluate(async () => {
      const { sereneObject, drawSereneTile } = await import('/src/art/serene.ts');
      const { propCanvas } = await import('/src/scenes/textures.ts');
      const { buildTileset } = await import('/src/art/tiles.ts');
      const c = buildTileset();
      return !drawSereneTile(c.getContext('2d')!, 0, 0, 'grass') &&
        ['tree', 'bush', 'rock', 'fence'].every(id => {
          const art = propCanvas(id);
          return sereneObject(id, 16, 16) === null && art.getContext('2d')!.getImageData(0, 0, art.width, art.height).data.some((v, i) => i % 4 === 3 && v > 0);
        });
    })).toBe(true);
  });
}
