/**
 * Moths and other night insects circling the street lamps. A handful per lamp, only near the camera, only on dry evenings.
 * They are tiny sprites (no particles), so the cost is a few dozen draws and nothing at all when the camera is elsewhere.
 */
import Phaser from 'phaser';

/** The minimum a lamp has to tell us. */
export interface LampSpot { x: number; y: number; r: number; kind?: string; facade?: boolean }

interface Moth { s: Phaser.GameObjects.Image; lamp: LampSpot; a: number; w: number; base: number; phase: number; flap: number; hop: number }

const KEY = 'lamp_moth';
const MAX_MOTHS = 160; // every lamp of the town gets company; sprites far from the camera are hidden and cost nothing
const PER_LAMP = 3;

/** two frames of a 5×4 moth: wings open, wings folded */
function ensureTextures(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const c = document.createElement('canvas');
  c.width = 12; c.height = 4;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const wing = '#f2e6c2', shade = '#cdb98c', body = '#6b5a45';
  // open
  [[0, 1], [1, 0], [1, 1], [3, 0], [3, 1], [4, 1]].forEach(([x, y]) => px(x, y, wing));
  px(1, 2, shade); px(3, 2, shade); px(2, 1, body); px(2, 2, body);
  // folded
  [[6 + 1, 1], [6 + 3, 1]].forEach(([x, y]) => px(x, y, wing));
  px(6 + 2, 1, body); px(6 + 2, 2, body); px(6 + 2, 0, shade);
  const tex = scene.textures.addCanvas(KEY, c)!;
  tex.add(0, 0, 0, 0, 5, 4);
  tex.add(1, 0, 6, 0, 5, 4);
}

/** Street lamps worth a moth: real lamp posts and lanterns, not window glow, ambient light or shop spill. */
export const mothLamps = (lamps: LampSpot[]) => lamps.filter((l) => !l.kind && !l.facade && l.r >= 60);

export class LampMoths {
  private moths: Moth[] = [];
  private t = 0;
  /** only two or three lamps have visitors at a time; the company moves on every so often */
  private active = new Set<LampSpot>();
  private rotateIn = 0;
  private lamps: LampSpot[] = [];
  constructor(scene: Phaser.Scene, lamps: LampSpot[], rng: () => number = Math.random) {
    ensureTextures(scene);
    const spots = mothLamps(lamps);
    this.lamps = spots;
    for (const lamp of spots) {
      const n = 1 + Math.floor(rng() * PER_LAMP); // one to three per lamp, never none
      for (let i = 0; i < n && this.moths.length < MAX_MOTHS; i++) {
        const s = scene.add.image(lamp.x, lamp.y, KEY, 0).setDepth(210001).setAlpha(0.92);
        this.moths.push({ s, lamp, a: rng() * Math.PI * 2, w: (1.4 + rng() * 1.8) * (rng() < 0.5 ? -1 : 1), base: 6 + rng() * 8, phase: rng() * 6, flap: rng() * 1, hop: 1 + rng() * 3 });
      }
    }
  }

  get count() { return this.moths.length; }

  update(dt: number, view: Phaser.Geom.Rectangle) {
    this.t += dt;
    this.rotateIn -= dt;
    if (this.rotateIn <= 0) {
      this.rotateIn = 25 + Math.random() * 35;
      const inView = this.lamps.filter((l) => Phaser.Geom.Rectangle.Contains(view, l.x, l.y));
      const pool = inView.length ? inView : this.lamps;
      this.active = new Set(Phaser.Utils.Array.Shuffle([...pool]).slice(0, 2 + Math.floor(Math.random() * 2)));
    }
    for (const m of this.moths) {
      const near = this.active.has(m.lamp) && (Phaser.Geom.Rectangle.Contains(view, m.lamp.x, m.lamp.y) || Phaser.Geom.Rectangle.Contains(view, m.s.x, m.s.y));
      m.s.setVisible(near);
      if (!near) continue;
      // an irregular loop around the light, now and then turning the other way, as moths do
      m.hop -= dt;
      if (m.hop <= 0) { m.hop = 1.5 + Math.random() * 3.5; if (Math.random() < 0.4) m.w = -m.w; }
      m.a += m.w * dt;
      const r = m.base + Math.sin(this.t * 1.3 + m.phase) * 3;
      m.s.x = m.lamp.x + Math.cos(m.a) * r + Math.sin(this.t * 7 + m.phase) * 0.6;
      m.s.y = m.lamp.y - 4 + Math.sin(m.a) * r * 0.55 + Math.sin(this.t * 2.1 + m.phase) * 2;
      m.flap += dt * 14;
      m.s.setFrame(Math.floor(m.flap) % 2);
      m.s.setFlipX(Math.cos(m.a + Math.PI / 2) * Math.sign(m.w) < 0);
    }
  }

  destroy() { for (const m of this.moths) m.s.destroy(); this.moths = []; }
}
