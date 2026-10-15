/**
 * Restaurant staff. A hired waiter really walks: to a table to take the order, to the tray for a finished dish,
 * to the table to serve it, and back to their spot. New hires are slow and get faster with practice and training.
 * Everything runs on a timer and a path, so it works the same with the player in another map.
 */
import { rng } from '../art/pixel';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { claimPlate, guestViews, plateState, staffDeliver, takeOrderAt, tableJobs } from './service';

export type StaffRole = 'waiter';
export interface Employee {
  id: string;
  name: string;
  role: StaffRole;
  /** flavour and a small modifier */
  trait: TraitId;
  look: Appearance;
  /** 0..4: speed of work and walking */
  level: number;
  xp: number;
  hiredDay: number;
  /** which jobs they do, and which first */
  takeOrders: boolean;
  serve: boolean;
  priority: 'orders' | 'serve';
  /** could not be paid on the last pay day: stays off until paid */
  unpaid?: boolean;
}
export interface StaffSave { employees: Employee[]; nextId: number; paused: boolean; lastPayDay: number }

export type TraitId = 'alegre' | 'veloz' | 'tranquilo' | 'prolijo';
export const TRAITS: Record<TraitId, { name: string; line: string; walk: number; work: number }> = {
  alegre: { name: 'Alegre', line: 'Saluda a todos con una sonrisa.', walk: 1, work: 1 },
  veloz: { name: 'Veloz', line: 'Siempre anda apurado.', walk: 1.15, work: 1.05 },
  tranquilo: { name: 'Tranquilo', line: 'Nunca pierde la calma.', walk: 0.9, work: 0.95 },
  prolijo: { name: 'Prolijo', line: 'Cada cosa en su lugar.', walk: 1, work: 0.92 },
};

export const MAX_LEVEL = 4;
const WORK_SLOWDOWN = [2.6, 2.1, 1.7, 1.35, 1.1];
const WALK_TILES = [1.1, 1.3, 1.5, 1.7, 1.9];
const XP_FOR_LEVEL = [20, 60]; // practice alone gets to level 2; training does the rest
const BASE_WORK = { order: 3.5, pick: 1.2, serve: 1 };

export const hireCost = () => 150;
export const wageOf = (e: Employee) => 16 + 6 * e.level;
export const trainCost = (e: Employee) => 90 + 70 * e.level;
export const staffLimit = (level: number) => (level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0);

const NAMES = ['Mochi', 'Dango', 'Anko', 'Kinako', 'Matcha', 'Yuzu', 'Sesa', 'Kabu', 'Hoshi', 'Tofu', 'Nashi', 'Mame'];
const SPECIES: Appearance['species'][] = ['cat', 'fox', 'bunny', 'dog', 'owl', 'otter', 'squirrel', 'bear'];
const FURS = ['#d9b38c', '#b9764b', '#e8e0d4', '#8a8f9a', '#e2a96b', '#6b5444', '#f0c9a8', '#c27f86'];
const HAIRS = ['#5b3a2e', '#2b2231', '#c9a24a', '#8a8f9a', '#a8503a'];

export function staffSave(): StaffSave {
  return (game.save.staff ??= { employees: [], nextId: 1, paused: false, lastPayDay: game.save.time.day });
}
export const employees = () => staffSave().employees;

/** Three people looking for work, the same ones all day. */
export function candidates(day = game.save.time.day): Employee[] {
  const r = rng(day * 2713 + 11);
  const taken = new Set(employees().map((e) => e.name));
  const names = NAMES.filter((n) => !taken.has(n));
  const traits = Object.keys(TRAITS) as TraitId[];
  return [0, 1, 2].map((i) => {
    const name = names.splice(Math.floor(r() * names.length), 1)[0] ?? `Ayudante ${i + 1}`;
    const look: Appearance = {
      species: SPECIES[Math.floor(r() * SPECIES.length)], skin: FURS[Math.floor(r() * FURS.length)], hairStyle: Math.floor(r() * 3),
      hairColor: HAIRS[Math.floor(r() * HAIRS.length)], eyes: Math.floor(r() * 3), eyeColor: '#3b2a22',
      top: 'top_kimono_indigo', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '',
    };
    return {
      id: `cand_${day}_${i}`, name, role: 'waiter' as const, trait: traits[Math.floor(r() * traits.length)], look, level: 0, xp: 0, hiredDay: day,
      takeOrders: true, serve: true, priority: 'serve' as const,
    };
  });
}

