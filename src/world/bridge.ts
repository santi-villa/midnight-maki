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
