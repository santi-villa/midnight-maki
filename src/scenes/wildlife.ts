/**
 * The small animals of the village, drawn and animated in code (art in wildlifeArt.ts):
 *  - frogs on the banks of ponds and rivers: they sit, croak, hop along the bank, and dive in when someone comes close;
 *  - a duck with her ducklings on fresh water: they paddle about in a line, she dabbles, they swim away from the bank;
 *  - crabs on the beach sand: they scuttle sideways and dig in when someone comes close;
 *  - squirrels by the trees: they forage on the ground, sit up to nibble, and run up their tree when frightened;
 *  - dragonflies darting over the water, and bees around the flowers;
 *  - and the petals and leaves that fall from the trees (cherry petals in spring, a green leaf now and then in summer, autumn leaves).
 * All of it is drawing: nothing blocks, nothing is saved. In battery / reduced-motion mode none of it is there.
 */
import Phaser from 'phaser';
import { TILE } from '../entities/Actor';
import { FRAME, fallTexture, wildTexture, type FallKind } from './wildlifeArt';
import { jumpAt, solidWater } from './fishLife';
import { dotTexture } from './textures';

export interface Tree { x: number; y: number; top: number; kind: string }
export interface WildPlace {
  zone: string;
  ground: readonly string[];
  walkable: (tx: number, ty: number) => boolean;
  sea: boolean;
  season: number;
  period: number;
  rain: boolean;
  /** trees: x is the trunk's middle, y the foot, top the top of the crown (pixels) */
  trees: Tree[];
  /** flowers: their foot, in pixels */
  flowers: { x: number; y: number }[];
}
/** Who frightens an animal at (x, y): someone within its reach (plus `extra`), or null. */
export type Threat = (x: number, y: number, extra: number) => { x: number; y: number } | null;
export interface WildHooks { threat: Threat; sound: (name: string, x: number, y: number) => void }
interface View { x: number; y: number; right: number; bottom: number }

// ------------------------------------------------------------------ where they live (pure, tested)
const isWater = (g: readonly string[], x: number, y: number) => { const c = g[y]?.[x]; return c === 'w' || c === 'd'; };
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const near = (g: readonly string[], x: number, y: number, r: number) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isWater(g, x + dx, y + dy)) return true;
  return false;
};
/** A few of the candidates, spread apart, always the same ones for the same map. */
export function spread<T extends { x: number; y: number }>(cands: T[], most: number, apart: number): T[] {
  const out: T[] = [];
  for (const c of [...cands].sort((a, b) => hash(a.x, a.y) - hash(b.x, b.y))) {
    if (out.length >= most) break;
    if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= apart)) out.push(c);
  }
  return out;
}
/** Frogs: walkable ground right next to fresh water. */
export function frogHomes(g: readonly string[], walkable: (x: number, y: number) => boolean, most = 3): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
    // natural ground only: not water, not a bridge deck
    if (isWater(g, x, y) || g[y][x] === 'b' || !walkable(x, y)) continue;
    if (isWater(g, x + 1, y) || isWater(g, x - 1, y) || isWater(g, x, y + 1) || isWater(g, x, y - 1)) out.push({ x, y });
  }
  return spread(out, most, 6);
}
/** Crabs: sand within two tiles of the sea. */
export function crabHomes(g: readonly string[], walkable: (x: number, y: number) => boolean, most = 4): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] === 's' && walkable(x, y) && near(g, x, y, 2)) out.push({ x, y });
  return spread(out, most, 5);
}
/** Ducks: water with water all round it, where a family can paddle without bumping the bank. */
export function duckWater(g: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (solidWater(g, x, y)) out.push({ x, y });
  return out;
}
/** Dragonflies: the water beside a bank. */
export function bankWater(g: readonly string[], most = 3): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
    if (!isWater(g, x, y)) continue;
    if (!isWater(g, x + 1, y) || !isWater(g, x - 1, y) || !isWater(g, x, y + 1) || !isWater(g, x, y - 1)) out.push({ x, y });
  }
  return spread(out, most, 7);
}