export function hire(c: Employee): string | null {
  const s = staffSave();
  if (s.employees.length >= staffLimit(game.save.restaurant.level)) return 'El restaurante todavía no necesita más personal.';
  if (!game.spend(hireCost(), 'hire')) return 'No te alcanzan las monedas.';
  const e: Employee = { ...c, id: `emp${s.nextId++}`, hiredDay: game.save.time.day };
  s.employees.push(e);
  runtime.delete(e.id);
  game.touch('staff');
  return null;
}
export function fire(id: string): void {
  const s = staffSave();
  const rt = runtime.get(id);
  if (rt?.claim?.kind === 'serve') claimPlate(rt.claim.uid, null);
  runtime.delete(id);
  s.employees = s.employees.filter((e) => e.id !== id);
  game.touch('staff');
}
export function train(id: string): string | null {
  const e = employees().find((x) => x.id === id);
  if (!e) return null;
  if (e.level >= MAX_LEVEL) return 'Ya es experto.';
  if (!game.spend(trainCost(e), 'train')) return 'No te alcanzan las monedas.';
  e.level++;
  e.xp = Math.max(e.xp, XP_FOR_LEVEL[Math.min(e.level, XP_FOR_LEVEL.length) - 1] ?? 0);
  game.touch('staff');
  return null;
}
export function setStaff(patch: Partial<Pick<StaffSave, 'paused'>>) { Object.assign(staffSave(), patch); game.touch('staff'); }

/** Daily pay. Whoever cannot be paid stays at home until the next pay day. Returns what was paid. */
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

export const workSeconds = (e: Employee, base: number) => base * WORK_SLOWDOWN[e.level] * TRAITS[e.trait].work;
export const walkSpeed = (e: Employee) => WALK_TILES[e.level] * TRAITS[e.trait].walk;
function gain(e: Employee, xp: number) {
  e.xp += xp;
  while (e.level < XP_FOR_LEVEL.length && e.xp >= XP_FOR_LEVEL[e.level]) e.level++;
}

// ------------------------------------------------------------------ runtime (not saved)
export type Claim = { kind: 'order'; tableId: string } | { kind: 'serve'; uid: number; tableId: string };
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
  step: 'toTable' | 'ordering' | 'toTray' | 'picking' | 'toServe' | 'serving' | 'home' | null;
  wait: number;
}
export const runtime = new Map<string, Runtime>();
let sessionSave: unknown = null;

export interface StaffEnv {
  /** where they wait */
  home(): { x: number; y: number };
  tray(): { x: number; y: number };
  /** tiles next to the table where a person can stand */
  tableSpots(tableId: string): { x: number; y: number }[];
  path(from: { x: number; y: number }, to: { x: number; y: number }): [number, number][] | null;
}

function rt(e: Employee, env: StaffEnv): Runtime {
  let r = runtime.get(e.id);
  if (!r) {
    const h = env.home();
    r = { x: h.x, y: h.y, dir: 'down', act: 'idle', claim: null, doing: 'Esperando', carrying: null, path: [], work: 0, step: null, wait: 0 };
    runtime.set(e.id, r);
  }
  return r;
}

function release(r: Runtime) {
  if (r.claim?.kind === 'serve') claimPlate(r.claim.uid, null);
  r.claim = null; r.carrying = null; r.work = 0;
}

function claimedByOthers(selfId: string): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of runtime) if (id !== selfId && r.claim) out.add(r.claim.kind === 'order' ? 'o:' + r.claim.tableId : 's:' + r.claim.uid);
  return out;
}

function goTo(r: Runtime, env: StaffEnv, to: { x: number; y: number }, step: Runtime['step'], doing: string): boolean {
  const p = env.path({ x: Math.round(r.x), y: Math.round(r.y) }, to);
  if (!p) return false;
  r.path = p;
  r.step = step;
  r.doing = doing;
  r.act = 'walk'; // arriving is handled by the walking step, even when already there
  return true;
}

function nearestSpot(r: Runtime, spots: { x: number; y: number }[]) {
  return [...spots].sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))[0] ?? null;
}

/** Looks for the next job. Returns false when there is nothing to do. */
function pickJob(e: Employee, r: Runtime, env: StaffEnv): boolean {
  const others = claimedByOthers(e.id);
  const tasks: ('order' | 'serve')[] = e.priority === 'orders' ? ['order', 'serve'] : ['serve', 'order'];
  for (const kind of tasks) {
    if (kind === 'order' && e.takeOrders) {
      const jobs = tableJobs().filter((j) => j.phase === 'waiting_order' && !others.has('o:' + j.tableId));
      const best = jobs.map((j) => ({ j, spot: nearestSpot(r, env.tableSpots(j.tableId)) })).filter((x) => x.spot)
        .sort((a, b) => Math.hypot(a.spot!.x - r.x, a.spot!.y - r.y) - Math.hypot(b.spot!.x - r.x, b.spot!.y - r.y))[0];
      if (best && goTo(r, env, best.spot!, 'toTable', `Va a la ${tableName(best.j.tableId)}`)) {
        r.claim = { kind: 'order', tableId: best.j.tableId };
        return true;
      }
    }
    if (kind === 'serve' && e.serve) {
      const waiting = new Set(guestViews().filter((g) => g.phase === 'waiting_food').map((g) => g.id));
      const order = game.save.orders.find((o) => o.plate && o.service && plateState(o.uid) === 'plated' && !o.plate.claim && waiting.has(o.service.partyId) && !others.has('s:' + o.uid));
      if (order && claimPlate(order.uid, e.id)) {
        if (goTo(r, env, env.tray(), 'toTray', 'Va a buscar un plato')) {
          r.claim = { kind: 'serve', uid: order.uid, tableId: order.service!.tableId };
          return true;
        }
        claimPlate(order.uid, null);
      }
    }
  }
  return false;
}
let tableNames: (id: string) => string = (id) => id;
const tableName = (id: string) => tableNames(id);
export function setTableNamer(fn: (id: string) => string) { tableNames = fn; }

