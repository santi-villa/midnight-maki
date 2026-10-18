import { type Page } from '@playwright/test';
import { finishArrival } from './arrival';

export async function bootExploration(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0, sfx: 0 })));
  await page.goto('/?debug'); await page.locator('.tt.ready').click(); await page.locator('.tt.armed').waitFor();
  await page.getByRole('button', { name: 'Nueva partida' }).click(); await page.getByText('Partida 1').click();
  await page.getByRole('button', { name: 'Comenzar' }).click(); await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page); await page.addStyleTag({ content: '.coach { visibility: hidden !important; }' });
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
}

export async function visit(page: Page, zone: string, x: number, y: number, period = 3, minutes = 40) {
  await page.evaluate(async (s) => {
    const m = (window as any).mmDebug;
    m.game.save.time.period = s.period; m.game.save.time.minutes = s.minutes;
    await m.world.enterZone(s.zone, s.x, s.y, 'down', false, true);
  }, { zone, x, y, period, minutes });
  await page.waitForTimeout(450);
}
