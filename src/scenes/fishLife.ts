/**
 * Fish in the water, in schools: a few shadows swim in circles under the surface (at every fishing spot, and wherever there is open
 * water in view) and now and then one, two or three of a school jump together. So a spot reads as "there are fish here" and a
 * splash tells you some just went by. Nothing here touches the catch itself: it is only drawing. In battery / reduced-motion
 * mode the shadows hold still and nothing jumps.
 */
import Phaser from 'phaser';
import { TILE } from '../entities/Actor';
import { ctx2d, makeCanvas, px } from '../art/pixel';
import { dotTexture } from './textures';

const isWater = (ground: readonly string[], x: number, y: number) => { const ch = ground[y]?.[x]; return ch === 'w' || ch === 'd'; };

/** Water with water on all eight sides: a fish swimming round it (or jumping from it) never reaches the bank. */
const solidWater = (ground: readonly string[], x: number, y: number) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWater(ground, x + dx, y + dy)) return false;
  return true;
};

/**
 * The water tile a fishing spot fishes: close to it, but inside the water (water all around it, and two tiles of it above,
 * since a jump rises on screen), so the shadow never crosses the sand and the fish never seems to hang over the shore.
 */
export function waterBeside(ground: readonly string[], x: number, y: number, reach = 3): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const wx = x + dx, wy = y + dy;
    if (!isWater(ground, wx, wy)) continue;
    const open = solidWater(ground, wx, wy);
    const room = isWater(ground, wx, wy - 1) && isWater(ground, wx, wy - 2);
    const d = Math.abs(dx) + Math.abs(dy) + (open ? 0 : 2) + (room ? 0 : 1.5);
    if (!best || d < best.d) best = { x: wx, y: wy, d };
  }
  return best && { x: best.x, y: best.y };
}

/** Water tiles with water all around: where a fish can swim and jump without leaving the water (never on the shore). */
export function openWater(ground: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) {
    if (solidWater(ground, x, y)) out.push({ x, y });
  }
  return out;
}

/** A jump: a parabola from (0,0) to (dx,dy) on the water, `lift` high at the top. t in 0..1. */
export function jumpAt(t: number, dx: number, dy: number, lift: number): { x: number; y: number; angle: number } {
  const u = Math.min(1, Math.max(0, t));
  const x = dx * u, base = dy * u, h = 4 * lift * u * (1 - u);
  // slope of the path on screen (y grows downwards): rise then fall
  const sx = dx, sy = dy - 4 * lift * (1 - 2 * u);
  return { x, y: base - h, angle: Math.atan2(sy, sx || 0.0001) };
}

interface Palette { back: string; belly: string; edge: string; fin: string }
const PALETTES: Palette[] = [
  { back: '#6f8aa0', belly: '#e3edf2', edge: '#2a3d4a', fin: '#8fb0c4' }, // silver
  { back: '#e0763a', belly: '#fff0dc', edge: '#6b2a1c', fin: '#f4a261' }, // koi
  { back: '#3f7fb5', belly: '#d4e8f6', edge: '#1d3550', fin: '#76b0d8' }, // blue
];

/** A fish seen from the side, facing right (10x6): back, belly, tail, eye, and a dark edge. */
function sideFish(scene: Phaser.Scene, i: number): string {
  const key = `fish_jump_${i}`;
  if (scene.textures.exists(key)) return key;
  const p = PALETTES[i], W = 11, H = 7, c = makeCanvas(W, H), g = ctx2d(c);
  const body = (x: number, y: number) => ((x - 6.2) / 4.1) ** 2 + ((y - 3.2) / 2.3) ** 2 <= 1;
  const tail = (x: number, y: number) => x <= 2.5 && Math.abs(y - 3.2) <= 0.4 + (2.8 - x) * 0.95 && x >= 0;
  const solid = (x: number, y: number) => body(x, y) || tail(x, y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(x + dx, y + dy))) px(g, x, y, p.edge);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!solid(x, y)) continue;
    px(g, x, y, tail(x, y) && !body(x, y) ? p.fin : y <= 2 ? p.back : y >= 4 ? p.belly : p.back);
  }
  px(g, 8, 2, p.edge); // eye
  px(g, 6, 1, p.fin); // dorsal fin
  scene.textures.addCanvas(key, c);
  return key;
}

