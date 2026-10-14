/** Small drawing helpers shared by the zone definitions (see zones.ts and plazaMap.ts). */
import type { PropPlace, ZoneDef } from './zones';
import { PROJECT_AMENITIES } from './projects';

// The restaurant's street entrance is also the arrival point after the opening pictures.
export const RESTAURANT_ENTRY = { zone: 'restaurant', x: 8, y: 12, dir: 'up' } as const;

// ------------------------------------------------------------------ builder
export class Builder {
  g: string[][];
  props: PropPlace[] = [];
  constructor(public w: number, public h: number, fill: string) {
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.g[j] && i >= 0 && i < this.w) this.g[j][i] = ch;
    return this;
  }
  set(x: number, y: number, ch: string) {
    if (this.g[y] && x >= 0 && x < this.w) this.g[y][x] = ch;
    return this;
  }
  prop(id: string, x: number, y: number, cond?: string) {
    this.props.push({ id, x, y, cond });
    return this;
  }
  /** interior box: walltop border, wall face row with windows */
  room(x: number, y: number, w: number, h: number, windows: number[] = []) {
    this.rect(x, y, w, h, '#');
    this.rect(x + 1, y, w - 2, 1, 'U');
    this.rect(x + 1, y + 1, w - 2, 1, 'W');
    for (const wx of windows) this.set(x + wx, y + 1, 'V');
    this.rect(x + 1, y + 2, w - 2, h - 3, 'f');
    return this;
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}

export function zone(b: Builder, z: Omit<ZoneDef, 'w' | 'h' | 'ground' | 'props'> & { props?: PropPlace[] }): ZoneDef {
  const amenities = PROJECT_AMENITIES.filter((a) => a.zone === z.id).map((a) => ({ id: 'project_' + a.id, x: a.x, y: a.y, label: a.title, action: 'project:' + a.id, cond: `proj_${a.project}_${a.phase}` }));
  return { ...z, interact: [...z.interact, ...amenities], w: b.w, h: b.h, ground: b.rows(), props: [...b.props, ...(z.props ?? [])] };
}

export function treeBorder(b: Builder, gaps: [number, number][], kinds = ['tree', 'tree_dark', 'pine']) {
  let k = 0;
  const near = (x: number, y: number) => gaps.some(([gx, gy]) => Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1);
  // trees only grow on grass (never in water, sand or paths)
  const gap = (x: number, y: number) => near(x, y) || !'gG'.includes(b.g[y]?.[x] ?? 'x');
  for (let x = 0; x < b.w; x += 2) {
    if (!gap(x, 0)) b.prop(kinds[k++ % kinds.length], x, 0);
    if (!gap(x, b.h - 1)) b.prop(kinds[k++ % kinds.length], x, b.h - 1);
  }
  for (let y = 2; y < b.h - 1; y += 2) {
    if (!gap(0, y)) b.prop(kinds[k++ % kinds.length], 0, y);
    if (!gap(b.w - 1, y)) b.prop(kinds[k++ % kinds.length], b.w - 1, y);
  }
}

