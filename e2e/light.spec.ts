import { finishArrival } from './helpers/arrival';
import { expect, test, type Browser, type Page } from '@playwright/test';

async function boot(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((s) => localStorage.setItem('mm_settings', JSON.stringify(s)), { textSpeed: 0, music: 0, sfx: 0, ambience: 0, perf: 'high', ...extra });
  await page.goto('/?debug');
  await page.waitForSelector('.tt.ready');
  await page.locator('.tt').click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
}

interface Scene { zone: string; spot: [number, number]; period: number; minutes?: number; rain?: boolean }
async function go(page: Page, s: Scene) {
  await page.evaluate((s) => {
    const m = (window as any).mmDebug;
    const t = m.game.save.time;
    t.period = s.period;
    t.minutes = s.minutes ?? 10;
    m.game.setFlag('weather', s.rain ? 'rain' : 'clear');
    m.world.enterZone(s.zone, s.spot[0], s.spot[1], 'down', false);
  }, s);
  await page.waitForTimeout(1500);
}

const state = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    const ls = w.ls;
    const glows = w.windowGlows.map((g: any) => ({ visible: g.img.visible, alpha: g.img.alpha, door: g.door, facade: g.facade }));
    return {
      tint: ls.tint as number, lamp: ls.lamp as number, windows: ls.windows as number, halo: ls.halo as number,
      glows,
      bloom: w.glowPool.filter((g: any) => g.visible).length as number,
      redraws: w.lightRedraws as number,
    };
  });

/** Average brightness (0..255) of a square of a screenshot, decoded in a scratch page. */
async function brightness(browser: Browser, png: Buffer, x: number, y: number, r: number) {
  const p = await browser.newPage();
  const v = await p.evaluate(async ([b64, x, y, r]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return s / (d.length / 4);
  }, [png.toString('base64'), x, y, r] as const);
  await p.close();
  return v;
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => ((document.getElementById('ui') as HTMLElement).style.display = 'none'));
  const buf = await page.screenshot({ path: `docs/art/luces/${name}.png` });
  await page.evaluate(() => ((document.getElementById('ui') as HTMLElement).style.display = ''));
  return buf;
}

const PLAZA: Scene = { zone: 'plaza', spot: [9, 11], period: 1 };

test('lighting: day, dusk, night and rain in the plaza and outside the restaurant', async ({ page, browser }) => {
  await boot(page);
  const seen: Record<string, Awaited<ReturnType<typeof state>>> = {};
  const lum: Record<string, number> = {};
  const vp = page.viewportSize()!;
  for (const [name, sc] of Object.entries({
    day: { ...PLAZA },
    dusk: { ...PLAZA, period: 2, minutes: 40 },
    night: { ...PLAZA, period: 3 },
    nightRain: { ...PLAZA, period: 3, rain: true },
    dayRain: { ...PLAZA, rain: true },
  } as Record<string, Scene>)) {
    await go(page, sc);
    seen[name] = await state(page);
    const png = await shot(page, 'plaza-' + name);
    lum[name] = await brightness(browser, png, vp.width / 2, vp.height / 2, 40);
  }
  // darker as the day goes by, and the rain veil dims things further
  expect(lum.day).toBeGreaterThan(lum.dusk);
  expect(lum.dusk).toBeGreaterThan(lum.night);
  expect(lum.dayRain).toBeLessThan(lum.day);
  // Sofi stays readable: the area around her is not black at night
  expect(lum.night).toBeGreaterThan(25);
  // windows: dark by day, lit at night (facade glows of ordinary buildings)
  const win = (k: string) => seen[k].glows.filter((g) => !g.facade && !g.door);
  expect(win('day').length).toBeGreaterThan(0);
  expect(win('day').every((g) => !g.visible)).toBe(true);
  expect(win('night').some((g) => g.visible && g.alpha > 0.4)).toBe(true);
  // the restaurant doorway is always findable while it is open (afternoon included)
  expect(seen.day.glows.some((g) => g.door && g.visible)).toBe(true);
  expect(seen.night.glows.some((g) => g.door && g.visible && g.alpha > 0.3)).toBe(true);
  // rain: lamps stay on, light is wetter
  expect(seen.dayRain.lamp).toBeGreaterThanOrEqual(0.55);
  expect(seen.nightRain.halo).toBeGreaterThan(1);
});

test('lighting: the restaurant facade and its room follow the opening hours', async ({ page }) => {
  await boot(page);
  const at = async (period: number, minutes: number) => {
    await go(page, { zone: 'plaza', spot: [7, 11], period, minutes });
    return page.evaluate(() => (window as any).mmDebug.world.windowGlows.filter((g: any) => g.facade).map((g: any) => ({ door: g.door, a: g.img.visible ? g.img.alpha : 0 })));
  };
  const open = await at(3, 5);
  await shot(page, 'restaurante-fachada-noche-abierto');
  const closing = await at(3, 999);
  const closed = await at(0, 10);
  const sum = (g: { a: number }[]) => g.reduce((s, x) => s + x.a, 0);
  expect(sum(open)).toBeGreaterThan(sum(closing));
  expect(sum(closing)).toBeGreaterThan(sum(closed));
  await shot(page, 'restaurante-fachada-manana-cerrado');
  // inside
  const room = async (period: number, minutes: number) => {
    await go(page, { zone: 'restaurant', spot: [9, 9], period, minutes });
    return page.evaluate(() => (window as any).mmDebug.world.ls.lamp as number);
  };
  const lampOpen = await room(3, 5);
  await shot(page, 'restaurante-interior-abierto');
  const lampClosed = await room(0, 10);
  expect(lampOpen).toBeGreaterThan(lampClosed);
});

test('lighting: the darkness layer is not redrawn every frame, and battery mode keeps it still', async ({ page }) => {
  await boot(page);
  await go(page, { ...PLAZA, period: 3 });
  const a = (await state(page)).redraws;
  await page.waitForTimeout(1000);
  const b = (await state(page)).redraws;
  expect(b - a).toBeGreaterThan(5); // natural flicker steps (~12 per second), never a redraw per frame
  expect(b - a).toBeLessThan(20);
  expect((await state(page)).bloom).toBeGreaterThan(0);
});

for (const [name, extra] of [['battery mode', { perf: 'low' }], ['reduced motion', { reduceMotion: true }]] as const) {
  test(`lighting: ${name} -> no flicker redraws and no additive halos`, async ({ page }) => {
    await boot(page, extra);
    await go(page, { ...PLAZA, period: 3 });
    await page.waitForTimeout(2500); // let the camera settle
    const a = await state(page);
    await page.waitForTimeout(1500);
    const b = await state(page);
    expect(b.redraws - a.redraws).toBe(0);
    expect(b.bloom).toBe(0);
    expect(b.lamp).toBe(1); // the light itself is still there
    await shot(page, 'plaza-noche-' + (name === 'battery mode' ? 'bateria' : 'movimiento-reducido'));
  });
}
