/**
 * The small pieces of screen the physical kitchen needs: the fridge picker, the cutting-board reflex bar and the order tickets.
 * None of them pauses the game or covers the kitchen: they are paper cards at the edge of the screen.
 */
import { iconElement, type IconSpec } from '../art/icons';
import { h } from './dom';
import { indicatorAt, judgeCut, type CutSpec, type CutVerdict } from '../galley/cut';
import { itemLabel } from '../galley/model';
import type { Ticket } from '../galley/tickets';
import './galley.css';

const root = () => document.getElementById('ui')!;

// ------------------------------------------------------------------ fridge picker
export interface FridgeChoice { id: string; name: string; icon: IconSpec; have: number; wanted: boolean }

let fridgeEl: HTMLElement | null = null;
let fridgeKeys: ((e: KeyboardEvent) => void) | null = null;

export function fridgeOpen(): boolean { return !!fridgeEl; }

export function closeFridgePicker() {
  fridgeEl?.remove();
  fridgeEl = null;
  if (fridgeKeys) window.removeEventListener('keydown', fridgeKeys, true);
  fridgeKeys = null;
}

export function openFridgePicker(choices: FridgeChoice[], onPick: (id: string) => void, onClose: () => void) {
  closeFridgePicker();
  const buttons: HTMLButtonElement[] = [];
  const grid = h('div', { class: 'gl-fridge-grid', role: 'listbox', 'aria-label': 'Ingredientes de la heladera' });
  choices.forEach((c, i) => {
    const b = h('button', { type: 'button', class: 'gl-choice' + (c.wanted ? ' wanted' : ''), role: 'option', title: c.wanted ? 'Lo piden los tickets' : c.name, onclick: () => onPick(c.id) },
      h('span', { class: 'gl-choice-icon' }, iconElement(c.icon)),
      h('span', { class: 'gl-choice-name' }, c.name),
      h('span', { class: 'gl-choice-n' }, `×${c.have}`),
      i < 9 ? h('kbd', null, String(i + 1)) : null) as HTMLButtonElement;
    buttons.push(b);
    grid.append(b);
  });
  const empty = h('p', { class: 'gl-empty' }, 'La heladera está vacía. Comprá ingredientes en el almacén de Taro.');
  fridgeEl = h('div', { class: 'gl-fridge paper', role: 'dialog', 'aria-label': 'Heladera' },
    h('div', { class: 'gl-fridge-head' }, h('b', null, 'Heladera'), h('button', { type: 'button', class: 'gl-x', 'aria-label': 'Cerrar', onclick: () => { closeFridgePicker(); onClose(); } }, '✕')),
    choices.length ? grid : empty);
  root().append(fridgeEl);
  buttons[0]?.focus({ preventScroll: true });
  fridgeKeys = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeFridgePicker(); onClose(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= Math.min(9, buttons.length)) { e.preventDefault(); e.stopImmediatePropagation(); onPick(choices[n - 1].id); return; }
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const cols = 4;
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (move && buttons.length) { e.preventDefault(); e.stopImmediatePropagation(); buttons[(Math.max(0, at) + move + buttons.length) % buttons.length].focus(); }
  };
  window.addEventListener('keydown', fridgeKeys, true);
}

// ------------------------------------------------------------------ cutting bar
export interface CutRun { cancel(): void }
let cutEl: HTMLElement | null = null;
let cutStop: (() => void) | null = null;

export function cutting(): boolean { return !!cutEl; }

/**
 * Shows the reflex bar. The indicator bounces until the player presses (Space, E, Enter, a tap on the card or the button),
 * or the limit passes (that counts as a miss). `onDone` fires once, immediately, with the verdict.
 */
