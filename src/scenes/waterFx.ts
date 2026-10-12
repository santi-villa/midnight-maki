/**
 * Cheap animated extras that sit on top of the water tiles (the tiles themselves carry the ripples, currents and glints):
 *  - a moon glitter path per lake / sea at night,
 *  - a warm streak below every lantern that stands near the water,
 *  - small rings + a few droplets for the odd splash, and rain rings while it rains.
 * Everything is a handful of pooled images (no per-tile objects). In battery / reduced-motion mode only the static
 * reflections are kept: no frame swapping, no rings, no droplets.
 */
import Phaser from 'phaser';
import { TILE } from '../entities/Actor';
import { dotTexture } from './textures';
import { ctx2d, makeCanvas, px } from '../art/pixel';

export interface LampLike { x: number; y: number; color?: number; glow?: number; spill?: boolean }
export interface WaterEnv { moon: number; lamp: number; rain: boolean; view: Phaser.Geom.Rectangle }

const GLITTER_W = 24;
const GLITTER_H = 96;
const STREAK_W = 16;
const STREAK_H = 48;
const FRAMES = 3;
const MAX_RINGS = 10;

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function sheet(scene: Phaser.Scene, key: string, fw: number, fh: number, draw: (c: CanvasRenderingContext2D, ox: number, f: number) => void): string {
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(fw * FRAMES, fh);
  const g = ctx2d(cv);
  for (let f = 0; f < FRAMES; f++) draw(g, f * fw, f); // draw first: a WebGL texture is uploaded when it is added
  const tex = scene.textures.addCanvas(key, cv)!;
  for (let f = 0; f < FRAMES; f++) tex.add(f, 0, f * fw, 0, fw, fh);
  return key;
}

/** Moon path: short bright dashes that widen downwards and shimmer from frame to frame. */
function glitterTexture(scene: Phaser.Scene): string {
  return sheet(scene, 'wfx_glitter', GLITTER_W, GLITTER_H, (c, ox, f) => {
    for (let row = 0, k = 0; row < GLITTER_H - 2; row += 3, k++) {
      if (hash(f * 31 + 7, k) < 0.28) continue;
      const w = Math.min(GLITTER_W - 4, 2 + Math.floor(k * 0.55) + (hash(f, k) < 0.5 ? 0 : 2));
      const jitter = Math.round((hash(k, f + 5) - 0.5) * 4);
      const x = ox + Math.round((GLITTER_W - w) / 2) + jitter;
      px(c, Math.max(ox, x), row, '#fff4c4', Math.min(w, GLITTER_W), 1);
      if (w > 5) px(c, Math.max(ox, x) + 2, row + 1, '#f2dc98', w - 4, 1);
    }
  });
}

/** Lantern streak: orange/yellow dashes under the lamp, thinner as they go down. */
function streakTexture(scene: Phaser.Scene): string {
  return sheet(scene, 'wfx_streak', STREAK_W, STREAK_H, (c, ox, f) => {
    for (let row = 0, k = 0; row < STREAK_H - 2; row += 3, k++) {
      if (hash(f * 17 + 3, k) < 0.2 + k * 0.025) continue;
      const w = Math.max(2, 7 - Math.floor(k * 0.35) + (hash(f, k + 9) < 0.4 ? 1 : 0));
      const jitter = Math.round((hash(k + 4, f) - 0.5) * 3);
      px(c, ox + Math.round((STREAK_W - w) / 2) + jitter, row, k < 3 ? '#fff6d0' : '#ffe39a', w, 1);
    }
  });
}

/** Expanding ring (pixel ellipse outline) in 3 sizes. */
function ringTexture(scene: Phaser.Scene): string {
  return sheet(scene, 'wfx_ring', 15, 9, (c, ox, f) => {
    const rx = 2 + f * 2;
    const ry = 1 + f;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      px(c, ox + 7 + Math.round(Math.cos(t) * rx), 4 + Math.round(Math.sin(t) * ry), f === 2 ? '#bfe6f8' : '#e8f8ff');
    }
  });
}

interface Reflection { img: Phaser.GameObjects.Image; base: number; frameKey: string }
interface Ring { img: Phaser.GameObjects.Image; age: number; life: number; on: boolean }

export class WaterFx {
  private moons: Reflection[] = [];
  private streaks: Reflection[] = [];
  private rings: Ring[] = [];
  private cells: [number, number][] = [];
  private drops: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private swapT = 0;
  private frame = 0;
  private splashT = 3 + Math.random() * 3;
  private rainT = 0;

  constructor(private scene: Phaser.Scene, ground: string[], lamps: LampLike[], private calm: boolean) {
    const H = ground.length;
    const W = ground[0]?.length ?? 0;
    const isWater = (x: number, y: number) => ground[y]?.[x] === 'w' || ground[y]?.[x] === 'd';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWater(x, y)) this.cells.push([x, y]);
    if (!this.cells.length) return;

