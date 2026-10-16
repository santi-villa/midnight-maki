/**
 * Dialogue voices. The six leads (Pip, Spicy, Rigg, Ume, Kiki, Akio) are shaped by hand below. Everyone else gets a voice
 * made from a small profile, so pitch, pace and texture follow their personality: the rest of the village cast by hand
 * (Taro, Yuki, Bento, Sumi, Momo, Nami, Kumo, Hoshi, Sora), the neighbours from their species and traits, the player,
 * and any visitor or customer from a seed of their name. The narrator and letters stay silent.
 * Numbers are chosen so pitch, pace and texture stay apart: low and slow versus high and fast.
 */
import { NEIGHBOR_BY_ID } from '../data/neighbors';

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

/** A compact way to describe a voice: only what differs from a plain, even blip. */
interface Profile {
  freq: number;
  type?: VoiceWave;
  vol?: number;
  dur?: number;
  /** a sound every N letters: low is quick speech, high is slow and spaced */
  every?: number;
  gap?: number;
  slide?: number;
  harm?: number;
  mix?: number;
  noise?: number;
  /** pitch steps, one per syllable */
  hop?: number[];
  chirp?: number;
  /** notes played when the whole line appears at once */
  phrase?: number;
}

function fromProfile(p: Profile): (step: number) => VoiceNote {
  const every = p.every ?? 4;
  return (step) => {
    const syl = Math.floor(step / every);
    return tone({
      freq: p.freq * (p.hop ? p.hop[syl % p.hop.length] : 1), type: p.type ?? 'sine', vol: p.vol ?? 0.04, dur: p.dur ?? 0.07, attack: 0.008,
      slide: p.slide ?? 1, harm: p.harm ?? 0, harmMix: p.mix ?? 0, chirp: p.chirp && syl % 3 === 2 ? p.chirp : 0, noise: p.noise ?? 0,
      gap: p.gap ?? 0.15, every, sound: step % every === 0,
    });
  };
}

/** The rest of the village cast, by hand, after their bios. */
const CAST: Record<string, Profile> = {
  taro: { freq: 233, every: 4, gap: 0.14, hop: [1, 1.12, 0.94], phrase: 4 },                                  // negociante: chatty, even
  yuki: { freq: 392, type: 'triangle', every: 3, gap: 0.1, hop: [1, 1.06], dur: 0.045, phrase: 4 },           // perfeccionista: neat and bright
  bento: { freq: 130, dur: 0.12, every: 6, gap: 0.26, slide: 0.96, harm: 1.5, mix: 0.3, vol: 0.05, phrase: 3 }, // enorme y amable: low, slow, warm
  sumi: { freq: 294, dur: 0.09, every: 5, gap: 0.2, hop: [1, 1.19, 1.33, 1.12], phrase: 4 },                  // artista: melodic
  momo: { freq: 349, vol: 0.026, dur: 0.06, every: 7, gap: 0.36, slide: 1.03, phrase: 2 },                    // tímida: soft, spaced
  nami: { freq: 440, type: 'triangle', vol: 0.042, dur: 0.045, every: 2, gap: 0.07, hop: [1, 1.25, 1.12, 1.5], chirp: 1.12, phrase: 5 }, // aventurera: bright, quick
  kumo: { freq: 175, type: 'triangle', vol: 0.032, dur: 0.07, every: 5, gap: 0.24, slide: 0.9, noise: 0.02, phrase: 2 }, // erudito reservado: low, dry
  hoshi: { freq: 262, vol: 0.03, dur: 0.12, every: 6, gap: 0.3, slide: 1.08, harm: 2, mix: 0.2, phrase: 3 },  // soñadora: airy, rising
  sora: { freq: 370, type: 'triangle', dur: 0.035, every: 3, gap: 0.09, phrase: 4 },                            // cartera puntual: crisp, even
  player: { freq: 300, type: 'triangle', vol: 0.036, dur: 0.06, every: 4, gap: 0.12, hop: [1, 1.1, 0.96], phrase: 3 },
};

const SPECIES_PITCH: Record<string, number> = { bear: 150, dog: 175, otter: 210, owl: 230, fox: 260, cat: 300, bunny: 330, squirrel: 345, raccoon: 190 };
const strHash = (text: string): number => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** A neighbour's voice follows their animal and their traits. */
function neighborProfile(id: string): Profile | null {
  const n = NEIGHBOR_BY_ID[id];
  if (!n) return null;
  const h = strHash(id);
  const p: Profile = { freq: (SPECIES_PITCH[n.look.species] ?? 240) * (0.94 + (h % 13) / 100), type: h % 3 === 0 ? 'triangle' : 'sine', every: 4, gap: 0.15, hop: [1, 1.08 + (h % 7) / 100, 0.95], phrase: 3 };
  const has = (t: string) => (n.traits as string[]).includes(t);
  if (has('shy')) { p.vol = 0.028; p.every = 7; p.gap = 0.34; p.phrase = 2; }
  if (has('sociable')) { p.every = 3; p.gap = 0.1; p.phrase = 4; }
  if (has('sporty')) { p.every = 2; p.gap = 0.08; p.dur = 0.045; p.type = 'triangle'; }
  if (has('hardworking')) { p.every = 4; p.hop = [1, 1.04]; }
  if (has('adventurous')) { p.chirp = 1.14; p.hop = [1, 1.25, 1.1, 1.4]; }
  if (has('nocturnal')) { p.freq *= 0.88; p.slide = 0.95; p.gap = (p.gap ?? 0.15) * 1.4; p.harm = 2; p.mix = 0.15; }
  return p;
}

/** Visitors and customers: a steady, plain voice from their name. */
function guestProfile(key: string): Profile {
  const h = strHash(key);
  return { freq: 170 + (h % 250), type: h % 2 ? 'triangle' : 'sine', every: 3 + (h >> 3) % 4, gap: 0.12 + ((h >> 5) % 5) / 40, hop: [1, 1.1, 0.95], vol: 0.034, phrase: 3 };
}

const VOICES: Record<string, (step: number) => VoiceNote> = { pip, spicy, rigg, ume, kiki, akio };
const DYNAMIC = new Map<string, { make: (step: number) => VoiceNote; phrase: number } | null>();

/** The voice for any speaker key, or null for the narrator, letters and unknown ids. */
function resolve(id: string): { make: (step: number) => VoiceNote; phrase: number } | null {
  if (!id || id === 'narr') return null;
  const lead = VOICES[id];
  if (lead) return { make: lead, phrase: PHRASE[id] ?? 3 };
  if (DYNAMIC.has(id)) return DYNAMIC.get(id)!;
  const prof = Object.prototype.hasOwnProperty.call(CAST, id) ? CAST[id] : neighborProfile(id) ?? (id.startsWith('guest:') ? guestProfile(id) : null);
  const out = prof ? { make: fromProfile(prof), phrase: prof.phrase ?? 3 } : null;
  DYNAMIC.set(id, out);
  return out;
}

/** How many notes a fully revealed line still plays, so instant text keeps the personality. */
const PHRASE: Record<string, number> = { pip: 3, ume: 3, rigg: 2, akio: 3, kiki: 4, spicy: 5 };

export function hasVoice(id: string): boolean {
  return resolve(id) !== null;
}

export function voiceNote(id: string, step: number): VoiceNote | null {
  const v = resolve(id);
  return v ? v.make(step) : null;
}

export function voicePhraseCount(id: string): number {
  return resolve(id)?.phrase ?? 0;
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
