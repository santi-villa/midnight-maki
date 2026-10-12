/** Save validation & migrations. DOM-free (tested in node). */
import { STARTER_CLOTHES } from '../data/clothes';
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
  for (const k of ['inventory', 'flags', 'relationships', 'decor', 'roomStyle', 'furnitureOwned', 'collections', 'stats', 'recipesCooked', 'raccoonOutfits']) {
    if (!isObj(out[k])) out[k] = {};
  }
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
  if (!Array.isArray(out.recipesKnown)) out.recipesKnown = base.recipesKnown;
  if (!Array.isArray(out.orders)) out.orders = [];
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
  out.nextUid = maxUid;
  return out as SaveData;
}
