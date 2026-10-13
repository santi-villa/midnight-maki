/**
 * Original synthesized audio (no external files): soft SFX, generative lo-fi music loops and ambience.
 * Everything is gated behind the first user gesture, as browsers require.
 */
import { settings } from '../core/settings';
import { bus } from '../core/events';
import { reportError, runTask } from '../core/errors';

type Track = 'title' | 'town' | 'restaurant' | 'restaurant_night' | 'kitchen' | 'home' | 'forest' | 'beach' | 'garden' | 'market' | 'mystery' | 'stars' | 'festival' | 'emotional' | 'intro' | 'none';

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
}

const PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const MIYAKO = [0, 1, 5, 7, 8]; // in-scale japanese flavour

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
  title: { bpm: 70, scale: PENTA, root: 57, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'piano', density: 0.35, bass: true, swing: 0.1 },
  town: { bpm: 84, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 17]], lead: 'pluck', density: 0.5, bass: true, swing: 0.15 },
  restaurant: { bpm: 78, scale: PENTA, root: 62, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-1, 2, 5, 9], [4, 7, 11, 14]], lead: 'piano', density: 0.45, bass: true, swing: 0.2 },
  kitchen: { bpm: 68, scale: MIYAKO, root: 60, chords: [[0, 7, 12], [5, 12, 17], [-2, 5, 10], [0, 7, 12]], lead: 'pluck', density: 0.28, bass: true, swing: 0.05 },
  restaurant_night: { bpm: 66, scale: PENTA, root: 57, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], lead: 'piano', density: 0.3, bass: true, swing: 0.2 },
  home: { bpm: 64, scale: PENTA, root: 60, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: 'bell', density: 0.25, bass: false, swing: 0.1 },
  forest: { bpm: 72, scale: MIYAKO, root: 57, chords: [[0, 7, 12], [1, 8, 13], [-2, 5, 10], [0, 7, 12]], lead: 'flute', density: 0.3, bass: true, swing: 0 },
  beach: { bpm: 80, scale: PENTA, root: 65, chords: [[0, 4, 7, 9], [5, 9, 12, 14], [2, 5, 9, 12], [7, 11, 14, 16]], lead: 'pluck', density: 0.4, bass: true, swing: 0.25 },
  garden: { bpm: 70, scale: PENTA, root: 64, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [0, 4, 7]], lead: 'bell', density: 0.35, bass: false, swing: 0.1 },
  market: { bpm: 92, scale: MIYAKO, root: 62, chords: [[0, 7, 12], [5, 12, 17], [1, 8, 13], [0, 7, 12]], lead: 'pluck', density: 0.55, bass: true, swing: 0.1 },
  mystery: { bpm: 60, scale: MINOR_PENTA, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [-1, 2, 7]], lead: 'bell', density: 0.2, bass: true, swing: 0 },
  stars: { bpm: 58, scale: PENTA, root: 64, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 18]], lead: 'bell', density: 0.3, bass: false, swing: 0 },
  festival: { bpm: 100, scale: PENTA, root: 62, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'flute', density: 0.6, bass: true, swing: 0.15 },
  intro: { bpm: 60, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], lead: 'piano', density: 0.25, bass: true, swing: 0 },
  emotional: { bpm: 60, scale: PENTA, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], lead: 'piano', density: 0.25, bass: true, swing: 0 },
};

