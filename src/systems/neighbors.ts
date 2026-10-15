/** The living part of the ambient neighbours: they follow the day's plan around the village, in every map, seen or not. */
import { game } from '../core/state';
import type { RoutineStop } from '../data/characters';
import { NEIGHBORS, type Neighbor } from '../data/neighbors';
import { buildZone } from '../world/zoneRuntime';
import type { Grid } from '../world/grid';
import { Journey } from './journeys';
import { planVillage, type PlanContext } from './neighborPlan';
import type { Place } from './neighborSpots';

export interface NeighborState { n: Neighbor; trip: Journey; place: Place & { ride?: boolean; withFriend?: string }; key: string; ride: boolean }

export const WALK_TILES = 2.5;
export const BIKE_TILES = 5.2;

export function planContext(): PlanContext {
  const t = game.save.time;
  const open = new Set<string>(['plaza', 'library']);
  for (const [flag, zone] of [['unlock_beach', 'beach'], ['unlock_garden', 'garden'], ['unlock_forest', 'forest']] as const) if (game.has(flag)) open.add(zone);
  if (game.flag('market_open')) open.add('market');
  return { day: t.day, period: Math.max(0, Math.min(3, t.period)), half: t.minutes >= 45 ? 1 : 0, rain: game.flag('weather') === 'rain', open };
}

export class NeighborLife {
  readonly state = new Map<string, NeighborState>();
  private grids = new Map<string, Grid>();
  private save = game.save;
  private syncIn = 0;

  grid = (zone: string): Grid => {
    let g = this.grids.get(zone);
    if (!g) { g = buildZone(zone).grid; this.grids.set(zone, g); }
    return g;
  };
  invalidate() { this.grids.clear(); for (const s of this.state.values()) s.trip.replan(); }

  /** a free tile at or next to the wanted one */
  private reachable(p: Place): Place {
    const g = this.grid(p.zone);
    if (!g.isSolid(p.x, p.y)) return p;
    const near = g.nearestWalkable(p.x, p.y);
    return near ? { ...p, x: near[0], y: near[1] } : p;
  }

  sync(ctx: PlanContext = planContext()) {
    if (this.save !== game.save) { this.state.clear(); this.save = game.save; }
    const plan = planVillage(ctx);
    for (const n of NEIGHBORS) {
      const wanted = plan.get(n.id);
      if (!wanted) continue;
      const key = `${ctx.day}:${ctx.period}:${ctx.half}:${ctx.rain ? 1 : 0}`;
      const place = { ...this.reachable(wanted), ride: wanted.ride, withFriend: wanted.withFriend };
      const stop: RoutineStop = { zone: place.zone, x: place.x, y: place.y, wander: 0, act: place.act, dir: place.dir, seatLift: place.seatLift };
      const cur = this.state.get(n.id);
      if (!cur) {
        const trip = new Journey({ zone: place.zone, x: place.x, y: place.y }, this.grid, WALK_TILES);
        trip.destination = { ...stop };
        this.state.set(n.id, { n, trip, place, key, ride: !!place.ride });
      } else if (cur.key !== key) {
        cur.key = key; cur.place = place; cur.ride = !!place.ride;
        cur.trip.speed = (cur.ride ? BIKE_TILES : WALK_TILES) * (0.92 + (n.id.length % 5) / 25);
        cur.trip.go(stop);
      }
    }
  }

  tick(dt: number) {
    this.syncIn -= dt;
    if (this.syncIn <= 0) { this.syncIn = 1; this.sync(); }
    for (const s of this.state.values()) s.trip.tick(dt);
  }

  inZone(zone: string): NeighborState[] {
    return [...this.state.values()].filter((s) => s.trip.position.zone === zone);
  }
}
