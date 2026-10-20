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
export function runCutBar(spec: CutSpec, label: string, onDone: (verdict: CutVerdict) => void, step?: { n: number; of: number }): CutRun {
  cutStop?.();
  const indicator = h('i', { class: 'gl-ind' });
  const zone = h('i', { class: 'gl-zone', style: { left: `${spec.start * 100}%`, width: `${spec.width * 100}%` } }, h('i', { class: 'gl-zone-core' }));
  const verdict = h('div', { class: 'gl-verdict', 'aria-live': 'assertive' }, '');
  const press = h('button', { type: 'button', class: 'btn primary gl-press' }, '¡Cortar!');
  cutEl = h('div', { class: 'gl-cut paper', role: 'dialog', 'aria-label': `Cortar ${label}` },
    h('div', { class: 'gl-cut-title' }, `Cortar ${label}`, step ? h('span', { class: 'gl-cut-step' }, ` · corte ${step.n} de ${step.of}`) : null),
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
    window.setTimeout(() => { el.remove(); if (cutEl === el) cutEl = null; }, step && step.n < step.of ? 220 : 420);
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
/** tickets the player opened to read the ingredients */
const ticketsExpanded = new Set<string>();
/** The orders fold into a small chip ("Pedidos 3 ▾") so they do not cover the kitchen; the choice is remembered. */
let ticketsOpen = (() => { try { return localStorage.getItem('mm_ticketsopen') === '1'; } catch { return false; } })();

export function showTickets(list: Ticket[], visible: boolean, hint: string | null) {
  if (!visible || (!list.length && !hint)) { ticketsEl?.classList.add('hidden'); return; }
  const key = JSON.stringify(list.map((t) => [t.id, t.lines.map((l) => [l.recipe, l.waiting, l.ready]), Math.round(t.patience * 20), t.impatient])) + (hint ?? '') + ticketsOpen + [...ticketsExpanded].join(',');
  if (!ticketsEl) { ticketsEl = h('div', { class: 'gl-tickets', 'aria-label': 'Pedidos de la cocina' }); root().append(ticketsEl); }
  ticketsEl.classList.remove('hidden');
  // sit right under the round buttons (the mission line is on the other side), wherever they end up on this screen
  const below = ['.hud-buttons'].map((q) => document.querySelector<HTMLElement>(q)).filter((el): el is HTMLElement => !!el && el.offsetParent !== null).reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom), 0);
  if (below > 0) ticketsEl.style.top = `${Math.round(below + 3)}px`;
  // as wide as the round buttons: from the bag to the pause button
  const btns = [...document.querySelectorAll<HTMLElement>('.hud-buttons .icon-btn')].filter((el) => el.offsetParent !== null);
  if (btns.length) {
    const left = Math.min(...btns.map((b) => b.getBoundingClientRect().left)), right = Math.max(...btns.map((b) => b.getBoundingClientRect().right));
    ticketsEl.style.left = `${Math.round(left)}px`; ticketsEl.style.width = `${Math.round(right - left)}px`; ticketsEl.style.right = 'auto';
  }
  if (key === ticketsKey) return;
  ticketsKey = key;
  const pending = list.filter((t) => !t.done).length;
  const late = list.some((t) => t.impatient && !t.done);
  const chip = list.length ? h('button', {
    type: 'button', class: 'gl-orders-chip paper' + (late ? ' late' : ''), 'aria-expanded': String(ticketsOpen), 'aria-label': `Pedidos: ${pending} pendientes`,
    onclick: () => {
      ticketsOpen = !ticketsOpen;
      try { localStorage.setItem('mm_ticketsopen', ticketsOpen ? '1' : '0'); } catch { /* ignore */ }
      ticketsKey = '';
      showTickets(list, visible, hint);
    },
  }, h('b', null, 'Pedidos'), h('span', { class: 'gl-count' }, String(pending || list.length)), h('span', { class: 'gl-caret', 'aria-hidden': 'true' }, ticketsOpen ? '▴' : '▾')) : null;
  const needChips = (l: Ticket['lines'][number]) => [...(l.cup ? [h('span', { class: 'gl-need cup' }, 'Vaso')] : []),
    ...l.needs.map((n) => h('span', { class: 'gl-need' }, `${n.count > 1 ? n.count + '× ' : ''}${itemLabel({ kind: 'ing', uid: 0, ing: n.ing, form: n.form, q: 2 })}`))];
  const cards = ticketsOpen ? list.slice(0, 3).map((t) => {
    const open = ticketsExpanded.has(t.id);
    return h('div', {
      class: 'gl-ticket paper' + (t.done ? ' done' : '') + (t.impatient ? ' late' : '') + (open ? ' open' : ''), role: 'button', tabindex: '0', 'aria-expanded': String(open),
      onclick: () => { if (open) ticketsExpanded.delete(t.id); else ticketsExpanded.add(t.id); ticketsKey = ''; showTickets(list, visible, hint); },
    },
      h('div', { class: 'gl-ticket-head' }, h('b', null, t.label), h('span', { class: 'hint' }, t.who), h('span', { class: 'gl-caret', 'aria-hidden': 'true' }, open ? '▴' : '▾')),
      ...t.lines.map((l) => h('div', { class: 'gl-line' },
        h('span', { class: 'gl-qty' }, `${l.waiting + l.ready}×`),
        h('span', { class: 'gl-name' }, l.name),
        h('span', { class: 'gl-state' + (l.waiting ? '' : ' ok') }, l.waiting ? (l.ready ? `${l.ready} listo` : 'pendiente') : '✓ en el mostrador'),
        open ? h('div', { class: 'gl-needs' }, ...needChips(l)) : null)),
      h('div', { class: 'gl-patience', role: 'img', 'aria-label': `Paciencia ${Math.round(t.patience * 100)}%` }, h('i', { style: { width: `${Math.round(t.patience * 100)}%` } })));
  }) : [];
  const more = ticketsOpen && list.length > 3 ? [h('div', { class: 'gl-more' }, `+${list.length - 3} más`)] : [];
  ticketsEl.replaceChildren(...(chip ? [chip] : []), ...cards, ...more, ...(hint ? [h('div', { class: 'gl-hint paper' }, hint)] : []));
}

// ------------------------------------------------------------------ tutorial card
let tutEl: HTMLElement | null = null;
let tutKey = '';

/** The lesson card: which dish, which step of how many, and what to do now. `null` hides it. */
export function showTutorial(card: { dish: string; n: number; of: number; text: string; done?: boolean } | null, onSkip: () => void) {
  if (!card) { tutEl?.remove(); tutEl = null; tutKey = ''; return; }
  const key = `${card.dish}|${card.n}|${card.text}`;
  if (tutEl && key === tutKey) return;
  tutKey = key;
  tutEl?.remove();
  tutEl = h('div', { class: 'gl-tut paper', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'gl-tut-head' }, h('b', null, card.done ? 'Primera lección' : `Lección · ${card.dish}`), h('span', { class: 'hint' }, card.done ? '' : `${card.n} / ${card.of}`)),
    h('p', null, card.text),
    card.done ? null : h('button', { type: 'button', class: 'btn small', onclick: onSkip }, 'Omitir lección'));
  root().append(tutEl);
}

export function removeGalleyUi() {
  showTutorial(null, () => {});
  closeFridgePicker();
  cutStop?.();
  cutEl?.remove(); cutEl = null;
  ticketsEl?.remove(); ticketsEl = null; ticketsKey = '';
}

