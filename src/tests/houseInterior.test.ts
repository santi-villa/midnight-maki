import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { HOUSES, houseDoorTile } from '../data/houses';
import { houseDoorPlan, housePieces, houseReserved } from '../data/houseInterior';
import { NEIGHBORS, NEIGHBOR_BY_ID } from '../data/neighbors';
import { ZONES } from '../data/zones';
import { processGift } from '../dialogue/talk';
import { validateSave } from '../persistence/validate';
import { decorateBlockReason } from '../world/contextActions';
import { findGiftSpot, furnitureWelcome, giftFurniture } from '../world/furnGift';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';

beforeEach(() => {
  game.load(newSave('Casas'));
  game.save.time.day = 1;
});

const near = (zone: string, x: number, y: number): [number, number][] => {
  const g = buildZone(zone).grid;
  return ([[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]] as const)
    .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .filter(([a, b]) => !g.isSolid(a, b));
};

describe('village house doors', () => {
  it('opens the interior on the same side as the porch and still steps outside to the south', () => {
    for (const h of HOUSES) {
      const plan = houseDoorPlan(h);
      const outdoor = ZONES[h.zone].doors.find((d) => d.to === h.id)!;
      expect(outdoor.tx, h.id).toBe(plan.spawnX);
      expect(outdoor.ty, h.id).toBe(plan.spawnY);
      expect(outdoor.dir, h.id).toBe(h.side === 'l' ? 'right' : 'left');
      const inside = ZONES[h.id].doors[0];
      const [dx, dy] = houseDoorTile(h);
      expect(inside, h.id).toMatchObject({ x: plan.x, y: plan.y, tx: dx, ty: dy + 1, dir: 'down' });
      expect(ZONES[h.id].ground[plan.y][plan.x], h.id).toBe('m');
      expect(ZONES[h.id].ground[7][5], h.id).toBe('#');
      expect(ZONES[h.id].rooms[0]?.owner, h.id).toBeUndefined();
      expect(decorateBlockReason(ZONES[h.id].rooms[0]), h.id).toMatch(/habitación/i);
    }
  });
});

