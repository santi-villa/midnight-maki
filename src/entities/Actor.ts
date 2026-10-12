import Phaser from 'phaser';
import { FRAMES } from '../art/characters';
import type { Dir } from '../core/types';
import type { Grid } from '../world/grid';

export const TILE = 16;

export type Act = 'idle' | 'sleep' | 'cook' | 'read' | 'sit' | 'play' | 'work' | 'fish' | 'paint' | 'stars' | 'happy' | 'surprised';

const WALK_FRAMES: Record<Dir, readonly number[]> = { down: FRAMES.down, up: FRAMES.up, left: FRAMES.left, right: FRAMES.right };

/** A walking character (player, raccoon or villager) rendered from a generated sheet. */
export class Actor {
  scene: Phaser.Scene;
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  cast: Phaser.GameObjects.Sprite;
  bubble: Phaser.GameObjects.Text | null = null;
  x: number; // feet position in px
  y: number;
  dir: Dir = 'down';
  speed = 52; // px / s
  path: [number, number][] = [];
  moving = false;
  act: Act = 'idle';
  private animT = 0;
  private blinkT = 2 + Math.random() * 3;
  private blinking = 0;
  private actT = 0;
  private bubbleT = 0;
  onArrive: (() => void) | null = null;
  /** random offset so groups don't breathe in sync */
  private phase = Math.random() * 2;
  /** pixel offset for small bob animations */
  private bob = 0;

  constructor(scene: Phaser.Scene, id: string, texture: string, tx: number, ty: number) {
    this.scene = scene;
    this.id = id;
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE - 2;
    const fw = scene.textures.get(texture).get(0)?.width ?? 16;
    this.shadow = scene.add.ellipse(this.x, this.y, Math.max(11, Math.round(fw * 0.62)), fw > 30 ? 6 : 4, 0x2a2230, 0.25);
    this.sprite = scene.add.sprite(this.x, this.y, texture, 0).setOrigin(0.5, 1);
    // silhouette cast shadow that follows the current animation frame
    this.cast = scene.add.sprite(this.x, this.y, texture, 0).setOrigin(0.5, 0).setFlipY(true).setTintFill(0x140c24).setAlpha(0.3).setScale(1, 0.34);
    this.sync();
  }

  get tx() {
    return Math.floor(this.x / TILE);
  }
  get ty() {
    return Math.floor((this.y - 1) / TILE);
  }

  setTexture(key: string) {
    this.sprite.setTexture(key, this.sprite.frame.name);
    this.cast.setTexture(key, this.sprite.frame.name);
  }

  face(d: Dir) {
    this.dir = d;
    this.updateFrame(0);
  }

  faceTowards(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.face(dx > 0 ? 'right' : 'left');
    else this.face(dy > 0 ? 'down' : 'up');
  }

  setAct(a: Act) {
    this.act = a;
    this.actT = 0;
    this.updateFrame(0);
  }

  /** Walk along tile path computed from the grid. Returns false if unreachable. */
  walkTo(grid: Grid, tx: number, ty: number, onArrive?: () => void): boolean {
    const p = grid.path(this.tx, this.ty, tx, ty);
    if (!p) return false;
    this.path = p;
    this.onArrive = onArrive ?? null;
    if (!p.length) {
      const cb = this.onArrive;
      this.onArrive = null;
      cb?.();
    }
    return true;
  }

  stop() {
    this.path = [];
    this.moving = false;
    this.onArrive = null;
  }

  teleport(tx: number, ty: number) {
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE - 2;
    this.path = [];
    this.sync();
  }

