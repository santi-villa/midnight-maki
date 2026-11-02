/**
 * The village pets: cats that sit on the benches (and hop away if you come close), a dog asleep by a bench, a golden dog that barks hello, a frog by the reeds.
 * Cat Pixel Mega Pack and Animal Mega Pack art (src/assets/pets, see scripts/build-pet-assets.py). They are only decoration: they never block anything.
 */
import Phaser from 'phaser';
import catalog from '../assets/pets/pets.json';
import atlasURL from '../assets/pets/pets.png';
import type { Grid } from '../world/grid';
import { Footsteps } from '../audio/footsteps';
import { liveZoneOf, toLive } from '../world/village';
import { breathAt, sleepCatTexture, sleepFrame, zzzAt, type CatColor, type SleepPose } from './petArt';

export const PETS_ATLAS_KEY = 'pets-source';
export const PETS_ATLAS_URL = atlasURL;

type Sheet = { y: number; w: number; h: number; frames: number };
const sheets = catalog as unknown as Record<string, Sheet>;

export interface PetSpot { zone: string; kind: 'cat_brown' | 'cat_white' | 'cat_siamese' | 'dog_sleep' | 'dog_golden' | 'frog'; tx: number; ty: number; dx?: number; dy?: number; day?: boolean; name?: string; roam?: boolean; route?: [number, number][] }

/** where each pet lives (tile of a bench or a reed bed, plus a pixel offset) */
export const PET_SPOTS: PetSpot[] = [
  { zone: 'plaza', kind: 'cat_brown', roam: true, tx: 11, ty: 17, dx: 8, dy: 5, route: [[11, 18], [9, 18], [11, 16]] },
  { zone: 'plaza', kind: 'cat_white', roam: true, tx: 21, ty: 14, dx: 8, dy: 5, route: [[21, 15], [23, 15], [23, 13]] },
  // (the two dogs were removed: their art did not match the pixel style of the game)
  { zone: 'garden', kind: 'cat_siamese', tx: 13, ty: 8, dx: 8, dy: 5, route: [[13, 9], [12, 11], [15, 9]] },
  { zone: 'restaurant', kind: 'cat_siamese', name: 'Miso', tx: 17, ty: 12, route: [[17, 12], [16, 8], [6, 10]] },
  // (the frog moved to scenes/wildlife.ts: drawn in code, it croaks, hops along the bank and dives in)
];

const SCALE: Record<PetSpot['kind'], number> = { cat_brown: 0.8, cat_white: 0.8, cat_siamese: 0.8, dog_sleep: 0.6, dog_golden: 0.55, frog: 0.45 };
const SHEETS: Record<PetSpot['kind'], { idle: string; hop?: string; rate: number }> = {
  cat_brown: { idle: 'cat_brown_idle', hop: 'cat_brown_jump', rate: 5 }, cat_white: { idle: 'cat_white_idle', hop: 'cat_white_jump', rate: 5 },
  cat_siamese: { idle: 'cat_siamese_idle', hop: 'cat_siamese_jump', rate: 5 }, dog_sleep: { idle: 'dog_sleep', rate: 3 },
  dog_golden: { idle: 'dog_golden', rate: 4 }, frog: { idle: 'frog_idle', rate: 3 },
};

/** register the frames and animations once per game */
function ensureAnims(scene: Phaser.Scene) {
  if (scene.anims.exists('pet_cat_brown_idle')) return;
  const tex = scene.textures.get(PETS_ATLAS_KEY);
  for (const [name, s] of Object.entries(sheets)) for (let i = 0; i < s.frames; i++) tex.add(`${name}_${i}`, 0, i * s.w, s.y, s.w, s.h);
  const frames = (name: string, from = 0, to = sheets[name].frames - 1) => Array.from({ length: to - from + 1 }, (_, i) => ({ key: PETS_ATLAS_KEY, frame: `${name}_${from + i}` }));
  for (const k of Object.keys(SHEETS) as PetSpot['kind'][]) {
    const def = SHEETS[k];
    if (k === 'dog_golden') {
      scene.anims.create({ key: 'pet_dog_golden_idle', frames: frames('dog_golden', 0, 4), frameRate: def.rate, repeat: -1 });
      scene.anims.create({ key: 'pet_dog_golden_bark', frames: frames('dog_golden', 5, 10), frameRate: 8, repeat: -1 });
    } else scene.anims.create({ key: `pet_${k}_idle`, frames: frames(def.idle), frameRate: def.rate, repeat: -1 });
    if (def.hop) scene.anims.create({ key: `pet_${k}_hop`, frames: frames(def.hop), frameRate: 12, repeat: 0 });
  }
}

interface Pet { spot: PetSpot; s: Phaser.GameObjects.Sprite; hopping: boolean; cool: number; barking: boolean; path: [number, number][]; pause: number; point: number; home: [number, number]; sleeping: boolean; z: Phaser.GameObjects.Text[]; bed: Phaser.GameObjects.Sprite | null; pose: SleepPose; nap: number; turn: number }

