import { describe, expect, it } from 'vitest';
import { compositionOf } from '../audio/audio';

const PLACES = ['town', 'restaurant', 'kitchen', 'forest', 'garden', 'beach', 'harbor', 'market', 'shrine', 'station', 'stars', 'home'] as const;

describe('composed themes', () => {
  it('gives each place a full phrase and an answer', () => {
    for (const id of PLACES) {
      const score = compositionOf(id);
      expect(score.phrase, id).toBe(32);
      expect(score.answer, id).toBe(32);
      expect(score.melody, id).not.toBe(score.answerLine);
    }
  });

  it('keeps the harbor, the shrine and the station from borrowing another tune', () => {
    const beach = compositionOf('beach');
    const harbor = compositionOf('harbor');
    const garden = compositionOf('garden');
    const shrine = compositionOf('shrine');
    const station = compositionOf('station');
    const mystery = compositionOf('mystery');
    expect(harbor.root).not.toBe(beach.root);
    expect(harbor.melody).not.toBe(beach.melody);
    expect(harbor.lead).toBe('flute');
    expect(harbor.quiet).toBe(true);
    expect(harbor.beat).toBe(false);
    expect(beach.beat).toBe(true);
    expect(shrine.melody).not.toBe(garden.melody);
    expect(shrine.lead).toBe('flute');
    expect(shrine.bpm).toBeLessThan(garden.bpm);
    expect(station.melody).not.toBe(mystery.melody);
    expect(station.root).not.toBe(mystery.root);
    expect(compositionOf('restaurant').lead).toBe('koto');
    expect(compositionOf('forest').quiet).toBe(true);
  });
});
