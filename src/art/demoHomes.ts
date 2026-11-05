/** VectoRaith's two demo facades, assembled on the village grid at native resolution. */
import { cozyPatch } from './cozyAssets';
import { mix, px, shade, type Ctx } from './pixel';
import type { HomeLayout } from './homes';

/** The facade's roof blue: the pixels of the ramp around it are recoloured house by house. */
const ROOF_BASE = '#5a7188';
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Every house used to wear the demo's one slate-blue roof. Each one now takes the roof colour its prop already names
 * (data/props.ts: a slate or brown home, a red or green tea house, a blue fishmonger, a violet or rust florist), pulled a
 * third of the way back to the original slate so it stays muted. Only the blue tiles change: each keeps its place on the
 * ramp (light, mid, shadow), and the grey ink, the wooden gable and the plaster are left alone. Designed and checked
 * in .claude/skill-tests/stage4/roofs/build.py.
 */
function tintRoof(c: Ctx, W: number, top: number, h: number, roof: string) {
  if (!roof || roof.toLowerCase() === ROOF_BASE) return;
  const target = mix(roof, ROOF_BASE, 0.35);
  const y0 = Math.max(0, top), img = c.getImageData(0, y0, W, h - (y0 - top)), d = img.data;
  const L0 = lum(0x5a, 0x71, 0x88);
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (d[i + 3] === 0 || !(b > r + 12 && b >= g)) continue;
    const key = (r << 16) | (g << 8) | b;
    let out = cache.get(key);
    if (!out) {
      const hex = shade(target, ((lum(r, g, b) - L0) / 255) * 2.2);
      out = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      cache.set(key, out);
    }
    d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2];
  }
  c.putImageData(img, 0, y0);
}

export function drawDemoHome(c: Ctx, W: number, H: number, L: HomeLayout, roof = ROOF_BASE): boolean {
  // One continuous timber frontage. Repeat the blank panel; openings are placed once,
  // using the same coordinates as doors and warm window masks.
  if (!cozyPatch(c, 'homeFacade', 9, 44, 1, 28, 0, H - 32)) return false;
  for (let x = 1; x < W; x++) cozyPatch(c, 'homeFacade', 9, 44, 1, 28, x, H - 32);
  for (const x of [0, 32, 64, W - 4]) cozyPatch(c, 'homeFacade', 12, 44, 4, 28, x, H - 32);
  const shop = L.trade === 1 || L.trade === 3;
  const frame = shop ? 'shopFacade' : 'homeFacade';
  const sourceW = shop ? 80 : 64;
  // Keep both roof edges and the gable intact; add 8px modules to the plain slope.
  cozyPatch(c, frame, 0, 0, 8, 44, 0, H - 76);
  for (let x = 8; x < W - sourceW + 8; x += 8) cozyPatch(c, frame, 8, 0, 8, 44, x, H - 76);
  cozyPatch(c, frame, 8, 0, sourceW - 8, 44, W - sourceW + 8, H - 76);
  tintRoof(c, W, H - 76, 44, roof);
  for (const win of L.windows) {
    cozyPatch(c, 'homeFacade', 40, 48, 16, 20, win.x - 3, H - 28);
    if (L.trade === 3) cozyPatch(c, 'shopFacade', 8, 60, 24, 16, win.x - 7, H - 17);
  }
  // Closed wooden genkan door from the demo, with its threshold on the saved entry tile.
  cozyPatch(c, 'homeFacade', 16, 48, 16, 24, L.door.x, L.door.y);
  if (shop) {
    const colors = L.trade === 1 ? ['#a96f67', '#f4e4c7'] : ['#9d8194', '#f4e4c7'];
    for (let x = 0; x < W; x += 4) px(c, x, H - 34, colors[(x / 4) % 2], 4, 5);
    px(c, 0, H - 29, '#795a3e', W, 1);
  }
  const lx = L.right ? L.door.x - 9 : L.door.x + L.door.w + 9;
  px(c, lx, L.door.y - 5, '#795a3e', 1, 4);
  px(c, lx - 2, L.door.y - 2, '#795a3e', 5, 9);
  px(c, lx - 1, L.door.y - 1, '#e9b87a', 3, 7);
  return true;
}
