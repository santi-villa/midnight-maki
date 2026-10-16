/**
 * The explorable world. Renders the current zone, runs player/NPC movement, lighting,
 * ambient effects and interaction detection. Gameplay decisions are delegated to systems/actions.
 */
import Phaser from 'phaser';
import { SHORE_FRAMES, TILESET_COLS, TILE_INDEX, waterFrames } from '../art/tiles';
import { WaterFx } from './waterFx';
import { lampPoolTint, lightState, type LightState } from './lightmath';
import { audio, type Track } from '../audio/audio';
import { bus } from '../core/events';
import { reportError, runTask } from '../core/errors';
import { settings } from '../core/settings';
import { game } from '../core/state';
import type { Dir } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import { ITEMS_BY_ID } from '../data/items';
import { ZONES, GARDEN_PLOT_POSITIONS } from '../data/zones';
import { Actor, TILE, type Act } from '../entities/Actor';
import { bedtimeReason, settleBedtime } from '../systems/bedtime';
import { closedLocalNotice, shopGate, stopFor } from '../systems/npcs';
import { businessPhase, pace, phaseOf, restaurantPhase, shopButtonLabel, shopSignText, shopInteractionText, signSpots } from '../systems/schedule';
import { seasonOf } from '../core/balance';
import { clock } from '../systems/time';
import { lowFx, sampleFrame } from '../core/perf';
import { nextDoor, questTarget } from '../world/guide';
import { employees, hostSlowdown, practicePip, runtime as staffRuntime, setTableNamer, tickStaff, type StaffEnv } from '../restaurant/staff';
import { NeighborLife } from '../systems/neighbors';
import { facingTable, seatDrawOffset, standApart } from '../restaurant/seating';
import { planWaitSpots, scanWaitSpots, RECEPTION_SPOTS, WAITING_SPOTS, type WaitTile } from '../restaurant/waiting';
import { deliveryGoals, nearestGoal, type DeliveryDish } from '../world/delivery';
import { currentQuestTarget } from '../quests/quests';
import { customerAsk, mealComment } from '../restaurant/orders';
import { canAcceptGuest, carriedOrders, chooseParty, collectTipAt, deliverTo, exitGuest, guestViews, hostGuest, pumpService, receiveGuest, resetService, seatGuest, spawnGuest, tableJobs, tableLabel, trayOrders, syncRestaurantHours, takeOrderAt, type PaidMeal } from '../restaurant/service';
import { tipPending, type FurnPiece, type PartyPhase } from '../restaurant/floor';
import { furnSize } from '../data/furniture';
import { isTypingTarget, normalizeStick } from '../input/bindings';
import { castKey, trimCasts } from './shadowTex';
import { benchSpots, clearings, fountainSpots, shoreSpots, type Place } from '../systems/neighborSpots';
import { idleOffer, isPlayerRoom, needsMore, offerKey, resolveContext, type ContextAction, type ContextOffer, type Target } from '../world/contextActions';
import { buildZone, condOk, doorLeadingTo, roomAt, waterDepthAt, waterVariant, type BuiltZone, type FurnInstance } from '../world/zoneRuntime';
import { charTexture, critterTexture, dotTexture, furnTexture, iconTexture, lightTexture, propTexture, vignetteTexture, glowTexture, guideTexture, cloudShadowTexture, questMarkerTexture, windowGlowTexture, customerTexture, lookTexture, shopSignTexture, hasCharTexture, hasLookTexture, orderMarkTexture } from './textures';
import { ambientExchange, type AmbientLine } from '../dialogue/ambient';
import { Journey, type Position } from '../systems/journeys';
import { TownLife, type TownResident } from '../systems/townLife';
import { safeArrival, zoneTransitionKind } from '../world/zoneTransition';
import { clampFrameZoom, walkingZoom } from '../ui/frameMath';
import { layoutSpeech } from '../ui/speechLayout';
import { SpeechTurns } from '../world/speechTurns';
import { customerLook } from '../restaurant/customers';
import { clientsDemand, nextTownGuest, noteTownMeal, noteTownLeft } from '../restaurant/townVisits';
import { neighborOf } from '../restaurant/townClients';
import { whatPlace, topicLine, type TalkCtx } from '../dialogue/topics';
import { homeLayout } from '../art/homes';
import { microFor } from '../systems/npcMicro';
import { NEIGHBORS, NEIGHBOR_BY_ID } from '../data/neighbors';
import { DRINK_BY_ID, drinksUnlocked } from '../restaurant/drinkData';
import { RECIPES_BY_ID } from '../data/recipes';
import { gatherSpots, type GatherSpot } from '../systems/gather';
import { SEED_INFO } from '../systems/garden';
import { companyScene, openCompany } from '../story/companions';
import type { CompanyActivity } from '../systems/companionship';

export type { Target };

interface NpcState { out?: boolean; actor: Actor; anchor: [number, number]; wander: number; act?: Act; t: number; leaving?: boolean; wavedAt?: number; last?: [number, number]; traveling?: boolean; social?: boolean; micro?: boolean; barkAt?: number; }
/** kind: lamp (default, follows lamp level), spill = light from windows / doors, window = interior window light, ambient = soft room fill */
interface Light { x: number; y: number; r: number; flicker: boolean; color?: number; glow?: number; kind?: 'spill' | 'window' | 'ambient'; facade?: boolean }
interface CastShadow { s: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image; tall: boolean; sy: number; a: number; x: number }
interface WindowGlow { img: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image; facade: boolean; door: boolean; phase: number; shop?: string; home?: boolean; seed: number }
const SHOP_OF_VARIANT: Record<number, string> = { 20: 'taro', 21: 'bento', 22: 'yuki', 23: 'library' };
interface ShopFacade { img: Phaser.GameObjects.Image; propId: string; shop: string; closed: boolean }
interface Bug { sprite: Phaser.GameObjects.Image; item: string; vx: number; vy: number; t: number; }
interface Occluder { sprite: Phaser.GameObjects.Image; baseY: number; bounds: { left: number; right: number; top: number; bottom: number }; }

export let world: WorldScene;

