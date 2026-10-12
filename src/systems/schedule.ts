/**
 * Living-town schedule. Pure aside from the save clock and story flags the caller passes in.
 * One stop per period stays the character's place; minutes only change what they do there.
 * Off screen this is the whole simulation: no pathfinding, no per-frame work.
 */
import { BALANCE } from '../core/balance';
import type { CharacterDef, RoutineStop } from '../data/characters';
import { ZONES } from '../data/zones';
import { doorLeadingTo } from '../world/zoneRuntime';

export type Phase = 'settle' | 'main' | 'meal' | 'stroll' | 'social' | 'depart';
export type ShopPhase = 'setup' | 'open' | 'closing' | 'closed';

export interface ShopPlace {
  id: string;
  title: string;
  /** Periods of the shift, in order. Setup happens once at the start, closing once at the end. */
  periods: number[];
  openAt: number;
  closeAt: number;
  hours: string;
  zone: string;
  keeper?: string;
  /** Sign tile inside the local, when the player is there. */
  sign: { x: number; y: number };
  /** Sign by the street door, so a closed shop reads from outside. */
  outdoor?: { zone: string; x: number; y: number };
}

export const SHOP_PLACES: ShopPlace[] = [
  { id: 'taro', title: 'Almacén de Taro', periods: [0, 1], openAt: 12, closeAt: 78, hours: 'Mañana y tarde', zone: 'shop_taro', keeper: 'taro', sign: { x: 5, y: 6 }, outdoor: { zone: 'plaza', x: 27, y: 19 } },
  { id: 'yuki', title: 'Ropa de Yuki', periods: [0, 1], openAt: 12, closeAt: 78, hours: 'Mañana y tarde', zone: 'shop_yuki', keeper: 'yuki', sign: { x: 5, y: 6 }, outdoor: { zone: 'plaza', x: 26, y: 7 } },
  { id: 'bento', title: 'Panadería de Bento', periods: [0, 1], openAt: 12, closeAt: 78, hours: 'Mañana y tarde', zone: 'shop_bento', keeper: 'bento', sign: { x: 5, y: 6 }, outdoor: { zone: 'plaza', x: 5, y: 19 } },
  { id: 'sumi', title: 'Puesto de Sumi', periods: [0], openAt: 12, closeAt: 78, hours: 'Mañanas', zone: 'plaza', keeper: 'sumi', sign: { x: 20, y: 21 } },
  { id: 'nami', title: 'Puesto de pescado', periods: [1], openAt: 12, closeAt: 78, hours: 'Tardes', zone: 'beach', keeper: 'nami', sign: { x: 6, y: 9 } },
  { id: 'shells', title: 'Puesto de conchas', periods: [1, 2], openAt: 12, closeAt: 78, hours: 'Tarde y atardecer', zone: 'beach', sign: { x: 10, y: 9 } },
];

const SHOP_BY_ID: Record<string, ShopPlace> = Object.fromEntries(SHOP_PLACES.map((s) => [s.id, s]));

/** Where someone likes to linger when their period already puts them in that zone. */
const FAVORITE: Record<string, { zone: string; x: number; y: number }> = {
  pip: { zone: 'plaza', x: 15, y: 13 },
  rigg: { zone: 'plaza', x: 11, y: 22 },
  momo: { zone: 'garden', x: 15, y: 11 },
  kumo: { zone: 'plaza', x: 11, y: 21 },
  sumi: { zone: 'plaza', x: 21, y: 21 },
  kiki: { zone: 'forest', x: 14, y: 15 },
  nami: { zone: 'beach', x: 19, y: 12 },
  sora: { zone: 'plaza', x: 11, y: 8 },
  hoshi: { zone: 'plaza', x: 16, y: 9 },
  ume: { zone: 'plaza', x: 18, y: 14 },
  taro: { zone: 'plaza', x: 16, y: 15 },
  yuki: { zone: 'plaza', x: 13, y: 15 },
};

/** On a festival afternoon or evening these neighbors come to the plaza. Shopkeepers stay at work. */
export const FESTIVAL_SPOT: Record<string, RoutineStop> = {
  sumi: { zone: 'plaza', x: 21, y: 21, wander: 2, act: 'paint' },
  momo: { zone: 'plaza', x: 18, y: 12, wander: 2, act: 'work' },
  kiki: { zone: 'plaza', x: 16, y: 10, wander: 3 },
  sora: { zone: 'plaza', x: 12, y: 12, wander: 3 },
};

