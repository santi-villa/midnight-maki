import type { SaveData } from '../core/types';

/** A single shared limit for the service, UI and save validator. */
export function carryCapacity(save: SaveData): number {
  return save.restaurant.upgrades.includes('carry_tray') ? 2 : 1;
}