describe('village house furniture', () => {
  it('gives every resident a different home, with a bed, a light and a clear path', () => {
    expect(NEIGHBORS.map((n) => n.home)).toEqual(HOUSES.slice(0, NEIGHBORS.length).map((h) => h.id));
    const signatures = HOUSES.map((h, i) => housePieces(h, i).map((p) => p.join(':')).join('|'));
    expect(new Set(signatures).size).toBe(HOUSES.length);
    for (let i = 0; i < HOUSES.length; i++) {
      const h = HOUSES[i];
      const pieces = housePieces(h, i);
      const seen = new Map<string, string>();
      let sleeps = false;
      let stores = false;
      let lights = false;
      for (const [id, x, y, rot] of pieces) {
        const def = FURN_BY_ID[id];
        expect(def, id).toBeTruthy();
        const size = furnSize(def, rot ?? 0);
        if (def.kind === 'bed' || def.kind === 'futon') {
          sleeps = true;
          expect(y, `${h.id} ${id}`).toBe(2);
        }
        if (def.kind === 'shelf' || def.kind === 'wardrobe' || def.kind === 'desk' || def.kind === 'chest') {
          stores = true;
          if (def.kind !== 'chest') expect(y, `${h.id} ${id}`).toBe(2);
        }
        if (def.light || def.kind === 'tablelamp' || def.kind === 'floorlamp' || def.kind === 'andon' || def.kind === 'paperlantern') lights = true;
        if (def.kind === 'chair') {
          const table = pieces.find((p) => {
            const k = FURN_BY_ID[p[0]]?.kind;
            if (k !== 'table' && k !== 'roundtable') return false;
            const s = furnSize(FURN_BY_ID[p[0]], p[3] ?? 0);
            const south = y === p[2] + s.h && x >= p[1] && x < p[1] + s.w;
            const north = (y + size.h) === p[2] && x >= p[1] && x < p[1] + s.w;
            const east = x === p[1] + s.w && y >= p[2] && y < p[2] + s.h;
            const west = (x + size.w) === p[1] && y >= p[2] && y < p[2] + s.h;
            if (south) expect(rot ?? 0, `${h.id} chair`).toBe(2);
            if (north) expect(rot ?? 0, `${h.id} chair`).toBe(0);
            if (east) expect(rot ?? 0, `${h.id} chair`).toBe(3);
            if (west) expect(rot ?? 0, `${h.id} chair`).toBe(1);
            return south || north || east || west;
          });
          expect(table, `${h.id} chair faces a table`).toBeTruthy();
        }
        for (let j = 0; j < size.h; j++) for (let i2 = 0; i2 < size.w; i2++) {
          const tx = x + i2;
          const ty = y + j;
          const stamp = `${tx},${ty}`;
          expect(seen.has(stamp), `${h.id} ${id} overlaps ${seen.get(stamp)} at ${stamp}`).toBe(false);
          seen.set(stamp, id);
          if (def.wall) {
            expect('WV'.includes(ZONES[h.id].ground[ty]?.[tx] ?? ''), `${h.id} ${id} wall`).toBe(true);
          } else {
            expect(ZONES[h.id].ground[ty]?.[tx], `${h.id} ${id}`).toBe('f');
            expect(houseReserved(h).some(([rx, ry]) => rx === tx && ry === ty), `${h.id} ${id} on ${stamp}`).toBe(false);
          }
        }
      }
      expect(sleeps, h.id).toBe(true);
      expect(stores, h.id).toBe(true);
      expect(lights, h.id).toBe(true);
    }
  });

  it('keeps the neighbour spot and the new door reachable after the furniture is placed', () => {
    ensureDefaultDecor();
    expect(game.room('room_player').map((f) => f.id)).toEqual(['bed_rose', 'lamp_table', 'rug_cream', 'wardrobe_wood']);
    expect(buildZone('restaurant').grid.isSolid(8, 12)).toBe(false);
    for (const h of HOUSES) {
      const plan = houseDoorPlan(h);
      const built = buildZone(h.id);
      expect(built.grid.isSolid(5, 5), h.id).toBe(false);
      expect(built.grid.isSolid(plan.spawnX, plan.spawnY), h.id).toBe(false);
      expect(built.grid.path(plan.spawnX, plan.spawnY, 5, 5, 4000), `${h.id} home`).not.toBeNull();
      expect(built.grid.path(5, 5, plan.x, plan.y, 4000), `${h.id} door`).not.toBeNull();
      for (const spot of built.def.interact) {
        const ok = near(h.id, spot.x, spot.y).some(([x, y]) => built.grid.path(plan.x, plan.y, x, y, 4000));
        expect(ok, `${h.id} ${spot.id}`).toBe(true);
      }
    }
    const before = game.room(HOUSES[0].id).length;
    ensureDefaultDecor();
    expect(game.room(HOUSES[0].id).length).toBe(before);
  });
});

