/** A little steam above Midnight Maki, and an occasional remark from someone already walking by. No coins, no reputation. */
import Phaser from 'phaser';
import type { Dir } from '../core/types';
import { game } from '../core/state';
import { RECIPES_BY_ID } from '../data/recipes';
import { TILE } from '../entities/Actor';
import { favouriteOf } from '../restaurant/townClients';
import { clients } from '../restaurant/townVisits';
import { dotTexture } from '../scenes/textures';
import { clock } from '../systems/time';
import { restaurantPhase } from '../systems/schedule';
import { scentLine } from './townAmbience';

interface Roof {
  x: number;
  y: number;
  def: { w: number; h: number; sw: number; sh: number };
}

export interface Passer {
  id: string;
  x: number;
  y: number;
  moving: boolean;
}

export class RestaurantBreath {
  private steam: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private steamKey = '';
  private next = 12;
  private lastLine: string | null = null;
  private lastWho = '';
  private lookUntil = new Map<string, { dir: Dir; until: number }>();
  private holdUntil = new Map<string, number>();
  private saidAt = new Map<string, number>();

  constructor(private scene: Phaser.Scene) {}

  update(dt: number, air: { prop: Roof | null; door: { x: number; y: number } | null; people: Passer[]; low: boolean; quiet: boolean } | null) {
    const now = performance.now();
    for (const [id, until] of this.holdUntil) if (until <= now) this.holdUntil.delete(id);
    for (const [id, g] of this.lookUntil) if (g.until <= now) this.lookUntil.delete(id);
    if (!air) { this.steamKey = ''; this.clearSteam(); return; }
    this.syncSteam(air.prop, air.low);
    this.next -= dt;
    if (this.next > 0 || air.quiet || !air.door) return;
    this.next = 26;
    const phase = restaurantPhase(clock.period, game.save.time.minutes);
    const rs = game.save.restaurant;
    const doorX = air.door.x * TILE + TILE / 2;
    const doorY = air.door.y * TILE + TILE / 2;
    const near = air.people
      .filter((p) => Math.hypot(p.x - doorX, p.y - doorY) < 78)
      .sort((a, b) => Math.hypot(a.x - doorX, a.y - doorY) - Math.hypot(b.x - doorX, b.y - doorY));
    const who = near.find((p) => p.id !== this.lastWho && now - (this.saidAt.get(p.id) ?? 0) > 40000) ?? near[0];
    if (!who) return;
    const fav = favouriteOf(clients(), 'nb_' + who.id);
    const dish = fav ? RECIPES_BY_ID[fav]?.name ?? null : null;
    const line = scentLine({
      phase, level: rs.level, reputation: rs.reputation, lights: rs.upgrades.includes('lights'),
      rain: game.flag('weather') === 'rain', period: clock.period, dish, last: this.lastLine, roll: Math.random(),
    });
    if (!line) return;
    this.lastLine = line;
    this.lastWho = who.id;
    this.saidAt.set(who.id, now);
    this.lookUntil.set(who.id, { dir: face(who.x, who.y, doorX, doorY), until: now + 1800 });
    this.holdUntil.set(who.id, now + 1600);
    this.pending = { id: who.id, line };
  }

  /** The line chosen this tick, if the world still has room to say it. */
  takeLine(): { id: string; line: string } | null {
    const line = this.pending;
    this.pending = null;
    return line;
  }

  holding(id: string) {
    return (this.holdUntil.get(id) ?? 0) > performance.now();
  }

  glanceDir(id: string): Dir | null {
    const g = this.lookUntil.get(id);
    return g && g.until > performance.now() ? g.dir : null;
  }

  /** Speech did not fit: drop the pause so the person keeps walking. */
  cancel(id: string) {
    this.holdUntil.delete(id);
    this.lookUntil.delete(id);
  }

  destroy() {
    this.clearSteam();
    this.lookUntil.clear();
    this.holdUntil.clear();
  }

  private pending: { id: string; line: string } | null = null;

  private syncSteam(prop: Roof | null, low: boolean) {
    const phase = restaurantPhase(clock.period, game.save.time.minutes);
    const on = !!prop && !low && (phase === 'setup' || phase === 'open' || phase === 'closing');
    const key = on ? phase + (game.flag('weather') === 'rain' ? ':rain' : '') : 'off';
    if (key === this.steamKey) return;
    this.steamKey = key;
    this.clearSteam();
    if (!on || !prop) return;
    const foot = (prop.y + prop.def.h) * TILE;
    const top = foot - prop.def.sh;
    const x = prop.x * TILE + (prop.def.w * TILE) / 2 + Math.min(18, prop.def.sw / 2 - 8);
    const tex = dotTexture(this.scene, 'steam', '#f7f1e4', 4, 4);
    const rain = game.flag('weather') === 'rain';
    this.steam = this.scene.add.particles(x, top + 16, tex, {
      speedY: { min: -10, max: -4 },
      speedX: rain ? { min: -2, max: 2 } : { min: 1, max: 4 },
      lifespan: 1600,
      frequency: phase === 'open' ? 140 : 480,
      quantity: 1,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1, end: 1.8 },
      advance: 700,
    });
    // The facade is drawn at its feet. A roof-pixel depth sits behind that sprite and never shows.
    this.steam.setDepth(foot + 1);
  }

  private clearSteam() {
    this.steam?.destroy();
    this.steam = null;
  }
}

function face(x: number, y: number, dx: number, dy: number): Dir {
  const adx = dx - x;
  const ady = dy - y;
  if (Math.abs(adx) > Math.abs(ady)) return adx > 0 ? 'right' : 'left';
  return ady > 0 ? 'down' : 'up';
}
