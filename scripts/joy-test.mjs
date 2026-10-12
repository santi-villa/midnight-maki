// Prueba del joystick: arrastra la perilla y verifica que el personaje se mueva (uso: node scripts/joy-test.mjs ancho alto salida.png)
import { chromium, devices } from '@playwright/test';
const [w, h, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ ...devices['Pixel 7'], viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0, joystick: false })));
await page.goto('http://localhost:5174/?debug&st');
await page.getByRole('button', { name: 'Nueva partida' }).click();
await page.getByRole('button', { name: 'Comenzar' }).click();
await page.getByRole('button', { name: 'Saltar intro ›' }).click();
await page.getByText('Tocá para continuar').click();
let idle = 0;
for (let i = 0; i < 300 && idle < 25; i++) { const ch = page.locator('.dlg .choices button').first(); if (await ch.isVisible().catch(() => false)) { await ch.click(); idle = 0; } else if (await page.locator('.dlg').isVisible().catch(() => false)) { await page.locator('.dlg').click().catch(() => {}); idle = 0; } else idle++; await page.waitForTimeout(100); }
await page.waitForTimeout(500);
const joy = page.locator('.joystick');
console.log('joystick visible:', await joy.isVisible(), await page.evaluate(() => [...document.querySelectorAll('.joystick')].map((e) => e.getAttribute('style') + ' ' + getComputedStyle(e).display)), await page.evaluate(() => getComputedStyle(document.querySelector('.hud-top').parentElement).display), await page.locator('.dlg').count());
const before = await page.evaluate(() => { const p = (window).mmDebug.world.player; return [Math.round(p.x), Math.round(p.y)]; });
const b = await joy.boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 4 });
await page.waitForTimeout(900);
await page.screenshot({ path: out });
await page.mouse.up();
const after = await page.evaluate(() => { const p = (window).mmDebug.world.player; return [Math.round(p.x), Math.round(p.y)]; });
console.log('player moved from', before, 'to', after);
await browser.close();
