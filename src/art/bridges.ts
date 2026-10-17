import woodURL from '../assets/bridges/wood.png';
import { bridgeQuarters } from '../world/bridge';
import { px, type Ctx } from './pixel';

export const BRIDGE_ATLAS_KEY = 'bridge-source';
export const BRIDGE_ATLAS_URL = woodURL;
let source: CanvasImageSource | null = null;
export function installBridgeAtlas(image: CanvasImageSource) { source = image; }

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
