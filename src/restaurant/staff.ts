/**
 * Restaurant crew. Two kinds of workers do real jobs, one at a time, and everyone starts slow:
 *  - hired employees (waiters and cooks) that walk on their own paths, and
 *  - the raccoons: Rigg takes orders and picks up tips, Spicy cooks, Pip hosts (see WorldScene.updateHost).
 * Jobs run on timers and paths, so they go on while the player is in another map.
 * Speed grows with practice (time) and with training (coins).
 */
import { rng } from '../art/pixel';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { RECIPES_BY_ID } from '../data/recipes';
import { playerBusy } from './claims';
import { canCook } from './orders';
import { claimPlate, collectTipAt, guestViews, plateState, stagePlate, staffDeliver, takeOrderAt, tableJobs } from './service';

export type StaffRole = 'waiter' | 'cook';
export type Task = 'order' | 'serve' | 'cook' | 'tip';
export type TraitId = 'alegre' | 'veloz' | 'tranquilo' | 'prolijo';

export interface Employee {
  id: string;
  name: string;
  role: StaffRole;
  trait: TraitId;
  look: Appearance;
  /** 0..4 */
  level: number;
  xp: number;
  hiredDay: number;
  /** waiters: which jobs, and which first */
  takeOrders: boolean;
  serve: boolean;
  priority: 'orders' | 'serve';
  /** could not be paid on the last pay day: stays off until paid */
  unpaid?: boolean;
}

export type CrewId = 'pip' | 'rigg' | 'spicy';
/** `carry`: extra plates Rigg can hold on his tray (0..2), bought with coins */
export interface CrewMember { level: number; xp: number; on: boolean; carry?: number }
export interface StaffSave {
  employees: Employee[];
  nextId: number;
  paused: boolean;
  lastPayDay: number;
  /** the raccoons' own progress (optional so older saves load) */
  crew?: Partial<Record<CrewId, CrewMember>>;
}

export const TRAITS: Record<TraitId, { name: string; line: string; walk: number; work: number }> = {
  alegre: { name: 'Alegre', line: 'Saluda a todos con una sonrisa.', walk: 1, work: 1 },
  veloz: { name: 'Veloz', line: 'Siempre anda apurado.', walk: 1.15, work: 1.05 },
  tranquilo: { name: 'Tranquilo', line: 'Nunca pierde la calma.', walk: 0.9, work: 0.95 },
  prolijo: { name: 'Prolijo', line: 'Cada cosa en su lugar.', walk: 1, work: 0.92 },
};

export const MAX_LEVEL = 4;
export const LEVEL_NAMES = ['Recién llegado', 'Aprendiz', 'Práctico', 'Capacitado', 'Experto'];
/** seconds of real work for one job, by level */
const ORDER_SECONDS = [9, 7, 5.5, 4.2, 3.2];
const TIP_SECONDS = [4, 3.2, 2.6, 2, 1.6];
const PICK_SECONDS = [3, 2.5, 2, 1.6, 1.2];
const SERVE_SECONDS = [2.6, 2.1, 1.7, 1.4, 1.1];
/** one dish: Spicy starts at over half a minute; a hired cook starts slower still */
export const COOK_SECONDS: Record<'crew' | 'hired', number[]> = { crew: [34, 27, 21, 16, 12], hired: [45, 36, 28, 21, 15] };
const WALK_TILES = [1.1, 1.3, 1.5, 1.7, 1.9];
/** chance of a perfect / very good dish by level (the rest come out fine) */
const PERFECT = [0.05, 0.15, 0.3, 0.5, 0.7];
const VERY_GOOD = [0.35, 0.5, 0.5, 0.4, 0.3];
/** practice only takes hired staff so far; raccoons keep learning, slowly */
const XP_STEPS = [25, 70, 140, 240];
const HIRED_PRACTICE_CAP = 2;

export const hireCost = (role: StaffRole = 'waiter') => (role === 'cook' ? 220 : 150);
export const wageOf = (e: Employee) => (e.role === 'cook' ? 22 + 8 * e.level : 16 + 6 * e.level);
export const trainCost = (level: number, crew = false) => (crew ? 120 + 90 * level : 90 + 70 * level);
export const staffLimit = (level: number) => (level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0);
export const cookLimit = (level: number) => (level >= 4 ? 1 : 0);

