/** Shared geometry for the chosen source facades, their saved doorway and warm panes. */
import catalog from '../assets/village/catalog.json';
import { jpFacadeLayout } from './japaneseBuildings';

export function restaurantFacadeLayout(W: number, H: number, stage: number) {
  const spec = catalog.facades[Math.min(2, Math.max(0, stage))];
  // With the VectoRaith facades each stage is its own building; the doorway still lands on the same street tile.
  const jp = jpFacadeLayout(`bld_restaurant_s${Math.min(3, Math.max(0, stage))}`, W, H);
  if (jp) return {
    frame: spec.frame as keyof typeof catalog.frames, x: jp.x, y: jp.y, w: jp.w, h: jp.h, door: jp.door, windows: jp.windows,
    sign: jp.sign, lanterns: [jp.door.x - 7, jp.door.x + jp.door.w + 7].map(lx => ({ x: lx, y: jp.door.y + 2 })),
  };
  const frame = catalog.frames[spec.frame as keyof typeof catalog.frames];
  const scale = Math.min((W - 8) / frame.w, (H - 2) / frame.h, spec.maxHeight / frame.h);
  const w = Math.round(frame.w * scale), h = Math.round(frame.h * scale);
  // Use the final rounded transform for both sprites and masks. The door stays on tile 5,6.
  const sx = w / frame.w, sy = h / frame.h;
  const dx = Math.round(spec.door[2] * sx), dh = Math.round(spec.door[3] * sy);
  const doorX = Math.floor(W / 2 - dx / 2), doorY = H - 2 - dh;
  const x = doorX - Math.round(spec.door[0] * sx), y = doorY - Math.round(spec.door[1] * sy);
  const windows = spec.windows.map(([wx, wy, ww, wh]) => ({
    x: x + Math.round(wx * sx), y: y + Math.round(wy * sy), w: Math.round(ww * sx), h: Math.round(wh * sy),
  }));
  return {
    frame: spec.frame as keyof typeof catalog.frames, x, y, w, h,
    door: { x: doorX, y: doorY, w: dx, h: dh }, windows,
    sign: { x: W / 2, y: y + Math.round(spec.sign[1] * sy) },
    lanterns: [doorX - 7, doorX + dx + 7].map(lx => ({ x: lx, y: doorY + 2 })),
  };
}
