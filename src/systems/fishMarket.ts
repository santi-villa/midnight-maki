/** Fish tables, modest rod luck, and a confirmed sale. No path here sells the whole bag. */

export interface FishRow { id: string; weight: number; difficulty: number }

/** Same pools the minigame used before rods. `moonfish` is the chapter-3 night flag. */
export function fishTable(kind: 'sea' | 'lake', period: number, moonfish: boolean): FishRow[] {
  const rows: [string, number, number][] = kind === 'sea'
    ? [
        ['f_sardine', 30, 1], ['f_mackerel', 24, 1], ['f_starfish', 12, 1],
        ['f_tuna', period === 1 ? 14 : 5, 3], ['f_octopus', 6, 3],
        ['f_puffer', period === 3 ? 8 : 1, 2], ['f_moonfish', period === 3 && moonfish ? 3 : 0, 5],
      ]
    : [
        ['f_carp', 30, 1], ['f_trout', 26, 2], ['f_salmon', 22, 2],
        ['f_eel', period === 2 ? 12 : 3, 3], ['f_koi', period === 3 ? 3 : 0.5, 5],
      ];
  return rows.map(([id, weight, difficulty]) => ({ id, weight, difficulty }));
}

/** Difficulty 3 and up get a small weight bump. Commons stay on their original weight. */
export function applyRare(rows: readonly FishRow[], rare: number): FishRow[] {
  const mult = Number.isFinite(rare) && rare > 0 ? rare : 1;
  return rows.map((row) => ({ ...row, weight: row.difficulty >= 3 ? row.weight * mult : row.weight }));
}

export function expectedFishValue(rows: readonly FishRow[], priceOf: (id: string) => number): number {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return 0;
  return rows.reduce((sum, row) => sum + row.weight * priceOf(row.id), 0) / total;
}

export function rarityLabel(rarity?: number): string {
  if (rarity === 3) return 'Raro';
  if (rarity === 2) return 'Poco común';
  return 'Común';
}

/** One species, a chosen amount, never more than the player holds. */
export function quoteFishSale(unitPrice: number, owned: number, qty: number): { qty: number; total: number } | null {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  if (!Number.isFinite(owned) || owned < 1) return null;
  if (!Number.isFinite(qty)) return null;
  const n = Math.floor(qty);
  if (n < 1 || n > Math.floor(owned)) return null;
  return { qty: n, total: unitPrice * n };
}
