/**
 * Rippling water (Phaser 4 Displacement filter). The village's water tiles are drawn a second time in a layer of their
 * own, just above the ground, and that copy goes through a displacement filter fed by a fine wave pattern that changes
 * every 150 ms: the water seems to move and the reflections on it wobble, while the land stays perfectly still (the
 * ground below still has the undistorted water, so the edges never show a gap).
 * Off in battery mode, with reduced motion and without WebGL.
 */
import Phaser from 'phaser';
import { RIPPLE_FRAMES as FRAMES, rippleValue } from './fxMath';

const W = 192, H = 108;

function textures(scene: Phaser.Scene): string[] {
  const keys: string[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const key = 'water_ripple_' + f;
    keys.push(key);
    if (scene.textures.exists(key)) continue;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, gg] = rippleValue(x, y, f), i = (y * W + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    scene.textures.addCanvas(key, c);
  }
  return keys;
}

export class WaterRipple {
  private filter: Phaser.Filters.Displacement;
  private keys: string[];
  private t = 0;
  private f = 0;
  /** `layer` holds only the water tiles (a copy of the ground's); it gets the filter. */
  constructor(scene: Phaser.Scene, readonly layer: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Filters) {
    this.keys = textures(scene);
    layer.enableFilters();
    // the filter covers what is on screen, not the whole (huge) layer
    layer.filtersFocusContext = true;
    this.filter = layer.filters!.internal.addDisplacement(this.keys[0], 0.0035, 0.0025);
  }

  update(dt: number) {
    this.t += dt;
    if (this.t < 0.15) return;
    this.t = 0;
    this.f = (this.f + 1) % this.keys.length;
    this.filter.setTexture(this.keys[this.f]);
  }

  destroy() { this.layer.destroy(); }
}
