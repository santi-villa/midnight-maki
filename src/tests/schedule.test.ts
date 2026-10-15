import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { plazaActivity, shopGate, stopFor, whereIs } from '../systems/npcs';
import { buildZone } from '../world/zoneRuntime';
import { benchSpots } from '../systems/neighborSpots';
import { phaseOf, shopSignText, shopButtonLabel, shopInteractionText, signSpots } from '../systems/schedule';

function at(period: number, minutes: number, day = 4) {
  game.save.time.period = period;
  game.save.time.minutes = minutes;
  game.save.time.day = day;
  game.save.quests.done = ['prologue'];
}

beforeEach(() => {
  game.load(newSave('Tester'));
  at(0, 20);
});

describe('daily rhythm', () => {
  it('uses real bench stops and gives plaza residents visible activities in every beat', () => {
    const seats = benchSpots('plaza');
    for (const minutes of [5, 20, 40, 60, 75, 85]) {
      at(2, minutes);
      for (const id of ['taro', 'yuki', 'ume']) {
        const stop = plazaActivity(id, { zone: 'plaza', x: 16, y: 15 }, minutes);
        expect(stop.act).not.toBe('look'); expect(stop.act).toBeDefined();
        if (minutes < 82 && seats.length) {
          expect(stop.seatLift).toBe(12); expect(stop.wander).toBe(0);
          expect(seats.some((s) => s.x === stop.x && s.y === stop.y)).toBe(true);
          expect(buildZone('plaza', false).grid.isSolid(stop.x, stop.y)).toBe(false);
          expect(plazaActivity(id, { zone: 'plaza', x: 16, y: 15, act: 'eat' }, minutes).act).toBe('sit');
        }
      }
    }
  });
  it('splits a period into settle, work, meal, stroll, talk and leaving', () => {
    expect(phaseOf(0)).toBe('settle');
    expect(phaseOf(20)).toBe('main');
    expect(phaseOf(40)).toBe('meal');
    expect(phaseOf(60)).toBe('stroll');
    expect(phaseOf(75)).toBe('social');
    expect(phaseOf(85)).toBe('depart');
  });

  it('keeps a shopkeeper in the shop for the whole morning and afternoon shift', () => {
    at(0, 30);
    expect(whereIs('taro')).toBe('shop_taro');
    expect(stopFor('yuki', 0)?.zone).toBe('shop_yuki');
    at(1, 40);
    expect(whereIs('taro')).toBe('shop_taro');
    expect(whereIs('bento')).toBe('shop_bento');
  });

  it('gives the morning a cleaning start, a meal, and a walk to the door before a zone change', () => {
    at(0, 5);
    expect(stopFor('taro', 0)?.act).toBe('clean');
    at(0, 40);
    expect(stopFor('taro', 0)?.act).toBe('work');
    expect(stopFor('taro', 0)?.zone).toBe('shop_taro');
    at(1, 85);
    const leaving = stopFor('taro', 1);
    const door = { x: 5, y: 3 }; // the counter stays staffed until 23:00
    expect(leaving?.zone).toBe('shop_taro');
    expect(leaving?.x).toBe(door.x);
    expect(leaving?.y).toBe(door.y);
    expect(leaving?.act).toBe('work');
  });

  it('sends a strolling neighbor toward a walkable place in the same zone', () => {
    at(0, 60);
    const pip = stopFor('pip', 0);
    expect(pip?.zone).toBe('plaza');
    expect(buildZone('plaza', false).grid.isSolid(pip!.x, pip!.y)).toBe(false);
    expect(`${pip?.x},${pip?.y}`).not.toBe('7,9');
  });

  it('keeps the raccoons working in the restaurant while the night door is still open', () => {
    game.setFlag('intro_done');
    at(3, 30);
    expect(stopFor('yuki', 3)?.zone).toBe('shop_yuki');
    expect(whereIs('kumo')).toBe('library');
    expect(whereIs('pip')).toBe('restaurant');
    expect(stopFor('spicy', 3)).toMatchObject({ zone: 'restaurant', act: 'cook' });
    expect(stopFor('rigg', 3)).toMatchObject({ zone: 'restaurant', x: 10, y: 4, act: 'read' });
  });
  it('hides sleeping staff and sends Pip home after closing', () => {
    at(3, 70);
    expect(stopFor('yuki', 3)).toBeNull(); expect(whereIs('kumo')).toBeNull();
    expect(stopFor('pip', 3)).toMatchObject({ zone: 'home', act: 'sleep' });
  });

  it('does not walk a sleeper out of bed at the end of the night', () => {
    at(3, 88);
    const pip = stopFor('pip', 3);
    expect(pip?.zone).toBe('home');
    expect(pip?.act).toBe('sleep');
    expect(pip?.x).toBe(10);
  });
});

