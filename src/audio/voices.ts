/**
 * Dialogue voices. The six leads (Pip, Spicy, Rigg, Ume, Kiki, Akio) are shaped by hand below. Everyone else gets a voice
 * made from a small profile, so pitch, pace and texture follow their personality: the rest of the village cast by hand
 * (Taro, Yuki, Bento, Sumi, Momo, Nami, Kumo, Hoshi, Sora), the neighbours from their species and traits, the player,
 * and any visitor or customer from a seed of their name. The narrator and letters stay silent.
 * Numbers are chosen so pitch, pace and texture stay apart: low and warm versus high and quick.
 * Every voice sounds on each letter. A stride longer than 1 skips almost every character, so only Spicy was audible.
 * Gaps stay under a tenth of a second: at normal text speed that is still several notes a second.
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

/** Pip — low, soft. An octave above the fundamental so small speakers still carry it. */
function pip(_step: number): VoiceNote {
  return tone({
    freq: 148, type: 'sine', vol: 0.064, dur: 0.09, attack: 0.012, slide: 0.94,
    harm: 2, harmMix: 0.62, chirp: 0, noise: 0, gap: 0.068, every: 1, sound: true,
  });
}

/** Abuela Ume — medium-low, warm, a little slower than Pip. */
function ume(_step: number): VoiceNote {
  return tone({
    freq: 196, type: 'sine', vol: 0.06, dur: 0.1, attack: 0.016, slide: 0.97,
    harm: 1.5, harmMix: 0.55, chirp: 0, noise: 0, gap: 0.082, every: 1, sound: true,
  });
}

/** Rigg — medium-high, delicate, the quietest of the leads, still on every letter. */
function rigg(_step: number): VoiceNote {
  return tone({
    freq: 330, type: 'sine', vol: 0.046, dur: 0.05, attack: 0.006, slide: 1,
    harm: 2, harmMix: 0.28, chirp: 0, noise: 0, gap: 0.1, every: 1, sound: true,
  });
}

/** Akio — lower than Pip, a little rough. The third harmonic keeps the low note audible. */
function akio(_step: number): VoiceNote {
  return tone({
    freq: 123, type: 'triangle', vol: 0.07, dur: 0.07, attack: 0.006, slide: 0.8,
    harm: 3, harmMix: 0.5, chirp: 0, noise: 0.1, gap: 0.05, every: 1, sound: true,
  });
}

/** Kiki — high, bouncy. Two notes, then a short rest. */
function kiki(step: number): VoiceNote {
  const rest = step % 3 === 2;
  const freq = 392 * KIKI_JUMPS[step % KIKI_JUMPS.length];
  return tone({
    freq, type: 'triangle', vol: 0.052, dur: 0.038, attack: 0.003, slide: 1,
    harm: 0, harmMix: 0, chirp: !rest && step % 3 === 1 ? 1.16 : 0, noise: 0,
    gap: rest ? 0.12 : 0.04, every: 1, sound: !rest,
  });
}

/** Spicy Beacon — very high, fastest, with leaps. */
function spicy(step: number): VoiceNote {
  const freq = 494 * SPICY_LEAPS[step % SPICY_LEAPS.length];
  return tone({
    freq, type: 'triangle', vol: 0.05, dur: 0.04, attack: 0.003, slide: 1,
    harm: 0, harmMix: 0, chirp: step % 3 === 2 ? 1.22 : 0, noise: 0,
    gap: 0.032, every: 1, sound: true,
  });
}

/** A compact way to describe a voice: only what differs from a plain, even blip. */
interface Profile {
  freq: number;
  type?: VoiceWave;
  vol?: number;
  dur?: number;
  /** 1 sounds on every letter. A larger stride skips letters and the voice disappears. */
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
  const every = p.every ?? 1;
  return (step) => {
    const syl = Math.floor(step / every);
    return tone({
      freq: p.freq * (p.hop ? p.hop[syl % p.hop.length] : 1), type: p.type ?? 'sine', vol: p.vol ?? 0.04, dur: p.dur ?? 0.07, attack: 0.008,
      slide: p.slide ?? 1, harm: p.harm ?? 0, harmMix: p.mix ?? 0, chirp: p.chirp && syl % 3 === 2 ? p.chirp : 0, noise: p.noise ?? 0,
      gap: p.gap ?? 0.06, every, sound: step % every === 0,
    });
  };
}

