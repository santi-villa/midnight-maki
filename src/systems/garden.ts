/** Garden plots: plant, water, harvest. Plants never die; they simply wait for you. */
import { game } from '../core/state';

export const SEED_INFO: Record<string, { days: number; yield: [string, number][]; name: string }> = {
  sd_cucumber: { days: 2, yield: [['cucumber', 3]], name: 'Pepino' },
  sd_scallion: { days: 1, yield: [['scallion', 3]], name: 'Verdeo' },
  sd_carrot: { days: 2, yield: [['carrot', 3]], name: 'Zanahoria' },
  sd_chili: { days: 3, yield: [['chili', 4]], name: 'Ají' },
  sd_flower: { days: 2, yield: [['fl_tulip', 1], ['fl_daisy', 2]], name: 'Flores' },
  sd_sakura: { days: 3, yield: [['sakura', 4]], name: 'Sakura' },
};

/** daily growth: a plot grows one stage per day it was watered (rain waters everything) */
export function growGarden(_day: number, rain: boolean) {
  for (const p of game.save.garden) {
    if (!p.seed || p.ready) continue;
    if (rain || p.watered > 0) {
      p.plantedDay = (p.plantedDay || 0) + 1; // reused as "days grown"
      p.watered = 0;
      if (p.plantedDay >= (SEED_INFO[p.seed]?.days ?? 2)) p.ready = true;
    }
  }
  game.touch('garden');
}

export function plant(plot: number, seed: string): boolean {
  const p = game.save.garden[plot];
  if (!p || p.seed || !SEED_INFO[seed]) return false;
  if (!game.removeItem(seed, 1)) return false;
  Object.assign(p, { seed, plantedDay: 0, watered: 0, ready: false });
  game.touch('garden');
  return true;
}

export function water(plot: number): boolean {
  const p = game.save.garden[plot];
  if (!p?.seed || p.ready || p.watered) return false;
  p.watered = 1;
  game.touch('garden');
  return true;
}

export function harvest(plot: number): [string, number][] | null {
  const p = game.save.garden[plot];
  if (!p?.seed || !p.ready) return null;
  const y = SEED_INFO[p.seed].yield;
  for (const [id, q] of y) game.addItem(id, q, 'garden');
  Object.assign(p, { seed: null, plantedDay: 0, watered: 0, ready: false });
  game.stat('harvests');
  game.touch('garden');
  return y;
}
