/**
 * The physical kitchen in the world: draws what the model holds (things in the hands, on the counters, in the cookers, plates
 * on the pass), animates it (fridge door, steam, knife, sparks, a plate sliding to the pass), turns the stations next to the
 * player into context actions and runs what they do. All the rules are in galley/model.ts.
 */
import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
const settingsReduced = () => settings.reduceMotion;
import { game } from '../core/state';
import type { Dir } from '../core/types';
import { lowFx } from '../core/perf';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES } from '../data/recipes';
import { DRINKS } from '../restaurant/drinkData';
import { Actor, TILE } from '../entities/Actor';
import { CUT_SECONDS, handsFor, type HandDef, type Step } from '../galley/crew';
import type { Need } from '../galley/prep';
import type { Grid } from '../world/grid';
import { combineVerdicts, cutLevel, cutsNeeded, cutSpec, knivesOwned, type CutVerdict } from '../galley/cut';
import { galley, galleyOn, saveGalley } from '../galley';
import { fridgeOpenCanvas, galleyItemCanvas, itemKey, PIXEL_BITS } from '../galley/art';
import { STATIONS, STATION_BY_ID, stationCentre, type StationDef } from '../galley/layout';
import { COOK, PLAYER, itemLabel, type GalleyEvent, type Verb } from '../galley/model';
import type { GItem, IngItem } from '../galley/prep';
import { allocateStaged, stagedPieces, tickets } from '../galley/tickets';
import { TUTORIAL, TUTORIAL_DISHES, TUTORIAL_STOCK, tutorialStation, tutorialStep } from '../galley/tutorial';
import { bus } from '../core/events';
import { closestRecipe } from '../galley/prep';
import { targetFor } from '../galley/serve';
import { SUPPLY_GROUPS } from '../restaurant/supplies';
import { trayOrders } from '../restaurant/service';
import { hasBell, ringBell, waitingPlates } from '../restaurant/staff';
import { clock } from '../systems/time';
import { tooTiredToCook } from '../systems/fatigue';
import type { ContextAction, Target } from '../world/contextActions';
import { toast } from '../ui/dom';
import { closeFridgePicker, cutting, fridgeOpen, openFridgePicker, removeGalleyUi, runCutBar, showTickets, showTutorial, type FridgeChoice } from '../ui/galleyUi';

/** What the view needs from the world scene (kept as an interface so this file does not import it). */
export interface GalleyHost {
  scene: Phaser.Scene;
  player: Actor;
  zoneId: string;
  grid(): Grid;
  /** the crew members who work in the kitchen move with the town's own movement */
  crew: {
    ready(id: string): boolean;
    where(id: string): { zone: string; x: number; y: number; settled: boolean } | null;
    move(id: string, tile: { x: number; y: number } | null): void;
    actor(id: string): Actor | null;
  };
  /** the map prop standing on a tile (to make it shake) */
  propAt(x: number, y: number): Phaser.GameObjects.Image | undefined;
  /** the player cannot walk or use anything while this is true (the reflex bar, a short assembly) */
  galleyBusy: boolean;
  floatAt(x: number, y: number, text: string, color?: string): void;
  onInteract: (t: Target) => void;
}

export type GalleyVerb = Verb | 'scoop' | 'pantry' | 'bell';

const slotY = (s: StationDef) => s.y * TILE + 2;

/** where the things lying on a station are drawn, in pixels (feet of the sprite) */
function slotsFor(s: StationDef, n: number): { x: number; y: number; scale: number }[] {
  const x0 = s.x * TILE;
  if (s.kind === 'assembly') return Array.from({ length: n }, (_, i) => ({ x: x0 + 7 + (i % 3) * 9 + (i >= 3 ? 0 : 0), y: slotY(s) + 1 - (i >= 3 ? 3 : 0), scale: 0.5 }));
  if (s.kind === 'board') return [{ x: x0 + 8, y: slotY(s) + 2, scale: 0.72 }];
  if (s.id === 'hangiri') return Array.from({ length: n }, (_, i) => ({ x: x0 + 3 + (i % 3) * 5, y: slotY(s) + 1 - (i >= 3 ? 3 : 0), scale: 0.42 }));
  return Array.from({ length: n }, (_, i) => ({ x: x0 + 4 + i * 8, y: slotY(s) + 1, scale: 0.5 }));
}

interface Worker { def: HandDef; step: Step | null; moving: boolean; wait: number; timer: number; after: (() => void) | null; lost: number }

export class GalleyView {
  private active = false;
  private stationSprites = new Map<string, { key: string; sprites: Phaser.GameObjects.Image[] }>();
  private heldDraw = new Map<string, { key: string; sprites: Phaser.GameObjects.Image[] }>();
  private workers = new Map<string, Worker>();
  private passSprites: Phaser.GameObjects.Image[] = [];
  private passKey = '';
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private steamT = 0;
  private shaken = new Map<string, number>();
  private labelTexts = new Map<string, Phaser.GameObjects.Text>();
  private labelT = 0;
  private served = new Set<string>();
  private offServed: (() => void) | null = null;
  private tutT = 0;
  private tutDoneAt = 0;
  private saveT = 0;
  private rack: Phaser.GameObjects.Image | null = null;
  private bellImg: Phaser.GameObjects.Image | null = null;
  private fridgeDoor: Phaser.GameObjects.Image | null = null;
  private knife: Phaser.GameObjects.Image | null = null;
  private lastZone: number | undefined;
  /** the last thing the player did at a station: pieces glide between that slot and the hands for a moment */
  private actFrom: { x: number; y: number; t: number } | null = null;
  private clock = 0;

  constructor(private host: GalleyHost) {}

  // ------------------------------------------------------------------ lifecycle
  get on() { return this.active; }

  attach() {
    if (this.active) return;
    this.active = true;
    this.gfx = this.host.scene.add.graphics().setDepth(90500);
    // the rack of glasses is always full
    const cups = STATION_BY_ID.cups;
    this.rack = this.host.scene.add.image(cups.x * TILE + 8, cups.y * TILE + 4, this.tex({ kind: 'cup', uid: 0 })).setOrigin(0.5, 1).setScale(0.8).setDepth((cups.y + 1) * TILE + 0.5);
    galley();
    this.offServed = bus.on('galley:served', (e) => { this.served.add(e.recipe); });
  }

