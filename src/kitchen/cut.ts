/** Cutting a roll: the knife follows subtle marks; a cut is real progress made by dragging the blade through. */
export interface Mark { x: number; done: number; off: number }

/** x positions (0..1 across the roll) of the cuts for `pieces`, halves first, then the quarters, etc. */
export function cutOrder(pieces: number): number[] {
  const n = Math.max(2, pieces), all = Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
  const mid = all.splice(Math.floor(all.length / 2), 1);
  return [...mid, ...all.sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5))];
}

export function newMarks(pieces: number): Mark[] {
  return cutOrder(pieces).map((x) => ({ x, done: 0, off: 0 }));
}

/** advances the blade at x (0..1) moving down by dy (fraction of roll height). Returns the index of the mark cut, if any. */
export function knifeMove(marks: Mark[], x: number, dy: number, tol: number): number {
  if (dy <= 0) return -1;
  let best = -1, bd = tol;
  marks.forEach((m, i) => { if (m.done < 1 && Math.abs(m.x - x) <= bd) { bd = Math.abs(m.x - x); best = i; } });
  if (best < 0) return -1;
  const m = marks[best];
  m.done = Math.min(1, m.done + dy);
  m.off = Math.max(m.off, Math.abs(m.x - x));
  return m.done >= 1 ? best : -1;
}

/** x of each piece's centre once all cuts are made, with a gap that opens as cuts finish */
export function pieceLayout(pieces: number, marks: Mark[], width: number, gap: number): { x: number; w: number }[] {
  const done = marks.filter((m) => m.done >= 1).map((m) => m.x).sort((a, b) => a - b);
  const edges = [0, ...done, 1], out: { x: number; w: number }[] = [];
  const n = edges.length - 1;
  for (let i = 0; i < n; i++) {
    const a = edges[i], b = edges[i + 1];
    out.push({ x: ((a + b) / 2 - 0.5) * width + (i - (n - 1) / 2) * gap, w: (b - a) * width });
  }
  void pieces;
  return out;
}

/** 0..1: how true the cuts were to their marks (tol = a missed-by-this-much cut scores 0) */
export function cutScore(marks: Mark[], tol: number): number {
  if (!marks.length) return 1;
  return marks.reduce((s, m) => s + Math.max(0, 1 - m.off / tol), 0) / marks.length;
}
