// Captura de art-preview.html (uso: node scripts/preview.mjs salida.png [query])
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto('http://localhost:5174/' + (process.env.PAGE ?? 'art-preview.html') + (process.argv[3] ?? ''));
await page.waitForTimeout(1500);
await page.screenshot({ path: process.argv[2] ?? 'preview.png', fullPage: true });
await browser.close();
