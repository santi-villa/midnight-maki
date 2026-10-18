import { describe, expect, it } from 'vitest';
import { windowGlowRects } from '../art/windowGlow';
import { coversLitPane, homeWindowLevel, lampActivation, lampFlicker, lightSeed, lampPoolTint, lightState, mixHex, mulHex, shadowStyle, tintLum, type LightInput } from '../scenes/lightmath';

const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
const base: LightInput = { period: 1, prog: 0.5, outdoor: true, rain: false, season: 0 };
const at = (o: Partial<LightInput>) => lightState({ ...base, ...o });

describe('ambient light', () => {
  it('offers a darker outdoor night without changing daylight or interiors, including old settings', () => {
    expect(at({ period: 3, prog: 1 }).tint).toBe(at({ period: 3, prog: 1, nightBrightness: 'normal' }).tint);
    expect(lum(at({ period: 3, prog: 1 }).tint)).toBeLessThan(45);
    expect(lum(at({ period: 3, nightBrightness: 'dark' }).tint)).toBeLessThan(lum(at({ period: 3 }).tint));
    for (const o of [{ period: 1 }, { period: 3, outdoor: false }]) {
      expect(at({ ...o, nightBrightness: 'dark' }).tint).toBe(at(o).tint);
    }
    for (const rain of [true, false]) {
      expect(at({ period: 2, prog: 1, rain, nightBrightness: 'dark' }).tint).toBe(at({ period: 3, prog: 0, rain, nightBrightness: 'dark' }).tint);
    }
  });
  it('gets darker from afternoon to dusk to night, outdoors', () => {
    const a = lum(at({ period: 1 }).tint);
    const d = lum(at({ period: 2, prog: 0.9 }).tint);
    const n = lum(at({ period: 3 }).tint);
    expect(a).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(n);
  });

  it('night is a deep blue (blue channel dominates)', () => {
    const t = at({ period: 3 }).tint;
    expect(t & 255).toBeGreaterThan((t >> 16) & 255);
    expect(t & 255).toBeGreaterThan((t >> 8) & 255);
  });

  it('dusk is warm (red channel dominates) before it turns blue', () => {
    const t = at({ period: 2, prog: 0.1 }).tint;
    expect((t >> 16) & 255).toBeGreaterThan(t & 255);
  });

  it('interiors stay brighter and warmer than the cold street at night', () => {
    const out = at({ period: 3 }).tint;
    const inn = at({ period: 3, outdoor: false }).tint;
    expect(lum(inn)).toBeGreaterThan(lum(out));
    expect((inn >> 16) & 255).toBeGreaterThanOrEqual((inn & 255) - 20); // warm: red at least on par with blue
  });

  it('rain dims the day and the night, but keeps lamps and windows lit', () => {
    expect(lum(at({ period: 1, rain: true }).tint)).toBeLessThan(lum(at({ period: 1 }).tint));
    expect(lum(at({ period: 3, rain: true }).tint)).toBeLessThan(lum(at({ period: 3 }).tint));
    const wet = at({ period: 1, rain: true });
    expect(wet.lamp).toBeGreaterThanOrEqual(0.55);
    expect(wet.windows).toBeGreaterThanOrEqual(0.6);
    expect(wet.halo).toBeGreaterThan(1);
  });
});

