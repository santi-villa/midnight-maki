/**
 * Filters on the main camera (Phaser 4), applied to the whole picture after everything is drawn:
 * - the colour of the hour (grade.ts): warm dusk, blue night, greyer rain;
 * - a soft glow around what is bright at night (street lamps, lit windows, lanterns): the bright parts are picked out,
 *   blurred and added back over the picture in a warm tone (a "bloom"), stronger as the lamps come on;
 * - a blur of the world behind the phone and the menus (the interface itself is HTML on top, so it stays sharp).
 * Battery mode skips the colour and the glow; without WebGL nothing is added.
 */
import Phaser from 'phaser';
import { gradeAt, gradeKey, gradeMatrix, NEUTRAL } from './grade';

export interface CameraFxState {
  period: number;
  /** 0..1 through the part of the day */
  prog: number;
  rain: boolean;
  outdoor: boolean;
  /** how much the lamps are on (0 by day, 1 at night) */
  lamp: number;
  /** the phone or a menu is open: blur the world behind it */
  blurred: boolean;
  /** battery mode */
  low: boolean;
}

export class CameraFx {
  private cm: Phaser.Filters.ColorMatrix;
  private bloom: Phaser.Filters.ParallelFilters;
  private blur: Phaser.Filters.Blur;
  private key = '';
  private blurK = 0;
  private glow = 0;

  private constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    const f = cam.filters.internal;
    this.cm = f.addColorMatrix();
    this.bloom = f.addParallelFilters();
    // only what is bright gets through, softened, then added back warm
    this.bloom.top.addThreshold(0.72, 0.98);
    this.bloom.top.addBlur(1, 2, 2, 1.6);
    this.bloom.blend.blendMode = Phaser.BlendModes.ADD;
    this.bloom.blend.amount = 0;
    this.bloom.blend.color = [1, 0.93, 0.8, 1];
    this.bloom.setActive(false);
    this.blur = f.addBlur(1, 2, 2, 0);
    this.blur.setActive(false);
  }

  /** Null without WebGL (the canvas renderer has no filters). */
  static attach(scene: Phaser.Scene): CameraFx | null {
    const cam = scene.cameras.main;
    if (!(scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) || !cam.filters) return null;
    try { return new CameraFx(cam); } catch { return null; }
  }

  /** `dt` in real seconds (it keeps easing while the game is paused behind a menu). */
  update(dt: number, s: CameraFxState) {
    const g = s.low ? NEUTRAL : gradeAt(s.period, s.prog, s.rain, s.outdoor);
    const key = gradeKey(g);
    if (key !== this.key) {
      this.key = key;
      this.cm.colorMatrix.set(gradeMatrix(g));
      this.cm.setActive(key !== gradeKey(NEUTRAL));
    }
    // the glow follows the lamps; indoors the lanterns are close and warm already
    const target = s.low ? 0 : (s.outdoor ? 1 : 0.5) * Math.max(0, Math.min(1, s.lamp));
    this.glow += (target - this.glow) * Math.min(1, dt * 3);
    this.bloom.blend.amount = 0.38 * this.glow;
    this.bloom.setActive(this.glow > 0.02);
    // the world softens behind the phone and the menus, and comes back sharp when they close
    this.blurK += ((s.blurred ? 1 : 0) - this.blurK) * Math.min(1, dt * 8);
    this.blur.strength = 1.8 * this.blurK;
    this.blur.setActive(this.blurK > 0.03);
  }

  /** For the tests and the debug tools. */
  state() { return { grade: this.key, glow: this.glow, blur: this.blurK, bloomOn: this.bloom.active, blurOn: this.blur.active, colorOn: this.cm.active }; }
}
