import { haptic } from '../core/haptics';
/** Optional errands follow the game calendar. The saved JSON flag also preserves legacy assignments. */
import { game } from '../core/state';
import { activityCount as statNow } from '../core/activityCounters';
import { CHAR_BY_ID } from '../data/characters';
import { FURN_BY_ID } from '../data/furniture';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES } from '../data/recipes';
import { projectDone, visibleProjects } from '../restaurant/projects';

export type ErrandKind = 'serve' | 'good' | 'fish' | 'bug' | 'harvest' | 'gift' | 'gather' | 'photo' | 'project' | 'cook' | 'variant' | 'water' | 'decorate' | 'sort' | 'deliver';
type Group = 'kitchen' | 'neighbors' | 'nature' | 'home';
export interface ErrandReward { items?: Record<string, number>; furniture?: Record<string, number>; friendship?: { who: string; points: number }; }
interface Template {
  kind: ErrandKind; stat: string; from: string; who: string; group: Group;
  text: (n: number) => string; hint: string; range: [number, number]; weeklyRange?: [number, number]; open: () => boolean;
}
const always = () => game.has('intro_done') || game.save.time.day >= 1;
export const TEMPLATES: Template[] = [
  { kind: 'serve', stat: 'served', from: 'Spicy', who: 'spicy', group: 'kitchen', range: [2, 4], weeklyRange: [12, 18], open: always, text: (n) => `Servir ${n} ${n === 1 ? 'plato' : 'platos'}. "¡Hoy quiero ver el salón lleno!"`, hint: 'Los pedidos cuentan cuando el cliente paga; cocinar en modo Rápido también sirve.' },
  { kind: 'good', stat: 'goodServed', from: 'Rigg', who: 'rigg', group: 'kitchen', range: [1, 3], weeklyRange: [5, 8], open: always, text: (n) => `Servir ${n} ${n === 1 ? 'plato muy bien hecho' : 'platos muy bien hechos'}. "La presentación importa."`, hint: 'Cuenta un plato bueno o perfecto cuando el cliente paga.' },
  { kind: 'fish', stat: 'fishCaught', from: 'Nami', who: 'nami', group: 'nature', range: [1, 3], weeklyRange: [4, 7], open: () => game.has('unlock_beach'), text: (n) => `Pescar ${n} ${n === 1 ? 'pez' : 'peces'}. "Hoy el mar está de buen humor."`, hint: 'Pescá en la playa; no hace falta vender ni entregar los peces.' },
  { kind: 'bug', stat: 'bugsCaught', from: 'Kiki', who: 'kiki', group: 'nature', range: [1, 3], weeklyRange: [4, 7], open: () => game.has('unlock_forest'), text: (n) => `Atrapar ${n} ${n === 1 ? 'bicho' : 'bichos'}. "Con la red suave, ¿eh?"`, hint: 'Usá la red en el bosque o la plaza. Los bichos quedan en tu mochila.' },
  { kind: 'harvest', stat: 'harvests', from: 'Momo', who: 'momo', group: 'nature', range: [1, 3], weeklyRange: [3, 5], open: () => game.has('unlock_garden'), text: (n) => `Cosechar ${n} ${n === 1 ? 'parcela' : 'parcelas'}. "Las plantitas te esperan."`, hint: 'Cuenta cada parcela cosechada en el Jardín de los Faroles.' },
  { kind: 'gift', stat: 'gifts', from: 'Pip', who: 'pip', group: 'neighbors', range: [1, 1], weeklyRange: [3, 4], open: always, text: (n) => `Hacer ${n} ${n === 1 ? 'regalo' : 'regalos'}. "Un detalle alegra el día."`, hint: 'Hablá con un vecino y regalale algo. Puede ser al mismo vecino en días distintos.' },
  { kind: 'gather', stat: 'gathered', from: 'Taro', who: 'taro', group: 'nature', range: [3, 6], weeklyRange: [10, 16], open: always, text: (n) => `Recolectar ${n} cosas por el pueblo. "Siempre falta algo en el almacén."`, hint: 'Juntá flores, ramas, piedras o conchas que encuentres en el suelo.' },
  { kind: 'photo', stat: 'photos', from: 'Sumi', who: 'sumi', group: 'neighbors', range: [1, 2], weeklyRange: [3, 5], open: always, text: (n) => `Guardar ${n} ${n === 1 ? 'foto' : 'fotos'}. "Hay luz linda hoy."`, hint: 'Usá la cámara y guardá la foto en el álbum; las fotos descartadas no cuentan.' },
  { kind: 'project', stat: 'projectPhases', from: 'Momo', who: 'momo', group: 'neighbors', range: [1, 1], weeklyRange: [1, 1], open: () => game.save.restaurant.level >= 2 && visibleProjects().some((p) => { const next = p.phases[projectDone(p.id)]; return next && (!next.level || next.level <= game.save.restaurant.level); }), text: () => 'Terminar una etapa de los proyectos del pueblo. "Poquito a poquito."', hint: 'Elegí una etapa disponible en esta cartelera. No aparecen encargos nuevos si ya terminaste los proyectos accesibles.' },
  { kind: 'cook', stat: 'handCooked', from: 'Spicy', who: 'spicy', group: 'kitchen', range: [1, 3], weeklyRange: [4, 7], open: always, text: (n) => `Preparar ${n} ${n === 1 ? 'plato' : 'platos'} a mano. "¡Quiero ver esa esterilla en acción!"`, hint: 'Terminá el minijuego en un pedido o en cocina libre. Rápido y cancelaciones no cuentan.' },
  { kind: 'variant', stat: 'variantsPrepared', from: 'Spicy', who: 'spicy', group: 'kitchen', range: [1, 1], weeklyRange: [2, 3], open: () => RECIPES.some((r) => game.save.recipesKnown.includes(r.id) && r.variants?.length), text: (n) => `Preparar ${n} ${n === 1 ? 'plato' : 'platos'} con un ingrediente extra. "¡Un toque personal!"`, hint: 'En una receta con variante, agregá el ingrediente con estrella antes de servir y terminá la preparación.' },
  { kind: 'water', stat: 'plotsWatered', from: 'Momo', who: 'momo', group: 'nature', range: [1, 3], weeklyRange: [4, 6], open: () => game.has('unlock_garden'), text: (n) => `Regar ${n} ${n === 1 ? 'parcela' : 'parcelas'}. "Un poquito de agua, un poquito de cariño."`, hint: 'Plantá semillas y regá en el jardín. Una parcela ya regada no vuelve a contar ese día.' },
  { kind: 'decorate', stat: 'decorMoves', from: 'Yuki', who: 'yuki', group: 'home', range: [1, 2], weeklyRange: [3, 5], open: () => Object.values(game.save.furnitureOwned).some((n) => n > 0) || Object.values(game.save.decor).some((room) => room.length > 0), text: (n) => `Colocar o reorganizar ${n} ${n === 1 ? 'mueble' : 'muebles'}. "Un rincón nuevo cambia la casa."`, hint: 'Usá el modo Decorar para colocar, mover, girar o guardar muebles.' },
  { kind: 'sort', stat: 'sorted', from: 'Taro', who: 'taro', group: 'home', range: [1, 1], weeklyRange: [2, 3], open: () => game.has('storage_open') || projectDone('plaza_lights') >= 4, text: (n) => `Ordenar la despensa ${n === 1 ? 'una vez' : `${n} veces`}. "Cada cosa en su cajón."`, hint: 'Completá el minijuego de los cajones del depósito o del taller restaurado de la plaza.' },
  { kind: 'deliver', stat: '', from: 'Taro', who: 'taro', group: 'neighbors', range: [2, 3], weeklyRange: [5, 7], open: always, text: () => '', hint: 'Traé los objetos en la mochila. Al entregar se descuentan; Taro los retira de la cartelera.' },
];

