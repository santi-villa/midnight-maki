/**
 * The village pets: cats that sit on the benches (and hop away if you come close), a dog asleep by a bench, a golden dog that barks hello, a frog by the reeds.
 * Cat Pixel Mega Pack and Animal Mega Pack art (src/assets/pets, see scripts/build-pet-assets.py). They are only decoration: they never block anything.
 */
import Phaser from 'phaser';
import catalog from '../assets/pets/pets.json';
import atlasURL from '../assets/pets/pets.png';
import type { Grid } from '../world/grid';
import { Footsteps } from '../audio/footsteps';

export const PETS_ATLAS_KEY = 'pets-source';
export const PETS_ATLAS_URL = atlasURL;

type Sheet = { y: number; w: number; h: number; frames: number };
const sheets = catalog as unknown as Record<string, Sheet>;

export interface PetSpot { zone: string; kind: 'cat_brown' | 'cat_white' | 'cat_siamese' | 'dog_sleep' | 'dog_golden' | 'frog'; tx: number; ty: number; dx?: number; dy?: number; day?: boolean; name?: string; route?: [number, number][] }

/** where each pet lives (tile of a bench or a reed bed, plus a pixel offset) */
export const PET_SPOTS: PetSpot[] = [
  { zone: 'plaza', kind: 'cat_brown', tx: 11, ty: 17, dx: 8, dy: 5, route: [[11, 18], [9, 18], [11, 16]] },
  { zone: 'plaza', kind: 'cat_white', tx: 21, ty: 14, dx: 8, dy: 5, route: [[21, 15], [23, 15], [23, 13]] },
  // (the two dogs were removed: their art did not match the pixel style of the game)
  { zone: 'garden', kind: 'cat_siamese', tx: 13, ty: 8, dx: 8, dy: 5, route: [[13, 9], [12, 11], [15, 9]] },
  { zone: 'restaurant', kind: 'cat_siamese', name: 'Miso', tx: 17, ty: 12, route: [[17, 12], [16, 8], [6, 10]] },
  { zone: 'garden', kind: 'frog', tx: 26, ty: 20, dx: 8, dy: 14, day: true },
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

interface Pet { spot: PetSpot; s: Phaser.GameObjects.Sprite; hopping: boolean; cool: number; barking: boolean; path: [number, number][]; pause: number; point: number; home: [number, number]; sleeping: boolean; z: Phaser.GameObjects.Text }

export class Pets {
  private pets: Pet[] = [];
  private feet = new Footsteps();
  private heart: Phaser.GameObjects.Text | null = null;
  private petAgain = 0;
  constructor(private scene: Phaser.Scene, readonly zone: string, private night: boolean, private onStep?: (x: number, y: number) => void, private grid?: Grid) {
    if (!scene.textures.exists(PETS_ATLAS_KEY)) return;
    ensureAnims(scene);
    for (const spot of PET_SPOTS.filter((p) => p.zone === zone)) {
      const x = spot.tx * 16 + (spot.dx ?? 8), y = spot.ty * 16 + (spot.dy ?? 14);
      const s = scene.add.sprite(x, y, PETS_ATLAS_KEY, `${SHEETS[spot.kind].idle}_0`).setOrigin(0.5, 1).setScale(SCALE[spot.kind]).setDepth(y + 1);
      s.play(`pet_${spot.kind}_idle`);
      const home = this.safe(spot.route?.[0] ?? [spot.tx, spot.ty]);
      const z = scene.add.text(x + 5, y - 18, 'z', { fontFamily: 'Pixelify Sans', fontSize: '7px', color: '#e7dcc2', stroke: '#362e36', strokeThickness: 1 }).setDepth(y + 2).setVisible(false);
      this.pets.push({ spot, s, hopping: false, cool: 0, barking: false, path: [], pause: 3 + this.pets.length * 2, point: 0, home, sleeping: false, z });
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
        if (!sleeping) { p.s.setScale(SCALE[k]); p.s.play(`pet_${k}_idle`); p.pause = 12; }
      }
      if (p.path.length) {
        const [tx, ty] = p.path[0], x = tx * 16 + 8, y = ty * 16 + 14;
        if (this.grid?.isSolid(tx, ty)) { p.path = []; p.pause = 2; continue; }
        if ([player, ...occupants].some(a => Math.hypot(a.x - x, a.y - y) < 10)) continue;
        const dx = x - p.s.x, dy = y - p.s.y, distance = Math.hypot(dx, dy), step = dt * (p.spot.name ? 15 : 12);
        if (Math.abs(dx) > 0.1) p.s.setFlipX(k.startsWith('cat') ? dx < 0 : dx > 0);
        if (distance <= step) { p.s.setPosition(x, y); p.path.shift(); if (!p.path.length) p.pause = 4 + Math.random() * 9; }
        else p.s.setPosition(p.s.x + dx / distance * step, p.s.y + dy / distance * step);
        p.s.setDepth(p.s.y + 1); p.z.setVisible(false);
        if (this.feet.sample(p.s, p.s.x, p.s.y, dt, false, true)) this.onStep?.(p.s.x, p.s.y);
        continue;
      }
      if (sleeping) {
        p.s.anims.pause(); p.s.setFrame(`${SHEETS[k].idle}_0`).setScale(SCALE[k], SCALE[k] * 0.7);
        p.z.setVisible(true).setPosition(p.s.x + 6, p.s.y - 16).setDepth(p.s.depth + 1);
        continue;
      }
      p.z.setVisible(false);
      p.pause -= dt;
      if (p.spot.route && p.pause <= 0 && !p.hopping) {
        p.point = (p.point + 1) % p.spot.route.length;
        let at = p.spot.route[p.point];
        // half the time they wander a few tiles around the spot instead of repeating the same corners
        if (!p.spot.name && Math.random() < 0.5) at = [at[0] + Math.round(Math.random() * 8 - 4), at[1] + Math.round(Math.random() * 6 - 3)];
        const guest = p.spot.name && guests.length ? guests[p.point % guests.length] : null;
        if (guest) at = [Math.floor(guest.x / 16) + 1, Math.floor(guest.y / 16)];
        this.walk(p, at); p.pause = 6 + Math.random() * 6;
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

  destroy() { this.heart?.destroy(); for (const p of this.pets) { p.s.destroy(); p.z.destroy(); } this.pets = []; }
}