  detach() {
    if (!this.active) return;
    this.active = false;
    closeFridgePicker();
    removeGalleyUi();
    for (const { sprites } of this.stationSprites.values()) sprites.forEach((s) => s.destroy());
    this.stationSprites.clear();
    for (const h of this.heldDraw.values()) h.sprites.forEach((s) => s.destroy());
    this.heldDraw.clear();
    for (const id of this.workers.keys()) this.host.crew.move(id, null);
    this.workers.clear();
    this.passSprites.forEach((s) => s.destroy()); this.passSprites = []; this.passKey = '';
    for (const t of this.labels.values()) t.destroy();
    this.labels.clear();
    this.fridgeDoor?.destroy(); this.fridgeDoor = null;
    this.rack?.destroy(); this.rack = null;
    this.bellImg?.destroy(); this.bellImg = null;
    this.offServed?.(); this.offServed = null;
    for (const t of this.labelTexts.values()) t.destroy();
    this.labelTexts.clear();
    for (const [id, x] of this.shaken) { const st = STATION_BY_ID[id]; const img = this.host.propAt(st.x, st.y); if (img) img.x = x; }
    this.shaken.clear();
    this.knife?.destroy(); this.knife = null;
    this.gfx?.destroy(); this.gfx = null;
    this.host.galleyBusy = false;
    saveGalley();
  }

  // ------------------------------------------------------------------ every frame
  update(dt: number) {
    const want = this.host.zoneId === 'restaurant' && galleyOn();
    if (want && !this.active) this.attach();
    else if (!want && this.active) this.detach();
    if (!this.active) return;
    const g = galley();
    this.clock += dt;
    if (!clock.paused) this.onEvents(g.tick(dt));
    this.syncStations();
    this.syncBell();
    this.updateHands(dt);
    this.syncHeld(PLAYER, this.host.player);
    for (const id of this.workers.keys()) { const a = this.host.crew.actor(id); if (a) this.syncHeld('hand:' + id, a); }
    this.syncPass();
    this.drawProgress();
    this.drawFocus();
    this.updateLabels(dt);
    this.updateTutorial(dt);
    this.steam(dt);
    this.saveT += dt;
    if (this.saveT > 4) { this.saveT = 0; saveGalley(); }
    // the fridge picker closes by itself when you walk away from it
    if (fridgeOpen()) {
      const c = stationCentre(STATION_BY_ID.fridge);
      if (Math.hypot(this.host.player.x - c.x * TILE, this.host.player.y - 6 - c.y * TILE) > 34) closeFridgePicker();
    }
    const held = g.held(PLAYER)[0];
    const to = held && (held.kind === 'dish' || held.kind === 'drink') ? targetFor(held) : null;
    const list = tickets();
    allocateStaged(list, stagedPieces(g));
    showTickets(list, true, held ? `Llevás: ${itemLabel(held)}${held.kind === 'dish' || held.kind === 'drink' ? (to ? ' → ' + to.label : ' · nadie lo pidió todavía') : ''}` : null);
  }

  // ------------------------------------------------------------------ station contents
  private tex(item: GItem, carried = false): string {
    const key = 'gi_' + itemKey(item) + (carried ? '_held' : '');
    if (!this.host.scene.textures.exists(key)) this.host.scene.textures.addCanvas(key, galleyItemCanvas(item, carried));
    return key;
  }

  private syncStations() {
    const g = galley();
    for (const s of STATIONS) {
      const st = g.station(s.id);
      const kind = g.kind(s.id);
      const show = kind === 'cooker' ? [] : st.items;
      const sig = show.map((i) => `${i.uid}:${itemKey(i)}`).join(',') + (st.pending ? '!' : '');
      const prev = this.stationSprites.get(s.id);
      if (prev && prev.key === sig) continue;
      prev?.sprites.forEach((x) => x.destroy());
      const slots = slotsFor(s, show.length);
      const scene = this.host.scene;
      const sprites = show.map((item, i) => {
        const p = slots[Math.min(i, slots.length - 1)];
        const img = scene.add.image(Math.round(p.x), Math.round(p.y), this.tex(item)).setOrigin(0.5, 1).setScale(p.scale).setDepth((s.y + 1) * TILE + 0.5 + i * 0.01);
        if (!prev || !prev.sprites.length || prev.key.indexOf(String(item.uid)) < 0) this.arrive(img, p.scale);
        return img;
      });
      this.stationSprites.set(s.id, { key: sig, sprites });
    }
  }

  private syncPass() {
    const pass = STATION_BY_ID.pass;
    const plates = trayOrders().filter((o) => o.plate).slice(0, 3);
    const sig = plates.map((o) => `${o.uid}:${o.plate!.quality}`).join(',');
    if (sig === this.passKey) return;
    this.passKey = sig;
    this.passSprites.forEach((s) => s.destroy());
    this.passSprites = plates.map((o, i) => {
      const dish: GItem = o.kind === 'drink' ? { kind: 'drink', uid: o.uid, drink: o.recipe, dq: o.plate!.quality } : { kind: 'dish', uid: o.uid, recipe: o.recipe, dq: o.plate!.quality, bonus: 0 };
      const img = this.host.scene.add.image(pass.x * TILE + 8 + i * TILE, slotY(pass) + 2, this.tex(dish)).setOrigin(0.5, 1).setScale(0.72).setDepth((pass.y + 1) * TILE + 0.5);
      this.pop(img, 0.72);
      return img;
    });
  }

  /** Small text over things that need explaining: who a plate is for, what the assembly table is waiting for. */
  private text(key: string, text: string, color: string, x: number, y: number) {
    let t = this.labelTexts.get(key);
    if (!t?.active) {
      t = this.host.scene.add.text(x, y, text, { fontFamily: 'Pixelify Sans, sans-serif', fontSize: '20px', color, stroke: '#2a2230', strokeThickness: 4, resolution: 2, align: 'center' }).setOrigin(0.5, 1).setScale(0.3).setDepth(90650);
      this.labelTexts.set(key, t);
    }
    if (t.text !== text) t.setText(text);
    t.setColor(color).setPosition(Math.round(x), Math.round(y));
    return t;
  }