export class Pets {
  private pets: Pet[] = [];
  private feet = new Footsteps();
  private heart: Phaser.GameObjects.Text | null = null;
  private petAgain = 0;
  constructor(private scene: Phaser.Scene, readonly zone: string, private night: boolean, private onStep?: (x: number, y: number) => void, private grid?: Grid) {
    if (!scene.textures.exists(PETS_ATLAS_KEY)) return;
    ensureAnims(scene);
    // `zone` is the drawn map: the village holds the pets of every district, placed at their district's spot
    for (const authored of PET_SPOTS.filter((p) => liveZoneOf(p.zone) === zone)) {
      const at = toLive(authored.zone, authored.tx, authored.ty);
      const spot: PetSpot = { ...authored, tx: at.x, ty: at.y, route: authored.route?.map(([x, y]) => { const r = toLive(authored.zone, x, y); return [r.x, r.y] as [number, number]; }) };
      const x = spot.tx * 16 + (spot.dx ?? 8), y = spot.ty * 16 + (spot.dy ?? 14);
      const s = scene.add.sprite(x, y, PETS_ATLAS_KEY, `${SHEETS[spot.kind].idle}_0`).setOrigin(0.5, 1).setScale(SCALE[spot.kind]).setDepth(y + 1);
      s.play(`pet_${spot.kind}_idle`);
      const home = this.safe(spot.route?.[0] ?? [spot.tx, spot.ty]);
      // three z's, each a little bigger, that come and go one after another while it sleeps
      const z = [6, 7, 9].map((size) => scene.add.text(x, y, 'z', { fontFamily: 'Pixelify Sans', fontSize: `${size}px`, color: '#e7dcc2', stroke: '#362e36', strokeThickness: 1 }).setOrigin(0.5, 1).setVisible(false));
      // cats sleep in one of two ways (curled up or belly up) and now and then roll over to the other
      const cat = spot.kind.startsWith('cat_');
      const bed = cat ? scene.add.sprite(x, y, sleepCatTexture(scene, spot.kind as CatColor), 0).setOrigin(0.5, 1).setScale(SCALE[spot.kind]).setVisible(false) : null;
      const n = this.pets.length;
      this.pets.push({ spot, s, hopping: false, cool: 0, barking: false, path: [], pause: 3 + n * 2, point: 0, home, sleeping: false, z, bed, pose: n % 2 ? 'back' : 'curl', nap: n * 0.9, turn: 40 + n * 13 });
    }
  }

  get count() { return this.pets.length; }

  setNight(night: boolean, grid = this.grid) { this.night = night; this.grid = grid; }

  private safe(at: [number, number]): [number, number] {
    return this.grid?.isSolid(...at) ? this.grid.nearestWalkable(...at) ?? at : at;
  }

  private walk(p: Pet, at: [number, number]) {
    const target = this.safe(at);
    p.path = this.grid?.path(Math.floor(p.s.x / 16), Math.floor((p.s.y - 1) / 16), ...target) ?? [];
  }

  get interactions() { return this.pets.filter(p => p.spot.name).map(p => ({ id: p.spot.name!, name: p.spot.name!, x: p.s.x, y: p.s.y - 4 })); }

  pet(id: string, player: { x: number; y: number }): boolean {
    const p = this.pets.find(p => p.spot.name === id);
    if (!p || Math.hypot(p.s.x - player.x, p.s.y - player.y) > 30 || this.scene.time.now < this.petAgain) return false;
    this.petAgain = this.scene.time.now + 1200;
    p.path = []; p.pause = 18; p.cool = 7;
    this.heart?.destroy();
    const heart = this.scene.add.text(p.s.x, p.s.y - 22, '♥', { fontFamily: 'Pixelify Sans', fontSize: '9px', color: '#edb5af', stroke: '#4b3440', strokeThickness: 1 }).setOrigin(0.5).setDepth(250001);
    this.heart = heart;
    this.scene.time.delayedCall(1500, () => { if (heart.active) heart.destroy(); if (this.heart === heart) this.heart = null; });
    return true;
  }

