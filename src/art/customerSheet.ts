/**
 * Turns the standalone 28x40 customers (src/art/customers.ts) into texture sheets the world can use.
 * The sheet follows the shared 30-frame layout (FRAMES in characters.ts) so an Actor drives it unchanged, plus extras:
 *   30..33  eating animation, 34  second sitting frame (side view), 35..40 sitting facing the camera, 41..46 sitting with their back to it.
 * Customers only have a front view and a right-facing side view, so:
 *   - down = the front view, hopping a little (alternating mirrored) to read as steps,
 *   - up   = the side view walking (no back view was drawn),
 *   - left = the right-facing frames mirrored.
 */
import { buildCustomerFrames, CUSTOMER_H, CUSTOMER_W, CUSTOMERS, type CustomerId, type CustomerOutfit } from './customers';
import type { PixBuf } from './pixbuf';
import { ctx2d, makeCanvas } from './pixel';

export const CUSTOMER_IDS: readonly CustomerId[] = CUSTOMERS.map((c) => c.id);
export const CUSTOMER_FRAME_COUNT = 47;
/** sitting facing the camera: 35 rest, 36 breathe, 37..40 eat; with their back to the camera: 41, 42, 43..46 */
export const CUSTOMER_FRONT_SIT = 35;
export const CUSTOMER_BACK_SIT = 41;
export const CUSTOMER_EAT_FRAMES = [30, 31, 32, 33] as const;
export const CUSTOMER_SIT_FRAMES = [29, 34] as const;

function toCanvas(b: PixBuf): HTMLCanvasElement {
  const c = makeCanvas(b.w, b.h);
  const g = ctx2d(c);
  const img = g.createImageData(b.w, b.h);
  img.data.set(b.data);
  g.putImageData(img, 0, 0);
  return c;
}

/** the frame mirrored, optionally moved up by `lift` pixels (feet then float 1px: a cheap step) */
function variant(src: HTMLCanvasElement, mirror: boolean, lift = 0): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  if (mirror) {
    g.translate(src.width, 0);
    g.scale(-1, 1);
  }
  g.drawImage(src, 0, -lift);
  return c;
}

export function buildCustomerSheet(id: CustomerId, outfit: CustomerOutfit = {}): { canvas: HTMLCanvasElement; fw: number; fh: number; count: number } {
  const f = buildCustomerFrames(id, outfit).map(toCanvas);
  const front = f[0];
  const sheet: HTMLCanvasElement[] = new Array(CUSTOMER_FRAME_COUNT);
  const rightWalk = [f[4], f[5], f[6], f[7]];
  // 0..2 down
  sheet[0] = front;
  sheet[1] = variant(front, false, 1);
  sheet[2] = variant(front, true, 1);
  // 3..5 up: side walking
  sheet[3] = f[2];
  sheet[4] = rightWalk[1];
  sheet[5] = rightWalk[3];
  // 6..8 right, 9..11 left
  sheet[6] = f[2];
  sheet[7] = rightWalk[1];
  sheet[8] = rightWalk[3];
  for (let i = 0; i < 3; i++) sheet[9 + i] = variant(sheet[6 + i], true);
  // blinks and expressions
  sheet[12] = f[1];
  sheet[13] = front;
  sheet[14] = front;
  sheet[15] = f[1];
  sheet[16] = f[3];
  sheet[17] = variant(f[3], true);
  sheet[18] = front;
  sheet[19] = front;
  // breathing frames repeat the base poses
  sheet[20] = front;
  sheet[21] = sheet[3];
  sheet[22] = sheet[6];
  sheet[23] = sheet[9];
  // action poses (customers never cook / wave / read): fall back to standing
  for (const i of [24, 25, 26, 27, 28]) sheet[i] = front;
  sheet[29] = f[8]; // sit
  CUSTOMER_EAT_FRAMES.forEach((idx, i) => (sheet[idx] = f[10 + i]));
  sheet[34] = f[9];
  for (let i = 0; i < 6; i++) { sheet[CUSTOMER_FRONT_SIT + i] = f[14 + i]; sheet[CUSTOMER_BACK_SIT + i] = f[20 + i]; }
  const canvas = makeCanvas(CUSTOMER_W * CUSTOMER_FRAME_COUNT, CUSTOMER_H);
  const g = ctx2d(canvas);
  sheet.forEach((fr, i) => g.drawImage(fr, i * CUSTOMER_W, 0));
  return { canvas, fw: CUSTOMER_W, fh: CUSTOMER_H, count: CUSTOMER_FRAME_COUNT };
}
