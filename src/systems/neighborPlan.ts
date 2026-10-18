/**
 * What every neighbour does with each part of the day. Rules and seeded dice, no randomness that changes between
 * runs: the same day always gives the same village. Personalities tilt the odds (a shy person chats less, an
 * adventurer visits farther places, a night owl sleeps through the morning), rain keeps most people indoors, and
 * friends sometimes spend a free moment together.
 */
import { rng } from '../art/pixel';
import type { Dir } from '../core/types';
import { NEIGHBORS, type Like, type Neighbor } from '../data/neighbors';
import { ZONES } from '../data/zones';
import { restPhase } from './residentSleep';
import { FOREST, FOUNTAIN, GARDEN, MARKET, SHORE, STROLL, allBenches, byDoor, homeActivity, shoreSpots, shopSpot, tileOpen, type Place } from './neighborSpots';

export interface PlanContext {
  day: number;
  /** 0 morning .. 3 night */
  period: number;
  minutes?: number;
  /** first or second half of the period */
  half: 0 | 1;
  /** quarter of the period (about 45 real seconds each): people change place four times per part of the day */
  part?: 0 | 1 | 2 | 3;
  rain: boolean;
  /** zones the player has opened (beach, garden, forest, market at night...) */
  open: ReadonlySet<string>;
}

export type Activity = 'home' | 'work' | 'free' | 'stroll' | 'chat' | 'errand';

const hash = (s: string) => { let h = 17; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h; };
const BASE: Record<number, Record<Activity, number>> = {
  0: { home: 0.12, work: 0.45, free: 0.18, stroll: 0.12, chat: 0, errand: 0.13 },
  1: { home: 0.08, work: 0.28, free: 0.26, stroll: 0.16, chat: 0.08, errand: 0.14 },
  2: { home: 0.15, work: 0, free: 0.32, stroll: 0.15, chat: 0.25, errand: 0.13 },
  3: { home: 0.78, work: 0, free: 0.14, stroll: 0, chat: 0.08, errand: 0 },
};
/** the businesses a neighbour can pop into (interior zones with a street door) */
const ERRAND_ZONES = ['shop_taro', 'shop_yuki', 'shop_bento', 'library'];

/** the odds of each activity for this person at this time */
export function weights(n: Neighbor, ctx: PlanContext): Record<Activity, number> {
  const w = { ...BASE[ctx.period] };
  const has = (t: Neighbor['traits'][number]) => n.traits.includes(t);
  if (!n.shop) { w.stroll += w.work * 0.6; w.free += w.work * 0.4; w.work = 0; }
  if (has('nocturnal')) {
    if (ctx.period <= 1) w.home *= ctx.period === 0 ? 3.5 : 2;
    if (ctx.period === 3) { w.home *= 0.2; w.free *= 3; w.stroll += 0.2; }
  }
  if (has('shy')) { w.chat *= 0.3; w.stroll *= 0.7; }
  if (has('sociable')) { w.chat *= 2.5; w.stroll *= 1.2; w.errand *= 1.3; }
  if (has('shy')) w.errand *= 0.7;
  if (has('hardworking') && ctx.period <= 1) { w.work *= 1.8; w.free *= 0.6; }
  if (has('sporty')) w.stroll *= 1.7;
  if (ctx.rain) {
    const k = has('adventurous') ? 0.5 : 0.2;
    w.stroll *= k; w.chat *= k;
    w.free *= n.likes.includes('read') ? 1 : k;
    w.home *= 3;
  }
  return w;
}

function pickActivity(w: Record<Activity, number>, roll: number): Activity {
  const entries = (Object.entries(w) as [Activity, number][]).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let t = roll * total;
  for (const [a, v] of entries) { if ((t -= v) < 0) return a; }
  return 'home';
}

function spotsFor(like: Like, ctx: PlanContext, n: Neighbor): Place[] {
  switch (like) {
    case 'bench': return allBenches().filter((p) => p.zone === 'plaza' || ctx.open.has(p.zone));
    case 'read': return allBenches().filter((p) => p.zone === 'library');
    case 'fountain': return FOUNTAIN;
    case 'sea': return ctx.open.has('beach') ? SHORE : [];
    case 'garden': return ctx.open.has('garden') ? GARDEN : [];
    case 'forest': return ctx.open.has('forest') ? FOREST : [];
    case 'market': return ctx.open.has('market') ? MARKET : [];
    case 'shop': { const s = n.shop ? shopSpot(n.shop) : null; return s ? [s] : []; }
  }
}

