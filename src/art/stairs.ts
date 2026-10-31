/** A wooden staircase climbing into the back wall, two tiles wide, with a handrail on each side (the restaurant's way up). */
import { ctx2d, makeCanvas, px } from './pixel';

export function stairsObject(id: string, W: number, H: number): HTMLCanvasElement | null {
  if (id !== 'stairs_up') return null;
  const c = makeCanvas(W, H), g = ctx2d(c);
  // the dark opening at the top of the flight
  px(g, 3, 0, '#2b1d17', W - 6, 8);
  px(g, 4, 1, '#3d2a20', W - 8, 6);
  // treads from the top (narrow, in shadow) to the bottom (wide, lit)
  const steps = 6, top = 8, stepH = Math.floor((H - top) / steps);
  for (let i = 0; i < steps; i++) {
    const y = top + i * stepH, inset = Math.max(0, 3 - Math.floor(i / 2));
    const k = i / (steps - 1);
    const tread = k < 0.34 ? '#8a5a3c' : k < 0.67 ? '#a8734d' : '#c08a5c';
    px(g, 3 + inset, y, tread, W - 6 - inset * 2, stepH - 1);
    px(g, 3 + inset, y, '#d9a774', W - 6 - inset * 2, 1); // the nosing catches the light
    px(g, 3 + inset, y + stepH - 1, '#5e3d2a', W - 6 - inset * 2, 1);
  }
  // stringers and handrails
  for (const x of [0, W - 3]) {
    px(g, x, 2, '#5e3d2a', 3, H - 2);
    px(g, x + 1, 2, '#7a4f35', 1, H - 2);
  }
  for (const x of [1, W - 2]) for (let y = 6; y < H; y += 8) px(g, x - 1, y, '#3d2a20', 3, 2);
  return c;
}
