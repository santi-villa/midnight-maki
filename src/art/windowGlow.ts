/**
 * Lit rectangles of a building's night window overlay.
 * These are the opaque pixels of windowGlowTexture: one crop per pane, so a character
 * can cover a single window without dimming the rest of the facade.
 */
import { homeLayout } from './homes';
import { buildingLayout } from './nature';
import { villageShopLayout } from './village';

export interface GlowRect { x: number; y: number; w: number; h: number }

export function windowGlowRects(W: number, H: number, rot: number, door: boolean, home?: 'front' | 'side'): GlowRect[] {
  if (home) {
    const L = homeLayout(W, H, rot, home === 'side');
    const panes = L.windows.map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
    const lx = L.right ? L.door.x - 9 : L.door.x + L.door.w + 9;
    panes.push({ x: lx - 1, y: L.door.y - 2, w: 3, h: 6 });
    return panes;
  }
  const L = rot >= 20 && rot <= 23 ? villageShopLayout(W, H, rot) : buildingLayout(W, H);
  if (door) return [{ x: L.dx + 1, y: L.doorY + 2, w: L.doorW - 2, h: L.doorH - 3 }];
  const panes = L.windows.map((w) => ({ x: w.x + 1, y: w.y + 1, w: w.w - 2, h: w.h - 2 }));
  if (rot === 2 || rot === 3) panes.push({ x: Math.round(L.attic.x) - 1, y: Math.round(L.attic.y) - 1, w: 2, h: 2 });
  return panes;
}
