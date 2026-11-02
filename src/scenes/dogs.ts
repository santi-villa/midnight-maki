/**
 * The village dogs (drawn in code, petArt.ts). They sit and pant, trot around their corner, now and then get the
 * zoomies, and sleep at night. Each has a ball nearby: the player can pick it up and throw it, and the dog runs for it
 * and brings it back to their feet. Only decoration: they never block anyone, and nothing here is saved.
 */
import Phaser from 'phaser';
import type { Dir } from '../core/types';
import type { Grid } from '../world/grid';
import { ballTexture, breathAt, DOG_FRAME, dogTexture, zzzAt, type DogCoat } from './petArt';

export interface DogSpot { zone: string; coat: DogCoat; name: string; tx: number; ty: number; roam: number }

export const DOG_SPOTS: DogSpot[] = [
  { zone: 'plaza', coat: 'shiba', name: 'Kuri', tx: 30, ty: 25, roam: 6 },
  { zone: 'beach', coat: 'patch', name: 'Goma', tx: 22, ty: 9, roam: 7 },
];

const TILE = 16;
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * Where a ball thrown from tile (x, y) towards `dir` lands: up to `far` tiles away, stopping before the first tile it
 * cannot land on (a wall, the water), so it never ends up somewhere a dog cannot reach. Null if it would not leave the hand.
 */
export function throwLanding(solid: (x: number, y: number) => boolean, x: number, y: number, dir: Dir, far = 6): [number, number] | null {
  const [dx, dy] = STEP[dir];
  let at: [number, number] | null = null;
  for (let i = 1; i <= far; i++) {
    const nx = x + dx * i, ny = y + dy * i;
    if (solid(nx, ny)) break;
    at = [nx, ny];
  }
  return at;
}

type Mode = 'idle' | 'walk' | 'zoom' | 'fetch' | 'bring' | 'sleep';

interface Dog {
  spot: DogSpot;
  s: Phaser.GameObjects.Sprite;
  z: Phaser.GameObjects.Text[];
  mode: Mode;
  /** pixel points still to walk */
  path: { x: number; y: number }[];
  pause: number;
  t: number;
  /** zoomies left (points to dash to) */
  laps: number;
  home: [number, number];
  barked: number;
}

interface Ball {
  s: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  state: 'ground' | 'held' | 'air' | 'mouth';
  x: number;
  y: number;
}

export class Dogs {
  private dogs: Dog[] = [];
  private ball: Ball | null = null;
  private flight: Phaser.Tweens.Tween | null = null;
  constructor(private scene: Phaser.Scene, readonly zone: string, private night: boolean, private grid: Grid, private sound?: (name: string, x: number, y: number) => void) {
    for (const spot of DOG_SPOTS.filter((d) => d.zone === zone)) {
      const home = grid.isSolid(spot.tx, spot.ty) ? grid.nearestWalkable(spot.tx, spot.ty) ?? [spot.tx, spot.ty] : [spot.tx, spot.ty] as [number, number];
      const x = home[0] * TILE + 8, y = home[1] * TILE + 14;
      const s = scene.add.sprite(x, y, dogTexture(scene, spot.coat), DOG_FRAME.sit).setOrigin(0.5, 1).setDepth(y + 1);
      const z = [6, 7, 9].map((size) => scene.add.text(x, y, 'z', { fontFamily: 'Pixelify Sans', fontSize: `${size}px`, color: '#e7dcc2', stroke: '#362e36', strokeThickness: 1 }).setOrigin(0.5, 1).setVisible(false));
      this.dogs.push({ spot, s, z, mode: 'idle', path: [], pause: 2 + this.dogs.length * 3, t: this.dogs.length, laps: 0, home, barked: 0 });
    }
    if (!this.dogs.length) return;
    // the ball waits a tile beside the first dog
    const [bx, by] = this.dogs[0].home;
    const spotB = grid.isSolid(bx + 1, by) ? [bx, by] : [bx + 1, by];
    const px = spotB[0] * TILE + 8, py = spotB[1] * TILE + 13;
    const shadow = scene.add.ellipse(px, py, 5, 2, 0x2b1d17, 0.25).setDepth(py);
    this.ball = { s: scene.add.image(px, py, ballTexture(scene)).setOrigin(0.5, 1).setDepth(py + 1), shadow, state: 'ground', x: px, y: py };
  }

  get count() { return this.dogs.length; }

  setNight(night: boolean, grid = this.grid) { this.night = night; this.grid = grid; }

  /** What the contextual actions need: where the ball is and whether the player has it. */
  ballSense(): { x: number; y: number; held: boolean; dog: string } | null {
    const b = this.ball;
    if (!b || b.state === 'air' || b.state === 'mouth') return null;
    return { x: b.x, y: b.y - 2, held: b.state === 'held', dog: this.dogs[0]?.spot.name ?? '' };
  }