/** The same fish from above, as a dark outline against the water (10x5), facing right. */
function shadowFish(scene: Phaser.Scene): string {
  const key = 'fish_shadow';
  if (scene.textures.exists(key)) return key;
  const W = 12, H = 7, c = makeCanvas(W, H), g = ctx2d(c);
  const body = (x: number, y: number) => ((x - 7) / 4.6) ** 2 + ((y - 3) / 2.2) ** 2 <= 1;
  const tail = (x: number, y: number) => x <= 3 && Math.abs(y - 3) <= 0.3 + (3.4 - x) * 0.55;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (body(x, y) || tail(x, y)) px(g, x, y, '#12303c');
  scene.textures.addCanvas(key, c);
  return key;
}

/** How many of a school jump together: mostly one, often two, now and then three. `r` is a random number in [0, 1). */
export function jumpCount(r: number): 1 | 2 | 3 {
  return r < 0.5 ? 1 : r < 0.8 ? 2 : 3;
}

/** A point on an oval swum around (cx, cy). */
export function orbitPoint(cx: number, cy: number, rx: number, ry: number, t: number): { x: number; y: number; angle: number } {
  return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry, angle: Math.atan2(Math.cos(t) * ry, -Math.sin(t) * rx) };
}

interface Fish { shadow: Phaser.GameObjects.Image; rx: number; ry: number; t: number; speed: number; jumping: boolean }
interface School { cx: number; cy: number; fish: Fish[]; next: number; ambient: boolean }
export interface WaterTiles { ox: number; oy: number; tiles: { x: number; y: number }[] }

const MAX_JUMPS = 6;
const AMBIENT_SCHOOLS = 3;

export class FishLife {
  private schools: School[] = [];
  private water: WaterTiles[] = [];
  private jumping = 0;
  private still = false;
  private spawnIn = 1;
  private checkIn = 1;

  constructor(private scene: Phaser.Scene) {}

  private school(cx: number, cy: number, ambient: boolean): School {
    const n = 2 + Math.floor(Math.random() * 3); // 2 to 4 fish
    const fish: Fish[] = Array.from({ length: n }, (_, i) => ({
      shadow: this.scene.add.image(0, 0, shadowFish(this.scene)).setDepth(-2.5).setAlpha(0.42),
      rx: 3.5 + Math.random() * 5.5, ry: 2.2 + Math.random() * 3.2,
      t: Math.random() * 6.28, speed: (0.55 + Math.random() * 0.7) * (i % 2 ? -1 : 1), jumping: false,
    }));
    return { cx, cy, fish, next: 4 + Math.random() * 10, ambient };
  }

  /** The fish of one district: a school at each fishing spot (in tiles, the water tile it fishes) and where more may swim and jump. */
  reset(spots: { x: number; y: number }[], water: WaterTiles[], still: boolean) {
    this.dropAll();
    this.schools = spots.map((s) => this.school(s.x * TILE + TILE / 2, s.y * TILE + TILE / 2, false));
    this.water = water;
    this.still = still;
    this.jumping = 0;
    this.spawnIn = 0.5;
    this.place();
  }

  /** Only the neighbouring districts' water changed. */
  setWater(water: WaterTiles[]) { this.water = water; }

  private dropAll() {
    for (const sc of this.schools) for (const f of sc.fish) f.shadow.destroy();
    this.schools = [];
  }

  private place() {
    for (const sc of this.schools) for (const f of sc.fish) {
      const o = orbitPoint(sc.cx, sc.cy, f.rx, f.ry, f.t);
      f.shadow.setPosition(o.x, o.y).setRotation(f.speed < 0 ? o.angle + Math.PI : o.angle);
    }
  }