describe('lamps, windows and the moon', () => {
  it('switches lamps on gradually at distinct thresholds, with stable position identities', () => {
    const seeds = [16, 32, 48, 64].map((x) => lightSeed(x, 64));
    expect(lightSeed(32, 64)).toBe(lightSeed(32, 64));
    expect(new Set(seeds.map((s) => lampActivation(0.5, s))).size).toBeGreaterThan(1);
    for (const seed of seeds) {
      expect(lampActivation(0, seed)).toBe(0);
      expect(lampActivation(1, seed)).toBe(1);
      let previous = 0;
      for (let i = 0; i <= 100; i++) {
        const next = lampActivation(i / 100, seed);
        expect(next).toBeGreaterThanOrEqual(previous);
        expect(next - previous).toBeLessThan(0.06);
        previous = next;
      }
    }
  });

  it('keeps street lamps stable, varies flames irregularly, and disables failures for reduced motion', () => {
    const values = Array.from({ length: 3700 }, (_, i) => lampFlicker(i / 100, 11, true));
    expect(Math.min(...values)).toBe(0); // one occasional short failure
    expect(values.filter((v) => v === 0).length).toBeLessThan(20);
    const flame = values.filter((v) => v > 0);
    expect(Math.max(...flame) - Math.min(...flame)).toBeGreaterThan(0.3);
    for (let t = 0; t < 40; t += 0.1) {
      expect(lampFlicker(t, 11, false)).toBe(1);
      expect(lampFlicker(t, 11, true, true)).toBe(1);
    }
    expect(lampFlicker(1, 11, true)).not.toBe(lampFlicker(9, 11, true));
  });

  it('turns houses off separately at night and restores their windows the next day', () => {
    expect(homeWindowLevel(3, 22 * 60 + 10, 0)).toBe(0);
    expect(homeWindowLevel(3, 22 * 60 + 10, 5)).toBe(1);
    expect(homeWindowLevel(3, 22 * 60 + 3, 0)).toBeCloseTo(0.5);
    expect(homeWindowLevel(3, 25 * 60, 9)).toBe(0);
    expect(homeWindowLevel(0, 6 * 60, 0)).toBe(1);
  });
  it('lamps are off in the afternoon, ramp up at dusk and are full at night', () => {
    expect(at({ period: 1 }).lamp).toBe(0);
    expect(at({ period: 2, prog: 0.1 }).lamp).toBeLessThan(at({ period: 2, prog: 0.9 }).lamp);
    expect(at({ period: 3 }).lamp).toBe(1);
  });

  it('windows light up in the evening', () => {
    expect(at({ period: 1 }).windows).toBe(0);
    expect(at({ period: 2, prog: 0.9 }).windows).toBeGreaterThan(0.8);
    expect(at({ period: 3 }).windows).toBe(1);
  });

  it('the moon only reflects at night, and weakly in the rain', () => {
    expect(at({ period: 1 }).moon).toBe(0);
    expect(at({ period: 3 }).moon).toBe(1);
    expect(at({ period: 3, rain: true }).moon).toBeLessThan(0.5);
  });

  it('a gloomy room stays readable, cooler than a house, with its lamps on', () => {
    const gloom = at({ outdoor: false, gloom: true });
    const dark = at({ outdoor: false, dark: true });
    const inn = at({ outdoor: false });
    expect(lum(gloom.tint)).toBeGreaterThan(lum(dark.tint));
    expect(lum(gloom.tint)).toBeLessThan(lum(inn.tint));
    expect((gloom.tint & 255)).toBeGreaterThan((gloom.tint >> 16) & 255);
    expect(gloom.lamp).toBeGreaterThanOrEqual(0.8);
  });

  it('the restaurant lights its room by its hours', () => {
    const open = at({ period: 3, outdoor: false, restaurant: 'open' });
    const closing = at({ period: 3, outdoor: false, restaurant: 'closing' });
    const closed = at({ period: 3, outdoor: false, restaurant: 'closed' });
    expect(open.lamp).toBeGreaterThan(closing.lamp);
    expect(closing.lamp).toBeGreaterThan(closed.lamp);
    expect(lum(open.tint)).toBeGreaterThan(lum(closed.tint));
  });

  it('keeps the open restaurant warm and readable against a blue night', () => {
    const room = at({ period: 3, outdoor: false, restaurant: 'open' });
    const street = at({ period: 3 });
    const house = at({ period: 3, outdoor: false });
    expect(lum(room.tint)).toBeGreaterThan(lum(street.tint));
    expect(lum(room.tint)).toBeGreaterThan(lum(house.tint));
    expect((room.tint >> 16) & 255).toBeGreaterThan(room.tint & 255);
    expect(room.vig).toBeLessThan(house.vig);
  });

  it('changes restaurant lighting continuously at dusk and night boundaries', () => {
    const room = { outdoor: false, restaurant: 'open' as const };
    for (const period of [1, 2]) {
      const end = at({ ...room, period, prog: 1 });
      const next = at({ ...room, period: period + 1, prog: 0 });
      expect(end.tint).toBe(next.tint);
      expect(end.vig).toBeCloseTo(next.vig);
    }
  });

  it('seasons grade only the outdoors', () => {
    expect(at({ season: 3 }).tint).not.toBe(at({ season: 0 }).tint);
    expect(at({ season: 3, outdoor: false }).tint).toBe(at({ season: 0, outdoor: false }).tint);
  });
});

describe('shadows', () => {
  it('follow the sun: right in the morning, left in the afternoon, longer at dusk, faint at night, softer in rain', () => {
    expect(shadowStyle(0, 0.2, false, true).dx).toBeGreaterThan(0);
    expect(shadowStyle(1, 0.5, false, true).dx).toBeLessThan(0);
    expect(shadowStyle(2, 0.5, false, true).sy).toBeGreaterThan(shadowStyle(1, 0.5, false, true).sy);
    expect(shadowStyle(3, 0.5, false, true).alpha).toBeLessThan(0.5);
    expect(shadowStyle(1, 0.5, true, true).alpha).toBeLessThan(shadowStyle(1, 0.5, false, true).alpha);
  });

  it('keep the classic look indoors', () => {
    expect(shadowStyle(3, 0.5, false, false)).toEqual({ dx: 3, sy: 0.3, alpha: 1 });
  });
});

