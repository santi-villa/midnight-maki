/**
 * Villa Nori as a clientele. Neighbours decide whether to eat at Midnight Maki: some come on their own, some come
 * because the player invited them, and the ones who liked it become regulars with a memory of the dishes they enjoyed
 * and how long they had to wait. Everything here is rules and seeded dice (testable); the world only asks
 * "who comes next?" and reports back what happened.
 */
import { rng } from '../art/pixel';
import { NEIGHBOR_BY_ID, NEIGHBORS, type Neighbor } from '../data/neighbors';
import { weekday } from '../core/balance';

export const NB_PREFIX = 'nb_';
export const customerOf = (neighborId: string) => NB_PREFIX + neighborId;
export const isTownCustomer = (customer: string) => customer.startsWith(NB_PREFIX) && !!NEIGHBOR_BY_ID[customer.slice(NB_PREFIX.length)];
export const neighborOf = (customer: string): Neighbor | null => (isTownCustomer(customer) ? NEIGHBOR_BY_ID[customer.slice(NB_PREFIX.length)] : null);

export interface Regular {
  visits: number;
  /** dishes they enjoyed (recipe id -> times) */
  likes: Record<string, number>;
  /** -3 (annoyed) .. +6 (devoted) */
  mood: number;
  last: number;
  /** long waits suffered (they remember) */
  waits: number;
  /** last day the player invited them */
  invited?: number;
}
export interface PlannedVisit { id: string; day: number; period: number }
export interface ClientsSave { regulars: Record<string, Regular>; planned: PlannedVisit[] }

export const emptyClients = (): ClientsSave => ({ regulars: {}, planned: [] });
const hash = (s: string) => { let h = 17; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h; };

// ------------------------------------------------------------------ demand
export interface DemandContext { period: number; day: number; rain: boolean; reputation: number; charm: number; festival: boolean; regulars: number }

/** Multiplier of how many people knock on the door (2 = twice as busy). Always between 0.4 and 2.2. */
export function demandFactor(c: DemandContext): number {
  const daypart = [0.7, 1, 1.35, 1.1][Math.max(0, Math.min(3, c.period))];
  const wd = weekday(c.day);
  const weekend = wd >= 5 ? 1.25 : wd === 0 ? 0.9 : 1;
  const rain = c.rain ? 0.85 : 1;
  const fame = 1 + Math.min(0.45, c.reputation / 400) + Math.min(0.15, c.charm / 300);
  const loyal = 1 + Math.min(0.2, c.regulars * 0.04);
  const f = daypart * weekend * rain * fame * loyal * (c.festival ? 1.3 : 1);
  return Math.max(0.4, Math.min(2.2, f));
}

// ------------------------------------------------------------------ invitations
export type Answer = 'yes' | 'later' | 'no';
export interface InviteResult { answer: Answer; period?: number; line: string }
export interface InviteContext { day: number; period: number; rain: boolean; mood: number; alreadyToday: boolean; alreadyPlanned: boolean }

/** How a neighbour answers "come eat at my restaurant": their personality, the weather and past visits decide. */
export function inviteResponse(n: Neighbor, c: InviteContext): InviteResult {
  if (c.alreadyPlanned) return { answer: 'yes', line: 'Ya te dije que voy. ¡No me olvido!' };
  if (c.alreadyToday) return { answer: 'no', line: 'Hoy ya me invitaste. Otro día, ¿sí?' };
  const r = rng(hash(n.id) + c.day * 131 + c.period)();
  const has = (t: Neighbor['traits'][number]) => n.traits.includes(t);
  let want = 0.55 + c.mood * 0.08;
  if (has('sociable')) want += 0.25;
  if (has('shy')) want -= 0.2;
  if (has('hardworking') && c.period < 2) want -= 0.15;
  if (c.rain) want += 0.05;
  if (c.mood <= -2) want -= 0.4;
  if (r > want) {
    return { answer: 'no', line: c.mood <= -2 ? 'La última vez esperé demasiado... quizá más adelante.' : has('shy') ? 'Gracias, pero... hoy no me animo.' : 'Hoy no puedo, ¡pero gracias por acordarte!' };
  }
  // when: nocturnal people come late, hard workers after the shift, the rest soon
  const period = has('nocturnal') ? 3 : has('hardworking') && c.period < 2 ? 2 : c.period;
  const sameDay = period === c.period;
  if (sameDay) return { answer: 'yes', period, line: has('sociable') ? '¡Claro! Voy ahora mismo.' : 'Está bien, paso en un ratito.' };
  const name = ['la mañana', 'la tarde', 'el atardecer', 'la noche'][period];
  return { answer: 'later', period, line: `Con gusto. Paso a la hora de ${name === 'la noche' ? 'cenar, de noche' : name}.` };
}

// ------------------------------------------------------------------ who comes next

/** Take the planned visit that is due (the day and period have arrived), skipping people already inside. */
export function dueVisit(s: ClientsSave, day: number, period: number, busy: (customer: string) => boolean): string | null {
  const i = s.planned.findIndex((p) => (p.day < day || (p.day === day && p.period <= period)) && !busy(customerOf(p.id)));
  if (i < 0) return null;
  return s.planned.splice(i, 1)[0].id;
}

