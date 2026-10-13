import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

/** Starts a game quickly and returns once the world is on screen. */
async function boot(page: Page, perf: 'high' | 'low' = 'high', extra: Record<string, unknown> = {}) {
  await page.addInitScript((s) => localStorage.setItem('mm_settings', JSON.stringify(s)), { textSpeed: 0, music: 0, sfx: 0, ambience: 0, perf, ...extra });
  await page.goto('/?debug');
  await page.waitForSelector('.tt.ready');
  await page.locator('.tt').click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
}

type Case = 'day' | 'dusk' | 'night' | 'rain';
const SPOTS: Record<string, [number, number]> = { beach: [14, 13], forest: [23, 11], garden: [17, 8] };

async function visit(page: Page, zone: string, c: Case) {
  await page.evaluate(([z, c, spot]) => {
    const m = (window as any).mmDebug;
    const t = m.game.save.time;
    t.period = c === 'day' || c === 'rain' ? 1 : c === 'dusk' ? 2 : 3;
    t.minutes = c === 'dusk' ? 40 : 10;
    m.game.setFlag('weather', c === 'rain' ? 'rain' : 'clear');
    m.world.enterZone(z, spot[0], spot[1], 'down', false);
  }, [zone, c, SPOTS[zone]] as const);
  await page.waitForTimeout(1600);
}

const fxState = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    const f = w.waterFx;
    const t = w.waterTiles[0];
    return {
      hasFx: !!f,
      moonOn: f ? f.moons.some((m: any) => m.img.visible) : false,
      moonAlpha: f && f.moons[0] ? f.moons[0].img.alpha : 0,
      rings: f ? f.rings.length : 0,
      activeRings: f ? f.rings.filter((r: any) => r.on).length : 0,
      drops: !!(f && f.drops),
      tile: t ? w.layer.getTileAt(t.x, t.y).index : -1,
    };
  });

test('water: day, dusk, night and rain look right (and screenshots are saved to docs/art/agua)', async ({ page }) => {
  await boot(page);
  for (const zone of ['beach', 'forest', 'garden'] as const) {
    const seen: Record<string, Awaited<ReturnType<typeof fxState>>> = {};
    for (const c of ['day', 'dusk', 'night', 'rain'] as Case[]) {
      await visit(page, zone, c);
      seen[c] = await fxState(page);
      await page.evaluate(() => ((document.getElementById('ui') as HTMLElement).style.display = 'none'));
      await page.screenshot({ path: `docs/art/agua/${zone}-${c}.png` });
      await page.evaluate(() => ((document.getElementById('ui') as HTMLElement).style.display = ''));
    }
    expect(seen.day.hasFx).toBe(true);
    expect(seen.day.moonOn).toBe(false); // no moon reflection in daylight
    expect(seen.dusk.moonOn ? seen.dusk.moonAlpha : 0).toBeLessThan(seen.night.moonAlpha); // the moon rises late in the dusk
    expect(seen.night.moonOn).toBe(true);
    expect(seen.night.moonAlpha).toBeGreaterThan(0.5);
    expect(seen.rain.activeRings).toBeGreaterThan(0); // rain rings on the surface
    expect(seen.rain.tile).not.toBe(seen.day.tile); // the choppier grey tile set is in use
  }
});

test('water: animates frames and splash rings in normal mode', async ({ page }) => {
  await boot(page, 'high');
  await visit(page, 'beach', 'night');
  const tiles = new Set<number>();
  for (let i = 0; i < 6; i++) {
    tiles.add((await fxState(page)).tile);
    await page.waitForTimeout(500);
  }
  expect(tiles.size).toBeGreaterThan(1); // frames advance
  expect((await fxState(page)).rings).toBeGreaterThan(0);
});

test('water: battery mode keeps one still frame and only static reflections', async ({ page }) => {
  await boot(page, 'low');
  await visit(page, 'beach', 'night');
  const tiles = new Set<number>();
  for (let i = 0; i < 5; i++) {
    tiles.add((await fxState(page)).tile);
    await page.waitForTimeout(500);
  }
  expect(tiles.size).toBe(1);
  const s = await fxState(page);
  expect(s.rings).toBe(0); // no ring pool, no droplets
  expect(s.drops).toBe(false);
  expect(s.moonOn).toBe(true); // the reflection itself stays (static)
  await visit(page, 'beach', 'rain'); // still follows the weather
  expect((await fxState(page)).tile).not.toBe(s.tile);
});

test('water: reduced motion behaves like battery mode', async ({ page }) => {
  await boot(page, 'high', { reduceMotion: true });
  await visit(page, 'forest', 'night');
  const a = await fxState(page);
  await page.waitForTimeout(1200);
  const b = await fxState(page);
  expect(b.tile).toBe(a.tile);
  expect(a.rings).toBe(0);
});
