import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { NEIGHBORS } from '../data/neighbors';
import { ZONES } from '../data/zones';
import { planVillage, type PlanContext } from '../systems/neighborPlan';
import { FOREST, FOUNTAIN, GARDEN, SHORE, STROLL, allBenches, homeActivity, tileOpen } from '../systems/neighborSpots';
import { NeighborLife } from '../systems/neighbors';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';
import { HOUSES } from '../data/houses';
import { houseDoorPlan } from '../data/houseInterior';
import { restPose } from '../entities/restPose';
import { FRAMES } from '../art/characters';

const OPEN = new Set(['plaza', 'library', 'beach', 'garden', 'forest']);
const ctx = (day: number, period: number, half: 0 | 1, rain = false): PlanContext => ({ day, period, half, rain, open: OPEN });
const outdoors = (zone: string) => !zone.startsWith('house_') && !zone.startsWith('shop_') && zone !== 'library';

function count(pick: (c: PlanContext) => PlanContext[], test: (id: string, p: ReturnType<typeof planVillage> extends Map<string, infer P> ? P : never) => boolean, ids?: string[]) {
  let n = 0, total = 0;
  for (let day = 1; day <= 30; day++) for (const c of pick(ctx(day, 0, 0))) {
    for (const [id, p] of planVillage(c)) { if (ids && !ids.includes(id)) continue; total++; if (test(id, p)) n++; }
  }
  return { n, total };
}
const slots = (period: number, rain = false) => (c: PlanContext) => [0, 1].map((h) => ({ ...c, period, half: h as 0 | 1, rain }));

beforeEach(() => { game.load(newSave('T')); });