    // ---- connected bodies of water -> one moon path each
    const seen = new Set<number>();
    const key = (x: number, y: number) => y * W + x;
    for (const [sx, sy] of this.cells) {
      if (seen.has(key(sx, sy))) continue;
      const comp: [number, number][] = [];
      const stack: [number, number][] = [[sx, sy]];
      seen.add(key(sx, sy));
      while (stack.length) {
        const [x, y] = stack.pop()!;
        comp.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (isWater(nx, ny) && !seen.has(key(nx, ny))) {
            seen.add(key(nx, ny));
            stack.push([nx, ny]);
          }
        }
      }
      if (comp.length < 12) continue;
      const cx = Math.round(comp.reduce((a, [x]) => a + x, 0) / comp.length);
      const col = comp.filter(([x]) => x === cx).map(([, y]) => y).sort((a, b) => a - b);
      if (col.length < 2) continue;
      // contiguous run of the middle of that column
      let top = col[0];
      let run = 1;
      for (let i = 1; i < col.length; i++) {
        if (col[i] === col[i - 1] + 1) run++;
        else if (run < 3) { top = col[i]; run = 1; }
        else break;
      }
      const h = Math.min(run * TILE, GLITTER_H);
      this.moons.push(this.reflection(glitterTexture(scene), cx * TILE + 8, top * TILE + 2, h, GLITTER_W, 0xfff0c8, 0.7));
    }

    // ---- lantern streaks: a lamp within 6 tiles above water, same column
    for (const l of lamps) {
      if (l.spill || (l.glow ?? 0.4) < 0.3) continue;
      const lx = Math.floor(l.x / TILE);
      const ly = Math.floor(l.y / TILE);
      let r0 = -1;
      for (let y = ly + 1; y <= ly + 6; y++) {
        if (isWater(lx, y)) { r0 = y; break; }
      }
      if (r0 < 0) continue;
      let run = 0;
      while (isWater(lx, r0 + run) && run < 3) run++;
      this.streaks.push(this.reflection(streakTexture(scene), l.x, r0 * TILE + 1, Math.min(run * TILE, STREAK_H), STREAK_W, l.color ?? 0xffc27a, 0.75));
      if (this.streaks.length >= 6) break;
    }

    if (!calm) {
      const ring = ringTexture(scene);
      for (let i = 0; i < MAX_RINGS; i++) {
        const img = scene.add.image(0, 0, ring, 0).setDepth(3).setVisible(false).setAlpha(0.8);
        this.rings.push({ img, age: 0, life: 0.7, on: false });
      }
      const drop = dotTexture(scene, 'wfx_drop', '#dff4ff', 1, 1);
      this.drops = scene.add.particles(0, 0, drop, { emitting: false, speedY: { min: -34, max: -18 }, speedX: { min: -12, max: 12 }, gravityY: 120, lifespan: 420, alpha: { start: 0.95, end: 0 } });
      this.drops.setDepth(4);
    }
  }

  private reflection(tex: string, x: number, y: number, h: number, w: number, tint: number, base: number): Reflection {
    const img = this.scene.add.image(x, y, tex, 0).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001).setVisible(false);
    img.setTint(tint);
    img.setCrop(0, 0, w, h);
    return { img, base, frameKey: tex };
  }

  update(dt: number, env: WaterEnv) {
    if (!this.cells.length) return;
    const wet = env.rain ? 0.25 : 1;
    for (const m of this.moons) this.show(m, env.moon * wet * m.base);
    for (const s of this.streaks) this.show(s, env.lamp * (env.rain ? 0.5 : 1) * s.base);
    if (this.calm) return;
    // reflections shimmer by swapping between 3 pre-drawn frames
    this.swapT -= dt;
    if (this.swapT <= 0) {
      this.swapT = 0.38;
      this.frame = (this.frame + 1) % FRAMES;
      for (const r of [...this.moons, ...this.streaks]) if (r.img.visible) r.img.setFrame(this.frame);
    }
    // rain rings: many small, short-lived ripples; calm days: the odd splash with a few droplets
    if (env.rain) {
      this.rainT -= dt;
      if (this.rainT <= 0) {
        this.rainT = 0.11;
        this.spawnRing(env.view, false);
      }
    } else {
      this.splashT -= dt;
      if (this.splashT <= 0) {
        this.splashT = 4 + Math.random() * 6;
        this.spawnRing(env.view, true);
      }
    }
    for (const r of this.rings) {
      if (!r.on) continue;
      r.age += dt;
      if (r.age >= r.life) {
        r.on = false;
        r.img.setVisible(false);
        continue;
      }
      const k = r.age / r.life;
      r.img.setFrame(Math.min(2, Math.floor(k * 3)));
      r.img.setAlpha(0.85 * (1 - k * 0.7));
    }
  }

  private show(r: Reflection, a: number) {
    const on = a > 0.03;
    r.img.setVisible(on);
    if (on) r.img.setAlpha(Math.min(1, a));
  }

  private spawnRing(view: Phaser.Geom.Rectangle, splash: boolean) {
    for (let tries = 0; tries < 8; tries++) {
      const [tx, ty] = this.cells[Math.floor(Math.random() * this.cells.length)];
      const x = tx * TILE + 2 + Math.random() * 12;
      const y = ty * TILE + 3 + Math.random() * 10;
      if (x < view.x - 8 || x > view.right + 8 || y < view.y - 8 || y > view.bottom + 8) continue;
      const r = this.rings.find((q) => !q.on);
      if (!r) return;
      r.on = true;
      r.age = 0;
      r.life = splash ? 0.8 : 0.55;
      r.img.setPosition(x, y).setFrame(0).setVisible(true);
      if (splash) this.drops?.explode(4, x, y);
      return;
    }
  }

  destroy() {
    for (const r of [...this.moons, ...this.streaks]) r.img.destroy();
    for (const r of this.rings) r.img.destroy();
    this.drops?.destroy();
    this.moons = [];
    this.streaks = [];
    this.rings = [];
    this.cells = [];
  }
}
