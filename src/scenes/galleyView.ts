/**
 * The physical kitchen in the world: draws what the model holds (things in the hands, on the counters, in the cookers, plates
 * on the pass), animates it (fridge door, steam, knife, sparks, a plate sliding to the pass), turns the stations next to the
 * player into context actions and runs what they do. All the rules are in galley/model.ts.
 */
import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import type { Dir } from '../core/types';
import { lowFx } from '../core/perf';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES } from '../data/recipes';
import { Actor, TILE } from '../entities/Actor';
import { handsFor, type HandDef, type Step } from '../galley/crew';
import { candidates } from '../restaurant/staff';
import type { Grid } from '../world/grid';
import { lookTexture } from './textures';
import { cutLevel, cutSpec, type CutVerdict } from '../galley/cut';
import { galley, galleyOn, saveGalley } from '../galley';
import { fridgeOpenCanvas, galleyItemCanvas, itemKey, PIXEL_BITS } from '../galley/art';
import { STATIONS, STATION_BY_ID, stationCentre, type StationDef } from '../galley/layout';
import { COOK, PLAYER, itemLabel, type GalleyEvent, type Verb } from '../galley/model';
import type { GItem, IngItem } from '../galley/prep';
import { tickets } from '../galley/tickets';
import { SUPPLY_GROUPS } from '../restaurant/supplies';
import { trayOrders } from '../restaurant/service';
import { clock } from '../systems/time';
import { tooTiredToCook } from '../systems/fatigue';
import type { ContextAction, Target } from '../world/contextActions';
import { toast } from '../ui/dom';
import { closeFridgePicker, cutting, fridgeOpen, openFridgePicker, removeGalleyUi, runCutBar, showTickets, type FridgeChoice } from '../ui/galleyUi';

/** What the view needs from the world scene (kept as an interface so this file does not import it). */
export interface GalleyHost {
  scene: Phaser.Scene;
  player: Actor;
  zoneId: string;
  grid(): Grid;
  /** the player cannot walk or use anything while this is true (the reflex bar, a short assembly) */
  galleyBusy: boolean;
  floatAt(x: number, y: number, text: string, color?: string): void;
  onInteract: (t: Target) => void;
}

export type GalleyVerb = Verb | 'pantry' | 'drinks';

const slotY = (s: StationDef) => s.y * TILE + 2;

/** where the things lying on a station are drawn, in pixels (feet of the sprite) */
function slotsFor(s: StationDef, n: number): { x: number; y: number; scale: number }[] {
  const x0 = s.x * TILE;
  if (s.kind === 'assembly') return Array.from({ length: n }, (_, i) => ({ x: x0 + 7 + (i % 3) * 9 + (i >= 3 ? 0 : 0), y: slotY(s) + 1 - (i >= 3 ? 3 : 0), scale: 0.5 }));
  if (s.kind === 'board') return [{ x: x0 + 8, y: slotY(s) + 2, scale: 0.72 }];
  if (s.id === 'hangiri') return Array.from({ length: n }, (_, i) => ({ x: x0 + 3 + (i % 3) * 5, y: slotY(s) + 1 - (i >= 3 ? 3 : 0), scale: 0.42 }));
  return Array.from({ length: n }, (_, i) => ({ x: x0 + 4 + i * 8, y: slotY(s) + 1, scale: 0.5 }));
}

