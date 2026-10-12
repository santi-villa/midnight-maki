/**
 * "Volumize": gives flat procedural sprites a 3D, lit look.
 * Light comes from the top-left: top edges catch light, the lower part and the right side fall into
 * shade, and a soft dark rim separates the object from the ground (ambient occlusion feel).
 */
import { ctx2d } from './pixel';

export function volumize(c: HTMLCanvasElement, strength = 1): HTMLCanvasElement {
  const w = c.width;
  const h = c.height;
  if (!w || !h) return c;
  const g = ctx2d(c);
  const img = g.getImageData(0, 0, w, h);
  const a = img.data;
  const src = new Uint8ClampedArray(a);
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 40;
  // vertical extent of the opaque area so the gradient follows the object, not the canvas
  let top = h;
  let bottom = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (op(x, y)) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const span = Math.max(1, bottom - top);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!op(x, y)) continue;
      const i = (y * w + x) * 4;
      let f = 1;
      // top light -> bottom shade
      const t = (y - top) / span;
      f *= 1.08 - t * 0.26 * strength;
      // rim light on top edges, shade on the right and bottom edges
      if (!op(x, y - 1)) f *= 1.22;
      else if (!op(x, y - 2)) f *= 1.08;
      if (!op(x + 1, y)) f *= 0.8;
      if (!op(x, y + 1)) f *= 0.72;
      if (!op(x - 1, y)) f *= 1.06;
      a[i] = Math.min(255, src[i] * f);
      a[i + 1] = Math.min(255, src[i + 1] * f);
      a[i + 2] = Math.min(255, src[i + 2] * (f < 1 ? f * 1.04 : f)); // shadows lean slightly blue/purple
    }
  // dark outline around the silhouette
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) {
        const i = (y * w + x) * 4;
        a[i] = 34;
        a[i + 1] = 26;
        a[i + 2] = 44;
        a[i + 3] = 170;
      }
    }
  g.putImageData(img, 0, 0);
  return c;
}
