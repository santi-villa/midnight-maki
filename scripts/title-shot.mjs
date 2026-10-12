// Captura de la pantalla de título (uso: node scripts/title-shot.mjs salida.png ancho alto)
import { chromium } from '@playwright/test';
const [out = 'title.png', w = '915', h = '412'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0, sfx: 0, ambience: 0 })));
await page.goto('http://localhost:5174/?st');
await page.getByRole('button', { name: 'Nueva partida' }).waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
