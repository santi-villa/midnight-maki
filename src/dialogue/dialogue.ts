/**
 * Visual-novel dialogue runner. Scenes are written as async functions using `say` and `choose`,
 * which keeps narrative content in data files (story/*) and the engine here.
 */
import type { Expr } from '../art/characters';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { reportError } from '../core/errors';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { displayName, portraitURL } from '../systems/appearance';
import { clock } from '../systems/time';
import { h, panel, uiRoot } from '../ui/dom';

export interface LogEntry { who: string; text: string; }

const history: LogEntry[] = [];
let box: HTMLElement | null = null;
let catcher: HTMLElement | null = null;
let skipping = false;
let active = 0;
let sceneSeen = false;

/** Replace {name}, {restaurant} tokens */
export function fmt(t: string): string {
  return t.replace(/\{name\}/g, game.save.player.name).replace(/\{restaurant\}/g, game.save.player.restaurantName);
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
export async function runScene(id: string, fn: () => Promise<void>): Promise<void> {
  active++;
  clock.pause();
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
    clock.resume();
    bus.emit('dialogue:end', { id });
  }
}

export function inDialogue() {
  return active > 0;
}

function speakerInfo(who: string) {
  if (who === 'narr') return { name: '', portrait: null as string | null, voice: 1 };
  if (who === 'player') return { name: game.save.player.name, portrait: null, voice: 1.2 };
  if (who.startsWith('?')) {
    // '?Visible name|charId' shows a portrait under a different (unknown yet) name
    const [nm, pid] = who.slice(1).split('|');
    return { name: nm || '???', portrait: pid && CHAR_BY_ID[pid] ? pid : null, voice: CHAR_BY_ID[pid]?.voice ?? 0.9 };
  }
  const def = CHAR_BY_ID[who];
  return { name: displayName(who) || who, portrait: def ? who : null, voice: def?.voice ?? 1 };
}

/** Show one line. Resolves after the player advances. */
export function say(who: string, text: string, expr: Expr = 'neutral'): Promise<void> {
  text = fmt(text);
  const info = speakerInfo(who);
  history.push({ who: info.name, text });
  if (history.length > 200) history.shift();
  if (skipping) return Promise.resolve();
  const root = ensureBox();
  root.innerHTML = '';
  return new Promise((resolve) => {
    const txt = h('div', { class: 'text' });
    const portrait = info.portrait ? h('img', { class: 'portrait', src: portraitURL(info.portrait, expr), alt: info.name }) : h('div', { class: 'portrait none' });
    const next = h('div', { class: 'next' }, '▼');
    next.style.visibility = 'hidden';
    const tools = h(
      'div',
      { class: 'tools' },
      h('button', { onclick: (e: Event) => { e.stopPropagation(); showLog(); } }, 'Historial'),
      sceneSeen ? h('button', { onclick: (e: Event) => { e.stopPropagation(); skipping = true; finish(); } }, 'Saltar escena') : null,
    );
    const dlg = h('div', { class: 'dlg', role: 'dialog' }, info.name ? h('div', { class: 'name' }, info.name) : null, tools, portrait, h('div', { class: 'body' }, txt), next);
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
    if (speed <= 0) complete();
    else {
      timer = window.setInterval(() => {
        i += 1;
        txt.textContent = text.slice(0, i);
        if (i % 2 === 0 && text[i - 1] !== ' ') audio.voice(info.voice);
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
export function choose(options: string[], who = 'player', prompt?: string): Promise<number> {
  skipping = false;
  const root = ensureBox();
  root.innerHTML = '';
  const info = speakerInfo(who);
  return new Promise((resolve) => {
    const list = h('div', { class: 'choices' });
    options.forEach((o, i) =>
      list.append(
        h('button', {
          onclick: (e: Event) => {
            e.stopPropagation();
            history.push({ who: '→', text: fmt(o) });
            window.removeEventListener('keydown', key);
            audio.sfxPlay('tap');
            root.innerHTML = '';
            resolve(i);
          },
        }, `${i + 1}. ${fmt(o)}`),
      ),
    );
    const key = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        (list.children[n - 1] as HTMLButtonElement).click();
      }
    };
    window.addEventListener('keydown', key);
    if (catcher) catcher.onpointerup = null;
    const dlg = h('div', { class: 'dlg' }, info.name && who !== 'player' ? h('div', { class: 'name' }, info.name) : null, h('div', { class: 'body' }, prompt ? h('div', { class: 'text', style: { minHeight: '0' } }, fmt(prompt)) : null, list));
    root.append(dlg);
  });
}

function showLog() {
  const body = h('div', { class: 'col' }, ...history.slice(-60).map((l) => h('div', null, l.who ? h('b', null, l.who + ': ') : null, l.text)));
  const p = panel({ title: 'Historial', body });
  p.body.scrollTop = p.body.scrollHeight;
}