  private updateLabels(dt: number) {
    const g = galley();
    const p = this.host.player;
    const held = g.held(PLAYER)[0];
    const live = new Set<string>();
    if (held && (held.kind === 'dish' || held.kind === 'drink')) {
      const to = targetFor(held);
      this.text('held', to ? `→ ${to.label}` : 'Nadie lo pidió', to ? '#ffe08a' : '#c9bfae', p.x, p.y - 22).setDepth(p.y + 1);
      live.add('held');
    }
    this.labelT -= dt;
    if (this.labelT <= 0) {
      this.labelT = 0.4;
      for (const s of STATIONS) {
        const st = g.station(s.id);
        const c = stationCentre(s);
        for (const i of st.items) {
          if (i.kind !== 'dish' && i.kind !== 'drink') continue;
          const to = targetFor(i);
          this.text(`${s.id}:${i.uid}`, to ? `Para ${to.table}` : 'Sin pedido', to ? '#ffe08a' : '#c9bfae', c.x * TILE, s.y * TILE - 4);
          live.add(`${s.id}:${i.uid}`);
        }
        if (g.kind(s.id) === 'assembly' && !st.work) {
          const near = closestRecipe(st.items.filter((i): i is IngItem => i.kind === 'ing'), (id) => game.save.recipesKnown.includes(id));
          if (near) {
            const miss = near.missing.map((n) => itemLabel({ kind: 'ing', uid: 0, ing: n.ing, form: n.form, q: 2 }).toLowerCase()).join(', ');
            this.text('asm', near.ready ? `Listo: ${near.recipe.name}. ¡Armalo!` : `${near.recipe.name}: falta ${miss}`, near.ready ? '#bfe3a0' : '#f6ecd6', c.x * TILE, s.y * TILE - 4);
            live.add('asm');
          }
        }
      }
    } else for (const k of this.labelTexts.keys()) if (k !== 'held') live.add(k);
    for (const [k, t] of this.labelTexts) if (!live.has(k)) { t.destroy(); this.labelTexts.delete(k); }
    if (!held || !(held.kind === 'dish' || held.kind === 'drink')) { const t = this.labelTexts.get('held'); if (t) { t.destroy(); this.labelTexts.delete('held'); } }
  }

  /** The first lesson: two dishes, one step at a time. It starts once Spicy has introduced the kitchen. */
  private updateTutorial(dt: number) {
    this.tutT -= dt;
    if (this.tutT > 0) return;
    this.tutT = 0.5;
    if (game.has('galley_tut_done') || !game.has('tut_spicy')) { showTutorial(null, () => {}); return; }
    if (!game.has('galley_tut')) {
      // somebody who already served before this lesson existed does not need it
      if (game.save.restaurant.served > 0) { game.setFlag('galley_tut_done'); return; }
      for (const [id, n] of Object.entries(TUTORIAL_STOCK)) { const have = game.countUsable(id); if (have < n) game.addItem(id, n - have, 'tutorial'); }
      for (const recipe of TUTORIAL_DISHES) if (!game.save.orders.some((o) => o.special === 'tutorial' && o.recipe === recipe)) game.addOrder({ recipe, customer: 'rigg', reward: 20, special: 'tutorial' });
      game.setFlag('galley_tut', 1);
    }
    const from = Number(game.flag('galley_tut')) - 1;
    const i = tutorialStep(from, { g: galley(), served: this.served });
    if (i !== from) game.setFlag('galley_tut', i + 1);
    const skip = () => { game.setFlag('galley_tut_done'); showTutorial(null, () => {}); };
    if (i >= TUTORIAL.length) {
      if (!this.tutDoneAt) this.tutDoneAt = performance.now();
      showTutorial({ dish: '', n: i, of: TUTORIAL.length, text: '¡Ya sabés cocinar dos platos! Seguí los pedidos del salón: los tickets te dicen qué falta. Después vamos a sumar más recetas.', done: true }, skip);
      if (performance.now() - this.tutDoneAt > 9000) skip();
      return;
    }
    showTutorial({ dish: TUTORIAL[i].dish, n: i + 1, of: TUTORIAL.length, text: TUTORIAL[i].text }, skip);
  }

  /** Where the lesson's arrow points right now (the standing tile of the next station), in pixels, or null. */
  guideGoal(): { x: number; y: number } | null {
    if (!this.active || !game.has('galley_tut') || game.has('galley_tut_done')) return null;
    const i = Number(game.flag('galley_tut')) - 1;
    const id = tutorialStation(i, { g: galley(), served: this.served });
    const s = id && STATION_BY_ID[id];
    if (!s) return null;
    return { x: s.stand[0][0] * TILE + TILE / 2, y: s.stand[0][1] * TILE + TILE / 2 };
  }

  /** True while carrying a finished dish or drink: then the only things to do are with the plate. */
  holdingPlate(): boolean {
    if (!this.active) return false;
    const h = galley().held(PLAYER)[0];
    return !!h && (h.kind === 'dish' || h.kind === 'drink');
  }

  /** The service bell on the pass: there once the upgrade is bought. */
  private syncBell() {
    const own = hasBell();
    if (!own) { this.bellImg?.destroy(); this.bellImg = null; return; }
    if (this.bellImg?.active) return;
    const scene = this.host.scene;
    if (!scene.textures.exists('gl_bell')) {
      const c = document.createElement('canvas'); c.width = 10; c.height = 10;
      const g = c.getContext('2d')!;
      g.fillStyle = '#2b1d17'; g.fillRect(1, 3, 8, 6); g.fillRect(4, 1, 2, 2); g.fillRect(0, 8, 10, 2);
      g.fillStyle = '#f2c66d'; g.fillRect(2, 4, 6, 4); g.fillStyle = '#fff2b0'; g.fillRect(3, 4, 1, 3);
      scene.textures.addCanvas('gl_bell', c);
    }
    const pass = STATION_BY_ID.pass;
    this.bellImg = scene.add.image((pass.x + pass.w) * TILE - 7, slotY(pass) + 4, 'gl_bell').setOrigin(0.5, 1).setDepth((pass.y + 1) * TILE + 0.6);
  }

  private ring() {
    const img = this.bellImg;
    if (!img || lowFx()) return;
    this.host.scene.tweens.add({ targets: img, angle: { from: -18, to: 18 }, duration: 70, yoyo: true, repeat: 4, onComplete: () => img.setAngle(0) });
  }

  /** A piece set down glides from the player's hands to its slot (a short pop where it came from nowhere, or on low effects). */
  private arrive(img: Phaser.GameObjects.Image, scale: number) {
    const from = this.actFrom && this.clock - this.actFrom.t < 0.35 ? this.host.player : null;
    if (!from || lowFx()) { this.pop(img, scale); return; }
    const x = img.x, y = img.y;
    img.setPosition(Math.round(from.x), Math.round(from.y - 8)).setScale(scale * 1.15);
    this.host.scene.tweens.add({ targets: img, x, y, scale, duration: 150, ease: 'Sine.out' });
  }