describe('ambient neighbours', () => {
  it('are twelve distinct people with their own house, real friends and something to say', () => {
    expect(NEIGHBORS).toHaveLength(12);
    expect(new Set(NEIGHBORS.map((n) => n.id)).size).toBe(12);
    expect(new Set(NEIGHBORS.map((n) => n.home)).size).toBe(12);
    for (const n of NEIGHBORS) {
      expect(ZONES[n.home], n.id).toBeTruthy();
      expect(n.lines.length, n.id).toBeGreaterThan(0);
      for (const f of n.friends) expect(NEIGHBORS.some((x) => x.id === f), `${n.id} friend ${f}`).toBe(true);
    }
  });

  it('plan the same day the same way, never share a tile, and only use places that can be walked to', () => {
    const a = planVillage(ctx(5, 1, 0)), b = planVillage(ctx(5, 1, 0));
    expect([...a]).toEqual([...b]);
    const grids = new Map<string, ReturnType<typeof buildZone>['grid']>();
    for (let day = 1; day <= 10; day++) for (let period = 0; period < 4; period++) {
      const seen = new Set<string>();
      for (const [id, p] of planVillage(ctx(day, period, 1))) {
        if (p.kind !== 'home') expect(seen.has(`${p.zone}:${p.x}:${p.y}`), `${id} shares a tile`).toBe(false);
        seen.add(`${p.zone}:${p.x}:${p.y}`);
        const g = grids.get(p.zone) ?? grids.set(p.zone, buildZone(p.zone).grid).get(p.zone)!;
        expect(g.isSolid(p.x, p.y) ? !!g.nearestWalkable(p.x, p.y) : true, `${id} ${p.zone} ${p.x},${p.y}`).toBe(true);
      }
    }
    for (const p of [...FOUNTAIN, ...SHORE, ...GARDEN, ...FOREST, ...STROLL, ...allBenches()]) {
      const g = grids.get(p.zone) ?? grids.set(p.zone, buildZone(p.zone).grid).get(p.zone)!;
      expect(g.isSolid(p.x, p.y) ? !!g.nearestWalkable(p.x, p.y) : true, `${p.kind} ${p.zone} ${p.x},${p.y}`).toBe(true);
    }
  });

  it('stay in more when it rains, and far fewer walk the streets', () => {
    const dry = count(slots(1, false), (_id, p) => outdoors(p.zone));
    const wet = count(slots(1, true), (_id, p) => outdoors(p.zone));
    expect(wet.n / wet.total).toBeLessThan((dry.n / dry.total) * 0.6);
  });

  it('keep night owls out at night and in during the morning, unlike everyone else', () => {
    const owls = NEIGHBORS.filter((n) => n.traits.includes('nocturnal')).map((n) => n.id);
    const others = NEIGHBORS.filter((n) => !n.traits.includes('nocturnal')).map((n) => n.id);
    const night = (ids: string[]) => count(slots(3), (_i, p) => outdoors(p.zone), ids);
    const asleep = (ids: string[]) => count(slots(0), (_i, p) => p.kind === 'home', ids);
    expect(night(owls).n / night(owls).total).toBeGreaterThan(night(others).n / night(others).total);
    expect(asleep(owls).n / asleep(owls).total).toBeGreaterThan(asleep(others).n / asleep(others).total + 0.2);
  });

  it('chat more when sociable than when shy, and friends sometimes spend a moment together', () => {
    const social = NEIGHBORS.filter((n) => n.traits.includes('sociable')).map((n) => n.id);
    const shy = NEIGHBORS.filter((n) => n.traits.includes('shy')).map((n) => n.id);
    const talk = (ids: string[]) => count(slots(2), (_i, p) => p.act === 'talk', ids);
    expect(talk(social).n / talk(social).total).toBeGreaterThan(talk(shy).n / talk(shy).total);
    let together = 0;
    for (let day = 1; day <= 30; day++) for (const c of slots(1)(ctx(day, 1, 0))) for (const p of planVillage(c).values()) if (p.withFriend) together++;
    expect(together).toBeGreaterThan(0);
  });

  it('reads benches, water and paths from the map instead of a fixed list', () => {
    expect(STROLL.length).toBeGreaterThan(0);
    expect(allBenches().length).toBeGreaterThan(0);
    const step = (dir: string, x: number, y: number): [number, number] => dir === 'down' ? [x, y + 1] : dir === 'up' ? [x, y - 1] : dir === 'right' ? [x + 1, y] : [x - 1, y];
    for (const p of FOUNTAIN) {
      expect(tileOpen(p.zone, p.x, p.y), `fountain ${p.x},${p.y}`).toBe(true);
      const [fx, fy] = step(p.dir ?? 'down', p.x, p.y);
      expect(tileOpen(p.zone, fx, fy), `faces fountain ${p.x},${p.y}`).toBe(false);
    }
    for (const p of SHORE) {
      const [fx, fy] = step(p.dir ?? 'down', p.x, p.y);
      expect('wd'.includes(ZONES[p.zone].ground[fy]?.[fx] ?? ''), `${p.x},${p.y} faces water`).toBe(true);
    }
    for (const p of [...GARDEN, ...FOREST, ...STROLL]) expect(tileOpen(p.zone, p.x, p.y), `${p.kind} ${p.zone} ${p.x},${p.y}`).toBe(true);
  });

  it('sleeps beside the bed at night and sits or reads by a chair during the day', () => {
    ensureDefaultDecor();
    for (const n of NEIGHBORS) {
      const house = HOUSES.find((h) => h.id === n.home)!;
      const door = houseDoorPlan(house);
      const grid = buildZone(n.home).grid;
      const night = homeActivity(n, 3);
      expect(night.act, n.id).toBe('sleep');
      expect(grid.isSolid(night.x, night.y), n.id).toBe(false);
      expect(grid.path(door.spawnX, door.spawnY, night.x, night.y), n.id).not.toBeNull();
      expect(grid.path(night.x, night.y, 5, 5), n.id).not.toBeNull();
      const day = homeActivity(n, 1);
      expect(grid.isSolid(day.x, day.y), n.id).toBe(false);
      expect(day.act === 'sit' || day.act === 'read' || day.act === 'look', n.id).toBe(true);
      if (day.seatLift) expect(day.dir, n.id).toBe('up');
    }
  });

  it('keeps a strolling neighbour walking: after a short while they move on to another spot a few tiles away', () => {
    const life = new NeighborLife();
    let stroller: ReturnType<typeof life.state.get> | undefined;
    for (let day = 1; day <= 12 && !stroller; day++) {
      game.save.time.day = day;
      game.save.time.period = 1;
      game.save.time.minutes = 20;
      life.sync();
      const found = [...life.state.values()].find((s) => s.anchor.kind === 'stroll');
      if (!found) continue;
      found.beat = 0;
      found.hops = 0;
      found.trip.place({ zone: found.anchor.zone, x: found.anchor.x, y: found.anchor.y });
      stroller = found;
    }
    expect(stroller, 'someone strolls').toBeTruthy();
    const anchor = { ...stroller!.anchor };
    for (let i = 0; i < 240; i++) life.tick(0.5); // two minutes
    expect(stroller!.hops).toBeGreaterThanOrEqual(2);
    const dest = stroller!.trip.destination;
    expect(Math.hypot(dest.x - anchor.x, dest.y - anchor.y)).toBeGreaterThanOrEqual(3);
    expect(buildZone(anchor.zone).grid.isSolid(dest.x, dest.y)).toBe(false);
  });

  it('plans four parts per period and sends some neighbours to visit other businesses', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 20; day++) for (const part of [0, 1, 2, 3] as const) {
      const plan = planVillage({ day, period: 1, half: part > 1 ? 1 : 0, part, rain: false, open: OPEN });
      for (const p of plan.values()) seen.add(p.kind);
    }
    expect(seen.has('errand')).toBe(true);
    const a = planVillage({ day: 3, period: 1, half: 0, part: 0, rain: false, open: OPEN });
    const b = planVillage({ day: 3, period: 1, half: 0, part: 1, rain: false, open: OPEN });
    expect([...a].some(([id, p]) => { const q = b.get(id)!; return q.x !== p.x || q.y !== p.y; })).toBe(true);
  });
});

describe('raccoon rest', () => {
  it('gives each raccoon a different way to fall asleep, then a quiet breath', () => {
    expect(restPose('spicy', 0.2).frame).toBe(FRAMES.happy);
    expect(restPose('spicy', 0.2).lie).toBe(false);
    expect(restPose('rigg', 0.4).frame).toBe(FRAMES.read);
    expect(restPose('rigg', 0.4).lie).toBe(false);
    expect(restPose('pip', 0.2).frame).toBe(FRAMES.sit);
    expect(restPose('pip', 0.2).lie).toBe(false);
    for (const id of ['pip', 'spicy', 'rigg']) {
      const rest = restPose(id, 3);
      expect(rest.frame).toBe(FRAMES.sleep);
      expect(rest.lie).toBe(true);
      expect(rest.z).toBe(false);
    }
    expect(restPose('ren', 0).lie).toBe(true);
    expect(restPose('pip', 8.01).z).toBe(true);
  });
});