/** The rest of the village cast, by hand, after their bios. */
const CAST: Record<string, Profile> = {
  taro: { freq: 233, vol: 0.055, every: 1, gap: 0.055, hop: [1, 1.12, 0.94], phrase: 5 },                         // negociante: chatty, even
  yuki: { freq: 392, type: 'triangle', every: 1, gap: 0.05, hop: [1, 1.06], dur: 0.045, phrase: 5 },              // perfeccionista: neat and bright
  bento: { freq: 130, dur: 0.1, every: 1, gap: 0.095, slide: 0.96, harm: 2, mix: 0.55, vol: 0.066, phrase: 4 },   // enorme y amable: low, warm, a little slower
  sumi: { freq: 294, dur: 0.07, every: 1, gap: 0.06, hop: [1, 1.19, 1.33, 1.12], phrase: 5 },                    // artista: melodic
  momo: { freq: 349, vol: 0.04, dur: 0.06, every: 1, gap: 0.09, slide: 1.03, phrase: 4 },                        // tímida: softer and a bit slower
  nami: { freq: 440, type: 'triangle', vol: 0.05, dur: 0.04, every: 1, gap: 0.042, hop: [1, 1.25, 1.12, 1.5], chirp: 1.12, phrase: 6 }, // aventurera: bright, quick
  kumo: { freq: 175, type: 'triangle', vol: 0.05, dur: 0.07, every: 1, gap: 0.08, slide: 0.9, harm: 2, mix: 0.4, noise: 0.03, phrase: 4 }, // erudito reservado: low, dry
  hoshi: { freq: 262, vol: 0.048, dur: 0.09, every: 1, gap: 0.075, slide: 1.08, harm: 2, mix: 0.35, phrase: 4 },  // soñadora: airy, rising
  sora: { freq: 370, type: 'triangle', dur: 0.035, every: 1, gap: 0.048, phrase: 5 },                             // cartera puntual: crisp, even
  player: { freq: 300, type: 'triangle', vol: 0.05, dur: 0.05, every: 1, gap: 0.055, hop: [1, 1.1, 0.96], phrase: 4 },
};

const SPECIES_PITCH: Record<string, number> = { bear: 150, dog: 175, otter: 210, owl: 230, fox: 260, cat: 300, bunny: 330, squirrel: 345, raccoon: 190 };
const strHash = (text: string): number => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** A neighbour's voice follows their animal and their traits. */
function neighborProfile(id: string): Profile | null {
  const n = NEIGHBOR_BY_ID[id];
  if (!n) return null;
  const h = strHash(id);
  const p: Profile = { freq: (SPECIES_PITCH[n.look.species] ?? 240) * (0.94 + (h % 13) / 100), type: h % 3 === 0 ? 'triangle' : 'sine', every: 1, gap: 0.06, hop: [1, 1.08 + (h % 7) / 100, 0.95], vol: 0.05, phrase: 4 };
  const has = (t: string) => (n.traits as string[]).includes(t);
  if (has('shy')) { p.vol = 0.036; p.gap = 0.09; p.phrase = 3; }
  if (has('sociable')) { p.gap = 0.05; p.phrase = 5; }
  if (has('sporty')) { p.gap = 0.042; p.dur = 0.045; p.type = 'triangle'; }
  if (has('hardworking')) { p.hop = [1, 1.04]; }
  if (has('adventurous')) { p.chirp = 1.14; p.hop = [1, 1.25, 1.1, 1.4]; }
  if (has('nocturnal')) { p.freq *= 0.88; p.slide = 0.95; p.gap = (p.gap ?? 0.06) * 1.3; p.harm = 2; p.mix = 0.4; }
  return p;
}

/** Visitors and customers: a steady, plain voice from their name. */
function guestProfile(key: string): Profile {
  const h = strHash(key);
  return { freq: 170 + (h % 250), type: h % 2 ? 'triangle' : 'sine', every: 1, gap: 0.05 + ((h >> 5) % 4) * 0.012, hop: [1, 1.1, 0.95], vol: 0.05, harm: 2, mix: 0.25, phrase: 4 };
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
const PHRASE: Record<string, number> = { pip: 5, ume: 4, rigg: 2, akio: 4, kiki: 5, spicy: 6 };

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