  take(player: { x: number; y: number }): boolean {
    const b = this.ball;
    if (!b || b.state !== 'ground' || Math.hypot(b.x - player.x, b.y - player.y) > 26) return false;
    b.state = 'held';
    b.shadow.setVisible(false);
    // the dog notices and gets ready: play bow
    for (const d of this.dogs) if (d.mode !== 'sleep') { d.mode = 'idle'; d.path = []; d.pause = 0.6; }
    return true;
  }

  /** Throw the held ball the way the player faces. Returns the dog that goes for it, '' if none (asleep), or null if it could not be thrown. */
  throw(player: { x: number; y: number; dir: Dir }): string | null {
    const b = this.ball;
    if (!b || b.state !== 'held') return null;
    const tx = Math.floor(player.x / TILE), ty = Math.floor((player.y - 1) / TILE);
    const land = throwLanding((x, y) => !this.grid.inside(x, y) || this.grid.isSolid(x, y), tx, ty, player.dir);
    if (!land) return null;
    const fx = player.x, fy = player.y - 10, toX = land[0] * TILE + 8, toY = land[1] * TILE + 13;
    b.state = 'air';
    b.shadow.setVisible(true);
    const flight = { p: 0 };
    const dist = Math.hypot(toX - fx, toY - fy);
    this.flight = this.scene.tweens.add({
      targets: flight, p: 1, duration: 260 + dist * 4, ease: 'Linear',
      onUpdate: () => {
        const x = fx + (toX - fx) * flight.p, ground = fy + 10 + (toY - fy - 10) * flight.p;
        const lift = 10 * (1 - flight.p) + Math.sin(Math.PI * flight.p) * (14 + dist * 0.12);
        b.s.setPosition(x, ground - lift).setDepth(ground + 2);
        b.shadow.setPosition(x, ground);
      },
      onComplete: () => this.land(toX, toY),
    });
    const dog = this.dogs.find((d) => d.mode !== 'sleep');
    if (!dog) return '';
    dog.mode = 'fetch'; dog.path = []; dog.pause = 0.25;
    return dog.spot.name;
  }

  private land(x: number, y: number) {
    const b = this.ball;
    if (!b) return;
    b.x = x; b.y = y; b.state = 'ground';
    b.s.setPosition(x, y).setDepth(y + 1);
    b.shadow.setPosition(x, y);
    this.sound?.('ball_bounce', x, y);
    // one little bounce
    this.scene.tweens.add({ targets: b.s, y: y - 4, duration: 110, yoyo: true, ease: 'Quad.out', onComplete: () => this.sound?.('ball_bounce', x, y) });
  }

  private route(d: Dog, tx: number, ty: number) {
    const from = [Math.floor(d.s.x / TILE), Math.floor((d.s.y - 1) / TILE)] as const;
    const tiles = this.grid.path(from[0], from[1], tx, ty) ?? [];
    d.path = tiles.map(([x, y]) => ({ x: x * TILE + 8, y: y * TILE + 14 }));
  }

