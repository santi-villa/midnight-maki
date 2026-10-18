/**
 * Original synthesized audio (no external files): soft SFX, generative lo-fi music loops and ambience.
 * Everything is gated behind the first user gesture, as browsers require.
 */
import { settings } from '../core/settings';
import { bus } from '../core/events';
import { reportError, runTask } from '../core/errors';
import { voiceNote, voicePhraseCount, voiceWhen, type VoiceNote } from './voices';

type Track = 'title' | 'town' | 'restaurant' | 'restaurant_night' | 'kitchen' | 'kitchen_hard' | 'home' | 'forest' | 'beach' | 'garden' | 'market' | 'mystery' | 'stars' | 'festival' | 'emotional' | 'intro' | 'none';

interface TrackDef {
  bpm: number;
  scale: number[];        // semitone offsets from root
  root: number;           // midi
  chords: number[][];     // degrees per bar
  lead: 'piano' | 'pluck' | 'bell' | 'flute';
  density: number;        // 0..1 notes per eighth
  bass: boolean;
  swing: number;
  /** composed 4-bar theme: 32 eighths, scale-degree numbers (7 = octave up), '-' holds, '.' rests */
  melody?: string;
  /** gentle chord-tone arpeggio on the off-beats */
  arp?: boolean;
  /** cooking groove: wood-block chops, a walking bass and (optionally) a ticking clock on every beat */
  groove?: { tick?: boolean };
  /** soft kick on the strong beats and a rim tick on the answers: gives the tune a pulse to bounce on */
  beat?: boolean;
}

const PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const MIYAKO = [0, 1, 5, 7, 8]; // in-scale japanese flavour

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
  title: { bpm: 70, scale: PENTA, root: 57, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'piano', density: 0.35, bass: true, swing: 0.1 },
  town: { bpm: 84, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 17]], lead: 'pluck', density: 0.5, bass: true, swing: 0.15, beat: true },
  restaurant: { bpm: 78, scale: PENTA, root: 62, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-1, 2, 5, 9], [4, 7, 11, 14]], lead: 'piano', density: 0.45, bass: true, swing: 0.2, beat: true },
  // a cheerful lunchtime kitchen: koto-like pluck theme, marimba answers, wood-block chopping and a walking bass (16 bars: A B A' B')
  kitchen: { bpm: 96, scale: PENTA, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'pluck', density: 0.3, bass: true, swing: 0.1, groove: {}, beat: true },
  kitchen_hard: { bpm: 122, scale: PENTA, root: 62, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'pluck', density: 0.36, bass: true, swing: 0.05, groove: { tick: true }, beat: true },
  restaurant_night: { bpm: 66, scale: PENTA, root: 57, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], lead: 'piano', density: 0.3, bass: true, swing: 0.2 },
  home: { bpm: 64, scale: PENTA, root: 60, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: 'bell', density: 0.25, bass: false, swing: 0.1 },
  forest: { bpm: 72, scale: MIYAKO, root: 57, chords: [[0, 7, 12], [1, 8, 13], [-2, 5, 10], [0, 7, 12]], lead: 'flute', density: 0.3, bass: true, swing: 0 },
  beach: { bpm: 80, scale: PENTA, root: 65, chords: [[0, 4, 7, 9], [5, 9, 12, 14], [2, 5, 9, 12], [7, 11, 14, 16]], lead: 'pluck', density: 0.4, bass: true, swing: 0.25, beat: true },
  garden: { bpm: 70, scale: PENTA, root: 64, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [0, 4, 7]], lead: 'bell', density: 0.35, bass: false, swing: 0.1 },
  market: { bpm: 92, scale: MIYAKO, root: 62, chords: [[0, 7, 12], [5, 12, 17], [1, 8, 13], [0, 7, 12]], lead: 'pluck', density: 0.55, bass: true, swing: 0.1, beat: true },
  mystery: { bpm: 60, scale: MINOR_PENTA, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [-1, 2, 7]], lead: 'bell', density: 0.2, bass: true, swing: 0 },
  stars: { bpm: 58, scale: PENTA, root: 64, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 18]], lead: 'bell', density: 0.3, bass: false, swing: 0 },
  festival: { bpm: 100, scale: PENTA, root: 62, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'flute', density: 0.6, bass: true, swing: 0.15, beat: true },
  intro: { bpm: 60, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], lead: 'piano', density: 0.25, bass: true, swing: 0 },
  emotional: { bpm: 60, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], lead: 'piano', density: 0.25, bass: true, swing: 0 },
};