  update(dt: number, view: { x: number; y: number; right: number; bottom: number }, night: number) {
    const margin = 40;
    const near = (x: number, y: number) => x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin;
    for (const sc of this.schools) {
      for (const f of sc.fish) {
        f.shadow.setAlpha(f.jumping ? 0 : 0.42 - night * 0.14);
        if (!this.still && !f.jumping) f.t += dt * f.speed;
      }
      if (this.still || !near(sc.cx, sc.cy)) continue;
      sc.next -= dt;
      if (sc.next > 0) continue;
      sc.next = 7 + Math.random() * 11;
      this.splash(sc);
    }
    if (this.still) { this.place(); return; }
    this.place();
    // schools in open water, only where the player can see them: one that is left behind is dropped, a new one appears in view
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      this.checkIn = 1;
      this.schools = this.schools.filter((sc) => {
        if (!sc.ambient || near(sc.cx, sc.cy) || sc.fish.some((f) => f.jumping)) return true;
        for (const f of sc.fish) f.shadow.destroy();
        return false;
      });
    }
    this.spawnIn -= dt;
    if (this.spawnIn > 0 || this.schools.filter((sc) => sc.ambient).length >= AMBIENT_SCHOOLS) return;
    this.spawnIn = 1.5 + Math.random() * 2.5;
    const spots: { x: number; y: number }[] = [];
    for (const src of this.water) for (const t of src.tiles) {
      const x = src.ox + t.x * TILE + TILE / 2, y = src.oy + t.y * TILE + TILE / 2;
      if (x < view.x - 8 || x > view.right + 8 || y < view.y - 8 || y > view.bottom + 8) continue;
      // not on top of another school
      if (this.schools.some((sc) => Math.hypot(sc.cx - x, sc.cy - y) < 40)) continue;
      spots.push({ x, y });
    }
    if (!spots.length) return;
    const at = spots[Math.floor(Math.random() * spots.length)];
    this.schools.push(this.school(at.x, at.y, true));
  }

  /** One, two or three fish of the school jump, a moment apart, from where their shadows are. */
  private splash(sc: School) {
    const ready = sc.fish.filter((f) => !f.jumping);
    const n = Math.min(jumpCount(Math.random()), ready.length, MAX_JUMPS - this.jumping);
    for (let i = 0; i < n; i++) {
      const f = ready.splice(Math.floor(Math.random() * ready.length), 1)[0];
      f.jumping = true;
      this.jumping++;
      this.scene.time.delayedCall(i * (140 + Math.random() * 200), () => {
        if (!f.shadow.active) { this.jumping = Math.max(0, this.jumping - 1); return; }
        this.jump(f.shadow.x, f.shadow.y, f);
      });
    }
  }

  private jump(x0: number, y0: number, f: Fish) {
    const scene = this.scene;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dx = dir * (11 + Math.random() * 7), dy = (Math.random() - 0.5) * 5, lift = 10 + Math.random() * 6;
    const fish = scene.add.image(x0, y0, sideFish(scene, Math.floor(Math.random() * PALETTES.length))).setOrigin(0.5, 0.5).setDepth(y0 + 8).setVisible(false);
    const dur = 560 + Math.random() * 160;
    this.ring(x0, y0);
    for (let i = 0; i < 3; i++) this.drop(x0, y0);
    const state = { t: 0 };
    scene.tweens.add({
      targets: state, t: 1, duration: dur, ease: 'Linear',
      onStart: () => fish.setVisible(true),
      onUpdate: () => {
        const p = jumpAt(state.t, dx, dy, lift);
        // the picture faces right: facing left it is mirrored, so the angle is mirrored with it
        fish.setPosition(x0 + p.x, y0 + p.y).setFlipX(dx < 0).setRotation(dx < 0 ? p.angle - Math.PI : p.angle).setDepth(y0 + dy * state.t + 8);
      },
      onComplete: () => {
        fish.destroy();
        this.ring(x0 + dx, y0 + dy);
        for (let i = 0; i < 3; i++) this.drop(x0 + dx, y0 + dy);
        this.jumping = Math.max(0, this.jumping - 1);
        f.jumping = false;
      },
    });
  }

  private ring(x: number, y: number) {
    const e = this.scene.add.ellipse(x, y, 5, 2.5).setStrokeStyle(1, 0xffffff, 0.9).setDepth(-2);
    e.isFilled = false;
    this.scene.tweens.add({ targets: e, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 560, ease: 'Sine.out', onComplete: () => e.destroy() });
  }

  private drop(x: number, y: number) {
    const d = this.scene.add.image(x, y, dotTexture(this.scene, 'wfx_drop', '#dff4ff', 1, 1)).setDepth(y + 9);
    const vx = (Math.random() - 0.5) * 12, up = 5 + Math.random() * 6;
    this.scene.tweens.add({ targets: d, x: x + vx, y: [y - up, y + 1], alpha: { from: 1, to: 0.2 }, duration: 380, ease: 'Sine.out', onComplete: () => d.destroy() });
  }

  destroy() { this.dropAll(); this.water = []; }
}