  emote(text: string, seconds = 1.6) {
    if (this.bubble) this.bubble.destroy();
    this.bubble = this.scene.add
      .text(this.x, this.y - 30, text, {
        fontFamily: 'Pixelify Sans, sans-serif',
        fontSize: '22px',
        color: '#2a2230',
        backgroundColor: '#f6ecd6',
        padding: { x: 4, y: 1 },
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setScale(0.05)
      .setDepth(100000);
    // pop in with a little overshoot
    this.scene.tweens.add({ targets: this.bubble, scale: 0.33, duration: 220, ease: 'Back.out' });
    this.bubbleT = seconds;
  }

  update(dt: number) {
    // path following
    if (this.path.length) {
      const [nx, ny] = this.path[0];
      const tx = nx * TILE + TILE / 2;
      const ty = ny * TILE + TILE - 2;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
      else if (dy !== 0) this.dir = dy > 0 ? 'down' : 'up';
      if (dist <= step) {
        this.x = tx;
        this.y = ty;
        this.path.shift();
        if (!this.path.length) {
          this.moving = false;
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.moving = true;
      }
    } else if (this.moving && !this.manual) this.moving = false;
    this.animT += dt;
    this.actT += dt;
    // blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.14;
      this.blinkT = 2.5 + Math.random() * 3.5;
    }
    if (this.blinking > 0) this.blinking -= dt;
    this.updateFrame(dt);
    if (this.bubble) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        const b = this.bubble;
        this.bubble = null;
        this.scene.tweens.add({ targets: b, alpha: 0, y: b.y - 6, duration: 200, onComplete: () => b.destroy() });
      }
    }
    this.sync();
  }

  /** set by player controller while moving with keys/joystick */
  manual = false;

  private updateFrame(_dt: number) {
    this.bob = 0;
    let frame: number;
    if (this.moving) {
      const seq = WALK_FRAMES[this.dir];
      frame = seq[Math.floor(this.animT * 8) % 4];
    } else {
      switch (this.act) {
        case 'sleep':
          frame = FRAMES.sleep;
          this.bob = Math.sin(this.actT * 2) > 0.6 ? 1 : 0;
          if (Math.floor(this.actT) % 4 === 0 && !this.bubble && this.actT % 1 < 0.05) this.emote('z', 1.2);
          break;
        case 'happy':
          frame = FRAMES.happy;
          this.bob = Math.abs(Math.sin(this.actT * 10)) * 2;
          break;
        case 'surprised':
          frame = FRAMES.surprised;
          break;
        case 'cook':
          frame = this.dir === 'up' ? FRAMES.up[0] : FRAMES.down[0];
          this.bob = Math.sin(this.actT * 6) > 0 ? 1 : 0;
          break;
        case 'read':
          frame = this.dir === 'left' ? FRAMES.left[0] : this.dir === 'right' ? FRAMES.right[0] : FRAMES.down[0];
          break;
        case 'play':
          frame = WALK_FRAMES[this.dir][0];
          this.bob = Math.abs(Math.sin(this.actT * 5)) > 0.8 ? 2 : 0;
          break;
        default:
          frame = WALK_FRAMES[this.dir][0];
          // gentle breathing while standing still
          if ((this.animT + this.phase) % 1.8 > 1.15) frame = FRAMES.breathe[this.dir];
      }
      if (this.blinking > 0 && this.act !== 'sleep' && this.act !== 'happy') {
        if (this.dir === 'down') frame = FRAMES.blinkDown;
        else if (this.dir === 'right') frame = FRAMES.blinkRight;
        else if (this.dir === 'left') frame = FRAMES.blinkLeft;
      }
    }
    if (this.sprite.frame.name !== String(frame)) this.sprite.setFrame(frame);
  }

  sync() {
    const rx = Math.round(this.x);
    const ry = Math.round(this.y);
    this.sprite.setPosition(rx, ry - this.bob);
    this.sprite.setDepth(ry);
    this.shadow.setPosition(rx, ry - 1);
    this.shadow.setDepth(ry - 0.5);
    this.cast.setPosition(rx + 2, ry - 1).setDepth(ry - 0.6);
    if (this.cast.frame.name !== this.sprite.frame.name) this.cast.setFrame(this.sprite.frame.name);
    if (this.bubble) this.bubble.setPosition(rx, ry - this.sprite.height - 1);
  }

  setVisible(v: boolean) {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
    this.cast.setVisible(v);
    if (this.bubble) this.bubble.setVisible(v);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.cast.destroy();
    this.bubble?.destroy();
  }
}
