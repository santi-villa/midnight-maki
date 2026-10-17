/**
 * Town moments: when the restaurant grows, someone in the village notices and says so the next time you pass them.
 * Each one is said once (a flag remembers it). They need no new characters: the village reacts to what the player did.
 */
import { game } from '../core/state';
import { employees } from '../restaurant/staff';

export interface Moment { id: string; who: string; line: string; when: () => boolean }

const has = (u: string) => game.save.restaurant.upgrades.includes(u);
const level = () => game.save.restaurant.level;

export const MOMENTS: Moment[] = [
  { id: 'lights', who: 'momo', when: () => has('lights'), line: 'Vi los faroles nuevos de Midnight Maki desde la plaza. De noche se ven preciosos.' },
  { id: 'tables', who: 'bento', when: () => has('tables2') || has('second_room'), line: '¿Más mesas en Midnight Maki? Si hace falta pan para tantos, avisame.' },
  { id: 'staff', who: 'yuki', when: () => employees().length > 0, line: 'Vi a alguien nuevo con delantal en tu restaurante. Ya parece un lugar grande.' },
  { id: 'fame3', who: 'kumo', when: () => level() >= 3, line: 'Dicen que Midnight Maki ya tiene fama. Anoté el nombre en mi cuaderno, por las dudas.' },
  { id: 'display', who: 'sumi', when: () => has('display'), line: 'La vitrina de sushi quedó linda. Algún día la pinto, si me dejás.' },
  { id: 'fame5', who: 'nami', when: () => level() >= 5, line: 'Hasta los pescadores preguntan por tu restaurante. Les dije que pidan el atún.' },
  { id: 'rep', who: 'taro', when: () => game.save.restaurant.reputation >= 100, line: 'Desde que Midnight Maki está de moda, vendo el doble de jengibre. Gracias, eh.' },
];

/** What this character wants to say now, if anything. Call `markSeen` once it was said. */
export function pendingMoment(who: string): Moment | null {
  return MOMENTS.find((m) => m.who === who && !game.has('moment_' + m.id) && m.when()) ?? null;
}
export const markSeen = (m: Moment) => game.setFlag('moment_' + m.id);
