/**
 * Three fishing rods. Each one helps a little. None of them fills the bar or forces a catch.
 * The basic rod is cheap enough to buy with the coins from the start of the game.
 */
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';

export interface RodDef {
  id: 'rod_basic' | 'rod_better' | 'rod_advanced';
  name: string;
  blurb: string;
  tier: 0 | 1 | 2;
  price: number;
  from?: RodDef['id'];
  items?: Record<string, number>;
  caught: number;
  zoneAdd: number;
  /** Below 1 slows the green zone, which makes it easier to follow the fish. */
  control: number;
  /** Multiplies progress only while the fish is inside the zone. Losing still drains it. */
  gain: number;
  /** Multiplies the weight of difficult fish. 1 leaves the old table untouched. */
  rare: number;
  /** Multiplies the wait before a bite. */
  bite: number;
  /** Multiplies how long the bite warning stays. */
  hook: number;
}

export const RODS: readonly RodDef[] = [
  {
    id: 'rod_basic', name: 'Caña básica', tier: 0, price: 40, caught: 0,
    blurb: 'Económica. Alcanza para los peces de todos los días.',
    zoneAdd: 0, control: 1, gain: 1, rare: 1, bite: 1, hook: 1,
  },
  {
    id: 'rod_better', name: 'Caña mejorada', tier: 1, price: 150, from: 'rod_basic', caught: 4,
    items: { wood: 2 },
    blurb: 'La zona verde se mueve más tranquila y los piques tardan un poco menos.',
    zoneAdd: 8, control: 0.86, gain: 1.1, rare: 1.12, bite: 0.88, hook: 1.1,
  },
  {
    id: 'rod_advanced', name: 'Caña avanzada', tier: 2, price: 360, from: 'rod_better', caught: 12,
    items: { wood: 3, stone: 1 },
    blurb: 'Más control y un poco más de suerte con peces raros. Igual se pueden escapar.',
    zoneAdd: 14, control: 0.74, gain: 1.18, rare: 1.28, bite: 0.75, hook: 1.2,
  },
];

export const ROD_BY_ID: Record<string, RodDef> = Object.fromEntries(RODS.map((rod) => [rod.id, rod]));

export interface RodWallet {
  coins: number;
  inventory: Record<string, number>;
  fishCaught: number;
}

export interface RodPlan {
  id: RodDef['id'];
  name: string;
  price: number;
  take: Record<string, number>;
  give: RodDef['id'];
}

export interface RodTune {
  name: string;
  zoneAdd: number;
  control: number;
  gain: number;
  rare: number;
  bite: number;
  hook: number;
}

const BARE: RodTune = { name: 'Sin caña', zoneAdd: 0, control: 1, gain: 1, rare: 1, bite: 1, hook: 1 };

export function bestRod(inventory: Record<string, number> | null | undefined): RodDef | null {
  let found: RodDef | null = null;
  for (const rod of RODS) {
    if ((inventory?.[rod.id] ?? 0) > 0 && (!found || rod.tier > found.tier)) found = rod;
  }
  return found;
}

export function tuneOf(id: string | null | undefined): RodTune {
  const rod = id ? ROD_BY_ID[id] : undefined;
  if (!rod) return BARE;
  return { name: rod.name, zoneAdd: rod.zoneAdd, control: rod.control, gain: rod.gain, rare: rod.rare, bite: rod.bite, hook: rod.hook };
}

/** Green band in the 160px column. Capped so a better rod still leaves room to miss. */
export function greenZone(difficulty: number, relaxed: boolean, tune: RodTune): number {
  const height = (relaxed ? 52 : 42) - difficulty * 3 + tune.zoneAdd;
  return Math.max(16, Math.min(72, height));
}

export function planRodPurchase(wallet: RodWallet, id: string): RodPlan | string {
  const rod = ROD_BY_ID[id];
  if (!rod) return 'Esa caña no está a la venta.';
  const owned = bestRod(wallet.inventory);
  if (owned && owned.tier >= rod.tier) return 'Ya tenés una caña así o mejor.';
  if (rod.from && (wallet.inventory[rod.from] ?? 0) < 1) return 'Primero conseguí la caña anterior.';
  if (wallet.fishCaught < rod.caught) return `Pescá ${rod.caught} peces para esta mejora. Llevás ${Math.max(0, Math.floor(wallet.fishCaught))}.`;
  for (const [item, qty] of Object.entries(rod.items ?? {})) {
    if ((wallet.inventory[item] ?? 0) < qty) return `Te falta ${qty} ${ITEMS_BY_ID[item]?.name ?? item}.`;
  }
  if (wallet.coins < rod.price) return 'No te alcanzan las monedas.';
  const take: Record<string, number> = { ...(rod.items ?? {}) };
  if (rod.from) take[rod.from] = (take[rod.from] ?? 0) + 1;
  return { id: rod.id, name: rod.name, price: rod.price, take, give: rod.id };
}

export function commitRodPlan(plan: RodPlan): boolean {
  for (const [id, qty] of Object.entries(plan.take)) if (game.count(id) < qty) return false;
  if (!game.spend(plan.price, 'rod')) return false;
  for (const [id, qty] of Object.entries(plan.take)) game.removeItem(id, qty);
  game.addItem(plan.give, 1, 'rod');
  return true;
}

/** Old saves that already fished keep a basic rod. A new game still has to buy one. */
export function grantStarterRod(save: { inventory: Record<string, number>; stats?: Record<string, number>; collections?: Record<string, Record<string, number>> }): void {
  if (bestRod(save.inventory)) return;
  const caught = save.stats?.fishCaught ?? 0;
  const holding = Object.keys(save.inventory).some((id) => id.startsWith('f_'));
  const album = save.collections?.fish && Object.keys(save.collections.fish).length > 0;
  if (caught > 0 || holding || album) save.inventory.rod_basic = 1;
}
