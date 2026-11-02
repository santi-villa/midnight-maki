/**
 * The sky over the village: now and then a few birds cross the view (their shadows slide over the ground), at night a shooting
 * star streaks by, and a rainbow comes out when rain clears by day. All of it is drawing: nothing here changes the game.
 * Nothing moves in battery / reduced-motion mode.
 */
import Phaser from 'phaser';
import { ctx2d, makeCanvas, px } from '../art/pixel';
import { dotTexture } from './textures';
import { rainbowEnvelope, RAINBOW_LENGTH, wait } from './skyMath';

interface View { x: number; y: number; right: number; bottom: number; width: number; height: number }
export interface SkyEnv { outdoor: boolean; day: boolean; night: boolean; raining: boolean; still: boolean }

/** A small bird seen from the side, in two frames (wings up, wings down). */
function birdFrames(scene: Phaser.Scene): string {
  const key = 'sky_bird';
  if (scene.textures.exists(key)) return key;
  const W = 9, H = 6, c = makeCanvas(W * 2, H), g = ctx2d(c), ink = '#2a2433';
  // wings up
  for (const [x, y] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 3], [6, 2], [7, 1], [8, 0]]) px(g, x, y, ink);
  // wings down
  for (const [x, y] of [[0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4]]) px(g, W + x, y + 1, ink);
  const tex = scene.textures.addCanvas(key, c)!;
  tex.add(0, 0, 0, 0, W, H); tex.add(1, 0, W, 0, W, H);
  return key;
}

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

interface Bird { s: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; dx: number; dy: number; bob: number; flap: number }

export class SkyLife {
  private birds: Bird[] = [];
  private birdIn = wait(Math.random(), 25, 60);
  private starIn = wait(Math.random(), 18, 50);
  private rainbow: Phaser.GameObjects.Image | null = null;
  private rainbowT = -1;

  constructor(private scene: Phaser.Scene) {}

  /** Rain has just cleared by day. */
  showRainbow() { this.rainbowT = 0; }

  update(dt: number, view: View, env: SkyEnv) {
    this.updateRainbow(dt, view, env);
    this.updateBirds(dt, view, env);
    if (env.still || !env.outdoor || !env.night || env.raining) return;
    this.starIn -= dt;
    if (this.starIn <= 0) { this.starIn = wait(Math.random(), 22, 70); this.shootingStar(view); }
  }

  private updateBirds(dt: number, view: View, env: SkyEnv) {
    if (!env.still && env.outdoor && env.day && !env.raining && !this.birds.length) {
      this.birdIn -= dt;
      if (this.birdIn <= 0) { this.birdIn = wait(Math.random(), 40, 100); this.flyOver(view); }
    }
    for (const b of this.birds) {
      b.s.x += b.dx * dt; b.s.y += b.dy * dt + Math.sin(performance.now() / 380 + b.bob) * 0.12;
      b.flap -= dt;
      if (b.flap <= 0) { b.flap = 0.13; b.s.setFrame(b.s.frame.name === '0' ? 1 : 0); }
      // the shadow stays on the ground below, smaller and fainter than the bird itself
      b.shadow.setPosition(b.s.x - 2, b.s.y + 26 + (b.s.y - view.y) * 0.1);
      b.s.setDepth(150002);
    }
    this.birds = this.birds.filter((b) => {
      const gone = b.dx > 0 ? b.s.x > view.right + 40 : b.s.x < view.x - 40;
      if (gone) { b.s.destroy(); b.shadow.destroy(); }
      return !gone;
    });
  }

  /** Three to five birds enter on one side of the view and cross it in a loose V. */
  private flyOver(view: View) {
    const n = 3 + Math.floor(Math.random() * 3), dir = Math.random() < 0.5 ? 1 : -1;
    const y0 = view.y + view.height * (0.12 + Math.random() * 0.35), speed = 34 + Math.random() * 16;
    const key = birdFrames(this.scene), shadowKey = dotTexture(this.scene, 'sky_bird_shadow', '#1a1428', 5, 2);
    for (let i = 0; i < n; i++) {
      const lag = Math.ceil(i / 2) * 9, side = i % 2 ? 1 : -1;
      const x = dir > 0 ? view.x - 24 - lag : view.right + 24 + lag;
      const s = this.scene.add.image(x, y0 + side * Math.ceil(i / 2) * 5, key, 0).setDepth(150002).setFlipX(dir < 0);
      const shadow = this.scene.add.image(x, y0 + 26, shadowKey).setDepth(-3).setAlpha(0.18);
      this.birds.push({ s, shadow, dx: dir * speed, dy: (Math.random() - 0.5) * 2, bob: Math.random() * 6, flap: Math.random() * 0.13 });
    }
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

  /** A new district: the birds were placed in the last one's coordinates (the rainbow follows the screen, so it stays). */
  clearBirds() {
    for (const b of this.birds) { b.s.destroy(); b.shadow.destroy(); }
    this.birds = [];
  }

  destroy() {
    this.clearBirds();
    this.rainbow?.destroy(); this.rainbow = null; this.rainbowT = -1;
  }
}