export function runCutBar(spec: CutSpec, label: string, onDone: (verdict: CutVerdict) => void): CutRun {
  cutStop?.();
  const indicator = h('i', { class: 'gl-ind' });
  const zone = h('i', { class: 'gl-zone', style: { left: `${spec.start * 100}%`, width: `${spec.width * 100}%` } }, h('i', { class: 'gl-zone-core' }));
  const verdict = h('div', { class: 'gl-verdict', 'aria-live': 'assertive' }, '');
  const press = h('button', { type: 'button', class: 'btn primary gl-press' }, '¡Cortar!');
  cutEl = h('div', { class: 'gl-cut paper', role: 'dialog', 'aria-label': `Cortar ${label}` },
    h('div', { class: 'gl-cut-title' }, `Cortar ${label}`),
    h('div', { class: 'gl-bar' }, zone, indicator),
    verdict, press);
  root().append(cutEl);
  const el = cutEl;
  const t0 = performance.now();
  let raf = 0;
  let done = false;
  const finish = (v: CutVerdict, pos: number) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', keys, true);
    verdict.textContent = v === 'perfect' ? '¡Perfecto!' : v === 'good' ? '¡Bien!' : v === 'regular' ? 'Regular' : 'Uy…';
    verdict.className = 'gl-verdict show ' + v;
    indicator.style.left = `${pos * 100}%`;
    el.classList.add('done');
    onDone(v);
    window.setTimeout(() => { el.remove(); if (cutEl === el) cutEl = null; }, 420);
  };
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    if (t >= spec.limit) { finish('fail', indicatorAt(t, spec.speed)); return; }
    indicator.style.left = `${indicatorAt(t, spec.speed) * 100}%`;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    const t = (performance.now() - t0) / 1000;
    const pos = indicatorAt(t, spec.speed);
    finish(judgeCut(pos, spec), pos);
  };
  const keys = (e: KeyboardEvent) => {
    if (![' ', 'Enter', 'e', 'E', 'ArrowDown'].includes(e.key) || e.repeat) return;
    e.preventDefault(); e.stopImmediatePropagation();
    stop();
  };
  window.addEventListener('keydown', keys, true);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); stop(); });
  raf = requestAnimationFrame(frame);
  const cancel = () => { if (done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', keys, true); el.remove(); if (cutEl === el) cutEl = null; };
  cutStop = cancel;
  return { cancel };
}

// ------------------------------------------------------------------ tickets
let ticketsEl: HTMLElement | null = null;
let ticketsKey = '';

export function showTickets(list: Ticket[], visible: boolean, hint: string | null) {
  if (!visible || (!list.length && !hint)) { ticketsEl?.classList.add('hidden'); return; }
  const key = JSON.stringify(list.map((t) => [t.id, t.lines.map((l) => [l.recipe, l.waiting, l.ready]), Math.round(t.patience * 20), t.impatient])) + (hint ?? '');
  if (!ticketsEl) { ticketsEl = h('div', { class: 'gl-tickets', 'aria-label': 'Pedidos de la cocina' }); root().append(ticketsEl); }
  ticketsEl.classList.remove('hidden');
  if (key === ticketsKey) return;
  ticketsKey = key;
  const cards = list.slice(0, 3).map((t) => h('div', { class: 'gl-ticket paper' + (t.done ? ' done' : '') + (t.impatient ? ' late' : '') },
    h('div', { class: 'gl-ticket-head' }, h('b', null, t.label), h('span', { class: 'hint' }, t.who)),
    ...t.lines.map((l) => h('div', { class: 'gl-line' },
      h('span', { class: 'gl-qty' }, `${l.waiting + l.ready}×`),
      h('span', { class: 'gl-name' }, l.name),
      h('span', { class: 'gl-state' + (l.waiting ? '' : ' ok') }, l.waiting ? (l.ready ? `${l.ready} listo` : 'pendiente') : '✓ en el mostrador'),
      h('div', { class: 'gl-needs' }, l.needs.map((n) => `${n.count > 1 ? n.count + '× ' : ''}${itemLabel({ kind: 'ing', uid: 0, ing: n.ing, form: n.form, q: 2 })}`).join(' · ')))),
    h('div', { class: 'gl-patience', role: 'img', 'aria-label': `Paciencia ${Math.round(t.patience * 100)}%` }, h('i', { style: { width: `${Math.round(t.patience * 100)}%` } }))));
  const more = list.length > 3 ? [h('div', { class: 'gl-more' }, `+${list.length - 3} más`)] : [];
  ticketsEl.replaceChildren(...cards, ...more, ...(hint ? [h('div', { class: 'gl-hint paper' }, hint)] : []));
}

export function removeGalleyUi() {
  closeFridgePicker();
  cutStop?.();
  cutEl?.remove(); cutEl = null;
  ticketsEl?.remove(); ticketsEl = null; ticketsKey = '';
}

