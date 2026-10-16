import Phaser from 'phaser';
import { FRAMES } from '../art/characters';
import type { Dir } from '../core/types';
import type { NpcAct } from '../data/characters';
import { lowFx } from '../core/perf';
import type { Grid } from '../world/grid';
import { castEpoch, castKey } from '../scenes/shadowTex';
import { restPose } from './restPose';

export const TILE = 16;

export type Act = 'idle' | 'happy' | 'surprised' | 'wave' | NpcAct;

const WALK_FRAMES: Record<Dir, readonly number[]> = { down: FRAMES.down, up: FRAMES.up, left: FRAMES.left, right: FRAMES.right };

/** A walking character (player, raccoon or villager) rendered from a generated sheet. */
/** Shared sun direction for cast shadows (set by WorldScene from the time of day and weather). */
export class Actor {
  static sun = { dx: 3, sy: 0.3, alpha: 1 };
  scene: Phaser.Scene;
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  /** transparent rows above the figure in this texture (detailed folk sprites) */
  pad = 0;
  /** customer sheets: seated frames are side views (see customerSheet.ts) */
  sideSit = false;
  cast: Phaser.GameObjects.Sprite;
  private castSeen = -1;
  bubble: Phaser.GameObjects.Text | null = null;
  x: number; // feet position in px
  y: number;
  dir: Dir = 'down';
  speed = 52; // px / s
  path: [number, number][] = [];
  moving = false;
  act: Act = 'idle';
  seatLift = 0;
  /** drawn in front of furniture whose base is a few pixels lower (a guest sitting in a chair whose back is behind them) */
  depthBoost = 0;
  /** Bed (in tiles) to lie in while asleep: only the head and shoulders show above the quilt. */
  bed: { x: number; y: number; w: number; h: number } | null = null;
  private lying = false;
  private animT = 0;
  private blinkT = 2 + Math.random() * 3;
  private blinking = 0;
  private actT = 0;
  private bubbleT = 0;
  private fadingBubble: Phaser.GameObjects.Text | null = null;
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
    this.pad = (scene.textures.get(texture).customData as { pad?: number } | undefined)?.pad ?? 0;
    this.sideSit = !!(scene.textures.get(texture).customData as { sideSit?: boolean } | undefined)?.sideSit;
    this.shadow = scene.add.ellipse(this.x, this.y, Math.max(11, Math.round(fw * 0.62)), fw > 30 ? 6 : 4, 0x2a2230, 0.25);
    this.sprite = scene.add.sprite(this.x, this.y, texture, 0).setOrigin(0.5, 1);
    // silhouette cast shadow that follows the current animation frame
    this.cast = scene.add.sprite(this.x, this.y, texture, 0).setOrigin(0.5, 0).setAlpha(0.34).setVisible(false);
    this.sync();
  }

  get tx() {
    return Math.floor(this.x / TILE);
  }
  get ty() {
    return Math.floor((this.y - 1) / TILE);
  }

  setTexture(key: string) {
    this.pad = (this.scene.textures.get(key).customData as { pad?: number } | undefined)?.pad ?? 0;
    this.sideSit = !!(this.scene.textures.get(key).customData as { sideSit?: boolean } | undefined)?.sideSit;
    this.sprite.setTexture(key, this.sprite.frame.name);
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
    this.clearEmote();
    this.bubble = this.scene.add
      .text(this.x, this.y - 30, text, {
        fontFamily: 'Pixelify Sans, sans-serif',
        fontSize: '22px',
        color: '#2a2230',
        backgroundColor: '#f6ecd6',
        padding: { x: 4, y: 1 },
        wordWrap: { width: 330, useAdvancedWrap: true },
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setScale(0.05)
      .setDepth(100000);
    // pop in with a little overshoot
    this.scene.tweens.add({ targets: this.bubble, scale: 0.33, duration: 220, ease: 'Back.out' });
    this.bubbleT = seconds;
  }

  clearEmote() {
    for (const b of [this.bubble, this.fadingBubble]) {
      if (!b) continue;
      this.scene.tweens.killTweensOf(b);
      b.destroy();
    }
    this.bubble = this.fadingBubble = null;
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
        this.fadingBubble = b;
        this.scene.tweens.add({ targets: b, alpha: 0, y: b.y - 6, duration: 200, onComplete: () => { b.destroy(); if (this.fadingBubble === b) this.fadingBubble = null; } });
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
        case 'sleep': {
          const pose = restPose(this.id, this.actT);
          frame = pose.frame;
          this.bob = pose.bob;
          if (pose.z && !this.bubble) this.emote('z', 1.2);
          break;
        }
        case 'happy':
          frame = FRAMES.happy;
          this.bob = Math.abs(Math.sin(this.actT * 10)) * 2;
          break;
        case 'surprised':
          frame = FRAMES.surprised;
          break;
        case 'cook':
        case 'work':
        case 'clean':
        case 'fish':
        case 'paint':
          frame = this.dir === 'up' ? FRAMES.up[Math.floor(this.actT * 3) % 2 ? 0 : 1] : FRAMES.cook[Math.floor(this.actT * 3) % 2];
          break;
        case 'read':
          frame = this.dir === 'up' ? FRAMES.up[0] : FRAMES.read;
          this.bob = Math.sin(this.actT * 1.4) > 0.9 ? 1 : 0;
          break;
        case 'sit':
        case 'eat':
        case 'drink':
          frame = FRAMES.sit;
          if (!this.sideSit && this.act === 'sit') this.bob = Math.sin(this.actT * 1.3 + this.phase) > 0.2 ? 1 : 0;
          if (this.sideSit) {
            // customers: breathing while seated, chewing while eating (frames 30..33 / 34 of their sheet)
            const eating = this.act === 'eat', bite = Math.floor(this.actT * 3) % 4, breath = Math.floor(this.actT * 1.5) % 2;
            // facing the camera (sitting across the table) or with their back to it; sideways keeps the profile frames
            if (this.dir === 'down') frame = eating ? 37 + bite : breath ? 36 : 35;
            else if (this.dir === 'up') frame = eating ? 43 + bite : breath ? 42 : 41;
            else frame = eating ? 30 + bite : breath ? 34 : 29;
          }
          // Only guests with a chewing frame say it. Villagers share the sit pose, so the word looked random.
          if (this.sideSit && !this.bubble && this.act !== 'sit' && this.actT > 0.35 && this.actT < 0.5) this.emote(this.act === 'eat' ? 'ñam' : 'té', 1.3);
          break;
        case 'wave':
        case 'talk':
          frame = FRAMES.wave[Math.floor(this.actT * (this.act === 'talk' ? 2 : 4)) % 2];
          break;
        case 'play':
          frame = WALK_FRAMES[this.dir][0];
          this.bob = Math.abs(Math.sin(this.actT * 5)) > 0.8 ? 2 : 0;
          break;
        case 'stars':
          frame = FRAMES.up[0];
          if (!this.bubble && Math.floor(this.actT) % 5 === 0 && this.actT % 1 < 0.08) this.emote('*', 1.2);
          break;
        case 'look':
        default:
          frame = WALK_FRAMES[this.dir][0];
          // gentle breathing while standing still
          if ((this.animT + this.phase) % 1.8 > 1.15) frame = FRAMES.breathe[this.dir];
      }
      if (this.blinking > 0 && this.act !== 'sleep' && this.act !== 'happy' && this.act !== 'sit' && this.act !== 'eat' && this.act !== 'drink' && this.act !== 'read') {
        if (this.dir === 'down') frame = FRAMES.blinkDown;
        else if (this.dir === 'right') frame = FRAMES.blinkRight;
        else if (this.dir === 'left') frame = FRAMES.blinkLeft;
      }
    }
    if (this.sprite.frame.name !== String(frame)) this.sprite.setFrame(frame);
    // side-view seated frames look right: mirror them for seats that face left
    const flip = this.sideSit && (this.act === 'sit' || this.act === 'eat' || this.act === 'drink') && this.dir === 'left';
    if (this.sprite.flipX !== flip) this.sprite.setFlipX(flip);
  }

  private syncLying(): boolean {
    const b = this.bed;
    const lie = !!b && !this.moving && this.act === 'sleep' && restPose(this.id, this.actT).lie;
    if (lie !== this.lying) {
      this.lying = lie;
      if (!lie) this.sprite.setCrop();
      this.shadow.setVisible(!lie);
    }
    if (!lie || !b) return false;
    const f = this.sprite.frame;
    const keep = Math.round(f.height * 0.42);
    this.sprite.setCrop(0, 0, f.width, keep);
    const cx = Math.round(b.x * TILE + (b.w * TILE) / 2);
    const top = b.y * TILE;
    const breath = restPose(this.id, this.actT).bob > 0 ? 1 : 0;
    this.sprite.setPosition(cx, top + 20 + (f.height - keep) - breath);
    this.sprite.setDepth((b.y + b.h) * TILE + 1);
    this.cast.setVisible(false);
    return true;
  }

  sync() {
    const lying = this.syncLying();
    const rx = Math.round(this.x);
    const ry = Math.round(this.y);
    const seated = !this.moving && ['sit', 'read', 'eat', 'drink'].includes(this.act) ? this.seatLift : 0;
    if (!lying) {
      this.sprite.setPosition(rx, ry - this.bob - seated);
      this.sprite.setDepth(ry + this.depthBoost);
      const feet = ry - seated;
      this.shadow.setPosition(rx, feet - 1);
      this.shadow.setDepth(ry - 0.5);
      const sun = Actor.sun;
      const squash = 0.34 * (sun.sy / 0.3);
      // the silhouette is baked already sheared and squashed for this sun (see shadowTex.ts): it hangs from the feet
      const key = lowFx() || !this.sprite.visible ? null : castKey(this.scene, this.sprite.texture.key, this.sprite.frame.name, sun.dx * 1.4, squash, this.sprite.flipX);
      if (key) {
        if (this.cast.texture.key !== key || this.castSeen !== castEpoch()) { this.cast.setTexture(key); this.castSeen = castEpoch(); }
        this.cast.setOrigin(0.5, 0).setPosition(rx, feet - 1).setDepth(ry - 0.6).setVisible(true).setAlpha(0.34 * sun.alpha);
      } else this.cast.setVisible(false);
    }
    if (this.bubble) {
      const view = this.scene.cameras.main.worldView;
      const half = this.bubble.displayWidth / 2;
      const bx = Math.max(view.x + half + 3, Math.min(rx, view.right - half - 3));
      const by = Math.max(view.y + this.bubble.displayHeight + 3, Math.min(this.sprite.y - this.sprite.height + this.pad - 1, view.bottom - 3));
      this.bubble.setPosition(bx, by);
    }
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
    this.clearEmote();
  }
}
