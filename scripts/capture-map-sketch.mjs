// Render the isolated map study with the same art modules as the game. Requires the local Vite server.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1240 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR:', e.message); });
  await page.goto('http://localhost:5174/mapa-boceto.html');
  await page.waitForFunction(() => window.__sketchReady === true, { timeout: 60000 });
  const layout = await page.evaluate(() => {
    const plots = window.__sketchPlots, plaza = window.__sketchPlaza, grid = window.__sketchGrid;
    if (!plots || !plaza || !grid) throw new Error('Missing map layout review data');
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const failures = [];
    const open = (x, y) => 'pcb'.includes(grid[y]?.[x] ?? '!');
    const queue = [[plaza.x + 2, plaza.y + 2]], visited = new Set(queue.map(([x, y]) => `${x},${y}`));
    for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = queue[i][0] + dx, y = queue[i][1] + dy, key = `${x},${y}`;
      if (open(x, y) && !visited.has(key)) { visited.add(key); queue.push([x, y]); }
    }
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i], b = p.building;
      if (overlap(p, plaza)) failures.push(`${p.id}: private plot intersects public square`);
      if (b.x < p.x || b.y < p.y || b.x + b.w > p.x + p.w || b.y + b.h > p.y + p.h) failures.push(`${p.id}: sprite exceeds its own plot`);
      if (!visited.has(p.door.join(','))) failures.push(`${p.id}: doorway has no continuous street route to square`);
      for (let j = i + 1; j < plots.length; j++) if (overlap(p, plots[j])) failures.push(`${p.id}: plot intersects ${plots[j].id}`);
    }
    return { plots: plots.length, failures };
  });
  if (layout.failures.length) throw new Error(layout.failures.join('\n'));
  console.log(`${layout.plots} private plots: no square/plot overlaps; sprites fit; every doorway connects by a street.`);
  for (const mode of ['dia', 'noche']) {
    if (mode === 'noche') await page.locator('#night').click();
    const data = await page.locator('#map').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
    await writeFile(`docs/mapa-boceto-${mode}.png`, Buffer.from(data, 'base64'));
  }
  await page.locator('#day').click();
  await page.screenshot({ path: 'docs/mapa-boceto-interactivo.png', fullPage: true });
  await page.getByRole('button', { name: '1 Centro del pueblo', exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator('#viewport').screenshot({ path: 'docs/mapa-boceto-centro.png' });
  await page.locator('#fit').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/mapa-boceto-movil.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Map study rendered: day, night, interactive overview, centre detail and mobile. No page errors.');
} finally {
  await browser.close();
}