describe('lamp pools', () => {
  const night = at({ period: 3 }).tint;
  const day = at({ period: 1 }).tint;

  it('leaves a bright afternoon alone', () => {
    expect(lampPoolTint(day, 0xffc070, 1)).toBeNull();
  });

  it('lifts the night without uncovering daylight', () => {
    const pool = lampPoolTint(night, 0xffc070, 1);
    expect(pool).not.toBeNull();
    expect(tintLum(pool!)).toBeGreaterThan(tintLum(night) + 20);
    expect(tintLum(pool!)).toBeLessThan(160);
    expect((pool! >> 16) & 255).toBeGreaterThan((night >> 16) & 255);
    for (const sh of [16, 8, 0]) expect((pool! >> sh) & 255).toBeGreaterThanOrEqual((night >> sh) & 255);
  });

  it('fades a pool from the ambient colour as its lamp switches on', () => {
    expect(lampPoolTint(night, 0xffc070, 0)).toBe(night);
    expect(tintLum(lampPoolTint(night, 0xffc070, 0.1)!)).toBeLessThan(tintLum(lampPoolTint(night, 0xffc070, 0.8)!));
  });

  it('keeps an indoor night and a gloomy room from turning into day', () => {
    for (const tint of [at({ period: 3, outdoor: false }).tint, at({ outdoor: false, gloom: true }).tint, at({ outdoor: false, dark: true }).tint]) {
      const pool = lampPoolTint(tint, 0xffc070, 1);
      expect(pool).not.toBeNull();
      expect(tintLum(pool!)).toBeLessThan(200);
    }
  });

  it('lets Sofi carry a brighter pool that is still short of noon', () => {
    const self = lampPoolTint(night, 0xfff0dc, 1, 180);
    const street = lampPoolTint(night, 0xffc070, 1)!;
    expect(tintLum(self!)).toBeGreaterThan(tintLum(street));
    expect(tintLum(self!)).toBeLessThan(170);
  });
});

describe('window light occlusion', () => {
  const pane = { l: 10, r: 20, t: 30, b: 40 };
  const body = { l: 12, r: 28, t: 24, b: 50 };

  it('hides a pane only when someone in front of the wall overlaps it', () => {
    expect(coversLitPane(48, body, pane, 40)).toBe(true);
    expect(coversLitPane(37, body, pane, 40)).toBe(false);
    expect(coversLitPane(48, { l: 0, r: 8, t: 24, b: 50 }, pane, 40)).toBe(false);
  });

  it('counts feet on the wall as in front', () => {
    expect(coversLitPane(38, body, pane, 40)).toBe(true);
  });

  it('matches the restaurant panes, the doorway, house lanterns and the cabin attic', () => {
    expect(windowGlowRects(112, 90, 0, false)).toEqual([
      { x: 10, y: 52, w: 9, h: 7 },
      { x: 30, y: 52, w: 9, h: 7 },
      { x: 71, y: 52, w: 9, h: 7 },
      { x: 91, y: 52, w: 9, h: 7 },
    ]);
    expect(windowGlowRects(112, 90, 0, true)).toEqual([{ x: 50, y: 67, w: 12, h: 17 }]);
    expect(windowGlowRects(96, 80, 0, false, 'front')).toEqual([
      { x: 50, y: 57, w: 10, h: 8 },
      { x: 74, y: 57, w: 10, h: 8 },
      { x: 40, y: 50, w: 3, h: 6 },
    ]);
    const cabin = windowGlowRects(80, 72, 2, false);
    expect(cabin[cabin.length - 1]).toEqual({ x: 39, y: 24, w: 2, h: 2 });
    expect(windowGlowRects(80, 72, 5, false).some((r) => r.w === 2 && r.h === 2)).toBe(false);
  });
});

describe('colour helpers', () => {
  it('mix and multiply behave', () => {
    expect(mixHex(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixHex(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mulHex(0xffffff, 0x336699)).toBe(0x336699);
  });

  it('never jumps when one period ends and the next begins (outside, in the rain and indoors)', () => {
    const channel = (a: number, b: number) => Math.max(...[16, 8, 0].map((sh) => Math.abs(((a >> sh) & 255) - ((b >> sh) & 255))));
    for (const [outdoor, rain] of [[true, false], [true, true], [false, false]] as const) {
      for (let p = 0; p < 3; p++) {
        const a = lightState({ period: p, prog: 1, outdoor, rain, season: 0 });
        const b = lightState({ period: p + 1, prog: 0, outdoor, rain, season: 0 });
        const label = `${outdoor ? 'out' : 'in'}${rain ? ' rain' : ''} ${p}->${p + 1}`;
        expect(channel(a.tint, b.tint), label + ' tint').toBeLessThanOrEqual(6);
        for (const key of ['lamp', 'windows', 'vig', 'moon'] as const) expect(Math.abs(a[key] - b[key]), `${label} ${key}`).toBeLessThanOrEqual(0.03);
      }
    }
  });
});

