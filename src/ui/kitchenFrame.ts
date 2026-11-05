/**
 * The kitchen is framed as a whole, centred between the HUD bars, keeping the walking zoom whenever it fits (zooming out only
 * when the screen really is too small for it). The frame is the map's own rows (nothing above row 0 but void), from the back wall
 * and its tall counter sprites to the gap row that leads back to the dining hall, plus a tile of air on each side.
 */
import { KITCHEN } from '../galley/layout';
import { walkingZoom } from './frameMath';
export const KITCHEN_FOCUS = { x: KITCHEN.x - 1, y: 0, w: KITCHEN.w + 2, h: KITCHEN.y + KITCHEN.h + 1 };
export function kitchenCameraFrame(width: number, height: number, tile = 16, px = 1) {
  // the HUD bars and the side margin are CSS pixels; `px` canvas pixels per CSS pixel (core/pixelRatio.ts)
  const top = Math.min(132 * px, height * .23), bottom = Math.min(108 * px, height * .2);
  const fit = Math.min((width - 24 * px) / (KITCHEN_FOCUS.w * tile), (height - top - bottom) / (KITCHEN_FOCUS.h * tile), walkingZoom(width, height, tile));
  const zoom = Math.max(.75, fit >= 2 ? Math.floor(fit) : Math.floor(fit * 4) / 4);
  // the camera's centre is the middle of the screen: the kitchen's centre goes to the middle of what the bars leave free
  const cx = (KITCHEN_FOCUS.x + KITCHEN_FOCUS.w / 2) * tile, cy = (KITCHEN_FOCUS.y + KITCHEN_FOCUS.h / 2) * tile;
  return { zoom, x: cx, y: cy + (bottom - top) / (2 * zoom), top, bottom };
}
