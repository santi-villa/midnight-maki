import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { bootExploration, visit } from './helpers/exploration';
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('lamp bases keep contact shadows by day and night; rods progress more slowly', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page); await visit(page, 'garden', 12, 11, 1, 45);
  const shadows = await page.evaluate(async () => {
    const w = (window as any).mmDebug.world;
    const { PROPS } = await import('/src/data/props.ts');
    const stone = w.zone.props.find((p: any) => p.def.kind === 'stonelantern');
    if (stone) { w.cameras.main.stopFollow(); w.cameras.main.setZoom(4); w.cameras.main.centerOn((stone.x + 0.5) * 16, (stone.y + 1) * 16); }
    return {
      contacts: w.objs.filter((o: any) => o.getData('contactShadow')).map((o: any) => ({ w: o.width, h: o.height })),
      forbiddenCasts: w.castList.filter((s: any) => /pr_(stone|.*lamp|lantern)/.test(s.src.texture.key)).length,
      hanging: ['lantern_red', 'lantern_cream', 'wall_lantern_red', 'wall_lantern_cream', 'lanternstring'].every(id => PROPS[id].sombra === 'ninguna'),
    };
  });
  expect(shadows.hanging).toBe(true); expect(shadows.forbiddenCasts).toBe(0);
  expect(shadows.contacts.length).toBeGreaterThan(0); expect(shadows.contacts.every(s => s.w === 6 && s.h === 2)).toBe(true);
  await page.screenshot({ path: 'docs/art/etapa-0/faroles-tarde.png' });
  await page.evaluate(() => (window as any).mmDebug.clock.place(3, 20)); await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/art/etapa-0/faroles-noche.png' });
  await page.evaluate(async () => {
    const m = (window as any).mmDebug; m.game.addItem('rod_basic', 1);
    void (await import('/src/minigames/fishing.ts')).fish('lake');
  });
  await expect(page.getByRole('button', { name: 'Lanzar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lanzar', exact: true }).dispatchEvent('pointerdown');
  await page.locator('.mg canvas').dispatchEvent('pointerup');
  await expect(page.getByRole('button', { name: '¡AHORA!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '¡AHORA!', exact: true }).dispatchEvent('pointerdown');
  await page.screenshot({ path: 'docs/art/etapa-0/pesca.png' });
  expect(errors).toEqual([]);
});

test('sea and rain audio render softly, waves vary irregularly, and gulls stop at night', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await bootExploration(page); await visit(page, 'beach', 16, 10, 1, 40);
  const sounds = await page.evaluate(async () => {
    const { AudioEngine } = await import('/src/audio/audio.ts');
    const result: Record<string, any> = {};
    for (const kind of ['waves', 'rain', 'rain_inside']) {
      const c = new OfflineAudioContext(1, 24000 * 12, 24000), a = new AudioEngine() as any;
      a.ctx = c; a.amb = c.createGain(); a.amb.connect(c.destination);
      a.ambience(kind); const sources = a.ambBed.sources.length;
      const controls = a.ambBed.sources.filter((s: any) => s.buffer?.length === 47 * 32);
      const irregular = controls.length ? Array.from(controls[0].buffer.getChannelData(0)) as number[] : [];
      const rendered = await c.startRendering(), data = rendered.getChannelData(0);
      let energy = 0, peak = 0, diff = 0;
      for (let i = 24001; i < data.length; i++) { energy += data[i] ** 2; peak = Math.max(peak, Math.abs(data[i])); diff += (data[i] - data[i - 1]) ** 2; }
      result[kind] = { rms: Math.sqrt(energy / (data.length - 24001)), peak, brightness: Math.sqrt(diff / energy), sources, pcm: Array.from(data), irregular };
      a.ambience('none');
    }
    return result;
  });
  expect(sounds.waves.sources).toBe(3); // low swell, foam, and its control signal
  expect(sounds.waves.rms).toBeGreaterThan(0.0001); expect(sounds.waves.rms).toBeLessThan(sounds.rain.rms);
  expect(sounds.waves.peak).toBeLessThan(0.15);
  expect(sounds.rain_inside.rms).toBeLessThan(sounds.rain.rms * 0.5);
  expect(sounds.rain_inside.brightness).toBeLessThan(sounds.rain.brightness);
  expect(sounds.waves.irregular.length).toBe(47 * 32);
  expect(sounds.waves.irregular[0]).toBeCloseTo(sounds.waves.irregular.at(-1), 4);
  expect(sounds.waves.irregular.slice(0, 256)).not.toEqual(sounds.waves.irregular.slice(256, 512));
  await mkdir('docs/audio/etapa-0', { recursive: true });
  for (const [name, sound] of Object.entries(sounds)) {
    const wav = Buffer.alloc(44 + sound.pcm.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    sound.pcm.forEach((v: number, i: number) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
    await writeFile(`docs/audio/etapa-0/${name}.wav`, wav);
  }
  const lifecycle = await page.evaluate(async () => {
    const a = (window as any).mmDebug.audio;
    a.ambience('waves'); const before = a.ambBed; const dayGull = a.gullTimer !== null;
    a.ambience('waves_night'); const night = { same: a.ambBed === before, gull: a.gullTimer };
    a.ambience('none'); await new Promise(r => setTimeout(r, 800));
    return { dayGull, night, retired: before.sources.every((s: any) => s.onended !== null), timer: a.gullTimer };
  });
  expect(lifecycle).toMatchObject({ dayGull: true, night: { same: true, gull: null }, retired: true, timer: null });
  await page.evaluate(() => (window as any).mmDebug.world.playZoneAudio());
  await page.screenshot({ path: 'docs/art/etapa-0/playa-tarde.png' });
  await page.evaluate(() => (window as any).mmDebug.clock.place(3, 20)); await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).mmDebug.audio.ambKind)).toBe('waves_night');
  await page.screenshot({ path: 'docs/art/etapa-0/playa-noche.png' });
  expect(errors).toEqual([]);
});
