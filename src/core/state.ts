/**
 * Central game state + safe mutators. DOM-free so it can be unit tested.
 * All gameplay systems change the save only through these helpers, which validate input
 * (no negative money, no negative items, idempotent rewards) and emit bus events.
 */
import { BALANCE } from './balance';
import { bus } from './events';
import type { Appearance, GameTime, Order, PlacedFurniture, RelationState, SaveData } from './types';
import { STARTER_CLOTHES } from '../data/clothes';
import { HERO_DEFAULTS } from '../art/hero';
import { STARTER_RECIPES } from '../data/recipes';
import { INGREDIENT_ALIASES } from '../data/items';

export const SAVE_VERSION = 1;

/** The look a new game starts with: Sofi (default) or Santiago, the two playable heroes. */
export function defaultAppearance(gender: 'm' | 'f' = 'f'): Appearance {
  const d = HERO_DEFAULTS[gender];
  return { species: 'human', skin: '#f2cfb3', hairStyle: 1, hairColor: '#5b3a2e', eyes: 0, eyeColor: '#5d4037', top: '', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '', ...d.app, hero: { ...d.look } };
}

export function newSave(name = 'Sofi', appearance: Appearance = defaultAppearance(), restaurantName = 'Midnight Maki'): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playMs: 0,
    player: { name, restaurantName, appearance, zone: 'arrival', x: 0, y: 0, dir: 'up' },
    raccoonOutfits: {},
    coins: BALANCE.startCoins,
    time: { day: 1, period: 0, minutes: 0 },
    inventory: { rice: 4, nori: 4, cucumber: 3, salmon: 2, umeboshi: 2 },
    recipesKnown: [...STARTER_RECIPES],
    recipesCooked: {},
    recipeMastery: {},
    recipeRecords: {},
    restaurant: { level: 1, xp: 0, totalXp: 0, reputation: 0, upgrades: [], served: 0 },
    orders: [],
    nextUid: 1,
    relationships: {},
    flags: {},
    quests: { active: {}, done: [], tracked: null },
    story: { chapter: 0, clues: [], decisions: {}, seenScenes: [] },
    decor: {},
    roomStyle: {},
    furnitureOwned: {},
    clothesOwned: [...STARTER_CLOTHES],
    collections: {},
    achievements: [],
    garden: [0, 1, 2, 3, 4, 5].map((plot) => ({ plot, seed: null, plantedDay: 0, watered: 0, ready: false })),
    photos: [],
    stats: {},
  };
}

class GameStore {
  save: SaveData = newSave();
  /** true after any mutation; persistence layer clears it after writing */
  revision = 0;
  dirty = false;
  loaded = false;

  load(s: SaveData) {
    this.revision++;
    this.save = s;
    this.loaded = true;
    this.dirty = false;
    bus.emit('state:changed', { reason: 'load' });
  }

  touch(reason: string) {
    this.revision++;
    this.dirty = true;
    this.save.updatedAt = Date.now();
    bus.emit('state:changed', { reason });
  }

  uid(): number {
    return this.save.nextUid++;
  }

  // ---------------------------------------------------------------- coins
  get coins() {
    return this.save.coins;
  }
  addCoins(n: number, reason = 'coins') {
    if (!Number.isFinite(n) || n === 0) return;
    n = Math.round(n);
    this.save.coins = Math.max(0, this.save.coins + n);
    if (n > 0) this.stat('coinsEarned', n);
    bus.emit('coins:changed', { coins: this.save.coins, delta: n });
    this.touch(reason);
  }
  /** Spend coins atomically. Returns false (and changes nothing) if not affordable. */
  spend(n: number, reason = 'spend'): boolean {
    if (!Number.isFinite(n) || n < 0) return false;
    if (this.save.coins < n) return false;
    this.save.coins -= n;
    bus.emit('coins:changed', { coins: this.save.coins, delta: -n });
    this.touch(reason);
    return true;
  }