describe('weather, festivals and story', () => {
  it('keeps indoor shifts during rain and shelters outdoor neighbors', () => {
    game.setFlag('weather', 'rain');
    at(0, 30);
    expect(whereIs('taro')).toBe('shop_taro');
    expect(shopGate('taro').open).toBe(true);
    expect(whereIs('momo')).toBe('restaurant');
    expect(stopFor('momo', 0)?.act).toBe('sit');
    expect(whereIs('kiki')).toBe('plaza');
    expect(whereIs('pip')).toBe('restaurant');
  });

  it('holds the prologue raccoons in the restaurant', () => {
    at(0, 50, 1);
    game.save.quests.done = [];
    expect(whereIs('pip')).toBe('restaurant');
    expect(stopFor('spicy', 0)?.act).toBe('cook');
  });

  it('obeys a story placement and does not rewrite it', () => {
    at(3, 85);
    game.setFlag('at_taro', 'shop_taro,5,3,work');
    const taro = stopFor('taro', 3);
    expect(taro).toMatchObject({ zone: 'shop_taro', x: 5, y: 3, act: 'work' });
    expect(shopGate('taro').open).toBe(true);
  });

  it('brings festival neighbors to the plaza without pulling shopkeepers off the counter', () => {
    game.setFlag('festival_today', 'flowers');
    at(1, 30);
    expect(whereIs('sumi')).toBe('plaza');
    expect(whereIs('momo')).toBe('plaza');
    expect(whereIs('taro')).toBe('shop_taro');
    expect(shopGate('sumi').open).toBe(true);
    expect(shopGate('taro').open).toBe(true);
  });

  it('does not touch saved decoration', () => {
    game.save.decor.room_player = [{ uid: 1, id: 'bed_rose', x: 2, y: 2, rot: 0 }];
    const snap = JSON.stringify(game.save.decor);
    at(0, 60);
    stopFor('pip', 0);
    shopGate('yuki');
    expect(JSON.stringify(game.save.decor)).toBe(snap);
  });
});

describe('shop hours', () => {
  it('opens after setup, stays open across a two-period shift, and closes at the end', () => {
    at(0, 29.75);
    expect(shopGate('taro').phase).toBe('setup');
    expect(shopGate('taro').open).toBe(false);
    at(0, 85);
    expect(shopGate('taro').open).toBe(true);
    at(1, 5);
    expect(shopGate('yuki').open).toBe(true);
    at(3, 60);
    expect(shopGate('bento').phase).toBe('closing');
    expect(shopGate('bento').open).toBe(false);
  });

  it('follows each stall and refuses a normal purchase when the keeper is gone', () => {
    at(0, 30);
    expect(shopGate('sumi').open).toBe(true);
    expect(shopGate('nami').open).toBe(false);
    at(1, 30);
    expect(shopGate('sumi').open).toBe(true);
    expect(shopGate('nami').open).toBe(false);
    game.setFlag('unlock_beach');
    expect(shopGate('nami').open).toBe(true);
    expect(shopGate('shells').open).toBe(true);
    at(3, 70);
    expect(shopGate('taro').open).toBe(false);
    expect(shopGate('taro').detail).toMatch(/Horario/);
    expect(shopGate('market_food').tracked).toBe(true);
  });

  it('lets a flag force a shop open or shut', () => {
    at(3, 40);
    game.setFlag('shop_force_taro');
    expect(shopGate('taro').open).toBe(true);
    game.setFlag('shop_force_taro', false);
    game.setFlag('shop_shut_taro');
    at(0, 30);
    expect(shopGate('taro').open).toBe(false);
    expect(shopGate('taro').detail).toMatch(/hoy no abre/i);
  });
});