const NAMES = ['Mochi', 'Dango', 'Anko', 'Kinako', 'Matcha', 'Yuzu', 'Sesa', 'Kabu', 'Hoshi', 'Tofu', 'Nashi', 'Mame'];
const SPECIES: Appearance['species'][] = ['cat', 'fox', 'bunny', 'dog', 'owl', 'otter', 'squirrel', 'bear'];
const FURS = ['#d9b38c', '#b9764b', '#e8e0d4', '#8a8f9a', '#e2a96b', '#6b5444', '#f0c9a8', '#c27f86'];
const HAIRS = ['#5b3a2e', '#2b2231', '#c9a24a', '#8a8f9a', '#a8503a'];

export function staffSave(): StaffSave {
  return (game.save.staff ??= { employees: [], nextId: 1, paused: false, lastPayDay: game.save.time.day });
}
export const employees = () => staffSave().employees;

export const CREW_INFO: Record<CrewId, { name: string; job: string; tasks: Task[]; unlock: number }> = {
  pip: { name: 'Pip', job: 'Recibe a los clientes y los lleva a su mesa.', tasks: [], unlock: 0 },
  rigg: { name: 'Rigg', job: 'Lleva los platos de la bandeja a las mesas, toma los pedidos y recoge las propinas.', tasks: ['serve', 'order', 'tip'], unlock: 2 },
  spicy: { name: 'Spicy', job: 'Cocina los pedidos del salón.', tasks: ['cook'], unlock: 2 },
};
export function crew(id: CrewId): CrewMember {
  const s = staffSave();
  return ((s.crew ??= {})[id] ??= { level: 0, xp: 0, on: false });
}
/** they help once the friendship is there (Pip always hosts) */
export const crewUnlocked = (id: CrewId) => id === 'pip' || game.friendLevel(id) >= CREW_INFO[id].unlock;

/** Three people looking for work, the same ones all day. */
export function candidates(role: StaffRole = 'waiter', day = game.save.time.day): Employee[] {
  const r = rng(day * 2713 + (role === 'cook' ? 97 : 11));
  const taken = new Set(employees().map((e) => e.name));
  const names = NAMES.filter((n) => !taken.has(n));
  const traits = Object.keys(TRAITS) as TraitId[];
  return [0, 1, 2].map((i) => {
    const name = names.splice(Math.floor(r() * names.length), 1)[0] ?? `Ayudante ${i + 1}`;
    const look: Appearance = {
      species: SPECIES[Math.floor(r() * SPECIES.length)], skin: FURS[Math.floor(r() * FURS.length)], hairStyle: Math.floor(r() * 3),
      hairColor: HAIRS[Math.floor(r() * HAIRS.length)], eyes: Math.floor(r() * 3), eyeColor: '#3b2a22',
      top: role === 'cook' ? 'top_chef' : 'top_kimono_indigo', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '',
    };
    return {
      id: `cand_${role}_${day}_${i}`, name, role, trait: traits[Math.floor(r() * traits.length)], look, level: 0, xp: 0, hiredDay: day,
      takeOrders: true, serve: true, priority: 'serve' as const,
    };
  });
}