  private pop(img: Phaser.GameObjects.Image, scale: number) {
    if (lowFx()) return;
    img.setScale(scale * 0.4);
    this.host.scene.tweens.add({ targets: img, scale, duration: 180, ease: 'Back.out' });
  }

  // ------------------------------------------------------------------ the hands
  private syncHeld(who: string, p: Actor) {
    const held = galley().held(who);
    const sig = held.map((i) => `${i.uid}:${itemKey(i)}`).join(',');
    let draw = this.heldDraw.get(who);
    if (!draw) { draw = { key: '', sprites: [] }; this.heldDraw.set(who, draw); }
    if (sig !== draw.key) {
      const fresh = sig.length > draw.key.length;
      draw.key = sig;
      draw.sprites.forEach((s) => s.destroy());
      draw.sprites = held.map((item) => {
        const img = this.host.scene.add.image(0, 0, this.tex(item, true)).setOrigin(0.5, 1).setScale(0.75);
        if (fresh && !lowFx()) {
          img.setScale(0.5); this.host.scene.tweens.add({ targets: img, scale: 0.75, duration: 200, ease: 'Back.out' });
          // it comes up from the slot it was taken from
          const from = who === PLAYER && this.actFrom && this.clock - this.actFrom.t < 0.35 ? this.actFrom : null;
          if (from) img.setData('lift', { dx: from.x - p.x, dy: from.y - (p.y - 8), t: this.clock });
        }
        return img;
      });
    }
    const dir: Dir = p.dir;
    const bob = p.moving ? Math.abs(Math.sin(this.clock * 10)) * 1.2 : 0;
    draw.sprites.forEach((img, i) => {
      const behind = dir === 'up';
      const side = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
      let ox = 0, oy = 0;
      const lift = img.getData('lift') as { dx: number; dy: number; t: number } | undefined;
      if (lift) { const k = (this.clock - lift.t) / 0.16; if (k >= 1) img.setData('lift', undefined); else { const e = 1 - k * k; ox = lift.dx * e; oy = lift.dy * e; } }
      img.setPosition(Math.round(p.x + side + ox + (i ? 6 : 0) * (dir === 'left' ? -1 : 1)), Math.round(p.y - 8 - bob - i * 2 + oy));
      img.setDepth(p.y + (behind ? -0.4 : 0.6));
    });
  }

  // ------------------------------------------------------------------ kitchen hands (Spicy)
  private wantedCuts(): Need[] {
    const sum = new Map<string, number>();
    for (const t of tickets()) for (const l of t.lines) for (const n of l.needs) if (n.form === 'cut' && l.waiting > 0) sum.set(n.ing, (sum.get(n.ing) ?? 0) + n.count * l.waiting);
    return [...sum.entries()].map(([ing, count]) => ({ ing, form: 'cut' as const, count }));
  }

  /** Spicy walks (with the town's own movement) to a station, uses it, and goes on to the next thing. */
  private updateHands(dt: number) {
    const g = galley();
    const ups = game.save.restaurant.upgrades;
    const defs = handsFor(ups);
    const crew = this.host.crew;
    for (const id of [...this.workers.keys()]) {
      if (defs.some((d) => d.crew === id)) continue;
      crew.move(id, null); this.workers.delete(id);
    }
    for (const def of defs) {
      let w = this.workers.get(def.crew);
      if (!w) { w = { def, step: null, moving: false, wait: 1, timer: 0, after: null, lost: 0 }; this.workers.set(def.crew, w); }
      const pos = crew.ready(def.crew) ? crew.where(def.crew) : null;
      if (!pos || pos.zone !== 'restaurant') {
        if (w.step || w.moving) { w.step = null; w.moving = false; w.timer = 0; w.after = null; crew.move(def.crew, null); }
        continue;
      }
      if (clock.paused) continue;
      if (w.timer > 0) {
        w.timer -= dt;
        if (w.timer <= 0) { w.after?.(); w.after = null; w.wait = def.pace; }
        continue;
      }
      if (w.wait > 0) { w.wait -= dt; continue; }
      const who = 'hand:' + def.crew;
      if (!w.step) {
        w.step = def.next(g, who, { stock: (id) => game.countUsable(id), ups, wanted: this.wantedCuts() });
        if (!w.step) { w.wait = 0.8; continue; }
        w.moving = false;
      }
      const s = STATION_BY_ID[w.step.station];
      const stand = s.stand.reduce((best, c) => (Math.hypot(c[0] - pos.x, c[1] - pos.y) < Math.hypot(best[0] - pos.x, best[1] - pos.y) ? c : best));
      if (!w.moving) { crew.move(def.crew, { x: stand[0], y: stand[1] }); w.moving = true; w.lost = 0; continue; }
      if (Math.hypot(pos.x - stand[0], pos.y - stand[1]) > 0.7 || !pos.settled) {
        w.lost += dt;
        if (w.lost > 40) { w.step = null; w.moving = false; w.wait = 2; } // stuck: start over
        continue;
      }
      w.moving = false;
      const step = w.step;
      w.step = null;
      const res = step.verb === 'fetch' ? g.takeFromFridge(who, step.arg ?? '') : g.perform(who, step.station, step.verb);
      if (!res.ok) { w.wait = 1.5; continue; }
      saveGalley();
      if (res.needsCut) {
        const item = g.station(step.station).items[0] as IngItem | undefined;
        w.timer = CUT_SECONDS;
        w.after = () => {
          if (!item) return;
          const verdict: CutVerdict = Math.random() < 0.3 ? 'perfect' : 'good';
          this.slash(STATION_BY_ID[step.station], verdict, item);
          this.onEvents(g.finishCut(step.station, verdict).events);
          saveGalley();
        };
      } else w.wait = def.pace;
    }
  }

