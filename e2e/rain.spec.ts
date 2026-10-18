import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { finishArrival } from './helpers/arrival';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ perf: 'high', textSpeed: 0, music: 0, ambience: 0.7, sfx: 0.7 })));
  await page.goto('/?debug'); await page.locator('.tt.ready').click();
  await page.locator('.tt.armed').waitFor();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByText('Partida 1').click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finishArrival(page);
  await page.addStyleTag({ content: '.coach { visibility: hidden !important; }' });
  await page.evaluate(() => (window as any).mmDebug.clock.pause());
}

async function go(page: Page, zone: string, rain: boolean, x = 9, y = 11) {
  await page.evaluate(async ({ zone, rain, x, y }) => {
    const m = (window as any).mmDebug;
    m.game.setFlag('weather', rain ? 'rain' : 'clear');
    m.game.save.time.period = 1; m.game.save.time.minutes = 45;
    await m.world.enterZone(zone, x, y, 'down', false, true);
  }, { zone, rain, x, y });
  await page.waitForTimeout(900);
  // The existing rainy-day gathering is a real story scene. Finish it through its UI;
  // otherwise it correctly locks movement and would invalidate the footstep checks.
  for (let i = 0; i < 50; i++) {
    const choice = page.locator('.dlg .choices button').first();
    if (await choice.isVisible()) await choice.click();
    else if (await page.locator('.dlg').isVisible()) await page.keyboard.press('Enter');
    else if (await page.evaluate(() => (window as any).mmDebug.world.inputLocked === 0)) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Weather fixture left a narrative scene unfinished');
}

test('rain: valid expanding ground impacts, growing/drying puddles, two drop layers and still darkness', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page); await go(page, 'plaza', true);
  const before = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return { wet: w.wetGround.visit('plaza'), redraws: w.lightRedraws };
  });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return { wet: w.wetGround.visit('plaza'), redraws: w.lightRedraws,
      drops: w.rainFx.drops.map((e: any) => ({ depth: e.depth, count: e.getAliveParticleCount(), speeds: new Set(e.alive.map((p: any) => p.velocityY)).size })),
      impacts: w.rainFx.rings.filter((r: any) => r.img.visible).map((r: any) => ({ solid: w.zone.grid.isSolid(r.cell.x, r.cell.y), tile: w.zone.def.ground[r.cell.y][r.cell.x] })) };
  });
  expect(after.wet).toBeGreaterThan(before.wet);
  expect(after.redraws).toBe(before.redraws);
  expect(after.drops).toHaveLength(2);
  expect(after.drops.every((e: any) => e.count > 0 && e.speeds > 2)).toBe(true);
  expect(after.drops[1].depth).toBeGreaterThan(200000);
  expect(after.impacts.length).toBeGreaterThan(0);
  expect(after.impacts.every((r: any) => !r.solid && !'wd#WVx'.includes(r.tile))).toBe(true);
  // Accelerate only the visual wetness model instead of making this test wait a rainy minute.
  await page.evaluate(() => (window as any).mmDebug.world.wetGround.advance(55, true));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).mmDebug.world.rainFx.puddles.some((p: any) => p.img.visible))).toBe(true);
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/plaza-lluvia.png' });
  await page.evaluate(() => (window as any).mmDebug.clock.place(3, 20));
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/plaza-lluvia-noche.png' });
  await go(page, 'garden', true, 12, 11);
  await page.evaluate(() => (window as any).mmDebug.world.wetGround.advance(40, true));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/jardin-lluvia.png' });
  await go(page, 'restaurant', true, 8, 12);
  expect(await page.evaluate(() => (window as any).mmDebug.world.rainFx)).toBeNull();
  expect(await page.evaluate(() => (window as any).mmDebug.audio.ambKind)).toBe('rain_inside');
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/restaurante-lluvia.png' });
  await go(page, 'plaza', false);
  const wet = await page.evaluate(() => (window as any).mmDebug.world.wetGround.visit('plaza'));
  expect(wet).toBeGreaterThan(0.6);
  expect(await page.evaluate(() => (window as any).mmDebug.world.rainFx.puddles.some((p: any) => p.img.visible))).toBe(true);
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/plaza-despues-de-llover.png' });
  await page.evaluate(() => (window as any).mmDebug.world.wetGround.advance(300, false));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).mmDebug.world.rainFx.puddles.some((p: any) => p.img.visible))).toBe(false);
  await page.screenshot({ path: 'docs/art/lluvia/etapa-2/plaza-seca.png' });
  expect(errors).toEqual([]);
});

