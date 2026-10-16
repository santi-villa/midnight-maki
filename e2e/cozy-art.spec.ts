import { expect, test } from '@playwright/test';

test('the published build loads the selected atlas before generating terrain and furniture', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?debug&st');
  await page.waitForSelector('.tt.ready');
  const art = await page.evaluate(async () => {
    const { COZY_FRAMES } = await import('/src/art/cozyFrames.ts');
    const { cozyObject } = await import('/src/art/cozyAssets.ts');
    const { furnTexture } = await import('/src/scenes/textures.ts');
    const scene = (window as any).__mm.scene.getScene('title');
    const image = scene.textures.get('cozy-town-source').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const frames = Object.values(COZY_FRAMES).map((f) => {
      const pixels = context.getImageData(f.x, f.y, f.w, f.h).data;
      return { fits: f.x + f.w <= image.width && f.y + f.h <= image.height, painted: pixels.some((v, i) => i % 4 === 3 && v > 0) };
    });
    const chairs = Array.from({ length: 4 }, (_, rot) => {
      const texture = scene.textures.get(furnTexture(scene, 'chair_dark', rot));
      const source = texture.getSourceImage() as HTMLCanvasElement;
      return { width: source.width, height: source.height, nonempty: source.getContext('2d')!.getImageData(0, 0, source.width, source.height).data.some((v, i) => i % 4 === 3 && v > 0) };
    });
    return { width: image.width, height: image.height, frames, chairs, turnedTableFallback: cozyObject('table_long', 16, 48, 1) === null };
  });
  expect(art.width).toBe(256);
  expect(art.height).toBe(256);
  expect(art.frames.length).toBe(17);
  expect(art.frames.every((f) => f.fits && f.painted)).toBe(true);
  expect(art.chairs).toHaveLength(4);
  for (const chair of art.chairs) expect(chair).toEqual({ width: 16, height: 24, nonempty: true });
  expect(art.turnedTableFallback).toBe(true);
  expect(errors).toEqual([]);
});