export function hire(c: Employee): string | null {
  const s = staffSave();
  const same = s.employees.filter((e) => e.role === c.role).length;
  if (c.role === 'cook' ? same >= cookLimit(game.save.restaurant.level) : s.employees.filter((e) => e.role === 'waiter').length >= staffLimit(game.save.restaurant.level)) return 'El restaurante todavía no necesita más personal de ese puesto.';
  if (!game.spend(hireCost(c.role), 'hire')) return 'No te alcanzan las monedas.';
  const e: Employee = { ...c, id: `emp${s.nextId++}`, hiredDay: game.save.time.day };
  s.employees.push(e);
  runtime.delete(e.id);
  game.touch('staff');
  return null;
}
export function fire(id: string): void {
  const s = staffSave();
  const r = runtime.get(id);
  if (r) release(r, id);
  runtime.delete(id);
  s.employees = s.employees.filter((e) => e.id !== id);
  game.touch('staff');
}
/** Training with coins: one level up at once. */
export function train(id: string): string | null {
  const e = employees().find((x) => x.id === id);
  if (!e) return null;
  if (e.level >= MAX_LEVEL) return 'Ya es experto.';
  if (!game.spend(trainCost(e.level), 'train')) return 'No te alcanzan las monedas.';
  e.level++;
  e.xp = Math.max(e.xp, XP_STEPS[e.level - 1] ?? 0);
  game.touch('staff');
  return null;
}
export function trainCrew(id: CrewId): string | null {
  const m = crew(id);
  if (m.level >= MAX_LEVEL) return 'Ya es experto.';
  if (!game.spend(trainCost(m.level, true), 'train')) return 'No te alcanzan las monedas.';
  m.level++;
  m.xp = Math.max(m.xp, XP_STEPS[m.level - 1] ?? 0);
  game.touch('staff');
  return null;
}
export const MAX_CARRY_UPGRADES = 2;
/** plates Rigg carries at once: one at the start, up to three */
export const riggCapacity = () => 1 + (crew('rigg').carry ?? 0);
export const carryUpgradeCost = () => 160 + 200 * (crew('rigg').carry ?? 0);
export function upgradeRiggTray(): string | null {
  const m = crew('rigg');
  if ((m.carry ?? 0) >= MAX_CARRY_UPGRADES) return 'Ya lleva todo lo que puede.';
  if (!game.spend(carryUpgradeCost(), 'train')) return 'No te alcanzan las monedas.';
  m.carry = (m.carry ?? 0) + 1;
  game.touch('staff');
  return null;
}
export function setStaff(patch: Partial<Pick<StaffSave, 'paused'>>) { Object.assign(staffSave(), patch); game.touch('staff'); }
export function setCrew(id: CrewId, on: boolean) { crew(id).on = on; game.touch('staff'); }

/** Daily pay for hired staff (the raccoons are friends, not payroll). Whoever cannot be paid stays home until the next pay day. */
export function payWages(day = game.save.time.day): { paid: number; unpaid: string[] } {
  const s = staffSave();
  let paid = 0;
  const unpaid: string[] = [];
  if (s.lastPayDay >= day) return { paid, unpaid };
  const days = day - s.lastPayDay;
  s.lastPayDay = day;
  for (const e of s.employees) {
    const due = wageOf(e) * Math.min(days, 3);
    if (game.spend(due, 'wage')) { paid += due; e.unpaid = false; }
    else { e.unpaid = true; unpaid.push(e.name); }
  }
  return { paid, unpaid };
}

/** How much slower than the player a dish or a host greeting takes (Pip). 1 = as quick as it gets. */
export const hostSlowdown = () => [2.2, 1.8, 1.45, 1.2, 1][crew('pip').level];

function gainXp(m: { level: number; xp: number }, xp: number, cap: number) {
  m.xp += xp;
  while (m.level < cap && m.xp >= XP_STEPS[m.level]) m.level++;
}
/** Pip's greetings count as practice too. */
export function practicePip() { gainXp(crew('pip'), 4, MAX_LEVEL); }

// ------------------------------------------------------------------ workers
interface Worker {
  id: string;
  kind: 'hired' | 'crew';
  level: number;
  tasks: Task[];
  walk: number;
  mul: number;
  off: boolean;
  member: { level: number; xp: number };
  cap: number;
  /** raccoons: why they are not working right now */
  note?: string;
  /** plates carried at once */
  carry: number;
}

