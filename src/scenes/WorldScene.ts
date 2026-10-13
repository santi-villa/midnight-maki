/**
 * The explorable world. Renders the current zone, runs player/NPC movement, lighting,
 * ambient effects and interaction detection. Gameplay decisions are delegated to systems/actions.
 */
import Phaser from 'phaser';
import { SHORE_FRAMES, TILESET_COLS, TILE_INDEX, waterFrames } from '../art/tiles';
import { WaterFx } from './waterFx';
import { lightState, type LightState } from './lightmath';
import { audio, type Track } from '../audio/audio';
import { bus } from '../core/events';
import { settings } from '../core/settings';
import { game } from '../core/state';
import type { Appearance, Dir } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import { ITEMS_BY_ID } from '../data/items';
import { ZONES } from '../data/zones';
import { Actor, TILE, type Act } from '../entities/Actor';
import { charactersIn, shopGate, stopFor } from '../systems/npcs';
import { arrivalTile, cameFrom, pace, phaseOf, restaurantPhase, shopButtonLabel, shopSignText, signSpots } from '../systems/schedule';
import { seasonOf } from '../core/balance';
import { clock } from '../systems/time';
import { lowFx, sampleFrame } from '../core/perf';
import { nextDoor, questTarget } from '../world/guide';
import { currentQuestTarget } from '../quests/quests';
import { customerAsk } from '../restaurant/orders';
import { collectTipAt, deliverTo, guestViews, pumpService, syncRestaurantHours, takeOrderAt, type GuestView, type PaidMeal } from '../restaurant/service';
import type { FurnPiece, PartyPhase } from '../restaurant/floor';
import { idleOffer, isPlayerRoom, offerKey, resolveContext, type ContextAction, type ContextOffer, type Target } from '../world/contextActions';
import { buildZone, condOk, doorLeadingTo, roomAt, waterDepthAt, waterVariant, type BuiltZone, type FurnInstance } from '../world/zoneRuntime';
import { charTexture, critterTexture, dotTexture, furnTexture, iconTexture, lightTexture, lookTexture, propTexture, vignetteTexture, glowTexture, guideTexture, cloudShadowTexture, questMarkerTexture, windowGlowTexture } from './textures';
import { gatherSpots, type GatherSpot } from '../systems/gather';
import { SEED_INFO } from '../systems/garden';

export type { Target };

