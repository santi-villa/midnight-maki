import { describe, expect, it } from 'vitest';
import { lightState, mixHex, mulHex, shadowStyle, type LightInput } from '../scenes/lightmath';

const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
const base: LightInput = { period: 1, prog: 0.5, outdoor: true, rain: false, season: 0 };
const at = (o: Partial<LightInput>) => lightState({ ...base, ...o });

describe('ambient light', () => {
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

  it('the restaurant lights its room by its hours', () => {
    const open = at({ period: 3, outdoor: false, restaurant: 'open' });
    const closing = at({ period: 3, outdoor: false, restaurant: 'closing' });
    const closed = at({ period: 3, outdoor: false, restaurant: 'closed' });
    expect(open.lamp).toBeGreaterThan(closing.lamp);
    expect(closing.lamp).toBeGreaterThan(closed.lamp);
    expect(lum(open.tint)).toBeGreaterThan(lum(closed.tint));
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

