import { expect, test } from '@playwright/test';
import { bootExploration, visit } from './helpers/exploration';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('Japanese City free art loads before props and keeps native pixels visible in town and market', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page);
  const pieces = await page.evaluate(async () => {
    const catalog = await (await fetch('/src/assets/japanese-city/catalog.json')).json();
    const { japaneseCityObject } = await import('/src/art/japaneseCity.ts');
    const { PROPS } = await import('/src/data/props.ts');
    const { propCanvas } = await import('/src/scenes/textures.ts');
    return catalog.pieces.flatMap(piece => piece.replaces.map(id => {
      const p = PROPS[id], canvas = propCanvas(id);
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      return { id, selected: !!japaneseCityObject(id, p.sw, p.sh),
        fits: canvas.width >= piece.atlas.w && canvas.height >= piece.atlas.h,
        painted: pixels.some((v, i) => i % 4 === 3 && v > 0) };
    }));
  });
  expect(pieces).toHaveLength(9);
  expect(pieces.every(p => p.selected && p.fits && p.painted)).toBe(true);
  // Inspect the market after its one-time arrival dialogue. It is always lit as night.
  await page.evaluate(() => (window as any).mmDebug.game.setFlag('market_visited'));
  for (const [zone, x, y, period] of [['plaza', 26, 20, 1], ['market', 30, 7, 3]] as const) {
    await visit(page, zone, x, y, period, 40);
    await page.evaluate(({ x, y }) => {
      const w = (window as any).mmDebug.world;
      w.cameras.main.stopFollow(); w.cameras.main.setZoom(3); w.cameras.main.centerOn(x * 16, y * 16);
    }, { x, y });
    await expect(page.locator('.dlg')).toHaveCount(0);
    await page.screenshot({ path: `docs/japanese-city-${zone}-${period === 3 ? 'noche' : 'dia'}.png` });
  }
  expect(errors).toEqual([]);
});

for (const mode of ['classic', 'missing']) {
  test(`Japanese City ${mode} keeps drawable fallback props and a usable title`, async ({ page }) => {
    // Vite first imports a URL module; Phaser then fetches the PNG through XHR.
    if (mode === 'missing') await page.route('**/src/assets/japanese-city/atlas.png*', route => route.request().resourceType() === 'script' ? route.continue() : route.abort());
    await page.goto('/?debug&st' + (mode === 'classic' ? '&japaneseCity=classic' : ''));
    await page.locator('.tt.ready').waitFor();
    const fallback = await page.evaluate(async () => {
      const { japaneseCityObject } = await import('/src/art/japaneseCity.ts');
      const { propCanvas } = await import('/src/scenes/textures.ts');
      return ['vending_red', 'jc_power_pole', 'jc_shop_sign_left', 'jc_market_blue'].map(id => {
        const canvas = propCanvas(id);
        return { fallback: japaneseCityObject(id, 16, 32) === null,
          painted: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0) };
      });
    });
    expect(fallback.every(p => p.fallback && p.painted)).toBe(true);
  });
}
