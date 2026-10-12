/** Animated night view of the restaurant behind the title menu: raccoons, lights, stars, drifting camera. */
import Phaser from 'phaser';
import { FRAMES } from '../art/characters';
import { TILE_INDEX } from '../art/tiles';
import { settings } from '../core/settings';
import { charTexture, dotTexture, ensureTileset, glowTexture, propTexture, vignetteTexture } from './textures';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    ensureTileset(this);
    const W = 30;
    const H = 18;
    const calm = settings.reduceMotion;
    const data: number[][] = [];
    for (let y = 0; y < H; y++) {
      const row: number[] = [];
      for (let x = 0; x < W; x++) row.push(y < 9 ? -1 : y < 11 ? TILE_INDEX.grass0 + ((x * 7 + y) % 3) : TILE_INDEX.cobble);
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const ts = map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0)!;
    map.createLayer(0, ts, 0, 0)!.setDepth(-10);
    const cx = (W * 16) / 2;
    const ground = 11 * 16;

    // ---- sky
    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x14163a, 0x14163a, 0x3b3466, 0x4a3a6a, 1);
    sky.fillRect(-400, -400, W * 16 + 800, 9 * 16 + 404);
    const floor = this.add.graphics().setDepth(-21);
    floor.fillStyle(0x6f6a72, 1);
    floor.fillRect(-400, 9 * 16, W * 16 + 800, 600);
    const star = dotTexture(this, 'star1', '#f6ecd6', 1, 1);
    for (let i = 0; i < 90; i++) {
      const s = this.add.image(Math.random() * W * 16, Math.random() * 130 - 20, star).setDepth(-15).setAlpha(Math.random());
      if (!calm) this.tweens.add({ targets: s, alpha: { from: 0.15, to: 1 }, duration: 700 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    // moon with halo
    this.add.image(W * 16 - 70, 26, glowTexture(this)).setScale(1.4).setTint(0xf4e3a8).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(-14);
    this.add.circle(W * 16 - 70, 26, 10, 0xf4e3a8).setDepth(-14);
    this.add.circle(W * 16 - 65, 22, 9, 0x2a2650).setDepth(-13);
    // distant hills
    const hills = this.add.graphics().setDepth(-16);
    hills.fillStyle(0x2a2a52, 1);
    for (let x = -40; x < W * 16 + 40; x += 60) hills.fillEllipse(x, 9 * 16 + 4, 120, 50);
    hills.fillStyle(0x323a5a, 1);
    for (let x = -10; x < W * 16 + 40; x += 46) hills.fillEllipse(x, 9 * 16 + 10, 80, 30);

    // ---- set dressing
    const put = (key: string, x: number, y: number, depth = y) => this.add.image(x, y, propTexture(this, key)).setOrigin(0.5, 1).setDepth(depth);
    put('bld_restaurant', cx, ground + 4, ground);
    for (const [k, x] of [['tree_dark', cx - 120], ['sakura', cx + 112], ['pine', cx - 170], ['tree', cx + 168], ['pine', cx + 215], ['tree_dark', cx - 215]] as const) {
      const t = put(k, x, ground + 2, 0);
      if (!calm) this.tweens.add({ targets: t, angle: { from: -0.8, to: 0.8 }, duration: 2400 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    put('lamppost', cx - 74, ground + 16);
    put('lamppost', cx + 74, ground + 16);
    put('pot_rose', cx - 44, ground + 10);
    put('pot_cream', cx + 44, ground + 10);
    put('menuboard', cx + 30, ground + 14);
    put('vending_blue', cx - 100, ground + 14);
    put('bicycle', cx + 102, ground + 16);
    const string = put('lanternstring', cx - 150, ground + 2, 1);
    void string;
    put('lanternstring', cx + 150, ground + 2, 1);

    // ---- the three raccoons in front of the door
    const raccoons: { id: string; x: number; s?: Phaser.GameObjects.Sprite }[] = [
      { id: 'spicy', x: cx - 22 },
      { id: 'rigg', x: cx + 2 },
      { id: 'pip', x: cx + 26 },
    ];
    for (const r of raccoons) {
      this.add.ellipse(r.x, ground + 31, 12, 4, 0x1a1428, 0.35).setDepth(ground + 30);
      r.s = this.add.sprite(r.x, ground + 32, charTexture(this, r.id), FRAMES.down[0]).setOrigin(0.5, 1).setDepth(ground + 32);
    }
    if (!calm) {
      // breathing, blinking, happy hops and little head turns, each on its own rhythm
      this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const t = this.time.now / 1000;
          raccoons.forEach((r, i) => {
            const s = r.s!;
            if (s.getData('busy')) return;
            const ph = (t + i * 0.7) % 3.2;
            s.setFrame(ph > 3.05 ? FRAMES.blinkDown : ph > 1.9 ? FRAMES.breathe.down : FRAMES.down[0]);
          });
        },
      });
      this.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => {
          const r = raccoons[Math.floor(Math.random() * raccoons.length)];
          const s = r.s!;
          s.setData('busy', true);
          const act = Math.random();
          if (act < 0.5) {
            s.setFrame(FRAMES.happy);
            this.tweens.add({ targets: s, y: s.y - 6, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.out', onComplete: () => s.setData('busy', false) });
          } else {
            s.setFrame(Math.random() < 0.5 ? FRAMES.right[0] : FRAMES.left[0]);
            this.time.delayedCall(900, () => s.setData('busy', false));
          }
        },
      });
    }

    // ---- lights: warm halos, window spill, flicker
    const glow = glowTexture(this);
    const lights: [number, number, number, number][] = [
      [cx - 74, ground - 12, 1.3, 0xffd08a], [cx + 74, ground - 12, 1.3, 0xffd08a], [cx - 30, ground - 22, 1.1, 0xff9f5a], [cx + 30, ground - 22, 1.1, 0xff9f5a],
      [cx, ground - 8, 1.8, 0xffb867], [cx - 40, ground - 40, 0.9, 0xffd08a], [cx + 40, ground - 40, 0.9, 0xffd08a],
      [cx - 150, ground - 24, 1.3, 0xff9a70], [cx + 150, ground - 24, 1.3, 0xff9a70],
    ];
    for (const [x, y, s, c] of lights) {
      const g = this.add.image(x, y, glow).setScale(s).setTint(c).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(400);
      if (!calm) this.tweens.add({ targets: g, alpha: { from: 0.42, to: 0.65 }, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.add.image(cx, ground + 14, glow).setScale(2.2, 0.6).setTint(0xffb867).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(399);

    // ---- night tint + vignette
    this.add.rectangle(cx, 120, W * 16 + 800, 900, 0x1c1240, 0.28).setDepth(390);
    const vig = this.add.image(cx, 150, vignetteTexture(this)).setDepth(401).setAlpha(0.75);

    // ---- particles: fireflies and drifting petals
    const ff = dotTexture(this, 'firefly', '#f4f0a0', 1, 1);
    if (!calm) {
      this.add
        .particles(0, 0, ff, { x: { min: 0, max: W * 16 }, y: { min: 100, max: H * 16 }, speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 6 }, lifespan: 4500, frequency: 160, alpha: { start: 0, end: 1, yoyo: true } as any, blendMode: 'ADD' })
        .setDepth(402);
      const pet = dotTexture(this, 'petal', '#f4c6cf', 2, 1);
      this.add.particles(0, -10, pet, { x: { min: 0, max: W * 16 }, speedY: { min: 10, max: 18 }, speedX: { min: 6, max: 14 }, lifespan: 16000, frequency: 900, rotate: { min: 0, max: 360 } }).setDepth(402);
      // shooting stars now and then
      this.time.addEvent({
        delay: 5200,
        loop: true,
        callback: () => {
          const sx = Math.random() * W * 16;
          const st = this.add.rectangle(sx, 10 + Math.random() * 50, 10, 1, 0xfff6c8).setDepth(-12).setAngle(20);
          this.tweens.add({ targets: st, x: sx + 90, y: st.y + 34, alpha: 0, duration: 900, onComplete: () => st.destroy() });
        },
      });
    }

    // ---- camera: cover the screen and drift slowly
    const cam = this.cameras.main;
    let baseX = cx;
    let baseY = 9 * 16;
    const fit = () => {
      const z = Math.max(this.scale.width / (W * 16 - 60), this.scale.height / (H * 16 + 120));
      cam.setZoom(Math.max(1, Math.ceil(z * 2) / 2));
      const portrait = this.scale.height > this.scale.width;
      baseX = cx;
      // portrait phones: restaurant and raccoons sit in the middle, between logo and menu
      baseY = portrait ? ground + 52 : 9 * 16 + 20;
      cam.centerOn(baseX, baseY);
      vig.setDisplaySize(this.scale.width / cam.zoom + 40, this.scale.height / cam.zoom + 40).setPosition(baseX, baseY);
    };
    fit();
    if (!calm)
      this.events.on('update', (time: number) => {
        cam.centerOn(baseX + Math.sin(time / 4200) * 10, baseY + Math.sin(time / 3100) * 3);
        vig.setPosition(cam.midPoint.x, cam.midPoint.y);
      });
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
  }
}