/** Composed themes (degrees index the track scale; values >= 5 wrap to the next octave). */
const MELODIES: Partial<Record<Exclude<Track, 'none'>, string>> = {
  title:      '4 - 5 - 7 - 5 4 | 2 - - - . . 2 4 | 5 - 4 2 4 - 2 0 | 2 - - - - - . . ',
  town:       '2 - 4 5 4 - 2 - | 0 - 2 - 4 - . . | 2 - 4 5 7 - 5 - | 4 - 2 - 0 - . . ',
  restaurant: '4 - 5 - 4 2 - 2 | 0 - 2 4 - . . . | 5 - 7 5 4 - 2 4 | 2 - 0 - . . . . ',
  kitchen:    '0 - 2 - 4 - 3 2 | 1 - 2 - 1 0 . . | 2 - 3 - 4 - 5 4 | 3 - 2 1 0 - . . ',
  kitchen_hard: '0 2 4 2 0 2 4 5 | 4 2 1 - 0 - . . | 2 3 4 3 2 3 5 4 | 3 - 2 - 0 - . . ',
  restaurant_night: '4 - - 3 2 - - . | 3 - - 2 1 - . . | 0 - 2 - 3 - 4 - | 2 - - - - - . . ',
  home:       '0 - 2 - 4 - 2 - | 0 - . - 2 - 4 - | 5 - 4 - 2 - 0 - | 2 - - - . . . . ',
  forest:     '0 - - 1 2 - - . | 3 - 2 - 1 - . . | 0 - 1 - 2 - 4 - | 3 - - - 2 - . . ',
  beach:      '2 3 4 - 4 3 2 - | 1 2 3 - . . . . | 4 5 6 - 5 4 3 - | 2 - - - . . . . ',
  garden:     '4 - 2 - 3 - 1 - | 2 - 0 - . . . . | 1 - 2 - 3 - 4 - | 5 - - - . . . . ',
  market:     '0 1 2 4 2 1 0 - | 2 3 4 - 3 2 1 - | 0 1 2 4 5 4 2 - | 1 - 0 - . . . . ',
  mystery:    '0 - - - 2 - 1 - | 0 - - - . . . . | 3 - - 2 1 - 0 - | 1 - - - . . . . ',
  stars:      '4 - - - 5 - - - | 6 - 5 - 4 - - . | 3 - - - 4 - 2 - | 1 - - - - - - . ',
  festival:   '0 2 4 2 0 2 4 5 | 4 - 2 - 0 - . . | 1 3 4 3 1 3 4 6 | 5 - 4 - 2 - . . ',
  intro:      '2 - - 3 4 - - . | 3 - 2 - 1 - - . | 0 - - 1 2 - - . | 1 - - - - - - . ',
  emotional:  '2 - - 3 4 - - . | 3 - 2 - 1 - - . | 0 - - 1 2 - - . | 1 - - - - - - . ',
};
/** second theme: tracks that have one play A B A' B' (the answering phrase on a marimba) */
const MELODIES_B: Partial<Record<Exclude<Track, 'none'>, string>> = {
  town:         '5 - 4 2 4 - 2 0 | 2 - 0 - . . . . | 5 - 7 5 4 - 2 - | 0 - 2 - 4 - . . ',
  restaurant:   '2 - 4 - 5 - 4 - | 2 - 0 - 2 - . . | 4 - 2 4 5 - 4 2 | 0 - - - . . . . ',
  kitchen:      '4 - 5 - 4 2 0 - | 1 - 2 - 4 - . . | 5 - 4 - 2 - 4 5 | 4 - 2 - 0 - . . ',
  kitchen_hard: '4 5 4 2 0 2 4 - | 5 4 2 - 1 - . . | 4 5 6 5 4 2 4 5 | 4 2 1 - 0 - . . ',
};
const ARP: Partial<Record<Exclude<Track, 'none'>, boolean>> = { kitchen_hard: true, title: true, town: true, restaurant: true, restaurant_night: true, kitchen: true, home: true, garden: true, stars: true, emotional: true, intro: true, beach: true };

