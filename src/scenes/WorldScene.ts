/**
 * The explorable world. Renders the current zone, runs player/NPC movement, lighting,
 * ambient effects and interaction detection. Gameplay decisions are delegated to systems/actions.
 */
import Phaser from 'phaser';
import { TILESET_COLS, TILE_INDEX, WATER_FRAMES } from '../art/tiles';
import { audio, type Track } from '../audio/audio';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import type { Dir } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import { ITEMS_BY_ID } from '../data/items';
import { ZONES, type DoorDef, type InteractDef } from '../data/zones';
import { Actor, TILE, type Act } from '../entities/Actor';
import { charactersIn } from '../systems/npcs';
import { clock } from '../systems/time';
import { buildZone, condOk, type BuiltZone, type FurnInstance } from '../world/zoneRuntime';
import { charTexture, critterTexture, dotTexture, furnTexture, iconTexture, lightTexture, lookTexture, propTexture, vignetteTexture, glowTexture } from './textures';
import { gatherSpots, type GatherSpot } from '../systems/gather';
import { SEED_INFO } from '../systems/garden';

export type Target =
  | { kind: 'npc'; id: string; label: string }
  | { kind: 'interact'; def: InteractDef; label: string }
  | { kind: 'door'; def: DoorDef; label: string }
  | { kind: 'gather'; spot: GatherSpot; label: string }
  | { kind: 'bug'; idx: number; label: string };

interface NpcState { actor: Actor; anchor: [number, number]; wander: number; act?: Act; t: number; leaving?: boolean; }
interface Light { x: number; y: number; r: number; flicker: boolean; color?: number; glow?: number; }
interface Bug { sprite: Phaser.GameObjects.Image; item: string; vx: number; vy: number; t: number; }

export let world: WorldScene;

export class WorldScene extends Phaser.Scene {
  zone!: BuiltZone;
  zoneId = '';
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private overMap: Phaser.Tilemaps.Tilemap | null = null;
  private overLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private furnSprites: Phaser.GameObjects.Image[] = [];
  player!: Actor;
  npcs = new Map<string, NpcState>();
  extras = new Map<string, Actor>(); // cutscene-only actors
  joy = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private waterTiles: { x: number; y: number; deep: boolean }[] = [];
  private waterFrame = 0;
  private waterT = 0;
  private lamps: Light[] = [];
  private dark!: Phaser.GameObjects.RenderTexture;
  private lightStamp!: Phaser.GameObjects.Image;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambient: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private gatherSprites: { spot: GatherSpot; img: Phaser.GameObjects.Image }[] = [];
  private bugs: Bug[] = [];
  target: Target | null = null;
  private lastLabel: string | null = '';
  inputLocked = 0; // cutscenes
  onInteract: (t: Target) => void = () => {};
  onEnterZone: (id: string) => void = () => {};
  /** story hook: may unlock a door when the player tries it (returns true if now open) */
  lockHook: (to: string) => boolean = () => false;
  private quirkT = 20;
  private stepT = 0;
  private transitioning = false;
  private pointerDown: { x: number; y: number; t: number } | null = null;
  decorMode = false;

  constructor() {
    super('world');
    world = this;
  }

