import { expect, test, type Page } from '@playwright/test';

async function begin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mm_settings', JSON.stringify({ textSpeed: 0, music: 0.6, sfx: 0.4, ambience: 0.5 }));
    const play = HTMLMediaElement.prototype.play;
    (window as any).media = new Set<HTMLMediaElement>();
    HTMLMediaElement.prototype.play = function () { (window as any).media.add(this); return play.call(this); };
  });
  await page.goto('/?debug&st');
  await page.locator('.tt').click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('.book-page.in .book-text')).toHaveText(/La lluvia golpeaba/);
}

async function music(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).mmDebug.audio;
    return { track: a.currentTrack(), file: a.custom?.el.src ?? '', loop: a.custom?.el.loop,
      time: a.custom?.el.currentTime, duration: a.custom?.el.duration, paused: a.custom?.el.paused,
      gain: a.custom?.gain.gain.value, synthGain: a.music?.gain.value, timer: a.timer };
  });
}

async function finished(page: Page) {
  await expect(page.locator('.book')).toHaveCount(0);
  await expect.poll(async () => (await music(page)).track).toBe('town');
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => [...(window as any).media].filter((el: any) => el.src.includes('/src/music/') && !el.paused).length)).toBe(0);
  await page.locator('.dlg').click();
  await expect(page.locator('.hud-quest')).toContainText('Entrá a Midnight Maki');
}

test('the same custom song loops through seven scenes and the letter, then fades to the plaza', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await begin(page);
  await expect.poll(async () => (await music(page)).duration).toBeGreaterThan(1);
  expect(await music(page)).toMatchObject({ track: 'intro', loop: true, paused: false, timer: null });
  expect((await music(page)).file).toContain('introduction-music.mp3');
  await page.evaluate(() => {
    const el = (window as any).mmDebug.audio.custom.el;
    (window as any).introElement = el;
    el.currentTime = el.duration - 0.15;
  });
  await expect.poll(async () => (await music(page)).time, { timeout: 5000 }).toBeLessThan(2);
  const scenes = await page.evaluate(async () => (await import('/src/story/introScript.ts')).INTRO_SCENES.map((s: any) => ({ image: s.image, lines: s.lines.length, letterAfter: s.letterAfter })));
  let lastTime = 0;
  for (const scene of scenes) {
    await expect(page.locator('.book-page.in .book-photo')).toHaveAttribute('src', new RegExp(`/intro/${scene.image}\\.jpg$`));
    for (let line = 0; line < scene.lines; line++) {
      const state = await music(page);
      expect(state.track).toBe('intro');
      expect(state.loop).toBe(true);
      expect(state.time).toBeGreaterThanOrEqual(lastTime);
      lastTime = state.time;
      expect(await page.evaluate(() => (window as any).mmDebug.audio.custom.el === (window as any).introElement)).toBe(true);
      await page.waitForTimeout(300);
      await page.locator('.book-page.in').click();
      if (scene.letterAfter === line) {
        await expect(page.getByRole('button', { name: 'Cerrar carta' })).toBeVisible();
        expect((await music(page)).track).toBe('intro');
        await page.getByRole('button', { name: 'Cerrar carta' }).click();
      }
    }
  }
  await finished(page);
  expect(errors).toEqual([]);
});

test('skip fades out the intro song; mute and unmute preserve its playback position', async ({ page }) => {
  await begin(page);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    (window as any).introElement = (window as any).mmDebug.audio.custom.el;
    (await import('/src/core/settings.ts')).updateSettings({ music: 0 });
  });
  await expect.poll(async () => (await music(page)).gain).toBeLessThan(0.00001);
  await page.waitForTimeout(1700); // mute must survive the originally scheduled fade-in
  expect((await music(page)).gain).toBeLessThan(0.00001);
  const mutedTime = (await music(page)).time;
  await page.evaluate(async () => (await import('/src/core/settings.ts')).updateSettings({ music: 0.5 }));
  await expect.poll(async () => (await music(page)).gain).toBeGreaterThan(0.1);
  expect((await music(page)).time).toBeGreaterThanOrEqual(mutedTime);
  expect((await music(page)).synthGain).toBeLessThan(0.00001);
  expect(await page.evaluate(() => (window as any).mmDebug.audio.custom.el === (window as any).introElement)).toBe(true);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finished(page);
});

test('missing music file uses the generated intro throughout and still transitions on skip', async ({ page }) => {
  await page.route('**/introduction-music.mp3*', route => route.request().resourceType() === 'media' ? route.fulfill({ status: 404, body: '' }) : route.continue());
  await begin(page);
  await expect.poll(async () => (await music(page)).file).toBe('');
  expect((await music(page)).track).toBe('intro');
  expect((await music(page)).timer).not.toBeNull();
  await page.locator('.book-page.in').click();
  expect((await music(page)).track).toBe('intro');
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finished(page);
});

test('autoplay denial retries the same song on a gesture instead of permanently choosing fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let denied = false;
    HTMLMediaElement.prototype.play = function () {
      if (!denied && this.src.includes('introduction-music')) {
        denied = true;
        (window as any).deniedIntro = this;
        return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });
  await begin(page);
  expect((await music(page)).file).toContain('introduction-music');
  await page.waitForTimeout(300);
  await page.locator('.book-page.in').click();
  await expect.poll(async () => (await music(page)).paused).toBe(false);
  expect(await page.evaluate(() => (window as any).mmDebug.audio.custom.el === (window as any).deniedIntro)).toBe(true);
  await page.getByRole('button', { name: 'Saltar intro ›' }).click();
  await finished(page);
});
