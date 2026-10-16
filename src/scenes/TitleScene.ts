/**
 * Animated night view behind the title menu (style guide: the title reference): a river with a wooden bridge,
 * the lantern-lit restaurant, Spicy waving, Pip asleep on the grass and Rigg snacking on a barrel.
 */
import Phaser from 'phaser';
import { FRAMES } from '../art/characters';
import { TILE_INDEX } from '../art/tiles';
import { settings } from '../core/settings';
import type { ZoneDef } from '../data/zones';
import { buildOverlay } from '../world/zoneRuntime';
import { charTexture, dotTexture, ensureTileset, glowTexture, propTexture, vignetteTexture } from './textures';
import { warmNextOutdoor } from './warmArt';

const W = 32;
const H = 28;
const SKY = 7;

/** ground plan: g grass, p path, w water, d deep water, b bridge, . sky */
function groundRows(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      if (y < SKY) r += '.';
      else if (x >= 2 && x <= 7) r += y === 14 ? 'b' : x >= 4 && x <= 5 ? 'd' : 'w';
      else if ((y === 14 || y === 15) && x > 7 && x < 19) r += 'p';
      else if (x >= 18 && x <= 19 && y >= 11 && y <= 15) r += 'p';
      else r += 'g';
    }
    rows.push(r);
  }
  return rows;
}