  create() {
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER') as any;
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') && this.canAct()) this.tryInteract();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDown = { x: p.x, y: p.y, t: p.downTime };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.pointerDown;
      this.pointerDown = null;
      if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 12) return;
      if (this.decorMode) return;
      if (!this.canAct()) return;
      this.tapWorld(p.worldX, p.worldY);
    });
    this.scale.on('resize', () => this.layout());
    this.dark = this.add.renderTexture(0, 0, 8, 8).setOrigin(0, 0).setDepth(200000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lightStamp = this.make.image({ key: lightTexture(this) }, false);
    bus.on('time:changed', () => this.onPeriodChange());
    bus.on('decor:changed', () => this.refreshFurniture());
    bus.on('coins:changed', ({ delta }) => {
      if (delta > 0 && this.sys.isActive()) this.floatText('+' + delta + ' ●');
    });
    bus.on('state:changed', ({ reason }) => {
      if (this.zoneId === 'restaurant' && (reason === 'serve' || reason === 'orders' || reason === 'order')) this.spawnCustomers();
    });
    bus.on('appearance:changed', () => this.refreshLooks());
    bus.on('settings:changed', () => this.setupAmbient());
    this.layout();
  }

  // ------------------------------------------------------------------ layout & camera
  layout() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    const minDim = Math.min(w, h);
    const zoom = Math.max(2, Math.floor(minDim / (TILE * 11)));
    cam.setZoom(zoom);
    if (this.zone) this.applyBounds();
    const vw = Math.ceil(w / zoom) + 4;
    const vh = Math.ceil(h / zoom) + 4;
    this.dark.setSize(vw, vh);
    this.dark.resize?.(vw, vh);
  }

  private applyBounds() {
    const cam = this.cameras.main;
    const mw = this.zone.def.w * TILE;
    const mh = this.zone.def.h * TILE;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const bx = mw < vw ? -(vw - mw) / 2 : 0;
    const by = mh < vh ? -(vh - mh) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mw, vw), Math.max(mh, vh));
  }

  // ------------------------------------------------------------------ zones
  async enterZone(id: string, tx: number, ty: number, dir: Dir = 'down', withFade = true) {
    if (this.transitioning) return;
    this.transitioning = true;
    const { fade } = await import('../ui/dom');
    const bigMove = withFade && this.zoneId && (ZONES[id]?.outdoor || ZONES[this.zoneId]?.outdoor) && !['home', 'storage'].includes(id);
    if (withFade && this.zoneId) await fade(true, bigMove ? 260 : 200, bigMove ? ZONES[id]?.name : undefined);
    if (bigMove) await new Promise((r) => setTimeout(r, 420));
    this.buildZoneObjects(id);
    if (!this.player) {
      this.player = new Actor(this, 'player', charTexture(this, 'player'), tx, ty);
      this.player.speed = 72;
    } else this.player.teleport(tx, ty);
    this.player.face(dir);
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1, 0, 8);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    const p = game.save.player;
    p.zone = id;
    p.x = tx;
    p.y = ty;
    p.dir = dir;
    this.spawnNpcs(false);
    this.playZoneAudio();
    if (withFade) await fade(false, 220);
    this.transitioning = false;
    bus.emit('zone:enter', { zone: id });
    this.onEnterZone(id);
  }

  private clearZone() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    for (const f of this.furnSprites) f.destroy();
    this.furnSprites = [];
    for (const n of this.npcs.values()) n.actor.destroy();
    this.npcs.clear();
    for (const e of this.extras.values()) e.destroy();
    this.extras.clear();
    for (const g of this.gatherSprites) g.img.destroy();
    this.gatherSprites = [];
    for (const b of this.bugs) b.sprite.destroy();
    this.bugs = [];
    for (const c of this.customers) c.destroy();
    this.customers = [];
    for (const c of this.critters) c.s.destroy();
    this.critters = [];
    this.layer?.destroy();
    this.map?.destroy();
    this.overLayer?.destroy();
    this.overMap?.destroy();
    this.layer = null;
    this.map = null;
    this.overLayer = null;
    this.overMap = null;
  }

  buildZoneObjects(id: string) {
    this.clearZone();
    this.zoneId = id;
    const night = clock.isNight() || clock.period === 2;
    this.zone = buildZone(id, night);
    const def = this.zone.def;
    this.map = this.make.tilemap({ data: this.zone.tiles, tileWidth: TILE, tileHeight: TILE });
    const ts = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    void TILESET_COLS;
    this.layer = this.map.createLayer(0, ts, 0, 0)!;
    this.layer.setDepth(-10);
    this.overMap = this.make.tilemap({ data: this.zone.overlay, tileWidth: TILE, tileHeight: TILE });
    const ots = this.overMap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.overLayer = this.overMap.createLayer(0, ots, 0, 0)!;
    this.overLayer.setDepth(-9.5);
    this.waterTiles = [];
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const t = this.zone.tiles[y][x];
        if (t === TILE_INDEX.water0) this.waterTiles.push({ x, y, deep: false });
        else if (t === TILE_INDEX.deep0) this.waterTiles.push({ x, y, deep: true });
      }
    this.lamps = [];
    // props
    for (const p of this.zone.props) {
      const key = propTexture(this, p.key);
      const px = p.x * TILE + (p.def.w * TILE) / 2;
      const py = (p.y + p.def.h) * TILE;
      const img = this.add.image(px, py, key).setOrigin(0.5, 1);
      // wall-mounted props (on wall face rows) render behind actors
      const onWall = def.ground[p.y]?.[p.x] === 'W' || def.ground[p.y]?.[p.x] === 'V';
      // awnings and posters sit on building fronts; puddles lie on the ground
      img.setDepth(onWall ? -5 : p.def.kind === 'awning' || p.def.kind === 'poster' ? py + 18 : p.def.kind === 'puddle' ? -8 : py - (p.def.solid ? 0 : 8));
      if (p.def.anim === 'sway' && !settings.reduceMotion) {
        this.tweens.add({ targets: img, angle: { from: -0.8, to: 0.8 }, duration: 2200 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      if (p.def.light) this.lamps.push({ x: px, y: py - p.def.sh * 0.7, r: p.def.kind === 'lamppost' ? 84 : p.def.kind === 'stall' ? 70 : 62, flicker: p.def.kind !== 'lamppost', color: Phaser.Display.Color.HexStringToColor(p.def.light).color, glow: 0.55 });
      this.objs.push(img);
      if (!onWall) {
        this.addShadow(p.def.kind, px, py, p.def.sw, p.def.w);
        this.castShadow(img, p.def.kind);
      }
      if (p.def.kind === 'building') {
        // warm light spilling from the windows and door onto the street at night
        for (let wx = p.x * TILE + 14; wx < (p.x + p.def.w) * TILE - 10; wx += 20) this.lamps.push({ x: wx, y: py + 6, r: 22, flicker: false, color: 0xffb867, glow: 0.35, spill: true } as Light);
        this.lamps.push({ x: px, y: py - 10, r: 34, flicker: true, color: 0xff9f5a, glow: 0.5 });
      }
      if (p.def.anim === 'water' && !settings.reduceMotion) this.addFountainSpray(px, py - p.def.sh + 6);
    }
    this.placeFurnitureSprites();
    // windows glow at night
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) if (def.ground[y][x] === 'V') this.lamps.push({ x: x * TILE + 8, y: y * TILE + 20, r: 30, flicker: false, color: 0xffd08a, glow: 0.3 });
    if (!def.outdoor) {
      // interiors: warm ambient light spots so night isn't too dark
      for (let y = 3; y < def.h; y += 5) for (let x = 3; x < def.w; x += 6) this.lamps.push({ x: x * TILE, y: y * TILE, r: 56, flicker: false, color: 0xffc27a, glow: 0.12 });
    }
    this.addAtmosphere();
    this.placeGather();
    this.placeCrops();
    this.applyBounds();
    this.setupAmbient();
    this.spawnBugs();
    this.spawnCustomers();
    this.spawnCritters();
  }

  private placeFurnitureSprites() {
    for (const f of this.furnSprites) f.destroy();
    this.furnSprites = [];
    const def = this.zone.def;
    this.lamps = this.lamps.filter((l) => !(l as any).furn);
    for (const inst of this.zone.furniture) this.addFurnSprite(inst);
    void def;
  }

  private addFurnSprite(inst: FurnInstance) {
    const { f, def } = inst;
    const key = furnTexture(this, f.id, f.rot);
    const px = f.x * TILE + (def.w * TILE) / 2;
    const py = (f.y + def.h) * TILE;
    const img = this.add.image(px, py, key).setOrigin(0.5, 1);
    if (def.walkable) img.setDepth(-6);
    else if (def.wall) img.setDepth(-5);
    else {
      img.setDepth(py - 1);
      const sh = this.add.ellipse(px, py - 1, def.w * TILE * 0.85, 5, 0x1a1428, 0.3).setDepth(-7);
      this.furnSprites.push(sh as any);
      const cs = this.castShadow(img, def.kind, false);
      if (cs) this.furnSprites.push(cs);
    }
    (img as any).furnUid = f.uid;
    this.furnSprites.push(img);
    if (def.light) {
      const l: any = { x: px, y: py - def.sh * 0.6, r: 44, flicker: def.kind === 'paperlantern' || def.kind === 'candles', color: Phaser.Display.Color.HexStringToColor(def.light).color, glow: 0.55 };
      l.furn = true;
      this.lamps.push(l);
    }
  }

  refreshFurniture() {
    if (!this.zoneId) return;
    const night = clock.isNight() || clock.period === 2;
    const fresh = buildZone(this.zoneId, night);
    this.zone.grid = fresh.grid;
    this.zone.furniture = fresh.furniture;
    this.zone.tiles = fresh.tiles;
    // floors/walls may have changed (room styles)
    for (let y = 0; y < fresh.def.h; y++) for (let x = 0; x < fresh.def.w; x++) this.layer?.putTileAt(fresh.tiles[y][x], x, y);
    this.placeFurnitureSprites();
    this.spawnCustomers();
  }

  furnSpriteByUid(uid: number) {
    return this.furnSprites.find((s) => (s as any).furnUid === uid);
  }

  refreshLooks() {
    if (!this.player) return;
    this.player.setTexture(charTexture(this, 'player'));
    for (const [id, n] of this.npcs) n.actor.setTexture(charTexture(this, id));
  }

  private addFountainSpray(x: number, y: number) {
    const tex = dotTexture(this, 'drop', '#cfe6ee', 1, 1);
    const em = this.add.particles(x, y, tex, {
      speedY: { min: -26, max: -14 },
      speedX: { min: -8, max: 8 },
      gravityY: 60,
      lifespan: 700,
      frequency: 90,
      quantity: 1,
      alpha: { start: 0.9, end: 0.2 },
    });
    em.setDepth(y + 30);
    this.objs.push(em);
  }

  // ------------------------------------------------------------------ gathering & bugs
  placeGather() {
    for (const g of this.gatherSprites) g.img.destroy();
    this.gatherSprites = [];
    for (const spot of gatherSpots(this.zoneId)) {
      const item = ITEMS_BY_ID[spot.item];
      if (!item) continue;
      const img = this.add.image(spot.x * TILE + 8, spot.y * TILE + 12, iconTexture(this, item.icon)).setOrigin(0.5, 1).setScale(0.75);
      img.setDepth(spot.y * TILE + 4);
      if (!settings.reduceMotion) this.tweens.add({ targets: img, y: img.y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.gatherSprites.push({ spot, img });
    }
  }

  private cropSprites: Phaser.GameObjects.Image[] = [];
  /** draws garden plots: watered soil, growth stages and ready produce */
  placeCrops() {
    for (const s of this.cropSprites) s.destroy();
    this.cropSprites = [];
    if (this.zoneId !== 'garden' || !this.layer) return;
    game.save.garden.forEach((p, i) => {
      const x = 3 + i;
      const y = 4;
      this.layer!.putTileAt(p.seed && p.watered ? TILE_INDEX.soilwet : TILE_INDEX.soil, x, y);
      if (!p.seed) return;
      const info = SEED_INFO[p.seed];
      const ready = p.ready;
      const spec = ready ? ITEMS_BY_ID[info.yield[0][0]].icon : { type: 'sprout', c1: '#7fae5f' };
      const img = this.add.image(x * TILE + 8, y * TILE + 14, iconTexture(this, spec)).setOrigin(0.5, 1).setDepth(y * TILE + 14);
      img.setScale(ready ? 0.9 : 0.5 + 0.4 * Math.min(1, p.plantedDay / info.days));
      this.cropSprites.push(img);
    });
  }

  private critters: { s: Phaser.GameObjects.Sprite; kind: 'bird' | 'cat'; vx: number; vy: number; t: number; flying: boolean }[] = [];
  /** birds hop around by day and fly off when you get close; a cat strolls through the plaza */
  spawnCritters() {
    for (const c of this.critters) c.s.destroy();
    this.critters = [];
    const def = this.zone.def;
    if (!def.outdoor || game.flag('weather') === 'rain' || ['market', 'station'].includes(this.zoneId)) return;
    const night = clock.isNight();
    const add = (kind: 'bird' | 'cat') => {
      for (let k = 0; k < 20; k++) {
        const x = 2 + Math.floor(Math.random() * (def.w - 4));
        const y = 2 + Math.floor(Math.random() * (def.h - 4));
        if (this.zone.grid.isSolid(x, y)) continue;
        const s = this.add.sprite(x * TILE + 8, y * TILE + 12, critterTexture(this, kind), 0).setOrigin(0.5, 1);
        this.critters.push({ s, kind, vx: 0, vy: 0, t: Math.random() * 2, flying: false });
        return;
      }
    };
    if (!night) for (let i = 0; i < (this.zoneId === 'beach' ? 2 : 3); i++) add('bird');
    if (this.zoneId === 'plaza' || this.zoneId === 'garden') add('cat');
  }

  private updateCritters(dt: number) {
    for (const c of this.critters) {
      const s = c.s;
      c.t -= dt;
      const d = Math.hypot(s.x - this.player.x, s.y - this.player.y);
      if (c.kind === 'bird') {
        if (!c.flying && d < 28) {
          c.flying = true;
          c.vx = (s.x > this.player.x ? 1 : -1) * 60;
          c.vy = -50;
          s.setFrame(1);
        }
        if (c.flying) {
          s.x += c.vx * dt;
          s.y += c.vy * dt;
          s.setFrame(Math.floor(performance.now() / 120) % 2);
          if (s.y < -20) s.setVisible(false);
          continue;
        }
        if (c.t <= 0) {
          c.t = 0.6 + Math.random() * 2;
          // hop
          const nx = s.x + (Math.random() * 2 - 1) * 8;
          const ny = s.y + (Math.random() * 2 - 1) * 5;
          if (!this.zone.grid.isSolid(Math.floor(nx / TILE), Math.floor((ny - 1) / TILE))) {
            s.setFlipX(nx < s.x);
            this.tweens.add({ targets: s, x: nx, y: ny, duration: 160, ease: 'Sine.out' });
          }
        }
      } else {
        if (c.t <= 0) {
          c.t = 2 + Math.random() * 4;
          c.vx = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1) * 10;
          c.vy = 0;
        }
        const nx = s.x + c.vx * dt;
        if (c.vx && !this.zone.grid.isSolid(Math.floor(nx / TILE), Math.floor((s.y - 1) / TILE))) {
          s.x = nx;
          s.setFlipX(c.vx < 0);
          s.setFrame(Math.floor(performance.now() / 250) % 2);
        } else c.vx = 0;
      }
      s.setDepth(s.y);
    }
  }

  private customers: Actor[] = [];
  /** generic customers sit at dining chairs, one per pending regular order */
  spawnCustomers() {
    for (const c of this.customers) c.destroy();
    this.customers = [];
    if (this.zoneId !== 'restaurant' || !game.has('intro_done')) return;
    const seats = this.zone.furniture.filter((f) => f.room === 'dining' && f.def.sit && f.def.kind !== 'bench');
    const orders = game.save.orders.filter((o) => !o.special && o.customer.startsWith('c_'));
    const species = ['human', 'cat', 'fox', 'bunny', 'dog', 'bear', 'otter', 'squirrel'] as const;
    const tops = ['top_tee_cream', 'top_tee_sage', 'top_stripes_navy', 'top_sweater_rose', 'top_cardigan_moss', 'top_kimono_indigo', 'top_winter_coat'];
    const hair = ['#2a2230', '#5b3a2e', '#d8a05a', '#b2585e', '#d8d2c8'];
    orders.slice(0, seats.length).forEach((o, i) => {
      const seat = seats[i];
      const h = o.uid * 2654435761;
      const sp = species[h % species.length];
      const look = {
        species: sp, skin: sp === 'human' ? ['#f2cfb3', '#c98e66', '#e3b48e'][h % 3] : ['#d8874f', '#a8734d', '#8d8a93', '#f3e6c8', '#e0c08a'][h % 5],
        hairStyle: sp === 'human' ? h % 6 : 6, hairColor: hair[h % hair.length], eyes: h % 5, eyeColor: '#2a2230',
        top: tops[h % tops.length], bottom: ['bot_jeans', 'bot_pants_brown', 'bot_skirt_plaid'][h % 3], shoes: 'sh_sneakers', head: '', face: '', extra: '', bag: '',
      };
      const a = new Actor(this, o.customer, lookTexture(this, look as any), seat.f.x, seat.f.y);
      a.face(seat.f.rot === 2 ? 'up' : seat.f.rot === 1 ? 'right' : seat.f.rot === 3 ? 'left' : 'down');
      a.y -= 3;
      a.sync();
      a.sprite.setDepth(a.y + 6);
      this.customers.push(a);
    });
  }

  removeGather(spot: GatherSpot) {
    const i = this.gatherSprites.findIndex((g) => g.spot === spot);
    if (i >= 0) {
      const img = this.gatherSprites[i].img;
      this.tweens.add({ targets: img, y: img.y - 10, alpha: 0, duration: 300, onComplete: () => img.destroy() });
      this.gatherSprites.splice(i, 1);
    }
  }

  private spawnBugs() {
    for (const b of this.bugs) b.sprite.destroy();
    this.bugs = [];
    if (!this.zone.def.bugs) return;
    import('../systems/collect').then(({ bugsFor }) => {
      for (const id of bugsFor(this.zoneId)) {
        const it = ITEMS_BY_ID[id];
        let x = 0;
        let y = 0;
        for (let k = 0; k < 30; k++) {
          x = 2 + Math.floor(Math.random() * (this.zone.def.w - 4));
          y = 2 + Math.floor(Math.random() * (this.zone.def.h - 4));
          if (!this.zone.grid.isSolid(x, y)) break;
        }
        const s = this.add.image(x * TILE + 8, y * TILE + 4, iconTexture(this, it.icon)).setScale(0.6).setDepth(y * TILE + 40);
        this.bugs.push({ sprite: s, item: id, vx: 0, vy: 0, t: 0 });
      }
    });
  }

  removeBug(idx: number) {
    const b = this.bugs[idx];
    if (!b) return;
    b.sprite.destroy();
    this.bugs.splice(idx, 1);
  }
  bugItem(idx: number) {
    return this.bugs[idx]?.item;
  }

  // ------------------------------------------------------------------ npcs
  spawnNpcs(animate: boolean) {
    const present = charactersIn(this.zoneId, clock.period);
    const keep = new Set(present.map((p) => p.id));
    for (const [id, n] of this.npcs) {
      if (keep.has(id)) continue;
      if (animate) this.npcLeave(id, n);
      else {
        n.actor.destroy();
        this.npcs.delete(id);
      }
    }
    for (const { id, stop } of present) {
      const existing = this.npcs.get(id);
      if (existing && !existing.leaving) {
        existing.anchor = [stop.x, stop.y];
        existing.wander = stop.wander ?? 0;
        existing.act = stop.act;
        existing.actor.setAct('idle');
        existing.actor.walkTo(this.zone.grid, stop.x, stop.y, () => existing.act && existing.actor.setAct(existing.act));
        continue;
      }
      let sx = stop.x;
      let sy = stop.y;
      if (animate) {
        const door = this.nearestDoor(stop.x, stop.y);
        if (door) [sx, sy] = door;
      }
      if (this.zone.grid.isSolid(sx, sy)) {
        const n = this.zone.grid.nearestWalkable(sx, sy);
        if (n) [sx, sy] = n;
      }
      const actor = new Actor(this, id, charTexture(this, id), sx, sy);
      actor.speed = CHAR_BY_ID[id]?.raccoon ? 46 : 40;
      const st: NpcState = { actor, anchor: [stop.x, stop.y], wander: stop.wander ?? 0, act: stop.act, t: Math.random() * 3 };
      this.npcs.set(id, st);
      if (animate) actor.walkTo(this.zone.grid, stop.x, stop.y, () => st.act && actor.setAct(st.act));
      else if (stop.act) actor.setAct(stop.act);
    }
  }

  private npcLeave(id: string, n: NpcState) {
    n.leaving = true;
    const door = this.nearestDoor(n.actor.tx, n.actor.ty);
    n.actor.setAct('idle');
    const gone = () => {
      n.actor.destroy();
      if (this.npcs.get(id) === n) this.npcs.delete(id);
    };
    if (!door || !n.actor.walkTo(this.zone.grid, door[0], door[1], gone)) gone();
  }

  private nearestDoor(x: number, y: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const d of this.zone.def.doors) {
      if (!d.walk) continue;
      const dist = Math.abs(d.x - x) + Math.abs(d.y - y);
      if (dist < bd) {
        bd = dist;
        best = [d.x, d.y];
      }
    }
    return best;
  }

  npc(id: string): Actor | undefined {
    return this.npcs.get(id)?.actor ?? this.extras.get(id);
  }

  /** cutscene helper: get an actor, spawning a temporary one if needed */
  actor(id: string, tx?: number, ty?: number): Actor {
    if (id === 'player') return this.player;
    let a = this.npc(id);
    if (!a) {
      a = new Actor(this, id, charTexture(this, id), tx ?? 1, ty ?? 1);
      a.speed = 46;
      this.extras.set(id, a);
    } else if (tx != null && ty != null) a.teleport(tx, ty);
    const st = this.npcs.get(id);
    if (st) st.t = 9999; // pause wandering while scripted
    return a;
  }

  walk(id: string, tx: number, ty: number): Promise<void> {
    const a = this.actor(id);
    a.setAct('idle');
    return new Promise((res) => {
      if (!a.walkTo(this.zone.grid, tx, ty, () => res())) {
        a.teleport(tx, ty);
        res();
      }
    });
  }

  releaseActor(id: string) {
    const st = this.npcs.get(id);
    if (st) st.t = 2;
    const e = this.extras.get(id);
    if (e) {
      e.destroy();
      this.extras.delete(id);
    }
  }

  private onPeriodChange() {
    if (!this.zoneId) return;
    // window tiles & light change with period
    const night = clock.isNight() || clock.period === 2;
    const fresh = buildZone(this.zoneId, night);
    for (let y = 0; y < fresh.def.h; y++) for (let x = 0; x < fresh.def.w; x++) if (fresh.def.ground[y][x] === 'V') this.layer?.putTileAt(fresh.tiles[y][x], x, y);
    this.spawnNpcs(true);
    this.playZoneAudio();
    this.setupAmbient();
    this.placeGather();
    this.placeCrops();
    this.spawnBugs();
    this.spawnCritters();
  }

  playZoneAudio() {
    let track = (this.zone.def.music || 'town') as Track;
    if (track === 'restaurant' && clock.period >= 2) track = 'restaurant_night';
    if (game.flag('festival_today') && this.zone.def.outdoor && this.zoneId === 'plaza') track = 'festival';
    audio.play(track);
    const rain = game.flag('weather') === 'rain';
    audio.ambience(rain && this.zone.def.outdoor ? 'rain' : this.zoneId === 'beach' ? 'waves' : clock.isNight() && this.zone.def.outdoor ? 'night' : rain ? 'rain' : 'none');
  }

  // ------------------------------------------------------------------ ambient fx
  setupAmbient() {
    for (const e of this.ambient) e.destroy();
    this.ambient = [];
    this.weather?.destroy();
    this.weather = null;
    if (!this.zone || settings.reduceMotion) return;
    const def = this.zone.def;
    const W = def.w * TILE;
    const H = def.h * TILE;
    const rain = game.flag('weather') === 'rain';
    if (rain && def.outdoor) {
      const tex = dotTexture(this, 'rain', '#bcd4e6', 1, 4);
      this.weather = this.add.particles(0, -10, tex, {
        x: { min: 0, max: W },
        speedY: { min: 170, max: 220 },
        speedX: -20,
        lifespan: (H / 190) * 1000 + 300,
        frequency: 25,
        quantity: 2,
        alpha: 0.55,
      });
      this.weather.setDepth(150000);
      // little splashes and ripples on the ground
      const sp = dotTexture(this, 'splash', '#dce8f5', 2, 1);
      const splash = this.add.particles(0, 0, sp, { x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 260, frequency: 30, quantity: 2, scaleX: { start: 1, end: 3 }, alpha: { start: 0.7, end: 0 } });
      splash.setDepth(-4);
      this.ambient.push(splash);
    }
    if (!def.outdoor) {
      if (this.zoneId === 'restaurant') {
        const steam = dotTexture(this, 'steam', '#f6ecd6', 2, 2);
        const em = this.add.particles(2 * TILE + 8, 2 * TILE - 2, steam, { speedY: { min: -12, max: -6 }, speedX: { min: -3, max: 3 }, lifespan: 1600, frequency: 300, alpha: { start: 0.5, end: 0 }, scale: { start: 1, end: 2 } });
        em.setDepth(3 * TILE + 20);
        this.ambient.push(em);
      }
      return;
    }
    const night = clock.isNight();
    if (night && ['forest', 'garden', 'plaza', 'market'].includes(this.zoneId)) {
      const ff = dotTexture(this, 'firefly', '#f4f0a0', 1, 1);
      const em = this.add.particles(0, 0, ff, {
        x: { min: 0, max: W },
        y: { min: 0, max: H },
        speedX: { min: -6, max: 6 },
        speedY: { min: -6, max: 6 },
        lifespan: 4000,
        frequency: 260,
        alpha: { start: 0, end: 1, ease: 'Sine.easeInOut', yoyo: true } as any,
      });
      em.setDepth(210000);
      this.ambient.push(em);
    }
    if (!rain && ['plaza', 'garden'].includes(this.zoneId) && !night) {
      const pet = dotTexture(this, 'petal', '#f4c6cf', 2, 1);
      const em = this.add.particles(0, -4, pet, { x: { min: 0, max: W }, speedY: { min: 8, max: 16 }, speedX: { min: 4, max: 12 }, lifespan: 14000, frequency: 1300, rotate: { min: 0, max: 360 } });
      em.setDepth(150000);
      this.ambient.push(em);
    }
    if (!rain && this.zoneId === 'forest' && !night) {
      const leaf = dotTexture(this, 'leaf', '#a8bf7c', 2, 2);
      const em = this.add.particles(0, -4, leaf, { x: { min: 0, max: W }, speedY: { min: 6, max: 12 }, speedX: { min: -6, max: 6 }, lifespan: 16000, frequency: 1600 });
      em.setDepth(150000);
      this.ambient.push(em);
    }
  }

  // ------------------------------------------------------------------ input & interaction
  canAct() {
    return !this.transitioning && this.inputLocked === 0 && !clock.paused && !this.decorMode;
  }

  private tapWorld(wx: number, wy: number) {
    // NPC tap
    for (const [id, n] of this.npcs) {
      const a = n.actor;
      if (Math.abs(wx - a.x) < 9 && wy < a.y + 2 && wy > a.y - a.sprite.height) {
        this.approach(a.tx, a.ty, () => this.doInteract({ kind: 'npc', id, label: '' }));
        return;
      }
    }
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= this.zone.def.w || ty >= this.zone.def.h) return;
    const it = this.zone.def.interact.find((i) => i.x === tx && i.y === ty && condOk(i.cond));
    if (it) {
      this.approach(tx, ty, () => this.doInteract({ kind: 'interact', def: it, label: it.label }));
      return;
    }
    const door = this.zone.def.doors.find((d) => d.x === tx && d.y === ty && !d.walk);
    if (door) {
      this.approach(tx, ty, () => this.doInteract({ kind: 'door', def: door, label: door.label ?? '' }));
      return;
    }
    const g = this.gatherSprites.find((s) => s.spot.x === tx && s.spot.y === ty);
    if (g) {
      this.approach(tx, ty, () => this.doInteract({ kind: 'gather', spot: g.spot, label: '' }));
      return;
    }
    if (this.zone.grid.isSolid(tx, ty)) {
      const wd = this.zone.def.doors.find((d) => d.walk && Math.abs(d.x - tx) <= 1 && d.y - ty >= 0 && d.y - ty <= 3);
      if (wd) {
        this.player.stop();
        if (this.player.walkTo(this.zone.grid, wd.x, wd.y)) this.tapMarker(wd.x, wd.y);
        return;
      }
    }
    this.player.stop();
    const ok = this.player.walkTo(this.zone.grid, tx, ty);
    if (ok) this.tapMarker(tx, ty);
  }

  private tapMarker(tx: number, ty: number) {
    const m = this.add.rectangle(tx * TILE + 8, ty * TILE + 8, 10, 10).setStrokeStyle(1, 0xf6ecd6, 0.9).setDepth(-4);
    this.tweens.add({ targets: m, scale: 0.4, alpha: 0, duration: 450, onComplete: () => m.destroy() });
  }

  /** walk next to a tile then run cb */
  private approach(tx: number, ty: number, cb: () => void) {
    const p = this.player;
    if (Math.abs(p.tx - tx) + Math.abs(p.ty - ty) <= 1) {
      p.faceTowards(tx * TILE + 8, ty * TILE + 14);
      cb();
      return;
    }
    const g = this.zone.grid;
    const cands: [number, number][] = [[tx, ty + 1], [tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty]];
    let best: [number, number][] | null = null;
    for (const [cx, cy] of cands) {
      if (g.isSolid(cx, cy)) continue;
      const path = g.path(p.tx, p.ty, cx, cy);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return;
    p.path = best;
    p.onArrive = () => {
      p.faceTowards(tx * TILE + 8, ty * TILE + 14);
      cb();
    };
  }

  tryInteract() {
    if (this.target) this.doInteract(this.target);
  }

  private doInteract(t: Target) {
    if (!this.canAct()) return;
    this.player.stop();
    if (t.kind === 'npc') {
      const a = this.npc(t.id);
      if (a) {
        a.faceTowards(this.player.x, this.player.y);
        this.player.faceTowards(a.x, a.y);
        const st = this.npcs.get(t.id);
        if (st) {
          st.actor.stop();
          st.t = 6;
          if (st.actor.act === 'sleep') st.actor.setAct('idle');
        }
      }
    }
    this.onInteract(t);
  }

  private findTarget(): Target | null {
    const p = this.player;
    let best: Target | null = null;
    let bestScore = Infinity;
    const facing: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [fx, fy] = facing[p.dir];
    const consider = (t: Target, x: number, y: number, maxD: number) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > maxD) return;
      const dot = ((x - p.x) * fx + (y - p.y) * fy) / (d || 1);
      const score = d - dot * 8;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    };
    for (const [id, n] of this.npcs) {
      if (n.leaving) continue;
      const name = CHAR_BY_ID[id]?.name ?? id;
      consider({ kind: 'npc', id, label: 'Hablar con ' + name }, n.actor.x, n.actor.y - 4, 22);
    }
    for (const i of this.zone.def.interact) {
      if (!condOk(i.cond)) continue;
      consider({ kind: 'interact', def: i, label: i.label }, i.x * TILE + 8, i.y * TILE + 10, 20);
    }
    for (const fi of this.zone.furniture) {
      const k = fi.def.kind;
      let action = '';
      let label = '';
      if ((k === 'bed' || k === 'futon') && fi.room === 'room_player') [action, label] = ['bed', 'Dormir'];
      else if (k === 'aquarium') [action, label] = ['aquarium', 'Mirar el acuario'];
      else if (k === 'piano') [action, label] = ['piano', 'Tocar el piano'];
      else if (k === 'radio') [action, label] = ['radio', 'Encender la radio'];
      else if (k === 'telescope') [action, label] = ['telescope', 'Mirar las estrellas'];
      if (!action) continue;
      const def = { id: 'f' + fi.f.uid, x: fi.f.x, y: fi.f.y, label, action };
      consider({ kind: 'interact', def, label }, fi.f.x * TILE + (fi.def.w * TILE) / 2, fi.f.y * TILE + 10, 22);
    }
    for (const d of this.zone.def.doors) if (!d.walk) consider({ kind: 'door', def: d, label: d.label ?? 'Puerta' }, d.x * TILE + 8, d.y * TILE + 10, 20);
    for (const g of this.gatherSprites) consider({ kind: 'gather', spot: g.spot, label: 'Recoger ' + (ITEMS_BY_ID[g.spot.item]?.name ?? '') }, g.spot.x * TILE + 8, g.spot.y * TILE + 10, 18);
    this.bugs.forEach((b, idx) => consider({ kind: 'bug', idx, label: 'Atrapar ' + (ITEMS_BY_ID[b.item]?.name ?? '') }, b.sprite.x, b.sprite.y + 8, 24));
    return best;
  }

  // ------------------------------------------------------------------ main loop
  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    if (!this.player || !this.zone) return;
    if (!this.transitioning) clock.tick(dt);
    this.updatePlayer(dt);
    for (const [, n] of this.npcs) this.updateNpc(n, dt);
    for (const e of this.extras.values()) e.update(dt);
    for (const c of this.customers) c.update(dt);
    this.updateCritters(dt);
    this.updateBugs(dt);
    this.updateWater(dt);
    this.updateLighting();
    this.updateAtmosphere(dt);
    this.dust(dt);
    this.quirks(dt);
    // interaction availability
    const canShow = this.canAct() && !this.player.path.length;
    this.target = canShow ? this.findTarget() : null;
    const label = this.target ? this.target.label : null;
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      bus.emit('interact:available', { label });
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    let vx = 0;
    let vy = 0;
    if (this.canAct()) {
      const k = this.keys;
      if (k.A.isDown || k.LEFT.isDown) vx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown) vy -= 1;
      if (k.S.isDown || k.DOWN.isDown) vy += 1;
      vx += this.joy.x;
      vy += this.joy.y;
    }
    const mag = Math.hypot(vx, vy);
    if (mag > 0.15) {
      p.path = [];
      p.onArrive = null;
      vx /= Math.max(1, mag);
      vy /= Math.max(1, mag);
      const sp = p.speed * dt;
      this.moveWithCollision(vx * sp, 0);
      this.moveWithCollision(0, vy * sp);
      if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 'right' : 'left';
      else p.dir = vy > 0 ? 'down' : 'up';
      p.moving = true;
      p.manual = true;
    } else if (p.manual) {
      p.manual = false;
      p.moving = false;
    }
    const wasTile = `${p.tx},${p.ty}`;
    p.update(dt);
    if (p.moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.32;
        audio.sfxPlay('step');
      }
    }
    if (`${p.tx},${p.ty}` !== wasTile || (p.moving && p.manual)) this.checkWalkDoor();
  }

  private moveWithCollision(dx: number, dy: number) {
    const p = this.player;
    const nx = p.x + dx;
    const ny = p.y + dy;
    const hw = 4;
    const g = this.zone.grid;
    const pts: [number, number][] = [[nx - hw, ny - 5], [nx + hw, ny - 5], [nx - hw, ny - 0.5], [nx + hw, ny - 0.5]];
    for (const [x, y] of pts) if (g.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return;
    p.x = nx;
    p.y = ny;
  }

  private lastDoorMsg = 0;
  private checkWalkDoor() {
    if (this.transitioning || this.inputLocked) return;
    const p = this.player;
    const d = this.zone.def.doors.find((dd) => dd.walk && dd.x === p.tx && dd.y === p.ty);
    if (!d) return;
    if (d.lock && !game.has(d.lock.flag) && !this.lockHook(d.to)) {
      if (performance.now() - this.lastDoorMsg > 2500) {
        this.lastDoorMsg = performance.now();
        bus.emit('toast', { text: d.lock.msg });
      }
      // step back out of the door tile
      const back: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
      const [bx, by] = back[d.dir];
      p.stop();
      p.teleport(p.tx + bx, p.ty + by);
      return;
    }
    audio.sfxPlay('door');
    p.stop();
    this.enterZone(d.to, d.tx, d.ty, d.dir);
  }

  private updateNpc(n: NpcState, dt: number) {
    const a = n.actor;
    a.update(dt);
    if (n.leaving || this.inputLocked) return;
    if (a.path.length) return;
    // villagers turn to look at you when you walk close by
    if ((a.act === 'idle' || a.act === 'work' || a.act === 'play') && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 30) a.faceTowards(this.player.x, this.player.y);
    n.t -= dt;
    if (n.t > 0) return;
    n.t = 4 + Math.random() * 6;
    const [ax, ay] = n.anchor;
    if (n.wander > 0 && Math.random() < 0.7) {
      for (let k = 0; k < 6; k++) {
        const tx = ax + Math.round((Math.random() * 2 - 1) * n.wander);
        const ty = ay + Math.round((Math.random() * 2 - 1) * n.wander);
        if (this.zone.grid.isSolid(tx, ty)) continue;
        if (tx === this.player.tx && ty === this.player.ty) continue;
        a.setAct('idle');
        a.walkTo(this.zone.grid, tx, ty, () => {
          if (n.act && n.act !== 'sleep') a.setAct(n.act);
        });
        break;
      }
    } else if (a.tx !== ax || a.ty !== ay) {
      a.walkTo(this.zone.grid, ax, ay, () => n.act && a.setAct(n.act));
    } else if (n.act && a.act !== n.act) a.setAct(n.act);
  }

  private updateBugs(dt: number) {
    for (const b of this.bugs) {
      b.t -= dt;
      if (b.t <= 0) {
        b.t = 0.6 + Math.random() * 1.2;
        b.vx = (Math.random() * 2 - 1) * 14;
        b.vy = (Math.random() * 2 - 1) * 10;
      }
      const s = b.sprite;
      // flee a little from the player
      const dx = s.x - this.player.x;
      const dy = s.y - this.player.y;
      const d = Math.hypot(dx, dy);
      let fx = 0;
      let fy = 0;
      if (d < 26 && this.player.moving) {
        fx = (dx / d) * 18;
        fy = (dy / d) * 18;
      }
      s.x = Phaser.Math.Clamp(s.x + (b.vx + fx) * dt, 8, this.zone.def.w * TILE - 8);
      s.y = Phaser.Math.Clamp(s.y + (b.vy + fy) * dt, 8, this.zone.def.h * TILE - 8);
      s.setDepth(s.y + 30);
      s.scaleX = 0.6 * (Math.sin(performance.now() / 90) > 0 ? 1 : 0.7);
    }
  }

  private updateWater(dt: number) {
    if (!this.waterTiles.length || !this.layer) return;
    this.waterT += dt;
    if (this.waterT < 0.5) return;
    this.waterT = 0;
    if (settings.reduceMotion) return;
    this.waterFrame = (this.waterFrame + 1) % 3;
    for (const w of this.waterTiles) this.layer.putTileAt(WATER_FRAMES[w.deep ? 1 : 0][this.waterFrame], w.x, w.y);
  }

  /** floating "+N" text above the player (coins, items) */
  floatText(text: string, color = '#f2c66d') {
    if (!this.player) return;
    const t = this.add
      .text(this.player.x, this.player.y - 26, text, { fontFamily: 'Pixelify Sans, sans-serif', fontSize: '24px', color, stroke: '#2a2230', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5, 1)
      .setScale(0.3)
      .setDepth(300000);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: { from: 1, to: 0 }, scale: 0.36, duration: 1100, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  private dustT = 0;
  /** small dust puffs under the feet while walking */
  private dust(dt: number) {
    if (!this.player.moving || settings.reduceMotion) return;
    this.dustT -= dt;
    if (this.dustT > 0) return;
    this.dustT = 0.28;
    const d = this.add.circle(this.player.x + (Math.random() * 4 - 2), this.player.y - 1, 2, 0xe8dcc4, 0.5).setDepth(this.player.y - 1);
    this.tweens.add({ targets: d, scale: 2, alpha: 0, y: d.y - 3, duration: 380, onComplete: () => d.destroy() });
  }

  private sunbeams: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];

  /** contact shadows under walls, sunbeams through windows, drifting cloud shadows */
  private addAtmosphere() {
    const def = this.zone.def;
    this.sunbeams = [];
    this.clouds = [];
    const glow = glowTexture(this);
    for (let y = 0; y < def.h - 1; y++)
      for (let x = 0; x < def.w; x++) {
        const ch = def.ground[y][x];
        const below = def.ground[y + 1][x];
        if ((ch === 'W' || ch === 'V') && (below === 'f' || below === 'k')) {
          const s = this.add.rectangle(x * TILE + 8, (y + 1) * TILE + 2, TILE, 5, 0x1a1428, 0.2).setDepth(-7);
          this.objs.push(s);
        }
        if (ch === 'V' && !def.outdoor) {
          // a slanted patch of daylight on the floor below each window
          const b = this.add.image(x * TILE + 14, (y + 2) * TILE + 4, glow).setScale(0.55, 0.9).setAngle(-18).setTint(0xfff1c8).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6);
          this.sunbeams.push(b);
          this.objs.push(b);
        }
      }
    if (def.outdoor && !settings.reduceMotion && this.zoneId !== 'market') {
      for (let i = 0; i < 3; i++) {
        const c = this.add.image(Math.random() * def.w * TILE, Math.random() * def.h * TILE, glow).setScale(3.5, 2.2).setTint(0x1a1428).setAlpha(0.1).setDepth(150001);
        this.clouds.push(c);
        this.objs.push(c);
      }
    }
  }

  private updateAtmosphere(dt: number) {
    const day = clock.period < 2 && game.flag('weather') !== 'rain';
    for (const b of this.sunbeams) b.setVisible(day);
    const W = this.zone.def.w * TILE;
    for (const c of this.clouds) {
      c.setVisible(day);
      c.x += 6 * dt;
      c.y += 1.5 * dt;
      if (c.x > W + 80) {
        c.x = -80;
        c.y = Math.random() * this.zone.def.h * TILE;
      }
    }
  }

  private glowPool: Phaser.GameObjects.Image[] = [];
  private vignette: Phaser.GameObjects.Image | null = null;

  /**
   * Cast shadow: the sprite's own silhouette, flipped onto the ground, squashed and offset as if lit
   * from the upper left. This is what makes objects read as standing in 3D space.
   */
  private castShadow(img: Phaser.GameObjects.Image, kind: string, track = true): Phaser.GameObjects.Image | null {
    if (['flowers', 'reeds', 'mushroom', 'pier', 'stars', 'puddle', 'awning', 'poster', 'stairs', 'rug'].includes(kind)) return null;
    const tall = ['tree', 'sakura', 'pine', 'lamppost', 'lighthouse', 'torii', 'lanternstring'].includes(kind);
    const s = this.add
      .image(img.x + (tall ? 5 : 3), img.y - 1, img.texture.key)
      .setOrigin(0.5, 0)
      .setFlipY(true)
      .setTintFill(0x140c24)
      .setAlpha(kind === 'building' || kind === 'stall' ? 0.24 : 0.3)
      .setScale(1.04, kind === 'building' || kind === 'stall' ? 0.18 : tall ? 0.4 : 0.28)
      .setDepth(-7);
    if (track) this.objs.push(s);
    return s;
  }

  /** soft contact shadows ground props to the floor */
  private addShadow(kind: string, x: number, y: number, sw: number, w: number) {
    let sh: Phaser.GameObjects.Shape;
    if (kind === 'building') sh = this.add.rectangle(x, y + 2, w * TILE + 6, 6, 0x1a1428, 0.28);
    else if (['tree', 'sakura', 'pine'].includes(kind)) sh = this.add.ellipse(x + 2, y - 1, sw * 0.6, 8, 0x1a1428, 0.35);
    else if (['flowers', 'reeds', 'mushroom', 'pier', 'stars', 'torii'].includes(kind)) return;
    else sh = this.add.ellipse(x, y - 1, Math.max(10, sw * 0.8), 5, 0x1a1428, 0.32);
    sh.setDepth(-7);
    this.objs.push(sh);
  }

  /**
   * Lighting pass: a low-res "darkness" layer tinted per time of day with soft holes cut by lights,
   * an additive warm glow per light (bloom), and a vignette that frames the view.
   */
  private updateLighting() {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const rt = this.dark;
    rt.setPosition(Math.floor(view.x) - 2, Math.floor(view.y) - 2);
    const per = clock.period;
    const prog = clock.progress();
    const def = this.zone.def;
    const rain = game.flag('weather') === 'rain' && def.outdoor;
    // the darkness layer MULTIPLIES the scene: colours stay rich instead of turning grey
    const mix = (a: number, b: number, k: number) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, Math.round(k * 100));
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    };
    let tint = 0xffffff;
    let glow = 0;
    let vig = 0.2;
    if (per === 0) {
      tint = mix(0xffeacc, 0xffffff, prog);
      vig = 0.06;
    } else if (per === 1) {
      tint = mix(0xffffff, 0xfff0d8, prog);
      vig = 0.05;
    } else if (per === 2) {
      tint = def.outdoor ? mix(0xffe2c2, 0xb0a2de, prog) : mix(0xffe8cc, 0xd6c4e4, prog);
      glow = prog > 0.25 ? 0.4 + 0.5 * prog : 0;
      vig = 0.3;
    } else {
      tint = def.outdoor ? 0x4c4e94 : 0x9a86b8;
      glow = 1;
      vig = 0.42;
    }
    if (def.dark || this.zoneId === 'market') {
      tint = 0x4c4e94;
      glow = 1;
      vig = 0.42;
    }
    if (rain && per < 3) {
      tint = mix(tint, 0x8a94b8, 0.6);
      glow = Math.max(glow, 0.45);
      vig = Math.max(vig, 0.32);
    }
    const alpha = tint === 0xffffff ? 0 : 1;
    rt.clear();
    rt.setVisible(true);
    if (alpha) rt.fill(tint, 1);    const t = performance.now() / 1000;
    const visible = this.lamps.filter((l) => l.x > view.x - 70 && l.x < view.right + 70 && l.y > view.y - 70 && l.y < view.bottom + 70);
    const flick = (l: Light) => (l.flicker && !settings.reduceMotion ? 1 + Math.sin(t * 7 + l.x) * 0.05 + Math.sin(t * 13 + l.y) * 0.03 : 1);
    if (glow > 0) {
      for (const l of visible) {
        this.lightStamp.setScale((l.r * 2 * flick(l)) / 64);
        rt.erase(this.lightStamp, l.x - rt.x, l.y - rt.y);
      }
      // tint the lit pools warm (multiply layer: warm colour = warm light on the ground)
      for (const l of visible) {
        this.lightStamp.setScale((l.r * 1.7 * flick(l)) / 64).setTint(l.color ?? 0xffc070).setAlpha(0.55 * glow);
        rt.draw(this.lightStamp, l.x - rt.x, l.y - rt.y);
      }
      this.lightStamp.clearTint().setAlpha(1);
      // the player carries a soft glow so night is never too dark to play
      this.lightStamp.setScale(1.5);
      rt.erase(this.lightStamp, this.player.x - rt.x, this.player.y - 10 - rt.y);
    }
    // vignette frames the screen (drawn into the same low-res layer)
    if (!this.vignette) this.vignette = this.make.image({ key: vignetteTexture(this) }, false);
    this.vignette.setDisplaySize(rt.width, rt.height).setAlpha(vig);
    rt.draw(this.vignette, rt.width / 2, rt.height / 2);
    // additive warm bloom around each light
    let i = 0;
    if (glow > 0) {
      for (const l of visible) {
        let g = this.glowPool[i];
        if (!g) {
          g = this.add.image(0, 0, glowTexture(this)).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001);
          this.glowPool.push(g);
        }
        const f = flick(l);
        g.setVisible(true)
          .setPosition(l.x, l.y)
          .setTint(l.color ?? 0xffc070)
          .setScale(((l as any).spill ? 0.9 : (l.r * 1.7) / 64) * f, ((l as any).spill ? 0.45 : (l.r * 1.7) / 64) * f)
          .setAlpha(Math.min(0.95, (l.glow ?? 0.4) * glow * f * 1.35));
        i++;
      }
    }
    for (; i < this.glowPool.length; i++) this.glowPool[i].setVisible(false);
  }
  private quirks(dt: number) {
    this.quirkT -= dt;
    if (this.quirkT > 0 || this.inputLocked || settings.reduceMotion) return;
    this.quirkT = 25 + Math.random() * 35;
    const raccoons = [...this.npcs.entries()].filter(([id]) => CHAR_BY_ID[id]?.raccoon || Math.random() < 0.3);
    if (!raccoons.length) return;
    const [id, n] = raccoons[Math.floor(Math.random() * raccoons.length)];
    import('../story/quirks').then(({ runQuirk }) => runQuirk(id, n.actor, this));
  }
}
