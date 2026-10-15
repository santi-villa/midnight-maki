/** Save validation & migrations. DOM-free (tested in node). */
import { validateDining } from './dining';
import { normalizeRestaurant } from '../restaurant/progression';
import { carryCapacity } from '../restaurant/carry';
import { STARTER_CLOTHES } from '../data/clothes';
import { FURN_BY_ID } from '../data/furniture';
import { newSave, SAVE_VERSION } from '../core/state';
import type { SaveData } from '../core/types';

type Migration = (s: any) => any;

/** migrations[n] upgrades a save from version n to n+1 */
export const MIGRATIONS: Record<number, Migration> = {
  // 1: (s) => ({ ...s, newField: default, version: 2 }),
};

export class SaveError extends Error {}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Accepts unknown JSON, migrates it to the current version and fills any missing fields
 * with defaults. Throws SaveError if the data is not a Midnight Maki save.
 */
export function validateSave(raw: unknown): SaveData {
  if (!isObj(raw)) throw new SaveError('El archivo no contiene una partida.');
  let s: any = raw;
  if (typeof s.version !== 'number' || !isObj(s.player) || typeof s.coins !== 'number')
    throw new SaveError('El archivo no parece una partida de Midnight Maki.');
  if (s.version > SAVE_VERSION) throw new SaveError('La partida es de una versión más nueva del juego.');
  while (s.version < SAVE_VERSION) {
    const m = MIGRATIONS[s.version];
    if (!m) throw new SaveError(`No hay migración desde la versión ${s.version}.`);
    s = m(s);
  }
  // fill defaults for any missing keys (forward compatible, never drops data)
  const base = newSave() as any;
  const out: any = { ...base, ...s };
  // only merge structured sub-objects; collections like inventory/flags/decor are kept as saved
  for (const k of ['player', 'restaurant', 'time', 'quests', 'story']) {
    if (isObj(base[k]) && isObj(s[k])) out[k] = { ...base[k], ...s[k] };
  }
  // Inspect the raw optional value: new-game defaults must not erase an old XP remainder.
  out.restaurant.totalXp = s.restaurant?.totalXp;
  normalizeRestaurant(out.restaurant);
  for (const k of ['inventory', 'flags', 'relationships', 'decor', 'roomStyle', 'furnitureOwned', 'collections', 'stats', 'recipesCooked', 'recipeMastery', 'recipeRecords', 'raccoonOutfits']) {
    if (!isObj(out[k])) out[k] = {};
  }
  // Optional collection data is additive: old saves keep their mastery and served totals.
  // Do not invent scores or variant discoveries when those were never recorded.
  out.recipeRecords = Object.fromEntries(Object.entries(out.recipeRecords).filter(([, v]) => isObj(v)).map(([id, v]) => {
    const raw = v as Record<string, any>;
    const record = { ...raw, variants: {} } as Record<string, any>;
    for (const key of ['bestScore', 'bestQuality', 'bestDay']) {
      if (!Number.isFinite(raw[key])) delete record[key];
      else record[key] = Math.max(key === 'bestDay' ? 1 : 0, Math.min(key === 'bestScore' ? 100 : key === 'bestQuality' ? 2 : Number.MAX_SAFE_INTEGER, Math.floor(raw[key])));
    }
    if (!['classic', 'indigo', 'sakura', 'gold'].includes(raw.presentation)) delete record.presentation;
    if (isObj(raw.variants)) record.variants = Object.fromEntries(Object.entries(raw.variants).filter(([, v]) => isObj(v) && Number.isFinite(v.count) && v.count >= 1 && Number.isFinite(v.bestScore)).map(([item, v]) => {
      const variant = v as Record<string, number>;
      return [item, { count: Math.floor(variant.count), bestScore: Math.max(0, Math.min(100, Math.floor(variant.bestScore))) }];
    }));
    return [id, record];
  }));
  // legacy save compatibility: mika -> sumi
  if (out.relationships.mika) {
    if (!out.relationships.sumi) out.relationships.sumi = out.relationships.mika;
  }
  if (out.quests?.active?.sq_mika_photos && !out.quests.active.sq_sumi_photos) {
    out.quests.active.sq_sumi_photos = out.quests.active.sq_mika_photos;
    delete out.quests.active.sq_mika_photos;
  }
  if (Array.isArray(out.quests?.done)) {
    const idx = out.quests.done.indexOf('sq_mika_photos');
    if (idx >= 0) out.quests.done[idx] = 'sq_sumi_photos';
  }
  if (out.quests?.tracked === 'sq_mika_photos') {
    out.quests.tracked = 'sq_sumi_photos';
  }
  for (const [k, v] of Object.entries(out.flags)) {
    if (k.includes('mika')) {
      const newKey = k.replace(/mika/g, 'sumi');
      if (out.flags[newKey] === undefined) out.flags[newKey] = v;
    }
  }
  out.player.appearance = { ...base.player.appearance, ...(s.player?.appearance ?? {}) };
  // sanity
  out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
  for (const [id, q] of Object.entries(out.inventory as Record<string, number>)) {
    if (!Number.isFinite(q) || q <= 0) delete out.inventory[id];
    else out.inventory[id] = Math.floor(q);
  }
  for (const [id, q] of Object.entries(out.furnitureOwned as Record<string, number>)) {
    if (!Number.isFinite(q) || q <= 0) delete out.furnitureOwned[id];
  }
  out.storedGifts = {};
  if (isObj(s.storedGifts)) {
    for (const [npc, list] of Object.entries(s.storedGifts)) {
      if (!npc || !Array.isArray(list)) continue;
      const ids = list.filter((id): id is string => typeof id === 'string' && !!FURN_BY_ID[id]);
      if (ids.length) out.storedGifts[npc] = ids;
    }
  }
  if (!Array.isArray(out.recipesKnown)) out.recipesKnown = base.recipesKnown;
  if (!Array.isArray(out.orders)) out.orders = [];
  // New data is optional. Reject inconsistent service links instead of losing prepared dishes.
  for (const order of out.orders) {
    if (!order || typeof order !== 'object') throw new SaveError('La partida contiene un pedido inválido.');
    if (order.service && (!out.dining || typeof order.service.partyId !== 'string' || typeof order.service.memberId !== 'string' || typeof order.service.tableId !== 'string' || typeof order.service.seatId !== 'string' || (!Number.isFinite(order.service.day) || order.service.day < 1))) throw new SaveError('La partida contiene un pedido sin mesa válida.');
    if (order.plate && (![0, 1, 2].includes(order.plate.quality) || order.plate.state && !['ready', 'carried', 'delivered'].includes(order.plate.state))) throw new SaveError('La partida contiene un plato inválido.');
  }
  if (out.orders.filter((o: any) => o.plate?.state === 'carried').length > carryCapacity(out)) throw new SaveError('La partida contiene una bandeja de transporte inválida.');
  try { out.dining = validateDining(out.dining, out.orders); }
  catch { throw new SaveError('No se pudo validar el servicio del restaurante. Conservá una copia de esta partida.'); }
  if (!Array.isArray(out.garden) || out.garden.length < 6) out.garden = base.garden;
  out.recipesKnown = [...new Set(out.recipesKnown)];
  // starter clothes added in later versions are given to existing saves too
  out.clothesOwned = [...new Set([...(Array.isArray(out.clothesOwned) ? out.clothesOwned : []), ...STARTER_CLOTHES])];
  out.achievements = [...new Set(out.achievements)];
  out.time.period = Math.max(0, Math.min(3, Math.floor(out.time.period)));
  out.time.day = Math.max(1, Math.floor(out.time.day));
  // uid must stay above every placed furniture uid
  let maxUid = out.nextUid ?? 1;
  for (const list of Object.values(out.decor as Record<string, { uid: number }[]>)) for (const f of list) maxUid = Math.max(maxUid, f.uid + 1);
  for (const o of out.orders) maxUid = Math.max(maxUid, (o.uid ?? 0) + 1);
  for (const party of out.dining?.floor.parties ?? []) for (const member of party.members) for (const item of member.items) maxUid = Math.max(maxUid, (item.orderUid ?? 0) + 1);
  out.nextUid = maxUid;
  return out as SaveData;
}
