/**
 * Living-town schedule. Pure aside from the save clock and story flags the caller passes in.
 * One stop per period stays the character's place; minutes only change what they do there.
 * Off screen this is the whole simulation: no pathfinding, no per-frame work.
 */
import { dayMinutes } from './daytime';
import type { CharacterDef, RoutineStop } from '../data/characters';
import { ZONES } from '../data/zones';
import { doorLeadingTo } from '../world/zoneRuntime';
import { lookAround } from './neighborSpots';

export type Phase = 'settle' | 'main' | 'meal' | 'stroll' | 'social' | 'depart';
export type ShopPhase = 'setup' | 'open' | 'closing' | 'closed';

export interface ShopPlace {
  id: string;
  title: string;
  /** Displayed minutes of day, shared with the HUD. */
  openAt: number;
  closeAt: number;
  hours: string;
  zone: string;
  keeper?: string;
  counter?: Omit<RoutineStop, 'zone'>;
  /** Sign tile inside the local, when the player is there. */
  sign: { x: number; y: number };
  /** Sign by the street door, so a closed shop reads from outside. */
  outdoor?: { zone: string; x: number; y: number };
}

export const BUSINESS_HOURS = { openAt: 8 * 60, closeAt: 23 * 60, hours: '08:00–23:00' } as const;
export const SHOP_PLACES: ShopPlace[] = [
  { ...BUSINESS_HOURS, id: 'taro', title: 'Almacén de Taro', zone: 'shop_taro', keeper: 'taro', counter: { x: 5, y: 3, act: 'work' }, sign: { x: 3, y: 7 }, outdoor: { zone: 'plaza', x: 24, y: 17 } },
  { ...BUSINESS_HOURS, id: 'yuki', title: 'Ropa de Yuki', zone: 'shop_yuki', keeper: 'yuki', counter: { x: 5, y: 3, act: 'work' }, sign: { x: 3, y: 7 }, outdoor: { zone: 'plaza', x: 23, y: 5 } },
  { ...BUSINESS_HOURS, id: 'bento', title: 'Panadería de Bento', zone: 'shop_bento', keeper: 'bento', counter: { x: 5, y: 3, act: 'work' }, sign: { x: 3, y: 7 }, outdoor: { zone: 'plaza', x: 8, y: 17 } },
  { ...BUSINESS_HOURS, id: 'sumi', title: 'Puesto de Sumi', zone: 'plaza', keeper: 'sumi', counter: { x: 21, y: 21, act: 'paint' }, sign: { x: 20, y: 21 } },
  { ...BUSINESS_HOURS, id: 'nami', title: 'Puesto de pescado', zone: 'beach', keeper: 'nami', counter: { x: 6, y: 9, act: 'work' }, sign: { x: 6, y: 9 } },
  { ...BUSINESS_HOURS, id: 'shells', title: 'Puesto de conchas', zone: 'beach', sign: { x: 10, y: 9 } },
  { ...BUSINESS_HOURS, id: 'library', title: 'Biblioteca', zone: 'library', keeper: 'kumo', counter: { x: 9, y: 7, act: 'read', seatLift: 12, dir: 'down' }, sign: { x: 4, y: 8 }, outdoor: { zone: 'plaza', x: 9, y: 23 } },
];

const SHOP_BY_ID: Record<string, ShopPlace> = Object.fromEntries(SHOP_PLACES.map((s) => [s.id, s]));

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
    const spot = lookAround(base.zone, hash(c.id, period), { x: base.x, y: base.y });
    if (spot) return { zone: base.zone, x: spot.x, y: spot.y, wander: 1, act: base.act === 'play' ? 'play' : 'look' };
    const dx = (hash(c.id, period) % 3) - 1;
    const dy = (hash(c.id, period + 9) % 3) - 1;
    return { ...base, x: base.x + (dx || 1), y: base.y + dy, wander: 1, act: 'look' };
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
  location?: string;
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