  // ------------------------------------------------------------------ which station you can use
  /**
   * The station under your feet gets four corner ticks and a small arrow: a down arrow when something can be done there, a
   * cross with dashed ticks when nothing can (so it never relies on colour alone). While carrying something, the stations
   * that would take it show a soft down chevron.
   */
  private drawFocus() {
    const gfx = this.gfx;
    if (!gfx || this.host.galleyBusy || fridgeOpen() || cutting()) return;
    const g = galley();
    const p = this.host.player;
    const held = g.held(PLAYER)[0];
    const plate = this.holdingPlate();
    const usable = (id: string) => g.verbs(PLAYER, id).filter((v) => !plate || v === 'put' || v === 'deliver' || v === 'trash');
    const bob = lowFx() ? 0 : Math.round(Math.sin(this.clock * 5));
    const INKC = 0x2b1d17, CREAM = 0xfff4d6, MUTED = 0xd9c7ad;
    const here = STATIONS.find((s) => s.stand.some(([sx, sy]) => sx === p.tx && sy === p.ty));
    if (held) {
      for (const s of STATIONS) {
        if (s === here) continue;
        const ok = usable(s.id).some((v) => v === 'put' || v === 'deliver' || v === 'trash' || v === 'return' || (v === 'chop' && !g.station(s.id).items.length));
        if (!ok) continue;
        const cx = s.x * TILE + (s.w * TILE) / 2, y = s.y * TILE - 3;
        gfx.fillStyle(INKC).fillTriangle(cx - 5, y - 2, cx + 5, y - 2, cx, y + 5);
        gfx.fillStyle(CREAM).fillTriangle(cx - 3, y, cx + 3, y, cx, y + 3);
      }
    }
    if (!here) return;
    const verbs = usable(here.id);
    const ok = verbs.length > 0;
    const x0 = here.x * TILE - 1, y0 = here.y * TILE - 1, x1 = (here.x + here.w) * TILE, y1 = (here.y + here.h) * TILE;
    const col = ok ? CREAM : MUTED;
    // corner ticks (solid when usable; broken with a gap when not), each with a dark edge underneath
    const tick = (x: number, y: number, dx: number, dy: number) => {
      const len = ok ? 4 : 2;
      for (const [c, o] of [[INKC, 1], [col, 0]] as const) {
        gfx.fillStyle(c).fillRect(Math.min(x, x + dx * len) - o, y - o, len + 1 + o * 2, 1 + o * 2);
        gfx.fillStyle(c).fillRect(x - o, Math.min(y, y + dy * len) - o, 1 + o * 2, len + 1 + o * 2);
      }
    };
    tick(x0, y0, 1, 1); tick(x1, y0, -1, 1); tick(x0, y1, 1, -1); tick(x1, y1, -1, -1);
    const cx = (x0 + x1) / 2, ay = y0 - 4 + (ok ? bob : 0);
    if (ok) {
      gfx.fillStyle(INKC).fillTriangle(cx - 4, ay - 1, cx + 5, ay - 1, cx + 0.5, ay + 5);
      gfx.fillStyle(CREAM).fillTriangle(cx - 3, ay, cx + 4, ay, cx + 0.5, ay + 3.5);
    } else {
      // a small cross on a dark chip
      gfx.fillStyle(INKC).fillRect(cx - 4, ay - 1, 9, 7);
      for (let i = 0; i < 5; i++) { gfx.fillStyle(MUTED).fillRect(cx - 2 + i, ay + i, 1, 1); gfx.fillRect(cx + 2 - i, ay + i, 1, 1); }
    }
  }

  // ------------------------------------------------------------------ progress, steam, labels
  private drawProgress() {
    const g = galley();
    const gfx = this.gfx;
    if (!gfx) return;
    gfx.clear();
    for (const s of STATIONS) {
      const st = g.station(s.id);
      const cx = s.x * TILE + (s.w * TILE) / 2;
      const top = s.y * TILE - 9;
      const prog = g.progress(s.id);
      const cooker = g.kind(s.id) === 'cooker';
      const cfgC = s.cooker ? COOK[s.cooker] : null;
      if (cooker && cfgC && st.items.length && st.phase !== 'idle') {
        // one bar for the whole life of the batch: green while it cooks and while it is perfect, yellow when it starts to go
        // past (white smoke), red when it is about to burn (black smoke, the machine shakes)
        const total = cfgC.time + cfgC.burn;
        const pos = st.phase === 'cooking' ? st.t : cfgC.time + st.t;
        const color = st.phase === 'cooking' || st.t < cfgC.over1 ? 0x8fb36a : st.t < cfgC.over2 ? 0xf2c66d : 0xd9524a;
        gfx.fillStyle(0x3f2e22).fillRect(cx - 10, top, 20, 4);
        gfx.fillStyle(0xfff8ec).fillRect(cx - 9, top + 1, 18, 2);
        gfx.fillStyle(color).fillRect(cx - 9, top + 1, Math.max(1, Math.round(18 * Math.min(1, pos / total))), 2);
        gfx.fillStyle(0x3f2e22).fillRect(cx - 9 + Math.round(18 * cfgC.time / total), top, 1, 4); // where it is ready
      } else if (prog !== null) {
        gfx.fillStyle(0x3f2e22).fillRect(cx - 8, top, 16, 4);
        gfx.fillStyle(0xfff8ec).fillRect(cx - 7, top + 1, 14, 2);
        gfx.fillStyle(st.work ? 0xd7a46a : 0x8fb36a).fillRect(cx - 7, top + 1, Math.max(1, Math.round(14 * prog)), 2);
      }
      if (cooker && st.items.length) {
        // portions as dots under the bar
        for (let i = 0; i < st.items.length; i++) gfx.fillStyle(st.phase === 'done' ? 0xfbf7ee : 0xd9c7a3).fillRect(cx - st.items.length * 2 + i * 4, top + 6, 3, 3);
      }
      const cfg = s.cooker ? COOK[s.cooker] : null;
      const label = this.labels.get(s.id);
      if (cooker && st.phase === 'done' && cfg) {
        const late = st.t > cfg.over2 ? 2 : st.t > cfg.over1 ? 1 : 0;
        const text = late === 2 ? '¡Se quema!' : late === 1 ? '¡Retirá!' : '¡Listo!';
        const color = late === 2 ? '#e0766a' : late === 1 ? '#f2c66d' : '#bfe3a0';
        let t = label;
        if (!t?.active) {
          t = this.host.scene.add.text(cx, top - 3, text, { fontFamily: 'Pixelify Sans, sans-serif', fontSize: '20px', color, stroke: '#2a2230', strokeThickness: 4, resolution: 2 }).setOrigin(0.5, 1).setScale(0.3).setDepth(90600);
          this.labels.set(s.id, t);
        }
        t.setText(text).setColor(color).setY(top - 3 + Math.round(Math.sin(this.clock * 6) * 1));
      } else if (label) { label.destroy(); this.labels.delete(s.id); }
    }
  }

