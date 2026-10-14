import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { ZONES } from '../data/zones';
import { buildZone } from '../world/zoneRuntime';

const OUTDOOR = Object.values(ZONES).filter((z) => z.outdoor).map((z) => z.id);
const FLAGS = ['unlock_forest', 'unlock_beach', 'unlock_garden', 'unlock_station', 'market_open', 'unlock_lighthouse_view'];

beforeEach(() => { game.load(newSave('Tester')); });

function reach(zone: string, from: [number, number], to: [number, number]) {
  const g = buildZone(zone).grid;
  return !!g.path(from[0], from[1], to[0], to[1], 20000);
}
const near = (g: ReturnType<typeof buildZone>['grid'], x: number, y: number): [number, number][] =>
  ([[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]] as const).map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([a, b]) => !g.isSolid(a, b));

describe('outdoor zones', () => {
  for (const id of OUTDOOR) {
    it(`${id}: every open door, interaction and gathering spot can be reached`, () => {
      for (const f of FLAGS) game.setFlag(f);
      const built = buildZone(id);
      const d0 = built.def.doors.find((d) => d.walk)!;
      const start: [number, number] = [d0.x, d0.y];
      for (const d of built.def.doors) if (d.walk) expect(reach(id, start, [d.x, d.y]), `${id} door ${d.to} ${d.x},${d.y}`).toBe(true);
      for (const i of built.def.interact) {
        if (i.cond && i.cond.startsWith('!')) continue; // obstacles are gone with the flags set
        const ok = near(built.grid, i.x, i.y).some(([x, y]) => reach(id, start, [x, y]));
        expect(ok, `${id} interact ${i.id} ${i.x},${i.y}`).toBe(true);
      }
      for (const gth of built.def.gather) expect(near(built.grid, gth.x, gth.y).some(([x, y]) => reach(id, start, [x, y])), `${id} gather ${gth.x},${gth.y}`).toBe(true);
    });
  }

  it('plaza: each closed path is shut by something you can see until its flag is set', () => {
    const def = ZONES.plaza;
    const from: [number, number] = [15, 15];
    for (const d of def.doors) {
      if (!d.lock) continue;
      const closed = buildZone('plaza');
      expect(closed.grid.path(from[0], from[1], d.x, d.y, 30000), `closed ${d.to}`).toBeNull();
      expect(closed.props.some((p) => p.key.startsWith('block_')), 'an obstacle prop exists').toBe(true);
      game.setFlag(d.lock.flag);
      expect(buildZone('plaza').grid.path(from[0], from[1], d.x, d.y, 30000), `open ${d.to}`).not.toBeNull();
      game.save.flags = {};
    }
  });

  it('solid props never overlap and never sit on water', () => {
    for (const f of FLAGS) game.save.flags[f] = true;
    for (const id of OUTDOOR) {
      const built = buildZone(id);
      const seen = new Map<string, string>();
      for (const p of built.props) {
        if (!p.def.solid) continue;
        for (let j = 0; j < p.def.h; j++) for (let i = 0; i < p.def.w; i++) {
          const key = `${p.x + i},${p.y + j}`;
          const other = seen.get(key);
          if (other && !(['boat'].includes(p.key) || ['boat'].includes(other))) expect.soft(other, `${id} ${key} ${p.key}`).toBeUndefined();
          seen.set(key, p.key);
          const ch = built.def.ground[p.y + j]?.[p.x + i];
          if (ch === 'w' || ch === 'd') expect.soft(['boat'], `${id} ${key} ${p.key} on water`).toContain(p.key);
        }
      }
    }
  });
});
