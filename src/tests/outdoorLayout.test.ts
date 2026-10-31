import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { HOUSES, houseDoorTile } from '../data/houses';
import { PROJECTS } from '../data/projects';
import { ZONES } from '../data/zones';
import { VILLAGE_HOME_SITES } from '../data/villageGeography';
import { VILLAGE_SQUARE } from '../data/villageWorld';
import { buildZone } from '../world/zoneRuntime';
import { migrateVillagePosition } from '../world/villageMigration';
import { safeArrival } from '../world/zoneTransition';
import { routeDoor } from '../systems/journeys';

const FLAGS = ['unlock_forest', 'unlock_beach', 'unlock_garden', 'unlock_station', 'market_open', 'unlock_lighthouse_view', 'lighthouse_open'];
const outdoors = Object.values(ZONES).filter(z => z.outdoor);
const LEGACY = ['house_plaza_1_27', 'house_plaza_18_27', 'house_plaza_24_27', 'house_plaza_30_27', 'house_plaza_1_36', 'house_plaza_8_36', 'house_plaza_18_36', 'house_plaza_24_36', 'house_plaza_46_15', 'house_plaza_50_20', 'house_beach_32_3', 'house_beach_40_3', 'house_beach_33_9', 'house_beach_40_9', 'house_garden_25_4', 'house_garden_31_4'];
beforeEach(() => { game.load(newSave()); });
const openAll = () => FLAGS.forEach(f => game.setFlag(f));