function stillValid(r: Runtime): boolean {
  const c = r.claim;
  if (!c) return false;
  if (c.kind === 'order') return tableJobs().some((j) => j.tableId === c.tableId && j.phase === 'waiting_order');
  const o = game.save.orders.find((x) => x.uid === c.uid);
  const party = o?.service ? guestViews().find((g) => g.id === o.service!.partyId) : null;
  return !!o?.plate && o.plate.claim !== undefined && party?.phase === 'waiting_food';
}

function stepOf(e: Employee, r: Runtime, env: StaffEnv, dt: number) {
  // walking
  if (r.act === 'walk') {
    let move = walkSpeed(e) * dt;
    while (move > 0 && r.path.length) {
      const [tx, ty] = r.path[0];
      const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
      if (d <= move) { r.x = tx; r.y = ty; r.path.shift(); move -= d; }
      else { r.x += (dx / d) * move; r.y += (dy / d) * move; move = 0; }
      if (Math.abs(dx) > Math.abs(dy)) r.dir = dx > 0 ? 'right' : 'left'; else if (dy !== 0) r.dir = dy > 0 ? 'down' : 'up';
    }
    if (r.path.length) return;
    r.act = 'work';
    if (r.step === 'toTable') { r.step = 'ordering'; r.work = workSeconds(e, BASE_WORK.order); r.doing = 'Toma el pedido'; }
    else if (r.step === 'toTray') { r.step = 'picking'; r.work = workSeconds(e, BASE_WORK.pick); r.doing = 'Recoge el plato'; }
    else if (r.step === 'toServe') { r.step = 'serving'; r.work = workSeconds(e, BASE_WORK.serve); r.doing = 'Sirve el plato'; }
    else if (r.step === 'home') { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; }
    return;
  }
  if (r.act === 'work' && r.step) {
    if (r.step === 'home') { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; return; }
    if (!stillValid(r)) { release(r); goHome(r, env); return; }
    r.work -= dt;
    if (r.work > 0) return;
    const c = r.claim;
    if (r.step === 'ordering' && c?.kind === 'order') {
      takeOrderAt(c.tableId);
      gain(e, 6);
      release(r); goHome(r, env);
    } else if (r.step === 'picking' && c?.kind === 'serve') {
      r.carrying = c.uid;
      const spot = nearestSpot(r, env.tableSpots(c.tableId));
      if (!spot || !goTo(r, env, spot, 'toServe', `Lleva el plato a la ${tableName(c.tableId)}`)) { release(r); goHome(r, env); }
    } else if (r.step === 'serving' && c?.kind === 'serve') {
      const fail = staffDeliver(c.uid, e.id);
      if (!fail) gain(e, 8);
      release(r); goHome(r, env);
    }
    return;
  }
}

function goHome(r: Runtime, env: StaffEnv) {
  r.carrying = null;
  if (!goTo(r, env, env.home(), 'home', 'Vuelve a su lugar')) { r.step = null; r.act = 'idle'; r.doing = 'Esperando'; }
}

/** Runs every employee for `dt` seconds. */
export function tickStaff(dt: number, env: StaffEnv) {
  if (!game.has('intro_done') || !Number.isFinite(dt) || dt <= 0) return;
  const s = staffSave();
  if (sessionSave !== game.save) {
    // a loaded game: nobody is mid-task, so nothing stays reserved
    sessionSave = game.save;
    runtime.clear();
    for (const o of game.save.orders) if (o.plate?.claim) delete o.plate.claim;
  }
  for (const e of s.employees) {
    const r = rt(e, env);
    const off = s.paused || !!e.unpaid;
    if (off && r.claim) { release(r); goHome(r, env); }
    if (off && r.act === 'idle') { r.doing = e.unpaid ? 'Sin cobrar' : 'En pausa'; continue; }
    if (r.wait > 0) { r.wait -= dt; continue; }
    if (r.act === 'idle' && !r.claim) {
      if (!off && !pickJob(e, r, env)) r.wait = 0.8;
      continue;
    }
    stepOf(e, r, env, dt);
  }
}

/** Test helper */
export function resetStaffRuntime() { runtime.clear(); sessionSave = null; }
