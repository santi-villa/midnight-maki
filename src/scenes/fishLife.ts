/**
 * Fish in the water: they jump now and then, and at each fishing spot a fish's shadow swims in circles under the surface until
 * it jumps (so the spot reads as "there are fish here", and a splash tells you one just went by). Nothing here touches the
 * catch itself: it is only drawing. In battery / reduced-motion mode the shadows hold still and nothing jumps.
 */
import Phaser from 'phaser';
import { TILE } from '../entities/Actor';
import { ctx2d, makeCanvas, px } from '../art/pixel';
import { dotTexture } from './textures';

const isWater = (ground: readonly string[], x: number, y: number) => { const ch = ground[y]?.[x]; return ch === 'w' || ch === 'd'; };

/**
 * The water tile a fishing spot fishes: close to it, but inside the water (water on its four sides, and two tiles of it above,
 * since a jump rises on screen), so the shadow never crosses the sand and the fish never seems to hang over the shore.
 */
export function waterBeside(ground: readonly string[], x: number, y: number, reach = 3): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const wx = x + dx, wy = y + dy;
    if (!isWater(ground, wx, wy)) continue;
    const open = isWater(ground, wx - 1, wy) && isWater(ground, wx + 1, wy) && isWater(ground, wx, wy - 1) && isWater(ground, wx, wy + 1);
    const room = isWater(ground, wx, wy - 1) && isWater(ground, wx, wy - 2);
    const d = Math.abs(dx) + Math.abs(dy) + (open ? 0 : 2) + (room ? 0 : 1.5);
    if (!best || d < best.d) best = { x: wx, y: wy, d };
  }
  return best && { x: best.x, y: best.y };
}

/** Water tiles with water on all four sides: where a fish can jump without leaving the water (never on the shore). */
export function openWater(ground: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) {
    if (isWater(ground, x, y) && isWater(ground, x - 1, y) && isWater(ground, x + 1, y) && isWater(ground, x, y - 1) && isWater(ground, x, y + 1)) out.push({ x, y });
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

interface Spot { cx: number; cy: number; shadow: Phaser.GameObjects.Image; t: number; speed: number; next: number; jumping: boolean }
export interface WaterTiles { ox: number; oy: number; tiles: { x: number; y: number }[] }

export class FishLife {
  private spots: Spot[] = [];
  private water: WaterTiles[] = [];
  private nextAmbient = 4 + Math.random() * 5;
  private jumping = 0;
  private still = false;

  constructor(private scene: Phaser.Scene) {}

  /** The fish of one district: a shadow per fishing spot (in pixels, the middle of its water tile) and where fish may jump. */
  reset(spots: { x: number; y: number }[], water: WaterTiles[], still: boolean) {
    for (const s of this.spots) s.shadow.destroy();
    this.spots = spots.map((s, i) => ({
      cx: s.x * TILE + TILE / 2, cy: s.y * TILE + TILE / 2,
      shadow: this.scene.add.image(0, 0, shadowFish(this.scene)).setDepth(-2.5).setAlpha(0.42),
      t: Math.random() * 6.28, speed: (0.75 + Math.random() * 0.4) * (i % 2 ? -1 : 1), next: 5 + Math.random() * 9, jumping: false,
    }));
    this.water = water;
    this.still = still;
    this.nextAmbient = 3 + Math.random() * 5;
    this.jumping = 0;
    this.place();
  }

  /** Only the neighbouring districts' water changed. */
  setWater(water: WaterTiles[]) { this.water = water; }

  private place() {
    for (const s of this.spots) {
      // an oval around the middle of the tile; the fish heads along it (seen from above)
      const rx = 5.2, ry = 3.1;
      s.shadow.setPosition(s.cx + Math.cos(s.t) * rx, s.cy + Math.sin(s.t) * ry);
      s.shadow.setRotation(Math.atan2(Math.cos(s.t) * ry * Math.sign(s.speed), -Math.sin(s.t) * rx * Math.sign(s.speed)));
    }
  }

  update(dt: number, view: { x: number; y: number; right: number; bottom: number }, night: number) {
    for (const s of this.spots) {
      s.shadow.setAlpha(s.jumping ? 0 : 0.42 - night * 0.14);
      if (this.still) continue;
      if (!s.jumping) s.t += dt * s.speed;
      s.next -= dt;
      if (s.next <= 0 && !s.jumping) {
        if (this.jumping < 3) this.jump(s.cx, s.cy, s);
        s.next = 9 + Math.random() * 12;
      }
    }
    this.place();
    if (this.still) return;
    this.nextAmbient -= dt;
    if (this.nextAmbient > 0) return;
    this.nextAmbient = 4 + Math.random() * 7;
    if (this.jumping >= 2) return;
    // somewhere in (or near) the view, on open water
    const margin = 24;
    for (let tries = 0; tries < 10; tries++) {
      const src = this.water[Math.floor(Math.random() * this.water.length)];
      if (!src?.tiles.length) continue;
      const t = src.tiles[Math.floor(Math.random() * src.tiles.length)];
      const x = src.ox + t.x * TILE + TILE / 2, y = src.oy + t.y * TILE + TILE / 2;
      if (x < view.x - margin || x > view.right + margin || y < view.y - margin || y > view.bottom + margin) continue;
      this.jump(x, y, null);
      return;
    }
  }

  private jump(x0: number, y0: number, spot: Spot | null) {
    const scene = this.scene;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dx = dir * (11 + Math.random() * 7), dy = (Math.random() - 0.5) * 5, lift = 10 + Math.random() * 6;
    const fish = scene.add.image(x0, y0, sideFish(scene, Math.floor(Math.random() * PALETTES.length))).setOrigin(0.5, 0.5).setDepth(y0 + 8).setVisible(false);
    const dur = 560 + Math.random() * 160;
    if (spot) spot.jumping = true;
    this.jumping++;
    this.ring(x0, y0);
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
        if (spot) spot.jumping = false;
      },
    });
    for (let i = 0; i < 3; i++) this.drop(x0, y0);
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
    for (const s of this.spots) s.shadow.destroy();
    this.spots = [];
    this.water = [];
  }
}
