/** Which way a seated guest looks: always towards their table, whatever the chair was rotated to. */
export type Facing = 'up' | 'down' | 'left' | 'right';

export function facingTable(seat: { x: number; y: number }, table: { x: number; y: number; w: number; h: number }): Facing {
  const dx = table.x + table.w / 2 - (seat.x + 0.5);
  const dy = table.y + table.h / 2 - (seat.y + 0.5);
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}
