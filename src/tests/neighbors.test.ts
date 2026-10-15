import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { NEIGHBORS } from '../data/neighbors';
import { ZONES } from '../data/zones';
import { planVillage, type PlanContext } from '../systems/neighborPlan';
import { FOREST, FOUNTAIN, GARDEN, SHORE, STROLL, allBenches } from '../systems/neighborSpots';
import { buildZone } from '../world/zoneRuntime';

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
});
