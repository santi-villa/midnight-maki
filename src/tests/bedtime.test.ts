import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import type { QuestTarget } from '../quests/quests';
import { bedtimeReason, exhaustionFine, EXHAUSTED_PERIOD_MINUTES, questKeepsRestaurant } from '../systems/bedtime';
import { closedLocalNotice, shopGate } from '../systems/npcs';
import { restaurantPhase } from '../systems/schedule';
import { formatHudTime, hudTime } from '../ui/hudClock';

const home: QuestTarget = { kind: 'interior', fromZone: 'restaurant', door: { x: 16, y: 2 }, targetZone: 'home' };
const counter: QuestTarget = { kind: 'object', zone: 'restaurant', x: 7, y: 5 };
const salon: QuestTarget = { kind: 'interior', fromZone: 'plaza', door: { x: 5, y: 6 }, targetZone: 'restaurant' };

beforeEach(() => {
  game.load(newSave('Noche'));
  game.setFlag('intro_done');
});

describe('restaurant missions at closing', () => {
  it('sends a restaurant objective to bed only while the door is closing', () => {
    expect(bedtimeReason(3, 62, counter, () => null)).toBe('closing');
    expect(bedtimeReason(3, 62, salon, () => 'plaza')).toBe('closing');
    expect(bedtimeReason(3, 62, { kind: 'npc', npc: 'spicy' }, () => 'restaurant')).toBe('closing');
    expect(bedtimeReason(3, 62, home, () => null)).toBeNull();
    expect(bedtimeReason(3, 62, { kind: 'npc', npc: 'pip' }, () => 'home')).toBeNull();
    expect(bedtimeReason(3, 62, { kind: 'location', zone: 'plaza' }, () => null)).toBeNull();
    expect(bedtimeReason(3, 70, counter, () => null)).toBeNull();
    expect(bedtimeReason(2, 62, counter, () => null)).toBeNull();
  });
});

describe('staying awake', () => {
  it('leaves midnight and the small hours free, then marks dawn as too long', () => {
    expect(EXHAUSTED_PERIOD_MINUTES).toBe(240);
    expect(formatHudTime(hudTime(3, 90))).toBe('00:00');
    expect(formatHudTime(hudTime(3, 180))).toBe('03:00');
    expect(formatHudTime(hudTime(3, 240))).toBe('05:00');
    expect(bedtimeReason(3, 90, null, () => null)).toBeNull();
    expect(bedtimeReason(3, 180, null, () => null)).toBeNull();
    expect(bedtimeReason(3, 239, counter, () => null)).toBeNull();
    expect(bedtimeReason(3, 240, null, () => null)).toBe('exhausted');
    expect(bedtimeReason(3, 269, counter, () => null)).toBe('exhausted');
    expect(bedtimeReason(1, 240, null, () => null)).toBeNull();
  });

  it('drops a small share of coins, and nothing when the pocket is empty', () => {
    expect(exhaustionFine(0)).toBe(0);
    expect(exhaustionFine(10)).toBe(1);
    expect(exhaustionFine(100)).toBe(15);
    expect(exhaustionFine(1000)).toBe(40);
    expect(questKeepsRestaurant(null, () => 'restaurant')).toBe(false);
  });
});

describe('closed locals', () => {
  it('blocks shops and the library when the counter is shut, and never the restaurant', () => {
    const zones = ['shop_taro', 'shop_yuki', 'shop_bento', 'library'];
    for (const [period, minutes] of [[0, 0], [0, 29.75], [0, 40], [3, 60], [3, 80]] as const) {
      game.save.time.period = period;
      game.save.time.minutes = minutes;
      for (const zone of zones) {
        const id = zone === 'library' ? zone : zone.slice(5);
        const blocked = closedLocalNotice(zone);
        expect(blocked === null).toBe(shopGate(id).open);
        if (blocked) expect(blocked).toContain('La puerta está cerrada.');
      }
    }
    game.save.time.period = 3;
    game.save.time.minutes = 80;
    expect(restaurantPhase(3, 80)).toBe('closed');
    expect(closedLocalNotice('restaurant')).toBeNull();
    expect(closedLocalNotice('plaza')).toBeNull();
    expect(closedLocalNotice('home')).toBeNull();
    expect(closedLocalNotice('market')).toBeNull();
    expect(closedLocalNotice('beach')).toBeNull();
  });
});
