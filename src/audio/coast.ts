/** How loud the shore should be, and when cicadas or crickets belong. Pure numbers: the audio engine only ramps gains. */
import { shoreAt } from '../data/villageTerrain';
import { HOUSES } from '../data/houses';

const COAST = new Set(['beach', 'harbor', 'market']);
const TREES = new Set(['forest', 'garden', 'shrine', 'station', 'residential', 'plaza']);
const GREEN = new Set(['forest', 'garden', 'shrine', 'residential', 'plaza', 'station']);

/** 1 on the water. Quiet a few steps up the beach, gone before the plaza. */
const WAVE_NEAR = 1.5;
const WAVE_FAR = 8;

export function waveAt(worldX: number, worldY: number): number {
  const x = Math.max(0, Math.min(103, worldX));
  const inland = shoreAt(x) - worldY;
  if (inland <= WAVE_NEAR) return 1;
  if (inland >= WAVE_FAR) return 0;
  const t = (inland - WAVE_NEAR) / (WAVE_FAR - WAVE_NEAR);
  const s = t * t * (3 - 2 * t);
  return (1 - s) * (1 - s);
}

/** Indoors the sea is muffled on the coast and absent everywhere else. */
export function indoorWave(zoneId: string): number {
  if (zoneId === 'lighthouse') return 0.28;
  const home = HOUSES.find((h) => h.id === zoneId);
  if (home && COAST.has(home.zone)) return 0.2;
  return 0;
}

export function insectAt(zoneId: string, season: number, period: number, rain: boolean, outdoor: boolean): { cicadas: number; crickets: number } {
  if (!outdoor) return { cicadas: 0, crickets: 0 };
  const trees = TREES.has(zoneId);
  const green = GREEN.has(zoneId);
  let cicadas = 0;
  if (season === 1 && period <= 1) cicadas = (trees ? 0.8 : 0.4) * (rain ? 0.18 : 1);
  else if (season === 1 && period === 2 && !rain) cicadas = trees ? 0.2 : 0.08;
  let crickets = 0;
  if (period >= 2) {
    crickets = (green ? 0.75 : 0.4) * (period === 2 ? 0.72 : 1);
    if (season === 3) crickets *= 0.5;
    else if (season === 2) crickets *= 0.85;
    if (rain) crickets *= 0.32;
  }
  return { cicadas, crickets };
}

/** Outdoor walks fade longer. A door is shorter. Day into night is the slowest. */
export function musicFade(outdoor: boolean, wasOutdoor: boolean | null, night: boolean, wasNight: boolean | null): number {
  if (wasOutdoor === null) return 0.8;
  if (outdoor !== wasOutdoor) return 1.15;
  if (night !== wasNight) return 2.7;
  return 2.15;
}
