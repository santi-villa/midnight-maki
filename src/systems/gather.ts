/** Daily-varying gathering spots. Deterministic per day so reloading never rerolls loot. */
import { game } from '../core/state';
import { ZONES } from '../data/zones';
import { rng } from '../art/pixel';

export interface GatherSpot { zone: string; idx: number; x: number; y: number; item: string; }

function zoneSeed(z: string) {
  let h = 7;
  for (const c of z) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function gatherSpots(zone: string): GatherSpot[] {
  const def = ZONES[zone];
  if (!def) return [];
  const day = game.save.time.day;
  const out: GatherSpot[] = [];
  def.gather.forEach((g, idx) => {
    const r = rng(zoneSeed(zone) + day * 977 + idx * 131);
    const active = r() < 0.65 || idx === day % Math.max(1, def.gather.length);
    if (!active) return;
    if (game.flag(`g_${zone}_${idx}`) === day) return;
    let item = g.pool[Math.floor(r() * g.pool.length)];
    // special collectibles appear only after their story flag
    if (item === 'bottle_msg' && !game.has('ch2_started')) item = g.pool[0];
    if (item === 'sakura' && !game.has('unlock_garden')) item = g.pool[0];
    out.push({ zone, idx, x: g.x, y: g.y, item });
  });
  return out;
}

export function markGathered(spot: GatherSpot) {
  game.setFlag(`g_${spot.zone}_${spot.idx}`, game.save.time.day);
}
