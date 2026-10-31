/** Keep the entire working aisle and the tall counter sprites below the HUD. */
import { KITCHEN } from '../galley/layout';
import { walkingZoom } from './frameMath';
export const KITCHEN_VIEW = { x: KITCHEN.x - 1, y: KITCHEN.y - 3, w: KITCHEN.w + 2, h: KITCHEN.h + 4 };
export function kitchenCameraFrame(width: number, height: number, tile = 16) {
  const top = Math.min(132, height * .23), bottom = Math.min(108, height * .2);
  const fit = Math.min((width - 24) / (KITCHEN_VIEW.w * tile), (height - top - bottom) / (KITCHEN_VIEW.h * tile), walkingZoom(width, height, tile));
  const zoom = Math.max(.75, fit >= 2 ? Math.floor(fit) : Math.floor(fit * 4) / 4);
  return { zoom, x: (KITCHEN_VIEW.x + KITCHEN_VIEW.w / 2) * tile, y: KITCHEN_VIEW.y * tile + (height / 2 - top) / zoom, top, bottom };
}
