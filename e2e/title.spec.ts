import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

const SETTINGS = { textSpeed: 0, music: 0.6, sfx: 0, ambience: 0 };

async function openTitle(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((s) => localStorage.setItem('mm_settings', JSON.stringify(s)), { ...SETTINGS, ...extra });
  await page.goto('/?debug');
  await page.waitForSelector('.tt.ready');
}

test('title: only art + prompt first, first tap unlocks audio and fades the menu in', async ({ page }) => {
  await openTitle(page);
  await expect(page.locator('.tt-prompt')).toContainText('Entrar a Villa Nori');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tt-menu')!).opacity)).toBe('0');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tt-menu')!).pointerEvents)).toBe('none');
  await page.locator('.tt').click();
  await expect(page.locator('.tt.open')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Nueva partida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cargar partida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créditos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0); // no save yet
  const audio = await page.evaluate(async () => {
    const audio = (window as any).mmDebug.audio;
    return { state: audio.ctx?.state, track: audio.currentTrack() };
  });
  expect(audio.state).toBe('running');
  expect(audio.track).toBe('title');
});

test('title: menu buttons are finger-sized and inside the screen on phones (both orientations)', async ({ page }) => {
  for (const [w, h] of [[390, 844], [360, 740], [844, 390], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await openTitle(page);
    await page.locator('.tt').click();
    await page.waitForTimeout(700);
    const boxes = await page.locator('.tt-btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    expect(boxes.length).toBe(5);
    for (const b of boxes) {
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(w);
      expect(b.bottom).toBeLessThanOrEqual(h);
    }
    // the picture is never cropped: the frame fits inside the window
    const f = await page.locator('.tt-frame').evaluate((e) => e.getBoundingClientRect().toJSON());
    expect(f.width).toBeLessThanOrEqual(w + 1);
    expect(f.height).toBeLessThanOrEqual(h + 1);
  }
});

test('title: reduced motion switches the decorative animations off', async ({ page }) => {
  await openTitle(page, { reduceMotion: true });
  await expect(page.locator('.tt.tt-calm')).toHaveCount(1);
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.tt-star') ?? document.body).animationName);
  expect(anim).toBe('none');
});

test('title: load-game panel offers file and code; credits and options open', async ({ page }) => {
  await openTitle(page);
  await page.locator('.tt').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Cargar partida' }).click();
  await expect(page.getByRole('button', { name: 'Abrir archivo de copia' })).toBeVisible();
  await page.getByRole('button', { name: 'Pegar código de copia' }).click();
  await page.locator('textarea').fill('MM1:esto-no-es-valido');
  await page.getByRole('button', { name: 'Cargar desde el código' }).click();
  await expect(page.locator('.tt')).toHaveCount(1); // invalid code: still on the title
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.getByText('Un regalo para Sofi')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Opciones' }).click();
  await expect(page.getByText('Sonido')).toBeVisible();
});

test('title: with a save, Continuar loads it into the world', async ({ page }) => {
  await openTitle(page);
  await page.locator('.tt').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.game-hud .hud-top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world?.zoneId), { timeout: 15_000 }).toBe('restaurant');
  await page.evaluate(async () => { await (window as any).mmDebug.storage.saveGame('manual'); });
  await page.reload();
  await page.waitForSelector('.tt.ready');
  await page.locator('.tt').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.tt')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.world?.zoneId), { timeout: 15_000 }).toBeTruthy();
});
