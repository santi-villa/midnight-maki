import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { ZONES } from '../data/zones';
import type { FurnPiece } from '../restaurant/floor';
import { pickupPlate, resetService, spawnGuest, stagePlate, stepService, takeOrderAt } from '../restaurant/service';
import {
  decorateBlockReason,
  isPlayerRoom,
  resolveContext,
  TILE,
  type ContextAction,
  type ContextOffer,
  type ContextSense,
  type SenseFurniture,
} from '../world/contextActions';

function at(tx: number, ty: number) {
  return { px: tx * TILE + TILE / 2, py: ty * TILE + TILE - 2 };
}

/** Pixel position the world reports for an NPC standing on a tile. */
function npcAt(id: string, name: string, tx: number, ty: number) {
  const p = at(tx, ty);
  return { id, name, x: p.px, y: p.py - 4 };
}

function sense(partial: Partial<ContextSense> & Pick<ContextSense, 'zoneId' | 'px' | 'py'>): ContextSense {
  return {
    dir: 'down',
    room: null,
    npcs: [],
    interacts: [],
    doors: [],
    gathers: [],
    bugs: [],
    furniture: [],
    ...partial,
  };
}

function all(o: ContextOffer): ContextAction[] {
  return [o.primary, o.chip, ...o.overflow].filter((a): a is ContextAction => !!a);
}

const playerRoom = ZONES.home.rooms.find((r) => r.id === 'room_player')!;
const pipRoom = ZONES.home.rooms.find((r) => r.id === 'room_pip')!;
const hall = ZONES.home.rooms.find((r) => r.id === 'hall')!;

function bed(room: string, x = 1, y = 2): SenseFurniture {
  return { uid: 1, id: 'bed_rose', kind: 'bed', name: 'Cama', room, x, y, w: 1, h: 2 };
}

beforeEach(() => {
  game.load(newSave('Tester'));
  resetService();
});

describe('player room', () => {
  it('offers decorate only inside the player room and shows its name', () => {
    const offer = resolveContext(sense({ zoneId: 'home', ...at(4, 4), room: playerRoom }));
    expect(offer.roomTag).toBe('Tu habitación');
    expect(offer.primary?.id).toBe('decorate');
    expect(offer.chip).toBeNull();
    expect(isPlayerRoom(playerRoom)).toBe(true);
    expect(decorateBlockReason(playerRoom)).toBeNull();
  });

  it('puts sleep first when standing by the bed, and decorate second', () => {
    const offer = resolveContext(sense({
      zoneId: 'home',
      ...at(2, 2),
      room: playerRoom,
      furniture: [bed('room_player')],
    }));
    expect(offer.primary?.label).toBe('Dormir');
    expect(offer.primary?.intent).toMatchObject({ type: 'target', target: { kind: 'interact', def: { action: 'bed' } } });
    expect(offer.chip?.id).toBe('decorate');
    expect(offer.overflow).toEqual([]);
  });

  it('refuses other characters rooms and rooms that are not yours', () => {
    expect(decorateBlockReason(pipRoom)).toMatch(/Cuarto de Pip/);
    expect(decorateBlockReason(hall)).toMatch(/tu habitación/i);
    expect(decorateBlockReason({ id: 'dining', name: 'Salón' })).toMatch(/tu habitación/i);
    expect(decorateBlockReason(undefined)).toMatch(/tu habitación/i);

    const nearPipBed = resolveContext(sense({
      zoneId: 'home',
      ...at(10, 2),
      room: pipRoom,
      furniture: [bed('room_pip', 9, 2)],
    }));
    expect(nearPipBed.roomTag).toBeNull();
    expect(all(nearPipBed).map((a) => a.id)).not.toContain('decorate');
    expect(all(nearPipBed).map((a) => a.label)).not.toContain('Dormir');
  });

  it('does not rewrite saved decoration', () => {
    const pip = [{ uid: 9, id: 'futon_rose', x: 9, y: 3, rot: 0 }];
    const dining = [{ uid: 4, id: 'table_dark', x: 8, y: 8, rot: 0 }];
    game.save.decor.room_pip = pip;
    game.save.decor.dining = dining;
    const snap = JSON.stringify(game.save.decor);
    resolveContext(sense({ zoneId: 'home', ...at(10, 4), room: pipRoom }));
    expect(JSON.stringify(game.save.decor)).toBe(snap);
    expect(game.save.decor.room_pip).toEqual(pip);
    expect(game.save.decor.dining).toEqual(dining);
  });
});

