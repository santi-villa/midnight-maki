/**
 * Which way a seated guest looks. Across the table (above or below it) they face the camera or turn their back to it;
 * at the ends of the table they sit in profile, looking at it.
 */
import type { Grid } from '../world/grid';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface Spot { x: number; y: number }
export interface TableBox extends Spot { w: number; h: number }

export function facingTable(seat: Spot, table: TableBox): Facing {
  const dx = table.x + table.w / 2 - (seat.x + 0.5);
  const dy = table.y + table.h / 2 - (seat.y + 0.5);
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}

function beside(seat: Spot, table: TableBox): boolean {
  for (let j = 0; j < table.h; j++) {
    for (let i = 0; i < table.w; i++) {
      if (Math.max(Math.abs(seat.x - (table.x + i)), Math.abs(seat.y - (table.y + j))) <= 1) return true;
    }
  }
  return false;
}

/**
 * Push people who share a side of a narrow table away from each other.
 * Chairs already a tile apart stay where they are. Customer sprites are 28px wide and tiles are 16px.
 */
export function seatDrawOffset(seat: Spot, seats: Spot[], table: TableBox): { dx: number; dy: number } {
  const facing = facingTable(seat, table);
  const along = facing === 'up' || facing === 'down' ? 'x' : 'y';
  const same = seats.filter((s) => beside(s, table) && facingTable(s, table) === facing);
  same.sort((a, b) => a[along] - b[along] || a.x - b.x || a.y - b.y);
  const tight = same.some((s, i) => i > 0 && s[along] - same[i - 1][along] < 2);
  if (!tight || same.length < 2) return { dx: 0, dy: 0 };
  const index = same.findIndex((s) => s.x === seat.x && s.y === seat.y);
  if (index < 0) return { dx: 0, dy: 0 };
  const mid = (same.length - 1) / 2;
  const spread = Math.round((index - mid) * 16);
  return along === 'x' ? { dx: spread, dy: 0 } : { dx: 0, dy: spread };
}

/** Standing guests on neighbouring tiles step apart so their sprites do not cover each other. */
export function standApart(index: number, spots: Spot[]): { dx: number; dy: number } {
  const me = spots[index];
  if (!me) return { dx: 0, dy: 0 };
  let dx = 0;
  let dy = 0;
  for (let j = 0; j < spots.length; j++) {
    if (j === index) continue;
    const other = spots[j];
    if (Math.abs(other.x - me.x) + Math.abs(other.y - me.y) !== 1) continue;
    if (other.x === me.x) dy += me.y < other.y ? -8 : 8;
    else dx += me.x < other.x ? -8 : 8;
  }
  return { dx: Math.max(-8, Math.min(8, dx)), dy: Math.max(-8, Math.min(8, dy)) };
}

/** A seat counts as reachable when the guest can stand on it or on a neighbouring tile. */
export function seatsApproachable(grid: Grid, seats: Spot[], tables: TableBox[], fromX: number, fromY: number): boolean {
  const reach = (x: number, y: number) => !grid.isSolid(x, y) && grid.path(fromX, fromY, x, y) !== null;
  for (const seat of seats) {
    if (!tables.some((table) => beside(seat, table))) continue;
    if (!grid.isSolid(seat.x, seat.y)) {
      if (!reach(seat.x, seat.y)) return false;
      continue;
    }
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach(seat.x + dx, seat.y + dy));
    if (!open) return false;
  }
  return true;
}
