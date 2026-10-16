/** Pure camera-frame math. The phone visor pans and zooms before the snapshot. */

export const PHOTO_NEAR = 80;
/** A villager's sprite stands above their feet. A tight zoom can show the body while the feet sit past the edge. */
const BODY_ABOVE = 40;
const BODY_HALF = 10;

export interface PhotoActor {
  id: string;
  name: string;
  x: number;
  y: number;
  raccoon?: boolean;
}

export interface PhotoView {
  x: number;
  y: number;
  right: number;
  bottom: number;
}

/** Walking zoom: whole pixels, at least 2, sized so about eleven tiles fit the short side. */
export function walkingZoom(screenW: number, screenH: number, tile: number): number {
  return Math.max(2, Math.floor(Math.min(screenW, screenH) / (tile * 11)));
}

/** Integer zoom from the walking zoom up to three times that. */
export function clampFrameZoom(zoom: number, fit: number): number {
  return Math.max(fit, Math.min(fit * 3, Math.round(zoom)));
}

/** One + or − press. About half a walking-zoom unit, so a phone and a monitor both reach 3× in a few taps. */
export function zoomStep(fit: number): number {
  return Math.max(1, Math.round(fit / 2));
}

/** Drag: the world follows the finger. dx and dy are in game pixels. */
export function panScroll(scrollX: number, scrollY: number, dx: number, dy: number, zoom: number): { scrollX: number; scrollY: number } {
  const z = zoom || 1;
  return { scrollX: scrollX - dx / z, scrollY: scrollY - dy / z };
}

/** Keep the world point under the screen point (sx, sy) when the zoom changes. */
export function zoomScroll(
  scrollX: number,
  scrollY: number,
  oldZoom: number,
  newZoom: number,
  sx: number,
  sy: number,
): { scrollX: number; scrollY: number } {
  const z0 = oldZoom || 1;
  const z1 = newZoom || 1;
  return scrollUnderPoint(scrollX + sx / z0, scrollY + sy / z0, sx, sy, z1);
}

/** Place a world point under a screen point at this zoom. */
export function scrollUnderPoint(wx: number, wy: number, sx: number, sy: number, zoom: number): { scrollX: number; scrollY: number } {
  const z = zoom || 1;
  return { scrollX: wx - sx / z, scrollY: wy - sy / z };
}

/** Label relative to the walking zoom: 1×, 1.5×, 3×. */
export function zoomLabel(zoom: number, fit: number): string {
  const n = Math.round((zoom / (fit || 1)) * 10) / 10;
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)) + '×';
}

/**
 * Who the picture is of. The closest person within PHOTO_NEAR of the focus becomes the subject.
 * Every raccoon in that range is flagged. When a view is given, the body has to overlap it,
 * so someone standing next to Sofi but outside the frame does not count.
 */
export function photoSubject(
  actors: PhotoActor[],
  focus: { x: number; y: number },
  fallback: string,
  view?: PhotoView | null,
  near = PHOTO_NEAR,
): { subject: string; raccoons: string[] } {
  let subject = fallback;
  let best = near;
  const raccoons: string[] = [];
  for (const a of actors) {
    if (view && !bodyInView(a, view)) continue;
    const d = Math.hypot(a.x - focus.x, a.y - focus.y);
    if (d >= near) continue;
    if (a.raccoon) raccoons.push(a.id);
    if (d < best) {
      best = d;
      subject = a.name;
    }
  }
  return { subject, raccoons };
}

function bodyInView(a: PhotoActor, view: PhotoView): boolean {
  return a.x + BODY_HALF >= view.x && a.x - BODY_HALF <= view.right && a.y >= view.y && a.y - BODY_ABOVE <= view.bottom;
}