describe('nearby actions', () => {
  it('talks and gifts a character, and hides the gift after one today', () => {
    const npc = npcAt('pip', 'Pip', 4, 4);
    const open = resolveContext(sense({ zoneId: 'plaza', ...at(4, 4), npcs: [npc] }));
    expect(open.primary?.label).toBe('Hablar');
    expect(open.chip?.label).toBe('Regalar');
    expect(open.chip?.intent).toEqual({ type: 'gift', npcId: 'pip' });

    game.save.relationships.pip = { points: 0, lastTalkDay: 0, lastGiftDay: game.save.time.day };
    const done = resolveContext(sense({ zoneId: 'plaza', ...at(4, 4), npcs: [npc] }));
    expect(all(done).map((a) => a.id)).toEqual(['npc:pip']);
  });

  it('uses enter, exit, up and down, and collapses twin doors', () => {
    const enter = resolveContext(sense({
      zoneId: 'plaza',
      dir: 'up',
      ...at(5, 7),
      doors: ZONES.plaza.doors,
    }));
    expect(enter.primary?.label).toBe('Entrar');
    expect(enter.primary?.detail).toMatch(/Midnight Maki/);

    const exit = resolveContext(sense({
      zoneId: 'restaurant',
      ...at(8, 12),
      doors: ZONES.restaurant.doors,
    }));
    const doors = all(exit).filter((a) => a.id.startsWith('door:'));
    expect(doors).toHaveLength(1);
    expect(doors[0].label).toBe('Salir');

    const down = resolveContext(sense({
      zoneId: 'home',
      ...at(14, 9),
      room: hall,
      doors: ZONES.home.doors,
    }));
    expect(down.primary?.label).toBe('Bajar');
    expect(all(down).some((a) => a.id === 'decorate')).toBe(false);

    const up = resolveContext(sense({
      zoneId: 'restaurant',
      dir: 'up',
      ...at(16, 3),
      doors: ZONES.restaurant.doors,
    }));
    expect(all(up).find((a) => a.id === 'door:home')?.label).toBe('Subir');
  });

  it('keeps the object action and collapses duplicate tiles', () => {
    const offer = resolveContext(sense({
      zoneId: 'restaurant',
      dir: 'up',
      px: 128,
      py: 96,
      interacts: [
        { id: 'orders', x: 7, y: 5, label: 'Pedidos', action: 'orders' },
        { id: 'orders2', x: 8, y: 5, label: 'Pedidos', action: 'orders' },
      ],
    }));
    expect(all(offer).map((a) => a.id)).toEqual(['use:orders']);
    expect(offer.primary?.label).toBe('Pedidos');
  });

  it('folds a third action into the compact menu', () => {
    const offer = resolveContext(sense({
      zoneId: 'home',
      ...at(4, 4),
      room: playerRoom,
      npcs: [npcAt('pip', 'Pip', 4, 4)],
    }));
    expect(offer.primary?.id).toBe('npc:pip');
    expect(offer.chip?.id).toBe('gift:pip');
    expect(offer.overflow.map((a) => a.id)).toEqual(['decorate']);
  });
});

