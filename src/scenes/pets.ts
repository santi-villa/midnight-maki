/**
 * The village pets: cats that sit on the benches (and hop away if you come close), a dog asleep by a bench, a golden dog that barks hello, a frog by the reeds.
 * Cat Pixel Mega Pack and Animal Mega Pack art (src/assets/pets, see scripts/build-pet-assets.py). They are only decoration: they never block anything.
 */
import Phaser from 'phaser';
import catalog from '../assets/pets/pets.json';
import atlasURL from '../assets/pets/pets.png';

export const PETS_ATLAS_KEY = 'pets-source';
export const PETS_ATLAS_URL = atlasURL;

type Sheet = { y: number; w: number; h: number; frames: number };
const sheets = catalog as unknown as Record<string, Sheet>;

export interface PetSpot { zone: string; kind: 'cat_brown' | 'cat_white' | 'cat_siamese' | 'dog_sleep' | 'dog_golden' | 'frog'; tx: number; ty: number; dx?: number; dy?: number; day?: boolean }

/** where each pet lives (tile of a bench or a reed bed, plus a pixel offset) */
export const PET_SPOTS: PetSpot[] = [
  { zone: 'plaza', kind: 'cat_brown', tx: 11, ty: 17, dx: 8, dy: 5 },
  { zone: 'plaza', kind: 'cat_white', tx: 21, ty: 14, dx: 8, dy: 5 },
  { zone: 'plaza', kind: 'dog_sleep', tx: 9, ty: 15, dx: 8, dy: 14 },
  { zone: 'plaza', kind: 'dog_golden', tx: 19, ty: 18, dx: 8, dy: 15, day: true },
  { zone: 'garden', kind: 'cat_siamese', tx: 13, ty: 8, dx: 8, dy: 5 },
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

interface Pet { spot: PetSpot; s: Phaser.GameObjects.Sprite; hopping: boolean; cool: number; barking: boolean }

export class Pets {
  private pets: Pet[] = [];
  constructor(scene: Phaser.Scene, zone: string, night: boolean) {
    if (!scene.textures.exists(PETS_ATLAS_KEY)) return;
    ensureAnims(scene);
    for (const spot of PET_SPOTS.filter((p) => p.zone === zone && !(night && p.day))) {
      const x = spot.tx * 16 + (spot.dx ?? 8), y = spot.ty * 16 + (spot.dy ?? 14);
      const s = scene.add.sprite(x, y, PETS_ATLAS_KEY, `${SHEETS[spot.kind].idle}_0`).setOrigin(0.5, 1).setScale(SCALE[spot.kind]).setDepth(y + 1);
      s.play(`pet_${spot.kind}_idle`);
      this.pets.push({ spot, s, hopping: false, cool: 0, barking: false });
    }
  }

  get count() { return this.pets.length; }

  /** `player` in world pixels. A cat hops when you come close; the golden dog barks while you are near. */
  update(dt: number, player: { x: number; y: number }) {
    for (const p of this.pets) {
      p.cool -= dt;
      const d = Math.hypot(p.s.x - player.x, p.s.y - player.y);
      const k = p.spot.kind;
      if (SHEETS[k].hop && !p.hopping && p.cool <= 0 && d < 30) {
        p.hopping = true;
        p.s.play(`pet_${k}_hop`);
        p.s.once('animationcomplete', () => { p.hopping = false; p.cool = 7; p.s.play(`pet_${k}_idle`); });
      } else if (k === 'dog_golden') {
        const near = d < 56;
        if (near !== p.barking) { p.barking = near; p.s.play(near ? 'pet_dog_golden_bark' : 'pet_dog_golden_idle'); }
      }
    }
  }

  destroy() { for (const p of this.pets) p.s.destroy(); this.pets = []; }
}
