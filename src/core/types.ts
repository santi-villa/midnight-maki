import type { KeyBindings } from '../input/bindings';
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
  /** id of the crew member who is cooking it (never saved across a reload) */
  cook?: string;
  customer: string;   // npc id or generic customer id
  reward: number;
  special?: string;   // marks story/quest orders
  /** a customer's special request: a perfect dish, or served while they are still patient */
  want?: 'perfect' | 'fast';
  /** Set once the dish is cooked and still needs to be carried to the table. */
  /** `claim`: id of the employee who is on the way to carry it (never saved across a reload) */
  plate?: { quality: 0 | 1 | 2; variantBonus?: number; variant?: string; state?: 'ready' | 'carried' | 'delivered'; claim?: string; /** delivered while the guests were still patient */ onTime?: boolean };
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

/** The player's NoriPhone: look, unlocked designs and what was already seen (see ui/phone). */
export interface PhonePrefs {
  model: string;
  color: string;
  wallpaper: string;
  /** "kind:id" of every special design the player has earned */
  unlocked: string[];
  seen: { designs?: string[]; recipes?: number; quests?: number };
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
    /** 0..100, optional so older saves load: missing means rested */
    energy?: number;
  };
  raccoonOutfits: Record<string, { head: string; extra: string }>;
  coins: number;
  time: GameTime;
  inventory: Record<string, number>;
  recipesKnown: string[];
  recipesCooked: Record<string, number>;
  /** restaurant supplies kept in the kitchen pantry (ingredient id -> units); optional so older saves load */
  pantry?: Record<string, number>;
  /** hired staff (optional so older saves load) */
  staff?: import('../restaurant/staff').StaffSave;
  /** neighbours as customers: regulars' memory and planned visits (optional so older saves load) */
  clients?: import('../restaurant/townClients').ClientsSave;
  /** best time in hard mode, seconds per recipe */
  bestTimes?: Record<string, number>;
  /** mastery per recipe (see restaurant/mastery.ts); missing in older saves */
  recipeMastery?: Record<string, { n: number; g: number; p: number }>;
  /** Hand-cooked records, discovered variant ingredient IDs and chosen plate style. */
  recipeRecords?: Record<string, RecipeRecord>;
  restaurant: { level: number; xp: number; totalXp?: number; reputation: number; upgrades: string[]; served: number };
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
  /** Furniture an NPC accepted but could not place yet (npc id -> furniture ids). */
  storedGifts: Record<string, string[]>;
  clothesOwned: string[];
  collections: Record<string, Record<string, number>>; // category -> id -> count
  achievements: string[];
  garden: { plot: number; seed: string | null; plantedDay: number; watered: number; ready: boolean }[];
  photos: Photo[];
  stats: Record<string, number>;
  /** NoriPhone look; missing in older saves (defaults apply) */
  phone?: PhonePrefs;
}

export interface Settings {
  music: number;
  ambience: number;
  sfx: number;
  textScale: number;
  textSpeed: number;  // chars per second, 0 = instant
  reduceMotion: boolean;
  haptics?: boolean;
  /** key that opens / closes the NoriPhone on a keyboard */
  phoneKey?: string;
  joystick: boolean;
  cookMode: 'relaxed' | 'normal' | 'challenge';
  /** how a dish is cooked inside the restaurant: the act in the kitchen (default) or the gesture board */
  cookStyle?: 'act' | 'board';
  /** how long she sleeps by default (hours) */
  sleepHours?: number;
  settingsVersion?: number;
  /** objective arrow towards the tracked quest */
  guide?: boolean;
  /** effects quality: auto-detect, always high, or battery saver */
  perf?: 'auto' | 'high' | 'low';
  /** KeyboardEvent.code overrides. Missing actions use the defaults. Not part of the save. */
  bindings?: KeyBindings;
}
