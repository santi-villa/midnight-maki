/** Collection bookkeeping + spawn tables for bugs and fish. */
import { seasonOf } from '../core/balance';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { rng } from '../art/pixel';
import { applyRare, fishTable } from './fishMarket';

const CAT_FOR: Record<string, string> = { fish: 'fish', bug: 'bugs', flower: 'flowers', shell: 'shells', rare: 'rare', material: 'rare' };

/** Give an item and record it in the collection album. Returns true if it's a first discovery. */
export function obtain(id: string, qty = 1, source = 'found'): boolean {
  const it = ITEMS_BY_ID[id];
  if (!it) return false;
  game.addItem(id, qty, source);
  const cat = CAT_FOR[it.cat];
  if (!cat) return false;
  if (it.cat === 'material' && !it.id.startsWith('st_')) return false;
  return game.collect(cat, id);
}

export function bugsFor(zone: string): string[] {
  const p = game.save.time.period;
  const day = game.save.time.day;
  const r = rng(day * 53 + p * 7 + zone.length * 11);
  if (game.flag('weather') === 'rain') return [];
  const pool: string[] = [];
  if (zone === 'garden') pool.push(p === 0 ? 'b_white' : 'b_sakura', 'b_ladybug', 'b_dragonfly');
  if (zone === 'plaza') pool.push(p === 1 ? 'b_sulphur' : 'b_white');
  if (zone === 'forest') pool.push(p === 3 ? 'b_beetle' : 'b_blue', 'b_ladybug');
  if (zone === 'station') pool.push('b_moth');
  if (p === 3) pool.push('b_firefly', 'b_moth');
  if (seasonOf(day) === 1 && zone === 'garden') pool.push('b_dragonfly');
  if (game.has('star_butterfly') && zone === 'garden' && p === 3) pool.push('b_star');
  const n = pool.length ? 1 + Math.floor(r() * 2) : 0;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(r() * pool.length)]);
  return out;
}

export interface FishRoll { id: string; difficulty: number; }

export function rollFish(kind: 'sea' | 'lake', rare = 1): FishRoll {
  const table = applyRare(fishTable(kind, game.save.time.period, game.has('ch3_done')), rare);
  const r = Math.random();
  const total = table.reduce((s, t) => s + t.weight, 0);
  let acc = 0;
  for (const row of table) {
    acc += row.weight;
    if (r * total <= acc) return { id: row.id, difficulty: row.difficulty };
  }
  return { id: table[0].id, difficulty: table[0].difficulty };
}

export function collectionProgress(): { cat: string; got: number; total: number }[] {
  const all = Object.values(ITEMS_BY_ID);
  const cats: [string, (c: string) => boolean][] = [
    ['fish', (c) => c === 'fish'], ['bugs', (c) => c === 'bug'], ['flowers', (c) => c === 'flower'], ['shells', (c) => c === 'shell'],
  ];
  return cats.map(([cat, f]) => {
    const items = all.filter((i) => f(i.cat));
    return { cat, got: items.filter((i) => game.collected(cat, i.id)).length, total: items.length };
  });
}
