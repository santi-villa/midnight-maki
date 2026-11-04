/** Winter cover and short footprints. One canvas, redrawn only when the level changes. No collisions, nothing saved. */
import Phaser from 'phaser';
import type { Dir } from '../core/types';
import { TILE } from '../entities/Actor';
import { snowLevel } from './townAmbience';

const KEY = 'mm-snow-cover';
const PRINT = 'mm-print';
const MAX_PRINTS = 24;

interface Print { img: Phaser.GameObjects.Image; life: number; max: number; }

export class SnowCover {
  private img: Phaser.GameObjects.Image | null = null;
  private prints: Print[] = [];
  private shown = -1;
  private wait = 0;
  private snowing = false;
  private low = false;
  private last = new Map<string, string>();
  private skip = new Set<string>();
  private readonly w: number;
  private readonly h: number;

  constructor(private scene: Phaser.Scene, private ground: string[], doors: { x: number; y: number }[]) {
    this.h = ground.length;
    this.w = ground[0]?.length ?? 0;
    for (const d of doors) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.skip.add(`${d.x + dx},${d.y + dy}`);
    ensurePrint(scene);
  }

  update(dt: number, day: number, rain: boolean, low: boolean) {
    const target = snowLevel(day, rain);
    this.snowing = target > 0;
    if (this.shown < 0 || this.low !== low) {
      this.shown = low ? 0 : target;
      this.low = low;
      this.wait = 0;
      this.paint();
    } else if (!low && this.shown !== target) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.shown += Math.sign(target - this.shown) as 0 | 1 | -1;
        this.wait = 7;
        this.paint();
      }
    }
    for (const p of this.prints) {
      p.life -= dt;
      p.img.setAlpha(Math.max(0, p.life / p.max));
    }
    this.prints = this.prints.filter((p) => {
      if (p.life > 0) return true;
      p.img.destroy();
      return false;
    });
  }

  /** A footprint on snow. Sofi always fits; other people stop once the trail is crowded. */
  step(id: string, x: number, y: number, dir: Dir, priority: boolean) {
    if (this.shown <= 0 || this.low) return;
    if (!priority && this.prints.length >= 12) return;
    if (this.prints.length >= MAX_PRINTS) return;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor((y - 1) / TILE);
    const token = `${tx},${ty}`;
    if (this.last.get(id) === token) return;
    if (!this.snowy(tx, ty)) return;
    this.last.set(id, token);
    const life = this.snowing ? 3.4 : 6;
    const img = this.scene.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2 + 2, PRINT).setDepth(-7.5);
    img.setAngle(dir === 'left' ? -90 : dir === 'right' ? 90 : dir === 'up' ? 180 : 0);
    img.setAlpha(0.85);
    this.prints.push({ img, life, max: life });
  }

  destroy() {
    this.img?.destroy();
    this.img = null;
    for (const p of this.prints) p.img.destroy();
    this.prints = [];
    if (this.scene.textures.exists(KEY)) this.scene.textures.remove(KEY);
  }

  private snowy(tx: number, ty: number) {
    if (this.skip.has(`${tx},${ty}`)) return false;
    const ch = this.ground[ty]?.[tx] ?? '';
    if (ch === 'g' || ch === 'G') return true;
    return 'pcbs'.includes(ch) && this.edge(tx, ty);
  }

  private edge(tx: number, ty: number) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = this.ground[ty + dy]?.[tx + dx] ?? '';
      if (n === 'g' || n === 'G') return true;
    }
    return false;
  }

  private paint() {
    this.img?.destroy();
    this.img = null;
    if (this.scene.textures.exists(KEY)) this.scene.textures.remove(KEY);
    if (this.shown <= 0 || this.w < 2 || this.h < 2 || this.w * TILE > 2048 || this.h * TILE > 2048) return;
    const W = this.w * TILE;
    const H = this.h * TILE;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.createImageData(W, H);
    const px = data.data;
    const plot = (x: number, y: number, a: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 244;
      px[i + 3] = a;
    };
    const level = this.shown;
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      if (this.skip.has(`${tx},${ty}`)) continue;
      const ch = this.ground[ty]?.[tx] ?? '';
      const grass = ch === 'g' || ch === 'G';
      const rim = !grass && 'pcbs'.includes(ch) && this.edge(tx, ty);
      if (!grass && !rim) continue;
      const x0 = tx * TILE;
      const y0 = ty * TILE;
      if (rim) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = this.ground[ty + dy]?.[tx + dx] ?? '';
          if (n !== 'g' && n !== 'G') continue;
          for (let i = 0; i < TILE; i++) for (let t = 0; t < level; t++) {
            const x = dx !== 0 ? x0 + (dx > 0 ? TILE - 1 - t : t) : x0 + i;
            const y = dy !== 0 ? y0 + (dy > 0 ? TILE - 1 - t : t) : y0 + i;
            plot(x, y, 150);
          }
        }
        continue;
      }
      // Irregular dusting. The same rows on every tile read as stripes, so the hash picks pixels instead.
      const chance = level === 1 ? 0.07 : level === 2 ? 0.16 : 0.32;
      let h = (tx * 374761393 + ty * 668265263) >>> 0;
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        h = (h * 1664525 + 1013904223) >>> 0;
        if ((h % 1000) / 1000 >= chance) continue;
        plot(x0 + x, y0 + y, level === 3 ? 225 : 155);
      }
      if (level >= 2) {
        const clumps = level === 2 ? 2 : 4;
        for (let n = 0; n < clumps; n++) {
          h = (h * 1664525 + 1013904223) >>> 0;
          const cx = h % (TILE - 1);
          const cy = (h >>> 8) % (TILE - 1);
          plot(x0 + cx, y0 + cy, 240);
          plot(x0 + cx + 1, y0 + cy, 220);
          plot(x0 + cx, y0 + cy + 1, 200);
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    this.scene.textures.addCanvas(KEY, canvas);
    this.scene.textures.get(KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.img = this.scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(-8);
  }
}

function ensurePrint(scene: Phaser.Scene) {
  if (scene.textures.exists(PRINT)) return;
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.fillStyle = '#3d4e5c';
  g.fillRect(1, 1, 3, 5);
  g.fillRect(6, 4, 3, 5);
  scene.textures.addCanvas(PRINT, canvas);
  scene.textures.get(PRINT).setFilter(Phaser.Textures.FilterMode.NEAREST);
}