  /** `player` in world pixels. */
  update(dt: number, player: { x: number; y: number }) {
    if (dt <= 0) return;
    const b = this.ball;
    if (b?.state === 'held') {
      b.s.setPosition(player.x + 5, player.y - 9).setDepth(player.y + 2);
    }
    for (const d of this.dogs) {
      d.t += dt;
      const asleep = this.night && d.mode !== 'fetch' && d.mode !== 'bring';
      if (asleep && d.mode !== 'sleep') { d.mode = 'sleep'; d.path = []; }
      if (!asleep && d.mode === 'sleep') { d.mode = 'idle'; d.pause = 3; }
      if (d.mode === 'sleep') { this.doze(d); continue; }
      for (const z of d.z) z.setVisible(false);

      if (d.mode === 'fetch' && b) {
        if (b.state === 'ground' && !d.path.length) {
          const goal = { x: b.x, y: b.y + 1 };
          if (Math.hypot(goal.x - d.s.x, goal.y - d.s.y) < 6) {
            b.state = 'mouth';
            b.shadow.setVisible(false);
            d.mode = 'bring';
            this.route(d, Math.floor(player.x / TILE), Math.floor((player.y - 1) / TILE));
            continue;
          }
          this.route(d, Math.floor(b.x / TILE), Math.floor((b.y - 1) / TILE));
          if (!d.path.length) d.path = [goal];
        }
        if (b.state === 'air') { this.frame(d, 'bow'); continue; }
        this.move(d, dt, 78);
        continue;
      }

      if (d.mode === 'bring' && b) {
        b.s.setPosition(d.s.x + (d.s.flipX ? -8 : 8), d.s.y - 7).setDepth(d.s.y + 2);
        const near = Math.hypot(player.x - d.s.x, player.y - d.s.y);
        if (near < 20 || (!d.path.length && near < 60)) {
          // drops it at the player's feet and waits, tail going, for the next throw
          const x = player.x + (d.s.x < player.x ? -10 : 10), y = player.y + 2;
          b.state = 'ground'; b.x = x; b.y = y;
          b.s.setPosition(x, y).setDepth(y + 1); b.shadow.setVisible(true).setPosition(x, y);
          d.mode = 'idle'; d.path = []; d.pause = 6;
          this.sound?.('woof', d.s.x, d.s.y);
          continue;
        }
        // the player keeps moving: follow them
        if (!d.path.length || d.t - d.barked > 1.2) {
          d.barked = d.t;
          this.route(d, Math.floor(player.x / TILE), Math.floor((player.y - 1) / TILE));
        }
        this.move(d, dt, 62);
        continue;
      }

      if (d.path.length) { this.move(d, dt, d.mode === 'zoom' ? 84 : 26); continue; }
      if (d.mode === 'zoom' && d.laps > 0) {
        d.laps--;
        this.route(d, d.home[0] + Math.round(Math.random() * 6 - 3), d.home[1] + Math.round(Math.random() * 4 - 2));
        if (d.laps % 2 === 0) this.frame(d, 'bow');
        continue;
      }
      d.mode = 'idle';
      const close = Math.hypot(player.x - d.s.x, player.y - d.s.y);
      // waiting with the ball in the player's hand: play bow, eyes on them
      if (b?.state === 'held' && close < 120) {
        d.s.setFlipX(player.x < d.s.x);
        this.frame(d, Math.floor(d.t * 2) % 4 === 0 ? 'bow' : 'pant');
        if (d.t - d.barked > 3.5 && close < 70) { d.barked = d.t; this.sound?.('woof', d.s.x, d.s.y); }
        continue;
      }
      if (close < 40) d.s.setFlipX(player.x < d.s.x);
      // sit, pant a while, sit again
      this.frame(d, Math.floor(d.t / 1.6) % 3 === 1 ? 'pant' : 'sit');
      d.pause -= dt;
      if (d.pause > 0) continue;
      d.pause = 5 + Math.random() * 6;
      if (Math.random() < 0.3) {
        d.mode = 'zoom'; d.laps = 4 + Math.floor(Math.random() * 3);
        this.sound?.('woof', d.s.x, d.s.y);
      } else {
        const r = d.spot.roam;
        this.route(d, d.home[0] + Math.round(Math.random() * r * 2 - r), d.home[1] + Math.round(Math.random() * r - r / 2));
        if (d.path.length > r * 3) d.path.length = r * 3;
      }
    }
  }

  private frame(d: Dog, f: keyof typeof DOG_FRAME) { d.s.setFrame(DOG_FRAME[f]); }

  private move(d: Dog, dt: number, speed: number) {
    const next = d.path[0];
    if (!next) return;
    const dx = next.x - d.s.x, dy = next.y - d.s.y, dist = Math.hypot(dx, dy), step = dt * speed;
    if (Math.abs(dx) > 0.2) d.s.setFlipX(dx < 0);
    if (dist <= step) { d.s.setPosition(next.x, next.y); d.path.shift(); }
    else d.s.setPosition(d.s.x + dx / dist * step, d.s.y + dy / dist * step);
    d.s.setDepth(d.s.y + 1);
    this.frame(d, Math.floor(d.t * (speed > 50 ? 12 : 7)) % 2 ? 'runA' : 'runB');
  }

  private doze(d: Dog) {
    d.s.setFrame(breathAt(d.t, 2.8) ? DOG_FRAME.lieB : DOG_FRAME.lie);
    const shown = zzzAt(d.t), side = d.s.flipX ? -1 : 1;
    d.z.forEach((z, i) => z.setVisible(i < shown).setPosition(d.s.x + side * (5 + i * 4) + Math.sin(d.t * 1.6 + i) * 0.8, d.s.y - 10 - i * 5).setDepth(250000 + d.s.y));
  }

  destroy() {
    for (const d of this.dogs) { d.s.destroy(); for (const z of d.z) z.destroy(); }
    this.dogs = [];
    this.flight?.stop(); this.flight = null;
    if (this.ball) { this.scene.tweens.killTweensOf(this.ball.s); this.ball.s.destroy(); this.ball.shadow.destroy(); this.ball = null; }
  }
}
