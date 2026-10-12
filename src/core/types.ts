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
}

export interface PlacedFurniture {
  uid: number;
  id: string;
  x: number;  // tile coords
  y: number;
  rot: number; // 0..3, only for rotatable
}

export interface Order {
  uid: number;
  recipe: string;
  customer: string;   // npc id or generic customer id
  reward: number;
  special?: string;   // marks story/quest orders
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
  restaurant: { level: number; xp: number; reputation: number; upgrades: string[]; served: number };
  orders: Order[];
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
  joystick: boolean;
  cookMode: 'relaxed' | 'normal' | 'challenge';
  settingsVersion?: number;
  /** objective arrow towards the tracked quest */
  guide?: boolean;
}
