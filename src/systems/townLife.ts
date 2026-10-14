import { game } from '../core/state';
import { CHARACTERS, type RoutineStop } from '../data/characters';
import { buildZone } from '../world/zoneRuntime';
import type { Grid } from '../world/grid';
import { Journey } from './journeys';
import { stopFor } from './npcs';
import { pace } from './schedule';
import { ZONES } from '../data/zones';

export interface TownResident { id: string; trip: Journey; stop: RoutineStop; visible: boolean }

/** A small simulation for every map, independent of Phaser and the player's location. */
export class TownLife {
  residents = new Map<string, TownResident>();
  private grids = new Map<string, Grid>();
  private save = game.save;
  private day = game.save.time.day;
  private duties = new Map<string, RoutineStop>();
  private targets = new Map<string, { key: string; stop: RoutineStop }>();
  private occupied: { zone: string; x: number; y: number }[] = [];
  private syncIn = 0;
  private held = new Set<string>();
  setHeld(ids: string[]) { this.held = new Set(ids); }
  setOccupied(tiles: { zone: string; x: number; y: number }[]) { this.occupied = tiles; }
  grid = (zone: string): Grid => {
    let grid = this.grids.get(zone);
    if (!grid) { grid = buildZone(zone).grid; this.grids.set(zone, grid); }
    return grid;
  };

  invalidate() {
    this.grids.clear();
    this.targets.clear();
    for (const r of this.residents.values()) r.trip.replan();
  }

  duty(id: string, stop: RoutineStop | null) {
    const old = this.duties.get(id);
    if (!stop && !old) return;
    if (stop && old && old.zone === stop.zone && old.x === stop.x && old.y === stop.y && old.act === stop.act) return;
    if (stop) this.duties.set(id, stop);
    else this.duties.delete(id);
    this.targets.delete(id);
    this.sync(); // release immediately starts the walk back, without waiting for a new routine stamp
  }

  /** Work targets reserve their destination, without turning residents into permanent grid walls. */
  private safeStop(id: string, wanted: RoutineStop): RoutineStop {
    const scripted = game.flag('at_' + id);
    if (!wanted.alternatives || typeof scripted === 'string' && scripted) return wanted;
    const grid = this.grid(wanted.zone), resident = this.residents.get(id);
    const entry = ZONES[wanted.zone].doors[0];
    const origin = resident?.trip.position.zone === wanted.zone ? resident.trip.position : entry;
    const free = (x: number, y: number) => !grid.isSolid(x, y) &&
      !ZONES[wanted.zone].doors.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1) &&
      !ZONES[wanted.zone].interact.some(i => i.x === x && i.y === y) &&
      !(wanted.zone === 'restaurant' && [8, 9].includes(x) && y >= 10) &&
      !this.occupied.some(p => p.zone === wanted.zone && p.x === x && p.y === y) &&
      ![...this.residents.values()].some(r => r.id !== id && (r.stop.zone === wanted.zone && r.stop.x === x && r.stop.y === y || r.trip.position.zone === wanted.zone && Math.round(r.trip.position.x) === x && Math.round(r.trip.position.y) === y)) &&
      (!origin || !!grid.path(Math.round(origin.x), Math.round(origin.y), x, y));
    const key = `${wanted.zone}:${wanted.x}:${wanted.y}:${wanted.act}:${wanted.seatLift ?? 0}`;
    const previous = this.targets.get(id);
    if (previous?.key === key && free(previous.stop.x, previous.stop.y)) return { ...wanted, x: previous.stop.x, y: previous.stop.y, seatLift: previous.stop.seatLift };
    const choices: [number, number][] = [[wanted.x, wanted.y], ...wanted.alternatives];
    for (let radius = 1; radius <= 2; radius++) for (const [dx, dy] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]) choices.push([wanted.x + dx, wanted.y + dy]);
    let tile = choices.find(([x, y]) => free(x, y));
    if (!tile && !resident) {
      const floor: [number, number][] = [];
      for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) floor.push([x, y]);
      floor.sort(([ax, ay], [bx, by]) => Math.abs(ax - wanted.x) + Math.abs(ay - wanted.y) - Math.abs(bx - wanted.x) - Math.abs(by - wanted.y));
      tile = floor.find(([x, y]) => free(x, y));
    }
    if (!tile) return resident ? { ...wanted, zone: resident.trip.position.zone, x: Math.round(resident.trip.position.x), y: Math.round(resident.trip.position.y), act: undefined, seatLift: 0 } : wanted;
    const stool = ZONES[wanted.zone].props.some(p => p.id === 'bar_stool' && p.x === tile[0] && p.y === tile[1]);
    const chosen = { ...wanted, x: tile[0], y: tile[1], seatLift: stool ? wanted.seatLift : 0 };
    this.targets.set(id, { key, stop: chosen });
    return chosen;
  }

  sync() {
    if (this.save !== game.save || this.day !== game.save.time.day) {
      if (this.save !== game.save) this.residents.clear();
      this.duties.clear(); this.invalidate();
      this.save = game.save; this.day = game.save.time.day;
    }
    for (const c of CHARACTERS) {
      if (c.needsFlag && !game.has(c.needsFlag)) { this.residents.delete(c.id); continue; }
      const desired = stopFor(c.id, game.save.time.period);
      // Sleeping neighbors still walk home before going inside out of view.
      const scripted = game.flag('at_' + c.id);
      if (this.held.has(c.id) && this.residents.has(c.id) && !scripted) continue;
      if (desired?.zone !== 'restaurant' || typeof scripted === 'string' && scripted) this.duties.delete(c.id);
      let wanted = this.duties.get(c.id) ?? desired ?? { ...c.routine[3], act: 'sleep' as const, wander: 0 };
      if (c.raccoon && this.duties.has(c.id) && !wanted.alternatives) wanted = { ...wanted, alternatives: [[wanted.x - 1, wanted.y], [wanted.x, wanted.y + 1], [wanted.x + 1, wanted.y]] };
      const stop = c.raccoon ? this.safeStop(c.id, wanted) : wanted;
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
        } else resident.trip.go(stop, c.raccoon);
        resident.stop = stop;
        resident.visible = !!desired;
      }
    }
  }

  tick(dt: number) {
    this.syncIn -= dt;
    if (this.syncIn <= 0) { this.syncIn = 1; this.sync(); }
    for (const r of this.residents.values()) if (!this.held.has(r.id)) r.trip.tick(dt);
  }

  inZone(zone: string) {
    return [...this.residents.values()].filter((r) => r.trip.position.zone === zone && (r.visible || !r.trip.settled));
  }
}
