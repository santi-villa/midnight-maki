/**
 * Daily errands and a weekly goal. Optional, never expire into a penalty, never need real-time visits:
 * they follow the in-game calendar, and progress is just how far some counters moved since the errand was handed out.
 * The state is one JSON string in a save flag, so older saves need no migration.
 */
import { game } from '../core/state';

export type ErrandKind = 'serve' | 'good' | 'fish' | 'bug' | 'harvest' | 'gift' | 'gather' | 'photo' | 'project';

interface Template {
  kind: ErrandKind;
  stat: string;
  from: string;
  /** requester and their line */
  who: string;
  text: (n: number) => string;
  range: [number, number];
  weeklyRange?: [number, number];
  open: () => boolean;
}

const always = () => game.has('intro_done') || game.save.time.day >= 1;

export const TEMPLATES: Template[] = [
  { kind: 'serve', stat: 'served', from: 'Spicy', who: 'spicy', range: [2, 4], weeklyRange: [12, 18], open: always, text: (n) => `Servir ${n} platos. "¡Hoy quiero ver el salón lleno!"` },
  { kind: 'good', stat: 'goodServed', from: 'Rigg', who: 'rigg', range: [1, 3], weeklyRange: [5, 8], open: always, text: (n) => `Servir ${n} plato${n > 1 ? 's' : ''} muy bien hecho${n > 1 ? 's' : ''}. "La presentación importa."` },
  { kind: 'fish', stat: 'fishCaught', from: 'Nami', who: 'nami', range: [1, 3], open: () => game.has('unlock_beach'), text: (n) => `Pescar ${n} pez${n > 1 ? 'es' : ''}. "Hoy el mar está de buen humor."` },
  { kind: 'bug', stat: 'bugsCaught', from: 'Kiki', who: 'kiki', range: [1, 3], open: () => game.has('unlock_forest'), text: (n) => `Atrapar ${n} bicho${n > 1 ? 's' : ''}. "Con la red suave, ¿eh?"` },
  { kind: 'harvest', stat: 'harvests', from: 'Momo', who: 'momo', range: [1, 3], open: () => game.has('unlock_garden'), text: (n) => `Cosechar ${n} vez/veces en el jardín. "Las plantitas te esperan."` },
  { kind: 'gift', stat: 'gifts', from: 'Pip', who: 'pip', range: [1, 1], weeklyRange: [3, 4], open: always, text: (n) => `Regalarle algo a ${n > 1 ? `${n} vecinos` : 'un vecino'}. "Un detalle alegra el día."` },
  { kind: 'gather', stat: 'gathered', from: 'Taro', who: 'taro', range: [3, 6], open: always, text: (n) => `Recolectar ${n} cosas por el pueblo. "Siempre falta algo en el almacén."` },
  { kind: 'photo', stat: 'photos', from: 'Sumi', who: 'sumi', range: [1, 2], open: always, text: (n) => `Sacar ${n} foto${n > 1 ? 's' : ''}. "Hay luz linda hoy."` },
  { kind: 'project', stat: 'projectPhases', from: 'Momo', who: 'momo', range: [1, 1], weeklyRange: [1, 1], open: () => game.save.restaurant.level >= 2, text: () => 'Terminar una etapa de los proyectos del pueblo. "Poquito a poquito."' },
];

export interface Errand {
  id: string;
  kind: ErrandKind;
  goal: number;
  base: number;
  coins: number;
  claimed: boolean;
}

export interface DailyState {
  day: number;
  week: number;
  daily: Errand[];
  weekly: Errand[];
}

const KEY = 'daily_state';

/** Small deterministic generator, so the same day always gives the same errands. */
export function seeded(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const weekOf = (day: number) => Math.floor((Math.max(1, day) - 1) / 7);

const statNow = (k: string) => game.save.stats[k] ?? 0;

/** How many errands a day offers: more once more of the game is open. */
export function dailyCount(): number {
  return game.save.restaurant.level >= 3 ? 3 : 2;
}

export function makeErrands(seed: number, count: number, weekly: boolean, open: (t: Template) => boolean = (t) => t.open(), stats: (k: string) => number = statNow, level = game.save.restaurant.level): Errand[] {
  const rnd = seeded(seed);
  const pool = TEMPLATES.filter((t) => open(t) && (!weekly || t.weeklyRange));
  const out: Errand[] = [];
  const bag = [...pool];
  while (out.length < count && bag.length) {
    const t = bag.splice(Math.floor(rnd() * bag.length), 1)[0];
    const [lo, hi] = weekly ? t.weeklyRange! : t.range;
    const goal = lo + Math.floor(rnd() * (hi - lo + 1));
    const scale = 1 + Math.min(level, 8) * 0.12;
    const coins = Math.round((weekly ? 70 + goal * 6 : 22 + goal * 9) * scale);
    out.push({ id: `${weekly ? 'w' : 'd'}${seed}_${t.kind}`, kind: t.kind, goal, base: stats(t.stat), coins, claimed: false });
  }
  return out;
}

function parse(raw: unknown): DailyState | null {
  if (typeof raw !== 'string') return null;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || !Array.isArray(s.daily) || !Array.isArray(s.weekly)) return null;
    const okErr = (e: Errand) => e && typeof e.id === 'string' && typeof e.goal === 'number' && typeof e.base === 'number' && typeof e.coins === 'number' && TEMPLATES.some((t) => t.kind === e.kind);
    if (!s.daily.every(okErr) || !s.weekly.every(okErr)) return null;
    return { day: Number(s.day) || 0, week: Number(s.week) || 0, daily: s.daily, weekly: s.weekly };
  } catch {
    return null;
  }
}

/** The current errands; hands out new ones when the day or the week changed. Unclaimed old ones simply go away. */
export function ensureDaily(): DailyState {
  const day = game.save.time.day;
  const week = weekOf(day);
  let st = parse(game.save.flags[KEY]);
  let changed = false;
  if (!st) {
    st = { day: 0, week: -1, daily: [], weekly: [] };
    changed = true;
  }
  if (st.week !== week) {
    st.weekly = makeErrands(week * 7919 + 13, 1, true);
    st.week = week;
    changed = true;
  }
  if (st.day !== day) {
    st.daily = makeErrands(day * 9973 + 7, dailyCount(), false);
    st.day = day;
    changed = true;
  }
  if (changed) game.setFlag(KEY, JSON.stringify(st));
  return st;
}

const tpl = (kind: ErrandKind) => TEMPLATES.find((t) => t.kind === kind)!;

export function progressOf(e: Errand): number {
  return Math.max(0, Math.min(e.goal, statNow(tpl(e.kind).stat) - e.base));
}

export const isComplete = (e: Errand) => progressOf(e) >= e.goal;

export function errandText(e: Errand): string {
  return tpl(e.kind).text(e.goal);
}

export function errandFrom(e: Errand): string {
  return tpl(e.kind).from;
}

/** Pays the reward once. Returns the coins, or 0 when it was not ready or was already claimed. */
export function claimErrand(id: string): number {
  const st = ensureDaily();
  const e = [...st.daily, ...st.weekly].find((x) => x.id === id);
  if (!e || e.claimed || !isComplete(e)) return 0;
  e.claimed = true;
  game.setFlag(KEY, JSON.stringify(st));
  game.addCoins(e.coins, 'errand');
  game.stat('errandsDone');
  return e.coins;
}