test('rain audio: real rendered signal, muffled interiors, bounded sources, nearby footsteps and pet landings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page); await go(page, 'plaza', true);
  const rendered = await page.evaluate(async () => {
    const { AudioEngine } = await import('/src/audio/audio.ts' as string);
    const result: Record<string, { rms: number; peak: number; brightness: number; pcm: number[] }> = {};
    for (const kind of ['rain', 'rain_inside', 'step_wet', 'window_drop']) {
      const c = new OfflineAudioContext(1, 48000, 24000);
      const engine = new AudioEngine() as any; engine.ctx = c;
      engine.amb = c.createGain(); engine.amb.connect(c.destination);
      engine.sfx = c.createGain(); engine.sfx.connect(c.destination);
      if (kind === 'step_wet') engine.sfxPlay(kind);
      else if (kind === 'window_drop') engine.windowDrop();
      else engine.ambience(kind);
      const buffer = await c.startRendering();
      const data = buffer.getChannelData(0);
      let energy = 0, diff = 0, peak = 0;
      const start = kind === 'step_wet' || kind === 'window_drop' ? 0 : 24000;
      for (let i = start + 1; i < data.length; i++) {
        energy += data[i] ** 2; diff += (data[i] - data[i - 1]) ** 2; peak = Math.max(peak, Math.abs(data[i]));
      }
      result[kind] = { rms: Math.sqrt(energy / (data.length - start)), peak, brightness: Math.sqrt(diff / energy), pcm: Array.from(data) };
      engine.ambience('none');
    }
    return result;
  });
  for (const s of Object.values(rendered)) { expect(s.rms).toBeGreaterThan(0.0001); expect(s.peak).toBeLessThan(1); }
  expect(rendered.rain_inside.rms).toBeLessThan(rendered.rain.rms * 0.5);
  expect(rendered.rain_inside.brightness).toBeLessThan(rendered.rain.brightness);
  expect(rendered.step_wet.brightness).toBeLessThan(0.25);
  await mkdir('docs/audio/etapa-2', { recursive: true });
  for (const [name, sound] of Object.entries(rendered)) {
    const wav = Buffer.alloc(44 + sound.pcm.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    sound.pcm.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
    await writeFile(`docs/audio/etapa-2/${name}.wav`, wav);
  }
  const crossing = await page.evaluate(async () => {
    const a = (window as any).mmDebug.audio;
    const original = a.ambBed;
    a.ambience('rain_inside');
    await new Promise((r) => setTimeout(r, 650));
    const inside = { same: a.ambBed === original, count: a.ambBed.sources.length, filter: a.ambBed.filter.frequency.value, gain: a.ambBed.gain.gain.value };
    a.ambience('rain'); await new Promise((r) => setTimeout(r, 650));
    const outside = { same: a.ambBed === original, gain: a.ambBed.gain.gain.value };
    let disconnected = 0;
    for (const n of original.nodes) { const disconnect = n.disconnect.bind(n); n.disconnect = () => { disconnected++; disconnect(); }; }
    a.ambience('none'); await new Promise((r) => setTimeout(r, 900));
    return { inside, outside, disconnected, count: original.nodes.length, dropTimer: a.windowDropTimer };
  });
  expect(crossing.inside).toMatchObject({ same: true, count: 2 });
  expect(crossing.inside.filter).toBeCloseTo(420, -1);
  expect(crossing.inside.gain).toBeCloseTo(0.065, 2);
  expect(crossing.outside.same).toBe(true);
  expect(crossing.outside.gain).toBeCloseTo(0.25, 2);
  expect(crossing.disconnected).toBe(crossing.count);
  expect(crossing.dropTimer).toBeNull();
  await page.evaluate(() => {
    const m = (window as any).mmDebug;
    const play = m.audio.sfxPlay.bind(m.audio);
    (window as any).steps = [];
    m.audio.sfxPlay = (name: string, gain = 1) => { if (name.startsWith('step')) (window as any).steps.push({ name, gain }); play(name, gain); };
    m.clock.resume();
  });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(650); await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => (window as any).steps.some((s: any) => s.name === 'step_wet' && s.gain === 1))).toBe(true);
  await go(page, 'restaurant', true, 8, 12);
  await page.evaluate(() => {
    const m = (window as any).mmDebug, w = m.world;
    const n = w.npcs.get('spicy');
    if (!n) throw new Error('Spicy missing from restaurant fixture');
    for (let y = 5; y < 12; y++) for (let x = 4; x < 17; x++) {
      if ([0, 1, 2].some((dx) => w.zone.grid.isSolid(x + dx, y)) || w.zone.grid.isSolid(x, y + 1)) continue;
      w.player.teleport(x, y + 1); n.actor.teleport(x, y); n.t = 90; n.actor.walkTo(w.zone.grid, x + 2, y);
      (window as any).steps = []; return;
    }
    throw new Error('No free footstep path');
  });
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => (window as any).steps.some((s: any) => s.name === 'step_wood' && s.gain > 0 && s.gain < 1))).toBe(true);
  await go(page, 'plaza', true, 11, 18);
  const pet = await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    return w.pets.pets.find((p: any) => p.spot.kind === 'cat_brown')?.s.y;
  });
  expect(pet).toBeDefined();
  // Force the existing cat's next hop; the real animation-complete callback must produce its landing.
  await page.evaluate(() => {
    const w = (window as any).mmDebug.world;
    const p = w.pets.pets.find((p: any) => p.spot.kind === 'cat_brown'); p.cool = 0;
    const original = w.petFootstep.bind(w); (window as any).landings = 0;
    w.petFootstep = (x: number, y: number) => { (window as any).landings++; original(x, y); };
    w.player.teleport(11, 18);
  });
  await expect.poll(() => page.evaluate(() => (window as any).landings)).toBeGreaterThan(0);
  await page.evaluate(async () => (await import('/src/core/settings.ts' as string)).updateSettings({ ambience: 0, sfx: 0 }));
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.audio.amb.gain.value)).toBeLessThan(0.001);
  await expect.poll(() => page.evaluate(() => (window as any).mmDebug.audio.sfx.gain.value)).toBeLessThan(0.001);
  expect(errors).toEqual([]);
});
