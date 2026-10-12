/** Walkability grid + A* pathfinding (4-directional). DOM-free, unit tested. */
export class Grid {
  readonly w: number;
  readonly h: number;
  private solid: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.solid = new Uint8Array(w * h);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  isSolid(x: number, y: number) {
    return !this.inside(x, y) || this.solid[y * this.w + x] > 0;
  }
  setSolid(x: number, y: number, v: boolean) {
    if (this.inside(x, y)) this.solid[y * this.w + x] = v ? 1 : 0;
  }
  clone(): Grid {
    const g = new Grid(this.w, this.h);
    g.solid.set(this.solid);
    return g;
  }

  /** A* from (sx,sy) to (tx,ty). If target is solid, paths to the nearest walkable neighbour. */
  path(sx: number, sy: number, tx: number, ty: number, maxNodes = 4000): [number, number][] | null {
    if (!this.inside(tx, ty)) return null;
    if (this.isSolid(tx, ty)) {
      const n = this.nearestWalkable(tx, ty, sx, sy);
      if (!n) return null;
      [tx, ty] = n;
    }
    if (sx === tx && sy === ty) return [];
    const W = this.w;
    const start = sy * W + sx;
    const goal = ty * W + tx;
    const g = new Map<number, number>([[start, 0]]);
    const came = new Map<number, number>();
    const open: { k: number; f: number }[] = [{ k: start, f: 0 }];
    const closed = new Set<number>();
    let visited = 0;
    while (open.length) {
      // small open sets: linear min search is fine and allocation-free
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const { k } = open[bi];
      open.splice(bi, 1);
      if (k === goal) {
        const out: [number, number][] = [];
        let c = k;
        while (c !== start) {
          out.push([c % W, Math.floor(c / W)]);
          c = came.get(c)!;
        }
        return out.reverse();
      }
      if (closed.has(k)) continue;
      closed.add(k);
      if (++visited > maxNodes) return null;
      const x = k % W;
      const y = Math.floor(k / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isSolid(nx, ny)) continue;
        const nk = ny * W + nx;
        if (closed.has(nk)) continue;
        const ng = g.get(k)! + 1;
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, k);
          open.push({ k: nk, f: ng + Math.abs(nx - tx) + Math.abs(ny - ty) });
        }
      }
    }
    return null;
  }

  nearestWalkable(x: number, y: number, fromX = x, fromY = y): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let r = 1; r <= 3 && !best; r++)
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          if (Math.abs(i) !== r && Math.abs(j) !== r) continue;
          const nx = x + i;
          const ny = y + j;
          if (this.isSolid(nx, ny)) continue;
          const d = Math.abs(i) + Math.abs(j) + 0.01 * (Math.abs(nx - fromX) + Math.abs(ny - fromY));
          if (d < bd) {
            bd = d;
            best = [nx, ny];
          }
        }
    return best;
  }

  /** flood fill reachability from a tile; used to forbid furniture that would trap anyone */
  reachableCount(sx: number, sy: number): number {
    if (this.isSolid(sx, sy)) return 0;
    const seen = new Uint8Array(this.w * this.h);
    const stack = [sy * this.w + sx];
    seen[stack[0]] = 1;
    let n = 0;
    while (stack.length) {
      const k = stack.pop()!;
      n++;
      const x = k % this.w;
      const y = Math.floor(k / this.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isSolid(nx, ny)) continue;
        const nk = ny * this.w + nx;
        if (seen[nk]) continue;
        seen[nk] = 1;
        stack.push(nk);
      }
    }
    return n;
  }
}
