/** Where the outdoor zones sit relative to each other, worked out from the doors that join them. Pure data, no scene. */
import { ZONES, type ZoneDef } from '../data/zones';

export interface Placed { z: ZoneDef; x: number; y: number }

/** Places every outdoor zone next to the one it connects to, door against door. */
export function layout(): Placed[] {
  const root = ZONES.plaza;
  const placed = new Map<string, Placed>([[root.id, { z: root, x: 0, y: 0 }]]);
  const queue = [root.id];
  while (queue.length) {
    const cur = placed.get(queue.shift()!)!;
    for (const d of cur.z.doors) {
      const q = ZONES[d.to];
      if (!q || !q.outdoor || placed.has(q.id)) continue;
      const back = q.doors.find((e) => e.to === cur.z.id);
      if (!back) continue;
      let x = cur.x, y = cur.y;
      if (d.y === 0) { x = cur.x + d.x - back.x; y = cur.y - q.h; }
      else if (d.y >= cur.z.h - 1) { x = cur.x + d.x - back.x; y = cur.y + cur.z.h; }
      else if (d.x === 0) { x = cur.x - q.w; y = cur.y + d.y - back.y; }
      else { x = cur.x + cur.z.w; y = cur.y + d.y - back.y; }
      placed.set(q.id, { z: q, x, y });
      queue.push(q.id);
    }
  }
  return [...placed.values()];
}

/** The outdoor zone a place belongs to, and the tile where its door opens (for the player and friends inside buildings). */
export function outdoorSpot(zoneId: string, tx: number, ty: number): { zone: string; x: number; y: number } | null {
  if (ZONES[zoneId]?.outdoor) return { zone: zoneId, x: tx, y: ty };
  const seen = new Set([zoneId]);
  let frontier = [zoneId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) for (const z of Object.values(ZONES)) {
      if (seen.has(z.id)) continue;
      const door = z.doors.find((d) => d.to === id);
      if (!door) continue;
      if (z.outdoor) return { zone: z.id, x: door.x, y: door.y };
      seen.add(z.id); next.push(z.id);
    }
    frontier = next;
  }
  return null;
}

