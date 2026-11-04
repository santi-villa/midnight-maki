/** Hopscotch in the plaza and a vendor who walks between two corners. Visual only: no collisions, no shop. */
import Phaser from 'phaser';
import { makeCanvas, ctx2d, px } from '../art/pixel';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { seasonOf } from '../core/balance';
import { Actor, TILE } from '../entities/Actor';
import { lookTexture } from '../scenes/textures';
import { clock } from '../systems/time';
import type { Grid } from '../world/grid';
import { hopscotchOpen, vendorLine, vendorPhase, type VendorPhase } from './townAmbience';

const KIDS: Appearance[] = [
  { species: 'bunny', skin: '#d7c2a2', hairStyle: 0, hairColor: '#6b4a32', eyes: 0, eyeColor: '#3a2a22', top: 'top_hoodie_green', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '' },
  { species: 'squirrel', skin: '#e8c39a', hairStyle: 1, hairColor: '#8a4e28', eyes: 1, eyeColor: '#2a2230', top: 'top_hoodie_red', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '' },
  { species: 'cat', skin: '#c9856a', hairStyle: 0, hairColor: '#5a3828', eyes: 0, eyeColor: '#3a2a22', top: 'top_tee_white', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '' },
];

const VENDOR: Appearance = {
  species: 'fox', skin: '#c9844a', hairStyle: 1, hairColor: '#2b2231', eyes: 0, eyeColor: '#3a2a22',
  top: 'top_tee_black', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '',
};

/** World tiles, off the doors and off the quay mouths. The first open pair wins. */
const VENDOR_SPOTS: Record<'morning' | 'afternoon', { x: number; y: number; cx: number; cy: number }[]> = {
  morning: [{ x: 50, y: 33, cx: 1, cy: 0 }, { x: 62, y: 33, cx: -1, cy: 0 }, { x: 49, y: 42, cx: 0, cy: -1 }],
  afternoon: [{ x: 70, y: 44, cx: 0, cy: 1 }, { x: 40, y: 36, cx: 1, cy: 0 }, { x: 68, y: 50, cx: -1, cy: 0 }],
};

const COURT_TRIES = [{ x: 56, y: 38 }, { x: 51, y: 39 }, { x: 48, y: 33 }, { x: 62, y: 32 }];