const center = (t: { x: number; y: number }) => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 });
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ the animals
abstract class Creature {
  abstract update(dt: number, hooks: WildHooks, view: View): void;
  abstract destroy(): void;
}

/** Hops a sprite along a small arc, crouching first. */
function hop(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, to: { x: number; y: number }, lift: number, ms: number, frames: { crouch: number; air: number; land: number }, done: () => void) {
  const from = { x: s.x, y: s.y }, st = { t: 0 };
  s.setFrame(frames.crouch);
  scene.time.delayedCall(110, () => {
    if (!s.active) return;
    s.setFrame(frames.air).setFlipX(to.x < from.x);
    scene.tweens.add({
      targets: st, t: 1, duration: ms,
      onUpdate: () => { const p = jumpAt(st.t, to.x - from.x, to.y - from.y, lift); s.setPosition(from.x + p.x, from.y + p.y).setDepth(from.y + (to.y - from.y) * st.t); },
      onComplete: () => { if (s.active) s.setFrame(frames.land); done(); },
    });
  });
}

function ring(scene: Phaser.Scene, x: number, y: number) {
  const e = scene.add.ellipse(x, y, 5, 2.5).setStrokeStyle(1, 0xffffff, 0.85).setDepth(-2);
  e.isFilled = false;
  scene.tweens.add({ targets: e, scaleX: 3, scaleY: 3, alpha: 0, duration: 600, ease: 'Sine.out', onComplete: () => e.destroy() });
}

function puff(scene: Phaser.Scene, x: number, y: number, color: string) {
  const key = dotTexture(scene, 'wild_puff_' + color, color, 1, 1);
  for (let i = 0; i < 4; i++) {
    const d = scene.add.image(x, y, key).setDepth(y + 1);
    scene.tweens.add({ targets: d, x: x + rnd(-6, 6), y: y - rnd(2, 6), alpha: 0, duration: 360, onComplete: () => d.destroy() });
  }
}

class Frog extends Creature {
  private s: Phaser.GameObjects.Sprite;
  private state: 'sit' | 'busy' | 'gone' = 'sit';
  private t = rnd(1, 4);
  constructor(private scene: Phaser.Scene, private home: { x: number; y: number }, private water: { x: number; y: number }, private banks: { x: number; y: number }[], private chatty: boolean) {
    super();
    this.s = scene.add.sprite(home.x, home.y + 4, wildTexture(scene, 'frog'), FRAME.frog.sit).setOrigin(0.5, 1).setDepth(home.y + 4).setFlipX(water.x < home.x);
  }
  update(dt: number, hooks: WildHooks) {
    const s = this.s;
    if (this.state === 'busy') return;
    if (this.state === 'gone') {
      this.t -= dt;
      if (this.t > 0) return;
      if (hooks.threat(this.home.x, this.home.y, 30)) { this.t = 4; return; }
      // back out of the water onto the bank
      this.state = 'busy';
      ring(this.scene, this.water.x, this.water.y);
      s.setPosition(this.water.x, this.water.y + 2).setVisible(true);
      hop(this.scene, s, { x: this.home.x, y: this.home.y + 4 }, 9, 380, { crouch: FRAME.frog.crouch, air: FRAME.frog.air, land: FRAME.frog.sit }, () => { this.state = 'sit'; this.t = rnd(2, 5); });
      return;
    }
    if (hooks.threat(s.x, s.y, 8)) {
      // into the water with a plop
      this.state = 'busy';
      hop(this.scene, s, { x: this.water.x, y: this.water.y + 2 }, 10, 340, { crouch: FRAME.frog.crouch, air: FRAME.frog.air, land: FRAME.frog.air }, () => {
        s.setVisible(false);
        ring(this.scene, this.water.x, this.water.y);
        hooks.sound('splash_small', this.water.x, this.water.y);
        this.state = 'gone'; this.t = rnd(8, 15);
      });
      return;
    }
    this.t -= dt;
    if (this.t > 0) return;
    const r = Math.random();
    if (r < (this.chatty ? 0.55 : 0.35)) {
      // a croak: the throat puffs twice
      this.state = 'busy';
      s.setFrame(FRAME.frog.croak);
      hooks.sound('croak', s.x, s.y);
      this.scene.time.delayedCall(220, () => s.active && s.setFrame(FRAME.frog.sit));
      this.scene.time.delayedCall(380, () => s.active && s.setFrame(FRAME.frog.croak));
      this.scene.time.delayedCall(600, () => { if (s.active) s.setFrame(FRAME.frog.sit); this.state = 'sit'; });
    } else if (r < 0.8 && this.banks.length) {
      // a hop along the bank
      const to = this.banks[Math.floor(Math.random() * this.banks.length)];
      this.state = 'busy';
      hop(this.scene, s, { x: to.x, y: to.y + 4 }, 7, 300, { crouch: FRAME.frog.crouch, air: FRAME.frog.air, land: FRAME.frog.sit }, () => { this.home = to; this.state = 'sit'; });
    }
    this.t = rnd(2.5, 6);
  }
  destroy() { this.s.destroy(); }
}