describe('furniture gifts', () => {
  it('knows who likes a piece and refuses strangers, new acquaintances, dislikes and a second gift the same day', () => {
    expect(furnitureWelcome('haru', 'bookstack')).toBe('love');
    expect(furnitureWelcome('haru', 'aquarium')).toBe('dislike');
    expect(furnitureWelcome('mika', 'piano')).toBe('neutral');
    expect(furnitureWelcome('pip', 'plush_cat')).toBe('love');
    expect(furnitureWelcome('taro', 'stool')).toBeNull();

    game.save.relationships.ren = { points: 7, lastTalkDay: 0, lastGiftDay: 0 };
    game.save.furnitureOwned.stool = 1;
    expect(giftFurniture('ren', 'stool').reason).toBe('not_close');
    expect(game.save.furnitureOwned.stool).toBe(1);

    game.save.relationships.haru = { points: 20, lastTalkDay: 1, lastGiftDay: 0 };
    game.save.furnitureOwned.aquarium = 1;
    expect(giftFurniture('haru', 'aquarium').reason).toBe('dislike');
    expect(game.save.furnitureOwned.aquarium).toBe(1);
    expect(game.rel('haru').lastGiftDay).toBe(0);

    game.save.relationships.mika = { points: 8, lastTalkDay: 1, lastGiftDay: 0 };
    game.save.furnitureOwned.piano = 1;
    expect(giftFurniture('mika', 'piano').reason).toBe('style');
    expect(game.save.furnitureOwned.piano).toBe(1);

    game.save.relationships.mika.points = 40;
    const mild = giftFurniture('mika', 'piano');
    expect(mild.ok).toBe(true);
    expect(mild.points).toBe(0);
    expect(game.rel('mika').points).toBe(40);
    expect(game.save.furnitureOwned.piano).toBeUndefined();

    game.addItem('g_candy', 1);
    game.save.relationships.pip = { points: 8, lastTalkDay: 1, lastGiftDay: 0 };
    expect(processGift('pip', 'g_candy').success).toBe(true);
    game.save.furnitureOwned.plush_cat = 1;
    expect(giftFurniture('pip', 'plush_cat').reason).toBe('daily');
    expect(game.save.furnitureOwned.plush_cat).toBe(1);
  });

  it('places a liked piece, caps the friendship after two gifts, and stores a chair that has no table', () => {
    ensureDefaultDecor();
    game.save.relationships.haru = { points: 8, lastTalkDay: 1, lastGiftDay: 0 };
    game.save.furnitureOwned.bookstack = 3;
    expect(giftFurniture('haru', 'bookstack').points).toBe(6);
    game.save.time.day = 2;
    expect(giftFurniture('haru', 'bookstack').points).toBe(6);
    game.save.time.day = 3;
    const third = giftFurniture('haru', 'bookstack');
    expect(third.ok).toBe(true);
    expect(third.points).toBe(0);
    expect(game.rel('haru').points).toBe(20);
    expect(game.flag('furn_bond_haru')).toBe(2);
    expect(game.save.furnitureOwned.bookstack).toBeUndefined();

    const home = NEIGHBOR_BY_ID.haru.home;
    game.save.decor[home] = [];
    expect(findGiftSpot('haru', 'chair_wood')).toBeNull();
    game.save.decor[home] = [{ uid: 1, id: 'table_round', x: 4, y: 4, rot: 0 }];
    expect(findGiftSpot('haru', 'chair_wood')).toEqual({ x: 4, y: 5, rot: 2 });
    game.save.decor[NEIGHBOR_BY_ID.ren.home] = [];
    expect(findGiftSpot('ren', 'bed_sage')).toEqual({ x: 8, y: 2, rot: 0 });
  });

  it('stores a gift that does not fit and places it once a tile is free', () => {
    ensureDefaultDecor();
    const h = HOUSES[0];
    const reserved = new Set(houseReserved(h).map(([x, y]) => `${x},${y}`));
    const path = new Set(['3,4', '3,5', '3,6', '4,6', '5,6']);
    const floor = [];
    let uid = 50;
    for (let y = 2; y <= 6; y++) for (let x = 1; x <= 8; x++) {
      if (reserved.has(`${x},${y}`) || path.has(`${x},${y}`)) continue;
      floor.push({ uid: uid++, id: 'chest_wood', x, y, rot: 0 });
    }
    game.save.decor[h.id] = floor;
    game.save.relationships.ren = { points: 40, lastTalkDay: 1, lastGiftDay: 0 };
    game.save.furnitureOwned.plant_fern = 1;
    const blocked = giftFurniture('ren', 'plant_fern');
    expect(blocked.reason).toBe('stored');
    expect(blocked.line).toMatch(/guardo/);
    expect(game.save.furnitureOwned.plant_fern).toBeUndefined();
    expect(game.save.storedGifts.ren).toEqual(['plant_fern']);

    game.save.decor[h.id] = floor.filter((f) => !(f.x === 8 && f.y === 6));
    ensureDefaultDecor();
    expect(game.save.storedGifts.ren).toBeUndefined();
    expect(game.save.decor[h.id].some((f) => f.id === 'plant_fern')).toBe(true);
    const built = buildZone(h.id);
    expect(built.grid.path(1, 4, 5, 5, 4000)).not.toBeNull();
  });

  it('does not block a raccoon doorway and survives a save round-trip', () => {
    ensureDefaultDecor();
    game.save.relationships.pip = { points: 8, lastTalkDay: 1, lastGiftDay: 0 };
    game.save.furnitureOwned.plush_bear = 1;
    expect(giftFurniture('pip', 'plush_bear').reason).toBe('placed');
    const home = buildZone('home').grid;
    expect(home.isSolid(11, 7)).toBe(false);
    expect(home.path(11, 8, 11, 7, 4000)).not.toBeNull();

    game.save.storedGifts = { ren: ['plant_fern', 'no-such-piece'] };
    const raw = JSON.parse(JSON.stringify(game.save));
    raw.storedGifts.mika = 'no';
    const out = validateSave(raw);
    expect(out.storedGifts.ren).toEqual(['plant_fern']);
    expect(out.storedGifts.mika).toBeUndefined();
    expect(out.decor[NEIGHBOR_BY_ID.ren.home].length).toBeGreaterThan(0);
    const stripped = JSON.parse(JSON.stringify(newSave('Vieja')));
    delete stripped.storedGifts;
    expect(validateSave(stripped).storedGifts).toEqual({});
  });
});
