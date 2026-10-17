import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { HOUSES, houseDoorTile } from '../data/houses';
import { STREET_PLANS, isStreetFixture } from '../data/outdoorLayout';
import { PROJECTS } from '../data/projects';
import { PROPS } from '../data/props';
import { ZONES } from '../data/zones';
import { buildZone } from '../world/zoneRuntime';
import { safeArrival } from '../world/zoneTransition';
import { gatherSpots } from '../systems/gather';

const FLAGS = ['unlock_forest', 'unlock_beach', 'unlock_garden', 'unlock_station', 'market_open', 'unlock_lighthouse_view'];
const LEGACY_HOUSES = ['house_plaza_1_27', 'house_plaza_18_27', 'house_plaza_24_27', 'house_plaza_30_27',
  'house_plaza_1_36', 'house_plaza_8_36', 'house_plaza_18_36', 'house_plaza_24_36', 'house_plaza_46_15', 'house_plaza_50_20',
  'house_beach_32_3', 'house_beach_40_3', 'house_beach_33_9', 'house_beach_40_9', 'house_garden_25_4', 'house_garden_31_4'];

beforeEach(() => { game.load(newSave()); });

describe('complete outdoor layout', () => {
  it('preserves all saved home identities, their regions, and return doors after relocation', () => {
    expect(HOUSES.map(h => h.id)).toEqual(LEGACY_HOUSES);
    for (const h of HOUSES) {
      const [x, y] = houseDoorTile(h);
      expect(h.id.startsWith('house_' + h.zone + '_')).toBe(true);
      expect(ZONES[h.zone].doors.find(d => d.to === h.id)).toMatchObject({ x, y });
      expect(ZONES[h.id].doors[0]).toMatchObject({ to: h.zone, tx: x, ty: y + 1 });
    }
  });

  it('keeps lamps and signposts beside walking lanes and away from entrances', () => {
    for (const id of Object.keys(STREET_PLANS)) for (const p of ZONES[id].props.filter(isStreetFixture)) {
      const def = PROPS[p.id], z = ZONES[id];
      for (let y = p.y; y < p.y + def.h; y++) for (let x = p.x; x < p.x + def.w; x++) {
        const label = `${id} ${p.id} ${x},${y}`;
        if (id !== 'market') expect('pcbh'.includes(z.ground[y][x]), label).toBe(false);
        else expect(x < 2 || x >= 39 || y < 6 || y >= 15, label).toBe(true);
        expect(z.doors.some(d => d.walk && d.x === x && (d.y === y || d.y + 1 === y)), label).toBe(false);
      }
    }
  });

  it('gives every shop and house a clear street return tile', () => {
    for (const id of ['plaza', 'beach', 'garden']) {
      const b = buildZone(id);
      for (const d of b.def.doors.filter(d => d.to.startsWith('house_') || d.to.startsWith('shop_') || d.to === 'restaurant' || d.to === 'library')) {
        expect(b.grid.isSolid(d.x, d.y + 1), `${id} ${d.to} threshold`).toBe(false);
      }
    }
  });

  it('connects every doorway by streets without requiring a detour across lawns', () => {
    for (const flag of FLAGS) game.save.flags[flag] = true;
    for (const id of Object.keys(STREET_PLANS)) {
      const b = buildZone(id), streets = b.grid.clone();
      for (let y = 0; y < b.def.h; y++) for (let x = 0; x < b.def.w; x++) {
        if (!'pcb'.includes(b.def.ground[y][x])) streets.setSolid(x, y, true);
      }
      const doors = b.def.doors.filter(d => d.walk), start = doors[0];
      for (const d of doors) {
        expect(streets.isSolid(d.x, d.y), `${id} ${d.to} threshold`).toBe(false);
        expect(streets.path(start.x, start.y, d.x, d.y, 20000), `${id} ${d.to} street access`).not.toBeNull();
      }
    }
  });

  it('keeps scenery and gathering off every street, before and after restoration', () => {
    const structural = new Set(['building', 'townhouse', 'sidehouse', 'fountain', 'shrine', 'stall', 'mill',
      'torii', 'stonestairs', 'waterfall', 'pier', 'village_bank', 'lighthouse']);
    for (const restored of [false, true]) {
      for (const flag of FLAGS) game.save.flags[flag] = true;
      game.save.flags.weather = 'rain';
      if (restored) for (const p of PROJECTS) for (let i = 1; i <= p.phases.length; i++) game.save.flags[`proj_${p.id}_${i}`] = true;
      for (const id of Object.keys(STREET_PLANS)) {
        const b = buildZone(id);
        for (const p of b.props.filter(p => !structural.has(p.def.kind) && !p.key.startsWith('block_'))) {
          for (let y = p.y; y < p.y + p.def.h; y++) for (let x = p.x; x < p.x + p.def.w; x++) {
            expect('pcb'.includes(b.def.ground[y]?.[x] ?? '?'), `${id} ${p.key} ${x},${y}`).toBe(false);
          }
        }
        for (const g of [...b.def.gather, ...gatherSpots(id)]) expect('pcb'.includes(b.def.ground[g.y][g.x]), `${id} gather ${g.x},${g.y}`).toBe(false);
      }
    }
  });

  it('keeps public lanes clear across their full width, and every timber deck on bridge terrain', () => {
    for (const f of FLAGS) game.save.flags[f] = true;
    for (const project of PROJECTS) for (let p = 1; p <= project.phases.length; p++) game.save.flags[`proj_${project.id}_${p}`] = true;
    for (const [id, plan] of Object.entries(STREET_PLANS)) {
      const b = buildZone(id);
      for (const [x, y, w, h, tile] of plan.paths.filter(p => 'pcb'.includes(p[4]))) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) expect.soft(b.grid.isSolid(i, j), `${id} lane ${i},${j} (${tile})`).toBe(false);
      }
      for (const p of b.props.filter(p => p.def.kind === 'village_deck')) for (let j = p.y; j < p.y + p.def.h; j++) for (let i = p.x; i < p.x + p.def.w; i++) {
        expect(b.def.ground[j][i], `${id} ${p.key} ${i},${j}`).toBe('b');
      }
    }
  });

  it('recovers outdoor positions occupied by a relocated building without dropping saved progress', () => {
    const s = newSave();s.coins = 721;s.inventory.wood = 9;s.quests.done = ['prologue'];s.flags.sign_restored = true;
    s.player = { ...s.player, zone: 'plaza', x: 12, y: 28 };
    game.load(s);
    const b = buildZone('plaza');expect(b.grid.isSolid(12, 28)).toBe(true);
    const p = safeArrival(b, s.player.x, s.player.y);
    expect(b.grid.isSolid(p.x, p.y)).toBe(false);
    expect(b.grid.path(p.x, p.y, 15, 22, 20000)).not.toBeNull();
    expect(game.save).toMatchObject({ coins: 721, inventory: { wood: 9 }, flags: { sign_restored: true }, quests: { done: ['prologue'] } });
  });

  for (const [name, level, phases] of [['initial', 1, 0], ['first renovations', 3, 1], ['second renovations', 7, 2], ['completed projects', 20, 4]] as const) {
    it(`${name}: buildings and paid scenery do not overlap, with all destinations reachable`, () => {
      game.save.restaurant.level = level;
      for (const flag of FLAGS) game.save.flags[flag] = true;
      for (const project of PROJECTS) for (let p = 1; p <= Math.min(phases, project.phases.length); p++) game.save.flags[`proj_${project.id}_${p}`] = true;
      for (const id of Object.keys(STREET_PLANS)) {
        const b = buildZone(id), occupied = new Map<string, string>();
        for (const p of b.props.filter(p => p.def.solid && p.key !== 'boat')) for (let dy = 0; dy < p.def.h; dy++) for (let dx = 0; dx < p.def.w; dx++) {
          const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
          expect.soft(occupied.get(key), `${id} ${p.key} ${key}`).toBeUndefined();
          expect.soft('wd'.includes(b.def.ground[y]?.[x] ?? 'w'), `${id} ${p.key} on water`).toBe(false);
          occupied.set(key, p.key);
        }
        const start = b.def.doors.find(d => d.walk)!;
        for (const d of b.def.doors.filter(d => d.walk)) expect(b.grid.path(start.x, start.y, d.x, d.y, 20000), `${id} ${d.to}`).not.toBeNull();
        for (const i of b.def.interact.filter(i => !i.cond?.startsWith('!'))) {
          const reachable = [[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => !b.grid.isSolid(i.x+dx,i.y+dy) && !!b.grid.path(start.x,start.y,i.x+dx,i.y+dy,20000));
          expect(reachable, `${id} ${i.id}`).toBe(true);
        }
      }
    });
  }
});
