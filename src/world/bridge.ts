/** Eight neighbours select complete native quarters, including the inner corner of an L-shaped pier. */
export function bridgeMask(ground: readonly string[], x: number, y: number): number {
  let mask = 0;
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  directions.forEach(([dx, dy], bit) => {
    if ('bpc'.includes(ground[y + dy]?.[x + dx] ?? '?')) mask |= 1 << bit;
  });
  return mask;
}

/** RPG Maker's native 32x48 autotile format: the top-right quarters are concave corners. */
export function bridgeQuarters(mask: number): readonly (readonly [number, number])[] {
  const n = !!(mask & 1), e = !!(mask & 2), s = !!(mask & 4), w = !!(mask & 8);
  return [
    !n ? [w ? 16 : 0, 16] : !w ? [0, 32] : mask & 128 ? [16, 32] : [16, 0],
    !n ? [e ? 8 : 24, 16] : !e ? [24, 32] : mask & 16 ? [8, 32] : [24, 0],
    !s ? [w ? 16 : 0, 40] : !w ? [0, 24] : mask & 64 ? [16, 24] : [16, 8],
    !s ? [e ? 8 : 24, 40] : !e ? [24, 24] : mask & 32 ? [8, 24] : [24, 8],
  ];
}

export interface BridgeRail { x: number; y: number; length: number; axis: 'h' | 'v' }

/** Rails follow only the water-facing outline, including convex and concave bends.
 * Landings stay open. Never outline two overlapping rectangular bridge props.
 */
export function bridgeRails(ground: readonly string[]): BridgeRail[] {
  const rows = new Map<number, number[]>(), vertical: BridgeRail[] = [];
  const water = (x: number, y: number) => 'wd'.includes(ground[y]?.[x] ?? '?');
  const horizontal = (x: number, y: number) => {
    const row = rows.get(y) ?? []; row.push(x); rows.set(y, row);
  };
  for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) {
    if (ground[y][x] !== 'b') continue;
    if (water(x, y - 1)) horizontal(x, y);
    if (water(x, y + 1)) horizontal(x, y + 1);
    // One tile per vertical sprite lets actors sort correctly along a long pier.
    if (water(x - 1, y)) vertical.push({ x, y, length: 1, axis: 'v' });
    if (water(x + 1, y)) vertical.push({ x: x + 1, y, length: 1, axis: 'v' });
  }
  const rails: BridgeRail[] = [];
  for (const [y, row] of rows) {
    row.sort((a, b) => a - b);
    for (let i = 0; i < row.length;) {
      const x = row[i++]; let length = 1;
      while (i < row.length && row[i] === x + length) { length++; i++; }
      rails.push({ x, y, length, axis: 'h' });
    }
  }
  return [...rails, ...vertical];
}
