/** Plating: each piece is dropped on the plate by hand; the plate gently corrects overlaps and strays. */
export interface PlatePiece { x: number; y: number }
export interface PlateShape { cx: number; cy: number; rx: number; ry: number }

export const inPlate = (p: PlatePiece, pl: PlateShape, margin = 0) => ((p.x - pl.cx) / (pl.rx - margin)) ** 2 + ((p.y - pl.cy) / (pl.ry - margin)) ** 2 <= 1;

/** Moves a dropped piece to the nearest free spot inside the plate. Returns null if dropped far from the plate. */
export function settle(p: PlatePiece, others: PlatePiece[], pl: PlateShape, size: number, reach = 1.5): PlatePiece | null {
  let q = { ...p };
  const far = ((q.x - pl.cx) / (pl.rx * reach)) ** 2 + ((q.y - pl.cy) / (pl.ry * reach)) ** 2 > 1;
  if (far) return null;
  const clampIn = (a: PlatePiece) => {
    const nx = (a.x - pl.cx) / (pl.rx - size * 0.6), ny = (a.y - pl.cy) / (pl.ry - size * 0.4), d = Math.hypot(nx, ny);
    return d > 1 ? { x: pl.cx + nx / d * (pl.rx - size * 0.6), y: pl.cy + ny / d * (pl.ry - size * 0.4) } : a;
  };
  q = clampIn(q);
  for (let it = 0; it < 24; it++) {
    let moved = false;
    for (const o of others) {
      const dx = q.x - o.x, dy = (q.y - o.y) * 1.3, d = Math.hypot(dx, dy);
      if (d < size) {
        const push = (size - d) + 0.5, ux = d < 0.01 ? 1 : dx / d, uy = d < 0.01 ? 0 : dy / d / 1.3;
        q = clampIn({ x: q.x + ux * push, y: q.y + uy * push });
        moved = true;
      }
    }
    if (!moved) break;
  }
  return q;
}

/** nice default spots, used by quick plating */
export function autoSpots(n: number, pl: PlateShape, size: number): PlatePiece[] {
  const out: PlatePiece[] = [];
  const cols = n <= 4 ? n : Math.ceil(n / 2), rows = n <= 4 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    out.push({ x: pl.cx + (c - (inRow - 1) / 2) * (size + 1), y: pl.cy + (rows === 1 ? 0 : (r - 0.5) * (size * 0.8)) });
  }
  return out;
}

/** 0..1 neatness: all inside, spaced evenly and roughly centred */
export function plateScore(ps: PlatePiece[], pl: PlateShape): number {
  if (!ps.length) return 1;
  const inside = ps.filter((p) => inPlate(p, pl)).length / ps.length;
  const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length, my = ps.reduce((s, p) => s + p.y, 0) / ps.length;
  const centred = Math.max(0, 1 - Math.hypot((mx - pl.cx) / pl.rx, (my - pl.cy) / pl.ry));
  return Math.max(0, Math.min(1, inside * 0.7 + centred * 0.3));
}
