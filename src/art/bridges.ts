import woodURL from '../assets/bridges/wood.png';
import { bridgeQuarters } from '../world/bridge';
import { ctx2d, makeCanvas, px, type Ctx } from './pixel';

export const BRIDGE_ATLAS_KEY = 'bridge-source';
export const BRIDGE_ATLAS_URL = woodURL;
let source: CanvasImageSource | null = null;
export function installBridgeAtlas(image: CanvasImageSource) {
  const canvas = makeCanvas(32, 48), c = ctx2d(canvas);
  c.drawImage(image, 0, 0);
  // Keep the native corners, using the honey timber of the previous cozy bridges.
  const pixels = c.getImageData(0, 0, 32, 48), p = pixels.data;
  const colors: Record<string, readonly number[]> = {
    '136,93,50': [197,161,116], '110,76,42': [188,149,105], '102,72,55': [137,101,68],
    '65,64,64': [111,80,55], '201,197,193': [239,208,160], '179,176,173': [221,181,126],
  };
  for (let i = 0; i < p.length; i += 4) {
    const color = colors[`${p[i]},${p[i + 1]},${p[i + 2]}`];
    if (color) [p[i], p[i + 1], p[i + 2]] = color;
  }
  c.putImageData(pixels, 0, 0); source = canvas;
}

/** Raised timber rail with caps, uprights and two crossbars, matching the former village kit. */
export function bridgeRailCanvas(axis: 'h' | 'v', length: number): HTMLCanvasElement {
  const span = length * 16, canvas = makeCanvas(axis === 'h' ? span + 5 : 5, axis === 'h' ? 10 : span + 10);
  const c = ctx2d(canvas);
  const post = (x: number, y: number) => {
    px(c, x, y, '#6f5037', 5, 10); px(c, x + 1, y + 1, '#c79b66', 3, 8);
    px(c, x, y, '#efd0a0', 5, 2); px(c, x + 1, y + 2, '#ddb57e', 1, 6);
  };
  if (axis === 'h') {
    px(c, 2, 2, '#79573c', span, 3); px(c, 2, 2, '#ddb57e', span, 1);
    px(c, 2, 7, '#79573c', span, 1);
    for (let x = 0; x <= span; x += 16) post(x, 0);
  } else {
    px(c, 1, 2, '#79573c', 3, span + 7); px(c, 1, 2, '#ddb57e', 1, span + 7);
    for (let y = 0; y <= span; y += 16) post(0, y);
  }
  return canvas;
}

export function drawBridgeTile(c: Ctx, x: number, y: number, mask: number) {
  if (source) {
    bridgeQuarters(mask).forEach(([sx, sy], i) => {
      c.drawImage(source!, sx, sy, 8, 8, x + i % 2 * 8, y + Math.floor(i / 2) * 8, 8, 8);
    });
    return;
  }
  // Same connected surface if the file is unavailable; no rail crosses a neighbouring walkway.
  px(c, x, y, '#96704e', 16, 16);
  for (let row = 0; row < 16; row += 4) px(c, x + 1, y + row, '#c6a173', 14, 3);
  if (!(mask & 1)) px(c, x, y, '#634a35', 16, 2);
  if (!(mask & 2)) px(c, x + 14, y, '#634a35', 2, 16);
  if (!(mask & 4)) px(c, x, y + 14, '#634a35', 16, 2);
  if (!(mask & 8)) px(c, x, y, '#634a35', 2, 16);
}
