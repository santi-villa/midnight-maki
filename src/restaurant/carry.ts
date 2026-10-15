import type { SaveData } from '../core/types';

/** A single shared limit for the service, UI and save validator. */
export function carryCapacity(save: SaveData): number {
  const u = save.restaurant.upgrades;
  return 1 + (u.includes('carry_tray') ? 1 : 0) + (u.includes('carry_tray2') ? 1 : 0) + (u.includes('carry_tray3') ? 1 : 0);
}
