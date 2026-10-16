/**
 * Visual-novel dialogue runner. Scenes are written as async functions using `say` and `choose`,
 * which keeps narrative content in data files (story/*) and the engine here.
 */
import { fillText } from './gender';
import type { Expr } from '../art/characters';
import { audio } from '../audio/audio';
import { hasVoice } from '../audio/voices';
import { bus } from '../core/events';
import { reportError } from '../core/errors';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { portraitSrc, speakerFace } from './speakerFace';
import { iconElement } from '../art/icons';
import { clock } from '../systems/time';
import { h, panel, uiRoot } from '../ui/dom';
import { skinIconEl } from '../ui/skin';

export interface LogEntry { who: string; text: string; }

const history: LogEntry[] = [];
let box: HTMLElement | null = null;
let catcher: HTMLElement | null = null;
let skipping = false;
let active = 0;
let sceneSeen = false;

/** Replace {name}, {restaurant} tokens */
export function fmt(t: string): string {
  const p = game.save.player;
  return fillText(t, p.name, p.restaurantName, p.appearance.hero?.gender ?? 'f');
}

function ensureBox() {
  if (box) return box;
  catcher = h('div', { class: 'dlg-catch' });
  box = h('div', { class: 'dlg-wrap' });
  uiRoot().append(catcher, box);
  return box;
}

function teardown() {
  box?.remove();
  catcher?.remove();
  box = null;
  catcher = null;
}

/** Wrap a scene so the world pauses and the box is cleaned up. `id` marks it as seen (skippable later). */
export async function runScene(id: string, fn: () => Promise<void>, opts?: { keepTime?: boolean }): Promise<void> {
  active++;
  const stopsTime = !opts?.keepTime;
  if (stopsTime) clock.pause();
  bus.emit('dialogue:start', { id });
  const seen = game.save.story.seenScenes.includes(id);
  const prevSeen = sceneSeen;
  sceneSeen = seen;
  let completed = false;
  try {
    await fn();
    completed = true;
  } catch (err) {
    reportError('dialogue:' + id, err);
  } finally {
    sceneSeen = prevSeen;
    if (completed && !game.save.story.seenScenes.includes(id) && !id.startsWith('talk')) {
      game.save.story.seenScenes.push(id);
      game.touch('scene');
    }
    active--;
    if (active <= 0) {
      active = 0;
      skipping = false;
      teardown();
    }
    if (stopsTime) clock.resume();
    bus.emit('dialogue:end', { id });
  }
}

export function inDialogue() {
  return active > 0;
}

function speakerInfo(who: string, expr: Expr) {
  const face = speakerFace(who);
  return { id: face.id, vkey: face.vkey ?? face.id, name: face.name, voice: face.voice, src: portraitSrc(face, expr) };
}

/** Show one line. Resolves after the player advances. */
export function say(who: string, text: string, expr: Expr = 'neutral'): Promise<void> {
  text = fmt(text);
  const info = speakerInfo(who, expr);
  history.push({ who: info.name, text });
  if (history.length > 200) history.shift();
  if (skipping) return Promise.resolve();
  const root = ensureBox();
  root.innerHTML = '';
  return new Promise((resolve) => {
    const txt = h('div', { class: 'text' });
    const portrait = h('img', { class: 'portrait', src: info.src, alt: info.name || 'Narración' });
    const next = h('div', { class: 'next' }, '▼');
    next.style.visibility = 'hidden';
    const tools = h(
      'div',
      { class: 'tools' },
      h('button', { class: 'log-btn', title: 'Historial', onclick: (e: Event) => { e.stopPropagation(); showLog(); } }, iconElement({ type: 'book', c1: '#b2585e' }), ' Historial'),
      sceneSeen ? h('button', { onclick: (e: Event) => { e.stopPropagation(); skipping = true; finish(); } }, 'Saltar escena') : null,
    );
    const dlg = h('div', { class: 'dlg has-portrait', role: 'dialog' }, info.name ? h('div', { class: 'name' }, info.name) : null, tools, portrait, h('div', { class: 'body' }, txt), next);
    root.append(dlg);
    let i = 0;
    let done = false;
    let timer = 0;
    const speed = settings.textSpeed;
    const complete = () => {
      clearInterval(timer);
      txt.textContent = text;
      done = true;
      next.style.visibility = 'visible';
    };
    const finish = () => {
      cleanup();
      audio.sfxPlay('tap');
      resolve();
    };
    if (speed <= 0) {
      if (hasVoice(info.vkey)) audio.speakLine(info.vkey);
      else if (info.vkey) audio.voice(info.voice);
      complete();
    } else {
      timer = window.setInterval(() => {
        i += 1;
        txt.textContent = text.slice(0, i);
        const ch = text[i - 1];
        if (ch && ch !== ' ') {
          if (hasVoice(info.vkey)) audio.speak(info.vkey, i);
          else if (i % 2 === 0) audio.voice(info.voice);
        }
        if (i >= text.length) complete();
      }, 1000 / speed);
    }
    const advance = (e?: Event) => {
      e?.preventDefault();
      if (!done) complete();
      else finish();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') advance(e);
    };
    dlg.addEventListener('pointerup', advance);
    catcher!.onpointerup = advance;
    window.addEventListener('keydown', key);
    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener('keydown', key);
      dlg.removeEventListener('pointerup', advance);
      if (catcher) catcher.onpointerup = null;
    };
  });
}

