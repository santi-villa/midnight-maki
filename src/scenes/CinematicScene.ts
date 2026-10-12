/**
 * Animated opening, told in four painted "shots" before the letter:
 * a rainy city at night → a letter slides under the door → a train to the sea at dawn → arrival at Villa Nori.
 * Each shot is built with code (no external art) and animated with tweens and particles.
 */
import Phaser from 'phaser';
import { dotTexture, glowTexture, propTexture } from './textures';

export class CinematicScene extends Phaser.Scene {
  private layer: Phaser.GameObjects.Container | null = null;
  private W = 320;
  private H = 180;

  constructor() {
    super('cinematic');
  }

  create() {
    this.fit();
    this.scale.on('resize', () => this.fit());
  }

  private fit() {
    const cam = this.cameras.main;
    const z = Math.max(this.scale.width / this.W, this.scale.height / this.H);
    cam.setZoom(z);
    cam.centerOn(this.W / 2, this.H / 2);
  }

  private clear() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    this.layer = this.add.container(0, 0);
  }

  private glow(x: number, y: number, s: number, tint: number, a = 0.6) {
    const g = this.add.image(x, y, glowTexture(this)).setScale(s).setTint(tint).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD);
    this.layer!.add(g);
    return g;
  }

  private rain(alpha = 0.5) {
    const d = dotTexture(this, 'rainc', '#bcd4e6', 1, 4);
    const p = this.add.particles(0, -10, d, { x: { min: -20, max: this.W + 20 }, speedY: { min: 220, max: 280 }, speedX: -30, lifespan: 900, frequency: 8, alpha });
    this.layer!.add(p);
  }

  /** shot 1: city at night in the rain, slowly pushing in on one lit window */
  shotCity() {
    this.clear();
    const { W, H } = this;
    const g = this.add.graphics();
    g.fillGradientStyle(0x10122a, 0x10122a, 0x2a2650, 0x2a2650, 1);
    g.fillRect(-40, -40, W + 80, H + 80);
    this.layer!.add(g);
    const city = this.add.graphics();
    for (let i = 0; i < 18; i++) {
      const bw = 18 + ((i * 37) % 22);
      const bh = 50 + ((i * 53) % 80);
      const bx = i * 19 - 10;
      city.fillStyle(i % 2 ? 0x1c1d3a : 0x22234a, 1);
      city.fillRect(bx, H - bh, bw, bh);
      for (let y = H - bh + 6; y < H - 6; y += 9)
        for (let x = bx + 3; x < bx + bw - 4; x += 6) if ((x * 7 + y * 3) % 5 === 0) {
          city.fillStyle(0xf4d68c, 0.9);
          city.fillRect(x, y, 3, 4);
        }
    }
    this.layer!.add(city);
    // the window we care about
    const wx = 168;
    const wy = 96;
    const win = this.add.rectangle(wx, wy, 8, 10, 0xffd48a);
    this.layer!.add(win);
    const halo = this.glow(wx, wy, 0.9, 0xffc070, 0.5);
    this.tweens.add({ targets: halo, alpha: { from: 0.35, to: 0.6 }, duration: 1200, yoyo: true, repeat: -1 });
    this.rain(0.45);
    this.cameras.main.setZoom(this.cameras.main.zoom);
    this.tweens.add({ targets: this.layer, x: -(wx - W / 2) * 0.5, y: -(wy - H / 2) * 0.5, scale: 1.5, duration: 9000, ease: 'Sine.inOut' });
  }

  /** shot 2: a quiet room; a letter with a glowing star seal slides under the door */
  shotLetter() {
    this.clear();
    const { W, H } = this;
    const g = this.add.graphics();
    g.fillStyle(0x3a2f4a, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x4a3a54, 1);
    g.fillRect(0, H - 50, W, 50); // floor
    for (let x = 0; x < W; x += 24) {
      g.fillStyle(0x433450, 1);
      g.fillRect(x, H - 50, 1, 50);
    }
    // door
    g.fillStyle(0x6b4330, 1);
    g.fillRect(W / 2 - 34, 30, 68, H - 80);
    g.fillStyle(0x5a3828, 1);
    g.fillRect(W / 2 - 28, 38, 56, 40);
    g.fillRect(W / 2 - 28, 86, 56, 40);
    g.fillStyle(0xf2c66d, 1);
    g.fillRect(W / 2 + 22, 92, 4, 4);
    // warm lamp light from the left
    this.layer!.add(g);
    this.glow(30, 60, 2.6, 0xffb867, 0.35);
    // a strip of light under the door
    const strip = this.add.rectangle(W / 2, H - 50, 68, 2, 0xfff1c8, 0.8);
    this.layer!.add(strip);
    // the envelope
    const env = this.add.container(W / 2, H - 52);
    const paper = this.add.rectangle(0, 0, 30, 18, 0xf6ecd6).setStrokeStyle(1, 0xc9b48c);
    const flap = this.add.triangle(0, -2, -15, -9, 15, -9, 0, 3, 0xeadbbb);
    const seal = this.add.circle(0, 2, 3, 0xb2585e);
    const star = this.add.star(0, 2, 5, 1, 2.4, 0xf2c66d);
    env.add([paper, flap, seal, star]);
    env.setAlpha(0);
    this.layer!.add(env);
    const sg = this.glow(W / 2, H - 50, 0.5, 0xf2c66d, 0);
    this.tweens.add({ targets: env, alpha: 1, y: H - 42, x: W / 2 - 6, angle: -8, scale: 1.4, duration: 2600, ease: 'Sine.out', delay: 800 });
    this.tweens.add({ targets: sg, alpha: 0.7, y: H - 42, duration: 2600, delay: 800 });
    this.tweens.add({ targets: star, scale: 1.4, duration: 600, yoyo: true, repeat: -1, delay: 3400 });
  }

  /** shot 3: dawn, a little train crossing hills by the sea */
  shotTrain() {
    this.clear();
    const { W, H } = this;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0xf4b08c, 0xf4b08c, 0xfbe3c8, 0xfbe3c8, 1);
    sky.fillRect(-20, -20, W + 40, H);
    this.layer!.add(sky);
    const sun = this.add.circle(W * 0.7, 70, 18, 0xffe2a8);
    this.layer!.add(sun);
    this.glow(W * 0.7, 70, 2.2, 0xffd08a, 0.5);
    this.tweens.add({ targets: sun, y: 54, duration: 9000 });
    // sea
    const sea = this.add.graphics();
    sea.fillStyle(0x6f9fb8, 1);
    sea.fillRect(-20, 96, W + 40, 40);
    sea.fillStyle(0xbfe0ec, 0.7);
    for (let x = 0; x < W; x += 14) sea.fillRect(x, 100 + ((x * 3) % 12), 6, 1);
    this.layer!.add(sea);
    // parallax hills
    const hill = (color: number, y: number, amp: number, speed: number) => {
      const h = this.add.graphics();
      h.fillStyle(color, 1);
      for (let x = -40; x < W * 2 + 40; x += 30) h.fillEllipse(x, y, 70, amp);
      h.fillRect(-40, y, W * 2 + 80, H);
      this.layer!.add(h);
      this.tweens.add({ targets: h, x: -W, duration: speed, repeat: -1 });
    };
    hill(0x9bb59a, 128, 40, 30000);
    hill(0x6f9e5a, 134, 30, 16000);
    // rails and the train
    const rail = this.add.rectangle(W / 2, 130, W + 40, 2, 0x5d5864);
    this.layer!.add(rail);
    const train = this.add.container(-120, 124);
    const cars = [0, 34, 68];
    for (const cx of cars) {
      const body = this.add.rectangle(cx, 0, 30, 14, cx === 0 ? 0xb2585e : 0xf6ecd6).setStrokeStyle(1, 0x46291f);
      train.add(body);
      for (let i = -10; i <= 10; i += 7) train.add(this.add.rectangle(cx + i, -2, 4, 4, 0xffd48a));
      train.add(this.add.circle(cx - 9, 8, 3, 0x2a2230));
      train.add(this.add.circle(cx + 9, 8, 3, 0x2a2230));
    }
    this.layer!.add(train);
    this.tweens.add({ targets: train, x: W + 40, duration: 9000, ease: 'Sine.inOut' });
    this.tweens.add({ targets: train, y: 123, duration: 220, yoyo: true, repeat: -1 });
    // birds
    const bird = dotTexture(this, 'birdc', '#46291f', 3, 1);
    const p = this.add.particles(W + 10, 40, bird, { y: { min: 20, max: 70 }, speedX: { min: -40, max: -25 }, speedY: { min: -3, max: 3 }, lifespan: 9000, frequency: 900 });
    this.layer!.add(p);
  }

  /** shot 4: sunset arrival at Villa Nori, petals drifting past the restaurant */
  shotArrival() {
    this.clear();
    const { W, H } = this;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x7a5a9a, 0x7a5a9a, 0xf2a882, 0xf2a882, 1);
    sky.fillRect(-20, -20, W + 40, H);
    this.layer!.add(sky);
    const ground = this.add.graphics();
    ground.fillStyle(0x86a878, 1);
    ground.fillRect(-20, 120, W + 40, 80);
    ground.fillStyle(0xb2aca6, 1);
    ground.fillRect(W / 2 - 24, 120, 48, 80);
    this.layer!.add(ground);
    const put = (k: string, x: number, y: number, s = 1) => {
      const i = this.add.image(x, y, propTexture(this, k)).setOrigin(0.5, 1).setScale(s);
      this.layer!.add(i);
      return i;
    };
    put('sakura', 40, 128, 1.1);
    put('tree', 280, 126, 1.1);
    put('bld_restaurant', W / 2, 124, 1);
    put('lamppost', W / 2 - 64, 134);
    put('lamppost', W / 2 + 64, 134);
    for (const x of [W / 2 - 64, W / 2 + 64]) this.glow(x, 108, 0.9, 0xffd08a, 0.5);
    this.glow(W / 2, 110, 1.6, 0xffb867, 0.4);
    const pet = dotTexture(this, 'petal', '#f4c6cf', 2, 1);
    const p = this.add.particles(0, -6, pet, { x: { min: 0, max: W }, speedY: { min: 12, max: 22 }, speedX: { min: 8, max: 18 }, lifespan: 9000, frequency: 160, rotate: { min: 0, max: 360 } });
    this.layer!.add(p);
    this.layer!.setScale(1.25).setPosition(-W * 0.125, -H * 0.2);
    this.tweens.add({ targets: this.layer, scale: 1, x: 0, y: 0, duration: 8000, ease: 'Sine.out' });
  }
}
