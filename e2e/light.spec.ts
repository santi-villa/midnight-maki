import { finishArrival } from './helpers/arrival';
import { expect, test, type Browser, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

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
  const movementTip = page.getByRole('button', { name: /Entendido/ });
  if (await movementTip.isVisible()) await movementTip.click();
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
}

interface Scene { zone: string; spot: [number, number]; period: number; minutes?: number; rain?: boolean }
async function go(page: Page, s: Scene) {
  await page.evaluate((s) => {
    const m = (window as any).mmDebug;
    const t = m.game.save.time;
    t.period = s.period;
    t.minutes = s.minutes ?? 10;
    m.game.setFlag('weather', s.rain ? 'rain' : 'clear');
    return m.world.enterZone(s.zone, s.spot[0], s.spot[1], 'down', false, true);
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
  const buf = await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
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
  // The imported facade uses its actual window panes (it has no separate legacy door overlay).
  expect(seen.day.glows.some((g) => g.facade && g.visible)).toBe(true);
  expect(seen.night.glows.some((g) => g.facade && g.visible && g.alpha > 0.3)).toBe(true);
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
  const closing = await at(3, 32); // 22:04, within the existing ten-minute closing phase
  const closed = await at(3, 40); // 22:20
  const sum = (g: { a: number }[]) => g.reduce((s, x) => s + x.a, 0);
  expect(sum(open)).toBeGreaterThan(sum(closing));
  expect(sum(closing)).toBeGreaterThan(sum(closed));
  await shot(page, 'restaurante-fachada-noche-cerrado');
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

test('lighting: animated halos never redraw a still darkness layer, including reduced effects', async ({ page }) => {
  await boot(page);
  await go(page, { ...PLAZA, period: 3 });
  const before = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return { redraws: w.lightRedraws, halo: w.glowPool.map((g: any) => g.alpha) };
  });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return { redraws: w.lightRedraws, halo: w.glowPool.map((g: any) => g.alpha) };
  });
  expect(after.redraws - before.redraws).toBe(0);
  expect(after.halo).not.toEqual(before.halo);
  expect((await state(page)).bloom).toBeGreaterThan(0);
  // Moving Sofi still invalidates the player pool, and must redraw the darkness.
  await page.evaluate(() => {
    const p = (window as any).mmDebug.world.player;
    p.teleport(p.tx + 1, p.ty);
  });
  await expect.poll(async () => (await state(page)).redraws).toBeGreaterThan(after.redraws);
});

for (const [name, extra] of [['battery mode', { perf: 'low' }], ['reduced motion', { reduceMotion: true }]] as const) {
  test(`lighting: ${name} -> no flicker redraws and no additive halos`, async ({ page }) => {
    await boot(page, extra);
    await go(page, { ...PLAZA, period: 3 });
    // Ambient light changes with the clock even when flicker is disabled. Hold the
    // time fixed so this measures redraws of a still scene, rather than sunset.
    await page.evaluate(() => (window as any).mmDebug.clock.pause('lighting-still-scene'));
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

test('lighting: night settings, real lamp pools, staggered windows and readable scenes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await go(page, { zone: 'garden', spot: [12, 11], period: 2, minutes: 25 });
  const levels = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return w.lamps.filter((l: any) => !l.kind && !l.facade).map((l: any) => w.lampLevel(l, w.ls));
  });
  expect(levels.some((v: number) => v > 0 && v < 1)).toBe(true);
  expect(new Set(levels).size).toBeGreaterThan(2);
  await page.screenshot({ path: 'docs/art/luces/etapa-1/jardin-encendido-atardecer.png' });
  for (const [name, scene] of Object.entries({
    plaza: { ...PLAZA, period: 3, minutes: 20 },
    jardin: { zone: 'garden', spot: [12, 11], period: 3, minutes: 20 },
    restaurante: { zone: 'restaurant', spot: [9, 9], period: 3, minutes: 20 },
  } as Record<string, Scene>)) {
    await go(page, scene);
    expect(await page.evaluate(() => (window as any).mmDebug.world.lamps.some((l: any) => l.kind === 'ambient'))).toBe(false);
    await page.screenshot({ path: `docs/art/luces/etapa-1/${name}-noche.png` });
  }
  await go(page, { ...PLAZA, period: 3, minutes: 50 });
  const windows = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return w.windowGlows.filter((g: any) => g.home).map((g: any) => w.facadeLevel(false, false, g));
  });
  expect(windows.some((v: number) => v === 0)).toBe(true);
  expect(windows.some((v: number) => v > 0.5)).toBe(true);
  // Exterior pools and corresponding panes must use exactly the same house/shop state.
  expect(await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return w.lamps.filter((l: any) => l.home).every((l: any) => {
      const pane = w.windowGlows.find((g: any) => g.home && g.seed === l.seed);
      return pane && w.lampLevel(l, w.ls) === w.facadeLevel(false, false, pane);
    });
  })).toBe(true);
  const normal = (await state(page)).tint;
  await page.screenshot({ path: 'docs/art/luces/etapa-1/plaza-noche-normal-tardia.png' });
  // Test the actual settings controls, not a mutation of the preference object.
  await page.evaluate(async () => (await import('/src/ui/settingsPanel.ts' as string)).openSettings(true));
  const choices = page.getByRole('radiogroup', { name: 'Noche', exact: true });
  await expect(choices.getByRole('radio', { name: 'Normal', exact: true })).toHaveAttribute('aria-checked', 'true');
  await choices.getByRole('radio', { name: 'Oscura', exact: true }).click();
  await expect.poll(async () => (await state(page)).tint).not.toBe(normal);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_settings')!).nightBrightness)).toBe('dark');
  expect(await page.evaluate(async () => (await import('/src/persistence/storage.ts' as string)).loadSettings().nightBrightness)).toBe('dark');
  await page.screenshot({ path: 'docs/art/luces/etapa-1/ajustes-noche.png' });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'docs/art/luces/etapa-1/plaza-noche-oscura.png' });
  expect(await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return w.shopSigns.length > 0 && w.shopSigns.every((s: any) => s.depth > w.dark.depth);
  })).toBe(true);
  expect(errors).toEqual([]);
});