const SHOP_ZONES = new Set(['shop_taro', 'shop_yuki', 'shop_bento']);

/** Exclusive end minute of each beat. The next beat starts on that minute. */
const BEAT = { settle: 12, main: 36, meal: 50, stroll: 70, social: 82 } as const;

export function phaseOf(minutes: number): Phase {
  if (minutes < BEAT.settle) return 'settle';
  if (minutes < BEAT.main) return 'main';
  if (minutes < BEAT.meal) return 'meal';
  if (minutes < BEAT.stroll) return 'stroll';
  if (minutes < BEAT.social) return 'social';
  return 'depart';
}

export function pace(id: string): number {
  return 0.88 + (hash(id) % 21) / 100;
}

export function cameFrom(c: CharacterDef, period: number): string {
  return c.routine[(period + 3) % 4].zone;
}

/** Tile where someone arrives in `dest` after leaving `from`. */
export function arrivalTile(dest: string, from: string): { x: number; y: number } | null {
  if (!dest || !from || dest === from) return null;
  const direct = ZONES[from]?.doors.find((d) => d.to === dest && d.walk !== false);
  if (direct) return { x: direct.tx, y: direct.ty };
  const back = doorLeadingTo(dest, from);
  return back ? { x: back.x, y: back.y } : null;
}