const DIGITS = ['111101101101111', '010010010010010', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111'];

export class StreetLife {
  private court: Phaser.GameObjects.Image | null = null;
  private origin: { x: number; y: number } | null = null;
  private kids: Actor[] = [];
  private jumper = 0;
  private cell = 0;
  private mode: 'in' | 'play' | 'pause' | 'out' = 'in';
  private wait = 0;
  private rounds = 0;
  private retired = false;
  private away = 0;
  private key = '';
  private vendor: Actor | null = null;
  private cart: Phaser.GameObjects.Image | null = null;
  private vPhase: VendorPhase = 'off';
  private vMode: 'walk' | 'setup' | 'sell' | 'pack' | 'leave' | 'off' = 'off';
  private vWait = 0;
  private vSpot: { x: number; y: number; cx: number; cy: number } | null = null;
  private said = 0;
  private doors: { x: number; y: number }[];

  constructor(private scene: Phaser.Scene, private grid: Grid, private ground: string[], doors: { x: number; y: number }[]) {
    this.doors = doors;
  }

  update(dt: number, near: { x: number; y: number } | null = null) {
    const period = clock.period;
    const rain = game.flag('weather') === 'rain';
    const season = seasonOf(game.save.time.day);
    const key = `${period}:${rain}:${season}:${game.save.time.day}`;
    if (key !== this.key) {
      this.key = key;
      this.retired = false;
      this.rounds = 0;
    }
    this.tickCourt(dt, hopscotchOpen(period, rain, season), period);
    this.tickVendor(dt, vendorPhase(period), rain, near);
  }

  destroy() {
    this.court?.destroy();
    this.court = null;
    for (const k of this.kids) k.destroy();
    this.kids = [];
    this.vendor?.destroy();
    this.vendor = null;
    this.cart?.destroy();
    this.cart = null;
  }

  private openTile(x: number, y: number) {
    if (!this.grid.inside(x, y) || this.grid.isSolid(x, y)) return false;
    if (this.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1)) return false;
    const ch = this.ground[y]?.[x] ?? '';
    return 'gGcpsb'.includes(ch);
  }

  private findCourt(): { x: number; y: number } | null {
    for (const o of COURT_TRIES) {
      const cells = Array.from({ length: 6 }, (_, i) => ({ x: o.x, y: o.y + i }));
      const side = [{ x: o.x - 1, y: o.y + 1 }, { x: o.x + 1, y: o.y + 2 }];
      if (cells.every((c) => this.openTile(c.x, c.y)) && side.every((c) => this.openTile(c.x, c.y))) return o;
    }
    return null;
  }

  private drawCourt(show: boolean) {
    if (!this.origin) return;
    if (!show) { this.court?.setVisible(false); return; }
    if (this.court) { this.court.setVisible(true); return; }
    const key = 'mm-hopscotch';
    if (!this.scene.textures.exists(key)) {
      const c = makeCanvas(TILE, TILE * 6);
      const g = ctx2d(c);
      for (let i = 0; i < 6; i++) {
        for (let x = 3; x <= 13; x++) { px(g, x, i * TILE + 2, '#efe6d2'); px(g, x, i * TILE + 14, '#efe6d2'); }
        for (let y = 2; y <= 14; y++) { px(g, 3, i * TILE + y, '#efe6d2'); px(g, 13, i * TILE + y, '#efe6d2'); }
        const bits = DIGITS[i + 1];
        for (let n = 0; n < bits.length; n++) if (bits[n] === '1') px(g, 6 + (n % 3), i * TILE + 5 + Math.floor(n / 3), '#e4dcc8');
      }
      this.scene.textures.addCanvas(key, c);
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.court = this.scene.add.image(this.origin.x * TILE, this.origin.y * TILE, key).setOrigin(0, 0).setDepth(-8.2);
  }

  private tickCourt(dt: number, open: boolean, period: number) {
    this.origin ??= this.findCourt();
    if (!this.origin) return;
    const winter = seasonOf(game.save.time.day) === 3;
    this.drawCourt(!winter);
    if (!open || this.retired) {
      this.sendKidsOff(dt);
      return;
    }
    if (this.away > 0) {
      this.away -= dt;
      this.sendKidsOff(dt);
      return;
    }
    if (!this.kids.length) this.spawnKids();
    const limit = period === 2 ? 1 : 3;
    if (this.mode === 'in') {
      for (const k of this.kids) k.update(dt);
      if (this.kids.every((k) => !k.path.length)) { this.mode = 'play'; this.cell = 0; }
      return;
    }
    if (this.mode === 'pause') {
      this.wait -= dt;
      for (const k of this.kids) k.update(dt);
      if (this.wait <= 0) this.mode = 'play';
      return;
    }
    if (this.mode === 'out') { this.sendKidsOff(dt); return; }
    const kid = this.kids[this.jumper];
    if (!kid) return;
    for (const k of this.kids) {
      k.update(dt);
      if (k === kid && k.moving) k.sprite.y -= 4;
    }
    if (kid.path.length || kid.moving) return;
    const next = { x: this.origin.x, y: this.origin.y + this.cell };
    if (kid.tx !== next.x || kid.ty !== next.y) {
      kid.face('down');
      if (!kid.walkTo(this.grid, next.x, next.y)) this.cell++;
      return;
    }
    this.cell++;
    if (this.cell < 6) return;
    this.cell = 0;
    this.jumper = (this.jumper + 1) % this.kids.length;
    this.rounds++;
    this.mode = 'pause';
    this.wait = period === 2 ? 0.6 : 1.3;
    const home = this.post(this.jumper);
    if (home) this.kids[this.jumper]?.walkTo(this.grid, home.x, home.y);
    for (let i = 0; i < this.kids.length; i++) if (i !== this.jumper) this.kids[i].faceTowards(kid.x, kid.y);
    if (this.rounds >= limit * this.kids.length) { this.mode = 'out'; this.away = 8; this.retired = period === 2; }
  }

  private post(i: number): { x: number; y: number } | null {
    if (!this.origin) return null;
    if (i === 0) return { x: this.origin.x, y: this.origin.y };
    if (i === 1) return { x: this.origin.x - 1, y: this.origin.y + 1 };
    return { x: this.origin.x + 1, y: this.origin.y + 2 };
  }

  private spawnKids() {
    this.jumper = 0;
    this.cell = 0;
    this.mode = 'in';
    this.rounds = 0;
    for (let i = 0; i < KIDS.length; i++) {
      const post = this.post(i);
      if (!post) continue;
      const from = this.gatherTile(post);
      const actor = new Actor(this.scene, 'kid_hop_' + i, lookTexture(this.scene, KIDS[i]), from.x, from.y);
      actor.speed = 36;
      if (from.x !== post.x || from.y !== post.y) actor.walkTo(this.grid, post.x, post.y);
      this.kids.push(actor);
    }
  }

  private gatherTile(post: { x: number; y: number }) {
    for (const y of [post.y + 4, post.y + 3, post.y + 5]) {
      if (!this.openTile(post.x, y)) continue;
      if (this.grid.path(post.x, y, post.x, post.y)) return { x: post.x, y };
    }
    return post;
  }

  private sendKidsOff(dt: number) {
    if (!this.kids.length) return;
    const away = this.origin ? { x: this.origin.x, y: this.origin.y + 7 } : null;
    let gone = true;
    for (const k of this.kids) {
      if (away && this.openTile(away.x, away.y) && (k.tx !== away.x || k.ty !== away.y) && !k.path.length) k.walkTo(this.grid, away.x, away.y);
      k.update(dt);
      if (k.path.length) gone = false;
    }
    if (!gone) return;
    for (const k of this.kids) k.destroy();
    this.kids = [];
  }

  private pickSpot(phase: 'morning' | 'afternoon') {
    for (const s of VENDOR_SPOTS[phase]) {
      if (!this.openTile(s.x, s.y) || !this.openTile(s.x + s.cx, s.y + s.cy)) continue;
      return s;
    }
    return null;
  }

  private tickVendor(dt: number, phase: VendorPhase, rain: boolean, near: { x: number; y: number } | null) {
    if (phase !== this.vPhase) {
      this.vPhase = phase;
      if (phase === 'off' || phase === 'pack') this.vMode = this.vendor ? 'pack' : 'off';
      else {
        this.vSpot = this.pickSpot(phase);
        this.vMode = this.vSpot ? 'walk' : 'off';
      }
    }
    if (this.vMode === 'off') return;
    if (!this.vendor) {
      if (!this.vSpot || phase === 'off' || phase === 'pack') { this.vMode = 'off'; return; }
      const from = this.gatherTile(this.vSpot);
      this.vendor = new Actor(this.scene, 'street_vendor', lookTexture(this.scene, VENDOR), from.x, from.y);
      this.vendor.speed = 42;
      this.ensureCart();
      this.vendor.walkTo(this.grid, this.vSpot.x, this.vSpot.y);
    }
    const v = this.vendor;
    if (!v) return;
    v.update(dt);
    this.placeCart(v);
    if (this.vMode === 'walk') {
      if (this.vSpot && (v.tx !== this.vSpot.x || v.ty !== this.vSpot.y) && !v.path.length) {
        v.walkTo(this.grid, this.vSpot.x, this.vSpot.y);
        return;
      }
      if (v.path.length) return;
      this.vMode = 'setup';
      this.vWait = 1.6;
      v.face('down');
      return;
    }
    if (this.vMode === 'setup') {
      this.vWait -= dt;
      if (this.vWait <= 0) { this.vMode = 'sell'; this.said = 4; }
      return;
    }
    if (this.vMode === 'sell') {
      this.said -= dt;
      if (this.said <= 0) {
        this.said = 22;
        const close = near && Math.hypot(near.x - v.x, near.y - v.y) < 88;
        if (close) v.emote(vendorLine(phase === 'morning' || phase === 'afternoon' ? phase : 'afternoon', rain, Math.random()), 2.2);
      }
      return;
    }
    if (this.vMode === 'pack') {
      if (this.vWait <= 0) { v.emote(vendorLine('pack', rain, 0), 1.8); this.vWait = 1.8; }
      this.vWait -= dt;
      if (this.vWait > 0) return;
      const away = this.vSpot ? this.gatherTile({ x: this.vSpot.x, y: this.vSpot.y + 3 }) : null;
      if (away && this.vSpot && (away.x !== this.vSpot.x || away.y !== this.vSpot.y)) {
        v.walkTo(this.grid, away.x, away.y);
        this.vMode = 'leave';
      } else this.finishVendor();
      return;
    }
    if (!v.path.length) this.finishVendor();
  }

  private ensureCart() {
    const key = 'mm-cart';
    if (!this.scene.textures.exists(key)) {
      const c = makeCanvas(16, 14);
      const g = ctx2d(c);
      px(g, 2, 3, '#8a5a32', 12, 6);
      px(g, 3, 1, '#c45a4a', 10, 3);
      px(g, 1, 9, '#3a3346', 3, 3);
      px(g, 12, 9, '#3a3346', 3, 3);
      px(g, 5, 5, '#f3e6c8', 3, 2);
      this.scene.textures.addCanvas(key, c);
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.cart = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
  }

  private placeCart(v: Actor) {
    if (!this.cart || !this.vSpot) return;
    const packing = this.vMode === 'pack' || this.vMode === 'leave';
    const beside = !v.path.length && this.vMode !== 'walk' && this.vMode !== 'leave';
    const x = beside ? (this.vSpot.x + this.vSpot.cx) * TILE + TILE / 2 : v.x + (v.dir === 'left' ? 12 : v.dir === 'right' ? -12 : 0);
    const y = beside ? (this.vSpot.y + this.vSpot.cy) * TILE + TILE - 2 : v.y + (v.dir === 'up' ? 10 : v.dir === 'down' ? -8 : 2);
    this.cart.setVisible(!packing || this.vMode === 'pack').setPosition(x, y - (this.vMode === 'pack' ? 3 : 0)).setDepth(y);
  }

  private finishVendor() {
    this.vendor?.destroy();
    this.vendor = null;
    this.cart?.destroy();
    this.cart = null;
    this.vMode = 'off';
    this.vSpot = null;
  }
}

