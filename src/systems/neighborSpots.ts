/** Places in the village where a neighbour can spend time, read from the map data (no Phaser, no walking grid). */
import type { Dir } from '../core/types';
import type { NpcAct } from '../data/characters';
import { ZONES } from '../data/zones';
import { REN_STALL, type Neighbor } from '../data/neighbors';

export interface Place { zone: string; x: number; y: number; act?: NpcAct; dir?: Dir; seatLift?: number; kind: string }

const BENCH_ZONES = ['plaza', 'beach', 'garden', 'library'];
export const benchSpots = (zone: string): Place[] =>
  (ZONES[zone]?.props ?? []).filter((p) => p.id === 'bench' && !p.cond).flatMap((p) => [0, 1].map((i) => ({ zone, x: p.x + i, y: p.y + 1, act: (zone === 'library' ? 'read' : 'sit') as NpcAct, dir: 'down' as Dir, seatLift: 12, kind: zone === 'library' ? 'read' : 'bench' })));

const at = (zone: string, kind: string, pts: [number, number][], act?: NpcAct): Place[] => pts.map(([x, y]) => ({ zone, x, y, act, dir: 'down' as Dir, kind }));

/** curated standing places: in front of the fountain, on the shore, in the gardens... */
export const FOUNTAIN = at('plaza', 'fountain', [[13, 10], [17, 10], [13, 14], [17, 14]], 'look');
export const SHORE = at('beach', 'sea', [[6, 14], [10, 14], [14, 14], [19, 14], [24, 14], [29, 14], [35, 14], [41, 14]], 'look');
export const GARDEN = at('garden', 'garden', [[12, 11], [16, 9], [10, 6]], 'look');
export const FOREST = at('forest', 'forest', [[14, 18], [20, 16], [10, 19]], 'look');
export const MARKET = at('market', 'market', [[8, 10], [15, 11], [20, 9]], 'look');
export const STROLL = [
  ...at('plaza', 'stroll', [[12, 10], [19, 10], [12, 16], [18, 16], [15, 15], [15, 22], [15, 8], [30, 12], [34, 13], [10, 31], [22, 31], [6, 40]]),
  ...at('beach', 'stroll', [[12, 12], [26, 12], [38, 12]]),
];
/** where they go to a shop: just inside its door */
export function shopSpot(zone: string): Place | null {
  if (zone === 'plaza_ren') return { zone: 'plaza', x: REN_STALL.x + 1, y: REN_STALL.y + 1, act: 'work', dir: 'up', kind: 'shop' };
  const door = ZONES.plaza.doors.find((d) => d.to === zone);
  return door ? { zone, x: door.tx + 1, y: door.ty - 1, act: 'look', dir: 'down', kind: 'shop' } : null;
}
export const homeSpot = (n: Neighbor): Place => ({ zone: n.home, x: 5, y: 5, kind: 'home' });
export const allBenches = () => BENCH_ZONES.flatMap(benchSpots);
