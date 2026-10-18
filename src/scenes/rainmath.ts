/** Visual wetness only: no clock, save, collisions or crop changes. */
export interface RainCell { x: number; y: number; puddle: boolean; seed: number }

export function rainCells(ground: string[], blocked: (x: number, y: number) => boolean): RainCell[] {
  const cells: RainCell[] = [];
  for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) {
    const ch = ground[y][x];
    if (!'gGpcsobh'.includes(ch) || blocked(x, y)) continue;
    const seed = (Math.imul(x + 7, 73856093) ^ Math.imul(y + 11, 19349663)) >>> 0;
    cells.push({ x, y, puddle: 'gGpco'.includes(ch), seed });
  }
  return cells;
}

export function wetnessAfter(wet: number, rain: boolean, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return wet;
  return Math.max(0, Math.min(1, wet + seconds * (rain ? 0.012 : -0.004)));
}

/** Visited outdoor zones keep drying/gathering rain while the player is inside. Never serialized. */
export class WetGround {
  private zones = new Map<string, number>();
  visit(zone: string): number {
    if (!this.zones.has(zone)) this.zones.set(zone, 0);
    return this.zones.get(zone)!;
  }
  advance(seconds: number, rain: boolean) {
    for (const [zone, wet] of this.zones) this.zones.set(zone, wetnessAfter(wet, rain, seconds));
  }
}
