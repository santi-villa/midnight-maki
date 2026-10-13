import { game } from '../core/state';
import { CHARACTERS, type RoutineStop } from '../data/characters';
import { buildZone } from '../world/zoneRuntime';
import type { Grid } from '../world/grid';
import { Journey } from './journeys';
import { stopFor } from './npcs';
import { pace } from './schedule';

export interface TownResident { id: string; trip: Journey; stop: RoutineStop; visible: boolean }

/** A small simulation for every map, independent of Phaser and the player's location. */
export class TownLife {
  residents = new Map<string, TownResident>();
  private grids = new Map<string, Grid>();
  private save = game.save;
  private day = game.save.time.day;
  private duties = new Map<string, RoutineStop>();
  grid = (zone: string): Grid => {
    let grid = this.grids.get(zone);
    if (!grid) { grid = buildZone(zone).grid; this.grids.set(zone, grid); }
    return grid;
  };

  invalidate() {
    this.grids.clear();
    for (const r of this.residents.values()) r.trip.replan();
  }

  duty(id: string, stop: RoutineStop | null) {
    if (stop) this.duties.set(id, stop);
    else this.duties.delete(id);
    const resident = this.residents.get(id);
    if (resident && stop) { resident.stop = stop; resident.trip.go(stop); }
  }

  sync() {
    if (this.save !== game.save || this.day !== game.save.time.day) {
      this.residents.clear(); this.duties.clear(); this.invalidate();
      this.save = game.save; this.day = game.save.time.day;
    }
    for (const c of CHARACTERS) {
      if (c.needsFlag && !game.has(c.needsFlag)) { this.residents.delete(c.id); continue; }
      const desired = stopFor(c.id, game.save.time.period);
      // Sleeping neighbors still walk home before going inside out of view.
      const scripted = game.flag('at_' + c.id);
      if (desired?.zone !== 'restaurant' || typeof scripted === 'string' && scripted) this.duties.delete(c.id);
      const stop = this.duties.get(c.id) ?? desired ?? { ...c.routine[3], act: 'sleep' as const, wander: 0 };
      let resident = this.residents.get(c.id);
      if (!resident) {
        const grid = this.grid(stop.zone);
        const tile = grid.isSolid(stop.x, stop.y) ? grid.nearestWalkable(stop.x, stop.y) : null;
        const start = { zone: stop.zone, x: tile?.[0] ?? stop.x, y: tile?.[1] ?? stop.y };
        resident = { id: c.id, trip: new Journey(start, this.grid, (c.raccoon ? 46 : 40) * pace(c.id) / 16), stop, visible: !!desired };
        resident.trip.destination = { ...stop };
        this.residents.set(c.id, resident);
      } else {
        if (typeof scripted === 'string' && scripted) {
          resident.trip.place(stop);
        } else resident.trip.go(stop);
        resident.stop = stop;
        resident.visible = !!desired;
      }
    }
  }

  tick(dt: number) { for (const r of this.residents.values()) r.trip.tick(dt); }

  inZone(zone: string) {
    return [...this.residents.values()].filter((r) => r.trip.position.zone === zone && (r.visible || !r.trip.settled));
  }
}