class DuckFamily extends Creature {
  private mom: Phaser.GameObjects.Sprite;
  private kids: Phaser.GameObjects.Sprite[] = [];
  private trail: { x: number; y: number }[] = [];
  private pos: { x: number; y: number };
  private target: { x: number; y: number };
  private speed = 9;
  private wait = rnd(1, 3);
  private dabble = 0;
  private rippleT = 0;
  private bobT = 0;
  constructor(private scene: Phaser.Scene, private tiles: { x: number; y: number }[], private wet: (x: number, y: number) => boolean, start: { x: number; y: number }, kids: number) {
    super();
    this.pos = { ...start }; this.target = { ...start };
    this.mom = scene.add.sprite(start.x, start.y, wildTexture(scene, 'duck'), FRAME.duck.swim).setOrigin(0.5, 0.8);
    for (let i = 0; i < kids; i++) this.kids.push(scene.add.sprite(start.x - 8 * (i + 1), start.y, wildTexture(scene, 'duckling'), FRAME.duckling.swim).setOrigin(0.5, 0.8));
    // the ducklings start strung out behind her (on the water side), not on top of her
    const back = [[-1, 0], [1, 0], [0, -1], [0, 1]].find(([dx, dy]) => wet(start.x + dx * 30, start.y + dy * 30)) ?? [0, 0];
    for (let i = 0; i < 60; i++) this.trail.push({ x: start.x + back[0] * (59 - i) * 0.6, y: start.y + back[1] * (59 - i) * 0.6 });
  }
  /** A spot of water a few tiles away that she can swim to in a straight line. */
  private pick(away?: { x: number; y: number }) {
    let best: { x: number; y: number } | null = null, score = -Infinity;
    for (let i = 0; i < 14; i++) {
      const t = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      const p = { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 };
      const d = Math.hypot(p.x - this.pos.x, p.y - this.pos.y);
      if (d > 72 || d < 10) continue;
      let clear = true;
      for (let k = 1; k <= 6 && clear; k++) clear = this.wet(this.pos.x + (p.x - this.pos.x) * k / 6, this.pos.y + (p.y - this.pos.y) * k / 6);
      if (!clear) continue;
      const s = away ? Math.hypot(p.x - away.x, p.y - away.y) : Math.random();
      if (s > score) { score = s; best = p; }
    }
    return best;
  }
  update(dt: number, hooks: WildHooks) {
    const threat = hooks.threat(this.pos.x, this.pos.y, 24);
    if (threat && this.speed < 20) {
      const p = this.pick(threat);
      if (p) { this.target = p; this.speed = 24; this.dabble = 0; }
    }
    const dx = this.target.x - this.pos.x, dy = this.target.y - this.pos.y, d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = Math.min(d, this.speed * dt);
      this.pos.x += (dx / d) * step; this.pos.y += (dy / d) * step;
      this.mom.setFlipX(dx < 0);
      this.rippleT -= dt;
      if (this.rippleT <= 0) { this.rippleT = 0.9; ring(this.scene, this.pos.x - Math.sign(dx) * 5, this.pos.y + 1); }
    } else {
      this.speed = 9;
      this.wait -= dt;
      if (this.dabble > 0) { this.dabble -= dt; if (this.dabble <= 0) this.mom.setFrame(FRAME.duck.swim); }
      else if (this.wait <= 0) {
        this.wait = rnd(2, 6);
        if (Math.random() < 0.35) { this.dabble = rnd(1, 2); this.mom.setFrame(FRAME.duck.dabble); }
        else { const p = this.pick(); if (p) this.target = p; }
      }
    }
    // the ducklings follow in her wake
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(last.x - this.pos.x, last.y - this.pos.y) >= 1) { this.trail.push({ ...this.pos }); if (this.trail.length > 60) this.trail.shift(); }
    this.bobT += dt;
    const bob = Math.floor(this.bobT * 2.2) % 2;
    if (this.dabble <= 0) this.mom.setFrame(bob ? FRAME.duck.bob : FRAME.duck.swim);
    this.mom.setPosition(this.pos.x, this.pos.y).setDepth(this.pos.y);
    this.kids.forEach((k, i) => {
      const p = this.trail[Math.max(0, this.trail.length - 1 - 9 * (i + 1))];
      k.setFlipX(p.x < k.x - 0.2 ? true : p.x > k.x + 0.2 ? false : k.flipX).setPosition(p.x, p.y).setDepth(p.y).setFrame((Math.floor(this.bobT * 3 + i) % 2) ? FRAME.duckling.bob : FRAME.duckling.swim);
    });
  }
  destroy() { this.mom.destroy(); for (const k of this.kids) k.destroy(); }
}