  /** 0 cooking or perfect, 1 going past (white smoke), 2 about to burn (black smoke, shaking) */
  private stage(id: string): 0 | 1 | 2 {
    const s = STATION_BY_ID[id];
    const st = galley().station(id);
    if (!s.cooker || st.phase !== 'done' || !st.items.length) return 0;
    const cfg = COOK[s.cooker];
    return st.t >= cfg.over2 ? 2 : st.t >= cfg.over1 ? 1 : 0;
  }

  private steam(dt: number) {
    const g = galley();
    // the machine that is about to burn shakes
    for (const s of STATIONS) {
      const img = this.host.propAt(s.x, s.y);
      if (!img) continue;
      const st = g.station(s.id);
      const hot = g.kind(s.id) === 'cooker' && st.items.length > 0 && this.stage(s.id) === 2 && !settingsReduced();
      const base = this.shaken.get(s.id) ?? img.x;
      if (hot) { this.shaken.set(s.id, base); img.x = base + (Math.sin(this.clock * 70) > 0 ? 1 : -1); }
      else if (this.shaken.has(s.id)) { img.x = base; this.shaken.delete(s.id); }
    }
    if (lowFx()) return;
    this.steamT -= dt;
    if (this.steamT > 0) return;
    this.steamT = 0.22;
    for (const s of STATIONS) {
      const st = g.station(s.id);
      if (g.kind(s.id) !== 'cooker' || !st.items.length || st.phase === 'idle') continue;
      const stage = this.stage(s.id);
      const chance = st.phase === 'cooking' ? 0.45 : stage === 0 ? 0.2 : 1;
      if (Math.random() > chance) continue;
      const black = stage === 2;
      const x = s.x * TILE + 8 + (Math.random() * 6 - 3);
      const y = s.y * TILE - 8;
      const puff = this.host.scene.add.rectangle(x, y, black ? 4 : 3, black ? 4 : 3, black ? 0x2b2830 : 0xf0ead8, black ? 0.85 : 0.75).setDepth(90400);
      this.host.scene.tweens.add({ targets: puff, y: y - (black ? 18 : 12), x: x + (Math.random() * 8 - 4), alpha: 0, scale: black ? 2.2 : 1.6, duration: black ? 1100 : 900, ease: 'Sine.out', onComplete: () => puff.destroy() });
    }
  }

  // ------------------------------------------------------------------ what the stations offer
  private verbName(station: StationDef, verb: GalleyVerb): { label: string; detail: string; icon: ContextAction['icon'] } {
    const g = galley();
    const held = g.held(PLAYER)[0];
    const st = g.station(station.id);
    const top = st.items[st.items.length - 1];
    const kind = g.kind(station.id);
    switch (verb) {
      case 'scoop': return { label: 'Echar arroz', detail: 'Sacar arroz de la despensa y cargarlo directo en la arrocera', icon: 'maki' };
      case 'open': return { label: 'Abrir', detail: 'Abrir la heladera y elegir un ingrediente', icon: 'act' };
      case 'return': return { label: 'Guardar', detail: `Devolver ${held ? itemLabel(held).toLowerCase() : 'lo que llevás'} a la heladera`, icon: 'act' };
      case 'put': return kind === 'cooker'
        ? { label: 'Cargar', detail: `Poner ${held ? itemLabel(held).toLowerCase() : 'ingrediente'} en ${station.name.toLowerCase()}`, icon: 'maki' }
        : { label: 'Dejar', detail: `Dejar ${held ? itemLabel(held).toLowerCase() : 'lo que llevás'} en ${station.name.toLowerCase()}`, icon: 'act' };
      case 'take': { const to = top && (top.kind === 'dish' || top.kind === 'drink') ? targetFor(top) : null; return { label: 'Tomar', detail: `Tomar ${top ? itemLabel(top).toLowerCase() : 'lo de la estación'}${to ? ' (para ' + to.label + ')' : ''}`, icon: 'act' }; }
      case 'chop': return { label: 'Cortar', detail: 'Cortar en la tabla: frená la barra en la zona verde', icon: 'act' };
      case 'assemble': { const m = g.preview(station.id)[0]; return { label: m ? 'Armar' : 'Armar', detail: m ? `Armar ${m.recipe.name}${m.variant ? ' ' + m.variant.name : ''}` : 'Armar el plato', icon: 'maki' }; }
      case 'deliver': return { label: 'Entregar', detail: 'Dejar el plato en el mostrador de entrega', icon: 'serve' };
      case 'bell': return { label: 'Timbre', detail: 'Tocar el timbre: un empleado lleva los platos a las mesas', icon: 'serve' };
      case 'cup': return { label: 'Tomar vaso', detail: 'Agarrar un vaso limpio', icon: 'serve' };
      case 'trash': return { label: 'Tirar', detail: 'Tirar lo que llevás al tacho', icon: 'act' };
      case 'pantry': return { label: 'Despensa', detail: 'Abrir la despensa del restaurante', icon: 'clipboard' };
      default: return { label: 'Acción', detail: 'Usar la estación', icon: 'act' };
    }
  }

  /** The station actions next to the player, as context actions (see world/contextActions.ts). */
  actions(): { action: ContextAction; x: number; y: number; bias: number }[] {
    if (!this.active || this.host.galleyBusy || fridgeOpen() || cutting()) return [];
    const p = this.host.player;
    const g = galley();
    const out: { action: ContextAction; x: number; y: number; bias: number }[] = [];
    for (const s of STATIONS) {
      const c = stationCentre(s);
      const x = c.x * TILE, y = s.y * TILE + 10;
      if (!s.stand.some(([sx, sy]) => sx === p.tx && sy === p.ty)) continue;
      const plate = this.holdingPlate();
      const verbs: GalleyVerb[] = [...g.verbs(PLAYER, s.id)].filter((v) => !plate || v === 'put' || v === 'deliver' || v === 'trash');
      const kind = g.kind(s.id);
      if (kind === 'fridge' && !plate) verbs.push('pantry');
      if (kind === 'pass' && hasBell() && waitingPlates() > 0) verbs.push('bell');
      verbs.forEach((verb, i) => {
        const v = this.verbName(s, verb);
        out.push({ action: { id: `gl:${s.id}:${verb}`, label: v.label, detail: v.detail, icon: v.icon, intent: { type: 'galley', station: s.id, verb } }, x, y, bias: i * 0.001 });
      });
    }
    return out;
  }