  // ---------------------------------------------------------------- inventory
  count(id: string): number {
    return this.save.inventory[id] ?? 0;
  }
  /** count including aliases (e.g. caught salmon counts as salmon ingredient) */
  countUsable(id: string): number {
    let n = this.count(id);
    for (const [alias, target] of Object.entries(INGREDIENT_ALIASES)) if (target === id) n += this.count(alias);
    return n;
  }
  addItem(id: string, qty = 1, source = 'misc') {
    if (!id || !Number.isFinite(qty) || qty <= 0) return;
    this.save.inventory[id] = this.count(id) + Math.floor(qty);
    bus.emit('inventory:changed', { id, qty: this.save.inventory[id], delta: qty });
    bus.emit('item:collected', { id, source });
    this.touch('item');
  }
  removeItem(id: string, qty = 1): boolean {
    if (this.count(id) < qty) return false;
    this.save.inventory[id] = this.count(id) - qty;
    if (this.save.inventory[id] <= 0) delete this.save.inventory[id];
    bus.emit('inventory:changed', { id, qty: this.count(id), delta: -qty });
    this.touch('item');
    return true;
  }
  /** Consume an ingredient set using aliases when needed. Atomic: all or nothing. */
  consumeIngredients(req: Record<string, number>): boolean {
    for (const [id, q] of Object.entries(req)) if (this.countUsable(id) < q) return false;
    for (const [id, q] of Object.entries(req)) {
      let left = q;
      const direct = Math.min(this.count(id), left);
      if (direct) this.removeItem(id, direct);
      left -= direct;
      for (const [alias, target] of Object.entries(INGREDIENT_ALIASES)) {
        if (left <= 0) break;
        if (target !== id) continue;
        const use = Math.min(this.count(alias), left);
        if (use) this.removeItem(alias, use);
        left -= use;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- flags
  flag(key: string) {
    return this.save.flags[key];
  }
  has(key: string) {
    return !!this.save.flags[key];
  }
  setFlag(key: string, v: number | string | boolean = true) {
    if (this.save.flags[key] === v) return;
    this.save.flags[key] = v;
    bus.emit('flag:set', { key });
    this.touch('flag');
  }
  /** Run a reward exactly once (idempotent across saves). */
  once(key: string, fn: () => void): boolean {
    const k = 'once_' + key;
    if (this.save.flags[k]) return false;
    this.save.flags[k] = true;
    fn();
    this.touch('once');
    return true;
  }

  stat(key: string, n = 1) {
    this.save.stats[key] = (this.save.stats[key] ?? 0) + n;
  }

  // ---------------------------------------------------------------- relationships
  rel(id: string): RelationState {
    let r = this.save.relationships[id];
    if (!r) r = this.save.relationships[id] = { points: 0, lastTalkDay: 0, lastGiftDay: 0 };
    return r;
  }
  friendLevel(id: string): number {
    return Math.min(5, Math.floor(this.rel(id).points / BALANCE.friendshipPerLevel));
  }
  addFriendship(id: string, n: number) {
    const r = this.rel(id);
    const before = this.friendLevel(id);
    r.points = Math.max(0, Math.min(BALANCE.maxFriendship, r.points + n));
    const after = this.friendLevel(id);
    this.touch('friendship');
    return after > before ? after : 0;
  }

  // ---------------------------------------------------------------- collections
  collect(cat: string, id: string) {
    const c = (this.save.collections[cat] ??= {});
    const first = !c[id];
    c[id] = (c[id] ?? 0) + 1;
    this.touch('collect');
    return first;
  }
  collected(cat: string, id: string) {
    return !!this.save.collections[cat]?.[id];
  }

  // ---------------------------------------------------------------- decor
  room(id: string): PlacedFurniture[] {
    return (this.save.decor[id] ??= []);
  }

  // ---------------------------------------------------------------- orders
  addOrder(o: Omit<Order, 'uid'>) {
    this.save.orders.push({ ...o, uid: this.uid() });
    this.touch('order');
  }

  // ---------------------------------------------------------------- time
  get time(): GameTime {
    return this.save.time;
  }
}

export const game = new GameStore();