describe('consistent storefront indicators', () => {
  it.each(['taro', 'bento', 'yuki'])('%s follows setup, morning, afternoon, closing, dusk and night', (id) => {
    const cases: [number, number, string][] = [[0, 0, 'closed'], [0, 29.75, 'setup'], [0, 30, 'open'], [0, 89, 'open'], [1, 0, 'open'], [1, 89, 'open'], [2, 20, 'open'], [3, 59.5, 'open'], [3, 60, 'closing'], [3, 70, 'closed']];
    for (const [period, minutes, phase] of cases) {
      at(period, minutes);
      const status = shopGate(id);
      expect(status.phase).toBe(phase);
      expect(shopSignText(status)).toBe(phase === 'open' ? '' : phase === 'setup' ? 'PRONTO' : phase === 'closing' ? 'CIERRA' : 'CERRADO');
      expect(shopButtonLabel(status, 'Tienda')).not.toContain(status.hours);
      expect(shopInteractionText(status)).toContain(status.hours);
    }
  });

  it('uses the same service rules for the legacy Sumi alias', () => {
    at(3, 70);
    expect(shopGate('mika')).toEqual(shopGate('sumi'));
    expect(shopGate('mika').open).toBe(false);
  });

  it('keeps a shut counter behind a closed door and respects story exceptions', () => {
    at(3, 70);
    expect(shopInteractionText(shopGate('taro'), true)).toContain('La puerta está cerrada.');
    expect(shopInteractionText(shopGate('taro'), true)).not.toContain('Podés entrar');
    game.setFlag('at_taro', 'shop_taro,5,3,work');
    expect(shopSignText(shopGate('taro'))).toBe('');
    game.setFlag('shop_shut_taro');
    expect(shopSignText(shopGate('taro'))).toBe('CERRADO');
    expect(shopInteractionText(shopGate('taro'))).toContain('08:00–23:00');
  });

  it('places shop plaques against walls away from the walk-through door tiles', () => {
    for (const zoneId of ['plaza', 'shop_taro', 'shop_yuki', 'shop_bento']) {
      const zone = buildZone(zoneId, false);
      for (const spot of signSpots(zoneId).filter((s) => ['taro', 'bento', 'yuki'].includes(s.shopId))) {
        expect(zone.grid.isSolid(spot.x, spot.y)).toBe(true);
        const cx = spot.x * 16;
        const bottom = spot.y * 16 + 14;
        for (const prop of zone.props.filter((p) => p.def.kind !== 'building' && p.def.kind !== 'townhouse')) {
          const px = prop.x * 16 + prop.def.w * 8;
          const py = (prop.y + prop.def.h) * 16;
          const overlaps = cx + 14.5 > px - prop.def.sw / 2 && cx - 14.5 < px + prop.def.sw / 2 && bottom > py - prop.def.sh && bottom - 11 < py;
          expect(overlaps, `${zoneId}: plaque should not cover ${prop.key}`).toBe(false);
        }
        for (const door of zone.def.doors) {
          const overlaps = cx + 14.5 > door.x * 16 && cx - 14.5 < (door.x + 1) * 16 && bottom > door.y * 16 && bottom - 11 < (door.y + 1) * 16;
          expect(overlaps).toBe(false);
        }
      }
    }
  });
});