/** Open throughout the displayed 08:00–23:00 interval; transition notices never shorten service. */
export function businessPhase(period: number, minutes: number): ShopPhase {
  if (!Number.isFinite(period) || !Number.isFinite(minutes)) return 'closed';
  const now = dayMinutes(period, minutes);
  if (now < BUSINESS_HOURS.openAt) return now >= BUSINESS_HOURS.openAt - 10 ? 'setup' : 'closed';
  if (now < BUSINESS_HOURS.closeAt) return 'open';
  return now < BUSINESS_HOURS.closeAt + 10 ? 'closing' : 'closed';
}

// Same public hours; existing orders can still be finished after closing.
export const RESTAURANT_HOURS = BUSINESS_HOURS;
export const restaurantPhase = businessPhase;

const NIGHT_STALLS: Record<string, string> = {
  market_food: 'Dulces de luna', market_rare: 'Objetos raros', market_clothes: 'Ropa de luna', market_furn: 'Decoración nocturna',
};

export function shopStatus(id: string, q: ShopQuery): ShopStatus {
  if (NIGHT_STALLS[id] || id === 'shells' && q.location === 'market') {
    const open = q.period === 3;
    const title = NIGHT_STALLS[id] ?? 'Puesto de conchas';
    return { tracked: true, open, phase: open ? 'open' : 'closed', hours: 'Noches especiales (Mercado Nocturno)', title, detail: open ? '' : `${title} abre solamente durante el Mercado Nocturno.` };
  }
  const place = SHOP_BY_ID[id];
  if (!place) return { tracked: false, open: true, phase: 'open', hours: '', title: '', detail: '' };
  const base = { tracked: true, hours: place.hours, title: place.title };
  const closed = (detail: string): ShopStatus => ({ ...base, open: false, phase: 'closed', detail });
  if (q.shut) return closed(`${place.title} hoy no abre. Horario: ${place.hours}.`);
  if (q.force || q.storyHere) return { ...base, open: true, phase: 'open', detail: '' };
  const phase = businessPhase(q.period, q.minutes);
  if (phase === 'open' && place.keeper && q.keeperZone !== place.zone) {
    return closed(`${place.title} está cerrado: no hay nadie atendiendo. Horario: ${place.hours}.`);
  }
  if (phase === 'open') return { ...base, open: true, phase, detail: '' };
  if (phase === 'setup') return { ...base, open: false, phase, detail: `${place.title} está acomodando. Abren en un ratito. Horario: ${place.hours}.` };
  if (phase === 'closing') return { ...base, open: false, phase, detail: `${place.title} está cerrando. Horario: ${place.hours}.` };
  return closed(`${place.title} está cerrado. Horario: ${place.hours}.`);
}

/** Short status near an interaction; full hours belong in the opened UI. */
export function shopButtonLabel(status: ShopStatus, fallback: string): string {
  if (!status.tracked || status.open) return fallback;
  const head = status.phase === 'setup' ? 'Abre pronto' : status.phase === 'closing' ? 'Cerrando' : 'Cerrado';
  return `${fallback} · ${head}`;
}

/** Tiny single-line wooden plaque; an open façade needs no indicator. */
export function shopSignText(status: ShopStatus): string {
  if (!status.tracked || status.open) return '';
  return status.phase === 'setup' ? 'PRONTO' : status.phase === 'closing' ? 'CIERRA' : 'CERRADO';
}

export function shopInteractionText(status: ShopStatus, entrance = false): string {
  if (!status.tracked) return '';
  const info = status.open ? `${status.title} está atendiendo. Horario: ${status.hours}.` : status.detail;
  return entrance && !status.open ? `${info} La puerta está cerrada.` : info;
}

export function signSpots(zoneId: string): { shopId: string; x: number; y: number }[] {
  const out: { shopId: string; x: number; y: number }[] = [];
  for (const s of SHOP_PLACES) {
    if (s.zone === zoneId) out.push({ shopId: s.id, x: s.sign.x, y: s.sign.y });
    if (s.outdoor?.zone === zoneId) out.push({ shopId: s.id, x: s.outdoor.x, y: s.outdoor.y });
  }
  return out;
}
