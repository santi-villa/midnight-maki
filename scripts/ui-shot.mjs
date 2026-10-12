// Capturas de pantallas de interfaz: creador y cocina (uso: node scripts/ui-shot.mjs creator|cook salida.png)
import { chromium, devices } from '@playwright/test';
const [what, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ ...devices['Pixel 7'], viewport: { width: Number(process.env.VW ?? 412), height: Number(process.env.VH ?? 860) } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
await page.goto('http://localhost:5174/?debug&st');
await page.getByRole('button', { name: 'Nueva partida' }).click();
if (what === 'creator') {
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
} else {
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await page.getByText('Tocá para continuar').click();
  for (let i = 0; i < 60; i++) { if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {}); else if (i > 10) break; await page.waitForTimeout(100); }
  await page.evaluate(() => (window).mmDebug.world.enterZone('restaurant', 7, 6, 'down', false));
  await page.waitForTimeout(600);
  for (let i = 0; i < 80; i++) { if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {}); else if (i > 10) break; await page.waitForTimeout(100); }
  await page.evaluate(() => { (window).mmDebug.world.onInteract({ kind: 'npc', id: 'spicy', label: '' }); });
  await page.waitForTimeout(300);
  for (let i = 0; i < 120; i++) { const ch = page.locator('.dlg .choices button').first(); if (await ch.isVisible().catch(() => false)) await ch.click(); else if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {}); else if (i > 10) break; await page.waitForTimeout(100); }
  await page.evaluate(() => { (window).mmDebug.world.onInteract({ kind: 'interact', def: { id: 'o', x: 7, y: 5, label: '', action: 'orders' }, label: '' }); });
  await page.waitForTimeout(500);
  if (what === 'orders') { await page.screenshot({ path: out }); await browser.close(); process.exit(0); }
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => import('/src/restaurant/cooking.ts').then((m) => { m.cook('kappa'); }));
  await page.waitForTimeout(1200);
  for (let i = 0; i < 40; i++) { if (await page.locator('.dlg').isVisible().catch(() => false)) await page.locator('.dlg').click().catch(() => {}); else if (i > 6) break; await page.waitForTimeout(120); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
}
await browser.close();
