/** Schedules and lines for street life, snow and the restaurant's street talk. No Phaser, no rewards. */
import { dayOfSeason, seasonOf } from '../core/balance';

/** Afternoon is the game. Dusk finishes the round. Morning, night, rain and winter stay quiet. */
export function hopscotchOpen(period: number, rain: boolean, season: number): boolean {
  if (rain || season === 3) return false;
  return period === 1 || period === 2;
}

export type VendorPhase = 'morning' | 'afternoon' | 'pack' | 'off';

/** Morning on a commercial corner, afternoon on another, dusk packs the cart, night is gone. */
export function vendorPhase(period: number): VendorPhase {
  if (period === 0) return 'morning';
  if (period === 1) return 'afternoon';
  if (period === 2) return 'pack';
  return 'off';
}

export function vendorLine(phase: VendorPhase, rain: boolean, roll: number): string {
  if (phase === 'pack' || phase === 'off') return 'Ya guardo el puesto.';
  if (rain) return roll < 0.5 ? 'Té caliente, con este tiempo.' : 'Pasá, el puesto no moja.';
  if (phase === 'morning') return roll < 0.5 ? 'Onigiri de la mañana.' : 'Recién salido.';
  return roll < 0.5 ? 'Té y dulces.' : 'Algo para la tarde.';
}

/** Discrete cover, 0 when it is not a dry winter day. Rain melts it. */
export function snowLevel(day: number, rain: boolean): 0 | 1 | 2 | 3 {
  if (seasonOf(day) !== 3 || rain) return 0;
  const d = dayOfSeason(day);
  if (d <= 4) return 1;
  if (d <= 9) return 2;
  return 3;
}

export interface ScentQuery {
  phase: string;
  level: number;
  reputation: number;
  lights: boolean;
  rain: boolean;
  period: number;
  /** A dish this neighbour actually liked, or null. Never invented. */
  dish: string | null;
  last: string | null;
  roll: number;
}

const SMELL = ['Huele a arroz recién hecho.', 'Sale vapor de la cocina.', 'Están cocinando.'];

/** One short line, or null when the restaurant is shut. Repeating the previous line is avoided. */
export function scentLine(q: ScentQuery): string | null {
  if (q.phase !== 'open' && q.phase !== 'setup' && q.phase !== 'closing') return null;
  const pool: string[] = [];
  if (q.dish) pool.push(`El ${q.dish} de acá sale rico.`);
  if (q.level >= 5) pool.push('Midnight Maki ya es parte del barrio.');
  else if (q.level >= 3) pool.push('El restaurante se ve más grande.');
  if (q.reputation >= 100) pool.push('Anoche estaba lleno.');
  else if (q.reputation >= 40) pool.push('Se lo recomiendo.');
  if (q.lights && q.period >= 2) pool.push('Las luces quedan cálidas.');
  if (q.rain) pool.push('Con lluvia se siente el olor.');
  pool.push(...SMELL);
  let i = Math.abs(Math.floor(q.roll * pool.length)) % pool.length;
  if (pool[i] === q.last && pool.length > 1) i = (i + 1) % pool.length;
  return pool[i];
}