/** Everyone's place for this part of the day. */
export function planVillage(ctx: PlanContext, roster: readonly Neighbor[] = NEIGHBORS): Map<string, Place & { ride?: boolean; withFriend?: string }> {
  const out = new Map<string, Place & { ride?: boolean; withFriend?: string }>();
  const used = new Set<string>();
  const slot = ctx.period * 4 + (ctx.part ?? ctx.half * 2);
  const seats = new Set(allBenches().map((b) => `${b.zone}:${b.x}:${b.y}`));
  const shifts: [number, number][] = [[0, 0]];
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      shifts.push([dx, dy]);
    }
  }
  const open = (zone: string, x: number, y: number) => {
    const key = `${zone}:${x}:${y}`;
    return !used.has(key) && tileOpen(zone, x, y) && !byDoor(zone, x, y);
  };
  const take = (p: Place, x: number, y: number): Place => {
    const key = `${p.zone}:${x}:${y}`;
    used.add(key);
    const spot = x === p.x && y === p.y ? p : { ...p, x, y };
    if (spot.seatLift && !seats.has(key)) return { ...spot, seatLift: 0 };
    return spot;
  };
  /** A free tile near the wanted one. Never stacks two people, and never leaves them in a doorway. */
  const claim = (p: Place, id: string): Place => {
    void id;
    if (p.kind === 'home') {
      used.add(`${p.zone}:${p.x}:${p.y}`);
      return p;
    }
    const bench = p.kind === 'bench' || p.kind === 'read';
    for (const [dx, dy] of shifts) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!open(p.zone, x, y)) continue;
      if (bench && !seats.has(`${p.zone}:${x}:${y}`)) continue;
      return take(p, x, y);
    }
    if (bench) {
      for (const [dx, dy] of shifts) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (!open(p.zone, x, y)) continue;
        used.add(`${p.zone}:${x}:${y}`);
        return { ...p, x, y, seatLift: 0, act: 'look', kind: 'stroll' };
      }
    }
    const z = ZONES[p.zone];
    if (z) {
      let best: [number, number] | null = null;
      let bestD = 1e9;
      for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
        if (!open(p.zone, x, y)) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (d < bestD) { bestD = d; best = [x, y]; }
      }
      if (best) {
        used.add(`${p.zone}:${best[0]}:${best[1]}`);
        return { ...p, x: best[0], y: best[1], seatLift: 0, act: bench ? 'look' : p.act, kind: bench ? 'stroll' : p.kind };
      }
    }
    used.add(`${p.zone}:${p.x}:${p.y}`);
    return p;
  };
  const claimExact = (p: Place): Place | null => {
    if (!open(p.zone, p.x, p.y)) return null;
    return take(p, p.x, p.y);
  };
  const chatters: Neighbor[] = [];
  const mood = new Map<string, Activity>();
  for (const n of roster) {
    const rest = restPhase(n.id, ctx.period, ctx.minutes ?? 0, ctx.rain);
    if (rest !== 'awake') {
      out.set(n.id, claim(homeActivity(n, ctx.period, rest === 'sleeping'), n.id));
      mood.set(n.id, 'home');
      continue;
    }
    const r = rng(hash(n.id) * 7 + ctx.day * 131 + slot * 17);
    const act = pickActivity(weights(n, ctx), r());
    mood.set(n.id, act);
    if (act === 'home') { out.set(n.id, claim(homeActivity(n, ctx.period, false), n.id)); continue; }
    if (act === 'work') { const s = n.shop ? shopSpot(n.shop) : null; out.set(n.id, claim(s ?? homeActivity(n, ctx.period, false), n.id)); continue; }
    if (act === 'chat') { chatters.push(n); continue; }
    if (act === 'errand') {
      // a visit to someone else's business: walks there, looks around, then moves on with the next part of the day
      const zones = ERRAND_ZONES.filter((z) => z !== n.shop);
      const spot = shopSpot(zones[Math.floor(r() * zones.length)]);
      if (spot) { out.set(n.id, claim({ ...spot, act: spot.zone === 'library' ? 'read' : 'look', kind: 'errand' }, n.id)); continue; }
    }
    let pool: Place[] = [];
    if (ctx.period === 3 && (act === 'free' || act === 'stroll')) {
      pool = nightHangouts(ctx);
    } else if (act === 'free') {
      // adventurers lean on the far places, the rest on their favourites
      const likes = n.traits.includes('adventurous') ? [...n.likes, 'sea', 'forest', 'garden'] as Like[] : n.likes;
      for (const l of likes) pool.push(...spotsFor(l, ctx, n));
      if (!pool.length) pool = STROLL;
    } else pool = STROLL.filter((p) => p.zone === 'plaza' || ctx.open.has(p.zone));
    if (!pool.length) { out.set(n.id, claim(homeActivity(n, ctx.period, false), n.id)); continue; }
    const p = pool[Math.floor(r() * pool.length)];
    out.set(n.id, { ...claim(p, n.id), ride: !!n.bike && (act === 'stroll' || p.kind === 'sea') });
  }
  // chatters pair up at different spots, facing each other, instead of crowding one fountain
  if (chatters.length) {
    const meet = rng(ctx.day * 977 + slot * 31);
    const anchors = ctx.period === 3
      ? nightHangouts(ctx)
      : [...FOUNTAIN, ...allBenches().filter((b) => b.zone === 'plaza'), ...STROLL.filter((p) => p.zone === 'plaza')];
    const parked: { x: number; y: number }[] = [];
    const pickAnchor = (): Place | null => {
      if (!anchors.length) return null;
      let fallback: Place | null = null;
      for (let k = 0; k < anchors.length; k++) {
        const at = anchors[Math.floor(meet() * anchors.length)];
        if (!fallback) fallback = at;
        if (parked.every((p) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) >= 4)) return at;
      }
      return fallback;
    };
    const beside = (at: Place): Place | null => {
      const opts: [number, number][] = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [0, 3], [-3, 0], [0, -3]];
      for (const [dx, dy] of opts) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (tileOpen(at.zone, x, y) && !byDoor(at.zone, x, y)) return { ...at, x, y, seatLift: 0, bed: undefined };
      }
      return null;
    };
    for (let i = 0; i < chatters.length; i += 2) {
      const a = chatters[i];
      const b = chatters[i + 1];
      const at = pickAnchor();
      if (!at) {
        out.set(a.id, claim(homeActivity(a, ctx.period, false), a.id));
        if (b) out.set(b.id, claim(homeActivity(b, ctx.period, false), b.id));
        continue;
      }
      parked.push(at);
      if (!b) {
        out.set(a.id, claim(at, a.id));
        continue;
      }
      const other = beside(at);
      const pa = claim({ ...at, kind: 'chat', act: 'talk', seatLift: 0 }, a.id);
      const pb = other ? claim({ ...other, kind: 'chat', act: 'talk' }, b.id) : claim({ ...at, x: at.x + 2, kind: 'chat', act: 'talk', seatLift: 0 }, b.id);
      out.set(a.id, { ...pa, act: 'talk', kind: 'chat', dir: faceToward(pa, pb) });
      out.set(b.id, { ...pb, act: 'talk', kind: 'chat', dir: faceToward(pb, pa) });
    }
  }
  // friends who are both out stand a couple of tiles apart and face each other
  for (const n of roster) for (const fid of n.friends) {
    if (n.id > fid) continue;
    const a = out.get(n.id), b = out.get(fid);
    if (!a || !b || a.kind === 'home' || b.kind === 'home' || a.kind === 'shop' || b.kind === 'shop' || a.zone !== 'plaza' && !ctx.open.has(a.zone)) continue;
    if (mood.get(n.id) === 'chat' || mood.get(fid) === 'chat') continue;
    const roll = rng(hash(n.id + fid) + ctx.day * 53 + slot)();
    if (roll >= 0.45) continue;
    const oldKey = `${b.zone}:${b.x}:${b.y}`;
    used.delete(oldKey);
    const offs: [number, number][] = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3], [2, 1], [-2, 1]];
    let spot: Place | null = null;
    for (const [dx, dy] of offs) {
      const trial = claimExact({ ...a, x: a.x + dx, y: a.y + dy, act: 'talk', kind: 'together', seatLift: 0, bed: undefined, dir: 'down' });
      if (!trial) continue;
      spot = { ...trial, dir: faceToward(trial, a) };
      break;
    }
    if (!spot) { used.add(oldKey); continue; }
    out.set(fid, { ...spot, withFriend: n.id });
    if (!a.seatLift) out.set(n.id, { ...a, dir: faceToward(a, spot), act: a.act === 'sit' || a.act === 'read' ? a.act : 'talk' });
    else out.set(n.id, { ...a, dir: faceToward(a, spot) });
  }
  return out;
}

/** Where someone who is still out after dark sits: the plaza, the beach, or a stream. */
function nightHangouts(ctx: PlanContext): Place[] {
  const sit = (spots: Place[]): Place[] => spots.map((p) => ({ ...p, act: 'sit' as const }));
  const spots = [
    ...sit(allBenches().filter((p) => p.zone === 'plaza')),
    ...(ctx.open.has('beach') ? sit(SHORE) : []),
    ...(ctx.open.has('garden') ? sit(shoreSpots('garden')) : []),
    ...(ctx.open.has('forest') ? sit(shoreSpots('forest')) : []),
  ];
  return spots.length ? spots : STROLL.filter((p) => p.zone === 'plaza');
}

function faceToward(from: { x: number; y: number }, to: { x: number; y: number }): Dir {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