describe('restaurant tables', () => {
  const furniture: SenseFurniture[] = [
    { uid: 10, id: 'table_dark', kind: 'table', name: 'Mesa', room: 'dining', x: 8, y: 8, w: 2, h: 1 },
    { uid: 11, id: 'chair_dark', kind: 'chair', name: 'Silla', room: 'dining', x: 8, y: 9, w: 1, h: 1, sit: true },
    { uid: 12, id: 'table_dark', kind: 'table', name: 'Mesa', room: 'dining', x: 12, y: 7, w: 2, h: 1 },
    { uid: 13, id: 'chair_dark', kind: 'chair', name: 'Silla', room: 'dining', x: 12, y: 8, w: 1, h: 1, sit: true },
  ];
  const pieces: FurnPiece[] = furniture.map((f) => ({
    uid: f.uid, id: f.id, kind: f.kind, x: f.x, y: f.y, w: f.w, h: f.h, sit: f.sit, rot: f.sit ? 2 : 0,
  }));

  function seatTourist() {
    game.setFlag('intro_done');
    game.save.recipesKnown = ['kappa'];
    game.save.inventory = { rice: 4, nori: 4, cucumber: 3 };
    resetService({ timing: { approach: 1, walk: 1, settle: 1, eat: 1, pay: 1, leave: 1 }, rng: () => 0 });
    game.save.time.period = 1;
    game.save.time.minutes = 20;
    spawnGuest(pieces, 'c_tourist');
    stepService(1);
    stepService(1);
    stepService(1);
  }

  beforeEach(() => {
    seatTourist();
  });

  it('asks for the order at the table where the guest sat', () => {
    const actions = all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture })));
    expect(actions.map((a) => a.id)).toEqual(['take:10']);
    expect(actions[0].label).toBe('Tomar pedido');
    expect(actions[0].detail).toMatch(/Turista/);
    expect(actions[0].intent).toEqual({ type: 'takeOrder', tableId: '10' });
  });

  it('offers to cook, then to carry the plate', () => {
    expect(takeOrderAt('10')).toMatch(/Kappa/);
    const cook = all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture })))[0];
    expect(cook.id).toBe('cook:1');
    expect(cook.label).toMatch(/^Cocinar/);
    expect(cook.detail).toMatch(/Kappa maki/);
    expect(cook.detail).toMatch(/lista/);
    expect(cook.intent).toEqual({ type: 'cookOrder', uid: 1 });

    game.save.inventory = { rice: 0, nori: 0, cucumber: 0 };
    const missing = all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture })))[0];
    expect(missing.label).toMatch(/^Pedido/);
    expect(missing.detail).toMatch(/Faltan ingredientes/);
    expect(missing.intent).toEqual({ type: 'orders' });

    game.save.inventory = { rice: 4, nori: 4, cucumber: 3 };
    stagePlate(1, 2, 0);
    const tray = all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture })))[0];
    expect(tray.label).toBe('Recoger pedido');
    expect(tray.detail).toMatch(/bandeja/);
    expect(tray.intent).toEqual({ type: 'orders' });
    pickupPlate(1);
    const deliver = all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture })))[0];
    expect(deliver.label).toBe('Entregar');
    expect(deliver.intent).toEqual({ type: 'deliver', tableId: '10' });
  });

  it('hides empty tables, far tables, story orders and pre-intro service', () => {
    delete game.save.dining;
    resetService();
    expect(all(resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture }))).some((a) => a.id.startsWith('take:'))).toBe(false);

    seatTourist();
    const far = resolveContext(sense({ zoneId: 'restaurant', ...at(2, 3), furniture }));
    expect(all(far).some((a) => a.id.startsWith('take:'))).toBe(false);

    delete game.save.dining;
    resetService();
    game.save.orders = [{ uid: 7, recipe: 'kappa', customer: 'c_tourist', reward: 16, special: 'tutorial' }];
    const special = resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture }));
    expect(all(special).some((a) => a.icon === 'maki' && a.id !== 'use:orders')).toBe(false);

    game.setFlag('intro_done', false);
    seatTourist();
    game.setFlag('intro_done', false);
    const early = resolveContext(sense({ zoneId: 'restaurant', ...at(8, 9), furniture }));
    expect(all(early).some((a) => a.id.startsWith('take:'))).toBe(false);
  });

  it('takes the order from any open side, and from beside the seated guest', () => {
    const wide: SenseFurniture[] = [
      { uid: 10, id: 'table_family', kind: 'table', name: 'Mesa', room: 'dining', x: 8, y: 8, w: 2, h: 2 },
    ];
    const take = (px: number, py: number, extra: Partial<ContextSense> = {}) =>
      all(resolveContext(sense({ zoneId: 'restaurant', px, py, furniture: wide, ...extra }))).some((a) => a.id === 'take:10');
    expect(take(at(8, 7).px, at(8, 7).py)).toBe(true);
    expect(take(at(10, 9).px, at(10, 9).py)).toBe(true);
    expect(take(at(7, 8).px, at(7, 8).py)).toBe(true);
    expect(take(at(9, 10).px, at(9, 10).py)).toBe(true);
    const blocked = (x: number, y: number) => y >= 10 && x >= 0;
    expect(take(at(9, 10).px, at(9, 10).py, { blocked })).toBe(false);
    expect(take(at(8, 7).px, at(8, 7).py, { blocked })).toBe(true);
    const guest = { tableId: '10', x: at(9, 10).px, y: at(9, 10).py - 4 };
    expect(take(at(9, 11).px, at(9, 11).py, { blocked, guests: [guest] })).toBe(true);
    expect(take(at(2, 2).px, at(2, 2).py, { guests: [guest] })).toBe(false);
  });
});
