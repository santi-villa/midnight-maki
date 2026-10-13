/**
 * Layered intro audio. Beds loop once each and crossfade. Shots play a single copy.
 * Levels follow the ambience and effects sliders. Music stays on the main audio engine.
 */
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { reportError } from '../core/errors';
import { settings } from '../core/settings';
import type { IntroCue } from './introScript';
import { introSoundUrl, type IntroSoundId } from './introSounds';

interface Playing {
  el: HTMLAudioElement;
  base: number;
  raf: number;
}

const beds = new Map<IntroSoundId, Playing>();
const shots = new Map<IntroSoundId, Playing>();
const once = new Set<IntroSoundId>();
let hooked = false;
let unhook = () => {};
let gestureKick: (() => void) | null = null;
const pending: Array<() => void> = [];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Beds stay under the music. Shots use the effects slider, with a ceiling so files are not harsh. */
function level(kind: 'bed' | 'shot', relative: number): number {
  const slider = kind === 'bed' ? settings.ambience : settings.sfx;
  const ceiling = kind === 'bed' ? 0.55 : 0.65;
  return clamp01(slider * relative * ceiling);
}

function armGesture(retry: () => void) {
  pending.push(retry);
  if (gestureKick) return;
  const kick = () => {
    gestureKick = null;
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    audio.unlock();
    const jobs = pending.splice(0);
    for (const job of jobs) job();
  };
  gestureKick = kick;
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
}

function clearGesture() {
  pending.length = 0;
  if (!gestureKick) return;
  window.removeEventListener('pointerdown', gestureKick);
  window.removeEventListener('keydown', gestureKick);
  gestureKick = null;
}

function releaseEl(el: HTMLAudioElement) {
  el.pause();
  el.removeAttribute('src');
  try {
    el.load();
  } catch {
    /* already detached */
  }
}

function ramp(play: Playing, to: number, seconds: number, done?: () => void) {
  if (play.raf) cancelAnimationFrame(play.raf);
  const from = play.el.volume;
  const ms = Math.max(0, seconds) * 1000;
  if (ms < 40) {
    play.el.volume = to;
    done?.();
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = clamp01((now - t0) / ms);
    play.el.volume = clamp01(from + (to - from) * k);
    if (k < 1) play.raf = requestAnimationFrame(step);
    else {
      play.raf = 0;
      done?.();
    }
  };
  play.raf = requestAnimationFrame(step);
}

function ensureHook() {
  if (hooked) return;
  hooked = true;
  unhook = bus.on('settings:changed', () => {
    for (const bed of beds.values()) {
      if (bed.base <= 0) continue;
      const to = level('bed', bed.base);
      ramp(bed, to, 0.2, () => {
        if (to <= 0.001) bed.el.pause();
        else if (bed.el.paused) playFile(bed.el);
      });
    }
  });
}

function playFile(el: HTMLAudioElement) {
  let failed = false;
  const live = () => !failed && !!el.getAttribute('src') &&
    [...beds.values(), ...shots.values()].some((p) => p.el === el);
  const onFailure = (err: unknown) => {
    if (!live()) return; // an aborted play after cleanup is expected
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      armGesture(go); // every retry goes through the same rejection handler
    } else {
      failed = true;
      reportError('audio:intro-file', err, false);
      releaseEl(el);
    }
  };
  const go = () => {
    if (!live()) return;
    audio.unlock();
    try { void el.play().catch(onFailure); }
    catch (err) { onFailure(err); }
  };
  go();
}

export function applyIntroCue(cue: IntroCue) {
  ensureHook();
  audio.unlock();
  if (cue.stop || (cue.kind === 'shot' && cue.volume <= 0)) {
    const shot = shots.get(cue.sound);
    if (!shot) return;
    ramp(shot, 0, cue.fade ?? 1.5, () => {
      if (shots.get(cue.sound) !== shot) return;
      if (shot.raf) cancelAnimationFrame(shot.raf);
      releaseEl(shot.el);
      shots.delete(cue.sound);
    });
    return;
  }
  if (cue.kind === 'bed') setBed(cue.sound, cue.volume, cue.fade ?? 1.5);
  else playIntroShot(cue.sound, cue.volume, cue.hold);
}

function setBed(id: IntroSoundId, relative: number, fade: number) {
  const existing = beds.get(id);
  if (existing) {
    existing.base = relative;
    const to = level('bed', relative);
    if (relative > 0 && existing.el.paused) playFile(existing.el);
    ramp(existing, to, fade, () => {
      if (beds.get(id) !== existing) return;
      if (relative <= 0) {
        if (existing.raf) cancelAnimationFrame(existing.raf);
        releaseEl(existing.el);
        beds.delete(id);
      } else if (to <= 0.001) existing.el.pause();
    });
    return;
  }
  if (relative <= 0) return;
  const el = new Audio(introSoundUrl(id));
  el.loop = true;
  el.preload = 'auto';
  el.volume = 0;
  const play: Playing = { el, base: relative, raf: 0 };
  beds.set(id, play);
  playFile(el);
  ramp(play, level('bed', relative), fade);
}

/** One copy of a short effect. A new call replaces the previous copy of the same sound. */
export function playIntroShot(id: IntroSoundId, volume: number, hold?: number) {
  ensureHook();
  const prev = shots.get(id);
  if (prev) {
    if (prev.raf) cancelAnimationFrame(prev.raf);
    releaseEl(prev.el);
    shots.delete(id);
  }
  const el = new Audio(introSoundUrl(id));
  el.loop = false;
  el.preload = 'auto';
  el.volume = level('shot', volume);
  const play: Playing = { el, base: volume, raf: 0 };
  shots.set(id, play);
  el.addEventListener('ended', () => {
    if (shots.get(id) !== play) return;
    releaseEl(el);
    shots.delete(id);
  });
  playFile(el);
  if (hold && hold > 0) {
    window.setTimeout(() => {
      if (shots.get(id) !== play) return;
      ramp(play, 0, 0.35, () => {
        if (shots.get(id) !== play) return;
        releaseEl(el);
        shots.delete(id);
      });
    }, hold * 1000);
  }
}

/** Story beats outside the picture sequence: the door and the jar, each at most once. */
export function playIntroShotOnce(id: IntroSoundId, volume: number, hold?: number) {
  if (once.has(id)) return;
  once.add(id);
  playIntroShot(id, volume, hold);
}

/** Stop every intro layer and free the files. Safe to call when nothing is playing. */
export function stopIntroAudio(fade = 0.4): Promise<void> {
  const layers = [...beds.values(), ...shots.values()];
  beds.clear();
  shots.clear();
  clearGesture();
  if (hooked) {
    unhook();
    hooked = false;
  }
  if (!layers.length || fade <= 0) {
    for (const layer of layers) {
      if (layer.raf) cancelAnimationFrame(layer.raf);
      releaseEl(layer.el);
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let left = layers.length;
    const finish = () => {
      left--;
      if (left > 0) return;
      resolve();
    };
    for (const layer of layers) {
      ramp(layer, 0, fade, () => {
        if (layer.raf) cancelAnimationFrame(layer.raf);
        releaseEl(layer.el);
        finish();
      });
    }
    window.setTimeout(() => {
      for (const layer of layers) {
        if (layer.raf) cancelAnimationFrame(layer.raf);
        releaseEl(layer.el);
      }
      resolve();
    }, fade * 1000 + 80);
  });
}
