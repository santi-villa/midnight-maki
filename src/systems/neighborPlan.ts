/**
 * What every neighbour does with each part of the day. Rules and seeded dice, no randomness that changes between
 * runs: the same day always gives the same village. Personalities tilt the odds (a shy person chats less, an
 * adventurer visits farther places, a night owl sleeps through the morning), rain keeps most people indoors, and
 * friends sometimes spend a free moment together.
 */
import { rng } from '../art/pixel';
import { NEIGHBORS, type Like, type Neighbor } from '../data/neighbors';
import { FOREST, FOUNTAIN, GARDEN, MARKET, SHORE, STROLL, allBenches, homeSpot, shopSpot, type Place } from './neighborSpots';

export interface PlanContext {
  day: number;
  /** 0 morning .. 3 night */
  period: number;
  /** first or second half of the period */
  half: 0 | 1;
  rain: boolean;
  /** zones the player has opened (beach, garden, forest, market at night...) */
  open: ReadonlySet<string>;
}

export type Activity = 'home' | 'work' | 'free' | 'stroll' | 'chat';

const hash = (s: string) => { let h = 17; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h; };
const BASE: Record<number, Record<Activity, number>> = {
  0: { home: 0.15, work: 0.5, free: 0.2, stroll: 0.15, chat: 0 },
  1: { home: 0.1, work: 0.3, free: 0.3, stroll: 0.2, chat: 0.1 },
  2: { home: 0.2, work: 0, free: 0.35, stroll: 0.15, chat: 0.3 },
  3: { home: 0.8, work: 0, free: 0.2, stroll: 0, chat: 0 },
};

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
  if (has('sociable')) { w.chat *= 2.5; w.stroll *= 1.2; }
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
  const slot = ctx.period * 2 + ctx.half;
  const claim = (p: Place, id: string): Place => {
    // nobody shares a tile; the next one over takes the spot
    let q = p;
    for (let i = 0; i < 6 && used.has(`${q.zone}:${q.x}:${q.y}`) && q.kind !== 'home'; i++) q = { ...p, x: p.x + ((i % 2) ? -1 - (i >> 1) : 1 + (i >> 1)) };
    used.add(`${q.zone}:${q.x}:${q.y}`);
    void id;
    return q;
  };
  const chatters: Neighbor[] = [];
  const mood = new Map<string, Activity>();
  for (const n of roster) {
    const r = rng(hash(n.id) * 7 + ctx.day * 131 + slot * 17);
    const act = pickActivity(weights(n, ctx), r());
    mood.set(n.id, act);
    if (act === 'home') { out.set(n.id, claim(homeSpot(n), n.id)); continue; }
    if (act === 'work') { const s = n.shop ? shopSpot(n.shop) : null; out.set(n.id, claim(s ?? homeSpot(n), n.id)); continue; }
    if (act === 'chat') { chatters.push(n); continue; }
    let pool: Place[] = [];
    if (act === 'free') {
      // adventurers lean on the far places, the rest on their favourites
      const likes = n.traits.includes('adventurous') ? [...n.likes, 'sea', 'forest', 'garden'] as Like[] : n.likes;
      for (const l of likes) pool.push(...spotsFor(l, ctx, n));
      if (!pool.length) pool = STROLL;
    } else pool = STROLL.filter((p) => p.zone === 'plaza' || ctx.open.has(p.zone));
    if (!pool.length) { out.set(n.id, claim(homeSpot(n), n.id)); continue; }
    const p = pool[Math.floor(r() * pool.length)];
    out.set(n.id, { ...claim(p, n.id), ride: !!n.bike && (act === 'stroll' || p.kind === 'sea') });
  }
  // chatters meet at one spot in the square, up to three together
  if (chatters.length) {
    const meet = rng(ctx.day * 977 + slot * 31);
    const anchors = [...FOUNTAIN, ...STROLL.filter((p) => p.zone === 'plaza')];
    const at = anchors[Math.floor(meet() * anchors.length)];
    chatters.forEach((n, i) => { const g = Math.floor(i / 3); out.set(n.id, { ...claim({ ...at, x: at.x + (i % 3) - 1 + g * 4, kind: 'chat' }, n.id), act: 'talk' }); });
  }
  // friends who are both out sometimes spend the moment together
  for (const n of roster) for (const fid of n.friends) {
    if (n.id > fid) continue;
    const a = out.get(n.id), b = out.get(fid);
    if (!a || !b || a.kind === 'home' || b.kind === 'home' || a.kind === 'shop' || b.kind === 'shop' || a.zone !== 'plaza' && !ctx.open.has(a.zone)) continue;
    if (mood.get(n.id) === 'chat' || mood.get(fid) === 'chat') continue;
    const roll = rng(hash(n.id + fid) + ctx.day * 53 + slot)();
    if (roll < 0.45) out.set(fid, { ...claim({ ...a, x: a.x + 1, act: 'talk', kind: 'together' }, fid), withFriend: n.id });
  }
  return out;
}