export interface Errand {
  id: string; kind: ErrandKind; goal: number; base: number; coins: number; claimed: boolean;
  target?: string; rewards?: ErrandReward; dueDay?: number; earned?: boolean;
}
export interface DailyState {
  day: number; week: number; daily: Errand[]; weekly: Errand[];
  pending?: Errand[]; weeklyTheme?: Group;
}
export const WEEKLY_THEMES: { id: Group; name: string }[] = [
  { id: 'kitchen', name: 'Sabores de la casa' }, { id: 'neighbors', name: 'Entre vecinos' },
  { id: 'nature', name: 'Paseos y brotes' }, { id: 'home', name: 'Rincones acogedores' },
];
export const WEEKLY_STAMPS = [
  { goal: 1, furniture: 'errand_thanks', name: 'Primer agradecimiento' },
  { goal: 3, furniture: 'errand_furin', name: 'Manos que ayudan' },
  { goal: 6, furniture: 'errand_bonsai', name: 'Corazón del vecindario' },
];
const KEY = 'daily_state';
const tpl = (kind: ErrandKind) => TEMPLATES.find((t) => t.kind === kind)!;
export function seeded(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const weekOf = (day: number) => Math.floor((Math.max(1, day) - 1) / 7);
export function dailyCount(): number { return game.save.restaurant.level >= 3 ? 3 : 2; }

function rewardFor(t: Template, weekly: boolean, rnd: () => number): ErrandReward {
  const quantity = weekly ? 3 : 1;
  const packs: Record<Group, Record<string, number>[]> = {
    kitchen: [{ rice: quantity, nori: quantity }, { sesame: quantity, wasabi: quantity }],
    nature: [{ wood: quantity, stone: quantity }, ...(game.has('unlock_garden') ? [{ sd_flower: quantity, sd_cucumber: quantity }] : [])],
    neighbors: [{ g_candy: quantity }, { rice: quantity, cucumber: quantity }],
    home: [{ wood: quantity, stone: quantity }, { nori: quantity, rice: quantity }],
  };
  const pool = packs[t.group];
  const reward: ErrandReward = { items: pool[Math.floor(rnd() * pool.length)], friendship: { who: t.who, points: weekly ? 7 : 3 } };
  if (weekly) {
    const choices: Record<Group, string[]> = { kitchen: ['tea_set', 'plant_herbs'], neighbors: ['photo_frame', 'vase_tulips'], nature: ['plant_fern', 'bamboo_pot'], home: ['cushion_indigo', 'windchime'] };
    const list = choices[t.group];
    reward.furniture = { [list[Math.floor(rnd() * list.length)]]: 1 };
  }
  return reward;
}

export function makeErrands(seed: number, count: number, weekly: boolean, open: (t: Template) => boolean = (t) => t.open(), stats: (k: string) => number = statNow, level = game.save.restaurant.level): Errand[] {
  const rnd = seeded(seed);
  const bag = TEMPLATES.filter((t) => open(t) && (!weekly || t.weeklyRange));
  const out: Errand[] = [];
  while (out.length < count && bag.length) {
    // Different activities first; avoid filling a day's board with cooking alone.
    const freshGroups = bag.filter((t) => !out.some((e) => tpl(e.kind).group === t.group));
    const candidates = freshGroups.length ? freshGroups : bag;
    const t = candidates[Math.floor(rnd() * candidates.length)];
    bag.splice(bag.indexOf(t), 1);
    const [lo, hi] = weekly ? t.weeklyRange! : t.range;
    const goal = lo + Math.floor(rnd() * (hi - lo + 1));
    const coins = Math.round((weekly ? 70 + goal * 6 : 22 + goal * 9) * (1 + Math.min(level, 8) * 0.12));
    const targetPool = ['rice', 'cucumber', 'wood', 'stone', ...(game.has('unlock_garden') ? ['carrot'] : [])];
    out.push({ id: `${weekly ? 'w' : 'd'}${seed}_${t.kind}`, kind: t.kind, goal, base: stats(t.stat), coins, claimed: false,
      ...(t.kind === 'deliver' ? { target: targetPool[Math.floor(rnd() * targetPool.length)] } : {}), rewards: rewardFor(t, weekly, rnd) });
  }
  return out;
}

function validCounts(raw: unknown, exists: (id: string) => boolean): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, q]) => exists(id) && typeof q === 'number' && Number.isFinite(q) && q >= 1).map(([id, q]) => [id, Math.min(99, Math.floor(q as number))]));
}
function parse(raw: unknown): DailyState | null {
  if (typeof raw !== 'string') return null;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || !Array.isArray(s.daily) || !Array.isArray(s.weekly)) return null;
    const read = (list: unknown[]): Errand[] => list.flatMap((raw: any) => {
      if (!raw || typeof raw.id !== 'string' || !TEMPLATES.some((t) => t.kind === raw.kind) || !Number.isFinite(raw.goal) || raw.goal < 1 || !Number.isFinite(raw.base) || raw.base < 0 || !Number.isFinite(raw.coins) || raw.coins < 0 || typeof raw.claimed !== 'boolean') return [];
      if (raw.kind === 'deliver' && !ITEMS_BY_ID[raw.target]) return [];
      const e: Errand = { id: raw.id, kind: raw.kind, goal: Math.floor(raw.goal), base: raw.base, coins: Math.floor(raw.coins), claimed: raw.claimed };
      if (raw.target && ITEMS_BY_ID[raw.target]) e.target = raw.target;
      if (Number.isFinite(raw.dueDay)) e.dueDay = Math.max(1, Math.floor(raw.dueDay));
      if (raw.earned === true) e.earned = true;
      if (raw.rewards && typeof raw.rewards === 'object') {
        e.rewards = { items: validCounts(raw.rewards.items, (id) => !!ITEMS_BY_ID[id]), furniture: validCounts(raw.rewards.furniture, (id) => !!FURN_BY_ID[id]) };
        const f = raw.rewards.friendship;
        if (f && CHAR_BY_ID[f.who] && Number.isFinite(f.points) && f.points > 0) e.rewards.friendship = { who: f.who, points: Math.min(12, Math.floor(f.points)) };
      }
      return [e];
    });
    return { day: Number(s.day) || 0, week: Number(s.week) || 0, daily: read(s.daily), weekly: read(s.weekly), pending: read(Array.isArray(s.pending) ? s.pending : []),
      ...(WEEKLY_THEMES.some((t) => t.id === s.weeklyTheme) ? { weeklyTheme: s.weeklyTheme } : {}) };
  } catch { return null; }
}

