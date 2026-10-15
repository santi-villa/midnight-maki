/**
 * Where a party stands when the hall has no free table.
 * Reception is just inside, to the left of the door. The wait cluster is further aside,
 * off the aisle the staff uses between the door and the kitchen.
 */
export interface WaitTile { x: number; y: number }

export const RECEPTION_SPOTS: WaitTile[] = [
  { x: 5, y: 10 }, { x: 6, y: 10 },
  { x: 5, y: 11 }, { x: 6, y: 11 },
];

export const WAITING_SPOTS: WaitTile[] = [
  { x: 4, y: 8 }, { x: 5, y: 8 },
  { x: 4, y: 9 }, { x: 5, y: 9 },
  { x: 3, y: 8 }, { x: 3, y: 9 },
  { x: 6, y: 8 }, { x: 6, y: 9 },
];

/** One party may wait without a table. A group is at most four people. */
export function queueHasRoom(parties: number, people: number, incoming = 1): boolean {
  return parties < 1 && people + incoming <= 4;
}

function usable(tile: WaitTile, blocked: Set<string>, free: (x: number, y: number) => boolean): boolean {
  return !blocked.has(`${tile.x},${tile.y}`) && free(tile.x, tile.y);
}

/**
 * Up to `count` free tiles from one cluster.
 * A short list means the cluster cannot hold the whole group, so the caller tries the next one.
 */
export function planWaitSpots(
  count: number,
  blocked: Set<string>,
  free: (x: number, y: number) => boolean,
  preferred: WaitTile[] = WAITING_SPOTS,
): WaitTile[] {
  const used = new Set(blocked);
  const out: WaitTile[] = [];
  for (const tile of preferred) {
    if (out.length >= count) break;
    const key = `${tile.x},${tile.y}`;
    if (used.has(key) || !free(tile.x, tile.y)) continue;
    used.add(key);
    out.push(tile);
  }
  return out;
}

const DOOR_LANE = (x: number, y: number) => x >= 7 && x <= 10 && y >= 10;

/**
 * Free tiles in the hall when both clusters are full.
 * The group stays in one connected patch, and never on the door lane.
 */
export function scanWaitSpots(
  count: number,
  blocked: Set<string>,
  free: (x: number, y: number) => boolean,
): WaitTile[] {
  if (count <= 0) return [];
  const open: WaitTile[] = [];
  for (let y = 7; y <= 11; y++) {
    for (let x = 3; x <= 15; x++) {
      if (DOOR_LANE(x, y)) continue;
      if (!usable({ x, y }, blocked, free)) continue;
      open.push({ x, y });
    }
  }
  const key = (tile: WaitTile) => `${tile.x},${tile.y}`;
  const have = new Set(open.map(key));
  const seen = new Set<string>();
  let best: WaitTile[] = [];
  for (const start of open) {
    const sk = key(start);
    if (seen.has(sk)) continue;
    const cluster: WaitTile[] = [];
    const queue = [start];
    seen.add(sk);
    while (queue.length) {
      const cur = queue.shift()!;
      cluster.push(cur);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: cur.x + dx, y: cur.y + dy };
        const nk = key(next);
        if (!have.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        queue.push(next);
      }
    }
    if (cluster.length > best.length) best = cluster;
    if (best.length >= count) break;
  }
  return best.slice(0, count);
}

export function spotsFree(tiles: WaitTile[], blocked: Set<string>, free: (x: number, y: number) => boolean): boolean {
  return tiles.every((tile) => usable(tile, blocked, free));
}
