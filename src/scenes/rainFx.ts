import Phaser from 'phaser';
import { dotTexture, glowTexture } from './textures';
import type { RainCell } from './rainmath';

interface Impact { img: Phaser.GameObjects.Image; age: number; cell: RainCell }
interface Puddle { img: Phaser.GameObjects.Image; seed: number; glint: Phaser.GameObjects.Image; lampAt?: { color: number; strength: number } }
/** A lamp as the lighting pass knows it. */
export interface PuddleLamp { x: number; y: number; color?: number; glow?: number; kind?: string; facade?: boolean }

/** Camera-local particles and small reusable pools. Never touches the cached darkness layer. */
export class RainFx {
  private drops: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private mist: Phaser.GameObjects.Image[] = [];
  private rings: Impact[] = [];
  private puddles: Puddle[] = [];
  private cells = new Map<string, RainCell>();
  private impactT = 0;
  private elapsed = 0;
  private sizeKey = '';

  constructor(scene: Phaser.Scene, cells: RainCell[], private low: boolean) {
    for (const c of cells) this.cells.set(`${c.x},${c.y}`, c);
    if (!scene.textures.exists('rain_puddle')) {
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 10;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#547a88'; g.fillRect(3, 2, 9, 6); g.fillRect(1, 4, 14, 2); g.fillRect(5, 1, 5, 8);
      g.fillStyle = '#b6d1d9'; g.fillRect(4, 3, 4, 1); g.fillRect(9, 6, 3, 1);
      scene.textures.addCanvas('rain_puddle', cv);
    }
    const candidates = cells.filter((c) => c.puddle).sort((a, b) => (a.seed % 997) - (b.seed % 997)).slice(0, low ? 32 : 80);
    for (const c of candidates) {
      const img = scene.add.image(c.x * 16 + 8, c.y * 16 + 10, 'rain_puddle').setDepth(-6).setVisible(false);
      // what the water shows: the sky in glints by day, the nearest lamp at night
      const glint = scene.add.image(img.x, img.y, glowTexture(scene)).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5.9).setVisible(false);
      this.puddles.push({ img, seed: c.seed, glint });
    }
    if (low) return;
    const cv = document.createElement('canvas'); cv.width = 13; cv.height = 7;
    const g = cv.getContext('2d')!; g.strokeStyle = '#c4e0e9'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(6.5, 3.5, 5.5, 2.5, 0, 0, Math.PI * 2); g.stroke();
    if (!scene.textures.exists('rain_impact')) scene.textures.addCanvas('rain_impact', cv);
    for (let i = 0; i < 18; i++) this.rings.push({ img: scene.add.image(0, 0, 'rain_impact').setDepth(-3).setVisible(false), age: 1, cell: cells[0] });
    const tex = dotTexture(scene, 'rain_slant', '#bcd4e6', 1, 5);
    for (let i = 0; i < 2; i++) {
      const e = scene.add.particles(0, 0, tex, {
        speedY: { min: i ? 250 : 155, max: i ? 340 : 235 }, speedX: { min: -85, max: -25 },
        lifespan: 1600, frequency: i ? 75 : 16, quantity: 1,
        rotate: { min: 10, max: 22 }, scale: i ? 1.35 : 0.8, alpha: i ? 0.2 : 0.38, emitting: false,
      }).setDepth(i ? 210010 : 150000);
      this.drops.push(e);
      this.mist.push(scene.add.image(0, 0, glowTexture(scene)).setTint(0xaec3cc).setDepth(150001).setAlpha(0).setVisible(false));
    }
  }

  /** The puddles that lie in the light of a street lamp (or a lit stall): at night they show its colour. */
  setLamps(lamps: readonly PuddleLamp[]) {
    for (const p of this.puddles) {
      let best: { color: number; d: number } | null = null;
      for (const l of lamps) {
        if (l.kind || l.facade || (l.glow ?? 0) < 0.5) continue;
        const d = Math.hypot(l.x - p.img.x, l.y - p.img.y);
        if (d < 90 && (!best || d < best.d)) best = { color: l.color ?? 0xffd27a, d };
      }
      p.lampAt = best ? { color: best.color, strength: 1 - best.d / 90 } : undefined;
    }
  }

  update(dt: number, raining: boolean, wet: number, view: Phaser.Geom.Rectangle, light = { lamp: 0 }) {
    this.elapsed += dt;
    for (const p of this.puddles) {
      const k = Math.max(0, Math.min(1, (wet - 0.06 - (p.seed % 17) / 100) / 0.65));
      const shown = k > 0 && view.contains(p.img.x, p.img.y);
      p.img.setVisible(shown).setScale(0.25 + k * 0.85).setAlpha(0.18 + k * 0.25);
      // the reflection: a lamp's colour once the lamps are on, glints of sky while the sun is out
      const twinkle = 0.7 + 0.3 * Math.sin(this.elapsed * 2.1 + p.seed);
      let a = 0, tint = 0xdff1ff;
      if (p.lampAt && light.lamp > 0.05) { a = k * light.lamp * (0.22 + 0.4 * p.lampAt.strength); tint = p.lampAt.color; }
      else if (!raining) a = k * (1 - light.lamp) * 0.2 * twinkle;
      p.glint.setVisible(shown && a > 0.01).setPosition(p.img.x, p.img.y).setTint(tint).setAlpha(Math.min(0.65, a)).setScale(0.32 + k * 0.5, 0.15 + k * 0.2);
    }
    if (this.low) return;
    const key = `${Math.ceil(view.width)},${Math.ceil(view.height)}`;
    for (const e of this.drops) {
      e.setPosition(view.x, view.y);
      if (key !== this.sizeKey) {
        e.clearEmitZones();
        e.addEmitZone({ type: 'random', source: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
          p.x = -24 + Math.random() * (view.width + 48); p.y = -12 + Math.random() * (view.height + 24);
        } } });
      }
      e.emitting = raining;
    }
    this.sizeKey = key;
    this.mist.forEach((m, i) => m.setVisible(raining)
      .setPosition(view.centerX + Math.sin(this.elapsed * 0.13 + i * 3) * view.width * 0.2, view.centerY + (i ? 0.25 : -0.2) * view.height)
      .setDisplaySize(view.width * 1.4, view.height * 0.9).setAlpha(0.055));
    for (const r of this.rings) {
      r.age += dt;
      const k = Math.min(1, r.age / 0.5);
      r.img.setVisible(r.age < 0.5).setScale(0.2 + k * 0.65).setAlpha(0.52 * (1 - k));
    }
    this.impactT -= dt;
    if (!raining || this.impactT > 0) return;
    this.impactT = 0.06 + Math.random() * 0.09;
    const free = this.rings.find((r) => r.age >= 0.5);
    if (!free) return;
    for (let i = 0; i < 18; i++) {
      const x = Math.floor((view.x + Math.random() * view.width) / 16);
      const y = Math.floor((view.y + Math.random() * view.height) / 16);
      const cell = this.cells.get(`${x},${y}`);
      if (!cell) continue;
      free.cell = cell; free.age = 0;
      // Remain inside the approved tile: no rings on roofs, water, bridges' edges or solid objects.
      free.img.setPosition(x * 16 + 8, y * 16 + 9).setScale(0.2).setAlpha(0.52).setVisible(true);
      break;
    }
  }

  destroy() {
    for (const e of this.drops) e.destroy();
    for (const m of this.mist) m.destroy();
    for (const p of this.puddles) { p.img.destroy(); p.glint.destroy(); }
    for (const r of this.rings) r.img.destroy();
  }
}