interface Worker { def: HandDef; actor: Actor; step: Step | null; arrived: boolean; wait: number; doing: string }

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
  private saveT = 0;
  private fridgeDoor: Phaser.GameObjects.Image | null = null;
  private knife: Phaser.GameObjects.Image | null = null;
  private lastZone: number | undefined;
  private clock = 0;

  constructor(private host: GalleyHost) {}

  // ------------------------------------------------------------------ lifecycle
  get on() { return this.active; }

  attach() {
    if (this.active) return;
    this.active = true;
    this.gfx = this.host.scene.add.graphics().setDepth(90500);
    galley();
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
    for (const w of this.workers.values()) w.actor.destroy();
    this.workers.clear();
    this.passSprites.forEach((s) => s.destroy()); this.passSprites = []; this.passKey = '';
    for (const t of this.labels.values()) t.destroy();
    this.labels.clear();
    this.fridgeDoor?.destroy(); this.fridgeDoor = null;
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
    this.updateHands(dt);
    this.syncHeld(PLAYER, this.host.player);
    for (const [id, w] of this.workers) this.syncHeld(id, w.actor);
    this.syncPass();
    this.drawProgress();
    this.steam(dt);
    this.saveT += dt;
    if (this.saveT > 4) { this.saveT = 0; saveGalley(); }
    // the fridge picker closes by itself when you walk away from it
    if (fridgeOpen()) {
      const c = stationCentre(STATION_BY_ID.fridge);
      if (Math.hypot(this.host.player.x - c.x * TILE, this.host.player.y - 6 - c.y * TILE) > 34) closeFridgePicker();
    }
    const held = g.held(PLAYER)[0];
    showTickets(tickets(), true, held ? `Llevás: ${itemLabel(held)}` : null);
  }

  // ------------------------------------------------------------------ station contents
  private tex(item: GItem): string {
    const key = 'gi_' + itemKey(item);
    if (!this.host.scene.textures.exists(key)) this.host.scene.textures.addCanvas(key, galleyItemCanvas(item));
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
        if (!prev || !prev.sprites.length || prev.key.indexOf(String(item.uid)) < 0) this.pop(img, p.scale);
        return img;
      });
      this.stationSprites.set(s.id, { key: sig, sprites });
    }
  }

  private syncPass() {
    const pass = STATION_BY_ID.pass;
    const plates = trayOrders().filter((o) => o.plate && o.kind !== 'drink').slice(0, 3);
    const sig = plates.map((o) => `${o.uid}:${o.plate!.quality}`).join(',');
    if (sig === this.passKey) return;
    this.passKey = sig;
    this.passSprites.forEach((s) => s.destroy());
    this.passSprites = plates.map((o, i) => {
      const dish: GItem = { kind: 'dish', uid: o.uid, recipe: o.recipe, dq: o.plate!.quality, bonus: 0 };
      const img = this.host.scene.add.image(pass.x * TILE + 8 + i * TILE, slotY(pass) + 2, this.tex(dish)).setOrigin(0.5, 1).setScale(0.72).setDepth((pass.y + 1) * TILE + 0.5);
      this.pop(img, 0.72);
      return img;
    });
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
        const img = this.host.scene.add.image(0, 0, this.tex(item)).setOrigin(0.5, 1).setScale(0.75);
        if (fresh && !lowFx()) { img.setScale(0.3); this.host.scene.tweens.add({ targets: img, scale: 0.75, duration: 200, ease: 'Back.out' }); }
        return img;
      });
    }
    const dir: Dir = p.dir;
    const bob = p.moving ? Math.abs(Math.sin(this.clock * 10)) * 1.2 : 0;
    draw.sprites.forEach((img, i) => {
      const behind = dir === 'up';
      const side = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
      img.setPosition(Math.round(p.x + side + (i ? 6 : 0) * (dir === 'left' ? -1 : 1)), Math.round(p.y - 8 - bob - i * 2));
      img.setDepth(p.y + (behind ? -0.4 : 0.6));
    });
  }

  // ------------------------------------------------------------------ kitchen hands (employees)
  private updateHands(dt: number) {
    const g = galley();
    const defs = handsFor(game.save.restaurant.upgrades);
    for (const [id, w] of this.workers) {
      if (defs.some((d) => d.role === id)) continue;
      w.actor.destroy(); this.workers.delete(id);
    }
    for (const def of defs) {
      let w = this.workers.get(def.role);
      if (!w) {
        const look = candidates('helper', 1)[0].look;
        const [sx, sy] = STATION_BY_ID.fridge.stand[0];
        const actor = new Actor(this.host.scene, 'hand_' + def.role, lookTexture(this.host.scene, look), sx + 1, sy + 1);
        w = { def, actor, step: null, arrived: false, wait: 1, doing: '' };
        this.workers.set(def.role, w);
      }
      if (clock.paused) continue;
      w.actor.update(dt);
      if (w.wait > 0) {
        w.wait -= dt;
        if (w.wait <= 0 && w.actor.act === 'cook') w.actor.setAct('idle');
        continue;
      }
      const who = 'hand:' + def.role;
      if (!w.step) {
        w.step = def.next(g, who, (id) => game.countUsable(id));
        if (!w.step) { w.wait = 0.8; continue; }
        const s = STATION_BY_ID[w.step.station];
        const stand = s.stand.reduce((best, c) => (Math.abs(c[0] - w.actor.tx) + Math.abs(c[1] - w.actor.ty) < Math.abs(best[0] - w.actor.tx) + Math.abs(best[1] - w.actor.ty) ? c : best));
        w.arrived = false;
        const ok = w.actor.walkTo(this.host.grid(), stand[0], stand[1], () => { w!.arrived = true; });
        if (!ok) { w.step = null; w.wait = 1.5; }
        continue;
      }
      if (!w.arrived) continue;
      const step = w.step;
      w.step = null;
      const c = stationCentre(STATION_BY_ID[step.station]);
      w.actor.faceTowards(c.x * TILE, (STATION_BY_ID[step.station].y + 0.5) * TILE);
      const res = step.verb === 'fetch' ? g.takeFromFridge(who, step.arg ?? '') : g.perform(who, step.station, step.verb);
      if (res.ok) {
        w.actor.setAct('cook');
        if (step.verb === 'start') audio.sfxPlay('cook_start');
        saveGalley();
      }
      w.wait = res.ok ? w.def.pace : 1.5;
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
      if (prog !== null) {
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

  private steam(dt: number) {
    if (lowFx()) return;
    this.steamT -= dt;
    if (this.steamT > 0) return;
    this.steamT = 0.3;
    const g = galley();
    for (const s of STATIONS) {
      const st = g.station(s.id);
      if (g.kind(s.id) !== 'cooker' || !st.items.length || st.phase === 'idle') continue;
      const x = s.x * TILE + 8 + (Math.random() * 6 - 3);
      const y = s.y * TILE - 8;
      const puff = this.host.scene.add.rectangle(x, y, 3, 3, st.phase === 'done' && s.cooker === 'rice' ? 0xffffff : 0xf0ead8, 0.75).setDepth(90400);
      this.host.scene.tweens.add({ targets: puff, y: y - 12, x: x + (Math.random() * 6 - 3), alpha: 0, scale: 1.6, duration: 900, ease: 'Sine.out', onComplete: () => puff.destroy() });
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
      case 'open': return { label: 'Abrir', detail: 'Abrir la heladera y elegir un ingrediente', icon: 'act' };
      case 'return': return { label: 'Guardar', detail: `Devolver ${held ? itemLabel(held).toLowerCase() : 'lo que llevás'} a la heladera`, icon: 'act' };
      case 'put': return kind === 'cooker'
        ? { label: 'Cargar', detail: `Poner ${held ? itemLabel(held).toLowerCase() : 'ingrediente'} en ${station.name.toLowerCase()}`, icon: 'maki' }
        : { label: 'Dejar', detail: `Dejar ${held ? itemLabel(held).toLowerCase() : 'lo que llevás'} en ${station.name.toLowerCase()}`, icon: 'act' };
      case 'take': return { label: 'Tomar', detail: `Tomar ${top ? itemLabel(top).toLowerCase() : 'lo de la estación'}`, icon: 'act' };
      case 'start': return { label: station.cooker === 'rice' ? 'Encender' : 'Cocinar', detail: `${station.cooker === 'rice' ? 'Encender la arrocera' : 'Poner a cocinar'} (${st.items.length} ${st.items.length === 1 ? 'porción' : 'porciones'})`, icon: 'maki' };
      case 'chop': return { label: 'Cortar', detail: 'Cortar en la tabla: frená la barra en la zona verde', icon: 'act' };
      case 'assemble': { const m = g.preview(station.id)[0]; return { label: m ? 'Armar' : 'Armar', detail: m ? `Armar ${m.recipe.name}${m.variant ? ' ' + m.variant.name : ''}` : 'Armar el plato', icon: 'maki' }; }
      case 'deliver': return { label: 'Entregar', detail: 'Dejar el plato en el mostrador de entrega', icon: 'serve' };
      case 'trash': return { label: 'Tirar', detail: 'Tirar lo que llevás al tacho', icon: 'act' };
      case 'pantry': return { label: 'Despensa', detail: 'Abrir la despensa del restaurante', icon: 'clipboard' };
      default: return { label: 'Bebidas', detail: 'Preparar bebidas', icon: 'serve' };
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
      const verbs: GalleyVerb[] = [...g.verbs(PLAYER, s.id)];
      const kind = g.kind(s.id);
      if (kind === 'fridge') verbs.push('pantry');
      if (kind === 'drinks') verbs.push('drinks');
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
    if (verb === 'pantry' || verb === 'drinks') {
      const action = verb === 'pantry' ? 'pantry' : 'drinks';
      this.host.onInteract({ kind: 'interact', def: { id: 'gl_' + action, x: s.x, y: s.y, label: s.name, action }, label: s.name });
      return;
    }
    if ((verb === 'assemble') && tooTiredToCook()) { toast('Estás muy cansada para cocinar. Dormí o descansá un rato en tu cama.'); audio.sfxPlay('error'); return; }
    const g = galley();
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
    const wanted = new Set(tickets().flatMap((t) => t.lines.flatMap((l) => l.needs.map((n) => n.ing))));
    const order = new Map<string, number>(SUPPLY_GROUPS.flatMap((grp, gi) => grp.items.map((id, i) => [id, gi * 20 + i] as const)));
    const ids = new Set<string>([...RECIPES.flatMap((r) => Object.keys(r.ingredients)), ...SUPPLY_GROUPS.flatMap((x) => x.items)]);
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

  private startCut(stationId: string) {
    const g = galley();
    const item = g.station(stationId).items[0] as IngItem | undefined;
    if (!item) return;
    const s = STATION_BY_ID[stationId];
    const spec = cutSpec({ level: cutLevel(settings.cookMode, clock.period), knife: game.save.restaurant.upgrades.includes('knife') }, Math.random, this.lastZone);
    this.lastZone = spec.start;
    this.host.galleyBusy = true;
    this.host.player.stop();
    this.host.player.setAct('cook');
    runCutBar(spec, itemLabel(item).toLowerCase(), (verdict) => {
      this.slash(s, verdict, item);
      const res = g.finishCut(stationId, verdict);
      this.onEvents(res.events);
      saveGalley();
      this.host.scene.time.delayedCall(420, () => { this.host.galleyBusy = false; this.host.player.setAct('idle'); });
    });
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
          this.say(s, s.cooker === 'rice' ? 'A cocinar' : 'Cocinando', '#f6ecd6');
          break;
        }
        case 'ready': { const s = STATION_BY_ID[e.station]; audio.sfxPlay('ready'); this.sparkle(s.x * TILE + 8, s.y * TILE - 4, 5); break; }
        case 'over': audio.sfxPlay('error'); this.say(STATION_BY_ID[e.station], 'Se pasa…', '#f2c66d'); break;
        case 'burnt': audio.sfxPlay('burnt'); this.say(STATION_BY_ID[e.station], 'Se quemó', '#e0766a'); toast('Se quemó lo que estaba en la cocción.'); break;
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
    audio.sfxPlay('bell');
    if (lowFx()) return;
    const p = this.host.player;
    const img = scene.add.image(p.x, p.y - 10, this.tex(dish)).setOrigin(0.5, 1).setScale(0.75).setDepth(90800);
    scene.tweens.add({ targets: img, x: pass.x * TILE + 8 + Math.min(2, trayOrders().length) * TILE, y: slotY(pass) + 2, scale: 0.72, duration: 260, ease: 'Sine.inOut', onComplete: () => img.destroy() });
    this.sparkle(pass.x * TILE + 24, slotY(pass) - 2, 4);
  }
}