function hash(s: string, n = 0): number {
  let h = (n + 17) >>> 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** What they do at the period's place. The zone never changes here, so quests can still find them. */
export function applyBeat(c: CharacterDef, period: number, minutes: number, base: RoutineStop, hold = false): RoutineStop {
  if (base.act === 'sleep') return { ...base, wander: Math.min(base.wander ?? 0, 1) };
  const phase = phaseOf(minutes);
  const next = c.routine[(period + 1) % 4];
  if (phase === 'depart' && !hold && next.zone !== base.zone) {
    const door = doorLeadingTo(base.zone, next.zone);
    if (door) return { zone: base.zone, x: door.x, y: door.y, wander: 0, act: 'look' };
    return { ...base, wander: 0, act: 'look' };
  }
  if (base.act === 'fish' || base.act === 'stars') {
    if (phase === 'meal') return { ...base, act: 'drink', wander: 0 };
    return base;
  }
  if (phase === 'settle') {
    const working = base.act === 'cook' || base.act === 'work' || base.act === 'paint' || SHOP_ZONES.has(base.zone);
    return { ...base, act: working ? 'clean' : 'look', wander: Math.min(base.wander ?? 0, 1) };
  }
  if (phase === 'meal') {
    const act = hash(c.id) % 2 === 0 ? 'eat' : 'drink';
    return { ...base, act, wander: 0 };
  }
  if (phase === 'stroll') {
    if ((base.wander ?? 0) <= 0) return { ...base, act: base.act === 'cook' ? 'cook' : 'clean' };
    const fav = FAVORITE[c.id];
    if (fav && fav.zone === base.zone && (fav.x !== base.x || fav.y !== base.y)) {
      return { zone: base.zone, x: fav.x, y: fav.y, wander: 1 };
    }
    const dx = (hash(c.id, period) % 3) - 1;
    const dy = (hash(c.id, period + 9) % 3) - 1;
    return { ...base, x: base.x + (dx || 1), y: base.y + dy, wander: 1 };
  }
  if (phase === 'social') return { ...base, act: 'talk', wander: Math.min(base.wander ?? 0, 2) };
  if (!base.act && SHOP_ZONES.has(base.zone)) return { ...base, act: 'work' };
  return base;
}

export interface ShopQuery {
  period: number;
  minutes: number;
  festival: boolean;
  force: boolean;
  shut: boolean;
  /** Story flag placed the keeper, and this is the zone they are actually in. */
  storyHere: boolean;
  keeperZone: string | null;
}

export interface ShopStatus {
  tracked: boolean;
  open: boolean;
  phase: ShopPhase;
  hours: string;
  title: string;
  /** Toast when a purchase is refused. Empty while open. */
  detail: string;
}

export function shopPlace(id: string): ShopPlace | undefined {
  return SHOP_BY_ID[id];
}

function phaseIn(periods: number[], period: number, minutes: number, openAt: number, closeAt: number): ShopPhase {
  if (!periods.includes(period)) return 'closed';
  const continues = periods.includes(period - 1);
  const closes = !periods.includes(period + 1);
  const start = continues ? 0 : openAt;
  const end = closes ? closeAt : BALANCE.periodMinutes;
  if (minutes < start) return 'setup';
  if (minutes >= end) return 'closing';
  return 'open';
}

/**
 * Public service at Midnight Maki. This is not a shop: the player hosts, so the
 * room stays open when Pip, Spicy or Rigg are somewhere else. Morning is the
 * closed prep period. Afternoon and dusk are open from the first minute. Night
 * stays open through the meal beat, then closes for the stroll and for the
 * frozen end of the night (the clock already stops at minute 90).
 */
export const RESTAURANT_HOURS = {
  periods: [1, 2, 3],
  openAt: 0,
  closeAt: BEAT.meal,
  hours: 'Tarde, atardecer y el comienzo de la noche',
};

export function restaurantPhase(period: number, minutes: number): ShopPhase {
  const p = Number.isFinite(period) ? Math.floor(period) : 0;
  const m = Number.isFinite(minutes) ? minutes : RESTAURANT_HOURS.closeAt;
  return phaseIn([...RESTAURANT_HOURS.periods], p, m, RESTAURANT_HOURS.openAt, RESTAURANT_HOURS.closeAt);
}

export function shopStatus(id: string, q: ShopQuery): ShopStatus {
  const place = SHOP_BY_ID[id];
  if (!place) return { tracked: false, open: true, phase: 'open', hours: '', title: '', detail: '' };
  const base = { tracked: true, hours: place.hours, title: place.title };
  const closed = (detail: string): ShopStatus => ({ ...base, open: false, phase: 'closed', detail });
  if (q.shut) return closed(`${place.title} hoy no abre.`);
  if (q.force || q.storyHere) return { ...base, open: true, phase: 'open', detail: '' };
  const periods = [...place.periods];
  if (q.festival && q.keeperZone === place.zone && q.period <= 2 && !periods.includes(q.period)) periods.push(q.period);
  const phase = phaseIn(periods, q.period, q.minutes, place.openAt, place.closeAt);
  if (place.keeper && q.keeperZone !== place.zone) {
    return closed(`${place.title} está cerrado: no hay nadie atendiendo. Horario: ${place.hours}.`);
  }
  if (phase === 'open') return { ...base, open: true, phase, detail: '' };
  if (phase === 'setup') return { ...base, open: false, phase, detail: `${place.title} está acomodando. Abren en un ratito. Horario: ${place.hours}.` };
  if (phase === 'closing') return { ...base, open: false, phase, detail: `${place.title} está cerrando. Horario: ${place.hours}.` };
  return closed(`${place.title} está cerrado. Horario: ${place.hours}.`);
}

export function shopButtonLabel(status: ShopStatus, fallback: string): string {
  if (!status.tracked || status.open) return fallback;
  if (status.phase === 'setup') return `Abre pronto · ${status.hours}`;
  if (status.phase === 'closing') return `Cerrando · ${status.hours}`;
  return `Cerrado · ${status.hours}`;
}

export function shopSignText(status: ShopStatus): string {
  if (!status.tracked) return '';
  const head = status.phase === 'open' ? 'Abierto' : status.phase === 'setup' ? 'Abre pronto' : status.phase === 'closing' ? 'Cerrando' : 'Cerrado';
  return `${head}\n${status.hours}`;
}

export function signSpots(zoneId: string): { shopId: string; x: number; y: number }[] {
  const out: { shopId: string; x: number; y: number }[] = [];
  for (const s of SHOP_PLACES) {
    if (s.zone === zoneId) out.push({ shopId: s.id, x: s.sign.x, y: s.sign.y });
    if (s.outdoor?.zone === zoneId) out.push({ shopId: s.id, x: s.outdoor.x, y: s.outdoor.y });
  }
  return out;
}
