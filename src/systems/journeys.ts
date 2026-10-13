/** Continuous trips across the town. Positions survive changing the visible map. */
import type { Dir } from '../core/types';
import type { RoutineStop } from '../data/characters';
import { ZONES, type DoorDef } from '../data/zones';
import type { Grid } from '../world/grid';

export interface Position { zone: string; x: number; y: number }

/** Breadth-first door routing, including interiors and intermediate outdoor maps. */
export function routeDoor(from: string, to: string): DoorDef | null {
  if (from === to) return null;
  const queue: { zone: string; first: DoorDef | null }[] = [{ zone: from, first: null }];
  const seen = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const door of ZONES[current.zone]?.doors ?? []) {
      if (seen.has(door.to)) continue;
      const first = current.first ?? door;
      if (door.to === to) return first;
      seen.add(door.to);
      queue.push({ zone: door.to, first });
    }
  }
  return null;
}

export class Journey {
  position: Position;
  destination: RoutineStop;
  settled = true;
  moving = false;
  dir: Dir = 'down';
  private path: [number, number][] = [];
  private crossing: DoorDef | null = null;
  private planned = false;
  private retryIn = 0;

  constructor(start: Position, private grid: (zone: string) => Grid, public speed = 2.5) {
    this.position = { ...start };
    this.destination = { ...start };
  }

  go(stop: RoutineStop) {
    const old = this.destination;
    this.destination = { ...stop };
    if (old.zone === stop.zone && old.x === stop.x && old.y === stop.y) return;
    this.settled = false;
    this.path = [];
    this.planned = false;
    this.crossing = null;
    this.retryIn = 0;
  }

  place(stop: RoutineStop) {
    this.position = { zone: stop.zone, x: stop.x, y: stop.y };
    this.destination = { ...stop };
    this.settled = true;
    this.moving = false;
    this.path = [];
    this.planned = false;
    this.crossing = null;
    this.retryIn = 0;
  }

  replan() {
    if (this.settled) return;
    this.path = []; this.crossing = null; this.planned = false; this.retryIn = 0;
  }

  /** Remember wandering or scripted movement before starting the next trip. */
  remember(x: number, y: number) {
    if (this.settled) { this.position.x = x; this.position.y = y; }
  }

  tick(dt: number) {
    this.moving = false;
    if (this.settled || !Number.isFinite(dt) || dt <= 0) return;
    if (!this.planned) {
      this.retryIn -= dt;
      if (this.retryIn > 0) return;
      const p = this.position;
      const door = routeDoor(p.zone, this.destination.zone);
      if (p.zone !== this.destination.zone && !door) return;
      const target = door ? [door.x, door.y] : [this.destination.x, this.destination.y];
      const path = this.grid(p.zone).path(Math.round(p.x), Math.round(p.y), target[0], target[1]);
      // Furniture must never make a character teleport through a wall.
      if (!path) { this.retryIn = 1; return; }
      this.path = path;
      this.crossing = door;
      this.planned = true;
    }
    let budget = dt * this.speed;
    while (this.path.length && budget > 0) {
      const [x, y] = this.path[0];
      const p = this.position;
      const dx = x - p.x, dy = y - p.y;
      const distance = Math.hypot(dx, dy);
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.moving = true;
      if (distance <= budget) {
        p.x = x; p.y = y;
        budget -= distance;
        this.path.shift();
      } else {
        p.x += dx / distance * budget;
        p.y += dy / distance * budget;
        budget = 0;
      }
    }
    if (this.path.length) return;
    if (this.crossing) {
      const door = this.crossing;
      this.position = { zone: door.to, x: door.tx, y: door.ty };
      this.crossing = null;
      this.planned = false;
      // Stop here for this frame: the arrival is visible at the actual exit.
      return;
    }
    this.settled = true;
    this.moving = false;
  }
}
