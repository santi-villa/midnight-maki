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
export const solidWater = (ground: readonly string[], x: number, y: number) => {
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

/** Tiles of water at least `from` tiles away from any land (or the edge of the map). */
function depthMap(ground: readonly string[]): number[][] {
  const H = ground.length, W = ground[0]?.length ?? 0, d = Array.from({ length: H }, () => Array<number>(W).fill(-1));
  const queue: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isWater(ground, x, y)) { d[y][x] = 0; queue.push([x, y]); }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || d[ny][nx] >= 0) continue;
      d[ny][nx] = d[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  // the map's own edge counts as land: a fish never swims where the picture ends
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[y][x] > 0) d[y][x] = Math.min(d[y][x], x + 1, y + 1, W - x, H - y);
  return d;
}

/**
 * Where fish live far from the shore: a few tiles deep in the water, spread apart (never the same few every time the map is
 * built, always the same ones for the same map, so they are where they were when the player comes back).
 */
export function deepWater(ground: readonly string[], minDepth = 4, apart = 7, most = 4): { x: number; y: number }[] {
  const d = depthMap(ground), out: { x: number; y: number }[] = [];
  const all: { x: number; y: number; h: number }[] = [];
  for (let y = 0; y < d.length; y++) for (let x = 0; x < d[y].length; x++) if (d[y][x] >= minDepth) all.push({ x, y, h: ((x * 73856093) ^ (y * 19349663)) >>> 0 });
  all.sort((a, b) => a.h - b.h);
  for (const t of all) {
    if (out.length >= most) break;
    if (out.every((o) => Math.hypot(o.x - t.x, o.y - t.y) >= apart)) out.push({ x: t.x, y: t.y });
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
interface School { key: string; cx: number; cy: number; fish: Fish[]; next: number }
/** The fish of one district, with the district's place in the world (pixels from the live one) and its tiles: fishing spots and deep water. */
export interface FishSource { id: string; ox: number; oy: number; spots: { x: number; y: number }[]; deep: { x: number; y: number }[] }

const MAX_JUMPS = 6;

export class FishLife {
  /** Recent jumps, so a fisher can look. Drawing only: the catch is untouched. */
  readonly leaps: { x: number; y: number; until: number }[] = [];
  private schools: School[] = [];
  private jumping = 0;
  private still = false;

  constructor(private scene: Phaser.Scene) {}

  private school(key: string, cx: number, cy: number): School {
    const n = 2 + Math.floor(Math.random() * 3); // 2 to 4 fish
    const fish: Fish[] = Array.from({ length: n }, (_, i) => ({
      shadow: this.scene.add.image(0, 0, shadowFish(this.scene)).setDepth(-2.5).setAlpha(0.42),
      rx: 3.5 + Math.random() * 5.5, ry: 2.2 + Math.random() * 3.2,
      t: Math.random() * 6.28, speed: (0.55 + Math.random() * 0.7) * (i % 2 ? -1 : 1), jumping: false,
    }));
    return { key, cx, cy, fish, next: 4 + Math.random() * 10 };
  }

  /**
   * Fish only where there is a reason: one school at each fishing spot and a few far out at sea. They are all there from the
   * start (nothing appears or goes while you look), the ones already swimming keep swimming when only the neighbours change.
   */
  sync(sources: FishSource[], still: boolean) {
    this.still = still;
    const want = new Map<string, { cx: number; cy: number }>();
    for (const src of sources) {
      for (const t of src.spots) want.set(`${src.id}:s:${t.x},${t.y}`, { cx: src.ox + t.x * TILE + TILE / 2, cy: src.oy + t.y * TILE + TILE / 2 });
      for (const t of src.deep) want.set(`${src.id}:d:${t.x},${t.y}`, { cx: src.ox + t.x * TILE + TILE / 2, cy: src.oy + t.y * TILE + TILE / 2 });
    }
    this.schools = this.schools.filter((sc) => {
      const w = want.get(sc.key);
      if (w && w.cx === sc.cx && w.cy === sc.cy) { want.delete(sc.key); return true; }
      for (const f of sc.fish) f.shadow.destroy();
      return false;
    });
    for (const [key, w] of want) this.schools.push(this.school(key, w.cx, w.cy));
    this.place();
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
    this.place();
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
    this.leaps.push({ x: x0, y: y0, until: this.scene.time.now + 2500 });
    if (this.leaps.length > 6) this.leaps.shift();
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

  destroy() {
    for (const sc of this.schools) for (const f of sc.fish) f.shadow.destroy();
    this.schools = [];
  }
}
