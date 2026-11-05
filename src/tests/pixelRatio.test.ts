import { describe, expect, it } from 'vitest';
import { backingScale, LOW_SCALE_CAP, SCALE_CAP, viewportFor } from '../core/pixelRatio';
import { walkingZoom } from '../ui/frameMath';
import { kitchenCameraFrame, KITCHEN_FOCUS } from '../ui/kitchenFrame';

// screens seen in the wild: desktop, Windows laptops at 125/150 %, retina, and Android phones
const DPRS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.625, 2.75, 3, 3.5, 4];

describe('canvas resolution (core/pixelRatio.ts)', () => {
  it.each(DPRS)('each canvas pixel is a whole number of device pixels at dpr %f', (dpr) => {
    for (const cap of [SCALE_CAP, LOW_SCALE_CAP]) {
      const s = backingScale(dpr, cap);
      const k = dpr / s;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
      expect(s).toBeLessThanOrEqual(cap + 1e-9);
      // and as sharp as the cap allows: one step finer would pass the cap
      if (Math.round(k) > 1) expect(dpr / (Math.round(k) - 1)).toBeGreaterThan(cap - 1e-9);
    }
  });

  it('keeps the old resolution on a plain desktop and never renders fewer pixels than before outside battery mode', () => {
    expect(backingScale(1)).toBe(1);
    for (const dpr of DPRS) expect(backingScale(dpr)).toBeGreaterThanOrEqual(1);
  });

  it('a phone at 2.625 gets whole device pixels per game pixel at the walking zoom', () => {
    const s = backingScale(2.625), v = viewportFor(412, 915, s);
    const zoom = walkingZoom(v.width, v.height, 16);
    const devicePerGamePixel = zoom * (2.625 / s);
    expect(devicePerGamePixel).toBe(Math.round(devicePerGamePixel));
    // shown at its CSS size
    expect(412 - v.width * v.zoom).toBeGreaterThanOrEqual(0);
    expect(412 - v.width * v.zoom).toBeLessThan(2);
    // still at least the eleven tiles across the short side the walking zoom promises
    expect(v.width / zoom / 16).toBeGreaterThanOrEqual(11);
  });

  it('survives odd inputs', () => {
    expect(backingScale(0)).toBe(1);
    expect(backingScale(Number.NaN)).toBe(1);
    expect(viewportFor(0, 0, 1)).toMatchObject({ width: 2, height: 2 });
    // even sides: the camera centres on half the canvas, an odd side puts the world half a canvas pixel off the grid
    for (const dpr of DPRS) { const v = viewportFor(412.19, 915.05, backingScale(dpr)); expect(v.width % 2 + v.height % 2).toBe(0); }
  });
});

describe('kitchen camera with a high-resolution canvas', () => {
  it.each([[412, 915, 2.625], [915, 412, 2.625], [1280, 800, 2]])('keeps the HUD bars at their CSS size (%i×%i css @%f)', (cw, ch, dpr) => {
    const s = backingScale(dpr), v = viewportFor(cw, ch, s);
    const f = kitchenCameraFrame(v.width, v.height, 16, s);
    const top = v.height / 2 + (KITCHEN_FOCUS.y * 16 - f.y) * f.zoom;
    const height = KITCHEN_FOCUS.h * 16 * f.zoom;
    expect(f.top).toBeCloseTo(Math.min(132 * s, v.height * .23), 5);
    expect(top).toBeGreaterThanOrEqual(f.top - .01);
    expect(top + height).toBeLessThanOrEqual(v.height - f.bottom + .01);
  });
});