  // ------------------------------------------------------------------ doing it
  act(stationId: string, verb: GalleyVerb) {
    if (!this.active || this.host.galleyBusy) return;
    const s = STATION_BY_ID[stationId];
    if (!s) return;
    const p = this.host.player;
    const c = stationCentre(s);
    p.faceTowards(c.x * TILE, (s.y + 0.5) * TILE);
    if (verb === 'bell') {
      const r = ringBell();
      toast(r.msg);
      audio.sfxPlay(r.ok ? 'bell' : 'error');
      if (r.ok) this.ring();
      return;
    }
    if (verb === 'pantry') {
      const action = 'pantry';
      this.host.onInteract({ kind: 'interact', def: { id: 'gl_' + action, x: s.x, y: s.y, label: s.name, action }, label: s.name });
      return;
    }
    if ((verb === 'assemble') && tooTiredToCook()) { toast('Estás muy cansada para cocinar. Dormí o descansá un rato en tu cama.'); audio.sfxPlay('error'); return; }
    const g = galley();
    this.actFrom = { x: c.x * TILE, y: slotY(s) + 1, t: this.clock };
    const res = g.perform(PLAYER, stationId, verb);
    if (!res.ok) { if (res.msg) toast(res.msg); audio.sfxPlay('error'); return; }
    this.onEvents(res.events);
    if (res.needsPick) this.pickFromFridge();
    if (res.needsCut) this.startCut(stationId);
    if (verb === 'assemble') this.workPose(1.4 * (game.save.restaurant.upgrades.includes('bamboo') ? 0.7 : 1));
    saveGalley();
  }