function parseMelody(src: string): (number | null | '-')[] {
  return src.replace(/\|/g, ' ').trim().split(/\s+/).map((t) => (t === '.' ? null : t === '-' ? '-' : Number(t)));
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Optional custom songs. Drop audio files into `src/music/`; the file name picks the scene:
 *   menu / title / principal -> main menu, intro -> story intro, kitchen / cocina -> cooking minigame.
 * Scenes without a file keep the generated music.
 */
const MUSIC_FILES = import.meta.glob('../music/*.{mp3,ogg,m4a,wav,webm,opus}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const NIGHT_FILES = import.meta.glob('./*night-ambience*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SONG_MATCH: Partial<Record<Track, RegExp>> = { title: /menu|title|principal/i, intro: /intro/i, kitchen: /^(?!.*(hard|dificil|difícil)).*(kitchen|cocina)/i, kitchen_hard: /(kitchen|cocina).*(hard|dificil|difícil)/i };

/** Opus and Ogg first: Chromium plays them. AAC in m4a stays as the next try. */
function songRank(name: string): number {
  if (/\.(opus|ogg|webm)(\?|$)/i.test(name)) return 0;
  if (/\.mp3(\?|$)/i.test(name)) return 1;
  return 2;
}

export function songURLs(track: Track): string[] {
  const re = SONG_MATCH[track];
  if (!re) return [];
  return Object.entries(MUSIC_FILES)
    .filter(([name]) => re.test(name.split('/').pop() ?? ''))
    .sort((a, b) => songRank(a[0]) - songRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([, url]) => url);
}

interface AmbienceBed { sources: AudioScheduledSourceNode[]; nodes: AudioNode[]; gain: GainNode; filter: BiquadFilterNode; rain: boolean; waves: boolean }

function holdParam(param: AudioParam, time: number) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(time);
  else { const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time); }
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private master!: GainNode;
  private current: Track = 'none';
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private rng = Math.random;
  private ambBed: AmbienceBed | null = null;
  private ambKind = '';
  private requestedAmbience = 'none';
  private windowDropTimer: number | null = null;
  private gullTimer: number | null = null;
  private nightBed: { el: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode } | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private pendingTrack: Track = 'none';
  private lastSfx: Record<string, number> = {};

  private badSongs = new Set<Track>();
  private custom: { track: Track; el: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode; starting: boolean; fallback: (err?: unknown) => void } | null = null;

  /** Streams the custom song for a track (no big decode in memory). Returns false when there is none. */
  private startCustom(track: Track): boolean {
    const urls = songURLs(track);
    if (!this.ctx || !urls.length || this.badSongs.has(track)) return false;
    this.playCustom(track, urls, 0);
    return true;
  }

  /** Tries each file for the track. A format this browser cannot decode is skipped before the generated tune. */
  private playCustom(track: Track, urls: string[], index: number) {
    const c = this.ctx;
    const url = urls[index];
    if (!c || !url) return;
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.preload = 'auto';
    const node = c.createMediaElementSource(el);
    const gain = c.createGain();
    const t = c.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(settings.music * 0.5, t + 1.5);
    node.connect(gain).connect(this.master); // straight to the master: no lo-fi filter on a finished song
    const me = { track, el, node, gain, starting: false, fallback: (_err?: unknown) => {} };
    this.custom = me;
    const fallback = (err?: unknown) => {
      if (this.custom !== me) return;
      this.stopCustom(true);
      if (index + 1 < urls.length) {
        this.playCustom(track, urls, index + 1);
        return;
      }
      reportError('audio:custom:' + track, err ?? new Error('Unavailable music file'), false);
      this.badSongs.add(track);
      this.current = 'none'; // unreadable file: bring the generated tune back
      this.play(track);
    };
    me.fallback = fallback;
    el.addEventListener('error', () => fallback(), { once: true });
    this.tryCustom();
  }

  /** Autoplay denial is temporary: retry the same element on the next gesture, without seeking. */
  private tryCustom() {
    const cur = this.custom;
    if (!cur || cur.starting || !cur.el.paused || document.hidden) return;
    cur.starting = true;
    const failed = (err: unknown) => {
      cur.starting = false;
      if (this.custom !== cur) return;
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || (err.name === 'AbortError' && document.hidden))) return;
      cur.fallback(err);
    };
    try {
      void cur.el.play().then(() => { cur.starting = false; }, failed);
    } catch (err) { failed(err); }
  }

  private stopCustom(now = false) {
    const c = this.ctx;
    const cur = this.custom;
    if (!cur || !c) return;
    this.custom = null;
    const done = () => {
      cur.el.pause();
      cur.el.removeAttribute('src');
      cur.node.disconnect();
      cur.gain.disconnect();
    };
    if (now) return done();
    cur.gain.gain.cancelScheduledValues(c.currentTime);
    cur.gain.gain.setValueAtTime(Math.max(0, cur.gain.gain.value), c.currentTime);
    cur.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
    window.setTimeout(done, 600);
  }

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void runTask('audio:resume', () => this.ctx!.resume(), false);
      this.tryCustom();
      this.tryNightBed();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.music = c.createGain();
    this.sfx = c.createGain();
    this.amb = c.createGain();
    // gentle lowpass on music for a lo-fi warmth
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    this.music.connect(lp).connect(this.master);
    // small room reverb (generated impulse) for warmth
    try {
      const len = Math.floor(c.sampleRate * 1.8);
      const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const conv = c.createConvolver();
      conv.buffer = ir;
      const wet = c.createGain();
      wet.gain.value = 0.28;
      lp.connect(conv).connect(wet).connect(this.master);
    } catch {
      /* no convolver: dry only */
    }
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.applyVolumes();
    this.noise();
    bus.on('settings:changed', () => this.applyVolumes());
    window.addEventListener('pointerdown', () => this.unlock());
    window.addEventListener('keydown', () => this.unlock());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.custom?.el.pause();
        this.nightBed?.el.pause();
        void runTask('audio:suspend', () => this.ctx!.suspend(), false);
      } else this.unlock();
    });
    if (this.pendingTrack !== 'none') this.play(this.pendingTrack);
    this.ambience(this.requestedAmbience);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(this.custom ? 0 : settings.music * 0.35, t, 0.1);
    this.custom?.gain.gain.cancelScheduledValues(t);
    this.custom?.gain.gain.setTargetAtTime(settings.music * 0.5, t, 0.1);
    this.sfx.gain.setTargetAtTime(settings.sfx * 0.5, t, 0.05);
    this.amb.gain.setTargetAtTime(settings.ambience * 0.35, t, 0.2);
  }

  currentTrack(): Track {
    return this.current === 'none' ? this.pendingTrack : this.current;
  }

  play(track: Track) {
    this.pendingTrack = track;
    if (this.custom && this.custom.track !== track) this.stopCustom();
    if (!this.ctx || track === this.current) return;
    this.current = track;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (track === 'none') return;
    if (this.startCustom(track)) {
      this.music.gain.cancelScheduledValues(this.ctx.currentTime);
      this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(settings.music * 0.35, this.ctx.currentTime, 0.1);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  /** Dip the music and bring the next tune in. Volumes still follow the player settings. */
  crossfade(track: Track) {
    if (!this.ctx || !this.music) {
      this.play(track);
      return;
    }
    if (track === this.current) return;
    const t = this.ctx.currentTime;
    const now = Math.max(0, this.music.gain.value);
    this.play(track);
    const target = this.custom ? 0 : settings.music * 0.35;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(now, t);
    this.music.gain.linearRampToValueAtTime(0, t + 0.28);
    this.music.gain.linearRampToValueAtTime(target, t + 0.9);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || this.current === 'none') return;
    const def = TRACKS[this.current];
    const eighth = 60 / def.bpm / 2;
    while (this.nextTime < c.currentTime + 0.4) {
      const bar = Math.floor(this.step / 8) % def.chords.length;
      const inBar = this.step % 8;
      const chord = def.chords[bar];
      const swing = inBar % 2 ? eighth * def.swing : 0;
      const t = this.nextTime + swing;
      if (inBar === 0) {
        // soft pad chord
        for (const n of chord) this.note(def.root + n - 12, t, eighth * 7.5, 'pad', 0.05);
        if (def.bass) this.note(def.root + chord[0] - 24, t, eighth * 3, 'bass', 0.12);
      }
      if (def.bass && !def.groove && inBar === 4) this.note(def.root + chord[0] - 24 + (this.rng() < 0.5 ? 7 : 0), t, eighth * 3, 'bass', 0.09);
      const trackId = this.current as Exclude<Track, 'none'>;
      const melodyA = MELODIES[trackId];
      const melodyB = MELODIES_B[trackId];
      const mel0 = melodyA ? parseMelody(melodyA) : null;
      // with a second theme the form is A B A' B' (each theme is 4 bars)
      const pass = mel0 ? Math.floor(this.step / mel0.length) : 0;
      const melody = melodyB && pass % 2 === 1 ? melodyB : melodyA;
      if (melody) {
        const mel = parseMelody(melody);
        const i = this.step % mel.length;
        const tok = mel[i];
        const answering = !!melodyB && pass % 2 === 1;
        if (typeof tok === 'number') {
          let len = 1;
          while (mel[(i + len) % mel.length] === '-' && len < 8) len++;
          const n = def.scale.length;
          const deg = def.scale[((tok % n) + n) % n] + Math.floor(tok / n) * 12;
          // every other pass the theme rises an octave on its last half, for variety
          const lift = pass % 2 === 1 && i >= mel.length / 2 && !melodyB ? 12 : 0;
          const prime = !!melodyB && pass >= 2 && inBar % 4 === 0; // second time round the lead is doubled by a glockenspiel
          this.note(def.root + deg + lift, t, eighth * len * 0.95, answering ? 'bell' : def.lead, answering ? 0.085 : 0.1);
          if (prime) this.note(def.root + deg + 12, t, eighth * 0.9, 'bell', 0.04);
        } else if (tok === null && pass % 2 === 1 && !melodyB && this.rng() < def.density * 0.5) {
          // gentle improvised fill in the rests of the second pass
          const deg = def.scale[Math.floor(this.rng() * def.scale.length)];
          this.note(def.root + deg + 12, t, eighth * 1.4, def.lead, 0.05);
        }
      } else if (this.rng() < def.density && inBar !== 7) {
        const deg = def.scale[Math.floor(this.rng() * def.scale.length)];
        const oct = this.rng() < 0.3 ? 12 : 0;
        this.note(def.root + deg + oct, t, eighth * (this.rng() < 0.3 ? 3 : 1.6), def.lead, 0.09);
      }
      if (def.groove) this.groove(def, chord, inBar, t, eighth, pass);
      if (ARP[this.current as Exclude<Track, 'none'>] && inBar % 2 === 1) {
        const tone = chord[Math.floor(inBar / 2) % chord.length];
        this.note(def.root + tone - 12, t, eighth * 1.2, 'pluck', 0.035);
      }
      if (def.beat) {
        if (inBar === 0 || inBar === 4) this.kick(t, inBar === 0 ? 0.2 : 0.12);
        if (inBar === 2 || inBar === 6) this.rim(t, 0.05);
      }
      // brushed hat for lo-fi feel
      if (def.bass && inBar % 2 === 0 && this.noiseBuf) this.hat(t, inBar === 4 ? 0.025 : 0.012);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private note(midi: number, t: number, dur: number, kind: string, vol: number) {
    const c = this.ctx!;
    const g = c.createGain();
    g.connect(this.music);
    const f = mtof(midi);
    const oscs: OscillatorNode[] = [];
    const mk = (type: OscillatorType, freq: number, gain = 1) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      if (gain !== 1) {
        const og = c.createGain();
        og.gain.value = gain;
        o.connect(og).connect(g);
      } else o.connect(g);
      oscs.push(o);
    };
    let attack = 0.01;
    let release = dur;
    switch (kind) {
      case 'piano':
        mk('triangle', f);
        mk('sine', f * 2, 0.3);
        release = dur * 1.8;
        break;
      case 'pluck':
        mk('triangle', f);
        mk('square', f, 0.05);
        release = dur * 1.2;
        break;
      case 'bell':
        mk('sine', f);
        mk('sine', f * 3.01, 0.18);
        release = dur * 2.5;
        break;
      case 'flute':
        mk('sine', f);
        mk('triangle', f * 2, 0.08);
        attack = 0.06;
        break;
      case 'pad':
        mk('sine', f);
        mk('triangle', f * 1.003, 0.4);
        attack = 0.4;
        break;
      case 'bass':
        mk('sine', f);
        mk('triangle', f, 0.3);
        break;
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    for (const o of oscs) {
      o.start(t);
      o.stop(t + attack + release + 0.05);
    }
  }

  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const c = this.ctx!;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // brown-ish noise: softer than white
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    this.noiseBuf = buf;
    return buf;
  }

  /** Kitchen groove: knife-on-board chops (a noise tick plus a short wood tone), a walking bass and an optional ticking clock. */
  private groove(def: TrackDef, chord: number[], inBar: number, t: number, eighth: number, pass: number) {
    const bars = Math.floor(this.step / 8);
    // chop pattern, one per bar of the 4-bar phrase; the last bar of each phrase is a busier "fill"
    const PAT = ['x . x . x . x .', 'x . x . x . x x', 'x . x x x . x .', 'x x x . x x x x'][bars % 4].split(' ');
    const accent = inBar === 0 ? 1 : inBar === 4 ? 0.8 : 0.45;
    if (PAT[inBar] === 'x' && this.noiseBuf) {
      this.hat(t, 0.05 * accent + (pass % 2 ? 0.01 : 0));
      this.note(def.root + 24 + (inBar % 4 === 0 ? 0 : 5), t, 0.05, 'pluck', 0.012 * accent);
    }
    // walking bass: root, fifth, octave, third (one note on every other eighth)
    if (def.bass && inBar % 2 === 0) {
      const walk = [0, 7, 12, 4][inBar / 2];
      this.note(def.root + chord[0] - 24 + (walk === 4 ? (chord[1] - chord[0]) : walk), t, eighth * 1.6, 'bass', inBar === 0 ? 0.13 : 0.08);
    }
    // wood-block "tok" on the off-beats, a shaker on the quarter notes
    if (inBar % 4 === 2) this.note(def.root + 31, t, 0.04, 'pluck', 0.02);
    if (def.groove?.tick && inBar % 2 === 0) this.note(def.root + 43 + (inBar === 0 ? 0 : -2), t, 0.03, 'pluck', 0.022);
  }

  /** soft kick: a sine that drops in pitch */
  private kick(t: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.music);
    o.start(t); o.stop(t + 0.2);
  }

  /** rim tick: a short filtered noise with a woody tone */
  private rim(t: number, vol: number) {
    const c = this.ctx!;
    if (this.noiseBuf) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = 2200;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + 0.07);
    }
    this.note(84, t, 0.04, 'pluck', vol * 0.5);
  }

  private hat(t: number, vol: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(hp).connect(g).connect(this.music);
    s.start(t, Math.random());
    s.stop(t + 0.08);
  }

  /** Wind and crickets, quieter than the generated bed. Falls back to soft noise if the file cannot play. */
  private startNightBed(): boolean {
    const url = Object.values(NIGHT_FILES)[0];
    const c = this.ctx;
    if (!c || !url || typeof Audio === 'undefined') return false;
    if (this.nightBed) { this.tryNightBed(); return true; }
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.preload = 'auto';
    const node = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 0.1;
    node.connect(gain).connect(this.amb);
    this.nightBed = { el, node, gain };
    this.tryNightBed();
    return true;
  }

  private tryNightBed() {
    const bed = this.nightBed;
    if (!bed || !bed.el.paused || document.hidden) return;
    void bed.el.play().catch(() => { /* the next gesture retries */ });
  }

  private stopNightBed() {
    const bed = this.nightBed;
    if (!bed) return;
    this.nightBed = null;
    bed.el.pause();
    bed.el.removeAttribute('src');
    bed.node.disconnect();
    bed.gain.disconnect();
  }

  /** Looping ambience. Rain keeps the same sources when crossing a doorway: only filtering/gain fade. */
  ambience(kind: string) {
    this.requestedAmbience = kind;
    if (!this.ctx || kind === this.ambKind) return;
    this.ambKind = kind;
    if (this.windowDropTimer !== null) window.clearTimeout(this.windowDropTimer);
    this.windowDropTimer = null;
    if (this.gullTimer !== null) window.clearTimeout(this.gullTimer);
    this.gullTimer = null;
    const c = this.ctx;
    const rain = kind === 'rain' || kind === 'rain_inside';
    const inside = kind === 'rain_inside';
    const waves = kind === 'waves' || kind === 'waves_night';
    if (waves && this.ambBed?.waves) {
      if (kind === 'waves') this.queueGull();
      return;
    }
    if (rain && this.ambBed?.rain) {
      this.fadeRain(this.ambBed, inside);
      if (inside) this.queueWindowDrop();
      return;
    }
    this.retireAmbience();
    if (kind !== 'night') this.stopNightBed();
    if (kind === 'none') return;
    if (kind === 'night' && this.startNightBed()) return;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const bed: AmbienceBed = { sources: [], nodes: [f, g], gain: g, filter: f, rain, waves };
    this.ambBed = bed;
    f.type = 'lowpass'; f.Q.value = 0.5;
    f.frequency.value = rain ? (inside ? 420 : 1200) : waves ? 1800 : 280;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(rain ? (inside ? 0.065 : 0.25) : waves ? 0.09 : 0.1, c.currentTime + 0.55);
    f.connect(g).connect(this.amb);
    const addNoise = (body: boolean) => {
      const s = c.createBufferSource(); s.buffer = this.noise(); s.loop = true;
      bed.sources.push(s); bed.nodes.push(s);
      if (body) {
        s.playbackRate.value = 0.55;
        const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 180;
        const gain = c.createGain(); gain.gain.value = 0.38;
        s.connect(low).connect(gain).connect(f); bed.nodes.push(low, gain);
      } else s.connect(f);
      s.start(0, body ? 0.7 : 0);
    };
    if (waves) { addNoise(true); this.addSeaFoam(bed); }
    else { addNoise(false); if (rain) addNoise(true); }
    if (kind === 'waves') this.queueGull();
    if (inside) this.queueWindowDrop();
  }

  /** Quiet foam above the low, constant swell. Random smoothed swells replace the eight-second sine. */
  private addSeaFoam(bed: AmbienceBed) {
    const c = this.ctx!;
    const foam = c.createBufferSource(); foam.buffer = this.noise(); foam.loop = true; foam.playbackRate.value = 1.13;
    const band = c.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 900; band.Q.value = 0.45;
    const gain = c.createGain(); gain.gain.value = 0;
    foam.connect(band).connect(gain).connect(bed.filter);
    // A tiny looping control buffer: irregular 2–5 second waves, continuous at the seam.
    const rate = 32, length = 47 * rate, envelope = c.createBuffer(1, length, 8000);
    const data = envelope.getChannelData(0); const first = 0.3;
    let at = 0, value = first;
    while (at < length - 1) {
      const next = Math.min(length - 1, at + Math.round((2 + this.rng() * 3) * rate));
      const target = next === length - 1 ? first : 0.12 + this.rng() * 0.42;
      for (let i = at; i <= next; i++) {
        const u = (i - at) / (next - at), ease = u * u * (3 - 2 * u);
        data[i] = value + (target - value) * ease;
      }
      at = next; value = target;
    }
    const control = c.createBufferSource(); control.buffer = envelope; control.loop = true; control.playbackRate.value = rate / 8000; control.connect(gain.gain);
    bed.sources.push(foam, control); bed.nodes.push(foam, band, gain, control);
    foam.start(0, 1.1); control.start();
  }

  private queueGull() {
    this.gullTimer = window.setTimeout(() => {
      this.gullTimer = null;
      if (this.ambKind !== 'waves' || !this.ctx) return;
      if (!document.hidden && this.ctx.state === 'running') this.seagull();
      this.queueGull();
    }, 35_000 + this.rng() * 55_000);
  }

  /** Distant gull, routed through the ambience slider and never queued at night. */
  private seagull() {
    const c = this.ctx!, t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 1500;
    o.frequency.setValueAtTime(720, t); o.frequency.linearRampToValueAtTime(1050, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.55);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.009, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f).connect(g).connect(this.amb);
    o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + 0.7);
  }

  private fadeRain(bed: AmbienceBed, inside: boolean) {
    const t = this.ctx!.currentTime;
    // Holding the current value makes a quick in/out/in sequence continuous too.
    holdParam(bed.gain.gain, t);
    holdParam(bed.filter.frequency, t);
    bed.gain.gain.linearRampToValueAtTime(inside ? 0.065 : 0.25, t + 0.55);
    bed.filter.frequency.exponentialRampToValueAtTime(inside ? 420 : 1200, t + 0.55);
  }

  private retireAmbience() {
    const bed = this.ambBed;
    if (!bed || !this.ctx) return;
    this.ambBed = null;
    const t = this.ctx.currentTime;
    holdParam(bed.gain.gain, t);
    bed.gain.gain.linearRampToValueAtTime(0, t + 0.55);
    let left = bed.sources.length;
    for (const source of bed.sources) {
      source.onended = () => { if (--left === 0) for (const node of bed.nodes) node.disconnect(); };
      source.stop(t + 0.6);
    }
  }

  private queueWindowDrop() {
    this.windowDropTimer = window.setTimeout(() => {
      this.windowDropTimer = null;
      if (this.ambKind !== 'rain_inside' || !this.ctx) return;
      if (!document.hidden && this.ctx.state === 'running') this.windowDrop();
      this.queueWindowDrop();
    }, 1600 + Math.random() * 3400);
  }

  /** A soft, isolated tap on glass, routed through Ambience (not the effects slider). */
  private windowDrop() {
    const c = this.ctx!; const t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(330 + Math.random() * 110, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
    f.type = 'lowpass'; f.frequency.value = 650;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(f).connect(g).connect(this.amb);
    o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + 0.16);
  }

  sfxPlay(name: string, volume = 1) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    // avoid stacking the same sound repeatedly
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return;
    this.lastSfx[name] = now;
    const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    if (level <= 0) return;
    const tone = (freq: number, t0: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slide = 0) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, now + t0 + dur);
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.linearRampToValueAtTime(vol * level, now + t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      o.connect(g).connect(this.sfx);
      o.start(now + t0);
      o.stop(now + t0 + dur + 0.02);
    };
    const noiseHit = (t0: number, dur: number, freq: number, vol = 0.3) => {
      const s = c.createBufferSource();
      s.buffer = this.noise();
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol * level, now + t0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      s.connect(f).connect(g).connect(this.sfx);
      s.start(now + t0, Math.random());
      s.stop(now + t0 + dur);
    };
    switch (name) {
      case 'tap': tone(880, 0, 0.06, 'triangle', 0.15); break;
      case 'open': tone(660, 0, 0.08, 'triangle', 0.18); tone(990, 0.05, 0.1, 'triangle', 0.14); break;
      case 'close': tone(880, 0, 0.07, 'triangle', 0.14); tone(587, 0.05, 0.09, 'triangle', 0.12); break;
      case 'phone_open': tone(520, 0, 0.07, 'triangle', 0.12); tone(780, 0.05, 0.1, 'triangle', 0.1); noiseHit(0, 0.12, 1800, 0.05); break;
      case 'phone_close': tone(700, 0, 0.06, 'triangle', 0.1); tone(460, 0.05, 0.09, 'triangle', 0.08); break;
      case 'phone_tap': tone(1040, 0, 0.04, 'triangle', 0.08); break;
      case 'phone_swap': tone(660, 0, 0.05, 'sine', 0.1); tone(880, 0.04, 0.07, 'sine', 0.08); break;
      case 'phone_unlock': [784, 988, 1318].forEach((f, i) => tone(f, i * 0.07, 0.2, 'sine', 0.1)); break;
      case 'coin': tone(1318, 0, 0.08, 'square', 0.05); tone(1760, 0.06, 0.12, 'square', 0.045); tone(2637, 0.12, 0.28, 'sine', 0.05); break;
      case 'pickup': tone(784, 0, 0.07, 'triangle', 0.2); tone(1175, 0.06, 0.12, 'triangle', 0.18); break;
      case 'cut': noiseHit(0, 0.08, 3500, 0.5); tone(1400, 0, 0.04, 'sine', 0.08, 0.6); break;
      case 'place': tone(330, 0, 0.09, 'sine', 0.25, 0.7); noiseHit(0, 0.05, 900, 0.2); break;
      case 'rice': noiseHit(0, 0.07, 1400, 0.12); tone(520, 0, 0.05, 'sine', 0.04); break;
      case 'steam': tone(660, 0, 0.22, 'sine', 0.06, 1.4); noiseHit(0, 0.18, 1800, 0.08); break;
      case 'roll': noiseHit(0, 0.18, 700, 0.25); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.15)); tone(2093, 0.34, 0.5, 'sine', 0.05); tone(1568, 0.3, 0.5, 'sine', 0.04); break;
      case 'error': tone(220, 0, 0.12, 'triangle', 0.15); tone(196, 0.1, 0.16, 'triangle', 0.13); break;
      case 'splash': noiseHit(0, 0.35, 1200, 0.4); break;
      case 'bite': tone(600, 0, 0.05, 'square', 0.08); tone(600, 0.1, 0.05, 'square', 0.08); break;
      case 'door': noiseHit(0, 0.12, 400, 0.3); tone(180, 0, 0.12, 'sine', 0.2); break;
      case 'paper': noiseHit(0, 0.25, 2600, 0.18); noiseHit(0.2, 0.18, 3200, 0.12); break;
      case 'train': for (let i = 0; i < 8; i++) { noiseHit(i * 0.22, 0.08, 500, 0.22); noiseHit(i * 0.22 + 0.09, 0.06, 700, 0.14); } tone(392, 1.9, 0.5, 'triangle', 0.09); tone(330, 1.9, 0.5, 'triangle', 0.08); break;
      case 'step': noiseHit(0, 0.05, 650, 0.06); break;
      case 'step_grass': noiseHit(0, 0.07, 600, 0.05); noiseHit(0.02, 0.06, 420, 0.035); break;
      case 'step_wood': noiseHit(0, 0.04, 380, 0.07); tone(110 + Math.random() * 20, 0, 0.06, 'sine', 0.05); break;
      case 'step_stone': noiseHit(0, 0.04, 600, 0.07); tone(160 + Math.random() * 30, 0, 0.05, 'sine', 0.03); break;
      case 'step_sand': noiseHit(0, 0.09, 520, 0.04); break;
      case 'step_wet': noiseHit(0, 0.1, 520, 0.075); noiseHit(0.025, 0.07, 330, 0.035); tone(120, 0, 0.07, 'sine', 0.025, 0.7); break;
      case 'bell': tone(1318, 0, 0.5, 'sine', 0.1); tone(1760, 0.04, 0.6, 'sine', 0.07); break;
      case 'blip': tone(520, 0, 0.035, 'triangle', 0.05); break;
      case 'clue': [784, 988, 1318].forEach((f, i) => tone(f, i * 0.1, 0.3, 'sine', 0.15)); break;
      case 'sparkle': [1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.05, 0.15, 'sine', 0.08)); break;
      case 'water': tone(500, 0, 0.12, 'sine', 0.12, 1.6); break;
      case 'camera': noiseHit(0, 0.05, 4000, 0.4); tone(2000, 0.05, 0.05, 'square', 0.04); break;
    }
  }

  /** dialogue voice blip with per-character pitch */
  voice(pitch: number) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    if (this.lastSfx.voice && now - this.lastSfx.voice < 0.06) return;
    this.lastSfx.voice = now;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 330 * pitch * (0.95 + Math.random() * 0.1);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    o.connect(g).connect(this.sfx);
    o.start(now);
    o.stop(now + 0.06);
  }

  /** One syllable of a lead's voice. Silent steps and a too-soon repeat do nothing. */
  speak(id: string, step: number) {
    const note = voiceNote(id, step);
    const c = this.ctx;
    if (!note || !note.sound || step % note.every !== 0 || !c) return;
    const now = c.currentTime;
    const key = 'spk:' + id;
    if (key in this.lastSfx && now - this.lastSfx[key] < note.gap) return;
    this.lastSfx[key] = now;
    this.speakAt(note, 0);
  }

  /** A short phrase, used when the line appears all at once. */
  speakLine(id: string) {
    const want = voicePhraseCount(id);
    const c = this.ctx;
    if (!c || want <= 0) return;
    let played = 0;
    let lastWhen = 0;
    for (let step = 0; played < want && step < 80; step++) {
      const when = voiceWhen(id, step);
      const note = when == null ? null : voiceNote(id, step);
      if (when == null || !note) continue;
      this.speakAt(note, when);
      lastWhen = when;
      played++;
    }
    this.lastSfx['spk:' + id] = c.currentTime + lastWhen;
  }

  private speakAt(note: VoiceNote, delay: number) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + Math.max(0, delay);
    const attack = Math.min(Math.max(0.001, note.attack), note.dur * 0.8);
    const end = Math.max(note.dur, attack + 0.02);
    const env = (g: GainNode, vol: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, vol), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + end);
    };
    const tone = (freq: number, vol: number, slideTo: number) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = note.type;
      const f0 = Math.max(1, freq);
      o.frequency.setValueAtTime(f0, t);
      if (slideTo > 0 && Math.abs(slideTo - 1) > 0.001) o.frequency.exponentialRampToValueAtTime(Math.max(1, f0 * slideTo), t + end);
      env(g, vol);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + end + 0.02);
    };
    const slide = note.chirp > 1 ? note.chirp : note.slide;
    const boost = VOICE_BOOST;
    tone(note.freq, note.vol * boost, slide);
    if (note.harm > 0 && note.harmMix > 0) tone(note.freq * note.harm, note.vol * boost * note.harmMix, note.slide);
    if (note.noise > 0) {
      const s = c.createBufferSource();
      s.buffer = this.noise();
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(Math.max(40, note.freq), t);
      f.Q.setValueAtTime(3.2, t);
      const g = c.createGain();
      g.gain.setValueAtTime(note.noise * VOICE_BOOST, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + end);
      s.connect(f).connect(g).connect(this.sfx);
      s.start(t, Math.random());
      s.stop(t + end);
    }
  }
}

/** Voices were too quiet next to music and effects, and the low ones disappeared on small speakers. */
const VOICE_BOOST = 3.6;

export const audio = new AudioEngine();
export type { Track };
