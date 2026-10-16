import type { FurnCat } from '../data/furniture';

/** Short chip labels, in the order they appear. Only a category you own is shown. */
export const DECOR_CATS: FurnCat[] = ['wall', 'plant', 'light', 'rug', 'bedroom', 'restaurant', 'kitchen', 'small', 'special', 'garden', 'bath'];

export const DECOR_CAT_LABEL: Record<FurnCat, string> = {
  wall: 'Pared',
  plant: 'Plantas',
  light: 'Luces',
  rug: 'Alfombras',
  bedroom: 'Cuarto',
  restaurant: 'Mesas',
  kitchen: 'Cocina',
  small: 'Chicos',
  special: 'Especial',
  garden: 'Jardín',
  bath: 'Baño',
};

export interface DecorChip { id: string; label: string }

/** Owned categories, then the pieces already in the room, then floor and wall. */
export function decorChips(owned: Record<string, number>, pieces: { id: string; cat: FurnCat }[]): DecorChip[] {
  const have = new Set<FurnCat>();
  for (const [id, n] of Object.entries(owned)) {
    if (!(n > 0)) continue;
    const piece = pieces.find((p) => p.id === id);
    if (piece) have.add(piece.cat);
  }
  const chips: DecorChip[] = DECOR_CATS.filter((c) => have.has(c)).map((c) => ({ id: c, label: DECOR_CAT_LABEL[c] }));
  chips.push({ id: 'room', label: 'En el cuarto' }, { id: 'style', label: 'Piso' });
  return chips;
}

/** Open on the first owned category. With an empty inventory, open on the room. */
export function firstDecorView(chips: { id: string }[]): string {
  return chips.find((c) => c.id !== 'room' && c.id !== 'style')?.id ?? 'room';
}

/** The tile under the finger becomes the middle of the footprint. A tall piece sits with its bottom on that tile. */
export function ghostAnchor(tx: number, ty: number, w: number, h: number): { x: number; y: number } {
  return { x: tx - Math.floor((w - 1) / 2), y: ty - (h - 1) };
}