/** guests in these phases are sitting at their table */
const SEATED_PHASES: PartyPhase[] = ['seated', 'waiting_order', 'waiting_food', 'eating', 'paying'];

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
  private shopSigns: Phaser.GameObjects.Image[] = [];
  private shopFacades: ShopFacade[] = [];
  private npcKey = '';
  private shopKey = '';
  private lifeTick = 0;
  private town = new TownLife();
  private decorReaction = false;
  private townMembers = '';
  private townSave = game.save;
  private townDay = game.save.time.day;
  private floorTick = 0;
  private hoursTick = 0;
  private busOff: Array<() => void> = [];
  private mealBusy = false;
  private bedtimeBusy = false;
  private mealQueue: PaidMeal[] = [];
  extras = new Map<string, Actor>(); // cutscene-only actors
  joy = { x: 0, y: 0 };
  /** A ground click keeps its path until the movement keys and the stick are released. */
  private pointerSteer = false;
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
  /** When the notebook pose from taking an order should end. */
  private notingUntil = 0;
  inputLocked = 0; // cutscenes
  /** Phone camera: layout keeps this zoom and does not follow the player until the shot ends. */
  private framingZoom: number | null = null;
  onInteract: (t: Target) => void = () => {};
  onEnterZone: (id: string) => void | Promise<void> = () => {};
  /** story hook: may unlock a door when the player tries it (returns true if now open) */
  lockHook: (to: string) => boolean = () => false;
  private quirkT = 20;
  private blockKey = '';
  private stepT = 0;
  private transitioning = false;
  private pointerDown: { x: number; y: number; t: number } | null = null;
  decorMode = false;
  /** the kitchen close-up is open: Sofi works in the kitchen and the camera frames it */
  cookActive = false;
  private cookSaved = { zoom: 2 };
  private cookProp: Phaser.GameObjects.Image | null = null;
  private questPin!: Phaser.GameObjects.Image;
  private questPinBob = 0;

  constructor() {
    super('world');
    world = this;
  }

  create() {
    this.releaseBus();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as any;
    // Text fields must receive letters. shortcuts.ts decides when a key scrolls the page.
    this.input.keyboard!.disableGlobalCapture();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDown = { x: p.x, y: p.y, t: p.downTime };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.pointerDown;
      this.pointerDown = null;
      // A short slip still counts as a click. Camera movement does not change these screen points.
      if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 28) return;
      if (this.decorMode) return;
      if (!this.canAct()) return;
      this.tapWorld(p.worldX, p.worldY);
    });
    this.game.events.on('blur', this.releaseSteer, this);
    this.events.once('shutdown', () => this.game.events.off('blur', this.releaseSteer, this));
    this.scale.on('resize', () => this.layout());
    this.dark = this.add.renderTexture(0, 0, 8, 8).setOrigin(0, 0).setDepth(200000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lightStamp = this.make.image({ key: lightTexture(this) }, false);
    this.busOff.push(
      bus.on('time:changed', () => this.onPeriodChange()),
      bus.on('decor:changed', () => {
        this.town.invalidate(); this.diningCache = null;
        for (const v of this.visitors.values()) for (const trip of v.trips) trip.replan();
        this.refreshFurniture(); this.decorReaction = true;
      }),
      bus.on('state:changed', () => {
        if (this.zoneId === 'restaurant') this.syncGuests();
        if (this.zone && this.blockKey !== this.blockStamp() && !clock.paused) { this.blockKey = this.blockStamp(); this.refreshZone(); }
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
    const fit = walkingZoom(w, h, TILE);
    const framing = this.framingZoom != null;
    const zoom = framing ? clampFrameZoom(this.framingZoom!, fit) : fit;
    if (framing) this.framingZoom = zoom;
    const mid = framing ? { x: cam.midPoint.x, y: cam.midPoint.y } : null;
    cam.setZoom(zoom);
    if (this.zone) this.applyBounds();
    if (mid) cam.centerOn(mid.x, mid.y);
    else if (this.cookActive) this.cookFrame(0);
    this.sizeDark(zoom);
  }

  /** Stop following the player so a phone photo can pan and zoom. */
  beginPhotoFrame() {
    if (this.framingZoom != null || !this.player) return;
    const cam = this.cameras.main;
    cam.stopFollow();
    this.framingZoom = cam.zoom;
    this.inputLocked++;
  }

  /** Scroll and integer zoom while a phone photo is being framed. */
  applyPhotoFrame(scrollX: number, scrollY: number, zoom: number) {
    if (this.framingZoom == null) return;
    const cam = this.cameras.main;
    const z = clampFrameZoom(zoom, walkingZoom(this.scale.width, this.scale.height, TILE));
    this.framingZoom = z;
    // A drag calls this every move. Resize the darkness layer only when the zoom actually changes.
    if (z !== cam.zoom) {
      cam.setZoom(z);
      if (this.zone) this.applyBounds();
      this.sizeDark(z);
    }
    cam.setScroll(scrollX, scrollY);
  }

  /** Back to walking behind the player. Safe to call when no photo is open. */
  endPhotoFrame() {
    if (this.framingZoom == null) return;
    this.framingZoom = null;
    this.inputLocked = Math.max(0, this.inputLocked - 1);
    this.layout();
    if (this.cookActive || !this.player?.sprite?.active) return;
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1, 0, 8);
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  private sizeDark(zoom: number) {
    const vw = Math.ceil(this.scale.width / zoom) + 4;
    const vh = Math.ceil(this.scale.height / zoom) + 4;
    this.dark.setSize(vw, vh);
    this.dark.resize?.(vw, vh);
  }

  // ------------------------------------------------------------------ cooking close-up
  /** Frames the kitchen in the upper part of the screen (the cooking panel covers the lower part). */
  private cookFrame(ms = 500) {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.max(2, Math.floor(Math.min(w / (TILE * 9.5), (h * 0.5) / (TILE * 5.5))));
    cam.removeBounds();
    if (ms) cam.zoomTo(zoom, ms); else cam.setZoom(zoom);
    const cy = 3.9 * TILE + (h * 0.23) / zoom;
    if (ms) cam.pan(4.7 * TILE, cy, ms, 'Sine.easeInOut'); else cam.centerOn(4.7 * TILE, cy);
  }

  /** Opens or closes the kitchen close-up. Only possible inside the restaurant. */
  cookFocus(on: boolean): boolean {
    const cam = this.cameras.main;
    if (on) {
      if (this.cookActive) return true;
      if (this.zoneId !== 'restaurant' || !this.player || this.transitioning) return false;
      this.cookActive = true;
      this.cookSaved = { zoom: cam.zoom };
      this.player.stop();
      cam.stopFollow();
      this.cookFrame(550);
      document.body.classList.add('cook-focus');
      return true;
    }
    if (!this.cookActive) return false;
    this.cookActive = false;
    this.cookPop(null);
    this.player.setAct('idle');
    document.body.classList.remove('cook-focus');
    cam.zoomTo(this.cookSaved.zoom, 450);
    this.applyBounds();
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 8);
    this.time.delayedCall(500, () => { if (!this.cookActive) cam.startFollow(this.player.sprite, true, 1, 1, 0, 8); });
    return true;
  }

  /** Sofi walks to a tile of the kitchen and turns to face the counter. */
  cookGo(tx: number, ty: number, dir: Dir): Promise<void> {
    return new Promise((resolve) => {
      const p = this.player;
      p.setAct('idle');
      const done = () => { p.face(dir); resolve(); };
      const near = this.zone.grid.isSolid(tx, ty) ? this.zone.grid.nearestWalkable(tx, ty) : [tx, ty];
      if (!near || !p.walkTo(this.zone.grid, near[0], near[1], done)) { if (near) p.teleport(near[0], near[1]); done(); }
    });
  }

  /** Sofi works (chopping, mixing, shaping) or stands still. */
  cookPose(working: boolean) {
    this.player.setAct(working ? 'cook' : 'idle');
  }

  /** A little burst above Sofi for how a beat went. */
  cookSpark(verdict: 'perfect' | 'good' | 'ok' | 'miss') {
    const p = this.player;
    const text = verdict === 'perfect' ? '✦' : verdict === 'good' ? '✓' : verdict === 'ok' ? '·' : '…';
    this.floatAt(p.x + (Math.random() * 10 - 5), p.y - 40, text, verdict === 'perfect' ? '#ffe08a' : verdict === 'good' ? '#bfe3a0' : '#e8dcc4');
  }

  /** An ingredient or dish held up above the counter for a moment; null clears it. */
  cookPop(spec: import('../art/icons').IconSpec | null) {
    this.cookProp?.destroy();
    this.cookProp = null;
    if (!spec) return;
    const p = this.player;
    const img = this.add.image(p.x, p.y - 34, iconTexture(this, spec)).setOrigin(0.5, 1).setDepth(300000).setScale(0.9);
    this.cookProp = img;
    this.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
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
  async enterZone(id: string, tx: number, ty: number, dir: Dir = 'down', withFade = true, allowClosed = false): Promise<boolean> {
    if (this.transitioning) return false;
    if (!allowClosed && id !== this.zoneId) {
      const closed = closedLocalNotice(id);
      if (closed) {
        bus.emit('toast', { text: closed });
        return false;
      }
    }
    this.transitioning = true;
    const previous = this.zone;
    const position = this.player ? { zone: this.zoneId, x: this.player.tx, y: this.player.ty, dir: this.player.dir } : null;
    try {
      if (!ZONES[id] || !['up', 'down', 'left', 'right'].includes(dir)) throw new Error('Invalid zone destination');
      const prepared = buildZone(id, clock.isNight() || clock.period === 2);
      const arrival = safeArrival(prepared, tx, ty);
      const load = async () => {
        try {
          this.mountZone(prepared, arrival.x, arrival.y, dir);
          await this.waitForRender();
        } catch (err) {
          if (previous && position) {
            try {
              this.mountZone(previous, position.x, position.y, position.dir);
              await this.waitForRender();
            } catch (recovery) { reportError('world:zone-recovery', recovery); }
          }
          throw err;
        }
      };
      if (withFade && this.zoneId && this.zoneId !== id) {
        const { screenTransition } = await import('../ui/dom');
        await screenTransition(zoneTransitionKind(this.zoneId, id), load);
      } else await load();
      this.transitioning = false;
      if (id.startsWith('shop_') || id === 'library') {
        const status = shopGate(id === 'library' ? id : id.slice(5));
        if (status.tracked && status.open) bus.emit('toast', { text: shopInteractionText(status) });
      }
      bus.emit('zone:enter', { zone: id });
      void runTask('world:zone-story', () => this.onEnterZone(id));
      return true;
    } finally { this.transitioning = false; }
  }

  /** Rebuilds the current zone in place (an obstacle was cleared, a gate opened). */
  refreshZone() {
    if (!this.player || this.transitioning) return;
    void runTask('world:refresh-zone', () => this.enterZone(this.zoneId, this.player.tx, this.player.ty, this.player.dir, false, true));
  }

  /** Flags that decide which obstacles stand in this zone right now. */
  private blockStamp(): string {
    const flags = new Set<string>();
    for (const p of this.zone?.def.props ?? []) if (p.id.startsWith('block_') || p.id === 'sawhorse') if (p.cond?.startsWith('!')) flags.add(p.cond);
    return [...flags].map((c) => c + (condOk(c) ? 1 : 0)).join(',');
  }

  private mountZone(built: BuiltZone, tx: number, ty: number, dir: Dir) {
    this.buildZoneObjects(built.def.id, built);
    if (!this.player || !this.player.sprite.active) {
      this.player = new Actor(this, 'player', charTexture(this, 'player'), tx, ty);
      this.player.speed = 72;
    } else this.player.teleport(tx, ty);
    this.player.face(dir);
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1, 0, 8);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    Object.assign(game.save.player, { zone: built.def.id, x: tx, y: ty, dir });
    this.spawnNpcs(false);
    this.blockKey = this.blockStamp();
    this.npcKey = this.npcStamp();
    this.shopKey = this.shopStamp();
    this.refreshShopSigns();
    this.playZoneAudio();
  }

  /** Two completed frames settle the new camera and its existing lighting before revelation. */
  private waitForRender(): Promise<void> {
    return new Promise((resolve, reject) => {
      let frames = 0, timer = 0;
      const clean = () => {
        clearTimeout(timer);
        this.game.events.off(Phaser.Core.Events.POST_RENDER, rendered);
        document.removeEventListener('visibilitychange', visibility);
      };
      const rendered = () => { if (++frames < 2) return; clean(); resolve(); };
      const visibility = () => {
        clearTimeout(timer);
        // Backgrounding a mobile browser pauses rendering; resume the deadline when visible.
        if (!document.hidden) timer = window.setTimeout(() => { clean(); reject(new Error('Zone render did not complete')); }, 2000);
      };
      this.game.events.on(Phaser.Core.Events.POST_RENDER, rendered);
      document.addEventListener('visibilitychange', visibility);
      visibility();
    });
  }

  private clearZone() {
    this.questPin?.setVisible(false);
    for (const s of this.shopSigns) s.destroy();
    this.shopSigns = [];
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.windowGlows = [];
    this.shopFacades = [];
    this.castList = [];
    this.lightKey = '';
    this.shadowKey = '';
    for (const f of this.furnSprites) f.destroy();
    this.furnSprites = [];
    this.stopSpeech();
    this.endConversation();
    this.rememberResidents();
    for (const n of this.npcs.values()) n.actor.destroy();
    this.npcs.clear();
    for (const e of this.extras.values()) e.destroy();
    this.extras.clear();
    for (const g of this.gatherSprites) g.img.destroy();
    this.gatherSprites = [];
    for (const b of this.bugs) b.sprite.destroy();
    this.bugs = [];
    this.clearGuests(); this.clearStaff(); this.clearNeighbors();
    this.serviceArt?.destroy(); this.serviceArt = null;
    for (const sprite of this.carriedSprites) sprite.destroy(); this.carriedSprites = [];
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

  buildZoneObjects(id: string, prepared?: BuiltZone) {
    const built = prepared ?? buildZone(id, clock.isNight() || clock.period === 2);
    this.clearZone();
    this.zoneId = id;
    this.zone = built;
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
      img.setDepth(p.def.ground ? -8 : onWall ? -5 : p.def.kind === 'puddle' ? -8 : p.def.kind === 'awning' || p.def.kind === 'poster' ? py - 0.1 : py);
      if (!onWall && !p.def.ground && p.def.kind !== 'puddle' && (p.def.sh > p.def.h * TILE || !p.def.solid)) {
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
      if (!onWall && !p.def.ground) {
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
        const shop = fac ? 'restaurant' : SHOP_OF_VARIANT[p.def.variant ?? -1];
        this.addWindowGlow(img, p.def.sw, p.def.sh, p.def.variant ?? 0, false, fac, shop);
        if (fac) this.addWindowGlow(img, p.def.sw, p.def.sh, 0, true, true, shop);
        if (shop) this.shopFacades.push({ img, propId: p.key, shop, closed: false });
      }
      if ((p.def.kind === 'townhouse' || p.def.kind === 'sidehouse') && (p.def.variant ?? 0) < 8) {
        // houses: lit windows, the glass of the door and the porch lantern, and a pool of light on the path
        const side = p.def.kind === 'sidehouse';
        const hl = homeLayout(p.def.sw, p.def.sh, p.def.variant ?? 0, side);
        const left = px - p.def.sw / 2, top = py - p.def.sh;
        for (const w of hl.windows) this.lamps.push({ x: left + w.x + w.w / 2, y: top + w.y + w.h + 8, r: 24, flicker: false, color: 0xffb867, glow: 0.3, kind: 'spill', facade: false });
        this.lamps.push({ x: left + hl.door.x + hl.door.w / 2 + (hl.right ? -9 : 9), y: top + hl.door.y + 4, r: 26, flicker: true, color: 0xffaa55, glow: 0.45, kind: 'spill', facade: false });
        this.addWindowGlow(img, p.def.sw, p.def.sh, p.def.variant ?? 0, false, false, undefined, side ? 'side' : 'front');
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
    const size = furnSize(def, f.rot);
    const px = f.x * TILE + (size.w * TILE) / 2;
    const py = (f.y + size.h) * TILE;
    const img = this.add.image(px, py, key).setOrigin(0.5, 1);
    if (def.walkable) img.setDepth(-6);
    else if (def.wall) img.setDepth(-5);
    else {
      img.setDepth(py);
      const sh = this.add.ellipse(px, py - 1, size.w * TILE * 0.85, 5, 0x1a1428, 0.3).setDepth(-7);
      this.furnSprites.push(sh as any);
      const cs = this.castShadow(img, def.kind, false);
      if (cs) this.furnSprites.push(cs);
      if (def.sh > size.h * TILE) {
        this.occluders.push({
          sprite: img,
          baseY: py,
          bounds: {
            left: px - (size.w * TILE) / 2,
            right: px + (size.w * TILE) / 2,
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
      const position = GARDEN_PLOT_POSITIONS[i];
      if (!position) return;
      const [x, y] = position;
      this.layer!.putTileAt(p.seed && p.watered ? TILE_INDEX.soilwet : TILE_INDEX.soil, x, y);
      if (i >= 6) this.cropSprites.push(this.add.image(x * TILE + 8, y * TILE + 16, propTexture(this, 'project_plot')).setOrigin(0.5, 1).setDepth(y * TILE + 1));
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
          // The cat's unmirrored artwork faces left (birds face right).
          s.setFlipX(c.vx > 0);
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
  private visitors = new Map<string, { id: string; customer: string; customers: string[]; origin: Position; trips: Journey[]; stage: 'arriving' | 'dining' | 'departing'; phase?: PartyPhase; greeted: boolean }>();
  private restoredDining = false;
  private serviceArt: Phaser.GameObjects.Graphics | null = null;
  private carriedSprites: Phaser.GameObjects.Image[] = [];
  private visitorIn = 4;
  private impatientParties = new Set<string>();
  private ateParties = new Set<string>();
  private hostId: string | null = null;
  private hostWait = 0;
  private speech = new SpeechTurns();
  private speechActor: Actor | null = null;
  private diningCache: FurnPiece[] | null = null;

  // ------------------------------------------------------------------ ambient neighbours
  private neighborLife = new NeighborLife();
  private neighborBodies = new Map<string, { actor: Actor; bike: Phaser.GameObjects.Image | null; barkAt: number; pose: Act | null; poseUntil: number; nextPose: number }>();
  private npcWait = new Set<string>();
  private orderMarks = new Map<string, Phaser.GameObjects.Image>();

  private clearNeighbors() {
    for (const b of this.neighborBodies.values()) { b.actor.destroy(); b.bike?.destroy(); }
    this.neighborBodies.clear();
  }

  private updateNeighbors(dt: number) {
    if (!game.has('intro_done') || !this.zone || !this.player || this.transitioning || this.decorMode || clock.paused) return;
    this.neighborLife.tick(dt);
    const here = new Set<string>();
    const now = performance.now();
    let minted = false;
    for (const st of this.neighborLife.inZone(this.zoneId)) {
      const n = st.n, trip = st.trip;
      let body = this.neighborBodies.get(n.id);
      if (!body) {
        // One new sheet per frame. Cached looks are free, so a warmed plaza still fills in immediately.
        if (!hasLookTexture(this, n.look)) {
          if (minted) continue;
          minted = true;
        }
        const actor = new Actor(this, 'nb_' + n.id, lookTexture(this, n.look), trip.position.x, trip.position.y);
        actor.manual = true;
        body = { actor, bike: null, barkAt: now + 8000 + (n.id.length * 1700) % 6000, pose: null, poseUntil: 0, nextPose: now + 2500 + (n.id.length * 400) % 3000 };
        this.neighborBodies.set(n.id, body);
      }
      here.add(n.id);
      const a = body.actor;
      const riding = st.ride && trip.moving;
      a.x = trip.position.x * TILE + TILE / 2;
      a.y = trip.position.y * TILE + TILE - 2;
      a.dir = !trip.moving && st.place.dir ? st.place.dir : trip.dir;
      a.moving = trip.moving && !riding;
      a.seatLift = trip.settled ? st.place.seatLift ?? 0 : 0;
      a.bed = trip.settled && st.place.act === 'sleep' ? st.place.bed ?? null : null;
      const base: Act = riding ? 'sit' : trip.moving ? 'idle' : trip.settled ? st.place.act ?? 'idle' : 'idle';
      if (riding || trip.moving || !trip.settled) { body.pose = null; body.poseUntil = 0; }
      const posing = !riding && !!body.pose && now < body.poseUntil;
      const act = posing ? body.pose! : base;
      if (a.act !== act) a.setAct(act);
      const quiet = base === 'sleep' || base === 'sit' || base === 'eat' || base === 'read' || base === 'drink' || base === 'fish' || base === 'stars' || base === 'paint' || base === 'cook';
      if (!posing && !riding && trip.settled && !quiet && now >= body.nextPose) {
        body.nextPose = now + 6000 + (n.id.charCodeAt(0) % 5) * 700;
        const g = microFor(n.id, { act: st.place.act, period: clock.period, rain: game.flag('weather') === 'rain', outdoor: !!ZONES[this.zoneId]?.outdoor }, Math.random(), Math.random());
        if (g) {
          body.pose = g.act as Act;
          body.poseUntil = now + g.seconds * 1000;
          a.setAct(g.act as Act);
        }
      }
      // a bicycle under whoever is riding
      if (riding) {
        if (!body.bike?.active) body.bike = this.add.image(0, 0, propTexture(this, 'bicycle')).setOrigin(0.5, 1);
        body.bike.setVisible(true).setPosition(a.x, a.y + 1).setDepth(a.y - 0.5).setFlipX(a.dir === 'left').setScale(a.dir === 'up' || a.dir === 'down' ? 0.6 : 1, 1);
        if (a.act !== 'sit') a.setAct('sit');
        a.seatLift = 6;
      } else if (st.ride && trip.settled && st.place.kind !== 'home') {
        // parked beside them while they stop
        if (!body.bike?.active) body.bike = this.add.image(0, 0, propTexture(this, 'bicycle')).setOrigin(0.5, 1);
        body.bike.setVisible(true).setPosition(a.x + 14, a.y + 1).setDepth(a.y - 0.5).setFlipX(false).setScale(1, 1);
      } else body.bike?.setVisible(false);
      a.update(dt);
      // a word for whoever walks by
      if (now > body.barkAt && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 60 && this.roomForAmbient('nb:' + n.id)) {
        const said = this.sayLine('nb:' + n.id, n.lines[Math.floor((now / 1000 + n.id.length) % n.lines.length)], 3, undefined, true);
        if (said) body.barkAt = now + 25000 + (n.id.length * 2300) % 15000;
      }
    }
    for (const [id, body] of this.neighborBodies) {
      if (here.has(id)) continue;
      this.speech.dropSpeaker('nb:' + id);
      if (this.speechActor === body.actor) this.speechActor = null;
      body.actor.destroy(); body.bike?.destroy(); this.neighborBodies.delete(id);
    }
  }

  // ------------------------------------------------------------------ staff (hired waiters)
  private staffBodies = new Map<string, { actor: Actor; plate: Phaser.GameObjects.Image | null }>();

  private clearStaff() {
    for (const b of this.staffBodies.values()) { b.actor.destroy(); b.plate?.destroy(); }
    this.staffBodies.clear();
  }

  private staffEnv(): StaffEnv {
    const grid = this.zoneId === 'restaurant' ? this.zone.grid : this.town.grid('restaurant');
    const near = (x: number, y: number) => (grid.isSolid(x, y) ? grid.nearestWalkable(x, y) : [x, y]) ?? [x, y];
    return {
      home: () => { const [x, y] = near(7, 6); return { x, y }; },
      tray: () => { const [x, y] = near(6, 5); return { x, y }; },
      tableSpots: (tableId) => {
        const t = this.diningPieces().find((pc) => String(pc.uid) === tableId);
        if (!t) return [];
        const out: { x: number; y: number }[] = [];
        for (let dy = -1; dy <= t.h; dy++) for (let dx = -1; dx <= t.w; dx++) {
          const inside = dx >= 0 && dx < t.w && dy >= 0 && dy < t.h;
          if (!inside && !grid.isSolid(t.x + dx, t.y + dy)) out.push({ x: t.x + dx, y: t.y + dy });
        }
        return out;
      },
      stove: () => { const [x, y] = near(5, 4); return { x, y }; },
      pantry: () => { const [x, y] = near(1, 4); return { x, y }; },
      path: (a, b) => grid.path(a.x, a.y, b.x, b.y),
      crew: {
        where: (id) => {
          const res = this.town.residents.get(id);
          if (!res || typeof game.flag('at_' + id) === 'string') return null;
          return { zone: res.trip.position.zone, x: res.trip.position.x, y: res.trip.position.y, settled: res.trip.settled };
        },
        move: (id, tile) => {
          if (tile) this.rememberResidents();
          this.town.duty(id, tile ? { zone: 'restaurant', x: tile.x, y: tile.y, wander: 0, act: 'work' } : null);
        },
        working: () => ['open', 'closing'].includes(restaurantPhase(clock.period, game.save.time.minutes)),
      },
    };
  }

  private updateStaff(dt: number) {
    if (!game.has('intro_done') || !this.zone || this.transitioning || this.inputLocked || this.decorMode || clock.paused) return;
    setTableNamer((id) => tableLabel(id));
    tickStaff(dt, this.staffEnv());
    const live = new Set<string>();
    if (this.zoneId === 'restaurant') {
      for (const e of employees()) {
        const r = staffRuntime.get(e.id);
        if (!r) continue;
        live.add(e.id);
        let body = this.staffBodies.get(e.id);
        if (!body) {
          const actor = new Actor(this, e.id, lookTexture(this, e.look), r.x, r.y);
          actor.manual = true;
          body = { actor, plate: null };
          this.staffBodies.set(e.id, body);
        }
        const a = body.actor;
        a.x = r.x * TILE + TILE / 2;
        a.y = r.y * TILE + TILE - 2;
        a.moving = r.act === 'walk';
        a.dir = r.dir;
        const act = r.act === 'work' && r.step === 'ordering' ? 'talk' : 'idle';
        if (a.act !== act) a.setAct(act);
        a.sync();
        const order = r.carrying != null ? game.save.orders.find((o) => o.uid === r.carrying) : null;
        const def = order ? (order.kind === 'drink' ? DRINK_BY_ID[order.recipe] : RECIPES_BY_ID[order.recipe]) : null;
        if (def) {
          if (!body.plate?.active) body.plate = this.add.image(0, 0, iconTexture(this, def.icon)).setScale(.65);
          body.plate.setVisible(true).setPosition(a.x + (a.dir === 'left' ? -7 : 7), a.y - 17).setDepth(a.y + 1);
        } else body.plate?.setVisible(false);
      }
    }
    for (const [id, body] of this.staffBodies) {
      if (live.has(id)) continue;
      body.actor.destroy(); body.plate?.destroy(); this.staffBodies.delete(id);
    }
  }

  private clearOrderMarks() {
    for (const mark of this.orderMarks.values()) mark.destroy();
    this.orderMarks.clear();
  }

  private clearGuests() {
    for (const g of this.guests.values()) g.actor.destroy();
    this.guests.clear();
    this.clearOrderMarks();
  }

  private diningPieces(): FurnPiece[] {
    if (this.diningCache) return this.diningCache;
    const zone = this.zoneId === 'restaurant' ? this.zone : buildZone('restaurant');
    return this.diningCache = zone.furniture.filter((fi) => fi.room === 'dining').map((fi) => {
      const size = furnSize(fi.def, fi.f.rot);
      return {
        uid: fi.f.uid, id: fi.f.id, kind: fi.def.kind,
        x: fi.f.x, y: fi.f.y, w: size.w, h: size.h,
        rot: fi.f.rot, sit: fi.def.sit,
      };
    });
  }

  /** Visitors keep walking and meals finish even while Sofi is in another map. */
  private pumpFloor(dt: number) {
    if (!game.has('intro_done') || !this.zone || this.transitioning || this.inputLocked || this.decorMode || clock.paused || this.mealBusy) return;
    const pieces = this.diningPieces();
    canAcceptGuest(pieces);
    if (!this.restoredDining) { this.restoredDining = true; this.restoreVisitors(); }
    const open = restaurantPhase(clock.period, game.save.time.minutes) === 'open';
    this.visitorIn -= dt;
    if (open && this.visitorIn <= 0 && ![...this.visitors.values()].some((v) => v.stage === 'arriving') && canAcceptGuest(pieces)) {
      this.visitorIn = (26 + Math.random() * 8) / clientsDemand();
      const id = 'v' + game.uid();
      const town = nextTownGuest((c) => [...this.visitors.values()].some((v) => v.customers.includes(c)));
      const customers = town ? [town] : chooseParty(pieces);
      if (customers.length) {
        const customer = customers[0];
        const origin: Position = game.has('unlock_station') ? { zone: 'station', x: 17, y: 10 } : { zone: 'plaza', x: 15, y: 24 };
        const spots = this.partySpots(customers.length, 'reception');
        const trips = Array.from({ length: customers.length }, (_, i) => {
          const trip = new Journey({ ...origin, x: origin.x + i }, this.town.grid, 2.5);
          const spot = spots[i] ?? { x: 5, y: 10 };
          trip.go({ zone: 'restaurant', x: spot.x, y: spot.y });
          return trip;
        });
        this.visitors.set(id, { id, customer, customers, origin, trips, stage: 'arriving', greeted: false });
      }
    }
    this.floorTick += dt;
    if (this.floorTick >= 1) {
      const { events, paid, notice } = pumpService(Math.min(1.25, this.floorTick), pieces, { physical: true, arrivals: false, present: this.zoneId === 'restaurant', relaxed: settings.cookMode === 'relaxed' });
      this.floorTick = 0;
      if (notice) this.note(notice);
      for (const ev of events) if (ev.type === 'impatient') {
        this.impatientParties.add(ev.partyId);
        if (this.zoneId === 'restaurant') this.sayVisitor(ev.partyId, 'Cuando puedas, tenemos un poquito de hambre.');
      }
      for (const meal of paid) {
        const owner = [...this.visitors.values()].find((v) => v.customers.includes(meal.customer));
        if (owner && neighborOf(meal.customer)) {
          this.ateParties.add(owner.id);
          noteTownMeal(meal.customer, meal.recipe, meal.quality, this.impatientParties.has(owner.id));
        }
        if (this.zoneId === 'restaurant') this.enqueueMeal(meal);
      }
    }
    const views = guestViews();
    for (const v of this.visitors.values()) {
      const g = views.find((g) => g.id === v.id);
      if (v.stage === 'arriving' && !open) this.sendVisitorHome(v);
      if (v.stage === 'arriving' && v.trips.every((t) => t.settled)) {
        if (spawnGuest(pieces, v.customer, v.id, v.customers)) {
          receiveGuest(v.id);
          v.stage = 'dining';
        } else this.sendVisitorHome(v);
      }
      if (v.stage === 'dining' && g && v.phase !== g.phase) {
        v.phase = g.phase;
        if (g.phase === 'walking') {
          v.trips.forEach((t, i) => t.go({ zone: 'restaurant', x: g.seats[i].x, y: g.seats[i].y }));
        } else if (g.phase === 'queued') {
          const spots = this.partySpots(v.customers.length, 'wait', v.id);
          v.trips.forEach((t, i) => {
            const spot = spots[i];
            if (spot) t.go({ zone: 'restaurant', x: spot.x, y: spot.y });
          });
        } else if (g.phase === 'leaving') {
          v.trips.forEach((t) => t.go(v.origin));
          this.sayVisitor(v.id, '¡Hasta pronto!');
        } else if (g.phase === 'waiting_order') {
          const ask = customerAsk(g.customerId, guestHash(g.id));
          if (ask) this.sayVisitor(v.id, ask);
        }
      }
      for (const t of v.trips) t.tick(dt);
      if (v.stage === 'dining' && g?.phase === 'walking' && v.trips.every((t) => t.settled) && (this.hostId !== v.id || this.town.residents.get('pip')?.trip.settled)) {
        seatGuest(v.id);
        if (this.hostId === v.id) {
          this.sayLine('pip', '¡Que estén cómodos!', 3, 'host:' + v.id);
          this.hostId = null;
          this.town.duty('pip', null);
        }
      }
      if (v.stage === 'dining' && g?.phase === 'leaving' && v.trips.every((t) => t.position.zone !== 'restaurant')) {
        exitGuest(v.id);
        v.stage = 'departing';
      }
      if (v.stage === 'dining' && !g && v.phase) this.sendVisitorHome(v);
      if (v.stage === 'departing' && v.trips.every((t) => t.settled)) {
        for (const c of v.customers) if (neighborOf(c)) noteTownLeft(c, this.ateParties.has(v.id) && !this.impatientParties.has(v.id));
        this.ateParties.delete(v.id); this.impatientParties.delete(v.id);
        this.visitors.delete(v.id);
      }
    }
    // neighbours who are inside are guests, not strollers
    const inside = new Set([...this.visitors.values()].flatMap((v) => v.customers.map((c) => neighborOf(c)?.id).filter((x): x is string => !!x)));
    for (const id of inside) this.neighborLife.hold(id, true);
    for (const n of NEIGHBORS) if (!inside.has(n.id)) this.neighborLife.hold(n.id, false);
    this.updateHost(dt);
    this.syncGuests();
  }

  /** Recover saved groups without regenerating their orders or paying their trays. */
  private restoreVisitors() {
    const reserved = new Set<string>();
    for (const g of guestViews()) {
      if (this.visitors.has(g.id)) continue;
      const origin: Position = game.has('unlock_station') ? { zone: 'station', x: 17, y: 10 } : { zone: 'plaza', x: 15, y: 24 };
      const seated = ['seated', 'waiting_order', 'waiting_food', 'eating', 'paying'].includes(g.phase);
      const waiting = g.phase === 'queued' || g.phase === 'reception' || g.phase === 'outside';
      const spots = waiting ? this.partySpots(g.members.length, g.phase === 'queued' ? 'wait' : 'reception', g.id, reserved) : [];
      for (const spot of spots) reserved.add(`${spot.x},${spot.y}`);
      const trips = g.members.map((_, i) => {
        const seat = g.seats[i];
        const spot = spots[i];
        const p = seated && seat ? { zone: 'restaurant', x: seat.x, y: seat.y } : { zone: 'restaurant', x: spot?.x ?? 5, y: spot?.y ?? 10 };
        const trip = new Journey(p, this.town.grid, 2.5);
        if (g.phase === 'walking' && seat) trip.go({ zone: 'restaurant', x: seat.x, y: seat.y });
        if (g.phase === 'leaving') trip.go(origin);
        return trip;
      });
      this.visitors.set(g.id, { id: g.id, customer: g.customerId, customers: g.members.map(m => m.customerId), origin, trips, stage: 'dining', phase: g.phase, greeted: !['outside', 'reception', 'queued'].includes(g.phase) });
      if (g.phase === 'walking' && !this.hostId && g.seats[0]) {
        this.hostId = g.id; this.town.duty('pip', { zone: 'restaurant', x: g.seats[0].x - 1, y: g.seats[0].y, act: 'work', wander: 0 });
      }
      if (g.phase === 'outside') receiveGuest(g.id);
    }
  }

  private updateServiceArt() {
    if (!this.serviceArt?.active) this.serviceArt = this.add.graphics().setDepth(90000);
    const art = this.serviceArt; art.clear();
    if (this.zoneId === 'restaurant') {
      // A lacquer tray next to the register, plus a separate tea corner in the kitchen.
      art.fillStyle(0x4a3029).fillRect(6 * TILE - 3, 4 * TILE + 8, 20, 8);
      art.fillStyle(0xb78655).fillRect(6 * TILE - 2, 4 * TILE + 9, 18, 5);
      const ready = trayOrders();
      for (let i = 0; i < Math.min(4, ready.length); i++) {
        art.fillStyle(ready[i].kind === 'drink' ? 0x8ab9ad : 0xf6ecd6).fillRect(6 * TILE + i * 4, 4 * TILE + 10, 3, 3);
      }
      if (drinksUnlocked()) { art.fillStyle(0xe9d8b1).fillRect(2 * TILE + 4, 2 * TILE + 2, 5, 5); art.fillStyle(0x91ab69).fillRect(2 * TILE + 5, 2 * TILE + 3, 3, 2); }
      for (const job of tableJobs()) {
        const f = this.zone.furniture.find(fi => String(fi.f.uid) === job.tableId);
        if (!f) continue;
        const size = furnSize(f.def, f.f.rot);
        const x = f.f.x * TILE + size.w * TILE / 2, y = f.f.y * TILE - 5;
        if (tipPending(job.status, job.tip)) {
          const now = performance.now() / 1000;
          const bob = Math.round(Math.sin(now * 2.2 + x) * 1);
          const cx = Math.round(x);
          const cy = Math.round(y + 8 + bob);
          art.fillStyle(0x6a4318).fillRect(cx - 3, cy - 2, 6, 5);
          art.fillStyle(0xf2c66d).fillRect(cx - 2, cy - 1, 4, 3);
          if (Math.floor(now * 1.4 + x) % 4 === 0) art.fillStyle(0xfff6d0).fillRect(cx - 1, cy - 1, 1, 1);
        }
        if (job.phase === 'waiting_order' || job.phase === 'waiting_food') {
          const ratio = Math.max(0, Math.min(1, job.patience / job.maxPatience));
          art.fillStyle(0x4a3029).fillRect(x - 9, y + 3, 18, 3);
          art.fillStyle(settings.cookMode === 'relaxed' || ratio > .5 ? 0x91ab69 : ratio > .2 ? 0xf2c66d : 0xd77a76).fillRect(x - 8, y + 4, Math.ceil(16 * (settings.cookMode === 'relaxed' ? 1 : ratio)), 1);
        }
      }
    }
    this.syncOrderMarks();
    const carrying = carriedOrders();
    this.carriedSprites.forEach(s => s.setVisible(false));
    carrying.forEach((order, i) => {
      const def = order.kind === 'drink' ? DRINK_BY_ID[order.recipe] : RECIPES_BY_ID[order.recipe];
      if (!def) return;
      const texture = iconTexture(this, def.icon);
      let sprite = this.carriedSprites[i];
      if (!sprite?.active) this.carriedSprites[i] = sprite = this.add.image(0, 0, texture).setScale(.65);
      if (sprite.texture.key !== texture) sprite.setTexture(texture);
      sprite.setVisible(true).setPosition(this.player.x + (this.player.dir === 'left' ? -1 : 1) * (7 + i * 9), this.player.y - 17 + i * 2).setDepth(this.player.y + 1 + i);
    });
  }

  /** Yellow "!" above a guest who is waiting to order. Depth follows that guest so a nearer person can still pass in front. */
  private syncOrderMarks() {
    if (this.zoneId !== 'restaurant') { this.clearOrderMarks(); return; }
    const live = new Set<string>();
    const now = performance.now() / 1000;
    for (const [id, g] of this.guests) {
      const spr = g.actor.sprite;
      if (g.phase !== 'waiting_order' || !spr.active || !spr.visible) continue;
      live.add(id);
      let mark = this.orderMarks.get(id);
      if (!mark?.active) {
        mark = this.add.image(0, 0, orderMarkTexture(this)).setOrigin(0.5, 1);
        this.orderMarks.set(id, mark);
      }
      const bob = Math.sin(now * 4 + spr.x) * 1.5;
      const top = spr.y - spr.displayHeight + this.headRow(spr) * Math.abs(spr.scaleY);
      mark.setPosition(Math.round(spr.x), Math.round(top - 1 + bob));
      mark.setDepth(Math.min(190000, spr.depth + 48)).setVisible(true);
    }
    for (const [id, mark] of this.orderMarks) {
      if (live.has(id)) continue;
      mark.destroy();
      this.orderMarks.delete(id);
    }
  }

  private headRows = new Map<string, number>();
  /** First row of the current frame that has any pixel: sprites carry empty space above short characters. */
  private headRow(spr: Phaser.GameObjects.Sprite): number {
    const f = spr.frame;
    const key = `${spr.texture.key}|${f.name}`;
    const hit = this.headRows.get(key);
    if (hit != null) return hit;
    let row = 0;
    try {
      const src = f.source.image as CanvasImageSource & { width: number; height: number };
      const c = document.createElement('canvas');
      c.width = f.cutWidth; c.height = f.cutHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      outer: for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 20) { row = y; break outer; }
    } catch { row = 0; }
    this.headRows.set(key, row);
    return row;
  }

  private hallFree(x: number, y: number): boolean {
    const zone = this.zoneId === 'restaurant' && this.zone ? this.zone : buildZone('restaurant');
    return x >= 0 && y >= 0 && x < zone.def.w && y < zone.def.h && !zone.grid.isSolid(x, y);
  }

  private takenSpots(exceptId?: string): Set<string> {
    const taken = new Set<string>();
    for (const v of this.visitors.values()) {
      if (v.id === exceptId || v.stage === 'departing') continue;
      for (const trip of v.trips) {
        const here = trip.destination.zone === 'restaurant' ? trip.destination : trip.position;
        if (here.zone === 'restaurant') taken.add(`${Math.round(here.x)},${Math.round(here.y)}`);
      }
    }
    return taken;
  }

  /** Reception first, then the side cluster, then any free hall tile that is not the door lane. */
  private partySpots(count: number, kind: 'reception' | 'wait', exceptId?: string, extra?: Set<string>): WaitTile[] {
    const blocked = this.takenSpots(exceptId);
    extra?.forEach((key) => blocked.add(key));
    const free = (x: number, y: number) => this.hallFree(x, y);
    if (kind === 'reception') {
      const door = planWaitSpots(count, blocked, free, RECEPTION_SPOTS);
      if (door.length >= count) return door;
    }
    const aside = planWaitSpots(count, blocked, free, WAITING_SPOTS);
    if (aside.length >= count) return aside;
    const scanned = scanWaitSpots(count, blocked, free);
    if (scanned.length >= count) return scanned;
    return planWaitSpots(count, blocked, free, [...WAITING_SPOTS, ...RECEPTION_SPOTS]);
  }

  private standBeside(x: number, y: number, avoid: Set<string>): { x: number; y: number } {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, -2]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (avoid.has(`${nx},${ny}`) || !this.hallFree(nx, ny)) continue;
      return { x: nx, y: ny };
    }
    return { x: 7, y: 10 };
  }

  private sendVisitorHome(v: { trips: Journey[]; origin: Position; stage: string }) {
    v.stage = 'departing';
    for (const trip of v.trips) trip.go(v.origin);
  }

  private sayVisitor(id: string, text: string) {
    this.sayLine('guest:' + id + ':0', text, 4, 'host:' + id);
  }

  /** Conversational bubbles share one queue. Sleep and meal poses stay on the actor. */
  private sayLine(speaker: string, text: string, seconds: number, exchange?: string, ambient = false): boolean {
    if (ambient && !this.roomForAmbient(speaker)) return false;
    return this.speech.say({ speaker, text, seconds, exchange }, ambient);
  }

  private roomForAmbient(speaker: string): boolean {
    return !this.conversation && !this.hostId && this.speech.roomFor(speaker);
  }

  private speakerActor(id: string): Actor | null {
    if (id.startsWith('guest:')) return this.guests.get(id.slice(6))?.actor ?? null;
    if (id.startsWith('nb:')) return this.neighborBodies.get(id.slice(3))?.actor ?? null;
    return this.npcs.get(id)?.actor ?? this.extras.get(id) ?? null;
  }

  private pumpSpeech(dt: number) {
    if (this.transitioning || this.decorMode || this.inputLocked) {
      this.stopSpeech();
      return;
    }
    if (clock.paused || this.mealBusy) return;
    const before = this.speech.activeSpeaker();
    const started = this.speech.tick(dt, (id) => !!this.speakerActor(id)?.sprite?.active);
    if (!started) {
      if (before && !this.speech.activeSpeaker()) this.releaseSpeechActor();
      return;
    }
    const actor = this.speakerActor(started.speaker);
    if (!actor?.sprite?.active) return;
    this.hushTalk(actor);
    // The queue dismisses the bubble. The extra second keeps Actor from fading it first.
    actor.emote(started.text, started.seconds + 1);
    this.speechActor = actor;
    const chat = this.conversation;
    if (chat && chat.exchange === started.exchange) {
      for (const n of [chat.a, chat.b]) {
        if (n.actor.id === started.speaker) n.actor.setAct(n.actor.seatLift ? 'sit' : 'talk');
        else if (n.actor.act === 'talk') n.actor.setAct(n.actor.seatLift ? 'sit' : (n.act ?? 'look'));
      }
    }
  }

  private stopSpeech() {
    const line = this.speech.current();
    this.speech.clear();
    const actor = this.speechActor;
    this.speechActor = null;
    if (actor?.sprite?.active && (!line || actor.bubble?.text === line.text)) actor.clearEmote();
  }

  private releaseSpeechActor() {
    const actor = this.speechActor;
    this.speechActor = null;
    if (actor?.sprite?.active) actor.clearEmote();
  }

  /** Word bubbles yield the floor. A nap or a bite can stay. */
  private hushTalk(except: Actor) {
    const flavor = new Set(['z', 'ñam', 'té', '*']);
    const actors: Actor[] = [
      ...[...this.npcs.values()].map((n) => n.actor),
      ...[...this.guests.values()].map((g) => g.actor),
      ...[...this.neighborBodies.values()].map((b) => b.actor),
      ...this.extras.values(),
    ];
    for (const actor of actors) {
      if (actor === except || !actor.bubble || !actor.sprite?.active) continue;
      if (flavor.has(actor.bubble.text)) continue;
      actor.clearEmote();
    }
  }

  private updateHost(dt: number) {
    const pip = this.town.residents.get('pip');
    if (!pip || pip.trip.position.zone !== 'restaurant' || pip.stop.zone !== 'restaurant' || typeof game.flag('at_pip') === 'string') return;
    const views = guestViews();
    const serving = this.hostId ? views.find((v) => v.id === this.hostId) : null;
    if (serving?.phase === 'walking') return;
    const party = views.find((v) => v.phase === 'reception' || v.phase === 'queued');
    if (!party) {
      this.hostId = null;
      this.town.duty('pip', null);
      return;
    }
    const visitor = this.visitors.get(party.id);
    if (!visitor) return;
    if (this.hostId !== party.id) {
      this.hostId = party.id;
      this.hostWait = 0;
      this.rememberResidents();
      const at = visitor.trips[0]?.destination;
      const stand = this.standBeside(Math.round(at?.x ?? 6), Math.round(at?.y ?? 10), this.takenSpots(party.id));
      this.town.duty('pip', { zone: 'restaurant', x: stand.x, y: stand.y, wander: 0, act: 'work' });
    }
    if (!pip.trip.settled) return;
    if (!visitor.greeted) {
      visitor.greeted = true;
      this.hostWait = 3.5 * hostSlowdown();
      practicePip();
      const exchange = 'host:' + party.id;
      this.sayLine('pip', party.size > 1 ? `¡Bienvenidos! ¿Mesa para ${party.size}?` : '¡Hola! Bienvenido a Midnight Maki.', 3.5, exchange);
      this.sayVisitor(party.id, party.size > 1 ? 'Sí, gracias. Venimos a comer juntos.' : '¡Hola! ¿Tenés una mesa libre?');
      return;
    }
    this.hostWait -= dt;
    if (this.hostWait > 0) return;
    const events = hostGuest(party.id);
    if (events.some((e) => e.type === 'queued')) {
      this.sayLine('pip', 'Esperá acá. Enseguida queda una mesa.', 4, 'host:' + party.id);
      this.hostWait = 3 * hostSlowdown();
    }
    if (events.some((e) => e.type === 'assigned')) {
      const seated = guestViews().find((g) => g.id === party.id)!;
      const seat = seated.seats[0];
      this.sayLine('pip', '¡Por acá! Esta es tu mesa.', 4, 'host:' + party.id);
      this.town.duty('pip', { zone: 'restaurant', x: seat.x - 1, y: seat.y, wander: 0, act: 'work' });
    }
  }

  /** Restaurant work ends when the door is closing. A long night ends later, after time to explore. */
  private watchBedtime() {
    if (this.bedtimeBusy || !this.player || !game.has('intro_done')) return;
    if (this.transitioning || this.inputLocked || this.decorMode || this.mealBusy || clock.paused) return;
    const t = game.save.time;
    const reason = bedtimeReason(t.period, t.minutes, currentQuestTarget(), (id) => this.characterZone(id));
    if (!reason) return;
    this.bedtimeBusy = true;
    void runTask('world:bedtime', async () => {
      try { await settleBedtime(reason); }
      finally { this.bedtimeBusy = false; }
    });
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

  /** A finished meal is part of the room: the guest says what they thought in a bubble and the coins show beside the counter. */
  private enqueueMeal(meal: PaidMeal) {
    this.mealReceipt(meal);
    // only real milestones (level up, new recipes, first time, gifts) still pause for a scene
    if (meal.result.levelUp || meal.result.newRecipes.length || meal.result.firstTime || meal.result.gift) { // levels pause for a scene; first-time and gifts are toasts
      this.mealQueue.push(meal);
      void runTask('world:paid-meal', () => this.drainMeals());
    }
  }

  private mealReceipt(meal: PaidMeal) {
    const owner = [...this.visitors.values()].find((v) => v.customers.includes(meal.customer));
    const body = owner ? this.guests.get(`${owner.id}:${owner.customers.indexOf(meal.customer)}`) : undefined;
    const a = body?.actor;
    if (!owner || !a?.sprite.active) return;
    this.sayLine(`guest:${owner.id}:${owner.customers.indexOf(meal.customer)}`, mealComment(meal.customer, meal.quality), 4.5);
    const total = meal.result.coins;
    if (total > 0) this.floatAt(a.x, a.y - 44, `+${total}`);
  }

  /** a small number near a spot of the world (the table), not on the player */
  floatAt(x: number, y: number, text: string, color = '#ffe08a') {
    const t = this.add.text(x, y, text, { fontFamily: 'Pixelify Sans, sans-serif', fontSize: '20px', color, stroke: '#2a2230', strokeThickness: 4, resolution: 2 }).setOrigin(0.5, 1).setScale(0.3).setDepth(300000);
    this.tweens.add({ targets: t, y: y - 16, alpha: { from: 1, to: 0 }, scale: 0.34, duration: 1500, delay: 200, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  private async drainMeals() {
    if (this.mealBusy) return;
    this.mealBusy = true;
    try {
      while (this.mealQueue.length) {
        const meal = this.mealQueue.shift()!;
        const { presentPaidMeals } = await import('../restaurant/kitchen');
        await presentPaidMeals([meal, ...this.mealQueue.splice(0)]);
      }
    } finally {
      this.mealBusy = false;
    }
  }

  /** The same visitors appear on the road, at reception, seated, and on the way home. */
  private syncGuests() {
    if (!this.zone || !game.has('intro_done')) { this.clearGuests(); return; }
    const live = new Set<string>();
    const views = guestViews();
    for (const v of this.visitors.values()) {
      const g = views.find((g) => g.id === v.id);
      const phase = g?.phase ?? 'outside';
      v.trips.forEach((trip, i) => {
        const p = trip.position;
        if (p.zone !== this.zoneId) return;
        const key = `${v.id}:${i}`;
        live.add(key);
        let body = this.guests.get(key);
        if (!body) {
          const who = v.customers[i] ?? v.customer;
          const nb = neighborOf(who);
          const actor = new Actor(this, who, nb ? lookTexture(this, nb.look) : customerTexture(this, customerLook(who)), p.x, p.y);
          actor.manual = true;
          body = { actor, phase };
          this.guests.set(key, body);
        }
        const a = body.actor;
        const sitting = SEATED_PHASES.includes(phase);
        const seat = g?.seats[i];
        const table = g?.tableId ? this.diningPieces().find((pc) => String(pc.uid) === g.tableId) : undefined;
        const feet = sitting && seat && table
          ? seatDrawOffset(seat, g?.seats ?? [], table)
          : standApart(i, v.trips.map((t) => ({ x: Math.round(t.position.x), y: Math.round(t.position.y) })));
        a.x = (sitting && seat ? seat.x : p.x) * TILE + TILE / 2 + feet.dx;
        a.y = (sitting && seat ? seat.y : p.y) * TILE + TILE - 2 - (sitting ? 3 : 0) + feet.dy;
        a.moving = trip.moving && !sitting;
        a.depthBoost = 0;
        // across the table: front or back view; at its ends: profile (see restaurant/seating.ts)
        a.dir = sitting && seat ? (table ? facingTable(seat, table) : 'down') : trip.dir;
        // facing down = the chair back is behind them: sit in front of it, not behind it
        if (sitting && a.dir === 'down') a.depthBoost = 7;
        const fed = g?.members[i]?.items.some(item => item.kind === 'food' && item.quality !== null);
        const act = sitting ? (fed || phase === 'eating' || phase === 'paying' ? 'eat' : 'sit') : 'idle';
        if (a.act !== act) a.setAct(act);
        body.phase = phase;
        a.sync();
      });
    }
    for (const [key, body] of this.guests) {
      if (live.has(key)) continue;
      this.speech.dropSpeaker('guest:' + key);
      if (this.speechActor === body.actor) this.speechActor = null;
      body.actor.destroy(); this.guests.delete(key);
    }
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
    const zone = this.zone;
    void runTask('world:bugs', () => import('../systems/collect').then(({ bugsFor }) => {
      if (!this.sys.isActive() || this.zone !== zone) return;
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
    }));
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
  private rememberResidents() {
    for (const [id, n] of this.npcs) {
      if (n.traveling) continue;
      this.town.residents.get(id)?.trip.remember((n.actor.x - TILE / 2) / TILE, (n.actor.y - TILE + 2) / TILE);
    }
  }

  private tickTown(dt: number) {
    if (this.transitioning || this.inputLocked || this.decorMode || clock.paused || this.mealBusy) return;
    if (this.townSave !== game.save || this.townDay !== clock.day) {
      if (this.townSave !== game.save) resetService();
      this.visitors.clear(); this.restoredDining = false; this.clearGuests(); this.endConversation(); this.stopSpeech();
      this.chatSequence.clear(); this.chatCooldown.clear(); this.chatIn = 8;
      this.hostId = null; this.visitorIn = 4;
      this.diningCache = null;
      this.townSave = game.save; this.townDay = clock.day;
      this.town.sync(); this.spawnNpcs(false);
    }
    this.rememberResidents();
    this.town.setHeld([...this.npcs.entries()].filter(([, n]) => n.social || n.t >= 80).map(([id]) => id));
    this.town.setOccupied([
      { zone: this.zoneId, x: this.player.tx, y: this.player.ty },
      ...[...this.visitors.values()].flatMap(v => v.trips.map(t => ({ zone: t.position.zone, x: Math.round(t.position.x), y: Math.round(t.position.y) }))),
    ]);
    this.town.tick(dt);
    const members = this.town.inZone(this.zoneId).map((r) => r.id + ':' + r.trip.settled).join('|');
    if (members !== this.townMembers) {
      this.townMembers = members;
      this.spawnNpcs(false);
    }
  }

  spawnNpcs(_animate: boolean) {
    this.rememberResidents();
    this.town.sync();
    const present = this.town.inZone(this.zoneId);
    const keep = new Set(present.map((p) => p.id));
    for (const [id, n] of this.npcs) {
      if (keep.has(id)) continue;
      n.actor.destroy(); this.npcs.delete(id);
    }
    for (const id of [...this.npcWait]) if (!keep.has(id)) this.npcWait.delete(id);
    for (const resident of present) this.attachNpc(resident);
  }

  /** Creates a villager when their sheet is ready. A cold sheet waits for the next frame so the door does not paint everyone at once. */
  private attachNpc(resident: TownResident) {
    const { id, stop, trip } = resident;
    const p = trip.position;
    let n = this.npcs.get(id);
    if (!n) {
      if (!hasCharTexture(this, id)) { this.npcWait.add(id); return; }
      this.npcWait.delete(id);
      const actor = new Actor(this, id, charTexture(this, id), p.x, p.y);
      actor.speed = (CHAR_BY_ID[id]?.raccoon ? 46 : 40) * pace(id);
      n = { actor, anchor: [stop.x, stop.y], wander: stop.wander ?? 0, act: stop.act, t: 2 + Math.random() * 4 };
      this.npcs.set(id, n);
      if (stop.act) actor.setAct(stop.act);
    }
    const wasTraveling = n.traveling;
    n.traveling = !trip.settled;
    if (n.out && (n.anchor[0] !== stop.x || n.anchor[1] !== stop.y || n.traveling)) n.out = false; // a new part of the day ends the outing
    n.anchor = [stop.x, stop.y]; n.wander = stop.wander ?? 0; n.act = stop.act;
    if (!n.out) n.actor.seatLift = n.traveling ? 0 : stop.seatLift ?? 0;
    n.actor.bed = !n.traveling && stop.act === 'sleep' ? stop.bed ?? null : null;
    if (!n.traveling && stop.dir && !n.social && !n.out) n.actor.face(stop.dir);
    if (n.traveling) { n.actor.stop(); n.actor.setAct('idle'); }
    else if (wasTraveling) {
      n.actor.x = p.x * TILE + TILE / 2;
      n.actor.y = p.y * TILE + TILE - 2;
      n.actor.moving = false;
      n.actor.setAct(stop.act ?? 'idle');
    }
  }

  private flushNpcWait() {
    if (!this.npcWait.size || this.transitioning) return;
    const id = this.npcWait.values().next().value;
    if (!id) return;
    charTexture(this, id);
    const resident = this.town.inZone(this.zoneId).find((r) => r.id === id);
    if (!resident) { this.npcWait.delete(id); return; }
    this.attachNpc(resident);
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

  npc(id: string): Actor | undefined {
    return this.npcs.get(id)?.actor ?? this.extras.get(id);
  }

  /** Map and quest guides follow the person during a trip, including intermediate maps. */
  characterZone(id: string): string | null {
    const resident = this.town.residents.get(id);
    return resident ? (resident.visible || !resident.trip.settled ? resident.trip.position.zone : null) : stopFor(id, clock.period)?.zone ?? null;
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
    if (st) {
      st.t = 9999; // pause wandering and journeys while scripted
      st.traveling = false;
      this.town.residents.get(id)?.trip.place({ zone: this.zoneId, x: (a.x - 8) / TILE, y: (a.y - 14) / TILE });
    }
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
    return !this.transitioning && this.inputLocked === 0 && !clock.paused && !this.decorMode && !this.cookActive;
  }

  private releaseSteer = () => {
    this.joy = { x: 0, y: 0 };
    this.pointerSteer = false;
  };

  private stickHeld(): boolean {
    const k = this.keys;
    const key = !!k && (k.A.isDown || k.D.isDown || k.W.isDown || k.S.isDown || k.LEFT.isDown || k.RIGHT.isDown || k.UP.isDown || k.DOWN.isDown);
    return key || Math.hypot(this.joy.x, this.joy.y) > 0.15;
  }

  private tapWorld(wx: number, wy: number) {
    // The click chooses the destination even if a key or the stick is still down.
    this.joy = { x: 0, y: 0 };
    this.pointerSteer = true;
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

  /** Space: the side action when one is showing, otherwise the main action. */
  tryAlternate() {
    if (this.contextOffer.chip) this.perform(this.contextOffer.chip);
    else this.tryInteract();
  }

  /** F: the side action, or the first extra action, and nothing when the player is alone. */
  trySecondary() {
    const offer = this.contextOffer;
    if (needsMore(offer)) { void import('../ui/hud').then((m) => m.toggleMoreMenu()); return; }
    const alt = offer.chip;
    if (alt) this.perform(alt);
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
      void runTask('world:gift', () => this.offerGift(intent.npcId));
      return;
    }
    if (intent.type === 'tray') { void runTask('world:tray', () => import('../restaurant/tray').then(m => m.openTray())); return; }
    if (intent.type === 'company') { openCompany(this, intent.npcId); return; }
    if (intent.type === 'decorate') {
      void runTask('world:decorate', () => import('../decoration/editor').then((m) => m.startDecor()));
      return;
    }
    if (intent.type === 'takeOrder') {
      this.showTakingNotes(intent.tableId);
      this.note(takeOrderAt(intent.tableId));
      this.syncGuests();
      this.contextKey = '';
      return;
    }
    if (intent.type === 'cookOrder') {
      void runTask('world:cook', () => import('../restaurant/kitchen').then((m) => m.cookOrder(intent.uid)));
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
    void runTask('world:orders', () => import('../restaurant/kitchen').then((m) => m.openOrders()));
  }

  private note(text: string) {
    void runTask('world:notice', () => import('../ui/dom').then(({ toast }) => toast(text)), false);
  }

  /** A short look-down while the order is written. Walking cancels it. */
  private showTakingNotes(tableId: string) {
    const table = this.zone?.furniture.find((fi) => String(fi.f.uid) === tableId);
    if (table) {
      const size = furnSize(table.def, table.f.rot);
      this.player.faceTowards(table.f.x * TILE + (size.w * TILE) / 2, table.f.y * TILE + (size.h * TILE) / 2);
    }
    if (this.player.dir === 'up') this.player.face('down');
    this.player.setAct('read');
    this.notingUntil = performance.now() + 900;
  }

  private async offerGift(id: string) {
    const { giftMenu } = await import('../dialogue/talk');
    await giftMenu(id);
  }

  /** The same for an ambient neighbour. */
  neighborSituation(id: string): { act?: import('../data/characters').NpcAct | 'ride' | 'walk'; place?: string; zone: string; others: { name: string; what: string }[] } {
    const st = this.neighborLife.state.get(id);
    const others = [...this.neighborLife.state.values()].filter((s) => s.n.id !== id && s.place.kind !== 'home' && s.trip.settled).slice(0, 4)
      .map((s) => ({ name: s.n.name, what: whatPlace(s.ride ? 'ride' : s.place.kind) }));
    if (!st) return { zone: this.zoneId, others };
    const kind = st.place.kind;
    const act = st.ride && st.trip.moving ? 'ride' : st.trip.moving ? 'walk' : st.place.act === 'look' ? undefined : st.place.act;
    return { act, place: kind === 'sea' || kind === 'fountain' || kind === 'bench' || kind === 'garden' || kind === 'forest' || kind === 'market' || kind === 'read' || kind === 'stroll' ? kind : undefined, zone: st.place.zone, others };
  }

  /** What a story character is doing and seeing right now, and what some neighbours are up to (for conversation topics). */
  talkSituation(id: string): { act?: import('../data/characters').NpcAct | 'ride' | 'walk'; place?: string; zone: string; others: { name: string; what: string }[] } {
    const n = this.npcs.get(id), a = n?.actor.act;
    const act = a && a !== 'idle' ? (a as import('../data/characters').NpcAct) : n?.actor.moving ? 'walk' : undefined;
    const zone = this.zoneId;
    const place = zone === 'library' ? 'read' : zone === 'beach' ? 'sea' : ['garden', 'forest', 'market'].includes(zone) ? zone
      : zone === 'plaza' && n && Math.hypot(n.actor.tx - 15, n.actor.ty - 12) < 8 ? 'fountain' : zone === 'plaza' ? 'stroll' : undefined;
    const others = [...this.neighborLife.state.values()].filter((s) => s.place.kind !== 'home' && s.trip.settled).slice(0, 4)
      .map((s) => ({ name: s.n.name, what: whatPlace(s.ride ? 'ride' : s.place.kind) }));
    return { act, place, zone, others };
  }

  private greetNeighbor(id: string) {
    const b = this.neighborBodies.get(id);
    if (!b) return;
    b.actor.faceTowards(this.player.x, this.player.y); this.player.faceTowards(b.actor.x, b.actor.y);
    b.actor.clearEmote();
    if (this.speechActor === b.actor) { this.speech.dropSpeaker('nb:' + id); this.speechActor = null; }
    b.barkAt = performance.now() + 30000;
  }

  private greet(id: string) {
    const a = this.npc(id);
    if (!a) return;
    if (this.conversation && [this.conversation.a.actor.id, this.conversation.b.actor.id].includes(id)) this.endConversation();
    a.faceTowards(this.player.x, this.player.y);
    this.player.faceTowards(a.x, a.y);
    const st = this.npcs.get(id);
    if (!st) return;
    st.actor.stop(); st.actor.clearEmote();
    if (this.speechActor === st.actor) { this.speech.dropSpeaker(id); this.speechActor = null; }
    st.t = 6;
    if (st.actor.act === 'sleep') st.actor.setAct('idle');
  }

  canKeepCompany(id: string): boolean {
    const n = this.npcs.get(id), scripted = game.flag('at_' + id);
    return !!(this.canAct() && game.has('intro_done') && CHAR_BY_ID[id]?.raccoon && n &&
      !n.traveling && !n.actor.path.length && n.t < 80 && !(id === 'pip' && this.hostId) &&
      !(typeof scripted === 'string' && scripted) && Math.hypot(n.actor.x - this.player.x, n.actor.y - this.player.y) < 48);
  }

  async keepCompany(id: string, kind: CompanyActivity): Promise<boolean> {
    if (!this.canKeepCompany(id)) return false;
    const n = this.npcs.get(id)!, zone = this.zone, player = this.player;
    this.greet(id); this.rememberResidents();
    this.inputLocked++; clock.pause(); n.social = true;
    try {
      if (kind === 'sit') {
        const ax = n.actor.tx, ay = n.actor.ty;
        const spots = [[this.player.tx, this.player.ty], [ax - 3, ay], [ax + 3, ay], [ax - 2, ay], [ax + 2, ay], [ax, ay + 2], [ax, ay - 2]];
        const tile = spots.find(([x, y]) => Math.hypot(x - ax, y - ay) >= 2 && Math.abs(x - ax) + Math.abs(y - ay) <= 3 &&
          !zone.grid.isSolid(x, y) && !zone.def.doors.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1) &&
          !zone.def.interact.some(i => i.x === x && i.y === y) &&
          !(this.zoneId === 'restaurant' && [8, 9].includes(x) && y >= 10) &&
          ![...this.npcs.values()].some(other => other !== n && Math.hypot(other.actor.tx - x, other.actor.ty - y) < 2) &&
          ![...this.guests.values()].some(g => Math.hypot(g.actor.tx - x, g.actor.ty - y) < 2) &&
          (zone.grid.path(this.player.tx, this.player.ty, x, y)?.length ?? Infinity) <= 10);
        if (!tile) { this.note('Busquemos un rincón con un poquito más de espacio.'); return false; }
        const arrived = await new Promise<boolean>(resolve => {
          let done = false;
          const cancel = () => finish(false);
          const finish = (ok: boolean) => {
            if (done) return; done = true; timer.remove(); this.events.off('shutdown', cancel); resolve(ok);
          };
          const timer = this.time.delayedCall(4000, () => { this.player.stop(); finish(false); });
          this.events.once('shutdown', cancel);
          if (!this.player.walkTo(zone.grid, tile[0], tile[1], () => finish(true))) finish(false);
        });
        if (!arrived || this.zone !== zone || !n.actor.sprite.active) return false;
        this.player.faceTowards(n.actor.x, n.actor.y); this.player.setAct('sit');
      }
      n.actor.setAct(kind === 'sit' ? 'sit' : 'happy');
      return await companyScene(id, kind);
    } finally {
      if (player.sprite.active) { player.stop(); player.setAct('idle'); }
      if (this.npcs.get(id) === n && n.actor.sprite.active) {
        n.social = false; n.actor.setAct(n.act ?? 'idle'); n.t = 0;
      }
      this.inputLocked = Math.max(0, this.inputLocked - 1); clock.resume();
      if (this.sys.isActive()) {
        this.town.setHeld([...this.npcs.entries()].filter(([, other]) => other.social || other.t >= 80).map(([otherId]) => otherId));
        this.town.sync(); this.spawnNpcs(false); this.contextKey = '';
      }
    }
  }

  private doInteract(t: Target) {
    if (!this.canAct()) return;
    this.player.stop();
    if (t.kind === 'npc') this.greet(t.id);
    if (t.kind === 'neighbor') this.greetNeighbor(t.id);
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
        company: this.canKeepCompany(id),
      })),
      neighbors: [...this.neighborBodies.entries()].filter(([, b]) => b.actor.sprite.visible).map(([id, b]) => ({ id, name: NEIGHBOR_BY_ID[id]?.name ?? id, x: b.actor.x, y: b.actor.y - 4 })),
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
      furniture: this.zone.furniture.map((fi) => {
        const size = furnSize(fi.def, fi.f.rot);
        return {
          uid: fi.f.uid,
          id: fi.f.id,
          kind: fi.def.kind,
          name: fi.def.name,
          room: fi.room,
          x: fi.f.x,
          y: fi.f.y,
          w: size.w,
          h: size.h,
          sit: fi.def.sit,
        };
      }),
      blocked: (x: number, y: number) => this.zone.grid.isSolid(x, y),
      guests: this.zoneId === 'restaurant' ? this.senseGuests() : [],
    };
  }

  private senseGuests(): { tableId: string; x: number; y: number }[] {
    const views = guestViews();
    const out: { tableId: string; x: number; y: number }[] = [];
    for (const [key, body] of this.guests) {
      const cut = key.lastIndexOf(':');
      const partyId = cut < 0 ? key : key.slice(0, cut);
      const view = views.find((g) => g.id === partyId);
      if (!view?.tableId) continue;
      out.push({ tableId: view.tableId, x: body.actor.x, y: body.actor.y - 4 });
    }
    return out;
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
    this.watchBedtime();
    this.pollHours(dt);
    this.updatePlayer(dt);
    this.tickTown(dt);
    this.updateConversation(dt);
    for (const [, n] of this.npcs) this.updateNpc(n, dt);
    for (const e of this.extras.values()) e.update(dt);
    this.pumpFloor(dt);
    this.updateStaff(dt);
    this.updateNeighbors(dt);
    for (const g of this.guests.values()) g.actor.update(clock.paused || this.inputLocked || this.transitioning || this.decorMode ? 0 : dt);
    this.updateCritters(dt);
    this.updateBugs(dt);
    this.updateWater(dt);
    this.waterFx?.update(dt, this.waterEnv());
    this.updateLighting();
    this.updateAtmosphere(dt);
    this.updateOccluders(dt);
    this.updateQuestMarker(dt);
    this.updateServiceArt();
    this.flushNpcWait();
    this.dust(dt);
    this.quirks(dt);
    this.updateGuide(dt);
    this.syncLife(dt);
    this.refreshContext();
    this.pumpSpeech(dt);
    this.layoutBubbles();
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
    if (!this.stickHeld()) this.pointerSteer = false;
    if (!this.pointerSteer && this.canAct() && !isTypingTarget(document.activeElement)) {
      const k = this.keys;
      if (k.A.isDown || k.LEFT.isDown) vx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown) vy -= 1;
      if (k.S.isDown || k.DOWN.isDown) vy += 1;
      vx += this.joy.x;
      vy += this.joy.y;
    }
    const stick = normalizeStick(vx, vy);
    if (stick.x !== 0 || stick.y !== 0) {
      p.path = [];
      p.onArrive = null;
      const sp = p.speed * dt;
      this.moveWithCollision(stick.x * sp, 0);
      this.moveWithCollision(0, stick.y * sp);
      if (Math.abs(stick.x) > Math.abs(stick.y)) p.dir = stick.x > 0 ? 'right' : 'left';
      else p.dir = stick.y > 0 ? 'down' : 'up';
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
    if (this.cookProp) this.cookProp.setPosition(p.x, p.y - 34);
    if (this.notingUntil && (p.moving || performance.now() >= this.notingUntil)) {
      this.notingUntil = 0;
      if (p.act === 'read') p.setAct('idle');
    }
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
    // a guest sitting at a table is meant to be partly behind it: only walking guests make furniture see-through
    for (const b of this.staffBodies.values()) if (b.actor.sprite.visible) actors.push(b.actor);
    for (const b of this.neighborBodies.values()) if (b.actor.sprite.visible) actors.push(b.actor);
    for (const g of this.guests.values()) if (g.actor.sprite.visible && !SEATED_PHASES.includes(g.phase)) actors.push(g.actor);

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
      const resident = this.town.residents.get(target.npc);
      const zone = this.characterZone(target.npc);
      const stop = zone ? resident?.trip.position ?? stopFor(target.npc, clock.period) : null;
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
  private blockDoor(dir: Dir, text: string) {
    if (performance.now() - this.lastDoorMsg > 2500) {
      this.lastDoorMsg = performance.now();
      bus.emit('toast', { text });
    }
    const back: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
    const [bx, by] = back[dir];
    const p = this.player;
    p.stop();
    p.teleport(p.tx + bx, p.ty + by);
  }

  private checkWalkDoor() {
    if (this.transitioning || this.inputLocked) return;
    const p = this.player;
    const d = this.zone.def.doors.find((dd) => dd.walk && dd.x === p.tx && dd.y === p.ty);
    if (!d) return;
    if (d.lock && !game.has(d.lock.flag) && !this.lockHook(d.to)) {
      this.blockDoor(d.dir, d.lock.msg);
      return;
    }
    const closed = closedLocalNotice(d.to);
    if (closed) {
      this.blockDoor(d.dir, closed);
      return;
    }
    audio.sfxPlay('door');
    if (d.to.startsWith('shop_') || (this.zoneId.startsWith('shop_') && d.to === 'plaza')) audio.sfxPlay('bell');
    p.stop();
    void runTask('world:walk-door', () => this.enterZone(d.to, d.tx, d.ty, d.dir));
  }

  private updateNpc(n: NpcState, dt: number) {
    const a = n.actor;
    if (clock.paused && n.t < 80 || this.transitioning || this.decorMode) { a.update(0); return; }
    const trip = this.town.residents.get(a.id)?.trip;
    n.traveling = !!trip && !trip.settled;
    if (trip && !trip.settled && n.t < 80 && !this.inputLocked) {
      const p = trip.position;
      a.stop(); a.manual = true; a.moving = trip.moving; a.dir = trip.dir;
      a.x = p.x * TILE + TILE / 2; a.y = p.y * TILE + TILE - 2;
      a.update(clock.paused ? 0 : dt);
      return;
    }
    a.manual = false;
    a.update(clock.paused && n.t < 80 ? 0 : dt);
    if (clock.paused || this.transitioning || this.decorMode || n.social || (a.id === 'pip' && this.hostId)) return;
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
    // something to say about what they are doing or seeing, for whoever walks by
    if (a.act !== 'sleep' && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 64 && now > (n.barkAt ?? 0) && this.roomForAmbient(a.id)) {
      const said = this.sayLine(a.id, topicLine(Math.random() < 0.7 ? 'doing' : 'how', this.npcTalkCtx(n)).t.replace('{name}', game.save.player.name), 4.5, undefined, true);
      if (said) n.barkAt = now + 28000 + Math.random() * 22000;
    }
    n.t -= dt;
    if (n.t > 0) return;
    // back from a small gesture
    if (n.micro) { n.micro = false; a.setAct(n.act ?? 'idle'); n.t = 4 + Math.random() * 5; return; }
    // sitting, sleeping, cooking and the other held poses stay as they are
    if (held) {
      if (n.act && a.act !== n.act) a.setAct(n.act);
      n.t = 5 + Math.random() * 4;
      return;
    }
    // a small gesture of their own: a sip of tea, a look at the sky, the rain...
    const gesture = n.leaving ? null : microFor(a.id, { act: n.act as never, period: clock.period, rain: game.flag('weather') === 'rain', outdoor: !!this.zone.def.outdoor }, Math.random(), Math.random());
    if (gesture) {
      n.micro = true; a.setAct(gesture.act as Act); n.t = gesture.seconds;
      if (gesture.say) this.sayLine(a.id, gesture.say, Math.min(3.5, gesture.seconds), undefined, true);
      return;
    }
    if (n.act === 'talk') { a.setAct('look'); n.t = 4; return; }
    n.t = 7 + Math.random() * 8;
    const [ax, ay] = n.anchor;
    // an outing: they walk a good distance to somewhere with a reason (the fountain, a bench, a shop window, the shore),
    // stay a while doing what fits the place, and come back
    if (n.out) {
      n.out = false; a.seatLift = 0; a.setAct('idle');
      n.t = 4 + Math.random() * 4;
      this.walkNpc(n, ax, ay);
      return;
    }
    if (this.zone.def.outdoor && !n.social && Math.random() < 0.4 && (n.wander >= 2 || !n.act || n.act === 'look' || n.act === 'play')) {
      const spot = this.outingSpot(n);
      if (spot) {
        n.out = true; a.setAct('idle');
        const pose = () => {
          if (!n.out) return;
          a.seatLift = spot.seatLift ?? 0;
          a.setAct(spot.act ?? 'look');
          if (spot.dir) a.face(spot.dir);
        };
        if (a.walkTo(this.zone.grid, spot.x, spot.y, pose)) { n.t = 16 + Math.random() * 12; return; }
        n.out = false;
      }
    }
    // outdoors even those who "stay put" take a few steps around their spot
    const reach = n.wander || (this.zone.def.outdoor && (!n.act || n.act === 'work' || n.act === 'look') ? 2 : 0);
    if (reach > 0 && Math.random() < 0.72) {
      for (let k = 0; k < 8; k++) {
        const tx = ax + Math.round((Math.random() * 2 - 1) * reach);
        const ty = ay + Math.round((Math.random() * 2 - 1) * reach);
        if (n.last && tx === n.last[0] && ty === n.last[1]) continue;
        if (this.feetBlocked(tx, ty, a.id, true)) continue;
        n.last = [a.tx, a.ty];
        a.setAct('idle');
        if (a.walkTo(this.zone.grid, tx, ty, () => n.act && n.act !== 'sleep' && a.setAct(n.act))) return;
      }
    }
    const [hx, hy] = this.standTile(ax, ay, a.id);
    if (a.tx !== hx || a.ty !== hy) {
      this.walkNpc(n, hx, hy);
      return;
    }
    if (n.act && a.act !== n.act) a.setAct(n.act);
    else if (!(this.zone.def.outdoor && this.nearbyFace(a)) && Math.random() < 0.4) a.face((['up', 'down', 'left', 'right'] as const)[Math.floor(Math.random() * 4)]);
  }

  /** A doorway, or a tile someone is already using. The player only counts when choosing a wander step. */
  private feetBlocked(tx: number, ty: number, self: string, avoidPlayer: boolean): boolean {
    if (this.zone.grid.isSolid(tx, ty)) return true;
    if (this.zone.def.doors.some((d) => Math.abs(d.x - tx) + Math.abs(d.y - ty) <= 1)) return true;
    if (avoidPlayer && this.player && tx === this.player.tx && ty === this.player.ty) return true;
    for (const [id, n] of this.npcs) if (id !== self && n.actor.tx === tx && n.actor.ty === ty) return true;
    for (const b of this.neighborBodies.values()) if (b.actor.tx === tx && b.actor.ty === ty) return true;
    return false;
  }

  private standTile(tx: number, ty: number, self: string): [number, number] {
    if (!this.feetBlocked(tx, ty, self, false)) return [tx, ty];
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (!this.feetBlocked(x, y, self, false)) return [x, y];
      }
    }
    return [tx, ty];
  }

  private nearbyFace(a: Actor): boolean {
    let x = 0;
    let y = 0;
    let best = 72;
    const consider = (id: string, px: number, py: number) => {
      if (id === a.id) return;
      const d = Math.hypot(px - a.x, py - a.y);
      if (d > 8 && d < best) { best = d; x = px; y = py; }
    };
    for (const [id, n] of this.npcs) consider(id, n.actor.x, n.actor.y);
    for (const [id, b] of this.neighborBodies) consider(id, b.actor.x, b.actor.y);
    if (best >= 72) return false;
    a.faceTowards(x, y);
    return true;
  }

  private outingPools = new Map<string, Place[]>();
  /** A place worth walking to in this map, far enough from where they usually stand. */
  private outingSpot(n: NpcState): Place | null {
    const zone = this.zoneId;
    let pool = this.outingPools.get(zone);
    if (!pool) {
      pool = [...fountainSpots(zone), ...benchSpots(zone), ...shoreSpots(zone), ...clearings(zone, 'stroll', 10)];
      // shop windows: stand beside the street door and look in, not on the mat
      const street: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
      const onMat = (x: number, y: number) => this.zone.def.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
      for (const d of this.zone.def.doors) if (d.to.startsWith('shop_') || d.to === 'library') {
        const [sx, sy] = street[d.dir];
        const side: [number, number][] = sx === 0
          ? [[-1, sy], [1, sy], [-2, sy], [2, sy], [0, sy * 2]]
          : [[sx, -1], [sx, 1], [sx, -2], [sx, 2], [sx * 2, 0]];
        for (const [dx, dy] of side) {
          const x = d.x + dx;
          const y = d.y + dy;
          if (onMat(x, y) || this.zone.grid.isSolid(x, y)) continue;
          pool.push({ zone, x, y, act: 'look', dir: d.dir, kind: 'window' });
          break;
        }
      }
      pool = pool.filter((p) => !onMat(p.x, p.y));
      this.outingPools.set(zone, pool);
    }
    const [ax, ay] = n.anchor, a = n.actor;
    const onMat = (x: number, y: number) => this.zone.def.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
    const far = pool.filter((p) => Math.hypot(p.x - ax, p.y - ay) >= 5 && Math.hypot(p.x - a.tx, p.y - a.ty) >= 4 && Math.hypot(p.x - a.tx, p.y - a.ty) <= 28
      && !this.zone.grid.isSolid(p.x, p.y) && !onMat(p.x, p.y) && !(p.x === this.player.tx && p.y === this.player.ty)
      && ![...this.npcs.values()].some((o) => o !== n && o.out && Math.abs(o.actor.tx - p.x) + Math.abs(o.actor.ty - p.y) < 1));
    return far.length ? far[Math.floor(Math.random() * far.length)] : null;
  }

  /** Surroundings of a story character for the lines they say to whoever passes by. */
  private npcTalkCtx(n: NpcState): TalkCtx {
    const t = game.save.time, zone = this.zoneId;
    const place = zone === 'library' ? 'read' : zone === 'beach' ? 'sea' : ['garden', 'forest', 'market'].includes(zone) ? zone
      : zone === 'plaza' && Math.hypot(n.actor.tx - 15, n.actor.ty - 12) < 8 ? 'fountain' : zone === 'plaza' ? 'stroll' : undefined;
    return {
      id: n.actor.id, act: n.act && n.act !== 'idle' && !['happy', 'surprised', 'wave'].includes(n.act) ? (n.act as never) : n.actor.moving ? 'walk' : undefined, place, zone,
      period: t.period, rain: game.flag('weather') === 'rain', festival: !!game.flag('festival_today'),
      open: restaurantPhase(t.period, t.minutes) === 'open', guests: guestViews().length,
      level: game.save.restaurant.level, reputation: game.save.restaurant.reputation, friend: game.friendLevel(n.actor.id), day: t.day,
    };
  }

  private conversation: { a: NpcState; b: NpcState; lines: AmbientLine[]; wait: number; approach: number; exchange: string; queued: boolean } | null = null;
  private chatIn = 8;
  private chatSequence = new Map<string, number>();
  private chatCooldown = new Map<string, number>();

  private endConversation() {
    const c = this.conversation;
    if (!c) return;
    const droppedActive = this.speech.current()?.exchange === c.exchange;
    this.speech.dropExchange(c.exchange);
    for (const n of [c.a, c.b]) {
      n.social = false;
      if (this.npcs.get(n.actor.id) !== n) continue;
      n.actor.stop(); n.actor.setAct(n.act ?? 'idle'); n.t = 5;
      const ownsBubble = this.speechActor === n.actor;
      if (!ownsBubble || droppedActive) n.actor.clearEmote();
      if (ownsBubble && droppedActive) this.speechActor = null;
    }
    this.conversation = null;
  }

  private layoutBubbles() {
    const actors = [this.player, ...[...this.npcs.values()].map(n => n.actor), ...this.extras.values(), ...[...this.guests.values()].map(g => g.actor)];
    const bubbles = actors.map(a => a?.bubble).filter((b): b is Phaser.GameObjects.Text => !!b?.active && b.visible);
    if (bubbles.length < 2) return;
    const rects = bubbles.map(b => ({ x: b.x - b.displayWidth / 2, y: b.y - b.displayHeight, width: b.displayWidth, height: b.displayHeight }));
    const view = this.cameras.main.worldView;
    layoutSpeech(rects, view).forEach((r, i) => bubbles[i].setPosition(r.x + r.width / 2, r.y + r.height));
  }

  /** One nearby pair takes turns, facing each other. Pauses with the game. */
  private updateConversation(dt: number) {
    if (this.transitioning || this.inputLocked || this.decorMode || clock.paused || this.mealBusy) return;
    for (const [id, left] of this.chatCooldown) this.chatCooldown.set(id, Math.max(0, left - dt));
    const c = this.conversation;
    if (c) {
      if ([c.a, c.b].some((n) => this.npcs.get(n.actor.id) !== n || n.traveling || n.t > 80 || n.actor.id === 'pip' && this.hostId)) {
        this.endConversation(); return;
      }
      if (c.a.actor.path.length) {
        c.approach -= dt;
        if (c.approach <= 0) this.endConversation();
        return;
      }
      c.a.actor.faceTowards(c.b.actor.x, c.b.actor.y);
      c.b.actor.faceTowards(c.a.actor.x, c.a.actor.y);
      if (!c.queued) {
        c.wait -= dt;
        if (c.wait > 0) return;
        for (const line of c.lines) this.sayLine(line.speaker, line.text, 4.3, c.exchange);
        c.queued = true;
        return;
      }
      if (this.speech.holds(c.exchange)) return;
      this.endConversation();
      return;
    }
    this.chatIn -= dt;
    if (this.chatIn > 0) return;
    this.chatIn = 12 + Math.random() * 8;
    const neighbors = [...this.npcs.values()].filter((n) => !n.traveling && n.t < 80 && !n.actor.path.length && !n.actor.bubble &&
      !['sleep', 'eat', 'drink', 'fish', 'stars'].includes(n.act ?? '') &&
      (n.act !== 'cook' || CHAR_BY_ID[n.actor.id]?.raccoon && game.save.quests.done.includes('prologue')) &&
      !(n.actor.id === 'pip' && this.hostId) && !(this.chatCooldown.get(n.actor.id) ?? 0) &&
      !this.zoneId.startsWith('shop_'));
    const pairs: [NpcState, NpcState][] = [];
    for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) {
      const a = neighbors[i], b = neighbors[j];
      if (Math.hypot(a.actor.x - b.actor.x, a.actor.y - b.actor.y) <= 80) pairs.push([a, b]);
    }
    if (!pairs.length) return;
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    const nearby = [[b.actor.tx - 1, b.actor.ty], [b.actor.tx + 1, b.actor.ty], [b.actor.tx, b.actor.ty + 1], [b.actor.tx, b.actor.ty - 1]]
      .filter(([x, y]) => !this.zone.grid.isSolid(x, y) && (x !== this.player.tx || y !== this.player.ty))
      .sort((p, q) => Math.abs(p[0] - a.actor.tx) + Math.abs(p[1] - a.actor.ty) - Math.abs(q[0] - a.actor.tx) - Math.abs(q[1] - a.actor.ty));
    const spot = nearby.find(([x, y]) => this.zone.grid.path(a.actor.tx, a.actor.ty, x, y) !== null);
    if (!spot) return;
    const key = [a.actor.id, b.actor.id].sort().join(':');
    const sequence = this.chatSequence.get(key) ?? 0;
    const lines = ambientExchange(a.actor.id, b.actor.id, { zone: this.zoneId, period: clock.period, rain: game.flag('weather') === 'rain', festival: !!game.flag('festival_today') }, sequence);
    if (!lines.length) return;
    this.chatSequence.set(key, sequence + 1);
    this.chatCooldown.set(a.actor.id, 55); this.chatCooldown.set(b.actor.id, 55);
    a.social = true; b.social = true;
    b.actor.stop();
    if (!a.actor.seatLift) { a.actor.setAct('idle'); a.actor.walkTo(this.zone.grid, spot[0], spot[1]); }
    this.conversation = { a, b, lines, wait: 0.5, approach: 8, exchange: 'chat:' + key + ':' + sequence, queued: false };
  }

  private npcStamp() {
    const roles = ['pip', 'spicy', 'rigg'].map(id => {
      const s = stopFor(id, clock.period);
      return s ? `${s.zone},${s.x},${s.y},${s.act}` : '';
    }).join('|');
    return `${clock.period}:${businessPhase(clock.period, game.save.time.minutes)}:${phaseOf(game.save.time.minutes)}:${game.flag('weather') ?? ''}:${game.flag('festival_today') ?? ''}:${roles}:${Object.keys(CHAR_BY_ID).map((id) => game.flag('at_' + id) ?? '').join('|')}`;
  }

  private shopStamp() {
    const t = game.save.time;
    return ['taro', 'yuki', 'bento', 'sumi', 'nami', 'shells', 'library'].map((id) => shopGate(id).phase).join('') + restaurantPhase(t.period, t.minutes);
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

  /** Each shop's front has an open and a closed drawing: shutters and a rolled awning when it is closed. */
  private refreshShopFacades() {
    const t = game.save.time;
    for (const f of this.shopFacades) {
      if (!f.img.active) continue;
      const closed = f.shop === 'restaurant' ? restaurantPhase(t.period, t.minutes) !== 'open' : !shopGate(f.shop).open;
      if (closed === f.closed && f.img.texture.key === propTexture(this, f.propId, closed)) continue;
      f.closed = closed;
      f.img.setTexture(propTexture(this, f.propId, closed));
    }
  }

  private refreshShopSigns() {
    this.refreshShopFacades();
    for (const s of this.shopSigns) s.destroy();
    this.shopSigns = [];
    if (!this.zone) return;
    for (const spot of signSpots(this.zoneId)) {
      const status = shopGate(spot.shopId);
      const text = shopSignText(status);
      if (!text) continue;
      const x = spot.x * TILE;
      const y = spot.y * TILE + TILE - 2;
      const facade = this.zone.props.find((p) => p.def.kind === 'building' &&
        spot.x >= p.x && spot.x < p.x + p.def.w && spot.y >= p.y && spot.y < p.y + p.def.h);
      const depth = facade ? (facade.y + facade.def.h) * TILE + 0.1 : y + 2.1;
      const sign = this.add.image(x, y, shopSignTexture(this, text, status.phase))
        .setOrigin(0.5, 1).setDepth(depth)
        .setData({ shopId: spot.shopId, phase: status.phase });
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
   * Projected shadow: the sprite's silhouette, flipped onto the ground and pivoted on the object's feet.
   * The sun leans the tip. It does not slide the whole shape off the base.
   * Paper lanterns keep only the contact oval: a flipped copy read as a second red balloon.
   */
  private castShadow(img: Phaser.GameObjects.Image, kind: string, track = true): Phaser.GameObjects.Image | null {
    if (['flowers', 'reeds', 'mushroom', 'pier', 'stars', 'puddle', 'awning', 'poster', 'stairs', 'rug', 'paperlantern', 'lanternstring'].includes(kind)) return null;
    const tall = ['tree', 'sakura', 'pine', 'lamppost', 'lighthouse', 'torii'].includes(kind);
    const s = this.add
      .image(img.x, img.y, img.texture.key)
      .setOrigin(0.5, 0)
      .setAlpha(kind === 'building' || kind === 'stall' ? 0.24 : 0.3)
      .setDepth(-7)
      .setVisible(false);
    s.setData('frame', img.frame.name);
    if (track) this.objs.push(s);
    this.castList.push({ s, src: img, tall, sy: s.scaleY, a: s.alpha, x: 0 });
    return s;
  }

  /** Contact shadow: a short mark on the ground, centered on the object's base. */
  private addShadow(kind: string, x: number, y: number, sw: number, w: number) {
    let sh: Phaser.GameObjects.Shape;
    if (kind === 'building') sh = this.add.rectangle(x, y + 1, w * TILE * 0.92, 5, 0x1a1428, 0.28);
    else if (['tree', 'sakura', 'pine'].includes(kind)) sh = this.add.ellipse(x, y, Math.max(10, sw * 0.42), 5, 0x1a1428, 0.32);
    else if (['flowers', 'reeds', 'mushroom', 'pier', 'stars', 'torii'].includes(kind)) return;
    else sh = this.add.ellipse(x, y, Math.max(8, sw * 0.7), 4, 0x1a1428, 0.28);
    sh.setDepth(-7);
    this.objs.push(sh);
  }

  /** A warm overlay of lit windows (and the restaurant doorway) on top of a building sprite. Shown by updateWindowGlow. */
  private addWindowGlow(src: Phaser.GameObjects.Image, W: number, H: number, rot: number, door: boolean, facade: boolean, shop?: string, home?: 'front' | 'side') {
    const img = this.add.image(src.x, src.y, windowGlowTexture(this, W, H, rot, door, home)).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001).setVisible(false).setAlpha(0);
    this.objs.push(img);
    this.windowGlows.push({ img, src, facade, door, phase: Math.random() * 6, shop, home: !!home, seed: (Math.round(src.x) * 7 + Math.round(src.y) * 13) % 10 });
  }

  /** Window light level of a facade (0..1): the restaurant follows its hours, everything else follows the evening. */
  private facadeLevel(facade: boolean, door: boolean, g?: WindowGlow): number {
    const ls = this.ls;
    if (!ls) return 0;
    if (g?.home) {
      // houses: lit from dusk, and some go dark once it is late
      const t = game.save.time;
      const late = t.period === 3 && t.minutes > 45;
      return late && g.seed % 3 === 0 ? 0 : late && g.seed % 3 === 1 ? ls.windows * 0.45 : ls.windows;
    }
    if (!facade && g?.shop) {
      // shops: lit while they are open (in the evening), a faint light left on when closed
      const ph = shopGate(g.shop).phase;
      return ph === 'open' ? ls.windows : ph === 'closing' ? ls.windows * 0.6 : ls.windows * 0.12;
    }
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
      const lvl = this.facadeLevel(w.facade, w.door, w);
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
    trimCasts(this);
    for (const c of this.castList) {
      const squash = c.sy * (st.sy / 0.3);
      const k = castKey(this, c.src.texture.key, c.s.getData('frame') ?? c.src.frame.name, st.dx * (c.tall ? 2.2 : 1.4), squash, c.src.flipX);
      if (!k) { c.s.setVisible(false); continue; }
      c.s.setTexture(k).setOrigin(0.5, 0).setPosition(c.src.x, c.src.y).setVisible(c.src.visible).setAlpha(c.a * st.alpha);
    }
  }

  /**
   * Lighting pass. A low-res "darkness" layer multiplies the scene (ambient colour per time of day, weather and place).
   * Lamps lighten that colour. At night they stay dim, so the tiles do not show as day. A faint additive halo sits on top.
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
      gloom: !!def.gloom,
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
    const needW = Math.ceil(view.width) + 8;
    const needH = Math.ceil(view.height) + 8;
    if (rt.width < needW || rt.height < needH) rt.resize(needW, needH);
    rt.setPosition(Math.floor(view.x) - 4, Math.floor(view.y) - 4);
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
    // Once the street is dark, a full erase shows the daytime tiles. Paint a dim warm colour instead.
    const dim = lampPoolTint(ls.tint, 0xffc070, 1) != null;
    if (lit.length) {
      for (const { l, k } of lit) {
        const scale = (l.r * 2 * (ls.halo > 1 ? 1.08 : 1)) / 64;
        if (dim) {
          const col = lampPoolTint(ls.tint, l.color ?? 0xffc070, k)!;
          this.lightStamp.setScale(scale).setTint(col).setAlpha(1);
          rt.draw(this.lightStamp, l.x - rt.x, l.y - rt.y);
        } else {
          this.lightStamp.clearTint().setScale(scale).setAlpha(Math.min(1, k));
          rt.erase(this.lightStamp, l.x - rt.x, l.y - rt.y);
        }
      }
      if (!dim) {
        for (const { l, k } of lit) {
          this.lightStamp.setScale((l.r * 1.7 * ls.halo) / 64).setTint(l.color ?? 0xffc070).setAlpha(0.5 * k * (ls.halo > 1 ? 0.85 : 1));
          rt.draw(this.lightStamp, l.x - rt.x, l.y - rt.y);
        }
      }
      this.lightStamp.clearTint().setAlpha(1);
    }
    // Sofi carries a soft pool so the night stays readable, without a circle of daylight around her.
    if (ls.lamp > 0.1 && this.player) {
      if (dim) {
        const self = lampPoolTint(ls.tint, 0xfff0dc, Math.min(1, ls.lamp), 180);
        if (self != null) {
          this.lightStamp.setScale(1.25).setTint(self).setAlpha(1);
          rt.draw(this.lightStamp, this.player.x - rt.x, this.player.y - 10 - rt.y);
        }
      } else if (lit.length) {
        this.lightStamp.clearTint().setScale(1.5).setAlpha(Math.min(1, ls.lamp));
        rt.erase(this.lightStamp, this.player.x - rt.x, this.player.y - 10 - rt.y);
      }
      this.lightStamp.clearTint().setAlpha(1);
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
          .setScale(spill ? 0.9 : (l.r * 1.5 * ls.halo) / 64, spill ? 0.45 : (l.r * 1.5 * ls.halo) / 64)
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
    if (announce) void runTask('world:battery-tip', () => import('../ui/dom').then(({ toast }) => toast('Activé el modo batería para que el juego vaya más fluido.')), false);
  }

  // ------------------------------------------------------------------ objective guide
  private guideArrow: Phaser.GameObjects.Image | null = null;
  private guideMark: Phaser.GameObjects.Image | null = null;
  private guideT = 0;
  private guideGoal: { x: number; y: number; npc?: string } | null = null;
  /** while carrying food the delivery targets win over the quest arrow (the quest itself is untouched) */
  private deliveryGoals: { x: number; y: number; label: string }[] = [];
  private deliveryMarks: { mark: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];

  private updateGuide(dt: number) {
    if (!this.guideArrow) {
      this.guideArrow = this.add.image(0, 0, guideTexture(this, 'arrow')).setDepth(250000).setVisible(false).setScale(1.5);
      this.guideMark = this.add.image(0, 0, guideTexture(this, 'mark')).setDepth(250000).setVisible(false);
    }
    this.guideT -= dt;
    if (this.guideT <= 0) {
      this.guideT = 0.5;
      this.guideGoal = null;
      this.deliveryGoals = settings.guide !== false && !this.inputLocked ? this.findDeliveryGoals() : [];
      const t = settings.guide !== false && !this.inputLocked && !this.deliveryGoals.length ? questTarget((id) => this.characterZone(id)) : null;
      if (t) {
        if (t.zone === this.zoneId || (t.zone === 'home' && this.zoneId === 'home')) {
          if (t.npc) this.guideGoal = { x: 0, y: 0, npc: t.npc };
          else if (t.tableId) {
            const f = this.zone.furniture.find((fi) => String(fi.f.uid) === t.tableId);
            if (f) { const size = furnSize(f.def, f.f.rot); this.guideGoal = { x: f.f.x * TILE + (size.w * TILE) / 2, y: f.f.y * TILE + (size.h * TILE) / 2 }; }
          } else if (t.x != null && t.y != null) this.guideGoal = { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 };
        } else {
          const d = nextDoor(this.zoneId, t.zone);
          if (d) this.guideGoal = { x: d.x * TILE + TILE / 2, y: d.y * TILE + TILE / 2 };
        }
      }
    }
    const arrow = this.guideArrow!;
    const mark = this.guideMark!;
    let goal = this.guideGoal;
    this.deliveryMarks.forEach((m, i) => { if (i >= this.deliveryGoals.length) { m.mark.setVisible(false); m.label.setVisible(false); } });
    if (this.deliveryGoals.length) {
      const nowT = performance.now() / 1000;
      this.deliveryGoals.forEach((d, i) => {
        let m = this.deliveryMarks[i];
        if (!m) m = this.deliveryMarks[i] = {
          mark: this.add.image(0, 0, guideTexture(this, 'mark')).setDepth(250000).setScale(0.55).setAlpha(0.72),
          label: this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '6px', color: '#efe6d6', backgroundColor: '#3a2a24', padding: { x: 2, y: 0 } }).setOrigin(0.5, 1).setDepth(250000),
        };
        m.mark.setVisible(true).setPosition(d.x, d.y - 8 + Math.sin(nowT * 4 + i) * 1);
        m.label.setVisible(true).setText(d.label).setPosition(d.x, d.y - 14);
      });
      goal = nearestGoal(this.deliveryGoals, this.player.x, this.player.y);
      mark.setVisible(false);
    }
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

  /** Tables waiting for the dishes Sofi carries (or the restaurant door when she is somewhere else). */
  private findDeliveryGoals(): { x: number; y: number; label: string }[] {
    const carrying = carriedOrders();
    if (!carrying.length) return [];
    if (this.zoneId !== 'restaurant') {
      const d = nextDoor(this.zoneId, 'restaurant');
      return d ? [{ x: d.x * TILE + TILE / 2, y: d.y * TILE + TILE / 2, label: 'Al restaurante' }] : [];
    }
    const dishes: DeliveryDish[] = [];
    for (const o of carrying) {
      const f = this.zone.furniture.find((fi) => String(fi.f.uid) === o.service?.tableId);
      if (!f) continue;
      const def = o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe];
      const size = furnSize(f.def, f.f.rot);
      dishes.push({ tableId: o.service!.tableId, x: f.f.x * TILE + (size.w * TILE) / 2, y: f.f.y * TILE, table: tableLabel(o.service!.tableId), dish: def?.name ?? 'pedido' });
    }
    return deliveryGoals(dishes);
  }

  private quirks(dt: number) {
    if (!this.canAct() || !this.speech.idle()) return;
    if (this.decorReaction) {
      this.decorReaction = false;
      const view = this.cameras.main.worldView;
      const n = [...this.npcs.values()].filter(n => CHAR_BY_ID[n.actor.id]?.raccoon && !n.social && !n.traveling && n.t < 80 &&
        !(n.actor.id === 'pip' && this.hostId) && view.contains(n.actor.x, n.actor.y) &&
        game.flag('decor_reaction_' + n.actor.id) !== game.save.time.day).sort((a, b) =>
        Math.hypot(a.actor.x - this.player.x, a.actor.y - this.player.y) - Math.hypot(b.actor.x - this.player.x, b.actor.y - this.player.y))[0];
      if (n) void runTask('world:decor-reaction', () => import('../story/quirks').then(m => {
        if (this.sys.isActive() && n.actor.sprite.active) m.reactToDecor(n.actor.id, n.actor, this);
      }));
    }
    this.quirkT -= dt;
    if (this.quirkT > 0 || this.inputLocked || lowFx()) return;
    this.quirkT = 25 + Math.random() * 35;
    const raccoons = [...this.npcs.entries()].filter(([id, n]) => !n.social && !n.traveling && n.t < 80 && !n.actor.path.length && !(id === 'pip' && this.hostId) && (CHAR_BY_ID[id]?.raccoon || Math.random() < 0.3));
    if (!raccoons.length) return;
    const [id, n] = raccoons[Math.floor(Math.random() * raccoons.length)];
    void runTask('world:quirk', () => import('../story/quirks').then(({ runQuirk }) => {
      if (this.sys.isActive() && this.npcs.get(id) === n && n.actor.sprite.active) runQuirk(id, n.actor, this);
    }));
  }
}

function guestHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