describe('approved village geography', () => {
  it('preserves every home identity, interior and return doorstep after moving neighbourhoods', () => {
    expect(HOUSES.map(h => h.id)).toEqual(LEGACY);
    HOUSES.forEach((h, i) => {
      const [x, y] = houseDoorTile(h);
      expect([h.zone, h.x, h.y]).toEqual(VILLAGE_HOME_SITES[i]);
      expect(ZONES[h.zone].doors.find(d => d.to === h.id)).toMatchObject({ x, y });
      expect(ZONES[h.id].doors[0]).toMatchObject({ to: h.zone, tx: x, ty: y + 1 });
      expect(buildZone(h.zone).grid.isSolid(x, y + 1), h.id).toBe(false);
    });
  });
  it('keeps complete building silhouettes outside the civic square', () => {
    const s = VILLAGE_SQUARE;
    for (const z of outdoors) for (const p of buildZone(z.id).props.filter(p => ['building', 'townhouse', 'sidehouse'].includes(p.def.kind))) {
      const b = { x: z.world!.x + p.x, y: z.world!.y + p.y + p.def.h - p.def.sh / 16, w: p.def.sw / 16, h: p.def.sh / 16 };
      expect(b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h && b.y + b.h > s.y, `${z.id} ${p.key}`).toBe(false);
      expect(b.x).toBeGreaterThanOrEqual(z.world!.x);
      expect(b.y).toBeGreaterThanOrEqual(z.world!.y);
      expect(b.x + b.w).toBeLessThanOrEqual(z.world!.x + z.w);
      expect(b.y + b.h).toBeLessThanOrEqual(z.world!.y + z.h);
    }
  });
  it('joins districts on the same world street and arrives inside without a return-door loop', () => {
    openAll();
    for (const z of outdoors) for (const d of z.doors.filter(d => ZONES[d.to].outdoor)) {
      const q = ZONES[d.to];
      const distance = Math.abs(q.world!.x + d.tx - z.world!.x - d.x) + Math.abs(q.world!.y + d.ty - z.world!.y - d.y);
      expect(distance, `${z.id}/${q.id}`).toBe(2);
      expect(buildZone(q.id).grid.isSolid(d.tx, d.ty), `${z.id}/${q.id} landing`).toBe(false);
      expect(q.doors.some(back => back.walk && back.x === d.tx && back.y === d.ty), `${z.id}/${q.id} bounce`).toBe(false);
    }
    for (const z of outdoors) if (z.id !== 'plaza') expect(routeDoor('plaza', z.id), z.id).not.toBeNull();
  });
  it('opens the waterfront for daytime walks while market services stay on their night schedule', () => {
    game.setFlag('unlock_beach');
    expect(routeDoor('plaza', 'market')).not.toBeNull();
    expect(routeDoor('plaza', 'harbor')).not.toBeNull();
    expect(game.has('market_open')).toBe(false);
    expect(routeDoor('plaza', 'station')).toBeNull();
  });
  it('connects all building thresholds and crossings by streets without lawn shortcuts', () => {
    openAll();
    for (const z of outdoors) {
      const b = buildZone(z.id), streets = b.grid.clone();
      for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (!'pcb'.includes(z.ground[y][x])) streets.setSolid(x, y, true);
      const doors = z.doors.filter(d => d.walk), start = doors[0];
      for (const d of doors) {
        expect(streets.isSolid(d.x, d.y), `${z.id}/${d.to} doorstep`).toBe(false);
        expect(streets.path(start.x, start.y, d.x, d.y, 20000), `${z.id}/${d.to} street`).not.toBeNull();
      }
    }
  });
  it('keeps main streets and bridge approaches open across their full width', () => {
    openAll();
    const lanes = [[44, 31, 2, 27], [66, 41, 2, 17], [72, 37, 7, 3], [79, 37, 41, 3], [84, 47, 36, 3], [99, 37, 2, 21], [21, 26, 2, 19], [18, 3, 2, 18]];
    const built = Object.fromEntries(outdoors.map(z => [z.id, buildZone(z.id)]));
    for (const [x, y, w, h] of lanes) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const z = outdoors.find(z => xx >= z.world!.x && xx < z.world!.x + z.w && yy >= z.world!.y && yy < z.world!.y + z.h)!;
      expect(built[z.id].grid.isSolid(xx - z.world!.x, yy - z.world!.y), `${z.id} public lane ${xx},${yy}`).toBe(false);
    }
  });
  it('migrates old positions once while preserving all progress and decoration', () => {
    const save = newSave(); delete save.flags.village_layout;
    Object.assign(save.player, { zone: 'garden', x: 35, y: 24 });
    save.coins = 721; save.inventory.wood = 9; save.quests.done = ['prologue']; save.flags.sign_restored = true;
    const before = JSON.stringify({ inventory: save.inventory, quests: save.quests, garden: save.garden, decor: save.decor });
    expect(migrateVillagePosition(save)).toBe(true);
    game.load(save); openAll(); const b = buildZone(save.player.zone);
    expect(b.grid.isSolid(save.player.x, save.player.y)).toBe(false);
    expect(JSON.stringify({ inventory: save.inventory, quests: save.quests, garden: save.garden, decor: save.decor })).toBe(before);
    expect(save.coins).toBe(721); expect(save.flags.sign_restored).toBe(true);
    save.player.x++; expect(migrateVillagePosition(save)).toBe(false); expect(save.player.x).toBe(22);
    b.grid.setSolid(save.player.x, save.player.y, true);
    const recovered = safeArrival(b, save.player.x, save.player.y);
    expect(b.grid.isSolid(recovered.x, recovered.y)).toBe(false);
  });
  for (const [name, level, phases] of [['initial', 1, 0], ['first renovations', 3, 1], ['second renovations', 7, 2], ['completed projects', 20, 4]] as const) {
    it(`${name}: every district stays reachable and paid scenery never overlaps or sits on water`, () => {
      openAll(); game.save.restaurant.level = level;
      for (const p of PROJECTS) for (let phase = 1; phase <= Math.min(phases, p.phases.length); phase++) game.setFlag(`proj_${p.id}_${phase}`);
      for (const z of outdoors) {
        const b = buildZone(z.id), occupied = new Map<string, string>();
        for (const p of b.props.filter(p => p.def.solid && p.def.kind !== 'boat')) for (let y = p.y; y < p.y + p.def.h; y++) for (let x = p.x; x < p.x + p.def.w; x++) {
          expect(occupied.get(`${x},${y}`), `${z.id} ${p.key}/${occupied.get(`${x},${y}`)}`).toBeUndefined();
          expect('wd'.includes(z.ground[y]?.[x] ?? 'w'), `${z.id} ${p.key} on water`).toBe(false);
          occupied.set(`${x},${y}`, p.key);
        }
        const start = z.doors.find(d => d.walk)!;
        for (const d of z.doors.filter(d => d.walk)) expect(b.grid.path(start.x, start.y, d.x, d.y, 20000), `${z.id}/${d.to}`).not.toBeNull();
        for (const i of [...z.interact.filter(i => !i.cond?.startsWith('!')), ...z.gather]) {
          const accessible = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !b.grid.isSolid(i.x + dx, i.y + dy) && b.grid.path(start.x, start.y, i.x + dx, i.y + dy, 20000));
          expect(accessible, `${z.id} activity ${i.x},${i.y}`).toBe(true);
        }
      }
    });
  }
});