/** Present options; resolves with index. Choices are never skipped automatically. */
export interface ChooseOpts {
  /** one icon name per option (the HUD icon set), or null */
  icons?: (string | null)[];
  /** the index picked when she clicks outside the box, presses Escape or `away()` turns true */
  cancel?: number;
  /** polled while the choices are up: true means she walked off, so the menu closes */
  away?: () => boolean;
}

export function choose(options: string[], who = 'player', prompt?: string, opts?: ChooseOpts): Promise<number> {
  skipping = false;
  const root = ensureBox();
  root.innerHTML = '';
  const info = speakerInfo(who, 'neutral');
  return new Promise((resolve) => {
    const list = h('div', { class: 'choices' });
    let watch = 0;
    const finish = (i: number) => {
      history.push({ who: '→', text: fmt(options[i]) });
      window.removeEventListener('keydown', key);
      clearInterval(watch);
      audio.sfxPlay('tap');
      root.innerHTML = '';
      if (catcher) catcher.onpointerup = null;
      resolve(i);
    };
    options.forEach((o, i) =>
      list.append(
        h('button', { class: opts?.icons ? 'with-icon' : '', onclick: (e: Event) => { e.stopPropagation(); finish(i); } },
          opts?.icons?.[i] ? skinIconEl(opts.icons[i]!, 'choice-icon') : null,
          h('span', { class: 'choice-n' }, String(i + 1)), h('span', { class: 'choice-t' }, fmt(o))),
      ),
    );
    const buttons = () => [...list.querySelectorAll('button')];
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Escape' && opts?.cancel != null) { e.preventDefault(); finish(opts.cancel); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        (list.children[n - 1] as HTMLButtonElement).click();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const all = buttons();
      if (!all.length) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const next = i < 0 ? all[dir === 1 ? 0 : all.length - 1] : all[(i + dir + all.length) % all.length];
      next.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', key);
    if (catcher) catcher.onpointerup = opts?.cancel != null ? () => finish(opts.cancel!) : null;
    if (opts?.away) watch = window.setInterval(() => { if (opts.away!()) finish(opts.cancel ?? options.length - 1); }, 250);
    const portrait = h('img', { class: 'portrait', src: info.src, alt: info.name || 'Narración' });
    const dlg = h('div', { class: 'dlg has-portrait' }, info.name && who !== 'player' ? h('div', { class: 'name' }, info.name) : null, portrait, h('div', { class: 'body' }, prompt ? h('div', { class: 'text', style: { minHeight: '0' } }, fmt(prompt)) : null, list));
    root.append(dlg);
    buttons()[0]?.focus({ preventScroll: true });
  });
}

function showLog() {
  const body = h('div', { class: 'col' }, ...history.slice(-60).map((l) => h('div', null, l.who ? h('b', null, l.who + ': ') : null, l.text)));
  const p = panel({ title: 'Historial', body });
  p.body.scrollTop = p.body.scrollHeight;
}
