import { describe, expect, it } from 'vitest';
import { INTRO_MUSIC, INTRO_SCENES, LETTER_LINES, LETTER_SIGN, takeCues, type IntroCue, type IntroScene } from '../story/introScript';
import { INTRO_SOUNDS, type IntroSoundId } from '../story/introSounds';

function scene(id: string): IntroScene {
  const found = INTRO_SCENES.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
}

function lineIndex(id: string, part: string): number {
  const i = scene(id).lines.findIndex((line) => line.text.includes(part));
  if (i < 0) throw new Error(`${id} missing ${part}`);
  return i;
}

function soundsOf(cues: IntroCue[] | undefined): IntroSoundId[] {
  return (cues ?? []).map((cue) => cue.sound);
}

describe('intro script', () => {
  it('shows the seven pictures in order', () => {
    expect(INTRO_SCENES.map((s) => s.image)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(INTRO_SCENES.map((s) => s.id)).size).toBe(7);
  });

  it('uses only registered sounds and keeps each cue kind honest', () => {
    const used = new Set<IntroSoundId>();
    for (const s of INTRO_SCENES) {
      for (const cue of [...(s.enter ?? []), ...s.lines.flatMap((line) => line.cues ?? [])]) {
        used.add(cue.sound);
        expect(INTRO_SOUNDS[cue.sound].kind).toBe(cue.kind);
        expect(INTRO_MUSIC).toContain(s.music);
      }
    }
    expect(used.has('metal_jar')).toBe(false);
    expect(used.has('wooden_door')).toBe(false);
    expect(INTRO_SOUNDS.metal_jar.kind).toBe('shot');
    expect(INTRO_SOUNDS.wooden_door.kind).toBe('shot');
  });

  it('keeps rain and the city under the first picture, then lets the city go', () => {
    const fired = new Set<string>();
    const room = takeCues(scene('room'), 'enter', fired);
    expect(soundsOf(room)).toEqual(['rain_window', 'city_night']);
    expect(room.every((cue) => cue.kind === 'bed' && cue.volume > 0)).toBe(true);
    const city = takeCues(scene('reading'), 'enter', fired).find((cue) => cue.sound === 'city_night');
    expect(city?.volume).toBe(0);
    const rain = takeCues(scene('train'), 'enter', fired).find((cue) => cue.sound === 'rain_window');
    expect(rain?.volume).toBe(0);
  });

  it('plays the paper once, then the envelope on the line about the letter', () => {
    const fired = new Set<string>();
    const door = scene('under_door');
    expect(soundsOf(takeCues(door, 'enter', fired))).toContain('paper_slide_on_wood');
    const line = lineIndex('under_door', 'Un sobre había aparecido');
    const cues = takeCues(door, line, fired);
    expect(soundsOf(cues)).toEqual(['envelope_sliding']);
    expect(takeCues(door, line, fired)).toEqual([]);
  });

  it('rustles the paper when the envelope opens and drops the key when it is mentioned', () => {
    const fired = new Set<string>();
    const reading = scene('reading');
    expect(soundsOf(takeCues(reading, lineIndex('reading', 'abrió el sobre'), fired))).toEqual(['paper_rustle']);
    expect(soundsOf(takeCues(reading, lineIndex('reading', 'pequeña llave'), fired))).toEqual(['small_key_drop']);
    expect(reading.letterAfter).toBe(lineIndex('reading', 'Villa Nori'));
  });

  it('offers the restaurant in the letter and does not say it is already hers', () => {
    const text = LETTER_LINES.join(' ');
    expect(text).toContain('ofrecerte la posibilidad de hacerte cargo');
    expect(text).toContain('tres pequeños habitantes');
    expect(text).not.toContain('ahora es tuyo');
    expect(LETTER_SIGN).toBe('A.');
  });

  it('zips the suitcase once and does not replay the train on later lines', () => {
    const fired = new Set<string>();
    const packing = scene('packing');
    expect(soundsOf(takeCues(packing, lineIndex('packing', 'pequeña valija'), fired))).toEqual(['suitcase_zipper']);
    expect(soundsOf(takeCues(packing, lineIndex('packing', 'voy a averiguarlo'), fired))).toEqual(['wooden_footsteps']);
    const train = scene('train');
    expect(soundsOf(takeCues(train, 'enter', fired))).toContain('steam_train');
    for (let i = 0; i < train.lines.length; i++) expect(takeCues(train, i, fired)).toEqual([]);
    const leave = takeCues(scene('village'), 'enter', fired).find((cue) => cue.sound === 'steam_train');
    expect(leave?.stop).toBe(true);
  });

  it('brings in the town and the fountain, then walks to the door without the jar', () => {
    const fired = new Set<string>();
    const arrive = takeCues(scene('village'), 'enter', fired);
    expect(soundsOf(arrive)).toContain('small_town');
    expect(arrive.find((cue) => cue.sound === 'water_fountain')?.volume).toBeGreaterThan(0.1);
    const nearer = takeCues(scene('midnight'), 'enter', fired).find((cue) => cue.sound === 'water_fountain');
    expect(nearer?.volume).toBeLessThan(0.1);
    const step = lineIndex('midnight', 'se acercó a la puerta');
    expect(soundsOf(takeCues(scene('midnight'), step, fired))).toEqual(['wooden_footsteps']);
    const again = new Set(fired);
    expect(takeCues(scene('midnight'), step, again)).toEqual([]);
  });
});