function workers(env: StaffEnv): Worker[] {
  const s = staffSave();
  const out: Worker[] = [];
  for (const e of s.employees) {
    const t = TRAITS[e.trait];
    const tasks: Task[] = e.role === 'cook' ? ['cook'] : (e.priority === 'orders' ? ['order', 'serve'] : ['serve', 'order']).filter((k) => (k === 'order' ? e.takeOrders : e.serve)) as Task[];
    out.push({ id: e.id, kind: 'hired', level: e.level, tasks, walk: WALK_TILES[e.level] * t.walk, mul: t.work, off: s.paused || !!e.unpaid, member: e, cap: HIRED_PRACTICE_CAP, carry: 1 });
  }
  for (const id of ['rigg', 'spicy'] as CrewId[]) {
    const m = crew(id);
    if (!m.on) continue;
    const w = env.crew.where(id);
    const away = !crewUnlocked(id) || !w || w.zone !== 'restaurant';
    out.push({ id, kind: 'crew', level: m.level, tasks: CREW_INFO[id].tasks, walk: WALK_TILES[m.level], mul: 1, off: s.paused || away || !env.crew.working(), member: m, cap: MAX_LEVEL, note: away ? 'Fuera del restaurante' : undefined, carry: id === 'rigg' ? riggCapacity() : 1 });
  }
  return out;
}

// ------------------------------------------------------------------ runtime (not saved)
export type Claim =
  | { kind: 'order'; tableId: string }
  | { kind: 'tip'; tableId: string }
  | { kind: 'serve'; uid: number; tableId: string }
  | { kind: 'cook'; uid: number; tableId: string };
export interface Runtime {
  /** tile position, fractional while walking */
  x: number; y: number;
  dir: 'up' | 'down' | 'left' | 'right';
  act: 'idle' | 'walk' | 'work';
  claim: Claim | null;
  /** what they are doing, for the staff screen */
  doing: string;
  carrying: number | null;
  path: [number, number][];
  work: number;
  step: 'toTable' | 'ordering' | 'tipping' | 'toTray' | 'picking' | 'toServe' | 'serving' | 'toStove' | 'cooking' | 'home' | null;
  wait: number;
  /** ingredients already taken from the pantry for the dish being cooked */
  taken: boolean;
  /** more plates picked up for other tables, served one after another */
  queue: { uid: number; tableId: string }[];
  target: { x: number; y: number } | null;
  lost: number;
}
export const runtime = new Map<string, Runtime>();
let sessionSave: unknown = null;

export interface StaffEnv {
  home(): { x: number; y: number };
  tray(): { x: number; y: number };
  stove(): { x: number; y: number };
  /** tiles next to the table where a person can stand */
  tableSpots(tableId: string): { x: number; y: number }[];
  path(from: { x: number; y: number }, to: { x: number; y: number }): [number, number][] | null;
  /** the raccoons are town residents: they walk with the town's own movement */
  crew: {
    where(id: CrewId): { zone: string; x: number; y: number; settled: boolean } | null;
    move(id: CrewId, tile: { x: number; y: number } | null): void;
    /** the restaurant is open and nothing scripted is going on */
    working(): boolean;
  };
}

function rt(id: string, env: StaffEnv, crewId: boolean): Runtime {
  let r = runtime.get(id);
  if (!r) {
    const h = crewId ? env.crew.where(id as CrewId) ?? env.home() : env.home();
    r = { x: h.x, y: h.y, dir: 'down', act: 'idle', claim: null, doing: 'Esperando', carrying: null, path: [], work: 0, step: null, wait: 0, taken: false, queue: [], target: null, lost: 0 };
    runtime.set(id, r);
  }
  return r;
}

function release(r: Runtime, workerId?: string) {
  const c = r.claim;
  if (c?.kind === 'serve') claimPlate(c.uid, null);
  if (c?.kind === 'cook') {
    const o = game.save.orders.find((x) => x.uid === c.uid);
    if (o) delete o.cook;
    if (r.taken && o) for (const [id, q] of Object.entries(RECIPES_BY_ID[o.recipe]?.ingredients ?? {})) game.addItem(id, q, 'refund');
  }
  for (const q of r.queue) claimPlate(q.uid, null);
  r.queue = [];
  r.claim = null; r.carrying = null; r.work = 0; r.taken = false;
  void workerId;
}

function claimedByOthers(selfId: string): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of runtime) {
    if (id === selfId || !r.claim) continue;
    const c = r.claim;
    out.add(c.kind === 'order' || c.kind === 'tip' ? `${c.kind}:${c.tableId}` : `${c.kind}:${c.uid}`);
  }
  return out;
}

let tableNames: (id: string) => string = (id) => id;
export function setTableNamer(fn: (id: string) => string) { tableNames = fn; }