/** Regulars drop by on their own now and then; the happier they are the likelier. Returns a neighbour id or null. */
export function regularDropIn(s: ClientsSave, day: number, roll: number, busy: (customer: string) => boolean): string | null {
  const options = Object.entries(s.regulars)
    .filter(([id, r]) => r.visits >= 2 && r.mood >= 1 && r.last < day && NEIGHBOR_BY_ID[id] && !busy(customerOf(id)))
    .map(([id, r]) => ({ id, w: r.mood + Math.min(3, r.visits / 3) }));
  if (!options.length) return null;
  const total = options.reduce((a, b) => a + b.w, 0);
  // about one visit in four arrivals comes from a regular once there are some
  if (roll > 0.25) return null;
  let pick = (roll / 0.25) * total;
  for (const o of options) { pick -= o.w; if (pick <= 0) return o.id; }
  return options[options.length - 1].id;
}

/** A neighbour who simply feels like a meal: sociable people and people with a shop nearby come more often. */
export function walkIn(day: number, period: number, roll: number, busy: (customer: string) => boolean, s: ClientsSave): string | null {
  if (roll > 0.18) return null;
  const pool = NEIGHBORS.filter((n) => !busy(customerOf(n.id)) && (s.regulars[n.id]?.last ?? 0) !== day && (s.regulars[n.id]?.mood ?? 0) > -3);
  if (!pool.length) return null;
  const weighted = pool.flatMap((n) => Array.from({ length: 1 + (n.traits.includes('sociable') ? 1 : 0) + (n.traits.includes('nocturnal') && period === 3 ? 1 : 0) }, () => n));
  return weighted[Math.floor(((roll / 0.18) * 997 + day) % weighted.length)].id;
}

// ------------------------------------------------------------------ memory
export function plan(s: ClientsSave, id: string, day: number, period: number) {
  if (!s.planned.some((p) => p.id === id)) s.planned.push({ id, day, period });
}

export function recordInvite(s: ClientsSave, id: string, day: number) {
  const r = (s.regulars[id] ??= { visits: 0, likes: {}, mood: 0, last: 0, waits: 0 });
  r.invited = day;
}

/** One finished meal: a good dish is remembered, a bad dish or a long wait too. `waited` is true when they got impatient. */
export function recordMeal(s: ClientsSave, customer: string, recipe: string, quality: 0 | 1 | 2, waited: boolean, day: number) {
  const n = neighborOf(customer);
  if (!n) return;
  const r = (s.regulars[n.id] ??= { visits: 0, likes: {}, mood: 0, last: 0, waits: 0 });
  r.last = day;
  if (quality >= 1) r.likes[recipe] = (r.likes[recipe] ?? 0) + (quality === 2 ? 2 : 1);
  r.mood = Math.max(-3, Math.min(6, r.mood + (quality === 2 ? 1 : quality === 1 ? 0.5 : -0.5) + (waited ? -1 : 0)));
  if (waited) r.waits++;
}

export function recordVisit(s: ClientsSave, customer: string, day: number, leftHappy: boolean) {
  const n = neighborOf(customer);
  if (!n) return;
  const r = (s.regulars[n.id] ??= { visits: 0, likes: {}, mood: 0, last: 0, waits: 0 });
  r.visits++; r.last = day;
  if (!leftHappy) r.mood = Math.max(-3, r.mood - 0.5);
}

/** The dish a regular asks for: one they enjoyed before most of the time, otherwise whatever the hat gives. */
export function rememberedDish(s: ClientsSave, customer: string, known: string[], roll: number): string | null {
  const n = neighborOf(customer);
  const r = n && s.regulars[n.id];
  if (!r) return null;
  const liked = Object.entries(r.likes).filter(([id]) => known.includes(id)).sort((a, b) => b[1] - a[1]);
  return liked.length && roll < 0.65 ? liked[0][0] : null;
}

export const regularsCount = (s: ClientsSave) => Object.values(s.regulars).filter((r) => r.visits >= 2 && r.mood >= 1).length;

/** A line for the way a regular arrives, using what they remember. */
export function arrivalLine(s: ClientsSave, customer: string, recipeName: (id: string) => string): string {
  const n = neighborOf(customer);
  const r = n && s.regulars[n.id];
  if (!n) return '';
  if (!r || r.visits === 0) return r?.invited ? '¡Acá estoy! Gracias por la invitación.' : '¿Hay lugar? Me dio curiosidad.';
  if (r.waits > r.visits / 2 && r.mood < 1) return 'Vuelvo a probar... espero no esperar tanto esta vez.';
  const fav = Object.entries(r.likes).sort((a, b) => b[1] - a[1])[0];
  if (fav) return `¡Hola de nuevo! Todavía me acuerdo del ${recipeName(fav[0])}.`;
  return '¡Otra vez por acá!';
}
