import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { VILLAGE_BOUNDS } from '../data/villageGeography';
import { ZONES } from '../data/zones';
import { buildZone } from '../world/zoneRuntime';
import { buildVillage, districtAt, DISTRICTS, isDistrict, liveZoneOf, toLive, villageDef, VILLAGE, VILLAGE_H, VILLAGE_W } from '../world/village';

beforeEach(() => { game.load(newSave('Tester')); });

const open = (...flags: string[]) => { for (const f of flags) game.setFlag(f); };

describe('the village as one map', () => {
  it('converts district tiles to village tiles and back', () => {
    const at = toLive('beach', 10, 5);
    expect(at).toEqual({ zone: VILLAGE, x: VILLAGE_BOUNDS.beach.x + 10, y: VILLAGE_BOUNDS.beach.y + 5 });
    expect(districtAt(at.x, at.y)).toEqual({ zone: 'beach', x: 10, y: 5 });
    expect(toLive('shop_bento', 3, 4)).toEqual({ zone: 'shop_bento', x: 3, y: 4 });
    expect(liveZoneOf('plaza')).toBe(VILLAGE);
    expect(liveZoneOf('restaurant')).toBe('restaurant');
    expect(isDistrict('market')).toBe(true);
    expect(isDistrict('deepforest')).toBe(false);
  });

  it('covers every tile with exactly the tiles each district has on its own', () => {
    const v = buildVillage();
    expect(v.def.w).toBe(VILLAGE_W); expect(v.def.h).toBe(VILLAGE_H);
    for (const id of DISTRICTS) {
      const d = buildZone(id), o = VILLAGE_BOUNDS[id];
      for (let y = 0; y < d.def.h; y += 3) for (let x = 0; x < d.def.w; x += 3) expect(v.tiles[y + o.y][x + o.x]).toBe(d.tiles[y][x]);
    }
    expect(v.tiles.every((row) => row.every((t) => t >= 0))).toBe(true);
    expect(v.props.length).toBe(DISTRICTS.reduce((n, id) => n + buildZone(id).props.length, 0));
  });

  it('keeps the doors to interiors and drops the doors between districts', () => {
    const def = villageDef();
    expect(def.doors.some((d) => d.to === 'restaurant')).toBe(true);
    expect(def.doors.some((d) => isDistrict(d.to))).toBe(false);
    const inside = ZONES.plaza.interact.length + ZONES.beach.interact.length;
    expect(def.interact.length).toBeGreaterThanOrEqual(inside);
  });

  it('walks from the plaza to the beach once the beach is open, and not before', () => {
    const from = toLive('plaza', ZONES.plaza.doors.find((d) => d.to === 'restaurant')!.x, ZONES.plaza.doors.find((d) => d.to === 'restaurant')!.y + 1);
    const beach = buildZone('beach');
    const spot = beach.grid.nearestWalkable(15, 10)!;
    const to = toLive('beach', spot[0], spot[1]);
    expect(buildVillage().grid.path(from.x, from.y, to.x, to.y, 20000)).toBeNull();
    open('unlock_beach', 'unlock_forest', 'unlock_garden', 'unlock_station');
    expect(buildVillage().grid.path(from.x, from.y, to.x, to.y, 20000)).not.toBeNull();
  });
});