function goTo(w: Worker, r: Runtime, env: StaffEnv, to: { x: number; y: number }, step: Runtime['step'], doing: string): boolean {
  if (w.kind === 'crew') {
    env.crew.move(w.id as CrewId, to);
    r.target = to; r.path = []; r.lost = 0;
  } else {
    const p = env.path({ x: Math.round(r.x), y: Math.round(r.y) }, to);
    if (!p) return false;
    r.path = p; r.target = to;
  }
  r.step = step;
  r.doing = doing;
  r.act = 'walk'; // arriving is handled by the walking step, even when already there
  return true;
}

const nearest = <T extends { x: number; y: number }>(r: Runtime, spots: T[]) =>
  [...spots].sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))[0] ?? null;

/** Looks for the next job. Returns false when there is nothing to do. */
function pickJob(w: Worker, r: Runtime, env: StaffEnv): boolean {
  const others = claimedByOthers(w.id);
  for (const kind of w.tasks) {
    if (kind === 'order') {
      const jobs = tableJobs().filter((j) => j.phase === 'waiting_order' && !others.has('order:' + j.tableId));
      const best = nearest(r, jobs.map((j) => ({ j, ...(nearest(r, env.tableSpots(j.tableId)) ?? { x: NaN, y: NaN }) })).filter((x) => !Number.isNaN(x.x)));
      if (best && goTo(w, r, env, best, 'toTable', `Va a la ${tableNames(best.j.tableId)}`)) { r.claim = { kind: 'order', tableId: best.j.tableId }; return true; }
    } else if (kind === 'tip') {
      const jobs = tableJobs().filter((j) => j.status === 'tip' && j.tip > 0 && !others.has('tip:' + j.tableId));
      const best = nearest(r, jobs.map((j) => ({ j, ...(nearest(r, env.tableSpots(j.tableId)) ?? { x: NaN, y: NaN }) })).filter((x) => !Number.isNaN(x.x)));
      if (best && goTo(w, r, env, best, 'toTable', `Va a buscar la propina de la ${tableNames(best.j.tableId)}`)) { r.claim = { kind: 'tip', tableId: best.j.tableId }; return true; }
    } else if (kind === 'serve') {
      const waiting = new Set(guestViews().filter((g) => g.phase === 'waiting_food').map((g) => g.id));
      const order = game.save.orders.find((o) => o.plate && o.service && plateState(o.uid) === 'plated' && !o.plate.claim && waiting.has(o.service.partyId) && !others.has('serve:' + o.uid));
      if (order && claimPlate(order.uid, w.id)) {
        if (goTo(w, r, env, env.tray(), 'toTray', 'Va a buscar un plato')) { r.claim = { kind: 'serve', uid: order.uid, tableId: order.service!.tableId }; return true; }
        claimPlate(order.uid, null);
      }
    } else if (kind === 'cook') {
      const waiting = new Set(guestViews().filter((g) => g.phase === 'waiting_food').map((g) => g.id));
      const order = game.save.orders.find((o) => o.kind !== 'drink' && o.service && !o.plate && !o.cook && !playerBusy.has(o.uid) && waiting.has(o.service.partyId) && RECIPES_BY_ID[o.recipe] && canCook(o.recipe) && !others.has('cook:' + o.uid));
      if (order) {
        order.cook = w.id;
        if (goTo(w, r, env, env.stove(), 'toStove', `Va a preparar ${RECIPES_BY_ID[order.recipe].name}`)) { r.claim = { kind: 'cook', uid: order.uid, tableId: order.service!.tableId }; return true; }
        delete order.cook;
      }
    }
  }
  return false;
}

function stillValid(r: Runtime): boolean {
  const c = r.claim;
  if (!c) return false;
  if (c.kind === 'order') return tableJobs().some((j) => j.tableId === c.tableId && j.phase === 'waiting_order');
  if (c.kind === 'tip') return tableJobs().some((j) => j.tableId === c.tableId && j.status === 'tip' && j.tip > 0);
  const o = game.save.orders.find((x) => x.uid === c.uid);
  const party = o?.service ? guestViews().find((g) => g.id === o.service!.partyId) : null;
  if (c.kind === 'cook') return !!o && !o.plate && !playerBusy.has(c.uid) && party?.phase === 'waiting_food';
  return !!o?.plate && o.plate.claim !== undefined && party?.phase === 'waiting_food';
}

