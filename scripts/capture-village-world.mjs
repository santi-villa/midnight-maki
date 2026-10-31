// Render the registered game zones, not the prototype. Uses the booted game's native art atlases.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(process.env.VILLAGE_TEST_URL ?? 'http://localhost:5174');
  await page.locator('.tt.ready').waitFor();
  const data = await page.evaluate(async () => {
    const loaded = path => performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname === path) ?? path;
    const { game, newSave } = await import(loaded('/src/core/state.ts'));
    const { ZONES } = await import(loaded('/src/data/zones.ts'));
    const { buildZone } = await import(loaded('/src/world/zoneRuntime.ts'));
    const { buildTileset, TILESET_COLS } = await import(loaded('/src/art/tiles.ts'));
    const { propCanvas } = await import(loaded('/src/scenes/textures.ts'));
    const { bridgeRails } = await import(loaded('/src/world/bridge.ts'));
    const { bridgeRailCanvas } = await import(loaded('/src/art/bridges.ts'));
    const save = newSave(); save.restaurant.level = 7;
    for (const flag of ['unlock_beach', 'unlock_forest', 'unlock_garden', 'unlock_station', 'unlock_lighthouse_view', 'lighthouse_open']) save.flags[flag] = true;
    game.load(save);
    const canvas = document.createElement('canvas'); canvas.width = 120 * 16; canvas.height = 80 * 16;
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    const sheet = buildTileset(), objects = [];
    for (const z of Object.values(ZONES).filter(z => z.outdoor)) {
      const b = buildZone(z.id), ox = z.world.x * 16, oy = z.world.y * 16;
      for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
        for (const t of [b.tiles[y][x], b.overlay[y][x]]) if (t >= 0) c.drawImage(sheet, t % TILESET_COLS * 16, Math.floor(t / TILESET_COLS) * 16, 16, 16, ox + x * 16, oy + y * 16, 16, 16);
      }
      for (const p of b.props) objects.push({ ...p, wx: z.world.x + p.x, wy: z.world.y + p.y });
    }
    // One world-wide rail pass avoids artificial rails at a district's slicing boundary.
    const terrain = Array.from({ length: 80 }, () => Array(120).fill('d'));
    for (const z of Object.values(ZONES).filter(z => z.outdoor)) for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) terrain[z.world.y + y][z.world.x + x] = z.ground[y][x];
    for (const r of bridgeRails(terrain.map(row => row.join('')))) c.drawImage(bridgeRailCanvas(r.axis, r.length), r.x * 16 - 2, r.y * 16 - 7);
    for (const p of objects.sort((a, b) => a.wy + a.def.h - b.wy - b.def.h)) {
      const image = propCanvas(p.key), x = (p.wx + p.def.w / 2) * 16, y = (p.wy + p.def.h) * 16;
      if (!p.def.ground && p.def.sombra !== 'ninguna') {
        c.fillStyle = '#2b33202b'; c.beginPath(); c.ellipse(x + 5, y + 3, Math.min(image.width * .4, 42), Math.min(8, image.width * .13), 0, 0, Math.PI * 2); c.fill();
      }
      c.drawImage(image, Math.floor(x - image.width / 2), y - image.height);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile('docs/villa-nori-mapa-jugable.png', Buffer.from(data, 'base64'));
  console.log('Captured all nine registered outdoor districts at native scale.');
} finally { await browser.close(); }