  /** `player` in world pixels. A cat hops when you come close; the golden dog barks while you are near. */
  update(dt: number, player: { x: number; y: number }, guests: { x: number; y: number }[] = [], occupants: { x: number; y: number }[] = []) {
    if (dt <= 0) return;
    for (const p of this.pets) {
      p.cool -= dt;
      const d = Math.hypot(p.s.x - player.x, p.s.y - player.y);
      const k = p.spot.kind;
      const sleeping = this.night && k !== 'frog';
      if (sleeping !== p.sleeping) {
        p.sleeping = sleeping; p.path = []; p.hopping = false; p.s.removeAllListeners('animationcomplete');
        if (sleeping && p.spot.route) this.walk(p, p.home);
        if (!sleeping) { p.s.setScale(SCALE[k]).setVisible(true); p.s.play(`pet_${k}_idle`); p.pause = 12; this.wake(p); }
      }
      if (p.path.length) {
        const [tx, ty] = p.path[0], x = tx * 16 + 8, y = ty * 16 + 14;
        if (this.grid?.isSolid(tx, ty)) { p.path = []; p.pause = 2; continue; }
        if ([player, ...occupants].some(a => Math.hypot(a.x - x, a.y - y) < 10)) continue;
        const dx = x - p.s.x, dy = y - p.s.y, distance = Math.hypot(dx, dy), step = dt * (p.spot.name ? 15 : 12);
        if (Math.abs(dx) > 0.1) p.s.setFlipX(k.startsWith('cat') ? dx < 0 : dx > 0);
        if (distance <= step) { p.s.setPosition(x, y); p.path.shift(); if (!p.path.length) p.pause = 4 + Math.random() * 9; }
        else p.s.setPosition(p.s.x + dx / distance * step, p.s.y + dy / distance * step);
        p.s.setDepth(p.s.y + 1); this.wake(p);
        if (this.feet.sample(p.s, p.s.x, p.s.y, dt, false, true)) this.onStep?.(p.s.x, p.s.y);
        continue;
      }
      if (sleeping) { this.doze(p, dt); continue; }
      p.pause -= dt;
      if (p.spot.route && p.pause <= 0 && !p.hopping) {
        p.point = (p.point + 1) % p.spot.route.length;
        let at = p.spot.route[p.point];
        // half the time they wander a few tiles around the spot instead of repeating the same corners
        if (!p.spot.name && Math.random() < 0.5) at = [at[0] + Math.round(Math.random() * 8 - 4), at[1] + Math.round(Math.random() * 6 - 3)];
        // the plaza cats are village cats: they walk to a far corner of the whole town now and then
        if (p.spot.roam && this.grid && Math.random() < 0.7) at = [1 + Math.floor(Math.random() * (this.grid.w - 2)), 1 + Math.floor(Math.random() * (this.grid.h - 2))];
        const guest = p.spot.name && guests.length ? guests[p.point % guests.length] : null;
        if (guest) at = [Math.floor(guest.x / 16) + 1, Math.floor(guest.y / 16)];
        this.walk(p, at); p.pause = 6 + Math.random() * 6;
        if (p.spot.roam && p.path.length > 90) p.path.length = 90; // long trips happen in a few legs
        if (p.path.length) continue;
      }
      if (SHEETS[k].hop && !p.hopping && p.cool <= 0 && d < 30) {
        p.hopping = true;
        p.s.play(`pet_${k}_hop`);
        p.s.once('animationcomplete', () => { p.hopping = false; p.cool = 7; p.s.play(`pet_${k}_idle`); this.onStep?.(p.s.x, p.s.y); });
      } else if (k === 'dog_golden') {
        const near = d < 56;
        if (near !== p.barking) { p.barking = near; p.s.play(near ? 'pet_dog_golden_bark' : 'pet_dog_golden_idle'); }
      }
    }
  }

  /** Asleep where it stands: the cat breathes (curled up or belly up) and the z's rise one, two, three and go back. */
  private doze(p: Pet, dt: number) {
    p.nap += dt;
    const k = p.spot.kind, x = p.s.x, y = p.s.y, flip = p.s.flipX;
    if (p.bed) {
      p.turn -= dt;
      if (p.turn <= 0) { p.pose = p.pose === 'curl' ? 'back' : 'curl'; p.turn = 50 + Math.random() * 40; }
      p.s.anims.pause(); p.s.setVisible(false);
      // the sheet faces right; the awake cat is flipped when it faces left
      p.bed.setVisible(true).setPosition(x, y).setFlipX(flip).setDepth(y + 1).setFrame(sleepFrame(p.pose, breathAt(p.nap)));
    } else {
      p.s.anims.pause(); p.s.setFrame(`${SHEETS[k].idle}_0`);
      // no sleeping art (the dogs): breathe by squashing the idle frame a little
      p.s.setScale(SCALE[k], SCALE[k] * (breathAt(p.nap) ? 0.74 : 0.7));
    }
    const shown = zzzAt(p.nap), side = flip ? -1 : 1;
    p.z.forEach((z, i) => {
      const drift = Math.sin(p.nap * 1.6 + i) * 0.8;
      z.setVisible(i < shown).setPosition(x + side * (4 + i * 4) + drift, y - 12 - i * 5).setDepth(250000 + y);
    });
  }

  private wake(p: Pet) {
    for (const z of p.z) z.setVisible(false);
    if (p.bed?.visible) { p.bed.setVisible(false); p.s.setVisible(true); }
  }

  destroy() { this.heart?.destroy(); for (const p of this.pets) { p.s.destroy(); p.bed?.destroy(); for (const z of p.z) z.destroy(); } this.pets = []; }
}
