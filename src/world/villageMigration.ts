/** A one-time position migration; progress, house IDs, crops and decoration retain their saved data. */
import type { SaveData } from '../core/types';
import { VILLAGE_REVISION } from '../data/villageGeography';
export const VILLAGE_ARRIVALS: Record<string, { x: number; y: number }> = {
  plaza: { x: 21, y: 30 }, forest: { x: 21, y: 22 }, garden: { x: 21, y: 14 },
  beach: { x: 22, y: 6 }, station: { x: 18, y: 21 }, market: { x: 21, y: 6 },
};
export function migrateVillagePosition(save: SaveData): boolean {
  if (Number(save.flags.village_layout ?? 0) >= VILLAGE_REVISION) return false;
  const at = VILLAGE_ARRIVALS[save.player.zone];
  if (at) Object.assign(save.player, at);
  for (const [flag, value] of Object.entries(save.flags)) {
    if (!flag.startsWith('at_') || typeof value !== 'string') continue;
    const [zone, , , act] = value.split(',');
    const p = VILLAGE_ARRIVALS[zone];
    if (p) save.flags[flag] = `${zone},${p.x},${p.y},${act ?? ''}`;
  }
  save.flags.village_layout = VILLAGE_REVISION;
  return true;
}