class Crab extends Creature {
  private s: Phaser.GameObjects.Sprite;
  private state: 'idle' | 'walk' | 'hidden' = 'idle';
  private t = rnd(0.5, 3);
  private vx = 0;
  private stepT = 0;
  constructor(private scene: Phaser.Scene, private home: { x: number; y: number }, private sand: (x: number, y: number) => boolean) {
    super();
    this.s = scene.add.sprite(home.x, home.y + 4, wildTexture(scene, 'crab'), FRAME.crab.a).setOrigin(0.5, 1).setDepth(home.y + 4);
  }
  update(dt: number, hooks: WildHooks) {
    const s = this.s;
    if (this.state === 'hidden') {
      this.t -= dt;
      if (this.t <= 0 && !hooks.threat(s.x, s.y, 16)) { this.state = 'idle'; this.t = rnd(1, 3); s.setFrame(FRAME.crab.a); puff(this.scene, s.x, s.y - 1, '#e6cf9c'); }
      return;
    }
    if (hooks.threat(s.x, s.y, 6)) {
      // digs in: only the eyes stay out
      this.state = 'hidden'; this.t = rnd(6, 11); this.vx = 0;
      s.setFrame(FRAME.crab.hidden);
      puff(this.scene, s.x, s.y - 1, '#e6cf9c');
      return;
    }
    if (this.state === 'walk') {
      const nx = s.x + this.vx * dt;
      if (!this.sand(nx, s.y - 2) || Math.abs(nx - this.home.x) > 30) { this.state = 'idle'; this.t = rnd(1, 4); s.setFrame(FRAME.crab.a); return; }
      s.x = nx;
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.1; s.setFrame(s.frame.name === String(FRAME.crab.a) ? FRAME.crab.b : FRAME.crab.a); }
      this.t -= dt;
      if (this.t <= 0) { this.state = 'idle'; this.t = rnd(1, 4); s.setFrame(FRAME.crab.a); }
      return;
    }
    this.t -= dt;
    if (this.t <= 0) { this.state = 'walk'; this.vx = (Math.random() < 0.5 ? -1 : 1) * rnd(12, 20); this.t = rnd(0.4, 1.1); }
  }
  destroy() { this.s.destroy(); }
}