function tileOf(ch: string, x: number, y: number): number {
  switch (ch) {
    case 'g': return TILE_INDEX['grass' + ((x * 7 + y * 3) % 5 === 0 ? 3 : (x + y) % 3)];
    case 'p': return TILE_INDEX.dirt;
    case 'w': return TILE_INDEX.water0;
    case 'd': return TILE_INDEX.deep0;
    case 'b': return TILE_INDEX.bridge;
    default: return -1;
  }
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    ensureTileset(this);
    const calm = settings.reduceMotion;
    const rows = groundRows();
    const data = rows.map((r, y) => [...r].map((ch, x) => tileOf(ch, x, y)));
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const ts = map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0)!;
    map.createLayer(0, ts, 0, 0)!.setDepth(-10);
    const fake = { outdoor: true, w: W, h: H, ground: rows } as unknown as ZoneDef;
    const omap = this.make.tilemap({ data: buildOverlay(fake), tileWidth: 16, tileHeight: 16 });
    omap.createLayer(0, omap.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0)!, 0, 0)!.setDepth(-9);
    const T = 16;
    const cx = (W * T) / 2;

    // ---- night sky, moon, stars, far hills
    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x0e1236, 0x0e1236, 0x26346a, 0x2a3a72, 1);
    sky.fillRect(-400, -400, W * T + 800, SKY * T + 404);
    const star = dotTexture(this, 'star1', '#f6ecd6', 1, 1);
    for (let i = 0; i < 110; i++) {
      const s = this.add.image(Math.random() * W * T, Math.random() * (SKY * T - 20) - 10, star).setDepth(-15).setAlpha(Math.random());
      if (!calm) this.tweens.add({ targets: s, alpha: { from: 0.15, to: 1 }, duration: 700 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    const mx = 70;
    const my = 30;
    this.add.image(mx, my, glowTexture(this)).setScale(1.8).setTint(0xf4e3a8).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(-14);
    this.add.circle(mx, my, 14, 0xf6ecc8).setDepth(-14);
    this.add.circle(mx - 4, my - 3, 3, 0xe6dcb4).setDepth(-13);
    this.add.circle(mx + 5, my + 4, 2, 0xe6dcb4).setDepth(-13);
    const hills = this.add.graphics().setDepth(-16);
    hills.fillStyle(0x1d2a4e, 1);
    for (let x = -40; x < W * T + 40; x += 64) hills.fillEllipse(x, SKY * T + 2, 130, 56);
    hills.fillStyle(0x24365a, 1);
    for (let x = -10; x < W * T + 40; x += 48) hills.fillEllipse(x, SKY * T + 8, 84, 30);

    // ---- set dressing
    const put = (key: string, x: number, y: number, depth = y) => this.add.image(x, y, propTexture(this, key)).setOrigin(0.5, 1).setDepth(depth);
    const sway = (o: Phaser.GameObjects.Image) => {
      if (!calm) this.tweens.add({ targets: o, angle: { from: -0.8, to: 0.8 }, duration: 2400 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    };
    // tree line behind
    for (const [k, x] of [['pine', 4], ['tree_dark', 34], ['pine', 120], ['tree', 150], ['tree_dark', 470], ['pine', 500], ['tree', 440]] as const) sway(put(k, x, SKY * T + 14, 2));
    const bx = 19 * T;
    const groundY = 11 * T + 2;
    put('bld_restaurant', bx, groundY, groundY);
    put('wall_lantern_red', bx - 70, groundY - 6, groundY + 1);
    put('wall_lantern_red', bx + 70, groundY - 6, groundY + 1);
    put('lamppost', bx - 76, groundY + 20);
    put('bush_flower', bx + 64, groundY + 12);
    put('bush', bx - 60, groundY + 12);
    put('pot_rose', bx - 30, groundY + 12);
    put('menuboard', bx + 30, groundY + 14);
    for (const [k, x, y] of [['tree', 460, 15 * T], ['sakura', 500, 18 * T], ['bush_berry', 420, 19 * T], ['flowers', 140, 17 * T], ['flowers_lav', 320, 18.5 * T], ['tree', 150, 20 * T], ['reeds', 132, 12.5 * T], ['reeds', 128, 16.5 * T]] as const)
      sway(put(k, x, y));
    put('lanternstring', 13.5 * T, 14 * T, 13 * T);
    // Rigg's barrel
    const rx = 22.5 * T;
    const ry = 15.5 * T;
    put('barrel', rx, ry + 2, ry);

    // ---- raccoons
    const spicy = this.add.sprite(12.5 * T, 16.5 * T, charTexture(this, 'spicy'), FRAMES.down[0]).setOrigin(0.5, 1).setDepth(16.5 * T);
    const pip = this.add.sprite(16.8 * T, 17.6 * T, charTexture(this, 'pip'), FRAMES.sleep).setOrigin(0.5, 1).setDepth(17.6 * T);
    const rigg = this.add.sprite(rx, ry - 12, charTexture(this, 'rigg'), FRAMES.happy).setOrigin(0.5, 1).setDepth(ry + 1);
    for (const s of [spicy, pip]) this.add.ellipse(s.x, s.y - 1, s.width * 0.7, 5, 0x0a0618, 0.35).setDepth(s.depth - 1);
    if (!calm) {
      // Spicy waves (hops with a happy face), Rigg nibbles, Pip breathes and snores little Zs
      this.time.addEvent({
        delay: 1700, loop: true, callback: () => {
          spicy.setFrame(FRAMES.happy);
          this.tweens.add({ targets: spicy, y: spicy.y - 5, duration: 150, yoyo: true, repeat: 1, ease: 'Sine.out', onComplete: () => spicy.setFrame(FRAMES.down[0]) });
        },
      });
      this.tweens.add({ targets: rigg, y: rigg.y - 1, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.time.addEvent({ delay: 2600, loop: true, callback: () => { rigg.setFrame(FRAMES.blinkDown); this.time.delayedCall(180, () => rigg.setFrame(FRAMES.happy)); } });
      this.tweens.add({ targets: pip, scaleY: { from: 1, to: 1.04 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.time.addEvent({
        delay: 1300, loop: true, callback: () => {
          const z = this.add.text(pip.x + 10, pip.y - 20, 'z', { fontFamily: 'Pixelify Sans, sans-serif', fontSize: '22px', color: '#f6ecd6', stroke: '#2a2230', strokeThickness: 5, resolution: 2 })
            .setScale(0.32).setDepth(500);
          this.tweens.add({ targets: z, x: z.x + 8, y: z.y - 18, scale: 0.5, alpha: { from: 1, to: 0 }, duration: 2200, ease: 'Sine.out', onComplete: () => z.destroy() });
        },
      });
    }

    // ---- lights
    const glow = glowTexture(this);
    const lights: [number, number, number, number][] = [
      [bx - 70, groundY - 18, 1.2, 0xff9a5a], [bx + 70, groundY - 18, 1.2, 0xff9a5a], [bx - 76, groundY - 10, 1.3, 0xffd08a],
      [bx, groundY - 14, 1.9, 0xffb867], [bx - 30, groundY - 36, 1, 0xffd08a], [bx + 30, groundY - 36, 1, 0xffd08a],
      [13.5 * T - 20, 14 * T - 26, 0.9, 0xff9a70], [13.5 * T + 20, 14 * T - 26, 0.9, 0xff9a70],
    ];
    for (const [x, y, s, c] of lights) {
      const g = this.add.image(x, y, glow).setScale(s).setTint(c).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(400);
      if (!calm) this.tweens.add({ targets: g, alpha: { from: 0.45, to: 0.7 }, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // moonlight on the river
    this.add.image(5 * T, 15 * T, glow).setScale(1.6, 3).setTint(0x9fc8ff).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(399);

    // ---- night tint + vignette
    this.add.rectangle(cx, 160, W * T + 800, 900, 0x182058, 0.34).setDepth(390);
    const vig = this.add.image(cx, 160, vignetteTexture(this)).setDepth(401).setAlpha(0.55);

    // ---- particles: fireflies, petals, shooting stars
    if (!calm) {
      const ff = dotTexture(this, 'firefly', '#f4f0a0', 1, 1);
      this.add.particles(0, 0, ff, { x: { min: 0, max: W * T }, y: { min: 110, max: H * T }, speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 6 }, lifespan: 4500, frequency: 140, alpha: { start: 0, end: 1, yoyo: true } as any, blendMode: 'ADD' }).setDepth(402);
      const pet = dotTexture(this, 'petal', '#f4c6cf', 2, 1);
      this.add.particles(0, -10, pet, { x: { min: 0, max: W * T }, speedY: { min: 10, max: 18 }, speedX: { min: 6, max: 14 }, lifespan: 16000, frequency: 900, rotate: { min: 0, max: 360 } }).setDepth(402);
      this.time.addEvent({
        delay: 5200, loop: true, callback: () => {
          const sx = Math.random() * W * T;
          const st = this.add.rectangle(sx, 10 + Math.random() * 50, 10, 1, 0xfff6c8).setDepth(-12).setAngle(20);
          this.tweens.add({ targets: st, x: sx + 90, y: st.y + 34, alpha: 0, duration: 900, onComplete: () => st.destroy() });
        },
      });
    }

    // ---- camera: cover the screen and drift slowly
    const cam = this.cameras.main;
    let baseX = cx;
    let baseY = 12 * T;
    const fit = () => {
      const portrait = this.scale.height > this.scale.width;
      // integer zoom keeps pixels crisp; portrait frames the raccoons between the logo and the menu
      const z = portrait ? this.scale.width / 230 : Math.max(this.scale.width / (W * T - 40), this.scale.height / 300);
      cam.setZoom(Math.max(1, Math.round(z)));
      baseX = portrait ? 17.5 * T : cx + 44;
      baseY = portrait ? 13.7 * T : 12 * T;
      cam.centerOn(baseX, baseY);
      vig.setDisplaySize(this.scale.width / cam.zoom + 40, this.scale.height / cam.zoom + 40).setPosition(baseX, baseY);
    };
    fit();
    if (!calm)
      this.events.on('update', (time: number) => {
        cam.centerOn(baseX + Math.sin(time / 4200) * 8, baseY + Math.sin(time / 3100) * 3);
        vig.setPosition(cam.midPoint.x, cam.midPoint.y);
      });
    this.scale.on('resize', fit);
    const warm = this.time.addEvent({ delay: 400, loop: true, callback: () => { if (!warmNextOutdoor(this)) this.time.removeEvent(warm); } });
    this.events.once('shutdown', () => { this.scale.off('resize', fit); this.time.removeEvent(warm); });
  }
}
