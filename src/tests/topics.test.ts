import { beforeEach, describe, expect, it } from 'vitest';
import { resetTopicMemory, topicLine, type TalkCtx } from '../dialogue/topics';

const ctx = (o: Partial<TalkCtx> = {}): TalkCtx => ({ id: 'nami', zone: 'plaza', period: 1, rain: false, festival: false, open: true, guests: 0, level: 1, reputation: 0, friend: 0, day: 3, ...o });
beforeEach(() => resetTopicMemory());

describe('conversation topics', () => {
  it('walk through different lines when asked again', () => {
    const lines = new Set([1, 2, 3, 4].map(() => topicLine('how', ctx()).t));
    expect(lines.size).toBeGreaterThanOrEqual(3);
  });

  it('follow what is going on: weather, what they do and see, the restaurant, the neighbours', () => {
    expect(topicLine('how', ctx({ rain: true })).t).toMatch(/lluvia|llueve|mojado/i);
    resetTopicMemory();
    const doing = topicLine('doing', ctx({ act: 'fish', place: 'sea' })).t;
    expect(doing).toMatch(/pesca|pique/i);
    expect(doing).toMatch(/mar|barquitos/i);
    resetTopicMemory();
    expect(topicLine('doing', ctx({ id: 'taro', act: 'work' })).t).toMatch(/almacén|precios/i);
    expect(topicLine('restaurant', ctx({ open: false })).t).toMatch(/cerró/);
    resetTopicMemory();
    expect(topicLine('news', ctx({ others: [{ name: 'Mika', what: 'en bicicleta' }] })).t).toContain('Mika en bicicleta');
  });

  it('a joke comes with its reaction', () => {
    const l = topicLine('joke', ctx());
    expect(l.joke).toBeTruthy();
    expect(l.t.length).toBeGreaterThan(3);
  });
});

import { microFor } from '../systems/npcMicro';
describe('small gestures of villagers', () => {
  it('never wake the sleeping, follow the weather and their own trade', () => {
    expect(microFor('pip', { act: 'sleep', period: 1, rain: false, outdoor: true }, 0, 0)).toBeNull();
    expect(microFor('pip', { act: 'look', period: 1, rain: false, outdoor: true }, 0.9, 0)).toBeNull();
    const seen = new Set([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((r) => microFor('sumi', { act: 'paint', period: 1, rain: false, outdoor: true }, 0, r)!.act));
    expect(seen.has('paint')).toBe(true);
    const rain = [0, 0.1, 0.2, 0.3].map((r) => microFor('taro', { act: 'work', period: 1, rain: true, outdoor: true }, 0, r)!);
    expect(rain.some((m) => /llu/i.test(m.say ?? ''))).toBe(true);
    // indoors the rain does not matter
    expect([0, 0.1, 0.2].every((r) => !/llu/i.test(microFor('taro', { act: 'work', period: 1, rain: true, outdoor: false }, 0, r)!.say ?? ''))).toBe(true);
  });
});