function arrive(w: Worker, r: Runtime) {
  r.act = 'work';
  const L = w.level;
  const k = w.mul;
  if (r.step === 'toTable') {
    if (r.claim?.kind === 'tip') { r.step = 'tipping'; r.work = TIP_SECONDS[L] * k; r.doing = 'Recoge la propina'; }
    else { r.step = 'ordering'; r.work = ORDER_SECONDS[L] * k; r.doing = 'Toma el pedido'; }
  } else if (r.step === 'toTray') { r.step = 'picking'; r.work = PICK_SECONDS[L] * k; r.doing = 'Recoge el plato'; }
  else if (r.step === 'toServe') { r.step = 'serving'; r.work = SERVE_SECONDS[L] * k; r.doing = 'Sirve el plato'; }
  else if (r.step === 'toStove') {
    const c = r.claim;
    const o = c?.kind === 'cook' ? game.save.orders.find((x) => x.uid === c.uid) : null;
    const recipe = o ? RECIPES_BY_ID[o.recipe] : null;
    if (!o || !recipe || !game.consumeIngredients(recipe.ingredients)) { r.step = 'home'; r.work = 0; r.doing = 'Faltan ingredientes'; release(r); return; }
    r.taken = true;
    r.step = 'cooking'; r.work = COOK_SECONDS[w.kind][L] * k; r.doing = `Cocina ${recipe.name}`;
  } else if (r.step === 'home') { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; }
}

function walk(w: Worker, r: Runtime, env: StaffEnv, dt: number) {
  if (w.kind === 'crew') {
    const pos = env.crew.where(w.id as CrewId);
    if (!pos || pos.zone !== 'restaurant') { release(r); r.act = 'idle'; r.step = null; r.target = null; return; }
    r.x = pos.x; r.y = pos.y;
    const t = r.target!;
    if (Math.hypot(pos.x - t.x, pos.y - t.y) <= 0.7 && pos.settled) { r.target = null; arrive(w, r); return; }
    r.lost += dt;
    if (r.lost > 45) { env.crew.move(w.id as CrewId, null); release(r); r.act = 'idle'; r.step = null; r.target = null; }
    return;
  }
  let move = w.walk * dt;
  while (move > 0 && r.path.length) {
    const [tx, ty] = r.path[0];
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
    if (d <= move) { r.x = tx; r.y = ty; r.path.shift(); move -= d; }
    else { r.x += (dx / d) * move; r.y += (dy / d) * move; move = 0; }
    if (Math.abs(dx) > Math.abs(dy)) r.dir = dx > 0 ? 'right' : 'left'; else if (dy !== 0) r.dir = dy > 0 ? 'down' : 'up';
  }
  if (!r.path.length) arrive(w, r);
}

function goHome(w: Worker, r: Runtime, env: StaffEnv) {
  r.carrying = null;
  if (w.kind === 'crew') { env.crew.move(w.id as CrewId, null); r.act = 'idle'; r.step = null; r.doing = 'Esperando'; return; }
  if (!goTo(w, r, env, env.home(), 'home', 'Vuelve a su lugar')) { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; }
}

