/**
 * Dialogue voices for the six leads. Other speakers keep the generic blip in AudioEngine.voice.
 * Numbers are chosen so pitch, pace and texture stay apart: low and slow versus high and fast.
 */

export type VoiceWave = 'sine' | 'triangle';

export interface VoiceNote {
  /** Fundamental in Hz. */
  freq: number;
  type: VoiceWave;
  /** Peak gain on the sfx bus. */
  vol: number;
  /** Note length in seconds. Must stay above `attack`. */
  dur: number;
  attack: number;
  /** Frequency multiplier at the end of the note. 1 keeps the pitch still. */
  slide: number;
  /** Extra tone at `freq * harm`. 0 skips it. */
  harm: number;
  /** Harmonic loudness as a fraction of `vol`. */
  harmMix: number;
  /** Upward chirp multiplier. 0 or 1 keeps the pitch still. */
  chirp: number;
  /** Quiet bandpass noise at the fundamental. 0 is a clean tone. */
  noise: number;
  /** Minimum seconds before this speaker can blip again. */
  gap: number;
  /** Sound only when `step % every === 0`. */
  every: number;
  /** False holds a rest inside an irregular rhythm. */
  sound: boolean;
}

const KIKI_JUMPS = [1, 1.25, 0.82, 1.5, 1.05, 0.7, 1.35];
const SPICY_LEAPS = [1, 1.18, 1.4, 0.9, 1.26];

function tone(partial: VoiceNote): VoiceNote {
  return partial;
}

/** Pip — low, soft, unhurried. */
function pip(step: number): VoiceNote {
  return tone({
    freq: 148, type: 'sine', vol: 0.04, dur: 0.12, attack: 0.03, slide: 0.94,
    harm: 0.5, harmMix: 0.35, chirp: 0, noise: 0, gap: 0.3, every: 8, sound: step % 8 === 0,
  });
}

/** Abuela Ume — medium-low, slow, warm. */
function ume(step: number): VoiceNote {
  return tone({
    freq: 196, type: 'sine', vol: 0.048, dur: 0.13, attack: 0.035, slide: 0.97,
    harm: 1.5, harmMix: 0.32, chirp: 0, noise: 0, gap: 0.22, every: 6, sound: step % 6 === 0,
  });
}

/** Rigg — medium-high, delicate, with space between notes. */
function rigg(step: number): VoiceNote {
  return tone({
    freq: 330, type: 'sine', vol: 0.024, dur: 0.05, attack: 0.008, slide: 1,
    harm: 2, harmMix: 0.12, chirp: 0, noise: 0, gap: 0.42, every: 8, sound: step % 8 === 0,
  });
}

/** Akio — lower than Pip, a little rough. */
function akio(step: number): VoiceNote {
  return tone({
    freq: 123, type: 'triangle', vol: 0.05, dur: 0.08, attack: 0.008, slide: 0.8,
    harm: 0, harmMix: 0, chirp: 0, noise: 0.06, gap: 0.11, every: 3, sound: step % 3 === 0,
  });
}

/** Kiki — high, bouncy, irregular. Pairs of notes, then a rest. */
function kiki(step: number): VoiceNote {
  const hop = step % 9 < 2;
  const freq = 392 * KIKI_JUMPS[step % KIKI_JUMPS.length];
  return tone({
    freq, type: 'triangle', vol: 0.042, dur: 0.038, attack: 0.003, slide: 1,
    harm: 0, harmMix: 0, chirp: hop && step % 9 === 1 ? 1.16 : 0, noise: 0,
    gap: hop ? 0.008 : 0.34, every: 1, sound: hop,
  });
}

/** Spicy Beacon — very high, fast, with leaps. */
function spicy(step: number): VoiceNote {
  const freq = 494 * SPICY_LEAPS[step % SPICY_LEAPS.length];
  return tone({
    freq, type: 'triangle', vol: 0.05, dur: 0.04, attack: 0.003, slide: 1,
    harm: 0, harmMix: 0, chirp: step % 3 === 2 ? 1.22 : 0, noise: 0,
    gap: 0.04, every: 1, sound: true,
  });
}

const VOICES: Record<string, (step: number) => VoiceNote> = { pip, spicy, rigg, ume, kiki, akio };

/** How many notes a fully revealed line still plays, so instant text keeps the personality. */
const PHRASE: Record<string, number> = { pip: 3, ume: 3, rigg: 2, akio: 3, kiki: 4, spicy: 5 };

export function hasVoice(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(VOICES, id);
}

export function voiceNote(id: string, step: number): VoiceNote | null {
  const make = VOICES[id];
  if (!make) return null;
  return make(step);
}

export function voicePhraseCount(id: string): number {
  return PHRASE[id] ?? 0;
}

/** Seconds from the start of a short phrase until this sounded step. Null when the step is silent. */
export function voiceWhen(id: string, step: number): number | null {
  const note = voiceNote(id, step);
  if (!note || !note.sound || step % note.every !== 0) return null;
  let when = 0;
  let prev = -1;
  for (let i = 0; i <= step; i++) {
    const n = voiceNote(id, i);
    if (!n || !n.sound || i % n.every !== 0) continue;
    if (prev >= 0) {
      const hole = i - prev;
      when += hole > 2 ? Math.max(n.gap, hole * 0.028) : n.gap;
    }
    if (i === step) return when;
    prev = i;
  }
  return null;
}
