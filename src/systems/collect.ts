/** Collection bookkeeping + spawn tables for bugs and fish. */
import { seasonOf } from '../core/balance';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { rng } from '../art/pixel';

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

export function rollFish(kind: 'sea' | 'lake'): FishRoll {
  const p = game.save.time.period;
  const r = Math.random();
  const table: [string, number, number][] =
    kind === 'sea'
      ? [
          ['f_sardine', 30, 1], ['f_mackerel', 24, 1], ['f_starfish', 12, 1],
          ['f_tuna', p === 1 ? 14 : 5, 3], ['f_octopus', 6, 3],
          ['f_puffer', p === 3 ? 8 : 1, 2], ['f_moonfish', p === 3 && game.has('ch3_done') ? 3 : 0, 5],
        ]
      : [
          ['f_carp', 30, 1], ['f_trout', 26, 2], ['f_salmon', 22, 2],
          ['f_eel', p === 2 ? 12 : 3, 3], ['f_koi', p === 3 ? 3 : 0.5, 5],
        ];
  const total = table.reduce((s, t) => s + t[1], 0);
  let acc = 0;
  for (const [id, w, d] of table) {
    acc += w;
    if (r * total <= acc) return { id, difficulty: d };
  }
  return { id: table[0][0], difficulty: 1 };
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