function finishWork(w: Worker, r: Runtime, env: StaffEnv) {
  const c = r.claim;
  const rand = rng(Math.floor(performance.now()) + (c && 'uid' in c ? c.uid : 7));
  if (r.step === 'ordering' && c?.kind === 'order') {
    takeOrderAt(c.tableId);
    gainXp(w.member, 6, w.cap);
    release(r); goHome(w, r, env);
  } else if (r.step === 'tipping' && c?.kind === 'tip') {
    collectTipAt(c.tableId);
    gainXp(w.member, 5, w.cap);
    release(r); goHome(w, r, env);
  } else if (r.step === 'picking' && c?.kind === 'serve') {
    r.carrying = c.uid;
    // a bigger tray takes more plates (for other tables too) before leaving the counter
    const waiting = new Set(guestViews().filter((g) => g.phase === 'waiting_food').map((g) => g.id));
    const taken = claimedByOthers(w.id);
    while (r.queue.length + 1 < w.carry) {
      const more = game.save.orders.find((o) => o.plate && o.service && o.uid !== c.uid && plateState(o.uid) === 'plated' && !o.plate.claim && waiting.has(o.service.partyId) && !taken.has('serve:' + o.uid) && claimPlate(o.uid, w.id));
      if (!more) break;
      r.queue.push({ uid: more.uid, tableId: more.service!.tableId });
    }
    const spot = nearest(r, env.tableSpots(c.tableId));
    if (!spot || !goTo(w, r, env, spot, 'toServe', `Lleva el plato a la ${tableNames(c.tableId)}`)) { release(r); goHome(w, r, env); }
  } else if (r.step === 'serving' && c?.kind === 'serve') {
    if (!staffDeliver(c.uid, w.id)) gainXp(w.member, 8, w.cap);
    else claimPlate(c.uid, null);
    // next plate on the tray, if any
    const next = r.queue.shift();
    const spot = next ? nearest(r, env.tableSpots(next.tableId)) : null;
    if (next && spot) {
      r.claim = { kind: 'serve', uid: next.uid, tableId: next.tableId };
      r.carrying = next.uid;
      if (goTo(w, r, env, spot, 'toServe', `Lleva el plato a la ${tableNames(next.tableId)}`)) return;
    }
    release(r); goHome(w, r, env);
  } else if (r.step === 'cooking' && c?.kind === 'cook') {
    const roll = rand();
    const q: 0 | 1 | 2 = roll < PERFECT[w.level] ? 2 : roll < PERFECT[w.level] + VERY_GOOD[w.level] ? 1 : 0;
    const o = game.save.orders.find((x) => x.uid === c.uid);
    const ok = !!o && stagePlate(c.uid, q);
    if (ok) { delete o!.cook; r.taken = false; gainXp(w.member, 10, w.cap); }
    release(r); goHome(w, r, env);
  } else { release(r); goHome(w, r, env); }
}

function step(w: Worker, r: Runtime, env: StaffEnv, dt: number) {
  if (r.act === 'walk') return walk(w, r, env, dt);
  if (r.act === 'work' && r.step) {
    if (r.step === 'home') { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; return; }
    if (!stillValid(r)) { release(r); goHome(w, r, env); return; }
    r.work -= dt;
    if (r.work <= 0) finishWork(w, r, env);
  }
}

/** Runs the whole crew for `dt` seconds. */
export function tickStaff(dt: number, env: StaffEnv) {
  if (!game.has('intro_done') || !Number.isFinite(dt) || dt <= 0) return;
  if (sessionSave !== game.save) {
    // a loaded game: nobody is mid-task, so nothing stays reserved
    sessionSave = game.save;
    runtime.clear();
    for (const o of game.save.orders) { if (o.plate?.claim) delete o.plate.claim; if (o.cook) delete o.cook; }
  }
  const active = new Set<string>();
  for (const w of workers(env)) {
    active.add(w.id);
    const r = rt(w.id, env, w.kind === 'crew');
    if (w.off && r.claim) { release(r); goHome(w, r, env); }
    if (w.off && r.act === 'idle') { r.doing = w.note ?? (staffSave().paused ? 'En pausa' : 'Sin cobrar'); continue; }
    if (r.wait > 0) { r.wait -= dt; continue; }
    if (r.act === 'idle' && !r.claim) {
      if (!w.off && !pickJob(w, r, env)) r.wait = 0.8;
      continue;
    }
    step(w, r, env, dt);
  }
  // someone who stopped working (switched off) lets go of their jobs
  for (const [id, r] of runtime) if (!active.has(id) && r.claim) { release(r); r.act = 'idle'; r.step = null; }
}

/** Test helper */
export function resetStaffRuntime() { runtime.clear(); sessionSave = null; }
export const workSecondsFor = (level: number, kind: 'crew' | 'hired' = 'crew') => COOK_SECONDS[kind][level];
export const orderSecondsFor = (level: number) => ORDER_SECONDS[level];
