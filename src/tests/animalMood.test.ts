import { describe, expect, it } from 'vitest';
import { energy, presence, scaleCount, shelters, type DayFeel } from '../world/animalMood';

const day = (period: number, season = 0, rain = false): DayFeel => ({ period, season, rain });

describe('animal day', () => {
  it('hides day insects at night and in the rain, and brings fireflies out after dusk', () => {
    for (const kind of ['bee', 'dragonfly', 'butterfly'] as const) {
      expect(presence(kind, day(0, 0))).toBe(2);
      expect(presence(kind, day(3, 1))).toBe(0);
      expect(presence(kind, day(1, 0, true))).toBe(0);
      expect(presence(kind, day(1, 3))).toBe(0);
      expect(presence(kind, day(1, 2))).toBe(1);
    }
    expect(presence('firefly', day(0))).toBe(0);
    expect(presence('firefly', day(2, 1))).toBe(1);
    expect(presence('firefly', day(3, 1))).toBe(2);
    expect(presence('firefly', day(3, 1, true))).toBe(0);
    expect(presence('firefly', day(3, 3))).toBe(1);
  });

  it('keeps a few frogs in winter and lets ducks rest on the water at night', () => {
    expect(presence('frog', day(1, 3))).toBe(1);
    expect(presence('frog', day(0, 0))).toBe(2);
    expect(energy('frog', day(1, 1))).toBe(0);
    expect(energy('frog', day(3, 1))).toBe(2);
    expect(energy('frog', day(1, 0, true))).toBe(2);
    expect(presence('duck', day(3))).toBe(2);
    expect(energy('duck', day(3))).toBe(0);
    expect(shelters('duck', day(3))).toBe(true);
    expect(energy('duck', day(0))).toBe(2);
  });

  it('sends squirrels and small birds to shelter, and leaves a few gulls out at night', () => {
    expect(presence('squirrel', day(3))).toBe(0);
    expect(presence('squirrel', day(2))).toBe(1);
    expect(shelters('squirrel', day(0, 0, true))).toBe(true);
    expect(shelters('squirrel', day(0, 3))).toBe(false);
    expect(energy('squirrel', day(0, 2))).toBe(2);
    expect(presence('sparrow', day(3))).toBe(0);
    expect(presence('pigeon', day(1, 0, true))).toBe(0);
    expect(presence('gull', day(3))).toBe(1);
    expect(energy('gull', day(3))).toBe(0);
    expect(energy('sparrow', day(0))).toBe(2);
    expect(energy('sparrow', day(2))).toBe(0);
  });

  it('makes cats explore at dawn and dusk, rest in the afternoon, and both pets stay in when it rains', () => {
    expect(energy('cat', day(0))).toBe(2);
    expect(energy('cat', day(1))).toBe(0);
    expect(energy('cat', day(2))).toBe(2);
    expect(energy('cat', day(3))).toBe(1);
    expect(shelters('cat', day(1, 0, true))).toBe(true);
    expect(energy('dog', day(0))).toBe(2);
    expect(energy('dog', day(3))).toBe(0);
    expect(shelters('dog', day(0, 0, true))).toBe(true);
    expect(energy('crab', day(1))).toBe(0);
    expect(energy('crab', day(3, 0, true))).toBe(2);
  });

  it('halves a group without erasing a single animal', () => {
    expect(scaleCount(5, 2)).toBe(5);
    expect(scaleCount(5, 1)).toBe(3);
    expect(scaleCount(1, 1)).toBe(1);
    expect(scaleCount(4, 0)).toBe(0);
  });
});