class Squirrel extends Creature {
  private s: Phaser.GameObjects.Sprite;
  private state: 'sit' | 'run' | 'up' | 'busy' = 'sit';
  private t = rnd(1, 3);
  private target = { x: 0, y: 0 };
  private speed = 34;
  private runT = 0;
  constructor(private scene: Phaser.Scene, private tree: Tree, private ground: (x: number, y: number) => boolean) {
    super();
    this.s = scene.add.sprite(tree.x + 10, tree.y + 6, wildTexture(scene, 'squirrel'), FRAME.squirrel.sit).setOrigin(0.5, 1).setDepth(tree.y + 6);
  }
  update(dt: number, hooks: WildHooks) {
    const s = this.s;
    if (this.state === 'busy') return;
    if (this.state === 'up') {
      this.t -= dt;
      if (this.t > 0 || hooks.threat(this.tree.x, this.tree.y, 30)) { if (this.t <= 0) this.t = 3; return; }
      // back down the trunk
      this.state = 'busy';
      s.setPosition(this.tree.x + 2, this.tree.y - 22).setVisible(true).setAlpha(0).setFlipX(false).setAngle(90).setFrame(FRAME.squirrel.runA);
      this.scene.tweens.add({ targets: s, y: this.tree.y + 2, alpha: 1, duration: 700, onComplete: () => { s.setAngle(0).setFrame(FRAME.squirrel.sit); this.state = 'sit'; this.t = rnd(1, 3); } });
      return;
    }
    if (hooks.threat(s.x, s.y, 10)) {
      // a dash to the tree and up it, out of sight
      this.state = 'busy';
      const d = Math.hypot(this.tree.x - s.x, this.tree.y - s.y);
      s.setFlipX(this.tree.x < s.x).setFrame(FRAME.squirrel.runA);
      this.scene.tweens.add({
        targets: s, x: this.tree.x + 2, y: this.tree.y + 2, duration: Math.max(120, d / 0.09),
        onComplete: () => {
          s.setAngle(-90).setFlipX(false);
          this.scene.tweens.add({ targets: s, y: this.tree.y - 24, alpha: 0, duration: 520, onComplete: () => { s.setVisible(false).setAngle(0).setAlpha(1); this.state = 'up'; this.t = rnd(10, 18); } });
        },
      });
      return;
    }
    if (this.state === 'run') {
      const dx = this.target.x - s.x, dy = this.target.y - s.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { this.state = 'sit'; this.t = rnd(1.5, 3.5); s.setFrame(FRAME.squirrel.sit); s.y = this.target.y; return; }
      const step = Math.min(d, this.speed * dt);
      this.runT += dt;
      // little bounds: a hop every few steps
      s.setPosition(s.x + (dx / d) * step, s.y + (dy / d) * step - (Math.floor(this.runT * 8) % 2 ? 0.6 : 0)).setDepth(s.y);
      s.setFrame(Math.floor(this.runT * 10) % 2 ? FRAME.squirrel.runA : FRAME.squirrel.runB);
      return;
    }
    this.t -= dt;
    if (this.t > 0) return;
    // somewhere to forage, near its tree
    for (let i = 0; i < 8; i++) {
      const x = this.tree.x + rnd(-36, 36), y = this.tree.y + rnd(-6, 26);
      if (!this.ground(x, y)) continue;
      this.target = { x, y }; this.state = 'run'; this.runT = 0; s.setFlipX(x < s.x);
      return;
    }
    this.t = 2;
  }
  destroy() { this.s.destroy(); }
}

