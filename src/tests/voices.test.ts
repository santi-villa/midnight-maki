import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../data/characters';
import { NEIGHBORS } from '../data/neighbors';
import { hasVoice, voiceNote, voicePhraseCount, voiceWhen, type VoiceNote } from '../audio/voices';

const LEADS = ['pip', 'spicy', 'rigg', 'ume', 'kiki', 'akio'];

function note(id: string, step = 0): VoiceNote {
  const n = voiceNote(id, step);
  if (!n) throw new Error(`missing voice ${id}`);
  return n;
}

describe('character voices', () => {
  it('gives a voice to every character, neighbour, the player and any guest; the narrator stays silent', () => {
    for (const id of LEADS) expect(hasVoice(id)).toBe(true);
    for (const c of CHARACTERS) expect(hasVoice(c.id), c.id).toBe(true);
    for (const n of NEIGHBORS) expect(hasVoice(n.id), n.id).toBe(true);
    for (const id of ['player', 'guest:Cliente', 'guest:???']) expect(hasVoice(id), id).toBe(true);
    for (const id of ['narr', '', 'nobody']) expect(hasVoice(id), id).toBe(false);
    expect(voiceNote('narr', 0)).toBeNull();
    expect(voicePhraseCount('')).toBe(0);
    expect(voicePhraseCount('taro')).toBeGreaterThan(0);
  });

  it('keeps everyone in a speakable range and gives each of them a sound within a short line', () => {
    const ids = [...CHARACTERS.map((c) => c.id), ...NEIGHBORS.map((n) => n.id), 'player', 'guest:Turista'];
    for (const id of ids) {
      let sounded = 0;
      for (let step = 0; step < 40; step++) {
        const n = note(id, step);
        expect(n.freq, id).toBeGreaterThan(80);
        expect(n.freq * (n.chirp > 1 ? n.chirp : 1), id).toBeLessThanOrEqual(900);
        expect(n.dur, id).toBeGreaterThan(n.attack);
        expect(n.gap, id).toBeGreaterThan(0);
        if (n.sound && step % n.every === 0) sounded++;
      }
      expect(sounded, id).toBeGreaterThanOrEqual(3);
      expect(voiceWhen(id, 0), id).toBe(0);
    }
  });

  it('follows the personalities: big and warm is low and slow, bright and adventurous is high and quick, shy is soft', () => {
    expect(note('bento').freq).toBeLessThan(note('taro').freq);
    expect(note('nami').freq).toBeGreaterThan(note('taro').freq);
    expect(note('nami').gap).toBeLessThan(note('bento').gap);
    expect(note('momo').vol).toBeLessThan(note('taro').vol);
    expect(note('kumo').freq).toBeLessThan(note('yuki').freq);
    // neighbours: a shy night owl speaks softer and slower than a sporty cat
    expect(note('oto').vol).toBeLessThan(note('rin').vol);
    expect(note('oto').gap).toBeGreaterThan(note('rin').gap);
    // distinct people do not share a voice
    const sig = (id: string) => [0, 4, 8, 12].map((s) => Math.round(note(id, s).freq)).join();
    expect(new Set(NEIGHBORS.map((n) => sig(n.id))).size).toBe(NEIGHBORS.length);
  });

  it('keeps pitch, pace and texture in the order the personalities ask for', () => {
    expect(note('akio').freq).toBeLessThan(note('pip').freq);
    expect(note('pip').freq).toBeLessThan(note('ume').freq);
    expect(note('ume').freq).toBeLessThan(note('rigg').freq);
    expect(note('rigg').freq).toBeLessThan(note('kiki').freq);
    expect(note('kiki').freq).toBeLessThan(note('spicy').freq);

    expect(note('spicy').gap).toBeLessThan(note('pip').gap);
    expect(note('rigg').gap).toBeGreaterThan(note('ume').gap);
    expect(note('rigg').vol).toBeLessThan(note('pip').vol);
    expect(note('akio').noise).toBeGreaterThan(0);
    expect(note('pip').noise).toBe(0);
    expect(note('ume').noise).toBe(0);
    expect(note('rigg').noise).toBe(0);

    const kikiGaps = [0, 1, 2, 3, 4].map((step) => note('kiki', step).gap);
    expect(new Set(kikiGaps).size).toBeGreaterThan(1);
    const spicyFreqs = [0, 1, 2, 3, 4].map((step) => note('spicy', step).freq);
    expect(new Set(spicyFreqs).size).toBeGreaterThan(2);

    expect(voicePhraseCount('rigg')).toBeLessThan(voicePhraseCount('spicy'));
    expect(voicePhraseCount('rigg')).toBe(2);
  });

  it('stays in a speakable range and lets Kiki skip, then bounce', () => {
    for (const id of LEADS) {
      for (let step = 0; step < 24; step++) {
        const n = note(id, step);
        expect(n.freq).toBeGreaterThan(80);
        expect(n.freq).toBeLessThan(700);
        const top = n.freq * (n.chirp > 1 ? n.chirp : 1);
        expect(top).toBeLessThanOrEqual(900);
        expect(n.dur).toBeGreaterThan(n.attack);
        expect(n.slide).toBeGreaterThan(0);
        expect(n.gap).toBeGreaterThan(0);
      }
    }
    const sounded = [...Array(19).keys()].filter((step) => note('kiki', step).sound);
    expect(sounded).toEqual([0, 1, 9, 10, 18]);
    const jumps = sounded.map((step) => note('kiki', step).freq);
    expect(new Set(jumps).size).toBeGreaterThan(3);

    const phrase = [0, 1, 9, 10].map((step) => voiceWhen('kiki', step));
    expect(phrase[0]).toBe(0);
    expect(phrase[1]!).toBeGreaterThan(0);
    expect(phrase[1]!).toBeLessThan(0.05);
    expect(phrase[2]! - phrase[1]!).toBeGreaterThan(0.15);
    expect(voiceWhen('kiki', 4)).toBeNull();
    expect(voiceWhen('pip', 0)).toBe(0);
    expect(voiceWhen('pip', 8)!).toBeGreaterThan(voiceWhen('spicy', 4)!);
  });
});
