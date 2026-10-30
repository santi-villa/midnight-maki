/** Internal Villa Nori calendar (never tied to real dates). Events repeat every year in-game. */
import { BALANCE, dayOfSeason, seasonOf } from '../core/balance';

export interface CalendarEvent { id: string; name: string; season: number; day: number; desc: string; }

export const EVENTS: CalendarEvent[] = [
  { id: 'flowers', name: 'Festival de las Flores', season: 0, day: 10, desc: 'Concurso de flores en el jardín y decoración primaveral.' },
  { id: 'sushi', name: 'Festival del Sushi', season: 1, day: 7, desc: 'Competencia amistosa de recetas en la plaza.' },
  { id: 'raccoons', name: 'Día de los Mapaches', season: 1, day: 12, desc: 'Una celebración para Pip, Spicy Bacon y Rigg.' },
  { id: 'lanterns', name: 'Noche de Faroles', season: 2, day: 9, desc: 'El pueblo entero se ilumina.' },
  { id: 'moon', name: 'Mercado de la Luna', season: 3, day: 7, desc: 'Comerciantes especiales y objetos raros.' },
];

export function eventToday(day: number): string | null {
  const s = seasonOf(day);
  const d = dayOfSeason(day);
  return EVENTS.find((e) => e.season === s && e.day === d)?.id ?? null;
}

export function upcomingEvents(day: number, count = 3): { ev: CalendarEvent; inDays: number }[] {
  const out: { ev: CalendarEvent; inDays: number }[] = [];
  for (let k = 0; k < BALANCE.daysPerSeason * 4 && out.length < count; k++) {
    const id = eventToday(day + k);
    if (id) out.push({ ev: EVENTS.find((e) => e.id === id)!, inDays: k });
  }
  return out;
}