/** Composed themes (degrees index the track scale; values >= 5 wrap to the next octave). */
const MELODIES: Partial<Record<Exclude<Track, 'none'>, string>> = {
  title:      '4 - 3 - 2 - 1 2 | 3 - - - . . 2 1 | 0 - 1 - 2 - 4 3 | 2 - - - - - . . ',
  town:       '0 2 4 2 3 - 2 1 | 2 - 0 - . 1 2 3 | 4 - 5 4 3 2 1 2 | 0 - - - . . . . ',
  restaurant: '2 - 4 - 5 4 2 - | 3 - 2 1 0 - . . | 1 2 3 - 4 - 3 2 | 1 - - - 0 - . . ',
  kitchen:    '0 - 2 - 4 - 3 2 | 1 - - - 0 - . . | 2 - 3 - 4 - 2 - | 0 - - - - - . . ',
  restaurant_night: '4 - - 3 2 - - . | 3 - - 2 1 - . . | 0 - 2 - 3 - 4 - | 2 - - - - - . . ',
  home:       '0 - 2 - 4 - - . | 3 - 2 - 1 - - . | 2 - 1 - 0 - 2 - | 1 - - - - - . . ',
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
const ARP: Partial<Record<Exclude<Track, 'none'>, boolean>> = { title: true, town: true, restaurant: true, restaurant_night: true, kitchen: true, home: true, garden: true, stars: true, emotional: true, intro: true, beach: true };

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
const SONG_MATCH: Partial<Record<Track, RegExp>> = { title: /menu|title|principal/i, intro: /intro/i, kitchen: /kitchen|cocina/i };

function songURL(track: Track): string | null {
  const re = SONG_MATCH[track];
  if (!re) return null;
  const hit = Object.entries(MUSIC_FILES).find(([name]) => re.test(name.split('/').pop() ?? ''));
  return hit ? hit[1] : null;
}

class AudioEngine {
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
  private ambSrc: AudioBufferSourceNode | null = null;
  private ambKind = '';
  private noiseBuf: AudioBuffer | null = null;
  private pendingTrack: Track = 'none';
  private lastSfx: Record<string, number> = {};

  private badSongs = new Set<Track>();
  private custom: { track: Track; el: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode; starting: boolean; fallback: (err?: unknown) => void } | null = null;

  /** Streams the custom song for a track (no big decode in memory). Returns false when there is none. */
  private startCustom(track: Track): boolean {
    const c = this.ctx;
    const url = songURL(track);
    if (!c || !url || this.badSongs.has(track)) return false;
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
      reportError('audio:custom:' + track, err ?? new Error('Unavailable music file'), false);
      this.badSongs.add(track);
      this.stopCustom(true);
      this.current = 'none'; // unreadable file: bring the generated tune back
      this.play(track);
    };
    me.fallback = fallback;
    el.addEventListener('error', () => fallback(), { once: true });
    this.tryCustom();
    return true;
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
        void runTask('audio:suspend', () => this.ctx!.suspend(), false);
      } else this.unlock();
    });
    if (this.pendingTrack !== 'none') this.play(this.pendingTrack);
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
      if (def.bass && inBar === 4) this.note(def.root + chord[0] - 24 + (this.rng() < 0.5 ? 7 : 0), t, eighth * 3, 'bass', 0.09);
      const melody = MELODIES[this.current as Exclude<Track, 'none'>];
      if (melody) {
        const mel = parseMelody(melody);
        const pass = Math.floor(this.step / mel.length);
        const i = this.step % mel.length;
        const tok = mel[i];
        if (typeof tok === 'number') {
          let len = 1;
          while (mel[(i + len) % mel.length] === '-' && len < 8) len++;
          const n = def.scale.length;
          const deg = def.scale[((tok % n) + n) % n] + Math.floor(tok / n) * 12;
          // every other pass the theme rises an octave on its last half, for variety
          const lift = pass % 2 === 1 && i >= mel.length / 2 ? 12 : 0;
          this.note(def.root + deg + lift, t, eighth * len * 0.95, def.lead, 0.1);
        } else if (tok === null && pass % 2 === 1 && this.rng() < def.density * 0.5) {
          // gentle improvised fill in the rests of the second pass
          const deg = def.scale[Math.floor(this.rng() * def.scale.length)];
          this.note(def.root + deg + 12, t, eighth * 1.4, def.lead, 0.05);
        }
      } else if (this.rng() < def.density && inBar !== 7) {
        const deg = def.scale[Math.floor(this.rng() * def.scale.length)];
        const oct = this.rng() < 0.3 ? 12 : 0;
        this.note(def.root + deg + oct, t, eighth * (this.rng() < 0.3 ? 3 : 1.6), def.lead, 0.09);
      }
      if (ARP[this.current as Exclude<Track, 'none'>] && inBar % 2 === 1) {
        const tone = chord[Math.floor(inBar / 2) % chord.length];
        this.note(def.root + tone - 12, t, eighth * 1.2, 'pluck', 0.035);
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

  /** looping ambience bed: 'rain' | 'waves' | 'night' | 'none' */
  ambience(kind: string) {
    if (!this.ctx || kind === this.ambKind) return;
    this.ambKind = kind;
    if (this.ambSrc) {
      try {
        this.ambSrc.stop();
      } catch {
        /* already stopped */
      }
      this.ambSrc = null;
    }
    if (kind === 'none') return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise();
    s.loop = true;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    if (kind === 'rain') {
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.4;
      g.gain.value = 0.5;
    } else if (kind === 'waves') {
      f.type = 'lowpass';
      f.frequency.value = 600;
      g.gain.value = 0.6;
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.12;
      lg.gain.value = 0.35;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
    } else {
      f.type = 'lowpass';
      f.frequency.value = 300;
      g.gain.value = 0.25;
    }
    s.connect(f).connect(g).connect(this.amb);
    s.start();
    this.ambSrc = s;
  }

  sfxPlay(name: string) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    // avoid stacking the same sound repeatedly
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return;
    this.lastSfx[name] = now;
    const tone = (freq: number, t0: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slide = 0) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, now + t0 + dur);
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.linearRampToValueAtTime(vol, now + t0 + 0.01);
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
      g.gain.setValueAtTime(vol, now + t0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      s.connect(f).connect(g).connect(this.sfx);
      s.start(now + t0, Math.random());
      s.stop(now + t0 + dur);
    };
    switch (name) {
      case 'tap': tone(880, 0, 0.06, 'triangle', 0.15); break;
      case 'open': tone(660, 0, 0.08, 'triangle', 0.18); tone(990, 0.05, 0.1, 'triangle', 0.14); break;
      case 'close': tone(880, 0, 0.07, 'triangle', 0.14); tone(587, 0.05, 0.09, 'triangle', 0.12); break;
      case 'coin': tone(1318, 0, 0.08, 'square', 0.06); tone(1760, 0.06, 0.18, 'square', 0.05); break;
      case 'pickup': tone(784, 0, 0.07, 'triangle', 0.2); tone(1175, 0.06, 0.12, 'triangle', 0.18); break;
      case 'cut': noiseHit(0, 0.08, 3500, 0.5); tone(1400, 0, 0.04, 'sine', 0.08, 0.6); break;
      case 'place': tone(330, 0, 0.09, 'sine', 0.25, 0.7); noiseHit(0, 0.05, 900, 0.2); break;
      case 'rice': noiseHit(0, 0.07, 1400, 0.12); tone(520, 0, 0.05, 'sine', 0.04); break;
      case 'steam': tone(660, 0, 0.22, 'sine', 0.06, 1.4); noiseHit(0, 0.18, 1800, 0.08); break;
      case 'roll': noiseHit(0, 0.18, 700, 0.25); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.15)); break;
      case 'error': tone(220, 0, 0.12, 'triangle', 0.15); tone(196, 0.1, 0.16, 'triangle', 0.13); break;
      case 'splash': noiseHit(0, 0.35, 1200, 0.4); break;
      case 'bite': tone(600, 0, 0.05, 'square', 0.08); tone(600, 0.1, 0.05, 'square', 0.08); break;
      case 'door': noiseHit(0, 0.12, 400, 0.3); tone(180, 0, 0.12, 'sine', 0.2); break;
      case 'paper': noiseHit(0, 0.25, 2600, 0.18); noiseHit(0.2, 0.18, 3200, 0.12); break;
      case 'train': for (let i = 0; i < 8; i++) { noiseHit(i * 0.22, 0.08, 500, 0.22); noiseHit(i * 0.22 + 0.09, 0.06, 700, 0.14); } tone(392, 1.9, 0.5, 'triangle', 0.09); tone(330, 1.9, 0.5, 'triangle', 0.08); break;
      case 'step': noiseHit(0, 0.04, 1500, 0.06); break;
      case 'step_grass': noiseHit(0, 0.06, 2600, 0.05); noiseHit(0.02, 0.05, 1800, 0.035); break;
      case 'step_wood': noiseHit(0, 0.035, 700, 0.08); tone(150 + Math.random() * 30, 0, 0.05, 'triangle', 0.05); break;
      case 'step_stone': noiseHit(0, 0.025, 2400, 0.07); tone(900 + Math.random() * 200, 0, 0.02, 'square', 0.015); break;
      case 'step_sand': noiseHit(0, 0.08, 1100, 0.04); break;
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
}

export const audio = new AudioEngine();
export type { Track };
