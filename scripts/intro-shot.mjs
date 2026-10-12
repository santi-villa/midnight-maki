// Captura de la primera página de la intro (uso: node scripts/intro-shot.mjs salida.png ancho alto)
import { chromium } from '@playwright/test';
const [out, w = '412', h = '860'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ music: 0, sfx: 0, ambience: 0 })));
await page.goto('http://localhost:5174/?st');
await page.getByRole('button', { name: 'Nueva partida' }).click();
await page.getByRole('button', { name: 'Comenzar' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