/** Rolls at the day boundary as well as when the board is opened. Completed rewards wait for collection. */
export function ensureDaily(): DailyState {
  const day = game.save.time.day, week = weekOf(day);
  const st = parse(game.save.flags[KEY]) ?? { day: 0, week: -1, daily: [], weekly: [], pending: [] };
  let changed = false;
  const archive = (list: Errand[]) => {
    for (const e of list) if (!e.claimed && isComplete(e) && !st.pending!.some((p) => p.id === e.id)) st.pending!.push({ ...e, earned: true });
  };
  if (st.week !== week) {
    archive(st.weekly);
    const available = WEEKLY_THEMES.filter((theme) => TEMPLATES.some((t) => t.group === theme.id && t.weeklyRange && t.open()));
    let theme = available[week % available.length];
    if (available.length > 1 && theme.id === st.weeklyTheme) theme = available[(available.indexOf(theme) + 1) % available.length];
    st.weeklyTheme = theme.id;
    st.weekly = makeErrands(week * 7919 + 13, 1, true, (t) => t.group === theme.id && t.open()).map((e) => ({ ...e, dueDay: week * 7 + 7 }));
    st.week = week; changed = true;
  }
  if (st.day !== day) {
    archive(st.daily);
    st.daily = makeErrands(day * 9973 + 7, dailyCount(), false).map((e) => ({ ...e, dueDay: day }));
    st.day = day; changed = true;
  }
  if (changed) {
    const raw = JSON.stringify(st);
    game.setFlag(KEY, raw);
    return parse(raw)!;
  }
  return st;
}
export function progressOf(e: Errand): number {
  if (e.claimed || e.earned && e.kind !== 'deliver') return e.goal;
  const amount = e.kind === 'deliver' ? game.countUsable(e.target!) : statNow(tpl(e.kind).stat) - e.base;
  return Math.max(0, Math.min(e.goal, amount));
}
export const isComplete = (e: Errand) => progressOf(e) >= e.goal;
export function errandText(e: Errand): string {
  return e.kind === 'deliver' ? `Entregar ${e.goal} × ${ITEMS_BY_ID[e.target!]?.name ?? e.target} a Taro.` : tpl(e.kind).text(e.goal);
}
export function errandFrom(e: Errand): string { return tpl(e.kind).from; }
export function errandHint(e: Errand): string { return tpl(e.kind).hint; }
export interface ErrandReceipt { coins: number; rewards?: ErrandReward; stamps: string[]; }

