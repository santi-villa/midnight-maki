import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { ambientExchange } from '../dialogue/ambient';
import { Journey, routeDoor } from '../systems/journeys';
import { TownLife } from '../systems/townLife';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';
import { Grid } from '../world/grid';

beforeEach(() => {
  game.load(newSave('Pueblo'));
  game.save.time.day = 4;
  game.save.time.minutes = 20;
  game.save.quests.done = ['prologue'];
  for (const flag of ['intro_done', 'unlock_beach', 'unlock_station', 'unlock_garden', 'unlock_forest', 'met_hoshi', 'akio_visit']) game.setFlag(flag);
});

describe('continuous town journeys', () => {
  it('routes through the plaza between two interiors', () => {
    expect(routeDoor('shop_bento', 'restaurant')?.to).toBe('plaza');
    expect(routeDoor('plaza', 'restaurant')?.to).toBe('restaurant');
    expect(routeDoor('home', 'station')?.to).toBe('restaurant');
    expect(routeDoor('unknown', 'restaurant')).toBeNull();
  });

  it('Bento keeps the bakery at dusk and leaves through the door at 20:00', () => {
    game.save.time.period = 2;
    game.save.time.minutes = 20;
    const town = new TownLife(); town.sync();
    const bento = town.residents.get('bento')!;
    expect(bento.stop.zone).toBe('shop_bento');
    expect(bento.trip.settled).toBe(true);
    game.save.time.minutes = 60; town.sync();
    expect(bento.trip.position.zone).toBe('shop_bento');
    expect(bento.trip.settled).toBe(false);
    expect(bento.visible).toBe(true);
    for (let i = 0; i < 400 && bento.trip.position.zone !== 'plaza'; i++) town.tick(0.05);
    const door = ZONES.shop_bento.doors[0];
    expect(bento.trip.position).toEqual({ zone: 'plaza', x: door.tx, y: door.ty });
    expect(town.inZone('plaza').some((r) => r.id === 'bento')).toBe(true);
  });

  it('Yuki walks to her house at night and stays visible there', () => {
    game.save.time.period = 2;
    game.save.time.minutes = 20;
    const town = new TownLife(); town.sync();
    const yuki = town.residents.get('yuki')!;
    expect(yuki.stop.zone).toBe('shop_yuki');
    game.save.time.period = 3; game.save.time.minutes = 40; town.sync();
    expect(yuki.stop.zone).toBe('house_beach_33_9');
    expect(yuki.visible).toBe(true);
    expect(town.inZone('shop_yuki').some((r) => r.id === 'yuki')).toBe(true);
    for (let i = 0; i < 2500 && !yuki.trip.settled; i++) town.tick(0.05);
    expect(yuki.trip.settled).toBe(true);
    expect(yuki.trip.position.zone).toBe('house_beach_33_9');
    expect(town.inZone('house_beach_33_9').some((r) => r.id === 'yuki')).toBe(true);
  });

  it('sends early sleepers home, keeps night owls out and preserves the special market shift', () => {
    game.save.time.period = 3;
    game.save.time.minutes = 40;
    const town = new TownLife(); town.sync();
    for (const id of ['ume', 'nami', 'momo', 'bento', 'sora']) {
      const r = town.residents.get(id)!;
      expect(r.stop.zone.startsWith('house_'), id).toBe(true);
      expect(r.visible, id).toBe(true);
      expect(r.stop.act, id).toBe('sleep');
    }
    for (const id of ['kumo', 'sumi', 'kiki', 'akio']) {
      const r = town.residents.get(id)!;
      expect(['plaza', 'beach', 'garden', 'forest'], id).toContain(r.stop.zone);
      expect(r.visible, id).toBe(true);
      expect(r.stop.act === 'sit' || r.stop.act === 'talk', id).toBe(true);
    }
    const hoshi = CHARACTERS.find((c) => c.id === 'hoshi')!;
    expect(hoshi.routine[3].act).toBe('stars');
    expect(town.residents.get('hoshi')!.stop.zone).toBe('plaza');
    expect(town.residents.get('taro')!.stop.zone.startsWith('house_')).toBe(true);
    game.setFlag('market_open'); town.sync();
    expect(town.residents.get('taro')!.stop.zone).toBe('market');
  });

  it('keeps a remembered position across repeated map queries and routine synchronization', () => {
    const town = new TownLife(); town.sync();
    const taro = town.residents.get('taro')!;
    taro.trip.remember(5, 4.25);
    town.inZone('plaza'); town.inZone('shop_taro'); town.sync();
    expect(taro.trip.position).toEqual({ zone: 'shop_taro', x: 5, y: 4.25 });
    expect(taro.trip.settled).toBe(true);
  });

  it('never teleports when a path is obstructed', () => {
    const grid = new Grid(10, 10);
    for (let y = 0; y < 10; y++) grid.setSolid(4, y, true);
    const trip = new Journey({ zone: 'plaza', x: 2, y: 2 }, () => grid);
    trip.go({ zone: 'plaza', x: 6, y: 2 }); trip.tick(100);
    expect(trip.position).toEqual({ zone: 'plaza', x: 2, y: 2 });
    expect(trip.settled).toBe(false);
    grid.setSolid(4, 2, false); trip.tick(100);
    expect(trip.position.x).toBe(6);
    expect(trip.settled).toBe(true);
  });

  it('takes the actual station, plaza and restaurant doors in both directions', () => {
    const town = new TownLife();
    const trip = new Journey({ zone: 'station', x: 18, y: 14 }, town.grid);
    trip.go({ zone: 'restaurant', x: 8, y: 10 });
    const seen = new Set([trip.position.zone]);
    for (let i = 0; i < 1200 && !trip.settled; i++) { trip.tick(0.05); seen.add(trip.position.zone); }
    expect([...seen]).toEqual(['station', 'residential', 'plaza', 'restaurant']);
    expect(trip.settled).toBe(true);
    trip.go({ zone: 'station', x: 18, y: 14 });
    for (let i = 0; i < 1200 && !trip.settled; i++) trip.tick(0.05);
    expect(trip.position).toEqual({ zone: 'station', x: 18, y: 14 });
  });

  it('respects story placements and resets positions when loading a different save', () => {
    const town = new TownLife(); town.sync();
    game.setFlag('at_taro', 'restaurant,7,10,talk'); town.sync();
    expect(town.residents.get('taro')?.trip.position).toEqual({ zone: 'restaurant', x: 7, y: 10 });
    game.load(newSave('Otra')); town.sync();
    expect(town.residents.get('taro')?.trip.position.zone).toBe('house_plaza_1_27'); // new saves start at 06:00, before he wakes
  });

  it('can finish every neighbor journey between successive periods on the real maps', () => {
    ensureDefaultDecor();
    for (let period = 0; period < 3; period++) {
      game.save.time.period = period;
      const town = new TownLife(); town.sync();
      game.save.time.period = period + 1; town.sync();
      for (let i = 0; i < 1600; i++) town.tick(0.05);
      for (const r of town.residents.values()) expect(r.trip.settled, `${period}: ${r.id} in ${r.trip.position.zone}`).toBe(true);
    }
  });

  it('does not mutate decoration while simulating off screen', () => {
    buildZone('restaurant');
    const before = JSON.stringify(game.save.decor);
    const town = new TownLife(); town.sync(); game.save.time.period = 1; town.sync(); town.tick(1);
    expect(JSON.stringify(game.save.decor)).toBe(before);
  });
});

describe('neighbor conversations', () => {
  it('gives each pair alternating speakers and complete responses, including unusual pairs', () => {
    for (const a of CHARACTERS) for (const b of CHARACTERS) {
      if (a.id === b.id) continue;
      const lines = ambientExchange(a.id, b.id, { zone: 'plaza', period: 1, rain: false, festival: false }, 0);
      expect(lines).toHaveLength(3);
      expect(lines[0].speaker).toBe(lines[2].speaker);
      expect(lines[1].speaker).not.toBe(lines[0].speaker);
      for (const line of lines) { expect([a.id, b.id]).toContain(line.speaker); expect(line.text.length).toBeGreaterThan(4); }
    }
  });

  it('varies friends exchanges and acknowledges rain and festivals', () => {
    const ctx = { zone: 'restaurant', period: 1, rain: false, festival: false };
    expect(ambientExchange('pip', 'spicy', ctx, 0)).not.toEqual(ambientExchange('pip', 'spicy', ctx, 1));
    expect(ambientExchange('pip', 'spicy', { ...ctx, rain: true }, 0)[0].text).toContain('seco');
    expect(ambientExchange('momo', 'sumi', { ...ctx, zone: 'plaza', festival: true }, 0)[0].text).toContain('fiesta');
  });
});
