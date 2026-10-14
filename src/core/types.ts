import type { DiningSnapshot } from '../restaurant/floor';
export type Dir = 'down' | 'up' | 'left' | 'right';

export type Species = 'human' | 'cat' | 'fox' | 'bunny' | 'raccoon' | 'bear' | 'dog' | 'owl' | 'otter' | 'squirrel';

/** Layered appearance used to compose character sprites. Clothing ids reference data/clothes.ts. */
export interface Appearance {
  species: Species;
  skin: string;       // skin or fur color (hex)
  hairStyle: number;  // index into hair templates (ignored for some species)
  hairColor: string;
  eyes: number;       // eye style index
  eyeColor: string;
  top: string;        // clothing ids ('' = none)
  bottom: string;
  shoes: string;
  head: string;
  face: string;
  extra: string;
  bag: string;
  /** optional fur markings (raccoons and other animals) */
  marks?: { mask?: string; face?: string; belly?: string; arms?: string; stripe?: string; ear?: string };
  /** extra customization of the playable human heroes (Santiago / Sofi); missing fields fall back to the hero's defaults */
  hero?: Partial<HeroLook>;
}

/** Look options of the human heroes that go beyond the classic Appearance fields. */
export interface HeroLook {
  gender: 'm' | 'f';
  build: 0 | 1 | 2;      // slim / regular / broad
  face: number;          // face shape
  brow: number;
  browColor: string;     // '' = follows the hair colour
  nose: number;
  lips: string;          // '' = natural
  freckles: boolean;
  mole: boolean;
  blush: boolean;
  facial: number;        // facial hair style
  hairHi: string;        // hair highlight colour, '' = automatic
  earrings: number;
  neck: number;
  piercing: number;      // 0 none, 1 nose stud, 2 septum, 3 lip ring, 4 septum + lip ring
}

export interface PlacedFurniture {
  uid: number;
  id: string;
  x: number;  // tile coords
  y: number;
  rot: number; // 0..3, only for rotatable
}

export interface DiningSave {
  day: number;
  floor: DiningSnapshot;
  bag: string[];
  lastCustomer: string | null;
  nextId: number;
  shift: { day: number; arrived: number; served: number; coins: number; tips: number; state: 'open' | 'closed' } | null;
}

export interface Order {
  kind?: 'drink';
  service?: { partyId: string; memberId: string; tableId: string; seatId: string; day: number };
  uid: number;
  recipe: string;
  customer: string;   // npc id or generic customer id
  reward: number;
  special?: string;   // marks story/quest orders
  /** Set once the dish is cooked and still needs to be carried to the table. */
  plate?: { quality: 0 | 1 | 2; variantBonus?: number; variant?: string; state?: 'ready' | 'carried' | 'delivered' };
}

export interface QuestState {
  step: number;
  progress: Record<string, number>;
}

export interface RelationState {
  points: number;       // 0..500 (5 levels x 100)
  lastTalkDay: number;
  lastGiftDay: number;
}

export interface GameTime {
  day: number;     // 1-based internal day
  period: number;  // 0 morning,1 afternoon,2 dusk,3 night
  minutes: number; // minutes elapsed inside current period (0..PERIOD_MINUTES)
}

export interface Photo {
  id: number;
  day: number;
  zone: string;
  subject: string;
  data: string; // small dataURL thumbnail
}

export type RecipePresentation = 'classic' | 'indigo' | 'sakura' | 'gold';

export interface RecipeRecord {
  bestScore?: number;
  bestQuality?: 0 | 1 | 2;
  bestDay?: number;
  variants: Record<string, { count: number; bestScore: number }>;
  presentation?: RecipePresentation;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  playMs: number;
  player: {
    name: string;
    restaurantName: string;
    appearance: Appearance;
    zone: string;
    x: number;
    y: number;
    dir: Dir;
  };
  raccoonOutfits: Record<string, { head: string; extra: string }>;
  coins: number;
  time: GameTime;
  inventory: Record<string, number>;
  recipesKnown: string[];
  recipesCooked: Record<string, number>;
  /** mastery per recipe (see restaurant/mastery.ts); missing in older saves */
  recipeMastery?: Record<string, { n: number; g: number; p: number }>;
  /** Hand-cooked records, discovered variant ingredient IDs and chosen plate style. */
  recipeRecords?: Record<string, RecipeRecord>;
  restaurant: { level: number; xp: number; reputation: number; upgrades: string[]; served: number };
  orders: Order[];
  dining?: DiningSave;
  nextUid: number;
  relationships: Record<string, RelationState>;
  flags: Record<string, number | string | boolean>;
  quests: { active: Record<string, QuestState>; done: string[]; tracked: string | null };
  story: { chapter: number; clues: string[]; decisions: Record<string, string>; seenScenes: string[] };
  decor: Record<string, PlacedFurniture[]>;
  roomStyle: Record<string, { floor: string; wall: string }>;
  furnitureOwned: Record<string, number>; // stored (not placed) counts
  clothesOwned: string[];
  collections: Record<string, Record<string, number>>; // category -> id -> count
  achievements: string[];
  garden: { plot: number; seed: string | null; plantedDay: number; watered: number; ready: boolean }[];
  photos: Photo[];
  stats: Record<string, number>;
}

export interface Settings {
  music: number;
  ambience: number;
  sfx: number;
  textScale: number;
  textSpeed: number;  // chars per second, 0 = instant
  reduceMotion: boolean;
  haptics?: boolean;
  joystick: boolean;
  cookMode: 'relaxed' | 'normal' | 'challenge';
  settingsVersion?: number;
  /** objective arrow towards the tracked quest */
  guide?: boolean;
  /** effects quality: auto-detect, always high, or battery saver */
  perf?: 'auto' | 'high' | 'low';
}
