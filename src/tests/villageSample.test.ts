import { describe, expect, it } from 'vitest';
import { ZONES } from '../data/zones';
import { PROPS } from '../data/props';
import { buildingLayout } from '../art/nature';
import { villageShopLayout } from '../art/village';
import { game, newSave } from '../core/state';
import { buildZone } from '../world/zoneRuntime';
import { HOUSES, houseDoorTile, housePropId } from '../data/houses';
import { homeLayout } from '../art/homes';
import { bridgeRails } from '../world/bridge';
import { restaurantFacadeLayout } from '../art/restaurantFacade';

describe('village sample keeps the saved village playable', () => {
  it('uses the three selected facades in order and retains the third for the final stage', () => {
    expect([0, 1, 2, 3].map(stage => restaurantFacadeLayout(112, 112, stage).frame))
      .toEqual(['restaurant_1', 'restaurant_2', 'restaurant_3', 'restaurant_3']);
  });
  it('keeps the selected facade doors on the saved threshold and every light within its sprite', () => {
    const placed = ZONES.plaza.props.find(p => p.id === 'bld_restaurant_s0')!;
    const door = ZONES.plaza.doors.find(d => d.to === 'restaurant')!;
    for (const stage of [0, 1, 2, 3]) {
      const L = restaurantFacadeLayout(112, 112, stage);
      expect(Math.abs(placed.x * 16 + L.door.x + L.door.w / 2 - (door.x * 16 + 8))).toBeLessThanOrEqual(0.5);
      expect((placed.y + 3) * 16 - 112 + L.door.y + L.door.h).toBe(door.y * 16 + 14);
      expect(L.x).toBeGreaterThanOrEqual(0); expect(L.y).toBeGreaterThanOrEqual(0);
      expect(L.x + L.w).toBeLessThanOrEqual(112); expect(L.y + L.h).toBeLessThanOrEqual(112);
      for (const w of L.windows) {
        expect(w.x).toBeGreaterThanOrEqual(L.x); expect(w.y).toBeGreaterThanOrEqual(L.y);
        expect(w.x + w.w).toBeLessThanOrEqual(L.x + L.w); expect(w.y + w.h).toBeLessThanOrEqual(L.y + L.h);
        expect(w.x + w.w <= L.door.x || w.x >= L.door.x + L.door.w || w.y + w.h <= L.door.y).toBe(true);
      }
    }
  });
  it('aligns every imported genkan with the saved house entrance and keeps window light off the timber door', () => {
    for (const house of HOUSES) {
      const prop = PROPS[housePropId(house)];
      const L = homeLayout(prop.sw, prop.sh, prop.variant!, house.view === 'side');
      const [x, y] = houseDoorTile(house);
      expect(house.x * 16 + L.door.x + L.door.w / 2, house.id).toBe(x * 16 + 8);
      const threshold = (house.y + prop.h) * 16 - prop.sh + L.door.y + L.door.h;
      expect(threshold, house.id).toBe(y * 16 + 12);
      for (const win of L.windows) {
        expect(win.x >= 0 && win.x + win.w <= prop.sw, house.id).toBe(true);
        expect(win.x + win.w <= L.door.x || win.x >= L.door.x + L.door.w, house.id).toBe(true);
      }
    }
  });
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
  it('keeps every connected bridge tile reachable without straight overlays crossing the pier bend', () => {
    game.load(newSave()); const b = buildZone('plaza');
    expect(b.props.some(p => p.def.kind === 'village_deck')).toBe(false);
    let count = 0;
    for (let y = 0; y < b.def.h; y++) for (let x = 0; x < b.def.w; x++) if (b.def.ground[y][x] === 'b') {
      count++;
      expect(b.grid.path(5, 7, x, y, 20000)).not.toBeNull();
    }
    expect(count).toBeGreaterThan(0);
  });
  it('joins railings at both pier bends while leaving its landings and interior passage open', () => {
    const ground = ZONES.plaza.ground, edges = new Set<string>();
    for (const rail of bridgeRails(ground)) for (let i = 0; i < rail.length; i++) {
      const x = rail.x + (rail.axis === 'h' ? i : 0), y = rail.y + (rail.axis === 'v' ? i : 0);
      edges.add(`${rail.axis}:${x},${y}`);
      const sides = rail.axis === 'h' ? [ground[y - 1]?.[x], ground[y]?.[x]] : [ground[y]?.[x - 1], ground[y]?.[x]];
      expect(sides).toContain('b');
      expect(sides.some(tile => tile === 'w' || tile === 'd')).toBe(true);
    }
    // The actual L has a convex turn at 36,39 and a concave turn at 37,40.
    expect(edges.has('h:35,39') && edges.has('v:36,38')).toBe(true);
    expect(edges.has('h:37,40') && edges.has('v:37,40')).toBe(true);
    expect(edges.has('h:36,39') || edges.has('v:36,39')).toBe(false);
    expect(edges.has('v:30,39') || edges.has('v:30,40')).toBe(false);
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
