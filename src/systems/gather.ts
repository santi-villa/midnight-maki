/** Daily-varying gathering spots. Deterministic per day so reloading never rerolls loot. */
import { game } from '../core/state';
import { seasonOf } from '../core/balance';
import { ZONES } from '../data/zones';
import { PROJECT_GATHER } from '../data/projects';
import { rng } from '../art/pixel';

/** Rain leaves the ground damp through the next day. Older saves simply have no flag yet. */
export function noteDamp(day: number, raining: boolean) {
  if (raining) game.setFlag('damp_day', day);
}

/** Shiitake like a recent rain, and autumn in general. Winter stays bare. */
export function mushroomsUp(day: number): boolean {
  const season = seasonOf(day);
  if (season === 3) return false;
  if (season === 2) return true;
  const damp = game.flag('damp_day');
  return typeof damp === 'number' && day <= damp + 1;
}

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
  const extra = PROJECT_GATHER.filter((g) => g.zone === zone && game.has(`proj_${g.project}_${g.phase}`));
  [...def.gather, ...extra].forEach((g, idx) => {
    const r = rng(zoneSeed(zone) + day * 977 + idx * 131);
    const active = idx >= def.gather.length || r() < 0.65 || idx === day % Math.max(1, def.gather.length);
    if (!active) return;
    if (game.flag(`g_${zone}_${idx}`) === day) return;
    let item = g.pool[Math.floor(r() * g.pool.length)];
    // special collectibles appear only after their story flag
    if (item === 'bottle_msg' && !game.has('ch2_started')) item = g.pool[0];
    if (item === 'sakura' && !game.has('unlock_garden')) item = g.pool[0];
    if (mushroomsUp(day) && g.pool.includes('shiitake') && item !== 'bottle_msg' && r() < 0.72) item = 'shiitake';
    out.push({ zone, idx, x: g.x, y: g.y, item });
  });
  // One extra mushroom on damp ground, off the paths. The index stays clear of the authored spots.
  if (mushroomsUp(day) && (zone === 'garden' || zone === 'forest')) {
    const idx = def.gather.length + 100;
    if (game.flag(`g_${zone}_${idx}`) !== day) {
      const at = zone === 'garden' ? { x: 7, y: 16 } : { x: 9, y: 17 };
      out.push({ zone, idx, ...at, item: 'shiitake' });
    }
  }
  return out;
}

export function markGathered(spot: GatherSpot) {
  game.setFlag(`g_${spot.zone}_${spot.idx}`, game.save.time.day);
}
