import { describe, expect, it } from 'vitest';
import { KITCHEN_VIEW, kitchenCameraFrame } from '../ui/kitchenFrame';
describe('kitchen camera', () => {
  it.each([[2521, 1287], [1920, 1080], [1280, 720], [390, 844], [320, 640], [844, 390]])('shows every counter below the HUD at %i×%i', (w, h) => {
    const f = kitchenCameraFrame(w, h);
    const left = w / 2 + (KITCHEN_VIEW.x * 16 - f.x) * f.zoom;
    const top = h / 2 + (KITCHEN_VIEW.y * 16 - f.y) * f.zoom;
    expect(left).toBeGreaterThanOrEqual(11);
    expect(left + KITCHEN_VIEW.w * 16 * f.zoom).toBeLessThanOrEqual(w - 11);
    expect(top).toBeGreaterThanOrEqual(f.top - .01);
    expect(top + KITCHEN_VIEW.h * 16 * f.zoom).toBeLessThanOrEqual(h - f.bottom + .01);
  });
});
