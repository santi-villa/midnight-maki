import { describe, expect, it } from 'vitest';
import { KITCHEN_FOCUS, kitchenCameraFrame } from '../ui/kitchenFrame';
import { walkingZoom } from '../ui/frameMath';
describe('kitchen camera', () => {
  const sizes: [number, number][] = [[2521, 1287], [1920, 1080], [1280, 720], [390, 844], [320, 640], [844, 390]];
  it.each(sizes)('shows the whole kitchen, centred between the HUD bars, at %i×%i', (w, h) => {
    const f = kitchenCameraFrame(w, h);
    const left = w / 2 + (KITCHEN_FOCUS.x * 16 - f.x) * f.zoom;
    const top = h / 2 + (KITCHEN_FOCUS.y * 16 - f.y) * f.zoom;
    const width = KITCHEN_FOCUS.w * 16 * f.zoom, height = KITCHEN_FOCUS.h * 16 * f.zoom;
    expect(left).toBeGreaterThanOrEqual(11);
    expect(left + width).toBeLessThanOrEqual(w - 11);
    expect(top).toBeGreaterThanOrEqual(f.top - .01);
    expect(top + height).toBeLessThanOrEqual(h - f.bottom + .01);
    // centred on both axes (the free band is the one between the bars)
    expect(left + width / 2).toBeCloseTo(w / 2, 5);
    expect(top + height / 2).toBeCloseTo(f.top + (h - f.top - f.bottom) / 2, 5);
  });

  it.each([[2521, 1287], [1920, 1080], [1280, 720]])('keeps the walking zoom on a desktop screen (%i×%i): the camera does not pull back', (w, h) => {
    expect(kitchenCameraFrame(w, h).zoom).toBe(walkingZoom(w, h, 16));
  });
});