/** Dragonflies (over the water) and bees (round the flowers): they hover, then dart to a new spot nearby. */
class Flier extends Creature {
  private s: Phaser.GameObjects.Sprite;
  private target: { x: number; y: number };
  private t = rnd(0.3, 1.2);
  private flap = 0;
  constructor(scene: Phaser.Scene, private kind: 'dragonfly' | 'bee', private home: { x: number; y: number }) {
    super();
    this.target = { ...home };
    this.s = scene.add.sprite(home.x, home.y, wildTexture(scene, kind), 0).setDepth(home.y + 40);
  }
  update(dt: number, hooks: WildHooks) {
    const s = this.s, range = this.kind === 'bee' ? 12 : 26, speed = this.kind === 'bee' ? 34 : 90;
    this.flap += dt;
    s.setFrame(Math.floor(this.flap * (this.kind === 'bee' ? 24 : 18)) % 2);
    this.t -= dt;
    const threat = hooks.threat(s.x, s.y, 2);
    if (threat) { const a = Math.atan2(s.y - threat.y, s.x - threat.x); this.target = { x: this.home.x + Math.cos(a) * range * 1.6, y: this.home.y + Math.sin(a) * range }; this.t = 1.2; }
    else if (this.t <= 0) { this.t = this.kind === 'bee' ? rnd(0.2, 0.8) : rnd(0.6, 1.8); this.target = { x: this.home.x + rnd(-range, range), y: this.home.y + rnd(-range * 0.6, range * 0.6) }; }
    const dx = this.target.x - s.x, dy = this.target.y - s.y, d = Math.hypot(dx, dy);
    const jitter = this.kind === 'bee' ? Math.sin(this.flap * 13) * 0.4 : Math.sin(this.flap * 5) * 0.2;
    if (d > 0.5) {
      const step = Math.min(d, speed * dt);
      s.x += (dx / d) * step; s.y += (dy / d) * step + jitter;
      if (this.kind === 'dragonfly') s.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
      else s.setFlipX(dx < 0);
    } else s.y += jitter;
    s.setDepth(s.y + 40);
  }
  destroy() { this.s.destroy(); }
}

// ------------------------------------------------------------------ the falling petals and leaves
interface Falling { img: Phaser.GameObjects.Image; vx: number; vy: number; phase: number; ground: number; rest: number }
const MAX_FALLING = 48;

/** What a tree lets fall in a season, and how often (per second, per tree in view). */
export function fallFor(kind: string, season: number): { what: FallKind[]; rate: number } | null {
  if (season === 0 && kind === 'sakura') return { what: ['petal'], rate: 1.5 };
  if (season === 1 && kind === 'tree') return { what: ['leaf'], rate: 0.12 };
  if (season === 2 && (kind === 'tree' || kind === 'sakura')) return { what: ['autumn0', 'autumn1', 'autumn2'], rate: 0.8 };
  return null;
}

class FallingLeaves {
  private items: Falling[] = [];
  constructor(private scene: Phaser.Scene, private trees: Tree[], private season: number, private calm: boolean) {}
  update(dt: number, view: View) {
    if (!this.calm) for (const tr of this.trees) {
      if (this.items.length >= MAX_FALLING) break;
      if (tr.x < view.x - 40 || tr.x > view.right + 40 || tr.top > view.bottom || tr.y < view.y - 20) continue;
      const f = fallFor(tr.kind, this.season);
      if (!f || Math.random() > f.rate * dt) continue;
      const what = f.what[Math.floor(Math.random() * f.what.length)];
      const x = tr.x + rnd(-15, 15), y = tr.top + rnd(6, Math.max(8, (tr.y - tr.top) * 0.55));
      const img = this.scene.add.image(x, y, fallTexture(this.scene, what)).setDepth(150000).setAngle(rnd(0, 360));
      this.items.push({ img, vx: rnd(3, 9) * (what === 'petal' ? 1 : Math.random() < 0.5 ? -1 : 1), vy: what === 'petal' ? rnd(7, 11) : rnd(10, 15), phase: rnd(0, 6), ground: Math.max(y + 12, tr.y + rnd(-8, 12)), rest: rnd(3, 6) });
    }
    this.items = this.items.filter((it) => {
      const img = it.img;
      if (img.y < it.ground) {
        it.phase += dt;
        // a drifting, tumbling fall: side to side, flipping over
        img.x += (it.vx + Math.sin(it.phase * 2.3) * 10) * dt;
        img.y += it.vy * dt;
        img.scaleX = Math.cos(it.phase * 3.1);
        img.angle += 40 * dt * Math.sin(it.phase * 1.7);
        if (img.y >= it.ground) img.setDepth(-6).setScale(1, 1);
        return true;
      }
      // on the ground for a moment, then gone
      it.rest -= dt;
      if (it.rest < 1) img.setAlpha(Math.max(0, it.rest));
      if (it.rest <= 0) { img.destroy(); return false; }
      return true;
    });
  }
  destroy() { for (const it of this.items) it.img.destroy(); this.items = []; }
}

