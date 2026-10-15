/** The living part of the ambient neighbours: they follow the day's plan around the village, in every map, seen or not. */
import { game } from '../core/state';
import type { RoutineStop } from '../data/characters';
import { NEIGHBORS, type Neighbor } from '../data/neighbors';
import { ZONES } from '../data/zones';
import { buildZone } from '../world/zoneRuntime';
import type { Grid } from '../world/grid';
import { Journey } from './journeys';
import { planVillage, type PlanContext } from './neighborPlan';
import { LINGER_KIND, lingerTile, type Place } from './neighborSpots';

export interface NeighborState {
  n: Neighbor;
  trip: Journey;
  place: Place & { ride?: boolean; withFriend?: string };
  /** The planned spot. A short stroll steps away from it and comes back. */
  anchor: Place;
  key: string;
  ride: boolean;
  beat: number;
  stepped: boolean;
}

const onDoor = (zone: string, x: number, y: number) => !!ZONES[zone]?.doors.some((d) => d.x === x && d.y === y);

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
  /** neighbours who are inside the restaurant right now (their body there is a guest, not a stroller) */
  private away = new Set<string>();

  hold(id: string, away: boolean) {
    if (away) this.away.add(id);
    else if (this.away.delete(id)) this.state.delete(id); // back among the others at their planned place
  }

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
      const stop: RoutineStop = { zone: place.zone, x: place.x, y: place.y, wander: 0, act: place.act, dir: place.dir, seatLift: place.seatLift, bed: place.bed };
      const cur = this.state.get(n.id);
      if (!cur) {
        const trip = new Journey({ zone: place.zone, x: place.x, y: place.y }, this.grid, WALK_TILES);
        trip.destination = { ...stop };
        this.state.set(n.id, { n, trip, place, anchor: place, key, ride: !!place.ride, beat: 0, stepped: false });
      } else if (cur.key !== key) {
        cur.key = key; cur.place = place; cur.anchor = place; cur.ride = !!place.ride; cur.beat = 0; cur.stepped = false;
        cur.trip.speed = (cur.ride ? BIKE_TILES : WALK_TILES) * (0.92 + (n.id.length % 5) / 25);
        cur.trip.go(stop);
      }
    }
  }

  private asStop(p: Place): RoutineStop {
    return { zone: p.zone, x: p.x, y: p.y, wander: 0, act: p.act, dir: p.dir, seatLift: p.seatLift, bed: p.bed };
  }

  tick(dt: number) {
    this.syncIn -= dt;
    if (this.syncIn <= 0) { this.syncIn = 1; this.sync(); }
    for (const s of this.state.values()) {
      s.trip.tick(dt);
      if (!LINGER_KIND.has(s.anchor.kind)) continue;
      if (!s.trip.settled) { s.beat = 0; continue; }
      s.beat += dt;
      const back = this.asStop(s.anchor);
      if (!s.stepped && s.beat >= 7) {
        const grid = this.grid(s.anchor.zone);
        const tile = lingerTile(s.n.id, s.anchor.x, s.anchor.y, (x, y) => !grid.isSolid(x, y) && !onDoor(s.anchor.zone, x, y));
        if (!tile) continue;
        s.stepped = true;
        s.beat = 0;
        s.trip.go({ ...back, x: tile[0], y: tile[1], act: 'look', bed: undefined });
      } else if (s.stepped && s.beat >= 14) {
        s.stepped = false;
        s.beat = 0;
        s.trip.go(back);
      }
    }
  }

  inZone(zone: string): NeighborState[] {
    return [...this.state.values()].filter((s) => !this.away.has(s.n.id) && s.trip.position.zone === zone);
  }
}
