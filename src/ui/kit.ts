/**
 * Small building blocks shared by every menu so they look and behave the same: tab bar, segmented choice, switch,
 * titled section, setting row, chip and empty state. Pixel-art look comes from styles.css (".ui2" block at the end).
 */
import { audio } from '../audio/audio';
import { h } from './dom';
import { skinIconEl } from './skin';

export interface TabSpec { label: string; icon?: string; badge?: string | number }

/** Horizontal tab bar that scrolls instead of wrapping. On narrow screens only the open tab keeps its words. */
export function tabBar(items: (string | TabSpec)[], onPick: (i: number) => void, start = 0): HTMLElement {
  const specs: TabSpec[] = items.map((t) => (typeof t === 'string' ? { label: t } : t));
  const bar = h('div', { class: 'tabbar', role: 'tablist' });
  const btns = specs.map((t, i) => {
    const b = h('button', {
      type: 'button', class: 'tab' + (i === start ? ' active' : ''), role: 'tab', 'aria-selected': i === start ? 'true' : 'false', 'aria-label': t.label, title: t.label,
      onclick: () => pick(i),
    }, t.icon ? skinIconEl(t.icon) : null, h('span', { class: 'tl' }, t.label), t.badge ? h('span', { class: 'tbadge' }, String(t.badge)) : null) as HTMLButtonElement;
    return b;
  });
  function pick(i: number, silent = false) {
    btns.forEach((b, j) => { b.classList.toggle('active', j === i); b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
    btns[i].scrollIntoView?.({ block: 'nearest', inline: 'center' });
    if (!silent) audio.sfxPlay('tap');
    onPick(i);
  }
  bar.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
    const cur = btns.findIndex((b) => b.classList.contains('active'));
    const next = Math.max(0, Math.min(btns.length - 1, cur + (k === 'ArrowRight' ? 1 : -1)));
    if (next !== cur) { pick(next); btns[next].focus(); }
    e.preventDefault();
  });
  bar.append(...btns);
  // the open tab starts in view (a long bar scrolls)
  requestAnimationFrame(() => btns[start]?.scrollIntoView?.({ block: 'nearest', inline: 'center' }));
  return bar;
}

/** One-of-many choice drawn as a joined row of big buttons. */
export function seg<T extends string | number>(opts: [T, string][], get: () => T, set: (v: T) => void, label = ''): HTMLElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  // h() assigns style via Object.assign, which drops custom properties: set --n directly.
  wrap.style.setProperty('--n', String(opts.length));
  wrap.dataset.n = String(opts.length);
  const draw = () => {
    wrap.replaceChildren(...opts.map(([v, name]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': get() === v ? 'true' : 'false', 'aria-pressed': get() === v ? 'true' : 'false',
      onclick: () => { set(v); audio.sfxPlay('tap'); draw(); },
    }, name)));
  };
  draw();
  return wrap;
}

/** On/off switch. */
export function switchEl(get: () => boolean, set: (v: boolean) => void, label: string): HTMLElement {
  const b = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': label }, h('i')) as HTMLButtonElement;
  const draw = () => { b.setAttribute('aria-checked', get() ? 'true' : 'false'); b.dataset.on = get() ? '1' : '0'; };
  b.onclick = () => { set(!get()); audio.sfxPlay('tap'); draw(); };
  draw();
  return b;
}

/** A titled block of related settings or facts. */
export function section(title: string, icon: string | null, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'sect' }, h('h3', null, icon ? skinIconEl(icon) : null, title), ...children);
}

/** A labelled setting: words on the left, the control on the right (or below on a phone). */
export function setting(label: string, hint: string, control: HTMLElement, stacked = false): HTMLElement {
  return h('div', { class: 'set' + (stacked ? ' stacked' : '') }, h('div', { class: 'set-text' }, h('b', null, label), hint ? h('div', { class: 'hint' }, hint) : null), h('div', { class: 'set-ctl' }, control));
}

export function chip(text: string | number, kind: '' | 'gold' | 'sage' | 'rose' | 'blue' = '', icon?: string): HTMLElement {
  return h('span', { class: 'chip' + (kind ? ' ' + kind : '') }, icon ? skinIconEl(icon) : null, String(text));
}

export function emptyState(text: string, icon = 'bag'): HTMLElement {
  return h('div', { class: 'empty' }, skinIconEl(icon), h('p', null, text));
}