  private pickFromFridge() {
    const g = galley();
    // with a pinned ticket the fridge highlights only what that one needs
    const all = tickets();
    const first = all.find((t) => t.pinned);
    const wanted = new Set((first ? [first] : all).flatMap((t) => t.lines.flatMap((l) => l.needs.map((n) => n.ing))));
    const order = new Map<string, number>(SUPPLY_GROUPS.flatMap((grp, gi) => grp.items.map((id, i) => [id, gi * 20 + i] as const)));
    const ids = new Set<string>([...RECIPES.flatMap((r) => Object.keys(r.ingredients)), ...(g.drinksOn() ? DRINKS.flatMap((d) => Object.keys(d.ingredients)) : []), ...SUPPLY_GROUPS.flatMap((x) => x.items)]);
    const choices: FridgeChoice[] = [...ids].map((id) => ITEMS_BY_ID[id] && { id, name: ITEMS_BY_ID[id].name, icon: ITEMS_BY_ID[id].icon, have: game.countUsable(id), wanted: wanted.has(id) })
      .filter((c): c is FridgeChoice => !!c && c.have > 0)
      .sort((a, b) => Number(b.wanted) - Number(a.wanted) || (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    openFridgePicker(choices, (id) => {
      const res = g.takeFromFridge(PLAYER, id);
      if (!res.ok) { if (res.msg) toast(res.msg); audio.sfxPlay('error'); return; }
      closeFridgePicker();
      audio.sfxPlay('fridge_close');
      this.onEvents(res.events);
      saveGalley();
    }, () => audio.sfxPlay('fridge_close'));
    // the door swings open for a moment
    this.openDoor();
  }

  private openDoor() {
    const s = STATION_BY_ID.fridge;
    const scene = this.host.scene;
    if (!scene.textures.exists('gl_fridge_open')) scene.textures.addCanvas('gl_fridge_open', fridgeOpenCanvas());
    this.fridgeDoor?.destroy();
    const img = scene.add.image(s.x * TILE + 8, (s.y + 1) * TILE, 'gl_fridge_open').setOrigin(0.5, 1).setDepth((s.y + 1) * TILE + 0.4);
    this.fridgeDoor = img;
    if (!lowFx()) { img.setScale(0.5, 1); scene.tweens.add({ targets: img, scaleX: 1, duration: 160, ease: 'Back.out' }); }
    // it stays open while the picker is up, then closes
    const check = () => { if (!fridgeOpen()) { img.destroy(); if (this.fridgeDoor === img) this.fridgeDoor = null; } else scene.time.delayedCall(120, check); };
    scene.time.delayedCall(200, check);
    audio.sfxPlay('fridge_open');
  }

  /** A series of reflex cuts (5 at first, fewer with better knives); the result is their average. */
  private startCut(stationId: string) {
    const g = galley();
    const item = g.station(stationId).items[0] as IngItem | undefined;
    if (!item) return;
    const s = STATION_BY_ID[stationId];
    const ups = game.save.restaurant.upgrades;
    const total = cutsNeeded(ups, settings.cookMode);
    const level = cutLevel(settings.cookMode, clock.period);
    const verdicts: CutVerdict[] = [];
    this.host.galleyBusy = true;
    this.host.player.stop();
    this.host.player.setAct('cook');
    const next = () => {
      const spec = cutSpec({ level, knife: knivesOwned(ups) > 0, knives: knivesOwned(ups) }, Math.random, this.lastZone);
      this.lastZone = spec.start;
      runCutBar(spec, itemLabel(item).toLowerCase(), (verdict) => {
        verdicts.push(verdict);
        this.slash(s, verdict, item);
        if (verdicts.length < total) { this.host.scene.time.delayedCall(240, next); return; }
        const final = combineVerdicts(verdicts);
        const res = g.finishCut(stationId, final);
        this.onEvents(res.events);
        saveGalley();
        this.host.scene.time.delayedCall(420, () => { this.host.galleyBusy = false; this.host.player.setAct('idle'); });
      }, { n: verdicts.length + 1, of: total });
    };
    next();
  }

  /** a short pose at the counter (assembling) that releases the player by itself */
  private workPose(seconds: number) {
    this.host.galleyBusy = true;
    this.host.player.stop();
    this.host.player.setAct('cook');
    this.host.scene.time.delayedCall(seconds * 1000 + 80, () => { this.host.galleyBusy = false; this.host.player.setAct('idle'); });
  }

  // ------------------------------------------------------------------ effects
  private onEvents(events: GalleyEvent[]) {
    const g = galley();
    for (const e of events) {
      switch (e.t) {
        case 'take': audio.sfxPlay('grab'); break;
        case 'put': audio.sfxPlay('drop'); break;
        case 'refund': audio.sfxPlay('drop'); toast('Guardaste el ingrediente en la heladera.'); break;
        case 'cookStart': {
          const s = STATION_BY_ID[e.station];
          audio.sfxPlay('cook_start');
          if (s.cooker === 'stove') audio.sfxPlay('sizzle');
          this.say(s, s.kind === 'mixer' ? 'Licuando' : s.cooker === 'rice' ? 'A cocinar' : 'Cocinando', '#f6ecd6');
          break;
        }
        case 'ready': { const s = STATION_BY_ID[e.station]; audio.sfxPlay('ready'); this.sparkle(s.x * TILE + 8, s.y * TILE - 4, 5); break; }
        case 'over': audio.sfxPlay('error'); this.say(STATION_BY_ID[e.station], 'Se pasa…', '#f2c66d'); break;
        case 'burnt': audio.sfxPlay('burnt'); this.say(STATION_BY_ID[e.station], 'Se quemó', '#e0766a'); toast('Se quemó lo que estaba en la cocción.'); break;
        case 'mixed': { const s = STATION_BY_ID[e.station]; audio.sfxPlay('ready'); this.sparkle(s.x * TILE + 8, s.y * TILE - 2, 4); this.say(s, 'Lista', '#f6ecd6'); break; }
        case 'assembling': audio.sfxPlay('assemble'); break;
        case 'assembled': {
          const s = STATION_BY_ID[e.station];
          audio.sfxPlay('success');
          this.sparkle(s.x * TILE + s.w * 8, slotY(s) - 4, e.dish.dq === 2 ? 10 : 5);
          this.say(s, ['Aceptable', 'Muy bueno', '¡Perfecto!'][e.dish.dq], e.dish.dq === 2 ? '#ffe08a' : '#f6ecd6');
          break;
        }
        case 'trash': audio.sfxPlay('trash'); break;
        case 'delivered': this.slide(e.dish); break;
        case 'cut': break;
        case 'fridge': break;
      }
    }
    void g;
  }

  private say(s: StationDef, text: string, color: string) {
    const c = stationCentre(s);
    this.host.floatAt(c.x * TILE, s.y * TILE - 6, text, color);
  }

  private sparkle(x: number, y: number, n: number) {
    if (lowFx()) return;
    for (let i = 0; i < n; i++) {
      const bit = this.host.scene.add.rectangle(x, y, 2, 2, PIXEL_BITS[i % PIXEL_BITS.length].replace('#', '0x') as unknown as number).setDepth(90700);
      bit.setFillStyle(Phaser.Display.Color.HexStringToColor(PIXEL_BITS[i % PIXEL_BITS.length]).color);
      const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 8;
      this.host.scene.tweens.add({ targets: bit, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 4, alpha: 0, duration: 420 + Math.random() * 200, ease: 'Sine.out', onComplete: () => bit.destroy() });
    }
  }

  /** The knife, the board shaking a little, bits flying off and, when it is perfect, a flash. */
  private slash(s: StationDef, verdict: CutVerdict, item: IngItem) {
    const scene = this.host.scene;
    audio.sfxPlay(verdict === 'perfect' ? 'chop_perfect' : verdict === 'fail' ? 'chop_miss' : 'chop');
    const cx = s.x * TILE + 8, top = s.y * TILE + 1;
    if (!lowFx()) {
      if (!scene.textures.exists('gl_knife')) {
        const c = document.createElement('canvas'); c.width = 8; c.height = 12;
        const g = c.getContext('2d')!;
        g.fillStyle = '#2b1d17'; g.fillRect(2, 0, 4, 9); g.fillRect(3, 8, 2, 4);
        g.fillStyle = '#dfe3ea'; g.fillRect(3, 1, 2, 7); g.fillStyle = '#8b5a3a'; g.fillRect(3, 9, 2, 3);
        scene.textures.addCanvas('gl_knife', c);
      }
      this.knife?.destroy();
      const knife = scene.add.image(cx + 4, top - 8, 'gl_knife').setOrigin(0.5, 1).setDepth(90800).setAngle(-25);
      this.knife = knife;
      scene.tweens.add({ targets: knife, y: top + 1, angle: 8, duration: 90, ease: 'Quad.in', yoyo: true, hold: 40, onComplete: () => { knife.destroy(); if (this.knife === knife) this.knife = null; } });
      // the board shakes
      const board = this.stationSprites.get(s.id)?.sprites[0];
      if (board) scene.tweens.add({ targets: board, x: board.x + 1, duration: 40, yoyo: true, repeat: 3 });
      // bits of the ingredient
      const color = verdict === 'fail' ? 0x8a7a60 : Phaser.Display.Color.HexStringToColor(ITEMS_BY_ID[item.ing]?.icon.c1 ?? '#d9c7a3').color;
      for (let i = 0; i < (verdict === 'perfect' ? 9 : 5); i++) {
        const bit = scene.add.rectangle(cx, top, 2, 2, color).setDepth(90700);
        const a = -Math.PI * (0.15 + Math.random() * 0.7);
        const d = 8 + Math.random() * 10;
        scene.tweens.add({ targets: bit, x: cx + Math.cos(a) * d, y: top + Math.sin(a) * d + 6, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => bit.destroy() });
      }
      if (verdict === 'perfect') {
        const ring = scene.add.circle(cx, top, 3, 0xfff2b0, 0).setStrokeStyle(1, 0xfff2b0).setDepth(90700);
        scene.tweens.add({ targets: ring, radius: 14, alpha: 0, duration: 380, ease: 'Sine.out', onComplete: () => ring.destroy() });
        this.sparkle(cx, top - 2, 8);
      }
    }
    this.say(s, verdict === 'perfect' ? '¡Perfecto!' : verdict === 'good' ? '¡Bien!' : verdict === 'regular' ? 'Regular' : 'Uy…', verdict === 'perfect' ? '#ffe08a' : verdict === 'fail' ? '#e0766a' : '#f6ecd6');
  }

  /** The finished dish slides from the hands to the pass. */
  private slide(dish: GItem) {
    const pass = STATION_BY_ID.pass;
    const scene = this.host.scene;
    audio.sfxPlay('plate_slide');
    if (lowFx()) return;
    const p = this.host.player;
    const img = scene.add.image(p.x, p.y - 10, this.tex(dish)).setOrigin(0.5, 1).setScale(0.75).setDepth(90800);
    scene.tweens.add({ targets: img, x: pass.x * TILE + 8 + Math.min(2, trayOrders().length) * TILE, y: slotY(pass) + 2, scale: 0.72, duration: 260, ease: 'Sine.inOut', onComplete: () => img.destroy() });
    this.sparkle(pass.x * TILE + 24, slotY(pass) - 2, 4);
  }
}
