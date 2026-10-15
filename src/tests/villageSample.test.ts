import { describe, expect, it } from 'vitest';
import { ZONES } from '../data/zones';
import { PROPS } from '../data/props';
import { buildingLayout } from '../art/nature';
import { villageShopLayout } from '../art/village';
import { game, newSave } from '../core/state';
import { buildZone } from '../world/zoneRuntime';

describe('village sample keeps the saved village playable', () => {
  it('aligns every new visible doorway with its existing street entrance and interior exit', () => {
    for (const [id, prop, x, y] of [
      ['restaurant', 'bld_restaurant_s0', 5, 6],
      ['shop_bento', 'bld_bakery', 5, 18],
      ['shop_taro', 'bld_store', 27, 18],
    ] as const) {
      const door = ZONES.plaza.doors.find(d => d.to === id)!;
      const placed = ZONES.plaza.props.find(p => p.id === prop)!;
      const def = PROPS[prop];
      const layout = id === 'restaurant' ? buildingLayout(def.sw, def.sh) : villageShopLayout(def.sw, def.sh, def.variant!);
      expect([door.x, door.y]).toEqual([x, y]);
      expect(placed.x * 16 + layout.dx + layout.doorW / 2).toBe(x * 16 + 8);
      const threshold = (placed.y + def.h) * 16 - def.sh + layout.doorY + layout.doorH;
      expect(Math.abs(threshold - (y * 16 + 14))).toBeLessThanOrEqual(6);
      expect(ZONES[id].doors.find(d => d.to === 'plaza')).toMatchObject({ tx: x, ty: y + 1 });
    }
  });
  it('lays decks only on existing bridge tiles and keeps every deck tile reachable from the village', () => {
    game.load(newSave()); const b = buildZone('plaza');
    const decks = b.props.filter(p => p.def.kind === 'village_deck');
    expect(decks.length).toBeGreaterThan(0);
    for (const p of decks) for (let y = p.y; y < p.y + p.def.h; y++) for (let x = p.x; x < p.x + p.def.w; x++) {
      expect(b.def.ground[y][x]).toBe('b');
      expect(b.grid.path(5, 7, x, y, 20000)).not.toBeNull();
    }
  });
  it('keeps river banks on land and free of collisions, without opening story exits', () => {
    game.load(newSave()); const b = buildZone('plaza');
    for (const p of b.props.filter(p => p.def.kind === 'village_bank')) {
      expect(['g', 'G', 'p', 'c']).toContain(b.def.ground[p.y][p.x]);
      expect(p.def.solid).toBe(false);
    }
    for (const door of b.def.doors.filter(d => d.lock)) expect(b.grid.path(5, 7, door.x, door.y, 20000)).toBeNull();
  });
});
