/**
 * The sky over the village: at night a shooting star streaks by now and then, and a rainbow comes out when rain clears by day. All of it is drawing: nothing here changes the game.
 * Nothing moves in battery / reduced-motion mode.
 */
import Phaser from 'phaser';
import { ctx2d, makeCanvas } from '../art/pixel';
import { rainbowEnvelope, RAINBOW_LENGTH, wait } from './skyMath';

interface View { x: number; y: number; right: number; bottom: number; width: number; height: number }
export interface SkyEnv { outdoor: boolean; day: boolean; night: boolean; raining: boolean; still: boolean }

/** A bright streak with a glowing head (right end), fading away behind it. */
function streakTexture(scene: Phaser.Scene): string {
  const key = 'sky_streak';
  if (scene.textures.exists(key)) return key;
  const W = 40, H = 3, c = makeCanvas(W, H), g = ctx2d(c);
  for (let x = 0; x < W; x++) {
    const t = x / W;
    g.fillStyle = `rgba(255,244,200,${t ** 1.5 * 0.3})`; g.fillRect(x, 0, 1, H); // the glow
    g.fillStyle = `rgba(255,252,236,${t ** 1.8})`; g.fillRect(x, 1, 1, 1); // the bright core
  }
  g.fillStyle = '#ffffff'; g.fillRect(W - 3, 1, 3, 1);
  scene.textures.addCanvas(key, c);
  return key;
}

const BANDS = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa'];
/** The rainbow: six soft bands in an arch, drawn once and stretched to the view. */
function rainbowTexture(scene: Phaser.Scene): string {
  const key = 'sky_rainbow';
  if (scene.textures.exists(key)) return key;
  const W = 240, H = 124, c = makeCanvas(W, H), g = ctx2d(c);
  BANDS.forEach((col, i) => {
    g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(W / 2, H, 112 - i * 5.4, Math.PI, 0); g.stroke();
  });
  // its feet melt away instead of ending in a straight cut
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.55, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  scene.textures.addCanvas(key, c);
  return key;
}

export class SkyLife {
  private starIn = wait(Math.random(), 18, 50);
  private rainbow: Phaser.GameObjects.Image | null = null;
  private rainbowT = -1;

  constructor(private scene: Phaser.Scene) {}

  /** Rain has just cleared by day. */
  showRainbow() { this.rainbowT = 0; }

  update(dt: number, view: View, env: SkyEnv) {
    this.updateRainbow(dt, view, env);
    if (env.still || !env.outdoor || !env.night || env.raining) return;
    this.starIn -= dt;
    if (this.starIn <= 0) { this.starIn = wait(Math.random(), 22, 70); this.shootingStar(view); }
  }

  private shootingStar(view: View) {
    const scene = this.scene;
    const x = view.x + view.width * (0.15 + Math.random() * 0.6), y = view.y + view.height * (0.06 + Math.random() * 0.25);
    const dir = Math.random() < 0.5 ? 1 : -1, len = 70 + Math.random() * 40, angle = 0.42 * dir;
    const star = scene.add.image(x, y, streakTexture(scene)).setOrigin(1, 0.5).setDepth(200003).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(dir, 1).setRotation(dir > 0 ? angle : -angle);
    scene.tweens.add({
      targets: star, x: x + dir * len * Math.cos(angle), y: y + len * Math.sin(angle), duration: 520, ease: 'Quad.in',
      alpha: { from: 0, to: 1 }, onComplete: () => star.destroy(),
    });
    scene.tweens.add({ targets: star, alpha: 0, delay: 330, duration: 190 });
  }

  private updateRainbow(dt: number, view: View, env: SkyEnv) {
    if (this.rainbowT < 0) { this.rainbow?.setVisible(false); return; }
    if (env.still || !env.outdoor) { this.rainbow?.setVisible(false); if (env.still) this.rainbowT = -1; return; }
    this.rainbowT += dt;
    if (this.rainbowT >= RAINBOW_LENGTH || env.raining) { this.rainbowT = -1; this.rainbow?.setVisible(false); return; }
    this.rainbow ??= this.scene.add.image(0, 0, rainbowTexture(this.scene)).setOrigin(0.5, 1).setDepth(150003).setBlendMode(Phaser.BlendModes.ADD);
    // it hangs over the same part of the screen whatever the camera does
    this.rainbow.setVisible(true).setPosition((view.x + view.right) / 2, view.y + view.height * 0.62).setDisplaySize(view.width * 0.98, view.width * 0.98 * 124 / 240).setAlpha(0.26 * rainbowEnvelope(this.rainbowT));
  }

  destroy() {
    this.rainbow?.destroy(); this.rainbow = null; this.rainbowT = -1;
  }
}
