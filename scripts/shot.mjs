// Captura de pantalla del restaurante (uso: node scripts/shot.mjs salida.png [zona])
import { chromium, devices } from '@playwright/test';
const out = process.argv[2] ?? 'shot.png';
const zone = process.argv[3] ?? 'restaurant';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ ...devices['Pixel 7'], viewport: { width: Number(process.env.VW ?? 915), height: Number(process.env.VH ?? 412) } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
await page.goto('http://localhost:5174/?debug&st');
await page.getByRole('button', { name: 'Nueva partida' }).click();
await page.getByRole('button', { name: 'Comenzar' }).click();
await page.getByRole('button', { name: 'Saltar intro ›' }).click();
await page.getByText('Tocá para continuar').click();
if (process.env.DLG) { await page.locator(".dlg").first().waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); for (let i = 0; i < Number(process.env.DLG); i++) { await page.locator('.dlg').click().catch(() => {}); await page.waitForTimeout(300); } await page.screenshot({ path: out }); await browser.close(); process.exit(0); }
for (let i = 0; i < 80; i++) {
  if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {});
  else if (i > 10) break;
  await page.waitForTimeout(100);
}
if (zone !== 'none') {
  const [tx, ty] = (process.argv[4] ?? '7,8').split(',').map(Number);
  if (process.env.PERIOD) await page.evaluate((p) => { const g = (window).mmDebug.game; g.save.time.period = Number(p); g.save.time.minutes = 30; }, process.env.PERIOD);
  await page.evaluate(([z, x, y]) => (window).mmDebug.world.enterZone(z, x, y, 'down', false), [zone, tx, ty]);
  await page.waitForTimeout(800);
  for (let i = 0; i < 120; i++) {
    const choice = page.locator('.dlg .choices button').first();
    if (await choice.isVisible().catch(() => false)) await choice.click().catch(() => {});
    else if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {});
    else if (i > 20) break;
    await page.waitForTimeout(80);
  }
}
await page.waitForTimeout(1500);
if (process.env.CLICK) { await page.getByRole('button', { name: process.env.CLICK }).first().click().catch((e) => console.log('click', e.message)); await page.waitForTimeout(700); }
await page.screenshot({ path: out });
await browser.close();