/** Mark the assignment before emitting reward events; a second click or reload cannot pay twice. */
export function claimErrandReward(id: string): ErrandReceipt | null {
  const st = ensureDaily();
  const e = [...st.daily, ...st.weekly, ...(st.pending ?? [])].find((x) => x.id === id);
  if (!e || e.claimed || game.has('once_errand_' + id) || !isComplete(e)) return null;
  const stamps: string[] = [];
  let receipt: ErrandReceipt | null = null;
  game.once('errand_' + id, () => {
    // The once marker is already set when inventory events are emitted by the delivery.
    if (e.kind === 'deliver' && !game.consumeIngredients({ [e.target!]: e.goal })) {
      delete game.save.flags['once_errand_' + id];
      return;
    }
    e.claimed = true;
    st.pending = st.pending?.filter((p) => p.id !== id);
    game.setFlag(KEY, JSON.stringify(st));
    game.addCoins(e.coins, 'errand');
    for (const [item, count] of Object.entries(e.rewards?.items ?? {})) game.addItem(item, count, 'errand');
    for (const [furniture, count] of Object.entries(e.rewards?.furniture ?? {})) game.save.furnitureOwned[furniture] = (game.save.furnitureOwned[furniture] ?? 0) + count;
    if (e.rewards?.friendship) game.addFriendship(e.rewards.friendship.who, e.rewards.friendship.points);
    game.stat('errandsDone');
    if (e.id.startsWith('w')) {
      game.stat('weeklyErrandsDone');
      for (const stamp of WEEKLY_STAMPS) if ((game.save.stats.weeklyErrandsDone ?? 0) >= stamp.goal) game.once('errand_stamp_' + stamp.goal, () => {
        game.save.furnitureOwned[stamp.furniture] = (game.save.furnitureOwned[stamp.furniture] ?? 0) + 1;
        stamps.push(stamp.furniture);
      });
    }
    receipt = { coins: e.coins, rewards: e.rewards, stamps };
  });
  if (receipt) haptic('reward');
  return receipt;
}
/** Legacy numeric API. */
export function claimErrand(id: string): number { return claimErrandReward(id)?.coins ?? 0; }