// ------------------------------------------------------------------ the whole lot
export class Wildlife {
  private creatures: Creature[] = [];
  private leaves: FallingLeaves | null = null;
  constructor(private scene: Phaser.Scene) {}

  spawn(place: WildPlace, still: boolean) {
    this.destroy();
    const g = place.ground, scene = this.scene;
    this.leaves = new FallingLeaves(scene, place.trees, place.season, still);
    if (still) return;
    const winter = place.season === 3, warm = place.season <= 1, day = place.period <= 1;
    const sand = (x: number, y: number) => g[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] === 's' && place.walkable(Math.floor(x / TILE), Math.floor(y / TILE));
    const walk = (x: number, y: number) => place.walkable(Math.floor(x / TILE), Math.floor(y / TILE)) && !isWater(g, Math.floor(x / TILE), Math.floor(y / TILE));
    const wet = (x: number, y: number) => isWater(g, Math.floor(x / TILE), Math.floor(y / TILE));
    if (!place.sea && !winter) {
      // frogs on the banks (they sing more in the rain and at dusk)
      const homes = frogHomes(g, place.walkable, 3);
      const banks = frogHomes(g, place.walkable, 40).map(center);
      for (const h of homes) {
        const w = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy })).find((t) => isWater(g, t.x, t.y))!;
        const mine = banks.filter((b) => Math.hypot(b.x - center(h).x, b.y - center(h).y) < 40);
        this.creatures.push(new Frog(scene, center(h), center(w), mine.length ? mine : [center(h)], place.rain || place.period >= 2));
      }
    }
    if (!place.sea && place.period <= 2) {
      // a duck and her ducklings on the pond
      const tiles = duckWater(g);
      if (tiles.length >= 6) {
        const start = spread(tiles, 1, 1)[0];
        this.creatures.push(new DuckFamily(scene, tiles, wet, center(start), 2 + (hashOf(place.zone) % 3)));
      }
    }
    if (place.zone === 'beach') for (const h of crabHomes(g, place.walkable, 4)) this.creatures.push(new Crab(scene, center(h), sand));
    if (!winter && day && ['forest', 'deepforest', 'garden', 'shrine'].includes(place.zone)) {
      const trees = spread(place.trees.filter((t) => t.kind === 'tree' || t.kind === 'pine').map((t) => ({ ...t, x: t.x, y: t.y })), 2, 80);
      for (const t of trees) this.creatures.push(new Squirrel(scene, t, walk));
    }
    if (warm && day && !place.rain) {
      if (!place.sea) for (const b of bankWater(g, 3)) this.creatures.push(new Flier(scene, 'dragonfly', { x: center(b).x, y: center(b).y - 6 }));
      for (const f of spread(place.flowers, 4, 40)) this.creatures.push(new Flier(scene, 'bee', { x: f.x, y: f.y - 10 }));
    }
  }

  update(dt: number, hooks: WildHooks, view: View) {
    for (const c of this.creatures) c.update(dt, hooks, view);
    this.leaves?.update(dt, view);
  }

  destroy() {
    for (const c of this.creatures) c.destroy();
    this.creatures = [];
    this.leaves?.destroy();
    this.leaves = null;
  }
}

const hashOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
