/**
 * Small things villagers do while they wait in their place: look around, sip a tea, paint a stroke, watch the rain. Pure and
 * seeded by the caller's dice, so it can be tested; the scene plays the pose for a few seconds and goes back to the routine.
 */
import type { NpcAct } from '../data/characters';

export interface Micro { act: NpcAct | 'happy' | 'wave'; seconds: number; say?: string }
export interface MicroCtx { act?: NpcAct; period: number; rain: boolean; outdoor: boolean }

const M = (act: Micro['act'], seconds: number, say?: string): Micro => ({ act, seconds, say });
const OWN: Record<string, Micro[]> = {
  pip: [M('happy', 2.2, '¡Mirá! ¡Una hormiga!'), M('look', 3), M('play', 5)],
  spicy: [M('cook', 4), M('happy', 2, '¡Una pizca de picante!'), M('look', 3)],
  rigg: [M('look', 4), M('read', 5), M('look', 3, 'Mm. Anotado.')],
  taro: [M('work', 4), M('look', 3), M('happy', 2, '¡Buen día para vender!')],
  yuki: [M('work', 5), M('look', 3)],
  bento: [M('drink', 4), M('work', 5), M('happy', 2, '¡Qué olor a pan!')],
  sumi: [M('paint', 6), M('look', 3, 'Mmm... falta un poco de azul.')],
  nami: [M('fish', 6), M('look', 3), M('happy', 2, '¡El mar está de buenas!')],
  kumo: [M('read', 7), M('look', 3)],
  hoshi: [M('stars', 6), M('look', 3)],
  momo: [M('clean', 5), M('look', 3), M('happy', 2, 'Las flores me escuchan, ¿sabés?')],
  kiki: [M('happy', 2, '¡Ya sé por dónde seguir!'), M('look', 3)],
  sora: [M('look', 3), M('work', 3, 'A ver... ¿para quién era esta?')],
  ume: [M('drink', 5), M('sit', 6), M('look', 3)],
  akio: [M('look', 5)],
};
const ANY = [M('look', 3), M('happy', 2), M('wave', 1.3)];
const RAIN = [M('look', 4, '¡Cómo llueve!'), M('look', 4, 'Se va a mojar todo...'), M('happy', 2, 'Me encanta el sonido de la lluvia.')];
const NIGHT = [M('stars', 5, 'Qué noche linda.'), M('look', 4)];

/** Something to do right now, or nothing. `roll` picks whether and what (0..1 each). */
export function microFor(id: string, c: MicroCtx, rollWhether: number, rollWhat: number): Micro | null {
  if (c.act === 'sleep' || c.act === 'eat') return null;
  if (rollWhether > 0.5) return null;
  const pool: Micro[] = [...(OWN[id] ?? []), ...ANY];
  if (c.rain && c.outdoor) pool.unshift(...RAIN, ...RAIN);
  if (c.period === 3 && c.outdoor) pool.unshift(...NIGHT);
  const m = pool[Math.min(pool.length - 1, Math.floor(rollWhat * pool.length))];
  // someone doing their own pose keeps doing it: never swap a held pose for another trade's
  return m;
}