interface NpcState { actor: Actor; anchor: [number, number]; wander: number; act?: Act; t: number; leaving?: boolean; wavedAt?: number; last?: [number, number]; }
/** kind: lamp (default, follows lamp level), spill = light from windows / doors, window = interior window light, ambient = soft room fill */
interface Light { x: number; y: number; r: number; flicker: boolean; color?: number; glow?: number; kind?: 'spill' | 'window' | 'ambient'; facade?: boolean }
interface CastShadow { s: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image; tall: boolean; sy: number; a: number; x: number }
interface WindowGlow { img: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image; facade: boolean; door: boolean; phase: number }
interface Bug { sprite: Phaser.GameObjects.Image; item: string; vx: number; vy: number; t: number; }
interface Occluder { sprite: Phaser.GameObjects.Image; baseY: number; bounds: { left: number; right: number; top: number; bottom: number }; }

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
  private occluders: Occluder[] = [];
  player!: Actor;
  npcs = new Map<string, NpcState>();
  private shopSigns: Phaser.GameObjects.Text[] = [];
  private npcKey = '';
  private shopKey = '';
  private lifeTick = 0;
  private floorTick = 0;
  private hoursTick = 0;
  private busOff: Array<() => void> = [];
  private mealBusy = false;
  private mealQueue: PaidMeal[] = [];
  extras = new Map<string, Actor>(); // cutscene-only actors
  joy = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private waterTiles: { x: number; y: number; depth: 's' | 'm' | 'd'; v: number }[] = [];
  private shoreTiles: { x: number; y: number }[] = [];
  private bankTiles: { x: number; y: number; mask: number }[] = [];
  private waterFrame = 0;
  private waterT = 0;
  private waterRain: boolean | null = null;
  private waterFx: WaterFx | null = null;
  private lamps: Light[] = [];
  private ls: LightState | null = null;
  private lightKey = '';
  /** counts how often the darkness layer was actually redrawn (tests check that a still scene is not redrawn every frame) */
  lightRedraws = 0;
  private windowGlows: WindowGlow[] = [];
  private castList: CastShadow[] = [];
  private shadowKey = '';
  private dark!: Phaser.GameObjects.RenderTexture;
  private lightStamp!: Phaser.GameObjects.Image;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambient: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private gatherSprites: { spot: GatherSpot; img: Phaser.GameObjects.Image }[] = [];
  private bugs: Bug[] = [];
  target: Target | null = null;
  contextOffer: ContextOffer = idleOffer(null);
  private contextKey = '';
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
  private questPin!: Phaser.GameObjects.Image;
  private questPinBob = 0;

  constructor() {
    super('world');
    world = this;
  }

  create() {
    this.releaseBus();
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
    this.busOff.push(
      bus.on('time:changed', () => this.onPeriodChange()),
      bus.on('decor:changed', () => this.refreshFurniture()),
      bus.on('coins:changed', ({ delta }) => {
        if (delta > 0 && this.sys.isActive()) this.floatText('+' + delta + ' ●');
      }),
      bus.on('state:changed', () => {
        if (this.zoneId === 'restaurant') this.syncGuests();
      }),
      bus.on('appearance:changed', () => this.refreshLooks()),
      bus.on('settings:changed', () => this.enterLowFx()),
      bus.on('settings:changed', () => this.setupAmbient()),
    );
    this.events.once('shutdown', () => this.releaseBus());
    this.questPin = this.add.image(0, 0, questMarkerTexture(this)).setOrigin(0.5, 1).setDepth(150000).setVisible(false);
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
    this.npcKey = this.npcStamp();
    this.shopKey = this.shopStamp();
    this.refreshShopSigns();
    this.playZoneAudio();
    if (withFade) await fade(false, 220);
    this.transitioning = false;
    bus.emit('zone:enter', { zone: id });
    this.onEnterZone(id);
  }

  private clearZone() {
    this.questPin?.setVisible(false);
    for (const s of this.shopSigns) s.destroy();
    this.shopSigns = [];
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.windowGlows = [];
    this.castList = [];
    this.lightKey = '';
    this.shadowKey = '';
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
    this.clearGuests();
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
    this.shoreTiles = [];
    this.bankTiles = [];
    this.waterRain = null;
    const bankIdx = new Map<number, number>();
    for (let m = 1; m < 16; m++) bankIdx.set(TILE_INDEX['bk' + m], m);
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const ch = def.ground[y][x];
        if (ch === 'w' || ch === 'd') this.waterTiles.push({ x, y, depth: waterDepthAt(def.ground, x, y), v: waterVariant(x, y) });
        else if (ch === 'h') this.shoreTiles.push({ x, y });
        const m = bankIdx.get(this.zone.overlay[y][x]);
        if (m) this.bankTiles.push({ x, y, mask: m });
      }
    this.lamps = [];
    this.occluders = [];
    // props
    for (const p of this.zone.props) {
      const key = propTexture(this, p.key);
      const px = p.x * TILE + (p.def.w * TILE) / 2;
      const py = (p.y + p.def.h) * TILE;
      const img = this.add.image(px, py, key).setOrigin(0.5, 1);
      // wall-mounted props (on wall face rows) render behind actors
      const onWall = def.ground[p.y]?.[p.x] === 'W' || def.ground[p.y]?.[p.x] === 'V';
      // awnings and posters sit on building fronts; puddles lie on the ground
      img.setDepth(onWall ? -5 : p.def.kind === 'puddle' ? -8 : p.def.kind === 'awning' || p.def.kind === 'poster' ? py - 0.1 : py);
      if (!onWall && p.def.kind !== 'puddle' && (p.def.sh > p.def.h * TILE || !p.def.solid)) {
        this.occluders.push({
          sprite: img,
          baseY: py,
          bounds: {
            left: px - p.def.sw / 2,
            right: px + p.def.sw / 2,
            top: py - p.def.sh,
            bottom: py,
          },
        });
      }
      if (p.def.anim === 'sway' && !lowFx() && !settings.reduceMotion) {
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
        const fac = p.def.variant === 0; // the restaurant follows its opening hours
        for (let wx = p.x * TILE + 14; wx < (p.x + p.def.w) * TILE - 10; wx += 20) this.lamps.push({ x: wx, y: py + 6, r: 22, flicker: false, color: 0xffb867, glow: 0.35, kind: 'spill', facade: fac });
        this.lamps.push({ x: px, y: py - 10, r: 34, flicker: true, color: 0xff9f5a, glow: 0.5, kind: 'spill', facade: fac });
        if (fac) {
          // the two red lanterns beside the restaurant door
          const top = py - p.def.sh;
          const left = px - p.def.sw / 2;
          for (const lx of [44, 68]) this.lamps.push({ x: left + lx, y: top + p.def.sh - 24, r: 26, flicker: true, color: 0xff7a3a, glow: 0.6, facade: true });
        }
        this.addWindowGlow(img, p.def.sw, p.def.sh, p.def.variant ?? 0, false, fac);
        if (fac) this.addWindowGlow(img, p.def.sw, p.def.sh, 0, true, true);
      }
      if (p.def.anim === 'water' && !lowFx()) this.addFountainSpray(px, py - p.def.sh + 6);
    }
    this.placeFurnitureSprites();
    // windows glow at night
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) if (def.ground[y][x] === 'V') this.lamps.push({ x: x * TILE + 8, y: y * TILE + 20, r: 30, flicker: false, color: 0xffd08a, glow: 0.3, kind: 'window' });
    if (!def.outdoor) {
      // interiors: warm ambient light spots so night isn't too dark
      for (let y = 3; y < def.h; y += 5) for (let x = 3; x < def.w; x += 6) this.lamps.push({ x: x * TILE, y: y * TILE, r: 56, flicker: false, color: 0xffc27a, glow: 0.12, kind: 'ambient' });
    }
    this.addAtmosphere();
    this.placeGather();
    this.placeCrops();
    this.applyBounds();
    this.setupAmbient();
    this.spawnBugs();
    this.syncGuests();
    this.spawnCritters();
  }

  private placeFurnitureSprites() {
    for (const f of this.furnSprites) f.destroy();
    this.furnSprites = [];
    this.occluders = this.occluders.filter((o) => o.sprite.active);
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
      img.setDepth(py);
      const sh = this.add.ellipse(px, py - 1, def.w * TILE * 0.85, 5, 0x1a1428, 0.3).setDepth(-7);
      this.furnSprites.push(sh as any);
      const cs = this.castShadow(img, def.kind, false);
      if (cs) this.furnSprites.push(cs);
      if (def.sh > def.h * TILE) {
        this.occluders.push({
          sprite: img,
          baseY: py,
          bounds: {
            left: px - (def.w * TILE) / 2,
            right: px + (def.w * TILE) / 2,
            top: py - def.sh,
            bottom: py,
          },
        });
      }
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
    this.syncGuests();
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
      if (!lowFx()) this.tweens.add({ targets: img, y: img.y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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

  private critters: { s: Phaser.GameObjects.Sprite; kind: 'bird' | 'cat' | 'butterfly'; vx: number; vy: number; t: number; flying: boolean; ox?: number; oy?: number }[] = [];
  /** birds hop around by day and fly off when you get close; a cat strolls through the plaza */
  spawnCritters() {
    for (const c of this.critters) c.s.destroy();
    this.critters = [];
    const def = this.zone.def;
    if (!def.outdoor || game.flag('weather') === 'rain' || ['market', 'station'].includes(this.zoneId)) return;
    const night = clock.isNight();
    const add = (kind: 'bird' | 'cat' | 'butterfly') => {
      for (let k = 0; k < 20; k++) {
        const x = 2 + Math.floor(Math.random() * (def.w - 4));
        const y = 2 + Math.floor(Math.random() * (def.h - 4));
        if (this.zone.grid.isSolid(x, y)) continue;
        const s = this.add.sprite(x * TILE + 8, y * TILE + 12, critterTexture(this, kind, Math.floor(Math.random() * 4)), 0).setOrigin(0.5, 1);
        this.critters.push({ s, kind, vx: 0, vy: 0, t: Math.random() * 2, flying: false, ox: s.x, oy: s.y });
        return;
      }
    };
    if (!night) for (let i = 0; i < (this.zoneId === 'beach' ? 2 : 3); i++) add('bird');
    if (this.zoneId === 'plaza' || this.zoneId === 'garden') add('cat');
    if (!night && seasonOf(game.save.time.day) < 2 && ['plaza', 'garden', 'forest'].includes(this.zoneId)) for (let i = 0; i < (this.zoneId === 'garden' ? 5 : 3); i++) add('butterfly');
  }

  private updateCritters(dt: number) {
    for (const c of this.critters) {
      const s = c.s;
      c.t -= dt;
      const d = Math.hypot(s.x - this.player.x, s.y - this.player.y);
      if (c.kind === 'butterfly') {
        // lazy fluttering loops around a home spot, a little above the ground
        const tt = performance.now() / 1000 + (c.ox ?? 0);
        s.x = (c.ox ?? s.x) + Math.sin(tt * 0.7) * 22 + Math.sin(tt * 1.9) * 6;
        s.y = (c.oy ?? s.y) - 10 + Math.cos(tt * 0.9) * 10 + Math.sin(tt * 3.1) * 3;
        s.setFrame(Math.floor(tt * 8) % 2);
        s.setDepth(200000);
        continue;
      }
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

  private releaseBus() {
    for (const off of this.busOff) off();
    this.busOff = [];
  }

  private guests = new Map<string, { actor: Actor; phase: PartyPhase }>();

  private clearGuests() {
    for (const g of this.guests.values()) g.actor.destroy();
    this.guests.clear();
  }

  private diningPieces(): FurnPiece[] {
    if (!this.zone) return [];
    return this.zone.furniture.filter((fi) => fi.room === 'dining').map((fi) => ({
      uid: fi.f.uid,
      id: fi.f.id,
      kind: fi.def.kind,
      x: fi.f.x,
      y: fi.f.y,
      w: fi.def.w,
      h: fi.def.h,
      rot: fi.f.rot,
      sit: fi.def.sit,
    }));
  }

  /** One step of the dining room: arrivals, patience, eating and payment. Sprites follow the phase. */
  private pumpFloor(dt: number) {
    if (this.zoneId !== 'restaurant' || !game.has('intro_done') || !this.zone) return;
    if (this.transitioning || this.inputLocked || this.decorMode || clock.paused || this.mealBusy) return;
    this.floorTick += dt;
    if (this.floorTick < 1) return;
    const step = Math.min(1.25, this.floorTick);
    this.floorTick = 0;
    const { paid, notice } = pumpService(step, this.diningPieces());
    if (notice) this.note(notice);
    this.syncGuests();
    for (const meal of paid) this.enqueueMeal(meal);
  }

  /** Closing still announces outside the restaurant. The door check itself is cheap. */
  private pollHours(dt: number) {
    if (clock.paused || this.transitioning || !game.loaded) return;
    this.hoursTick += dt;
    if (this.hoursTick < 1) return;
    this.hoursTick = 0;
    const present = this.zoneId === 'restaurant' && !!this.zone && !this.decorMode && !this.inputLocked;
    const notice = syncRestaurantHours(present);
    if (notice) this.note(notice);
  }

  private enqueueMeal(meal: PaidMeal) {
    this.mealQueue.push(meal);
    void this.drainMeals();
  }

  private async drainMeals() {
    if (this.mealBusy) return;
    this.mealBusy = true;
    try {
      while (this.mealQueue.length) {
        const meal = this.mealQueue.shift()!;
        const { presentPaidMeal } = await import('../restaurant/kitchen');
        await presentPaidMeal(meal);
      }
    } finally {
      this.mealBusy = false;
    }
  }

  /** Match sprites to the parties already in the room. One actor per chair, not one per order. */
  private syncGuests() {
    if (!this.zone || this.zoneId !== 'restaurant' || !game.has('intro_done')) {
      this.clearGuests();
      return;
    }
    const views = guestViews();
    const live = new Set<string>();
    views.forEach((g, gi) => {
      const n = g.seats.length || g.size;
      for (let i = 0; i < n; i++) {
        const key = `${g.id}:${i}`;
        live.add(key);
        const seat = g.seats[i];
        let body = this.guests.get(key);
        if (!body) {
          body = this.createGuest(g, i, gi, seat);
          this.guests.set(key, body);
          continue;
        }
        if (body.phase === g.phase) continue;
        this.moveGuest(body.actor, g, i, gi, seat);
        body.phase = g.phase;
      }
    });
    for (const [key, body] of this.guests) {
      if (live.has(key)) continue;
      body.actor.destroy();
      this.guests.delete(key);
    }
  }

  private createGuest(g: GuestView, i: number, gi: number, seat?: { x: number; y: number; rot: number }) {
    const sitting = !!seat && (g.phase === 'seated' || g.phase === 'waiting_order' || g.phase === 'waiting_food' || g.phase === 'eating' || g.phase === 'paying');
    const tile = sitting ? [seat!.x, seat!.y] as [number, number] : this.guestTile(g.phase === 'queued' ? 'line' : g.phase === 'reception' ? 'host' : 'door', gi + i);
    const actor = new Actor(this, g.customerId, lookTexture(this, guestLook(g.id, i)), tile[0], tile[1]);
    actor.speed = 40;
    if (sitting && seat) this.poseGuest(actor, seat, g.phase === 'eating' || g.phase === 'paying' ? 'eat' : 'sit');
    else if (g.phase === 'leaving' && seat) {
      this.poseGuest(actor, seat, 'idle');
      const door = this.guestTile('door', i);
      this.walkGuest(actor, door[0], door[1]);
    } else if (g.phase === 'walking' && seat) this.walkGuest(actor, seat.x, seat.y);
    else {
      const goal = g.phase === 'outside' ? this.guestTile('host', gi + i) : this.guestGoal(g, i, gi, seat);
      this.walkGuest(actor, goal[0], goal[1]);
    }
    return { actor, phase: g.phase };
  }

  private moveGuest(actor: Actor, g: GuestView, i: number, gi: number, seat?: { x: number; y: number; rot: number }) {
    if ((g.phase === 'seated' || g.phase === 'waiting_order' || g.phase === 'waiting_food') && seat) {
      this.poseGuest(actor, seat, 'sit');
      if (g.phase === 'waiting_order' && i === 0) {
        const ask = customerAsk(g.customerId, guestHash(g.id));
        if (ask) actor.emote(ask.length > 36 ? ask.slice(0, 34) + '…' : ask, 2.6);
      }
      return;
    }
    if ((g.phase === 'eating' || g.phase === 'paying') && seat) {
      if (actor.tx !== seat.x || actor.ty !== seat.y) this.poseGuest(actor, seat, 'eat');
      else actor.setAct('eat');
      return;
    }
    if (g.phase === 'leaving') {
      actor.setAct('idle');
      const door = this.guestTile('door', i);
      this.walkGuest(actor, door[0], door[1]);
      return;
    }
    if (g.phase === 'walking' && seat) {
      actor.setAct('idle');
      this.walkGuest(actor, seat.x, seat.y);
      return;
    }
    if (g.phase === 'reception' || g.phase === 'queued') {
      actor.setAct('idle');
      const goal = this.guestGoal(g, i, gi, seat);
      this.walkGuest(actor, goal[0], goal[1]);
    }
  }

  private guestGoal(g: GuestView, i: number, gi: number, seat?: { x: number; y: number }): [number, number] {
    if (seat && (g.phase === 'walking' || g.phase === 'leaving')) return g.phase === 'leaving' ? this.guestTile('door', i) : [seat.x, seat.y];
    if (g.phase === 'reception') return this.guestTile('host', gi + i);
    if (g.phase === 'queued') return this.guestTile('line', gi + i);
    return this.guestTile('door', gi + i);
  }

  /** Door, host stand and queue. A blocked tile steps to the nearest free one. */
  private guestTile(kind: 'door' | 'host' | 'line', index: number): [number, number] {
    const spots = kind === 'door' ? [[8, 12], [9, 12]] : kind === 'host' ? [[8, 6], [7, 6], [9, 6], [6, 6]] : [[8, 11], [9, 11], [10, 11], [7, 11], [8, 10], [9, 10]];
    const spot = spots[Math.abs(index) % spots.length];
    const tx = spot[0];
    const ty = spot[1];
    if (!this.zone.grid.isSolid(tx, ty)) return [tx, ty];
    return this.zone.grid.nearestWalkable(tx, ty) ?? [tx, ty];
  }

  private poseGuest(actor: Actor, seat: { x: number; y: number; rot: number }, act: Act) {
    actor.stop();
    actor.teleport(seat.x, seat.y);
    actor.y -= 3;
    actor.face(seat.rot === 2 ? 'up' : seat.rot === 1 ? 'right' : seat.rot === 3 ? 'left' : 'down');
    actor.setAct(act);
    actor.sync();
  }

  private walkGuest(actor: Actor, tx: number, ty: number) {
    if (!actor.walkTo(this.zone.grid, tx, ty)) actor.teleport(tx, ty);
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
      if (keep.has(id) || n.leaving) continue;
      if (animate) this.npcLeave(id, n);
      else {
        n.actor.destroy();
        this.npcs.delete(id);
      }
    }
    for (const { id, stop } of present) {
      const existing = this.npcs.get(id);
      if (existing && !existing.leaving) {
        const same = existing.anchor[0] === stop.x && existing.anchor[1] === stop.y;
        existing.anchor = [stop.x, stop.y];
        existing.wander = stop.wander ?? 0;
        existing.act = stop.act;
        // a cutscene parked this actor; remember the new spot and don't drag them
        if (existing.t > 80) continue;
        if (!same) this.walkNpc(existing, stop.x, stop.y);
        else if (!existing.actor.path.length && stop.act && existing.actor.act !== stop.act) existing.actor.setAct(stop.act);
        continue;
      }
      if (existing?.leaving) continue;
      let sx = stop.x;
      let sy = stop.y;
      if (animate) {
        const who = CHAR_BY_ID[id];
        const from = who ? cameFrom(who, clock.period) : '';
        const arrived = from && from !== this.zoneId ? arrivalTile(this.zoneId, from) : null;
        const gate = arrived ?? this.nearestDoor(stop.x, stop.y);
        if (gate) {
          sx = Array.isArray(gate) ? gate[0] : gate.x;
          sy = Array.isArray(gate) ? gate[1] : gate.y;
        }
      }
      if (this.zone.grid.isSolid(sx, sy)) {
        const n = this.zone.grid.nearestWalkable(sx, sy);
        if (n) [sx, sy] = n;
      }
      const actor = new Actor(this, id, charTexture(this, id), sx, sy);
      actor.speed = (CHAR_BY_ID[id]?.raccoon ? 46 : 40) * pace(id);
      const st: NpcState = { actor, anchor: [stop.x, stop.y], wander: stop.wander ?? 0, act: stop.act, t: 1 + Math.random() * 4 };
      this.npcs.set(id, st);
      if (animate) this.walkNpc(st, stop.x, stop.y);
      else if (stop.act) actor.setAct(stop.act);
    }
  }

  /** Walk on the grid. If the spot can't be reached, stay put instead of popping through a wall. */
  private walkNpc(n: NpcState, tx: number, ty: number) {
    const a = n.actor;
    a.setAct('idle');
    const arrive = () => {
      if (n.act) a.setAct(n.act);
    };
    if (a.walkTo(this.zone.grid, tx, ty, arrive)) return;
    if (n.act) a.setAct(n.act);
  }

  private npcLeave(id: string, n: NpcState) {
    n.leaving = true;
    const dest = stopFor(id, clock.period)?.zone ?? CHAR_BY_ID[id]?.routine[clock.period]?.zone;
    const aimed = dest && dest !== this.zoneId ? doorLeadingTo(this.zoneId, dest) : null;
    const door = aimed ? [aimed.x, aimed.y] as [number, number] : this.nearestDoor(n.actor.tx, n.actor.ty);
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
    this.npcKey = this.npcStamp();
    this.shopKey = this.shopStamp();
    this.refreshShopSigns();
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
    this.waterFx?.destroy();
    this.waterFx = null;
    if (this.zone?.def.outdoor && this.waterTiles.length) this.waterFx = new WaterFx(this, this.zone.def.ground, this.lamps, lowFx());
    this.weather?.destroy();
    this.weather = null;
    if (!this.zone || lowFx()) return;
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
    // smoke curling from the chimneys of homes and cabins
    const smoke = dotTexture(this, 'smoke', '#e8e4ee', 3, 3);
    for (const p of this.zone.props) {
      if (p.def.kind !== 'building' || (p.def.variant !== 2 && p.def.variant !== 3)) continue;
      const bx = p.x * TILE + (p.def.w * TILE) / 2 - p.def.sw / 2;
      const by = (p.y + p.def.h) * TILE - p.def.sh;
      const em = this.add.particles(bx + p.def.sw - 18, by + 2, smoke, { speedY: { min: -10, max: -6 }, speedX: { min: 2, max: 6 }, lifespan: 3200, frequency: 520, alpha: { start: 0.5, end: 0 }, scale: { start: 0.7, end: 2.2 } });
      em.setDepth(160000);
      this.ambient.push(em);
    }
    // big soft cloud shadows drifting by on sunny days
    if (!rain && !night && clock.period < 2 && ['plaza', 'garden', 'forest', 'beach', 'station'].includes(this.zoneId)) {
      const cs = this.add.particles(-120, 0, cloudShadowTexture(this), { y: { min: 0, max: H }, speedX: { min: 7, max: 11 }, lifespan: ((W + 260) / 8) * 1000, frequency: 9000, scale: { min: 2, max: 3.2 }, advance: ((W + 260) / 8) * 1000 } as any);
      cs.setDepth(149000);
      this.ambient.push(cs);
    }
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
    const season = seasonOf(game.save.time.day);
    if (season === 3 && !rain) {
      const flake = dotTexture(this, 'snow', '#ffffff', 2, 2);
      const em = this.add.particles(0, -4, flake, { x: { min: 0, max: W }, speedY: { min: 14, max: 28 }, speedX: { min: -8, max: 8 }, lifespan: (H / 20) * 1000, frequency: 70, alpha: { start: 0.95, end: 0.7 } });
      em.setDepth(150000);
      this.ambient.push(em);
    } else if (season === 2 && !rain && !night) {
      const cols = ['#d98a3a', '#c4602e', '#e0b050'];
      cols.forEach((c, i) => {
        const leaf = dotTexture(this, 'aleaf' + i, c, 3, 3);
        const em = this.add.particles(0, -4, leaf, { x: { min: 0, max: W }, speedY: { min: 10, max: 20 }, speedX: { min: -10, max: 14 }, lifespan: (H / 14) * 1000, frequency: 500, rotate: { min: 0, max: 360 } });
        em.setDepth(150000);
        this.ambient.push(em);
      });
    }
    if (!rain && season < 2 && ['plaza', 'garden'].includes(this.zoneId) && !night) {
      const pet = dotTexture(this, 'petal', '#f4c6cf', 2, 1);
      const em = this.add.particles(0, -4, pet, { x: { min: 0, max: W }, speedY: { min: 8, max: 16 }, speedX: { min: 4, max: 12 }, lifespan: 14000, frequency: 1300, rotate: { min: 0, max: 360 } });
      em.setDepth(150000);
      this.ambient.push(em);
    }
    if (!rain && season < 2 && this.zoneId === 'forest' && !night) {
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
    const primary = this.contextOffer.primary;
    if (primary) this.perform(primary);
  }

  /** Run one contextual action. Keyboard uses the primary; the HUD may pass any of them. */
  perform(action: ContextAction) {
    if (!this.canAct()) return;
    this.player.stop();
    const intent = action.intent;
    if (intent.type === 'target') {
      this.doInteract(intent.target);
      return;
    }
    if (intent.type === 'gift') {
      this.greet(intent.npcId);
      void this.offerGift(intent.npcId);
      return;
    }
    if (intent.type === 'decorate') {
      void import('../decoration/editor').then((m) => m.startDecor());
      return;
    }
    if (intent.type === 'takeOrder') {
      this.note(takeOrderAt(intent.tableId));
      this.syncGuests();
      this.contextKey = '';
      return;
    }
    if (intent.type === 'cookOrder') {
      void import('../restaurant/kitchen').then((m) => m.cookOrder(intent.uid));
      return;
    }
    if (intent.type === 'deliver') {
      this.note(deliverTo(intent.tableId));
      this.syncGuests();
      this.contextKey = '';
      return;
    }
    if (intent.type === 'tip') {
      this.note(collectTipAt(intent.tableId));
      this.contextKey = '';
      return;
    }
    void import('../restaurant/kitchen').then((m) => m.openOrders());
  }

  private note(text: string) {
    void import('../ui/dom').then(({ toast }) => toast(text));
  }

  private async offerGift(id: string) {
    const { pickGift, giveGift } = await import('../dialogue/talk');
    const item = await pickGift();
    if (item) await giveGift(id, item);
  }

  private greet(id: string) {
    const a = this.npc(id);
    if (!a) return;
    a.faceTowards(this.player.x, this.player.y);
    this.player.faceTowards(a.x, a.y);
    const st = this.npcs.get(id);
    if (!st) return;
    st.actor.stop();
    st.t = 6;
    if (st.actor.act === 'sleep') st.actor.setAct('idle');
  }

  private doInteract(t: Target) {
    if (!this.canAct()) return;
    this.player.stop();
    if (t.kind === 'npc') this.greet(t.id);
    this.onInteract(t);
  }

  private sense() {
    const p = this.player;
    return {
      zoneId: this.zoneId,
      px: p.x,
      py: p.y,
      dir: p.dir,
      room: roomAt(this.zone.def, p.tx, p.ty) ?? null,
      npcs: [...this.npcs.entries()].filter(([, n]) => !n.leaving).map(([id, n]) => ({
        id,
        name: CHAR_BY_ID[id]?.name ?? id,
        x: n.actor.x,
        y: n.actor.y - 4,
      })),
      interacts: this.zone.def.interact.filter((i) => condOk(i.cond)).map((i) => {
        if (!i.action.startsWith('shop:')) return i;
        const label = shopButtonLabel(shopGate(i.action.slice(5)), i.label);
        return label === i.label ? i : { ...i, label };
      }),
      doors: this.zone.def.doors,
      gathers: this.gatherSprites.map((g) => ({
        x: g.spot.x * TILE + 8,
        y: g.spot.y * TILE + 10,
        label: 'Recoger ' + (ITEMS_BY_ID[g.spot.item]?.name ?? ''),
        spot: g.spot,
      })),
      bugs: this.bugs.map((b, idx) => ({
        idx,
        x: b.sprite.x,
        y: b.sprite.y + 8,
        label: 'Atrapar ' + (ITEMS_BY_ID[b.item]?.name ?? ''),
      })),
      furniture: this.zone.furniture.map((fi) => ({
        uid: fi.f.uid,
        id: fi.f.id,
        kind: fi.def.kind,
        name: fi.def.name,
        room: fi.room,
        x: fi.f.x,
        y: fi.f.y,
        w: fi.def.w,
        h: fi.def.h,
        sit: fi.def.sit,
      })),
    };
  }

  private refreshContext() {
    const room = this.player && this.zone ? roomAt(this.zone.def, this.player.tx, this.player.ty) ?? null : null;
    const offer = this.player && this.zone && this.canAct() && !this.player.path.length
      ? resolveContext(this.sense())
      : idleOffer(isPlayerRoom(room) ? room!.name : null);
    const key = offerKey(offer);
    if (key === this.contextKey) return;
    this.contextKey = key;
    this.contextOffer = offer;
    const primary = offer.primary;
    this.target = primary && primary.intent.type === 'target' ? primary.intent.target : null;
    bus.emit('interact:available', { label: primary?.label ?? null, kind: primary?.icon });
  }

  // ------------------------------------------------------------------ main loop
  update(_t: number, dms: number) {
    if (sampleFrame(dms)) this.enterLowFx(true);
    const dt = Math.min(0.05, dms / 1000);
    if (!this.player || !this.zone) return;
    if (!this.transitioning) clock.tick(dt);
    this.pollHours(dt);
    this.updatePlayer(dt);
    for (const [, n] of this.npcs) this.updateNpc(n, dt);
    for (const e of this.extras.values()) e.update(dt);
    this.pumpFloor(dt);
    for (const g of this.guests.values()) g.actor.update(dt);
    this.updateCritters(dt);
    this.updateBugs(dt);
    this.updateWater(dt);
    this.waterFx?.update(dt, this.waterEnv());
    this.updateLighting();
    this.updateAtmosphere(dt);
    this.updateOccluders(dt);
    this.updateQuestMarker(dt);
    this.dust(dt);
    this.quirks(dt);
    this.updateGuide(dt);
    this.syncLife(dt);
    this.refreshContext();
  }

  /** Footstep sound for the surface Sofi is walking on. */
  private stepSound(): string {
    if (!this.zone.def.outdoor) return 'step_wood';
    if (this.zoneId === 'beach') return 'step_sand';
    if (['plaza', 'market', 'station'].includes(this.zoneId)) return 'step_stone';
    return 'step_grass';
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
        audio.sfxPlay(this.stepSound());
      }
    }
    if (`${p.tx},${p.ty}` !== wasTile || (p.moving && p.manual)) this.checkWalkDoor();
  }

  private moveWithCollision(dx: number, dy: number) {
    const p = this.player;
    const nx = p.x + dx;
    const ny = p.y + dy;
    const hw = 5;
    const g = this.zone.grid;
    const pts: [number, number][] = [
      [nx - hw, ny - 6],
      [nx, ny - 6],
      [nx + hw, ny - 6],
      [nx - hw, ny - 0.5],
      [nx, ny - 0.5],
      [nx + hw, ny - 0.5],
    ];
    for (const [x, y] of pts) {
      if (g.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return;
    }
    p.x = nx;
    p.y = ny;
  }

  private updateOccluders(dt: number) {
    if (!this.player) return;
    const actors: Actor[] = [this.player];
    for (const [, n] of this.npcs) if (n.actor.sprite.visible) actors.push(n.actor);
    for (const e of this.extras.values()) if (e.sprite.visible) actors.push(e);

    const lerp = Math.min(1, dt * 10);
    for (const occ of this.occluders) {
      if (!occ.sprite.active) continue;
      let occluded = false;
      for (const a of actors) {
        if (a.y < occ.baseY) {
          const aLeft = a.x - 7;
          const aRight = a.x + 7;
          const aTop = a.y - 24;
          const aBottom = a.y - 2;
          if (aRight > occ.bounds.left && aLeft < occ.bounds.right && aBottom > occ.bounds.top && aTop < occ.bounds.bottom) {
            occluded = true;
            break;
          }
        }
      }
      const targetAlpha = occluded ? 0.45 : 1.0;
      occ.sprite.alpha += (targetAlpha - occ.sprite.alpha) * lerp;
    }
  }

  private updateQuestMarker(dt: number) {
    if (!this.player || !this.zone) return;
    const target = currentQuestTarget();
    if (!target) {
      if (this.questPin?.visible) this.questPin.setVisible(false);
      return;
    }

    let tx: number | null = null;
    let ty: number | null = null;

    if (target.kind === 'object') {
      if (target.zone === this.zoneId) {
        tx = target.x * TILE + 8;
        ty = target.y * TILE + 4;
      } else {
        const d = doorLeadingTo(this.zoneId, target.zone);
        if (d) {
          tx = d.x * TILE + 8;
          ty = d.y * TILE + 4;
        }
      }
    } else if (target.kind === 'npc') {
      const stop = stopFor(target.npc, clock.period);
      if (stop && stop.zone === this.zoneId) {
        const actor = this.npcs.get(target.npc)?.actor;
        if (actor && actor.sprite.visible) {
          tx = actor.x;
          ty = actor.y - 24;
        } else {
          tx = stop.x * TILE + 8;
          ty = stop.y * TILE + 4;
        }
      } else if (stop) {
        const d = doorLeadingTo(this.zoneId, stop.zone);
        if (d) {
          tx = d.x * TILE + 8;
          ty = d.y * TILE + 4;
        }
      }
    } else if (target.kind === 'interior') {
      if (this.zoneId === target.fromZone) {
        tx = target.door.x * TILE + 8;
        ty = target.door.y * TILE + 4;
      } else if (this.zoneId === target.targetZone) {
        if (target.interiorTarget) {
          tx = target.interiorTarget.x * TILE + 8;
          ty = target.interiorTarget.y * TILE + 4;
        }
      } else {
        const d = doorLeadingTo(this.zoneId, target.fromZone);
        if (d) {
          tx = d.x * TILE + 8;
          ty = d.y * TILE + 4;
        }
      }
    } else if (target.kind === 'location') {
      if (target.zone === this.zoneId) {
        if (target.x != null && target.y != null) {
          tx = target.x * TILE + 8;
          ty = target.y * TILE + 4;
        }
      } else {
        const d = doorLeadingTo(this.zoneId, target.zone);
        if (d) {
          tx = d.x * TILE + 8;
          ty = d.y * TILE + 4;
        }
      }
    }

    if (tx == null || ty == null) {
      if (this.questPin?.visible) this.questPin.setVisible(false);
      return;
    }

    this.questPinBob += dt * 4;
    this.questPin.setPosition(tx, ty - 12 + Math.sin(this.questPinBob) * 3);
    if (!this.questPin.visible) this.questPin.setVisible(true);
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
    if (d.to.startsWith('shop_') || (this.zoneId.startsWith('shop_') && d.to === 'plaza')) audio.sfxPlay('bell');
    p.stop();
    this.enterZone(d.to, d.tx, d.ty, d.dir);
  }

  private updateNpc(n: NpcState, dt: number) {
    const a = n.actor;
    a.update(dt);
    if (n.leaving || this.inputLocked || n.t > 80) return;
    if (a.path.length) return;
    const held = n.act === 'sleep' || n.act === 'eat' || n.act === 'drink' || n.act === 'read' || n.act === 'sit' || n.act === 'fish' || n.act === 'stars' || n.act === 'paint' || n.act === 'cook';
    // villagers turn to look at you when you walk close by
    const near = Math.hypot(a.x - this.player.x, a.y - this.player.y) < 30;
    if (!held && (a.act === 'idle' || a.act === 'work' || a.act === 'play' || a.act === 'look' || a.act === 'clean') && near) a.faceTowards(this.player.x, this.player.y);
    // a friendly wave the first time you come close (then not again for a while)
    const now = this.time.now;
    if (!held && near && a.act !== 'sleep' && a.act !== 'wave' && a.act !== 'talk' && now - (n.wavedAt ?? -1e9) > 45000 && a.dir === 'down') {
      n.wavedAt = now;
      const back = a.act;
      a.setAct('wave');
      this.time.delayedCall(1300, () => a.act === 'wave' && a.setAct(back));
    }
    n.t -= dt;
    if (n.t > 0) return;
    if (held) {
      if (n.act && a.act !== n.act) a.setAct(n.act);
      n.t = 5 + Math.random() * 4;
      return;
    }
    if (n.act === 'talk') {
      const pal = this.nearestPal(n);
      if (pal) {
        a.faceTowards(pal.actor.x, pal.actor.y);
        pal.actor.faceTowards(a.x, a.y);
        a.setAct('talk');
        if (pal.act !== 'sleep' && pal.act !== 'cook' && pal.act !== 'fish') pal.actor.setAct('talk');
        if (!a.bubble) a.emote('...', 2);
        n.t = 6 + Math.random() * 4;
        pal.t = Math.max(pal.t, 4);
        return;
      }
      a.setAct('look');
      n.t = 3 + Math.random() * 3;
      return;
    }
    n.t = 7 + Math.random() * 8;
    const [ax, ay] = n.anchor;
    if (n.wander > 0 && Math.random() < 0.55) {
      for (let k = 0; k < 6; k++) {
        const tx = ax + Math.round((Math.random() * 2 - 1) * n.wander);
        const ty = ay + Math.round((Math.random() * 2 - 1) * n.wander);
        if (n.last && tx === n.last[0] && ty === n.last[1]) continue;
        if (this.zone.grid.isSolid(tx, ty)) continue;
        if (tx === this.player.tx && ty === this.player.ty) continue;
        if (tx === a.tx && ty === a.ty) continue;
        n.last = [a.tx, a.ty];
        a.setAct('idle');
        if (a.walkTo(this.zone.grid, tx, ty, () => n.act && n.act !== 'sleep' && a.setAct(n.act))) return;
      }
    } else if (a.tx !== ax || a.ty !== ay) {
      this.walkNpc(n, ax, ay);
    } else if (n.act && a.act !== n.act) a.setAct(n.act);
    else if (Math.random() < 0.4) a.face((['up', 'down', 'left', 'right'] as const)[Math.floor(Math.random() * 4)]);
  }

  /** Someone close enough to talk to, and not in the middle of a job. Checked only when a timer expires. */
  private nearestPal(n: NpcState): NpcState | null {
    let best: NpcState | null = null;
    let bd = 48;
    for (const o of this.npcs.values()) {
      if (o === n || o.leaving || o.t > 80) continue;
      if (o.actor.path.length || o.act === 'sleep' || o.act === 'cook' || o.act === 'fish' || o.act === 'eat' || o.act === 'drink' || o.act === 'read' || o.act === 'stars') continue;
      const d = Math.hypot(o.actor.x - n.actor.x, o.actor.y - n.actor.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private npcStamp() {
    return `${clock.period}:${phaseOf(game.save.time.minutes)}:${game.flag('weather') ?? ''}:${game.flag('festival_today') ?? ''}`;
  }

  private shopStamp() {
    return ['taro', 'yuki', 'bento', 'sumi', 'nami', 'shells'].map((id) => shopGate(id).phase).join('');
  }

  /** Phase changes a few times per period. Off screen, nothing here runs. */
  private syncLife(dt: number) {
    if (this.transitioning || this.inputLocked || this.decorMode) return;
    this.lifeTick -= dt;
    if (this.lifeTick > 0) return;
    this.lifeTick = 1.25;
    const npc = this.npcStamp();
    const shops = this.shopStamp();
    const npcChanged = npc !== this.npcKey;
    if (npcChanged) {
      this.npcKey = npc;
      this.spawnNpcs(true);
    }
    if (shops !== this.shopKey || npcChanged) {
      this.shopKey = shops;
      this.refreshShopSigns();
    }
  }

  private refreshShopSigns() {
    for (const s of this.shopSigns) s.destroy();
    this.shopSigns = [];
    if (!this.zone) return;
    for (const spot of signSpots(this.zoneId)) {
      const status = shopGate(spot.shopId);
      const text = shopSignText(status);
      if (!text) continue;
      const x = spot.x * TILE + TILE / 2;
      const y = spot.y * TILE + TILE - 2;
      const color = status.phase === 'open' ? '#2f6b3a' : status.phase === 'closed' ? '#8a3030' : '#8a5a20';
      const sign = this.add.text(x, y, text, {
        fontFamily: 'Pixelify Sans, sans-serif',
        fontSize: '16px',
        color,
        backgroundColor: '#f6ecd6',
        align: 'center',
        padding: { x: 3, y: 1 },
        resolution: 2,
      }).setOrigin(0.5, 1).setDepth(y + 2);
      this.shopSigns.push(sign);
    }
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

  /** Writes the current animation frame into every water, shoreline and bank tile (only a few hundred putTileAt calls). */
  private applyWater(frame: number, rain: boolean) {
    const L = this.layer;
    if (!L) return;
    for (const w of this.waterTiles) L.putTileAt(waterFrames(w.depth, w.v, rain)[(frame + w.v) % 4], w.x, w.y);
    for (const t of this.shoreTiles) L.putTileAt(SHORE_FRAMES[(frame + t.x) % 4], t.x, t.y);
    const O = this.overLayer;
    if (O) for (const b of this.bankTiles) O.putTileAt(TILE_INDEX[((frame >> 1) + b.x + b.y) % 2 ? 'bkb' + b.mask : 'bk' + b.mask], b.x, b.y);
  }

  /** Water animation: 4 frames at ~2 fps. Battery / reduced-motion mode keeps one still frame (but still follows the rain). */
  private updateWater(dt: number) {
    if (!this.layer || !(this.waterTiles.length || this.shoreTiles.length)) return;
    const rain = this.zone.def.outdoor && game.flag('weather') === 'rain';
    if (lowFx()) {
      if (this.waterRain !== rain) {
        this.waterRain = rain;
        this.applyWater(0, rain);
      }
      return;
    }
    this.waterT += dt;
    if (this.waterT < 0.45 && this.waterRain === rain) return;
    this.waterT = 0;
    this.waterRain = rain;
    this.waterFrame = (this.waterFrame + 1) % 4;
    this.applyWater(this.waterFrame, rain);
  }

  /** How strongly the moon / lanterns should show on the water right now (0 by day, rising at dusk). */
  private waterEnv() {
    const ls = this.ls;
    return { moon: ls?.moon ?? 0, lamp: ls?.lamp ?? 0, rain: game.flag('weather') === 'rain', view: this.cameras.main.worldView };
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
    if (!this.player.moving || lowFx()) return;
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
    if (def.outdoor && !lowFx() && this.zoneId !== 'market') {
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
    this.castList.push({ s, src: img, tall, sy: s.scaleY, a: s.alpha, x: s.x - img.x });
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

  /** A warm overlay of lit windows (and the restaurant doorway) on top of a building sprite. Shown by updateWindowGlow. */
  private addWindowGlow(src: Phaser.GameObjects.Image, W: number, H: number, rot: number, door: boolean, facade: boolean) {
    const img = this.add.image(src.x, src.y, windowGlowTexture(this, W, H, rot, door)).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001).setVisible(false).setAlpha(0);
    this.objs.push(img);
    this.windowGlows.push({ img, src, facade, door, phase: Math.random() * 6 });
  }

  /** Window light level of a facade (0..1): the restaurant follows its hours, everything else follows the evening. */
  private facadeLevel(facade: boolean, door: boolean): number {
    const ls = this.ls;
    if (!ls) return 0;
    if (!facade) return ls.windows;
    const t = game.save.time;
    const ph = restaurantPhase(t.period, t.minutes);
    const f = ph === 'open' ? 1 : ph === 'closing' ? 0.7 : ph === 'setup' ? 0.45 : 0.12;
    // while it is open the restaurant is lit even in the afternoon, so the doorway is easy to find
    const base = Math.max(ls.windows, ph === 'open' ? (door ? 0.32 : 0.3) : 0);
    return base * f * (door && ph !== 'open' ? 0.4 : 1);
  }

  private updateWindowGlow(time: number) {
    const lo = lowFx();
    for (const w of this.windowGlows) {
      if (!w.img.active) continue;
      const lvl = this.facadeLevel(w.facade, w.door);
      // very slow breathing so lit windows feel alive (none in battery / reduced-motion mode)
      const breath = lo ? 1 : 1 + 0.04 * Math.sin(time * 0.9 + w.phase);
      const a = Math.min(0.85, lvl * 0.7 * breath) * w.src.alpha;
      w.img.setVisible(a > 0.02).setAlpha(a).setPosition(w.src.x, w.src.y);
    }
  }

  /** Cast shadows follow the sun: they lean right in the morning, left in the afternoon, stretch at dusk and soften in rain. */
  private updateShadows() {
    const ls = this.ls;
    if (!ls) return;
    const st = ls.shadow;
    const key = `${st.dx.toFixed(1)}|${st.sy.toFixed(2)}|${st.alpha.toFixed(2)}|${this.castList.length}`;
    Actor.sun = st;
    if (key === this.shadowKey) return;
    this.shadowKey = key;
    this.castList = this.castList.filter((c) => c.s.active && c.src.active);
    for (const c of this.castList) {
      c.s.setPosition(c.src.x + st.dx * (c.tall ? 1.6 : 1), c.s.y);
      c.s.setScale(c.s.scaleX, c.sy * (st.sy / 0.3));
      c.s.setAlpha(c.a * st.alpha);
    }
  }

  /**
   * Lighting pass. A low-res "darkness" layer multiplies the scene (ambient colour per time of day, weather and place),
   * lamps cut soft, banded holes in it and tint the lit ground, and a faint additive halo sits on top of each light.
   * The pass is skipped while nothing it depends on has changed (camera, player, ambient colour, flicker step).
   */
  private updateLighting() {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const rt = this.dark;
    const def = this.zone.def;
    const rain = game.flag('weather') === 'rain';
    const t = game.save.time;
    const ls = lightState({
      period: clock.period,
      prog: clock.progress(),
      outdoor: !!def.outdoor,
      dark: !!def.dark || this.zoneId === 'market',
      rain,
      season: seasonOf(t.day),
      restaurant: this.zoneId === 'restaurant' ? restaurantPhase(t.period, t.minutes) : null,
    });
    this.ls = ls;
    this.updateShadows();
    const lo = lowFx();
    const time = performance.now() / 1000;
    this.updateWindowGlow(time);
    // natural variation steps ~12 times a second (none in battery / reduced-motion mode): the layer is not redrawn in between
    const step = lo ? 0 : Math.floor(time * 12);
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    const key = `${this.zoneId}|${Math.floor(view.x)}|${Math.floor(view.y)}|${rt.width}|${ls.tint}|${ls.lamp.toFixed(2)}|${ls.windows.toFixed(2)}|${ls.vig.toFixed(2)}|${step}|${px}|${py}|${this.lamps.length}|${lo ? 1 : 0}|${this.restaurantLevelKey()}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    this.lightRedraws++;
    rt.setPosition(Math.floor(view.x) - 2, Math.floor(view.y) - 2);
    rt.setVisible(true);
    rt.clear();
    if (ls.tint !== 0xffffff) rt.fill(ls.tint, 1);
    const visible = this.lamps.filter((l) => l.x > view.x - 70 && l.x < view.right + 70 && l.y > view.y - 70 && l.y < view.bottom + 70);
    // slow breathing for lamps, a quicker flicker for flames and paper lanterns
    const flick = (l: Light) => {
      if (lo) return 1;
      if (l.flicker) return 1 + Math.sin(time * 7 + l.x) * 0.05 + Math.sin(time * 13 + l.y) * 0.03;
      return 1 + Math.sin(time * 1.3 + l.x * 0.1) * 0.02;
    };
    const lit = visible.map((l) => ({ l, k: this.lampLevel(l, ls) })).filter((e) => e.k > 0.02);
    if (lit.length) {
      for (const { l, k } of lit) {
        this.lightStamp.setScale((l.r * 2 * flick(l) * (ls.halo > 1 ? 1.08 : 1)) / 64).setAlpha(Math.min(1, k));
        rt.erase(this.lightStamp, l.x - rt.x, l.y - rt.y);
      }
      // tint the lit pools warm (multiply layer: warm colour = warm light on the ground)
      for (const { l, k } of lit) {
        this.lightStamp.setScale((l.r * 1.7 * flick(l) * ls.halo) / 64).setTint(l.color ?? 0xffc070).setAlpha(0.5 * k * (ls.halo > 1 ? 0.85 : 1));
        rt.draw(this.lightStamp, l.x - rt.x, l.y - rt.y);
      }
      this.lightStamp.clearTint().setAlpha(1);
      // the player carries a soft light so the night is never too dark to play
      if (ls.lamp > 0.1) {
        this.lightStamp.setScale(1.5).setAlpha(Math.min(1, ls.lamp));
        rt.erase(this.lightStamp, this.player.x - rt.x, this.player.y - 10 - rt.y);
        this.lightStamp.setAlpha(1);
      }
    }
    // vignette frames the screen (drawn into the same low-res layer)
    if (!this.vignette) this.vignette = this.make.image({ key: vignetteTexture(this) }, false);
    this.vignette.setDisplaySize(rt.width, rt.height).setAlpha(ls.vig);
    rt.draw(this.vignette, rt.width / 2, rt.height / 2);
    // faint additive halo around each light (skipped in battery mode)
    let i = 0;
    if (!lo) {
      for (const { l, k } of lit) {
        let g = this.glowPool[i];
        if (!g) {
          g = this.add.image(0, 0, glowTexture(this)).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001);
          this.glowPool.push(g);
        }
        const f = flick(l);
        const spill = l.kind === 'spill';
        g.setVisible(true)
          .setPosition(l.x, l.y)
          .setTint(l.color ?? 0xffc070)
          .setScale((spill ? 0.9 : (l.r * 1.5 * ls.halo) / 64) * f, (spill ? 0.45 : (l.r * 1.5 * ls.halo) / 64) * f)
          .setAlpha(Math.min(0.7, (l.glow ?? 0.4) * k * f * 0.9));
        i++;
      }
    }
    for (; i < this.glowPool.length; i++) this.glowPool[i].setVisible(false);
  }

  /** How lit a given light is right now (0..1): lamps follow dusk and night, windows follow the evening, the restaurant facade follows its hours. */
  private lampLevel(l: Light, ls: LightState): number {
    if (l.facade) {
      const f = this.facadeLevel(true, false);
      return l.kind === 'spill' ? f : Math.max(ls.lamp * f, f * 0.85);
    }
    return l.kind === 'spill' || l.kind === 'window' ? ls.windows : ls.lamp;
  }

  /** Part of the lighting cache key: the restaurant opens and closes by the clock while the rest of the light stays the same. */
  private restaurantLevelKey(): string {
    const t = game.save.time;
    return restaurantPhase(t.period, t.minutes);
  }

  /** Applies battery mode: caps the frame rate and rebuilds ambience without heavy effects. */
  enterLowFx(announce = false) {
    const loop = this.game.loop as any;
    const low = lowFx();
    loop.fpsLimit = low ? 30 : 0;
    loop._limitRate = low ? 1000 / 30 : 0;
    loop.hasFpsLimit = low;
    this.setupAmbient();
    if (announce) import('../ui/dom').then(({ toast }) => toast('Activé el modo batería para que el juego vaya más fluido.'));
  }

  // ------------------------------------------------------------------ objective guide
  private guideArrow: Phaser.GameObjects.Image | null = null;
  private guideMark: Phaser.GameObjects.Image | null = null;
  private guideT = 0;
  private guideGoal: { x: number; y: number; npc?: string } | null = null;

  private updateGuide(dt: number) {
    if (!this.guideArrow) {
      this.guideArrow = this.add.image(0, 0, guideTexture(this, 'arrow')).setDepth(250000).setVisible(false).setScale(1.5);
      this.guideMark = this.add.image(0, 0, guideTexture(this, 'mark')).setDepth(250000).setVisible(false);
    }
    this.guideT -= dt;
    if (this.guideT <= 0) {
      this.guideT = 0.5;
      this.guideGoal = null;
      const t = settings.guide !== false && !this.inputLocked ? questTarget() : null;
      if (t) {
        if (t.zone === this.zoneId || (t.zone === 'home' && this.zoneId === 'home')) {
          if (t.npc) this.guideGoal = { x: 0, y: 0, npc: t.npc };
          else if (t.x != null && t.y != null) this.guideGoal = { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 };
        } else {
          const d = nextDoor(this.zoneId, t.zone);
          if (d) this.guideGoal = { x: d.x * TILE + TILE / 2, y: d.y * TILE + TILE / 2 };
        }
      }
    }
    const arrow = this.guideArrow!;
    const mark = this.guideMark!;
    let goal = this.guideGoal;
    if (goal?.npc) {
      const n = this.npcs.get(goal.npc);
      goal = n ? { x: n.actor.x, y: n.actor.y - 30 } : null;
    }
    if (!goal) {
      arrow.setVisible(false);
      mark.setVisible(false);
      return;
    }
    const now = performance.now() / 1000;
    const px0 = this.player.x;
    const py0 = this.player.y - 12;
    const dx = goal.x - px0;
    const dy = goal.y - py0;
    const dist = Math.hypot(dx, dy);
    const view = this.cameras.main.worldView;
    const onScreen = goal.x > view.x + 8 && goal.x < view.right - 8 && goal.y > view.y + 8 && goal.y < view.bottom - 8;
    mark.setVisible(onScreen).setPosition(goal.x, goal.y - 10 + Math.sin(now * 4) * 2);
    const show = dist > 34;
    arrow.setVisible(show);
    if (show) {
      const a = Math.atan2(dy, dx);
      const r = 24 + Math.sin(now * 5) * 2;
      arrow.setPosition(px0 + Math.cos(a) * r, py0 + Math.sin(a) * r).setRotation(a).setAlpha(0.95);
    }
  }

  private quirks(dt: number) {
    this.quirkT -= dt;
    if (this.quirkT > 0 || this.inputLocked || lowFx()) return;
    this.quirkT = 25 + Math.random() * 35;
    const raccoons = [...this.npcs.entries()].filter(([id]) => CHAR_BY_ID[id]?.raccoon || Math.random() < 0.3);
    if (!raccoons.length) return;
    const [id, n] = raccoons[Math.floor(Math.random() * raccoons.length)];
    import('../story/quirks').then(({ runQuirk }) => runQuirk(id, n.actor, this));
  }
}

function guestHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A visitor look, stable for the party so a couple doesn't change clothes mid-meal. */
function guestLook(id: string, n: number): Appearance {
  const h = guestHash(id + ':' + n);
  const species = ['human', 'cat', 'fox', 'bunny', 'dog', 'bear', 'otter', 'squirrel'] as const;
  const sp = species[h % species.length];
  const hair = ['#2a2230', '#5b3a2e', '#d8a05a', '#b2585e', '#d8d2c8'];
  const tops = ['top_tee_cream', 'top_tee_sage', 'top_stripes_navy', 'top_sweater_rose', 'top_cardigan_moss', 'top_kimono_indigo', 'top_winter_coat'];
  return {
    species: sp,
    skin: sp === 'human' ? ['#f2cfb3', '#c98e66', '#e3b48e'][h % 3] : ['#d8874f', '#a8734d', '#8d8a93', '#f3e6c8', '#e0c08a'][h % 5],
    hairStyle: sp === 'human' ? h % 6 : 6,
    hairColor: hair[h % hair.length],
    eyes: h % 5,
    eyeColor: '#2a2230',
    top: tops[h % tops.length],
    bottom: ['bot_jeans', 'bot_pants_brown', 'bot_skirt_plaid'][h % 3],
    shoes: 'sh_sneakers',
    head: '',
    face: '',
    extra: '',
    bag: '',
  };
}
