import { mixHex } from './lightmath';

/** Continuous period boundaries; sunset reaches zero before night starts. */
export function interiorSun(period: number, progress: number, rain: boolean) {
  const p = Math.max(0, Math.min(3, period)), k = Math.max(0, Math.min(1, progress));
  const strengths = [.42, .85, .65, 0], lengths = [36, 24, 58, 70], offsets = [12, 0, -16, -24];
  const colors = [0xffdfa3, 0xfff2d2, 0xffb467, 0xff9565];
  const n = Math.min(3, p + 1), t = k * k * (3 - 2 * k);
  return {
    strength: p === 3 ? 0 : (strengths[p] + (strengths[n] - strengths[p]) * t) * (rain ? .28 : 1),
    length: lengths[p] + (lengths[n] - lengths[p]) * t,
    offset: offsets[p] + (offsets[n] - offsets[p]) * t,
    color: mixHex(colors[p], colors[n], t),
  };
}

export interface InteriorBlock { x: number; y: number; w: number; h: number }
/** Room-local pool: internal partitions stop lamps from lighting the next bedroom.
 * These interiors use orthogonal walls, so four bounded scans suffice.
 */
export function lampRoom(ground: string[], px: number, py: number): InteriorBlock | null {
  let x = Math.floor(px / 16), y = Math.max(2, Math.floor(py / 16));
  const floor = (a: number, b: number) => 'fktm'.includes(ground[b]?.[a] ?? '#');
  if (!floor(x, y)) {
    const near = [[x,y+1],[x,y-1],[x+1,y],[x-1,y]].find(([a,b]) => floor(a,b));
    if (!near) return null;
    [x,y] = near;
  }
  let l = x, r = x, t = y, b = y;
  while (floor(l-1,y)) l--; while (floor(r+1,y)) r++;
  while (floor(x,t-1)) t--; while (floor(x,b+1)) b++;
  return { x: l * 16, y: t * 16, w: (r-l+1)*16, h: (b-t+1)*16 };
}
/** Conservative occlusion: shorten a beam at the first tall object, never through it. */
export function beamReach(x: number, y: number, width: number, length: number, skew: number, blocks: InteriorBlock[]) {
  for (let d = 2; d <= length; d += 2) {
    const cx = x + skew * d / length;
    if (blocks.some(b => y + d >= b.y && y + d <= b.y + b.h && cx + width / 2 > b.x && cx - width / 2 < b.x + b.w)) return d;
  }
  return length;
}
