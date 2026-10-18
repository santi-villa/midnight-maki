import { finishArrival } from './helpers/arrival';
import { expect, test, type Page } from '@playwright/test';

async function begin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, ambience: 0, sfx: 0, textSpeed: 0 })));
  await page.goto('/?debug&st');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByText('Partida 1').click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await expect(page.locator('.hud-digital')).toBeVisible();
}

test('escape menu matches the wooden two-column board', async ({ page }, info) => {
  await begin(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('Escape');
  const board = page.locator('.pause-sheet');
  await expect(board).toBeVisible();
  await expect(board).toContainText('Aventuras y Progreso');
  await expect(board).toContainText('Opciones de Sistema');
  await expect(board).toContainText('El juego está en pausa. Esc para seguir jugando.');
  await expect(board.getByRole('button', { name: 'Guardar y salir' })).toBeVisible();
  const mochila = await board.getByRole('button', { name: /Mochila/ }).boundingBox();
  const mapa = await board.getByRole('button', { name: /Mapa/ }).boundingBox();
  expect(mochila && mapa).toBeTruthy();
  expect(Math.abs(mochila!.y - mapa!.y)).toBeLessThan(8);
  expect(mapa!.x).toBeGreaterThan(mochila!.x + mochila!.width - 4);
  const sheet = await board.boundingBox();
  expect(sheet!.width).toBeLessThan(520);
  expect(sheet!.x).toBeGreaterThan(200);
  await page.screenshot({ path: info.outputPath('pause-1280.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await board.boundingBox();
  expect(narrow!.x).toBeGreaterThanOrEqual(0);
  expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(390);
  const clipped = await board.locator('.pause-item span').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  expect(clipped).toEqual([]);
  await page.screenshot({ path: info.outputPath('pause-390.png') });

  await board.getByRole('tab', { name: 'Amigos' }).click();
  await expect(board.getByRole('button', { name: 'Jugar juntos' })).toBeVisible();
  await board.getByRole('tab', { name: 'Ajustes' }).click();
  await expect(board.getByRole('button', { name: 'Descansar un rato' })).toBeVisible();
});

test('on a phone a HUD button opens the same pause board and the ✕ closes it', async ({ page }, info) => {
  await begin(page);
  const vw = page.viewportSize()!.width;
  const buttons = page.locator('.game-hud .hud-buttons .icon-btn');
  await expect(buttons).toHaveCount(4);
  const last = await buttons.last().boundingBox();
  expect(last!.x + last!.width).toBeLessThanOrEqual(vw);
  await buttons.last().tap();
  const board = page.locator('.pause-sheet');
  await expect(board).toBeVisible();
  await expect(board).toContainText('Aventuras y Progreso');
  await expect(board).toContainText('Tocá la ✕ para seguir jugando');
  const box = await board.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  await page.screenshot({ path: info.outputPath('pause-phone.png') });
  await board.locator('.close-x').tap();
  await expect(board).toBeHidden();
});
